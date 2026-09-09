import {
  addUsage,
  callStructured,
  createRouteDeadline,
  createSchemaRetryBudget,
  errorCodeFromUnknown,
  errorRetryableFromUnknown,
  logRouteCompletion,
  safeErrorResponse,
  ROUTE_MODEL_BUDGET_MS,
  TOKEN_LIMITS,
  type UsageNumbers,
} from "../../../lib/ai.ts";
import {
  AnalyzeResponseSchema,
  ERROR_CODES,
} from "../../../lib/contracts.ts";
import {
  ANALYZE_JSON_SCHEMA,
  ANALYZE_SCHEMA_NAME,
  analyzeInstructions,
} from "../../../lib/prompts.ts";
import {
  checkAnalyzeRequest,
  checkAnalyzeResponse,
  getMaxRequestBytes,
  checkRawRequestBytes,
} from "../../../lib/rules.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const startedAt = Date.now();
  const deadlineAt = createRouteDeadline(
    startedAt,
    ROUTE_MODEL_BUDGET_MS.analyze,
  );
  let status = 500;
  let usage: UsageNumbers = {};

  const reply = (response: Response) => {
    status = response.status;
    return response;
  };

  try {
    const rawBody = await request.text();
    const sizeCheck = checkRawRequestBytes(rawBody);
    if (!sizeCheck.ok) {
      return reply(safeErrorResponse(sizeCheck.issue.code, requestId));
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply(
        safeErrorResponse(ERROR_CODES.INVALID_INPUT, requestId),
      );
    }

    const requestCheck = checkAnalyzeRequest(payload, getMaxRequestBytes());
    if (!requestCheck.ok) {
      return reply(safeErrorResponse(requestCheck.issue.code, requestId));
    }

    const result = await callStructured({
      instructions: analyzeInstructions(requestCheck.value),
      input: requestCheck.value,
      schemaName: ANALYZE_SCHEMA_NAME,
      schema: ANALYZE_JSON_SCHEMA,
      validator: AnalyzeResponseSchema,
      reasoningEffort: "low",
      maxOutputTokens: TOKEN_LIMITS.analyze,
      retryBudget: createSchemaRetryBudget(1),
      deadlineAt,
    });
    usage = addUsage(usage, result.usage);

    const outputCheck = checkAnalyzeResponse(
      requestCheck.value.intent,
      result.data,
    );
    if (!outputCheck.ok) {
      return reply(safeErrorResponse(outputCheck.issue.code, requestId));
    }
    return reply(jsonResponse(outputCheck.value));
  } catch (error) {
    return reply(
      safeErrorResponse(
        errorCodeFromUnknown(error),
        requestId,
        undefined,
        errorRetryableFromUnknown(error),
      ),
    );
  } finally {
    logRouteCompletion(
      "/api/analyze",
      requestId,
      startedAt,
      status,
      usage,
    );
  }
}
