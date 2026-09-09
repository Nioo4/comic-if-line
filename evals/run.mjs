import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(
  fs.readFileSync(path.join(here, "cases.json"), "utf8"),
);
const {
  checkBranchCriticOutput,
  checkBranchGeneratorOutput,
  checkAnalyzeRequest,
  checkBranchesResponse,
  checkRawRequestBytes,
  checkStoryboardRequest,
  checkStoryboardResponse,
  checkStoryboardWriterOutput,
  checkSixPanelOrder,
  assembleBranchesResponse,
  mergeBranchCriticPartitions,
} = await import("../src/lib/rules.ts");
const {
  consumeSchemaRetry,
  createRouteDeadline,
  createSchemaRetryBudget,
  DEFAULT_AI_CALL_TIMEOUT_MS,
  getEffectiveAiTimeoutMs,
  getRemainingModelTime,
  isIncompleteStructuredResponse,
  normalizeSdkError,
  ROUTE_MODEL_BUDGET_MS,
  TOKEN_LIMITS,
} = await import("../src/lib/ai.ts");
const { restoreSession, serializeSession } = await import(
  "../src/lib/session.ts"
);
const { ConfirmedCanonFactSchema } = await import(
  "../src/lib/contracts.ts"
);

for (const [routeName, expectation] of Object.entries({
  analyze: {
    callSites: 1,
    totalCalls: 1,
    maxCalls: 2,
    retryArguments: [1],
    budgetKey: "analyze",
    budgetMs: ROUTE_MODEL_BUDGET_MS.analyze,
  },
  branches: {
    callSites: 2,
    totalCalls: 3,
    maxCalls: 4,
    retryArguments: [1],
    budgetKey: "branches",
    budgetMs: ROUTE_MODEL_BUDGET_MS.branches,
  },
  storyboard: {
    callSites: 4,
    totalCalls: 4,
    maxCalls: 4,
    retryArguments: [0],
    budgetKey: "storyboard",
    budgetMs: ROUTE_MODEL_BUDGET_MS.storyboard,
  },
})) {
  const routeSource = fs.readFileSync(
    path.join(here, `../src/app/api/${routeName}/route.ts`),
    "utf8",
  );
  const efforts = [...routeSource.matchAll(/reasoningEffort:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(efforts.length, expectation.callSites);
  assert.deepEqual(efforts, Array(expectation.callSites).fill("low"));
  assert.equal(
    routeSource.match(/callStructured\(\{/g)?.length ?? 0,
    expectation.callSites,
  );
  assert.equal(
    routeSource.match(/\bdeadlineAt,/g)?.length ?? 0,
    expectation.callSites,
  );
  assert.match(
    routeSource,
    new RegExp(
      `createRouteDeadline\\(\\s*startedAt,\\s*ROUTE_MODEL_BUDGET_MS\\.${expectation.budgetKey}\\s*,?\\s*\\)`,
    ),
  );
  const maxDuration = routeSource.match(/export const maxDuration = (\d+);/);
  assert.equal(Number(maxDuration?.[1]), 300);
  const retryArguments = [
    ...routeSource.matchAll(/createSchemaRetryBudget\((0|1)\)/g),
  ].map((match) => Number(match[1]));
  assert.deepEqual(retryArguments, expectation.retryArguments);
  if (routeName === "branches") {
    assert.match(routeSource, /Promise\.all\(/);
    assert.match(routeSource, /slice\(0, 3\)/);
    assert.match(routeSource, /slice\(3, 5\)/);
    assert.match(routeSource, /mergeBranchCriticPartitions/);
    assert.equal(
      routeSource.match(/criticBatches\.map/g)?.length ?? 0,
      1,
    );
    assert.match(routeSource, /const retryBudget = createSchemaRetryBudget\(1\)/);
    assert.equal(routeSource.match(/\bretryBudget,/g)?.length ?? 0, 2);
    assert.doesNotMatch(routeSource, /createSchemaRetryBudget\(0\)/);
  }
  assert.equal(expectation.totalCalls, routeName === "branches" ? 3 : expectation.callSites);
  assert.equal(expectation.maxCalls, routeName === "analyze" ? 2 : routeName === "branches" ? 4 : 4);
}
assert.equal(DEFAULT_AI_CALL_TIMEOUT_MS, 180_000);
assert.deepEqual(ROUTE_MODEL_BUDGET_MS, {
  analyze: 190_000,
  branches: 285_000,
  storyboard: 285_000,
});
assert.equal(createRouteDeadline(1_000, 190_000), 191_000);
assert.equal(getRemainingModelTime(191_000, 1_000), 190_000);
assert.equal(getRemainingModelTime(191_000, 191_000), 0);
assert.equal(getRemainingModelTime(191_000, 191_001), 0);
assert.equal(
  isIncompleteStructuredResponse({ status: "incomplete", output_text: "{}" }),
  true,
);
assert.equal(isIncompleteStructuredResponse({ status: "completed" }), true);
assert.equal(
  isIncompleteStructuredResponse({ status: "completed", output_text: "   " }),
  true,
);
assert.equal(
  isIncompleteStructuredResponse({ status: "completed", output_text: "{}" }),
  false,
);
const previousTimeoutEnv = process.env.AI_CALL_TIMEOUT_MS;
try {
  delete process.env.AI_CALL_TIMEOUT_MS;
  assert.equal(getEffectiveAiTimeoutMs(400_000, 100_000), 180_000);
  assert.equal(getEffectiveAiTimeoutMs(250_000, 100_000), 150_000);
  assert.equal(getEffectiveAiTimeoutMs(200_000, 200_000), 0);

  process.env.AI_CALL_TIMEOUT_MS = "180000";
  assert.equal(getEffectiveAiTimeoutMs(400_000, 100_000), 180_000);
  assert.equal(getEffectiveAiTimeoutMs(250_000, 100_000), 150_000);

  process.env.AI_CALL_TIMEOUT_MS = "not-a-number";
  assert.equal(getEffectiveAiTimeoutMs(300_000, 100_000), 180_000);
} finally {
  if (previousTimeoutEnv === undefined) {
    delete process.env.AI_CALL_TIMEOUT_MS;
  } else {
    process.env.AI_CALL_TIMEOUT_MS = previousTimeoutEnv;
  }
}
assert.deepEqual(TOKEN_LIMITS, {
  analyze: 4096,
  branchGenerator: 8192,
  branchCritic: 8192,
  storyboardWriter: 8192,
  storyboardCritic: 8192,
  repair: 8192,
});
assert.match(
  fs.readFileSync(path.join(here, "../.env.example"), "utf8"),
  /^AI_CALL_TIMEOUT_MS=180000$/m,
);

const byId = (id) => cases.find((item) => item.id === id);
const intentOf = (id) => byId(id).input;
const analyzePayload = (intent) => ({ intent, clarificationAnswers: [] });

assert.equal(cases.length, 8, "cases.json must contain C01-C08");
assert.deepEqual(
  cases.map((item) => item.id),
  ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"],
);

const c03 = intentOf("C03");
assert.match(c03.mustHaves[0].text, /必须当晚离开医院/);
assert.match(c03.constraints[0].text, /必须在当晚留在医院/);
assert.notEqual(c03.mustHaves[0].text, c03.constraints[0].text);

for (const id of ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]) {
  const result = checkAnalyzeRequest(analyzePayload(intentOf(id)));
  assert.equal(result.ok, true, `${id} should have a valid intent`);
}

const blankIntent = { ...intentOf("C01"), plotContext: "   " };
assert.equal(checkAnalyzeRequest(analyzePayload(blankIntent)).ok, false);

const oversizedIntent = {
  ...intentOf("C08"),
  plotContext: "潮".repeat(40_000),
};
const oversized = checkAnalyzeRequest(analyzePayload(oversizedIntent));
assert.equal(oversized.ok, false);
if (!oversized.ok) assert.equal(oversized.issue.code, "REQUEST_TOO_LARGE");

const c01 = intentOf("C01");
const skeleton = {
  id: "c01-b1",
  title: "在闭馆前说出原因",
  divergencePoint: "岚舟没有把钥匙直接交出去，而是先叫住澄夏。",
  motivation: "他不想让最后一次见面继续被沉默替代。",
  causalSteps: [
    { order: 1, cause: "岚舟叫住澄夏", effect: "她停下脚步" },
    { order: 2, cause: "他承认自己准备离开", effect: "她追问原因" },
    { order: 3, cause: "两人交换已知事实", effect: "误会被拆开" },
  ],
  cost: "剧院仍会关闭，他们只能暂时分开。",
  outcome: "两人说清原因，并留下下一次见面的约定。",
  newAssumptions: [],
};
const candidate = {
  ...skeleton,
  coveredMustHaveIds: ["c01-m1"],
  coveredPreferenceIds: ["c01-p1"],
  respectedConstraintIds: ["c01-c1"],
  evidenceFactIds: [],
  usedAssumptionIds: [],
  warnings: [],
};
const branches = {
  generatedCount: 5,
  candidates: [candidate],
  rejected: [1, 2, 3, 4].map((number) => ({
    candidateId: `c01-b${number + 1}`,
    title: `未采用方案 ${number}`,
    reasons: ["未满足当前约束"],
  })),
};
assert.equal(checkBranchesResponse(c01, branches).ok, true);
const missingMustHaveBranches = {
  ...branches,
  candidates: [{ ...candidate, coveredMustHaveIds: [] }],
};
assert.equal(checkBranchesResponse(c01, missingMustHaveBranches).ok, false);
const missingConstraintBranches = {
  ...branches,
  candidates: [{ ...candidate, respectedConstraintIds: [] }],
};
assert.equal(checkBranchesResponse(c01, missingConstraintBranches).ok, false);
const duplicateBranches = {
  ...branches,
  rejected: branches.rejected.map((item, index) =>
    index === 0 ? { ...item, candidateId: "c01-b1" } : item,
  ),
};
assert.equal(checkBranchesResponse(c01, duplicateBranches).ok, false);
const unknownReferenceBranches = {
  ...branches,
  candidates: [
    { ...candidate, coveredPreferenceIds: ["c01-p1", "not-an-input-id"] },
  ],
};
assert.equal(checkBranchesResponse(c01, unknownReferenceBranches).ok, false);
const duplicateReferenceBranches = {
  ...branches,
  candidates: [{ ...candidate, coveredMustHaveIds: ["c01-m1", "c01-m1"] }],
};
assert.equal(checkBranchesResponse(c01, duplicateReferenceBranches).ok, false);

const branchesRequest = {
  intent: c01,
  canonFacts: [],
  assumptions: [],
  unresolvedConflicts: [],
};
const skeletons = Array.from({ length: 5 }, (_, index) => ({
  ...skeleton,
  id: `c01-b${index + 1}`,
}));
const generatorOutput = { skeletons };
assert.equal(
  checkBranchGeneratorOutput(branchesRequest, generatorOutput).ok,
  true,
);
assert.equal(
  checkBranchGeneratorOutput(branchesRequest, {
    skeletons: skeletons.map((item, index) =>
      index === 0 ? { ...item, coveredMustHaveIds: ["c01-m1"] } : item,
    ),
  }).ok,
  false,
);
assert.equal(
  checkBranchGeneratorOutput(branchesRequest, {
    skeletons: skeletons.map((item, index) =>
      index === 0
        ? {
            ...item,
            newAssumptions: [
              { id: "c01-a1", text: "临时假设", source: "user_provided" },
            ],
          }
        : item,
    ),
  }).ok,
  false,
);

const skeletonsWithOwnAssumptions = skeletons.map((item) => ({
  ...item,
  newAssumptions: [
    {
      id: `${item.id}-a1`,
      text: "该候选暂时采用的局部假设",
      source: "ai_suggested",
    },
  ],
}));
assert.equal(
  checkBranchGeneratorOutput(branchesRequest, {
    skeletons: skeletonsWithOwnAssumptions,
  }).ok,
  true,
);

const criticPartition = {
  accepted: skeletons.slice(0, 3).map((item) => ({
    candidateId: item.id,
    coveredPreferenceIds: ["c01-p1"],
    evidenceFactIds: [],
    usedAssumptionIds: [],
    warnings: [],
  })),
  rejected: skeletons.slice(3).map((item, index) => ({
    candidateId: item.id,
    reasons: [`未满足硬约束 ${index + 1}`],
  })),
};
const firstCriticBatch = {
  accepted: skeletons.slice(0, 3).map((item) => ({
    candidateId: item.id,
    coveredPreferenceIds: ["c01-p1"],
    evidenceFactIds: [],
    usedAssumptionIds: [],
    warnings: [],
  })),
  rejected: [],
};
const ownAssumptionCriticPartition = {
  accepted: skeletonsWithOwnAssumptions.slice(0, 3).map((item) => ({
    candidateId: item.id,
    coveredPreferenceIds: [],
    evidenceFactIds: [],
    usedAssumptionIds: [item.newAssumptions[0].id],
    warnings: [],
  })),
  rejected: skeletonsWithOwnAssumptions.slice(3).map((item) => ({
    candidateId: item.id,
    reasons: ["未满足硬约束"],
  })),
};
assert.equal(
  checkBranchCriticOutput(
    skeletonsWithOwnAssumptions,
    ownAssumptionCriticPartition,
    c01,
    [],
    [],
  ).ok,
  true,
);
assert.equal(
  checkBranchCriticOutput(
    skeletonsWithOwnAssumptions,
    {
      ...ownAssumptionCriticPartition,
      accepted: [
        {
          ...ownAssumptionCriticPartition.accepted[0],
          usedAssumptionIds: [skeletonsWithOwnAssumptions[1].newAssumptions[0].id],
        },
        ...ownAssumptionCriticPartition.accepted.slice(1),
      ],
    },
    c01,
    [],
    [],
  ).ok,
  false,
);
assert.equal(
  checkBranchCriticOutput(
    skeletonsWithOwnAssumptions,
    {
      ...ownAssumptionCriticPartition,
      accepted: [
        {
          ...ownAssumptionCriticPartition.accepted[0],
          usedAssumptionIds: ["unknown-new-assumption"],
        },
        ...ownAssumptionCriticPartition.accepted.slice(1),
      ],
    },
    c01,
    [],
    [],
  ).ok,
  false,
);
const ownAssumptionResponse = assembleBranchesResponse(
  { skeletons: skeletonsWithOwnAssumptions },
  ownAssumptionCriticPartition,
  c01,
  [],
  [],
);
assert.equal(ownAssumptionResponse.ok, true);
if (ownAssumptionResponse.ok) {
  assert.equal(
    checkBranchesResponse(c01, ownAssumptionResponse.value, [], []).ok,
    true,
  );
  assert.equal(
    checkBranchesResponse(
      c01,
      {
        ...ownAssumptionResponse.value,
        candidates: [
          ...ownAssumptionResponse.value.candidates.map((item, index) =>
            index === 0
              ? { ...item, usedAssumptionIds: ["unknown-new-assumption"] }
              : item,
          ),
        ],
      },
      [],
      [],
    ).ok,
    false,
  );
}
const secondCriticBatch = {
  accepted: skeletons.slice(3).map((item) => ({
    candidateId: item.id,
    coveredPreferenceIds: [],
    evidenceFactIds: [],
    usedAssumptionIds: [],
    warnings: [],
  })),
  rejected: [],
};
assert.equal(
  checkBranchCriticOutput(
    skeletons.slice(0, 3),
    firstCriticBatch,
    c01,
    [],
    [],
  ).ok,
  true,
);
assert.equal(
  checkBranchCriticOutput(
    skeletons.slice(3),
    secondCriticBatch,
    c01,
    [],
    [],
  ).ok,
  true,
);
const mergedAllAccepted = mergeBranchCriticPartitions(
  skeletons,
  [firstCriticBatch, secondCriticBatch],
);
assert.equal(mergedAllAccepted.ok, true);
if (mergedAllAccepted.ok) {
  assert.deepEqual(
    mergedAllAccepted.value.accepted.map((item) => item.candidateId),
    ["c01-b1", "c01-b2", "c01-b3"],
  );
  assert.deepEqual(
    mergedAllAccepted.value.rejected.map((item) => item.candidateId),
    ["c01-b4", "c01-b5"],
  );
  assert.deepEqual(mergedAllAccepted.value.rejected[0].reasons, [
    "通过硬约束审查，但为保持候选聚焦未进入前三方向。",
  ]);
}
assert.equal(
  checkBranchCriticOutput(skeletons, criticPartition, c01, [], []).ok,
  true,
);
const assembled = assembleBranchesResponse(
  generatorOutput,
  criticPartition,
  c01,
  [],
  [],
);
assert.equal(assembled.ok, true);
if (assembled.ok) {
  assert.deepEqual(assembled.value.candidates[0].coveredMustHaveIds, ["c01-m1"]);
  assert.deepEqual(assembled.value.candidates[0].respectedConstraintIds, ["c01-c1"]);
}
const noAcceptedPartition = {
  accepted: [],
  rejected: skeletons.map((item) => ({
    candidateId: item.id,
    reasons: ["未满足硬约束"],
  })),
};
assert.equal(
  checkBranchCriticOutput(skeletons, noAcceptedPartition, c01, [], []).ok,
  true,
);
const noAccepted = assembleBranchesResponse(
  generatorOutput,
  noAcceptedPartition,
  c01,
  [],
  [],
);
assert.equal(noAccepted.ok, false);
if (!noAccepted.ok) assert.equal(noAccepted.issue.code, "NO_VALID_BRANCH");
assert.equal(
  checkBranchCriticOutput(
    skeletons,
    {
      accepted: skeletons.map((item) => ({
        candidateId: item.id,
        coveredPreferenceIds: [],
        evidenceFactIds: [],
        usedAssumptionIds: [],
        warnings: [],
      })),
      rejected: [],
    },
    c01,
    [],
    [],
  ).ok,
  false,
);
assert.equal(
  checkBranchCriticOutput(
    skeletons,
    { ...criticPartition, rejected: criticPartition.rejected.slice(1) },
    c01,
    [],
    [],
  ).ok,
  false,
);
assert.equal(
  checkBranchCriticOutput(
    skeletons,
    {
      ...criticPartition,
      accepted: [
        {
          ...criticPartition.accepted[0],
          candidateId: criticPartition.rejected[0].candidateId,
        },
        ...criticPartition.accepted.slice(1),
      ],
    },
    c01,
    [],
    [],
  ).ok,
  false,
);
assert.equal(
  checkBranchCriticOutput(
    skeletons,
    {
      ...criticPartition,
      accepted: [
        {
          ...criticPartition.accepted[0],
          evidenceFactIds: ["not-a-fact"],
        },
        ...criticPartition.accepted.slice(1),
      ],
    },
    c01,
    [],
    [],
  ).ok,
  false,
);
assert.equal(
  checkBranchCriticOutput(
    skeletons,
    {
      ...criticPartition,
      accepted: [
        {
          ...criticPartition.accepted[0],
          coveredPreferenceIds: ["c01-p1", "c01-p1"],
        },
        ...criticPartition.accepted.slice(1),
      ],
    },
    c01,
    [],
    [],
  ).ok,
  false,
);

assert.equal(intentOf("C07").constraints.length, 11);

const exactUtf8Body = "界".repeat(33_333) + "x";
assert.equal(checkRawRequestBytes(exactUtf8Body, 100_000).ok, true);
assert.equal(checkRawRequestBytes(`${exactUtf8Body}x`, 100_000).ok, false);

const retryBudget = createSchemaRetryBudget(1);
assert.equal(consumeSchemaRetry(retryBudget), true);
assert.equal(consumeSchemaRetry(retryBudget), false);
const concurrentRetryBudget = createSchemaRetryBudget(1);
const concurrentRetryResults = await Promise.all([
  Promise.resolve().then(() => consumeSchemaRetry(concurrentRetryBudget)),
  Promise.resolve().then(() => consumeSchemaRetry(concurrentRetryBudget)),
]);
assert.deepEqual(concurrentRetryResults.sort(), [false, true]);
assert.equal(concurrentRetryBudget.remaining, 0);

const sdkTimeout = normalizeSdkError({
  name: "Error",
  constructor: { name: "APIConnectionTimeoutError" },
  cause: { name: "AbortError", code: 20 },
  message: "must not be surfaced",
});
assert.equal(sdkTimeout.code, "MODEL_TIMEOUT");
assert.equal(sdkTimeout.retryable, true);
const causeTimeout = normalizeSdkError({
  name: "Error",
  cause: { name: "TimeoutError" },
});
assert.equal(causeTimeout.code, "MODEL_TIMEOUT");
assert.equal(causeTimeout.retryable, true);

const panels = [
  "original_tension",
  "divergence_trigger",
  "different_choice",
  "action_and_cost",
  "changed_result",
  "emotional_aftertaste",
].map((role, index) => ({
  panelNo: index + 1,
  role,
  visual: `画面 ${index + 1}`,
  action: `动作 ${index + 1}`,
  dialogueOrNarration: `旁白 ${index + 1}`,
}));
assert.equal(checkSixPanelOrder(panels).ok, true);
assert.equal(
  checkSixPanelOrder([{ ...panels[0], role: "changed_result" }, ...panels.slice(1)]).ok,
  false,
);

const storyboard = {
  title: "在闭馆前说出原因",
  panels,
  compliance: {
    fulfilledMustHaveIds: ["c01-m1"],
    fulfilledPreferenceIds: ["c01-p1"],
    respectedConstraintIds: ["c01-c1"],
    referencedFactIds: [],
    assumptions: [],
    warnings: [],
  },
};
assert.equal(checkStoryboardResponse(c01, storyboard).ok, true);
const conflictWriterOutput = {
  kind: "conflict",
  explanation: "最终调整要求改写锁定事实。",
  relatedFactIds: [],
  relatedMustHaveIds: ["c01-m1"],
  relatedConstraintIds: ["c01-c1"],
  relatedBranchId: "c01-b1",
};
assert.equal(checkStoryboardWriterOutput(conflictWriterOutput).ok, true);
assert.equal("panels" in conflictWriterOutput, false);
const storyboardRequest = {
  intent: c01,
  canonFacts: [],
  assumptions: [],
  selectedBranch: candidate,
  finalAdjustment: "请改写锁定约束",
};
assert.equal(checkStoryboardRequest(storyboardRequest).ok, true);
const ownSelectedBranch = {
  ...candidate,
  newAssumptions: [
    {
      id: "c01-b1-a1",
      text: "该选中候选自己的局部假设",
      source: "ai_suggested",
    },
  ],
  usedAssumptionIds: ["c01-b1-a1"],
};
assert.equal(
  checkStoryboardRequest({
    ...storyboardRequest,
    selectedBranch: ownSelectedBranch,
  }).ok,
  true,
);
assert.equal(
  checkStoryboardRequest({
    ...storyboardRequest,
    selectedBranch: {
      ...ownSelectedBranch,
      usedAssumptionIds: ["c01-b2-a1"],
    },
  }).ok,
  false,
);
assert.equal(
  checkStoryboardRequest({
    ...storyboardRequest,
    selectedBranch: {
      ...candidate,
      coveredMustHaveIds: ["tampered-must-have"],
    },
  }).ok,
  false,
);
const unknownStoryboardReference = {
  ...storyboard,
  compliance: {
    ...storyboard.compliance,
    fulfilledPreferenceIds: ["not-an-input-id"],
  },
};
assert.equal(checkStoryboardResponse(c01, unknownStoryboardReference).ok, false);
assert.equal(
  checkStoryboardWriterOutput({
    kind: "conflict",
    explanation: "最终调整要求改写锁定事实。",
    relatedFactIds: ["c01-f1"],
    relatedMustHaveIds: ["c01-m1"],
    relatedConstraintIds: ["c01-c1"],
  }).ok,
  true,
);

const sessionSnapshot = {
  stage: "context_review",
  workTitle: "自创演示",
  draft: {
    plotContext: "",
    regret: "",
    mustHaves: [{ id: "draft-m1", text: "" }],
    preferences: [],
    constraints: [],
    desiredTone: "",
  },
  intent: c01,
  analysis: {
    factDrafts: [
      {
        id: "saved-f1",
        category: "timeline",
        statement: "剧院即将闭馆。",
        timing: "最后一场演出前",
        origin: "direct_user_input",
        suggestedDisposition: "canon",
      },
    ],
    questions: [],
    conflicts: [
      {
        id: "saved-conflict",
        mustHaveIds: ["c01-m1"],
        constraintIds: ["c01-c1"],
        factDraftIds: ["saved-f1"],
        explanation: "这条事实与当前约束需要重新确认。",
      },
    ],
    canContinueWithAssumptions: false,
  },
  clarificationAnswers: [],
  questionSuggestions: { "saved-q1": "编辑后的建议假设" },
  factDrafts: [],
  confirmedFacts: [],
  assumptions: [],
  candidates: [],
  rejected: [],
  selectedBranch: null,
  finalAdjustment: "",
  storyboard: null,
  lastError: {
    code: "MODEL_OUTPUT_INVALID",
    message: "模型结果需要重试。",
    retryable: true,
    requestId: "req_saved",
  },
  retryKind: "reanalyze",
};
const serialized = serializeSession(sessionSnapshot);
assert.equal(typeof serialized, "string");
assert.deepEqual(restoreSession(serialized), sessionSnapshot);
assert.equal(restoreSession('{"version":"wrong"}'), null);
assert.equal(restoreSession("not-json"), null);
const legacySnapshot = { ...sessionSnapshot };
delete legacySnapshot.draft;
delete legacySnapshot.analysis;
delete legacySnapshot.questionSuggestions;
delete legacySnapshot.retryKind;
assert.equal(
  restoreSession(JSON.stringify({ version: "yinanping-if:v1", snapshot: legacySnapshot })),
  null,
);
assert.equal(
  ConfirmedCanonFactSchema.safeParse({
    id: "saved-f1",
    category: "timeline",
    statement: "剧院即将闭馆。",
    timing: "最后一场演出前",
    origin: "direct_user_input",
    locked: true,
  }).success,
  true,
);
assert.equal(
  ConfirmedCanonFactSchema.safeParse({
    id: "saved-f1",
    category: "timeline",
    statement: "剧院即将闭馆。",
    timing: "最后一场演出前",
    origin: "direct_user_input",
    locked: true,
    suggestedDisposition: "canon",
  }).success,
  false,
);
const uiSources = [
  "../src/components/StoryApp.tsx",
  "../src/components/InputStep.tsx",
  "../src/components/ContextReviewStep.tsx",
  "../src/components/BranchChoiceStep.tsx",
  "../src/components/StoryboardStep.tsx",
].map((relativePath) => fs.readFileSync(path.join(here, relativePath), "utf8"));
assert.match(uiSources[0], /useReducer/);
assert.match(uiSources[0], /\/api\/analyze/);
assert.match(uiSources[0], /\/api\/branches/);
assert.match(uiSources[0], /\/api\/storyboard/);
assert.match(uiSources[0], /retryKind/);
assert.match(uiSources[1], /SessionDraft/);
assert.match(uiSources[2], /locked: true/);
assert.match(uiSources[3], /candidate\.newAssumptions/);
assert.match(uiSources[4], /StoryIntent/);

console.log(`Deterministic eval PASS: ${cases.length} cases and core rule checks.`);
