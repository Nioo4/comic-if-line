import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  BranchCriticOutputSchema,
  BranchGeneratorOutputSchema,
  BranchesRequestSchema,
  BranchesResponseSchema,
  ERROR_CODES,
  StoryboardCriticOutputSchema,
  StoryboardRequestSchema,
  StoryboardResponseSchema,
  StoryboardWriterOutputSchema,
  StoryIntentSchema,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type BranchCriticOutput,
  type BranchGeneratorOutput,
  type BranchesRequest,
  type BranchesResponse,
  type BranchCandidate,
  type BranchSkeleton,
  type ErrorCode,
  type Panel,
  type RejectedCandidate,
  type Storyboard,
  type StoryboardCriticOutput,
  type StoryboardRequest,
  type StoryboardResponse,
  type StoryboardWriterOutput,
  type StoryIntent,
} from "./contracts.ts";

export const MAX_REQUEST_BYTES = 100_000;

export function getMaxRequestBytes(): number {
  const configured = Number(process.env.MAX_REQUEST_BYTES);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : MAX_REQUEST_BYTES;
}

export const PANEL_ROLE_ORDER = [
  "original_tension",
  "divergence_trigger",
  "different_choice",
  "action_and_cost",
  "changed_result",
  "emotional_aftertaste",
] as const;

export type RuleIssue = {
  code: ErrorCode;
  message: string;
  details?: string[];
};

export type RuleCheck<T> =
  | { ok: true; value: T }
  | { ok: false; issue: RuleIssue };

const pass = <T>(value: T): RuleCheck<T> => ({ ok: true, value });

const fail = (
  code: ErrorCode,
  message: string,
  details?: string[],
): RuleCheck<never> => ({
  ok: false,
  issue: { code, message, ...(details ? { details } : {}) },
});

const invalid = (message: string, details?: string[]) =>
  fail(ERROR_CODES.INVALID_INPUT, message, details);

const modelOutputInvalid = (message: string, details?: string[]) =>
  fail(ERROR_CODES.MODEL_OUTPUT_INVALID, message, details);

const unique = (values: readonly string[]) =>
  new Set(values).size === values.length;

const missingIds = (required: readonly string[], actual: readonly string[]) => {
  const actualIds = new Set(actual);
  return required.filter((id) => !actualIds.has(id));
};

const unknownIds = (allowed: readonly string[], actual: readonly string[]) => {
  const allowedIds = new Set(allowed);
  return actual.filter((id) => !allowedIds.has(id));
};

const duplicateIds = (values: readonly string[]) =>
  values.filter((value, index) => values.indexOf(value) !== index);

const checkReferenceArray = (
  name: string,
  actual: readonly string[],
  allowed: readonly string[],
): RuleCheck<true> => {
  const duplicates = duplicateIds(actual);
  if (duplicates.length > 0) {
    return modelOutputInvalid(`${name} 不能包含重复 id。`, duplicates);
  }
  const unknown = unknownIds(allowed, actual);
  if (unknown.length > 0) {
    return modelOutputInvalid(`${name} 引用了不存在的 id。`, unknown);
  }
  return pass(true);
};

const checkUniqueOutputIds = (
  name: string,
  ids: readonly string[],
): RuleCheck<true> => {
  if (!unique(ids)) {
    return modelOutputInvalid(`${name} 的 id 必须全局唯一。`, duplicateIds(ids));
  }
  return pass(true);
};

const idsOf = (values: readonly { id: string }[]) =>
  values.map((value) => value.id);

const checkNewAssumptions = (
  newAssumptions: BranchCandidate["newAssumptions"],
  canonFactIds: readonly string[],
  assumptionIds: readonly string[],
): RuleCheck<true> => {
  const newAssumptionIds = idsOf(newAssumptions);
  const uniqueNewAssumptions = checkUniqueOutputIds(
    "newAssumptions",
    newAssumptionIds,
  );
  if (!uniqueNewAssumptions.ok) return uniqueNewAssumptions;
  const invalidSources = newAssumptions.filter(
    (assumption) => assumption.source !== "ai_suggested",
  );
  if (invalidSources.length > 0) {
    return modelOutputInvalid(
      "分支 newAssumptions 必须标记为 ai_suggested。",
      idsOf(invalidSources),
    );
  }
  const collisions = newAssumptionIds.filter(
    (id) => canonFactIds.includes(id) || assumptionIds.includes(id),
  );
  if (collisions.length > 0) {
    return modelOutputInvalid(
      "newAssumptions 不能悄悄覆盖已有事实或假设。",
      collisions,
    );
  }
  return pass(true);
};

const checkCandidateReferences = (
  intent: StoryIntent,
  candidate: BranchCandidate,
  canonFactIds: readonly string[],
  assumptionIds: readonly string[],
  requireCoverage: boolean,
): RuleCheck<true> => {
  const newAssumptions = checkNewAssumptions(
    candidate.newAssumptions,
    canonFactIds,
    assumptionIds,
  );
  if (!newAssumptions.ok) return newAssumptions;

  const allowedAssumptionIds = [
    ...assumptionIds,
    ...idsOf(candidate.newAssumptions),
  ];
  const referenceGroups = [
    ["coveredMustHaveIds", candidate.coveredMustHaveIds, intent.mustHaves.map((item) => item.id)],
    ["coveredPreferenceIds", candidate.coveredPreferenceIds, intent.preferences.map((item) => item.id)],
    ["respectedConstraintIds", candidate.respectedConstraintIds, intent.constraints.map((item) => item.id)],
    ["evidenceFactIds", candidate.evidenceFactIds, canonFactIds],
    ["usedAssumptionIds", candidate.usedAssumptionIds, allowedAssumptionIds],
  ] as const;
  for (const [name, actual, allowed] of referenceGroups) {
    const references = checkReferenceArray(name, actual, allowed);
    if (!references.ok) return references;
  }

  if (requireCoverage) {
    const missingMustHaves = missingIds(
      intent.mustHaves.map((item) => item.id),
      candidate.coveredMustHaveIds,
    );
    if (missingMustHaves.length > 0) {
      return modelOutputInvalid(
        "合格候选没有覆盖全部必达结果。",
        missingMustHaves,
      );
    }
    const missingConstraints = missingIds(
      intent.constraints.map((item) => item.id),
      candidate.respectedConstraintIds,
    );
    if (missingConstraints.length > 0) {
      return modelOutputInvalid(
        "合格候选没有覆盖全部不可破坏约束。",
        missingConstraints,
      );
    }
  }
  return pass(true);
};

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function getJsonByteLength(value: unknown): number {
  const serialized = JSON.stringify(value);
  return getUtf8ByteLength(serialized ?? "");
}

export function checkRawRequestBytes(
  rawBody: string,
  maxBytes = getMaxRequestBytes(),
): RuleCheck<number> {
  const byteLength = getUtf8ByteLength(rawBody);
  if (byteLength > maxBytes) {
    return fail(
      ERROR_CODES.REQUEST_TOO_LARGE,
      `本次输入超过 ${maxBytes} bytes，请整理后重试。`,
      [`actual=${byteLength}`, `max=${maxBytes}`],
    );
  }
  return pass(byteLength);
}

export function checkRequestBytes(
  payload: unknown,
  maxBytes = MAX_REQUEST_BYTES,
): RuleCheck<number> {
  const byteLength = getJsonByteLength(payload);
  if (byteLength > maxBytes) {
    return fail(
      ERROR_CODES.REQUEST_TOO_LARGE,
      `本次输入超过 ${maxBytes} bytes，请整理后重试。`,
      [`actual=${byteLength}`, `max=${maxBytes}`],
    );
  }
  return pass(byteLength);
}

export function validateStoryIntent(input: unknown): RuleCheck<StoryIntent> {
  const parsed = StoryIntentSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(
      "故事输入不完整或格式无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const itemGroups = [
    ["mustHaves", parsed.data.mustHaves],
    ["preferences", parsed.data.preferences],
    ["constraints", parsed.data.constraints],
  ] as const;
  for (const [name, items] of itemGroups) {
    if (!unique(items.map((item) => item.id))) {
      return invalid(`${name} 中的 id 必须唯一。`);
    }
  }

  return pass(parsed.data);
}

export function checkAnalyzeRequest(
  payload: unknown,
  maxBytes = MAX_REQUEST_BYTES,
): RuleCheck<AnalyzeRequest> {
  const sizeCheck = checkRequestBytes(payload, maxBytes);
  if (!sizeCheck.ok) return sizeCheck;

  const parsed = AnalyzeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid(
      "分析请求格式无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const intentCheck = validateStoryIntent(parsed.data.intent);
  if (!intentCheck.ok) return intentCheck;
  return pass(parsed.data);
}

export function checkUniqueCandidateIds(
  response: BranchesResponse,
): RuleCheck<true> {
  const ids = [
    ...response.candidates.map((candidate) => candidate.id),
    ...response.rejected.map((candidate) => candidate.candidateId),
  ];
  if (ids.length !== 5 || !unique(ids)) {
    return modelOutputInvalid(
      "五个内部骨架的候选 id 必须全局唯一且合计恰好为 5 个。",
    );
  }
  return pass(true);
}

export function checkCausalStepOrder(
  steps: BranchesResponse["candidates"][number]["causalSteps"],
): RuleCheck<true> {
  if (steps.length < 3 || steps.length > 5) {
    return modelOutputInvalid("每个候选必须有 3—5 个因果步骤。");
  }
  const expected = steps.map((_, index) => index + 1);
  const actual = steps.map((step) => step.order);
  if (actual.some((order, index) => order !== expected[index])) {
    return modelOutputInvalid("因果步骤必须从 1 开始连续编号。");
  }
  return pass(true);
}

export function checkBranchCoverage(
  intent: StoryIntent,
  response: BranchesResponse,
  canonFactIds?: readonly string[],
  assumptionIds?: readonly string[],
): RuleCheck<true> {
  for (const candidate of response.candidates) {
    const newAssumptions = checkNewAssumptions(
      candidate.newAssumptions,
      canonFactIds ?? [],
      assumptionIds ?? [],
    );
    if (!newAssumptions.ok) return newAssumptions;

    const referenceGroups = [
      ["coveredMustHaveIds", candidate.coveredMustHaveIds, intent.mustHaves.map((item) => item.id)],
      ["coveredPreferenceIds", candidate.coveredPreferenceIds, intent.preferences.map((item) => item.id)],
      ["respectedConstraintIds", candidate.respectedConstraintIds, intent.constraints.map((item) => item.id)],
    ] as const;
    for (const [name, actual, allowed] of referenceGroups) {
      const references = checkReferenceArray(name, actual, allowed);
      if (!references.ok) return references;
    }
    const missingMustHaves = missingIds(
      intent.mustHaves.map((item) => item.id),
      candidate.coveredMustHaveIds,
    );
    if (missingMustHaves.length > 0) {
      return modelOutputInvalid(
        "合格候选没有覆盖全部必达结果。",
        missingMustHaves,
      );
    }
    const missingConstraints = missingIds(
      intent.constraints.map((item) => item.id),
      candidate.respectedConstraintIds,
    );
    if (missingConstraints.length > 0) {
      return modelOutputInvalid(
        "合格候选没有覆盖全部不可破坏约束。",
        missingConstraints,
      );
    }
    if (canonFactIds !== undefined) {
      const references = checkReferenceArray(
        "evidenceFactIds",
        candidate.evidenceFactIds,
        canonFactIds,
      );
      if (!references.ok) return references;
    }
    if (assumptionIds !== undefined) {
      const references = checkReferenceArray(
        "usedAssumptionIds",
        candidate.usedAssumptionIds,
        [...assumptionIds, ...idsOf(candidate.newAssumptions)],
      );
      if (!references.ok) return references;
    }

  }
  return pass(true);
}

export function checkBranchesResponse(
  intent: StoryIntent,
  output: unknown,
  canonFactIds?: readonly string[],
  assumptionIds?: readonly string[],
): RuleCheck<BranchesResponse> {
  const parsed = BranchesResponseSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "分支结构化输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const uniqueIds = checkUniqueCandidateIds(parsed.data);
  if (!uniqueIds.ok) return uniqueIds;

  for (const candidate of parsed.data.candidates) {
    const stepCheck = checkCausalStepOrder(candidate.causalSteps);
    if (!stepCheck.ok) return stepCheck;
  }

  const coverage = checkBranchCoverage(
    intent,
    parsed.data,
    canonFactIds,
    assumptionIds,
  );
  if (!coverage.ok) return coverage;
  return pass(parsed.data);
}

export function checkSixPanelOrder(panels: readonly Panel[]): RuleCheck<true> {
  if (panels.length !== PANEL_ROLE_ORDER.length) {
    return modelOutputInvalid("成稿必须恰好包含六格。");
  }

  const wrongPanel = panels.find(
    (panel, index) =>
      panel.panelNo !== index + 1 || panel.role !== PANEL_ROLE_ORDER[index],
  );
  if (wrongPanel) {
    return modelOutputInvalid("六格 panelNo 与角色顺序不符合固定契约。");
  }
  return pass(true);
}

export function checkStoryboardResponse(
  intent: StoryIntent,
  output: unknown,
): RuleCheck<StoryboardResponse> {
  const parsed = StoryboardResponseSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "成稿结构化输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const panelOrder = checkSixPanelOrder(parsed.data.panels);
  if (!panelOrder.ok) return panelOrder;

  const mustHaveIds = intent.mustHaves.map((item) => item.id);
  const preferenceIds = intent.preferences.map((item) => item.id);
  const constraintIds = intent.constraints.map((item) => item.id);
  const complianceReferences = [
    ["fulfilledMustHaveIds", parsed.data.compliance.fulfilledMustHaveIds],
    ["fulfilledPreferenceIds", parsed.data.compliance.fulfilledPreferenceIds],
    ["respectedConstraintIds", parsed.data.compliance.respectedConstraintIds],
  ] as const;
  for (const [name, ids] of complianceReferences) {
    const duplicates = duplicateIds(ids);
    if (duplicates.length > 0) {
      return modelOutputInvalid(`${name} 不能包含重复 id。`, duplicates);
    }
  }

  const unknownMustHaves = unknownIds(
    mustHaveIds,
    parsed.data.compliance.fulfilledMustHaveIds,
  );
  const unknownPreferences = unknownIds(
    preferenceIds,
    parsed.data.compliance.fulfilledPreferenceIds,
  );
  const unknownConstraints = unknownIds(
    constraintIds,
    parsed.data.compliance.respectedConstraintIds,
  );
  if (
    unknownMustHaves.length > 0 ||
    unknownPreferences.length > 0 ||
    unknownConstraints.length > 0
  ) {
    return modelOutputInvalid("成稿合规信息引用了不存在的输入 id。", [
      ...unknownMustHaves,
      ...unknownPreferences,
      ...unknownConstraints,
    ]);
  }

  const missingMustHaves = missingIds(
    mustHaveIds,
    parsed.data.compliance.fulfilledMustHaveIds,
  );
  const missingConstraints = missingIds(
    constraintIds,
    parsed.data.compliance.respectedConstraintIds,
  );
  if (missingMustHaves.length > 0 || missingConstraints.length > 0) {
    return modelOutputInvalid("成稿没有覆盖全部必达结果或不可破坏约束。", [
      ...missingMustHaves,
      ...missingConstraints,
    ]);
  }
  return pass(parsed.data);
}

export function checkStoryboardWriterOutput(
  output: unknown,
): RuleCheck<StoryboardWriterOutput> {
  const parsed = StoryboardWriterOutputSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "成稿 writer 输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  return pass(parsed.data);
}

export function checkAnalyzeResponse(
  intent: StoryIntent,
  output: unknown,
): RuleCheck<AnalyzeResponse> {
  const parsed = AnalyzeResponseSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "分析结构化输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }

  const factIds = idsOf(parsed.data.factDrafts);
  const questionIds = idsOf(parsed.data.questions);
  const conflictIds = idsOf(parsed.data.conflicts);
  const outputIds = [...factIds, ...questionIds, ...conflictIds];
  const uniqueOutputIds = checkUniqueOutputIds("分析输出", outputIds);
  if (!uniqueOutputIds.ok) return uniqueOutputIds;

  for (const fact of parsed.data.factDrafts) {
    if (
      fact.origin === "model_inference" &&
      fact.suggestedDisposition !== "assumption"
    ) {
      return modelOutputInvalid(
        "模型推断事实只能建议为创作假设。",
        [fact.id],
      );
    }
  }

  const mustHaveIds = intent.mustHaves.map((item) => item.id);
  const constraintIds = intent.constraints.map((item) => item.id);
  for (const conflict of parsed.data.conflicts) {
    if (
      conflict.mustHaveIds.length === 0 ||
      (conflict.constraintIds.length === 0 && conflict.factDraftIds.length === 0)
    ) {
      return modelOutputInvalid(
        "分析 conflict 必须关联至少一个 must-have，且关联 constraint 或 fact。",
        [conflict.id],
      );
    }
    const conflictMustHaves = checkReferenceArray(
      "conflict.mustHaveIds",
      conflict.mustHaveIds,
      mustHaveIds,
    );
    if (!conflictMustHaves.ok) return conflictMustHaves;
    const conflictConstraints = checkReferenceArray(
      "conflict.constraintIds",
      conflict.constraintIds,
      constraintIds,
    );
    if (!conflictConstraints.ok) return conflictConstraints;
    const conflictFacts = checkReferenceArray(
      "conflict.factDraftIds",
      conflict.factDraftIds,
      factIds,
    );
    if (!conflictFacts.ok) return conflictFacts;
  }

  if (
    parsed.data.conflicts.length > 0 &&
    parsed.data.canContinueWithAssumptions
  ) {
    return modelOutputInvalid(
      "存在硬冲突时不能继续使用假设。",
    );
  }
  if (
    parsed.data.conflicts.length === 0 &&
    !parsed.data.canContinueWithAssumptions
  ) {
    return modelOutputInvalid(
      "没有硬冲突时必须允许继续使用假设。",
    );
  }
  return pass(parsed.data);
}

export function checkBranchesRequest(
  input: unknown,
): RuleCheck<BranchesRequest> {
  const parsed = BranchesRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(
      "分支请求格式无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  const intentCheck = validateStoryIntent(parsed.data.intent);
  if (!intentCheck.ok) return intentCheck;

  const canonIds = idsOf(parsed.data.canonFacts);
  if (!unique(canonIds)) {
    return invalid("canonFacts 的 id 必须唯一。");
  }
  const assumptionIds = idsOf(parsed.data.assumptions);
  if (!unique(assumptionIds)) {
    return invalid("assumptions 的 id 必须唯一。");
  }
  if (new Set([...canonIds, ...assumptionIds]).size !== canonIds.length + assumptionIds.length) {
    return invalid("canonFacts 与 assumptions 的 id 不能冲突。");
  }

  const mustHaveIds = parsed.data.intent.mustHaves.map((item) => item.id);
  const constraintIds = parsed.data.intent.constraints.map((item) => item.id);
  for (const conflict of parsed.data.unresolvedConflicts) {
    const checks = [
      ["unresolvedConflict.mustHaveIds", conflict.mustHaveIds, mustHaveIds],
      ["unresolvedConflict.constraintIds", conflict.constraintIds, constraintIds],
    ] as const;
    for (const [name, actual, allowed] of checks) {
      if (!unique(actual) || unknownIds(allowed, actual).length > 0) {
        return invalid(`${name} 引用了无效或重复 id。`);
      }
    }
    if (!unique(conflict.factDraftIds)) {
      return invalid("unresolvedConflict.factDraftIds 不能重复。");
    }
  }
  return pass(parsed.data);
}

export function checkStoryboardRequest(
  input: unknown,
): RuleCheck<StoryboardRequest> {
  const parsed = StoryboardRequestSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(
      "成稿请求格式无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  const intentCheck = validateStoryIntent(parsed.data.intent);
  if (!intentCheck.ok) return intentCheck;

  const canonIds = idsOf(parsed.data.canonFacts);
  const assumptionIds = idsOf(parsed.data.assumptions);
  if (!unique(canonIds) || !unique(assumptionIds)) {
    return invalid("canonFacts 与 assumptions 的 id 必须唯一。");
  }
  if (new Set([...canonIds, ...assumptionIds]).size !== canonIds.length + assumptionIds.length) {
    return invalid("canonFacts 与 assumptions 的 id 不能冲突。");
  }

  const branchCheck = checkCandidateReferences(
    parsed.data.intent,
    parsed.data.selectedBranch,
    canonIds,
    assumptionIds,
    true,
  );
  if (!branchCheck.ok) {
    return invalid("selectedBranch 引用了无效事实、假设或约束。");
  }
  return pass(parsed.data);
}

export function checkBranchGeneratorOutput(
  request: BranchesRequest,
  output: unknown,
): RuleCheck<BranchGeneratorOutput> {
  const parsed = BranchGeneratorOutputSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "分支生成器结构化输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  const ids = idsOf(parsed.data.skeletons);
  const uniqueSkeletonIds = checkUniqueOutputIds("分支骨架", ids);
  if (!uniqueSkeletonIds.ok) return uniqueSkeletonIds;

  const canonIds = idsOf(request.canonFacts);
  const assumptionIds = idsOf(request.assumptions);
  for (const skeleton of parsed.data.skeletons) {
    const steps = checkCausalStepOrder(skeleton.causalSteps);
    if (!steps.ok) return steps;
    const assumptions = checkNewAssumptions(
      skeleton.newAssumptions,
      canonIds,
      assumptionIds,
    );
    if (!assumptions.ok) return assumptions;
  }
  return pass(parsed.data);
}

export function checkBranchCriticOutput(
  skeletons: readonly BranchSkeleton[],
  output: unknown,
  intent: StoryIntent,
  canonFactIds: readonly string[] = [],
  assumptionIds: readonly string[] = [],
): RuleCheck<BranchCriticOutput> {
  const parsed = BranchCriticOutputSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "分支 critic 结构化输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  const skeletonIds = idsOf(skeletons);
  const uniqueSkeletonIds = checkUniqueOutputIds("分支骨架", skeletonIds);
  if (!uniqueSkeletonIds.ok) return uniqueSkeletonIds;
  for (const skeleton of skeletons) {
    const assumptions = checkNewAssumptions(
      skeleton.newAssumptions,
      canonFactIds,
      assumptionIds,
    );
    if (!assumptions.ok) return assumptions;
  }
  const acceptedIds = parsed.data.accepted.map((review) => review.candidateId);
  const rejectedIds = parsed.data.rejected.map((review) => review.candidateId);
  const reviewIds = [...acceptedIds, ...rejectedIds];
  const uniqueReviewIds = checkUniqueOutputIds("critic partition", reviewIds);
  if (!uniqueReviewIds.ok) return uniqueReviewIds;
  if (
    reviewIds.length !== skeletonIds.length ||
    reviewIds.some((id) => !skeletonIds.includes(id)) ||
    skeletonIds.some((id) => !reviewIds.includes(id))
  ) {
    return modelOutputInvalid(
      "critic partition 必须恰好覆盖五个分支骨架。",
    );
  }
  for (const review of parsed.data.accepted) {
    const skeleton = skeletons.find((item) => item.id === review.candidateId);
    if (!skeleton) {
      return modelOutputInvalid("critic accepted 引用了不存在的分支骨架。", [
        review.candidateId,
      ]);
    }
    const references = [
      [
        "accepted.coveredPreferenceIds",
        review.coveredPreferenceIds,
        intent.preferences.map((item) => item.id),
      ],
      ["accepted.evidenceFactIds", review.evidenceFactIds, canonFactIds],
      [
        "accepted.usedAssumptionIds",
        review.usedAssumptionIds,
        [...assumptionIds, ...idsOf(skeleton.newAssumptions)],
      ],
    ] as const;
    for (const [name, actual, allowed] of references) {
      const referenceCheck = checkReferenceArray(name, actual, allowed);
      if (!referenceCheck.ok) return referenceCheck;
    }
  }
  return pass(parsed.data);
}

const BRANCH_FOCUS_REJECTION =
  "通过硬约束审查，但为保持候选聚焦未进入前三方向。";

export function mergeBranchCriticPartitions(
  skeletons: readonly BranchSkeleton[],
  partitions: readonly BranchCriticOutput[],
): RuleCheck<BranchCriticOutput> {
  if (partitions.length !== 2) {
    return modelOutputInvalid("分支 critic 必须返回两个批次 partition。");
  }

  const skeletonIds = idsOf(skeletons);
  const partitionIds = partitions.flatMap((partition) => [
    ...partition.accepted.map((review) => review.candidateId),
    ...partition.rejected.map((review) => review.candidateId),
  ]);
  const uniquePartitionIds = checkUniqueOutputIds(
    "critic partition",
    partitionIds,
  );
  if (!uniquePartitionIds.ok) return uniquePartitionIds;
  if (
    partitionIds.length !== skeletonIds.length ||
    partitionIds.some((id) => !skeletonIds.includes(id)) ||
    skeletonIds.some((id) => !partitionIds.includes(id))
  ) {
    return modelOutputInvalid("合并后的 critic partition 必须覆盖全部五个骨架。");
  }

  const acceptedById = new Map(
    partitions.flatMap((partition) => partition.accepted)
      .map((review) => [review.candidateId, review]),
  );
  const rejectedById = new Map(
    partitions.flatMap((partition) => partition.rejected)
      .map((review) => [review.candidateId, review]),
  );
  const accepted: BranchCriticOutput["accepted"] = [];
  const rejected: BranchCriticOutput["rejected"] = [];
  for (const skeleton of skeletons) {
    const acceptedReview = acceptedById.get(skeleton.id);
    const rejectedReview = rejectedById.get(skeleton.id);
    if ((acceptedReview ? 1 : 0) + (rejectedReview ? 1 : 0) !== 1) {
      return modelOutputInvalid("critic partition 缺少或重复覆盖骨架。");
    }
    if (acceptedReview && accepted.length < 3) {
      accepted.push(acceptedReview);
    } else if (acceptedReview) {
      rejected.push({
        candidateId: acceptedReview.candidateId,
        reasons: [BRANCH_FOCUS_REJECTION],
      });
    } else if (rejectedReview) {
      rejected.push(rejectedReview);
    }
  }

  return pass({ accepted, rejected });
}

export function assembleBranchesResponse(
  generator: BranchGeneratorOutput,
  critic: BranchCriticOutput,
  intent: StoryIntent,
  canonFactIds?: readonly string[],
  assumptionIds?: readonly string[],
): RuleCheck<BranchesResponse> {
  const accepted = new Map(
    critic.accepted.map((review) => [review.candidateId, review]),
  );
  const rejectedReviews = new Map(
    critic.rejected.map((review) => [review.candidateId, review]),
  );
  const candidates: BranchCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  for (const skeleton of generator.skeletons) {
    const acceptedReview = accepted.get(skeleton.id);
    const rejectedReview = rejectedReviews.get(skeleton.id);
    if (acceptedReview) {
      candidates.push({
        ...skeleton,
        coveredMustHaveIds: intent.mustHaves.map((item) => item.id),
        coveredPreferenceIds: acceptedReview.coveredPreferenceIds,
        respectedConstraintIds: intent.constraints.map((item) => item.id),
        evidenceFactIds: acceptedReview.evidenceFactIds,
        usedAssumptionIds: acceptedReview.usedAssumptionIds,
        warnings: [...new Set(acceptedReview.warnings)],
      });
    } else if (rejectedReview) {
      rejected.push({
        candidateId: skeleton.id,
        title: skeleton.title,
        reasons: rejectedReview.reasons,
      });
    } else {
      return modelOutputInvalid("critic partition 缺少对应骨架。");
    }
  }
  if (candidates.length === 0) {
    return fail(
      ERROR_CODES.NO_VALID_BRANCH,
      "没有通过约束审查的分支。",
    );
  }
  if (candidates.length > 3) {
    return modelOutputInvalid("critic accept 数超过三个。");
  }
  const response = {
    generatedCount: 5 as const,
    candidates,
    rejected,
  };
  const coverage = checkBranchesResponse(
    intent,
    response,
    canonFactIds,
    assumptionIds,
  );
  if (!coverage.ok) return coverage;
  return pass(coverage.value);
}

export function checkStoryboardContent(
  request: StoryboardRequest,
  output: unknown,
): RuleCheck<Storyboard> {
  const checked = checkStoryboardResponse(request.intent, output);
  if (!checked.ok) return checked;

  const canonIds = idsOf(request.canonFacts);
  const referencedFacts = checkReferenceArray(
    "referencedFactIds",
    checked.value.compliance.referencedFactIds,
    canonIds,
  );
  if (!referencedFacts.ok) return referencedFacts;
  const complianceAssumptionIds = idsOf(checked.value.compliance.assumptions);
  const uniqueAssumptions = checkUniqueOutputIds(
    "成稿 assumptions",
    complianceAssumptionIds,
  );
  if (!uniqueAssumptions.ok) return uniqueAssumptions;
  const assumptionCollisions = complianceAssumptionIds.filter((id) =>
    canonIds.includes(id),
  );
  if (assumptionCollisions.length > 0) {
    return modelOutputInvalid(
      "成稿 assumptions 不能覆盖锁定事实。",
      assumptionCollisions,
    );
  }
  const existingAssumptions = new Map(
    request.assumptions.map((assumption) => [assumption.id, assumption]),
  );
  const invalidNewAssumptions = checked.value.compliance.assumptions.filter(
    (assumption) =>
      !existingAssumptions.has(assumption.id) &&
      assumption.source !== "ai_suggested",
  );
  if (invalidNewAssumptions.length > 0) {
    return modelOutputInvalid(
      "成稿新增 assumptions 必须标记为 ai_suggested。",
      idsOf(invalidNewAssumptions),
    );
  }
  return pass(checked.value);
}

export function checkWriterConflictReferences(
  request: StoryboardRequest,
  conflict: Extract<StoryboardWriterOutput, { kind: "conflict" }>,
): RuleCheck<true> {
  const factRefs = checkReferenceArray(
    "relatedFactIds",
    conflict.relatedFactIds,
    idsOf(request.canonFacts),
  );
  if (!factRefs.ok) return factRefs;
  const mustHaveRefs = checkReferenceArray(
    "relatedMustHaveIds",
    conflict.relatedMustHaveIds,
    request.intent.mustHaves.map((item) => item.id),
  );
  if (!mustHaveRefs.ok) return mustHaveRefs;
  const constraintRefs = checkReferenceArray(
    "relatedConstraintIds",
    conflict.relatedConstraintIds,
    request.intent.constraints.map((item) => item.id),
  );
  if (!constraintRefs.ok) return constraintRefs;
  if (
    conflict.relatedBranchId !== undefined &&
    conflict.relatedBranchId !== request.selectedBranch.id
  ) {
    return modelOutputInvalid("冲突分支引用了错误的 selectedBranch。");
  }
  if (
    conflict.relatedFactIds.length === 0 &&
    conflict.relatedMustHaveIds.length === 0 &&
    conflict.relatedConstraintIds.length === 0 &&
    conflict.relatedBranchId === undefined
  ) {
    return modelOutputInvalid("冲突分支必须至少关联一个相关 ID。");
  }
  return pass(true);
}

export function checkStoryboardCriticOutput(
  output: unknown,
): RuleCheck<StoryboardCriticOutput> {
  const parsed = StoryboardCriticOutputSchema.safeParse(output);
  if (!parsed.success) {
    return modelOutputInvalid(
      "成稿 critic 结构化输出无效。",
      parsed.error.issues.map((issue) => issue.path.join(".")),
    );
  }
  if (parsed.data.verdict === "hard_fail" && parsed.data.issues.length === 0) {
    return modelOutputInvalid("hard_fail critic 必须包含至少一个 issue。");
  }
  return pass(parsed.data);
}
