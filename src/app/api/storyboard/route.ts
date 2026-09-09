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
  ERROR_CODES,
  StoryboardCriticOutputSchema,
  StoryboardSchema,
  StoryboardWriterOutputSchema,
} from "../../../lib/contracts.ts";
import {
  STORYBOARD_CRITIC_JSON_SCHEMA,
  STORYBOARD_CRITIC_SCHEMA_NAME,
  STORYBOARD_REPAIR_JSON_SCHEMA,
  STORYBOARD_REPAIR_SCHEMA_NAME,
  STORYBOARD_WRITER_JSON_SCHEMA,
  STORYBOARD_WRITER_SCHEMA_NAME,
  storyboardCriticInstructions,
  storyboardRepairInstructions,
  storyboardWriterInstructions,
} from "../../../lib/prompts.ts";
import {
  checkRawRequestBytes,
  checkStoryboardContent,
  checkStoryboardCriticOutput,
  checkStoryboardRequest,
  checkStoryboardWriterOutput,
  checkWriterConflictReferences,
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
    ROUTE_MODEL_BUDGET_MS.storyboard,
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

    const requestCheck = checkStoryboardRequest(payload);
    if (!requestCheck.ok) {
      return reply(safeErrorResponse(requestCheck.issue.code, requestId));
    }
    const input = requestCheck.value;
    const retryBudget = createSchemaRetryBudget(0);

    const writerResult = await callStructured({
      instructions: storyboardWriterInstructions(input),
      input,
      schemaName: STORYBOARD_WRITER_SCHEMA_NAME,
      schema: STORYBOARD_WRITER_JSON_SCHEMA,
      validator: StoryboardWriterOutputSchema,
      reasoningEffort: "low",
      maxOutputTokens: TOKEN_LIMITS.storyboardWriter,
      retryBudget,
      deadlineAt,
    });
    usage = addUsage(usage, writerResult.usage);

    const writerCheck = checkStoryboardWriterOutput(writerResult.data);
    if (!writerCheck.ok) {
      return reply(safeErrorResponse(writerCheck.issue.code, requestId));
    }

    if (writerCheck.value.kind === "conflict") {
      if (!input.finalAdjustment?.trim()) {
        return reply(
          safeErrorResponse(ERROR_CODES.MODEL_OUTPUT_INVALID, requestId),
        );
      }
      const conflictRefs = checkWriterConflictReferences(
        input,
        writerCheck.value,
      );
      if (!conflictRefs.ok) {
        return reply(safeErrorResponse(conflictRefs.issue.code, requestId));
      }
      return reply(
        safeErrorResponse(ERROR_CODES.CONSTRAINT_CONFLICT, requestId, {
          explanation: writerCheck.value.explanation,
          relatedFactIds: writerCheck.value.relatedFactIds,
          relatedMustHaveIds: writerCheck.value.relatedMustHaveIds,
          relatedConstraintIds: writerCheck.value.relatedConstraintIds,
          ...(writerCheck.value.relatedBranchId
            ? { relatedBranchId: writerCheck.value.relatedBranchId }
            : {}),
        }),
      );
    }

    const writerStoryboard = {
      title: writerCheck.value.title,
      panels: writerCheck.value.panels,
      compliance: writerCheck.value.compliance,
    };
    const writerContentCheck = checkStoryboardContent(
      input,
      writerStoryboard,
    );

    let hardIssues: string[] = [];
    if (writerContentCheck.ok) {
      const criticResult = await callStructured({
        instructions: storyboardCriticInstructions(input),
        input: { request: input, storyboard: writerStoryboard },
        schemaName: STORYBOARD_CRITIC_SCHEMA_NAME,
        schema: STORYBOARD_CRITIC_JSON_SCHEMA,
        validator: StoryboardCriticOutputSchema,
        reasoningEffort: "low",
        maxOutputTokens: TOKEN_LIMITS.storyboardCritic,
        retryBudget,
        deadlineAt,
      });
      usage = addUsage(usage, criticResult.usage);
      const criticCheck = checkStoryboardCriticOutput(criticResult.data);
      if (!criticCheck.ok) {
        return reply(safeErrorResponse(criticCheck.issue.code, requestId));
      }
      if (criticCheck.value.verdict === "pass") {
        return reply(jsonResponse(writerContentCheck.value));
      }
      hardIssues = criticCheck.value.issues;
    } else {
      hardIssues = [writerContentCheck.issue.message];
    }

    const repairResult = await callStructured({
      instructions: storyboardRepairInstructions(input),
      input: {
        request: input,
        storyboard: writerStoryboard,
        issues: hardIssues,
      },
      schemaName: STORYBOARD_REPAIR_SCHEMA_NAME,
      schema: STORYBOARD_REPAIR_JSON_SCHEMA,
      validator: StoryboardSchema,
      reasoningEffort: "low",
      maxOutputTokens: TOKEN_LIMITS.repair,
      retryBudget,
      deadlineAt,
    });
    usage = addUsage(usage, repairResult.usage);

    const repairedContentCheck = checkStoryboardContent(
      input,
      repairResult.data,
    );
    if (!repairedContentCheck.ok) {
      return reply(
        safeErrorResponse(ERROR_CODES.MODEL_OUTPUT_INVALID, requestId),
      );
    }

    const finalCriticResult = await callStructured({
      instructions: storyboardCriticInstructions(input),
      input: { request: input, storyboard: repairedContentCheck.value },
      schemaName: STORYBOARD_CRITIC_SCHEMA_NAME,
      schema: STORYBOARD_CRITIC_JSON_SCHEMA,
      validator: StoryboardCriticOutputSchema,
      reasoningEffort: "low",
      maxOutputTokens: TOKEN_LIMITS.storyboardCritic,
      retryBudget,
      deadlineAt,
    });
    usage = addUsage(usage, finalCriticResult.usage);
    const finalCriticCheck = checkStoryboardCriticOutput(
      finalCriticResult.data,
    );
    if (!finalCriticCheck.ok) {
      return reply(safeErrorResponse(finalCriticCheck.issue.code, requestId));
    }
    if (finalCriticCheck.value.verdict === "hard_fail") {
      return reply(
        safeErrorResponse(ERROR_CODES.MODEL_OUTPUT_INVALID, requestId),
      );
    }
    return reply(jsonResponse(repairedContentCheck.value));
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
      "/api/storyboard",
      requestId,
      startedAt,
      status,
      usage,
    );
  }
}
