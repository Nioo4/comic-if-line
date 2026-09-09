import {
  addUsage,
  callStructured,
  createReservedAttemptDeadline,
  createRouteDeadline,
  createSchemaRetryBudget,
  errorCodeFromUnknown,
  errorRetryableFromUnknown,
  getRemainingModelTime,
  logRouteCompletion,
  normalizeSdkError,
  safeErrorResponse,
  ROUTE_MODEL_BUDGET_MS,
  TOKEN_LIMITS,
  type UsageNumbers,
} from "../../../lib/ai.ts";
import {
  BranchCriticOutputSchema,
  BranchGeneratorOutputSchema,
  ERROR_CODES,
  type BranchSkeleton,
} from "../../../lib/contracts.ts";
import {
  BRANCH_CRITIC_JSON_SCHEMA,
  BRANCH_CRITIC_SCHEMA_NAME,
  BRANCH_GENERATOR_JSON_SCHEMA,
  BRANCH_GENERATOR_SCHEMA_NAME,
  branchCriticInstructions,
  branchGeneratorInstructions,
} from "../../../lib/prompts.ts";
import {
  assembleBranchesResponse,
  checkBranchCriticOutput,
  checkBranchGeneratorOutput,
  checkBranchesRequest,
  checkRawRequestBytes,
  mergeBranchCriticPartitions,
} from "../../../lib/rules.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const CRITIC_RETRY_RESERVE_MS = 75_000;
const CRITIC_MIN_FIRST_ATTEMPT_MS = 30_000;

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const startedAt = Date.now();
  const deadlineAt = createRouteDeadline(
    startedAt,
    ROUTE_MODEL_BUDGET_MS.branches,
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
      return reply(safeErrorResponse(ERROR_CODES.INVALID_INPUT, requestId));
    }

    const requestCheck = checkBranchesRequest(payload);
    if (!requestCheck.ok) {
      return reply(safeErrorResponse(requestCheck.issue.code, requestId));
    }
    const input = requestCheck.value;
    if (input.unresolvedConflicts.length > 0) {
      return reply(
        safeErrorResponse(ERROR_CODES.CONSTRAINT_CONFLICT, requestId),
      );
    }

    const retryBudget = createSchemaRetryBudget(1);
    const generatorResult = await callStructured({
      instructions: branchGeneratorInstructions(input),
      input,
      schemaName: BRANCH_GENERATOR_SCHEMA_NAME,
      schema: BRANCH_GENERATOR_JSON_SCHEMA,
      validator: BranchGeneratorOutputSchema,
      reasoningEffort: "low",
      maxOutputTokens: TOKEN_LIMITS.branchGenerator,
      retryBudget,
      deadlineAt,
    });
    usage = addUsage(usage, generatorResult.usage);

    const generatorCheck = checkBranchGeneratorOutput(
      input,
      generatorResult.data,
    );
    if (!generatorCheck.ok) {
      return reply(safeErrorResponse(generatorCheck.issue.code, requestId));
    }

    const criticBatches = [
      generatorCheck.value.skeletons.slice(0, 3),
      generatorCheck.value.skeletons.slice(3, 5),
    ];
    const runCritic = (
      skeletons: BranchSkeleton[],
      deadlineAt: number,
    ) =>
      callStructured({
        instructions: branchCriticInstructions(input),
        input: { ...input, skeletons },
        schemaName: BRANCH_CRITIC_SCHEMA_NAME,
        schema: BRANCH_CRITIC_JSON_SCHEMA,
        validator: BranchCriticOutputSchema,
        reasoningEffort: "low",
        maxOutputTokens: TOKEN_LIMITS.branchCritic,
        retryBudget,
        deadlineAt,
      });
    const firstCriticDeadline = createReservedAttemptDeadline(
      deadlineAt,
      CRITIC_RETRY_RESERVE_MS,
      CRITIC_MIN_FIRST_ATTEMPT_MS,
    );
    const firstCriticResults = await Promise.allSettled(
      criticBatches.map((skeletons) =>
        runCritic(skeletons, firstCriticDeadline),
      ),
    );
    const criticResults = await Promise.all(
      firstCriticResults.map(async (result, index) => {
        if (result.status === "fulfilled") return result.value;
        const error = normalizeSdkError(result.reason);
        if (!error.retryable) throw error;
        console.info(
          JSON.stringify({
            requestId,
            route: "/api/branches",
            event: "critic_retry",
            batch: index,
            errorCode: error.code,
            remainingMs: getRemainingModelTime(deadlineAt),
          }),
        );
        return runCritic(criticBatches[index], deadlineAt);
      }),
    );
    for (const result of criticResults) {
      usage = addUsage(usage, result.usage);
    }

    const criticChecks = criticResults.map((result, index) =>
      checkBranchCriticOutput(
        criticBatches[index],
        result.data,
        input.intent,
        input.canonFacts.map((fact) => fact.id),
        input.assumptions.map((assumption) => assumption.id),
      ),
    );
    const checkedCriticPartitions = [];
    for (const criticCheck of criticChecks) {
      if (!criticCheck.ok) {
        return reply(safeErrorResponse(criticCheck.issue.code, requestId));
      }
      checkedCriticPartitions.push(criticCheck.value);
    }

    const mergedCritic = mergeBranchCriticPartitions(
      generatorCheck.value.skeletons,
      checkedCriticPartitions,
    );
    if (!mergedCritic.ok) {
      return reply(safeErrorResponse(mergedCritic.issue.code, requestId));
    }

    const assembled = assembleBranchesResponse(
      generatorCheck.value,
      mergedCritic.value,
      input.intent,
      input.canonFacts.map((fact) => fact.id),
      input.assumptions.map((assumption) => assumption.id),
    );
    if (!assembled.ok) {
      return reply(safeErrorResponse(assembled.issue.code, requestId));
    }
    return reply(jsonResponse(assembled.value));
  } catch (error) {
    return reply(
      safeErrorResponse(
        errorCodeFromUnknown(error, deadlineAt),
        requestId,
        undefined,
        errorRetryableFromUnknown(error),
      ),
    );
  } finally {
    logRouteCompletion(
      "/api/branches",
      requestId,
      startedAt,
      status,
      usage,
    );
  }
}
