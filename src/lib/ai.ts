import OpenAI from "openai";
import { z } from "zod";
import {
  ERROR_CODES,
  type ErrorCode,
  type SafeConflictDetails,
} from "./contracts.ts";

export const DEEPSEEK_MODEL = "deepseek-v4-pro" as const;
export const DEFAULT_AI_CALL_TIMEOUT_MS = 180_000;
export const ROUTE_MODEL_BUDGET_MS = {
  analyze: 190_000,
  branches: 285_000,
  storyboard: 285_000,
} as const;
export const TOKEN_LIMITS = {
  analyze: 4096,
  branchGenerator: 8192,
  branchCritic: 8192,
  storyboardWriter: 8192,
  storyboardCritic: 8192,
  repair: 8192,
} as const;

export type ReasoningEffort = "low";

export type UsageNumbers = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type SchemaRetryBudget = { remaining: 0 | 1 };

export class AiError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly structureFailure: boolean;

  constructor(
    code: ErrorCode,
    retryable: boolean,
    structureFailure = false,
  ) {
    super(code);
    this.code = code;
    this.retryable = retryable;
    this.structureFailure = structureFailure;
    this.name = "AiError";
  }
}

export type StructuredCallOptions<T> = {
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  validator: z.ZodType<T>;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  retryBudget: SchemaRetryBudget;
  deadlineAt: number;
};

export type StructuredCallResult<T> = {
  data: T;
  usage: UsageNumbers;
};

let client: OpenAI | undefined;

function getTimeoutMs(): number {
  const configured = Number(process.env.AI_CALL_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_AI_CALL_TIMEOUT_MS;
}

function getConfiguredClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const baseURL = process.env.DEEPSEEK_BASE_URL?.trim();
  if (!apiKey || !baseURL) {
    throw new AiError(ERROR_CODES.MODEL_NOT_CONFIGURED, false);
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL,
      maxRetries: 0,
      timeout: getTimeoutMs(),
    });
  }
  return client;
}

export function createSchemaRetryBudget(initialRemaining: 0 | 1): SchemaRetryBudget {
  return { remaining: initialRemaining };
}

export function consumeSchemaRetry(budget: SchemaRetryBudget): boolean {
  if (budget.remaining === 0) return false;
  budget.remaining = 0;
  return true;
}

export function createRouteDeadline(
  startedAt: number,
  budgetMs: number,
): number {
  return startedAt + budgetMs;
}

export function getRemainingModelTime(
  deadlineAt: number,
  now = Date.now(),
): number {
  return Math.max(0, deadlineAt - now);
}

export function createReservedAttemptDeadline(
  deadlineAt: number,
  reserveMs: number,
  minAttemptMs: number,
  now = Date.now(),
): number {
  const remainingMs = getRemainingModelTime(deadlineAt, now);
  return remainingMs > reserveMs + minAttemptMs
    ? deadlineAt - reserveMs
    : deadlineAt;
}

export function getEffectiveAiTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  return Math.min(
    getTimeoutMs(),
    getRemainingModelTime(deadlineAt, now),
  );
}

function normalizeUsage(value: unknown): UsageNumbers {
  if (!value || typeof value !== "object") return {};
  const usage = value as Record<string, unknown>;
  const numbers: UsageNumbers = {};
  for (const [key, outputKey] of [
    ["input_tokens", "input_tokens"],
    ["output_tokens", "output_tokens"],
    ["total_tokens", "total_tokens"],
  ] as const) {
    if (typeof usage[key] === "number" && Number.isFinite(usage[key])) {
      numbers[outputKey] = usage[key];
    }
  }
  return numbers;
}

export function addUsage(
  total: UsageNumbers,
  next: UsageNumbers,
): UsageNumbers {
  const result: UsageNumbers = { ...total };
  for (const key of ["input_tokens", "output_tokens", "total_tokens"] as const) {
    if (next[key] !== undefined) {
      result[key] = (result[key] ?? 0) + next[key];
    }
  }
  return result;
}

export function isIncompleteStructuredResponse(response: unknown): boolean {
  if (!response || typeof response !== "object") return true;
  const record = response as { status?: unknown; output_text?: unknown };
  return (
    (record.status !== undefined && record.status !== "completed") ||
    typeof record.output_text !== "string" ||
    record.output_text.trim() === ""
  );
}

const TIMEOUT_ERROR_CODES = new Set([
  "ABORT_ERR",
  "ECONNABORTED",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function isTimeoutLike(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 2) return false;
  const record = error as Record<string, unknown>;
  const status = typeof record.status === "number" ? record.status : undefined;
  const name = typeof record.name === "string" ? record.name : "";
  const code = typeof record.code === "string" ? record.code : "";
  const constructorValue = record.constructor;
  const constructorName =
    constructorValue &&
    (typeof constructorValue === "object" ||
      typeof constructorValue === "function") &&
    typeof (constructorValue as { name?: unknown }).name === "string"
      ? (constructorValue as { name: string }).name
      : "";
  if (
    status === 408 ||
    name === "AbortError" ||
    name.includes("Timeout") ||
    constructorName.includes("Timeout") ||
    TIMEOUT_ERROR_CODES.has(code)
  ) {
    return true;
  }
  return isTimeoutLike(record.cause, depth + 1);
}

export function normalizeSdkError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const record =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  const status = typeof record.status === "number" ? record.status : undefined;
  if (isTimeoutLike(error)) {
    return new AiError(ERROR_CODES.MODEL_TIMEOUT, true);
  }
  if (status === 429) {
    return new AiError(ERROR_CODES.MODEL_RATE_LIMITED, true);
  }
  if (status === 401 || status === 403 || status === 404) {
    return new AiError(ERROR_CODES.MODEL_UNAVAILABLE, false);
  }
  if (status !== undefined && status >= 500) {
    return new AiError(ERROR_CODES.MODEL_UNAVAILABLE, true);
  }
  return new AiError(ERROR_CODES.INTERNAL_ERROR, true);
}

async function callOnce<T>(
  options: StructuredCallOptions<T>,
): Promise<StructuredCallResult<T>> {
  const timeoutMs = getEffectiveAiTimeoutMs(options.deadlineAt);
  if (timeoutMs <= 0) {
    throw new AiError(ERROR_CODES.MODEL_TIMEOUT, true);
  }
  const configuredClient = getConfiguredClient();
  const serializedInput = JSON.stringify(options.input);
  if (serializedInput === undefined) {
    throw new AiError(ERROR_CODES.INTERNAL_ERROR, false);
  }

  const request = {
    model: DEEPSEEK_MODEL,
    instructions: options.instructions,
    input: serializedInput,
    reasoning: { effort: options.reasoningEffort },
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        schema: options.schema,
      },
    },
    max_output_tokens: options.maxOutputTokens,
  } as OpenAI.Responses.ResponseCreateParamsNonStreaming;

  let response: unknown;
  try {
    response = await configuredClient.responses.create(request, {
      timeout: timeoutMs,
    });
  } catch (error) {
    throw normalizeSdkError(error);
  }

  if (getRemainingModelTime(options.deadlineAt) <= 0) {
    throw new AiError(ERROR_CODES.MODEL_TIMEOUT, true);
  }

  const record = response as {
    status?: string;
    output_text?: unknown;
    usage?: unknown;
  };
  if (isIncompleteStructuredResponse(response)) {
    throw new AiError(ERROR_CODES.MODEL_OUTPUT_INVALID, false, true);
  }

  let json: unknown;
  try {
    json = JSON.parse(record.output_text as string);
  } catch {
    throw new AiError(ERROR_CODES.MODEL_OUTPUT_INVALID, false, true);
  }
  const parsed = options.validator.safeParse(json);
  if (!parsed.success) {
    throw new AiError(ERROR_CODES.MODEL_OUTPUT_INVALID, false, true);
  }
  return { data: parsed.data, usage: normalizeUsage(record.usage) };
}

export async function callStructured<T>(
  options: StructuredCallOptions<T>,
): Promise<StructuredCallResult<T>> {
  while (true) {
    try {
      return await callOnce(options);
    } catch (error) {
      const aiError = normalizeSdkError(error);
      if (!aiError.structureFailure || !consumeSchemaRetry(options.retryBudget)) {
        throw aiError;
      }
    }
  }
}

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.INVALID_INPUT]: "请求格式无效，请检查输入后重试。",
  [ERROR_CODES.CONSTRAINT_CONFLICT]: "当前请求与已锁定事实或约束冲突。",
  [ERROR_CODES.REQUEST_TOO_LARGE]: "本次输入超过容量限制，请整理后重试。",
  [ERROR_CODES.NO_VALID_BRANCH]: "没有通过约束审查的分支。",
  [ERROR_CODES.MODEL_RATE_LIMITED]: "模型服务当前繁忙，请稍后重试。",
  [ERROR_CODES.MODEL_OUTPUT_INVALID]: "模型返回无法验证的结构，请重试。",
  [ERROR_CODES.MODEL_NOT_CONFIGURED]: "模型服务尚未配置。",
  [ERROR_CODES.MODEL_UNAVAILABLE]: "模型服务当前不可用，请稍后重试。",
  [ERROR_CODES.MODEL_TIMEOUT]: "模型请求超时，请稍后重试。",
  [ERROR_CODES.INTERNAL_ERROR]: "服务暂时不可用，请稍后重试。",
};

const HTTP_STATUS: Record<ErrorCode, number> = {
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.CONSTRAINT_CONFLICT]: 409,
  [ERROR_CODES.REQUEST_TOO_LARGE]: 413,
  [ERROR_CODES.NO_VALID_BRANCH]: 422,
  [ERROR_CODES.MODEL_RATE_LIMITED]: 429,
  [ERROR_CODES.MODEL_OUTPUT_INVALID]: 502,
  [ERROR_CODES.MODEL_NOT_CONFIGURED]: 503,
  [ERROR_CODES.MODEL_UNAVAILABLE]: 503,
  [ERROR_CODES.MODEL_TIMEOUT]: 504,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
};

const RETRYABLE_CODES = new Set<ErrorCode>([
  ERROR_CODES.MODEL_RATE_LIMITED,
  ERROR_CODES.MODEL_OUTPUT_INVALID,
  ERROR_CODES.MODEL_UNAVAILABLE,
  ERROR_CODES.MODEL_TIMEOUT,
  ERROR_CODES.INTERNAL_ERROR,
]);

export function safeErrorResponse(
  code: ErrorCode,
  requestId: string,
  details?: SafeConflictDetails,
  retryableOverride?: boolean,
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: SAFE_MESSAGES[code],
        retryable: retryableOverride ?? RETRYABLE_CODES.has(code),
        requestId,
        ...(details ? { details } : {}),
      },
    }),
    {
      status: HTTP_STATUS[code],
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

export function errorCodeFromUnknown(
  error: unknown,
  deadlineAt?: number,
): ErrorCode {
  if (
    deadlineAt !== undefined &&
    getRemainingModelTime(deadlineAt) <= 0 &&
    (!(error instanceof AiError) || error.code === ERROR_CODES.INTERNAL_ERROR)
  ) {
    return ERROR_CODES.MODEL_TIMEOUT;
  }
  if (error instanceof AiError) return error.code;
  return ERROR_CODES.INTERNAL_ERROR;
}

export function errorRetryableFromUnknown(
  error: unknown,
): boolean | undefined {
  if (!(error instanceof AiError)) return undefined;
  if (error.code === ERROR_CODES.MODEL_OUTPUT_INVALID) return undefined;
  return error.retryable;
}

export function logRouteCompletion(
  route: string,
  requestId: string,
  startedAt: number,
  status: number,
  usage: UsageNumbers,
): void {
  const safeUsage = Object.fromEntries(
    Object.entries(usage).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value),
    ),
  );
  console.info(
    JSON.stringify({
      requestId,
      route,
      duration: Math.max(0, Date.now() - startedAt),
      status,
      model: DEEPSEEK_MODEL,
      usage: safeUsage,
    }),
  );
}
