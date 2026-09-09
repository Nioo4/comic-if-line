import { z } from "zod";

const nonBlank = (label: string) =>
  z.string().refine((value) => value.trim().length > 0, `${label} 不能为空`);

const identifier = z
  .string()
  .refine((value) => value.trim().length > 0, "id 不能为空");

export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  CONSTRAINT_CONFLICT: "CONSTRAINT_CONFLICT",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  NO_VALID_BRANCH: "NO_VALID_BRANCH",
  MODEL_RATE_LIMITED: "MODEL_RATE_LIMITED",
  MODEL_OUTPUT_INVALID: "MODEL_OUTPUT_INVALID",
  MODEL_NOT_CONFIGURED: "MODEL_NOT_CONFIGURED",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  MODEL_TIMEOUT: "MODEL_TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export const ErrorCodeSchema = z.enum([
  ERROR_CODES.INVALID_INPUT,
  ERROR_CODES.CONSTRAINT_CONFLICT,
  ERROR_CODES.REQUEST_TOO_LARGE,
  ERROR_CODES.NO_VALID_BRANCH,
  ERROR_CODES.MODEL_RATE_LIMITED,
  ERROR_CODES.MODEL_OUTPUT_INVALID,
  ERROR_CODES.MODEL_NOT_CONFIGURED,
  ERROR_CODES.MODEL_UNAVAILABLE,
  ERROR_CODES.MODEL_TIMEOUT,
  ERROR_CODES.INTERNAL_ERROR,
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const TextItemSchema = z
  .object({
    id: identifier,
    text: nonBlank("text"),
  })
  .strict();

export type TextItem = z.infer<typeof TextItemSchema>;

export const StoryIntentSchema = z
  .object({
    plotContext: nonBlank("plotContext"),
    regret: nonBlank("regret"),
    mustHaves: z.array(TextItemSchema).min(1),
    preferences: z.array(TextItemSchema),
    constraints: z.array(TextItemSchema),
    desiredTone: z.string().optional(),
  })
  .strict();

export type StoryIntent = z.infer<typeof StoryIntentSchema>;

export const CanonCategorySchema = z.enum([
  "timeline",
  "character",
  "knowledge",
  "relationship",
  "world_rule",
  "setup",
  "preserved_future",
]);

export type CanonCategory = z.infer<typeof CanonCategorySchema>;

export const FactOriginSchema = z.enum([
  "direct_user_input",
  "model_inference",
]);

export const FactDispositionSchema = z.enum(["canon", "assumption"]);

export const FactDraftSchema = z
  .object({
    id: identifier,
    category: CanonCategorySchema,
    statement: nonBlank("statement"),
    timing: nonBlank("timing"),
    origin: FactOriginSchema,
    suggestedDisposition: FactDispositionSchema,
  })
  .strict();

export type FactDraft = z.infer<typeof FactDraftSchema>;

export const ClarificationQuestionSchema = z
  .object({
    id: identifier,
    question: nonBlank("question"),
    whyItMatters: nonBlank("whyItMatters"),
    suggestedAssumption: nonBlank("suggestedAssumption"),
  })
  .strict();

export type ClarificationQuestion = z.infer<
  typeof ClarificationQuestionSchema
>;

export const ClarificationAnswerSchema = z
  .object({
    questionId: identifier,
    question: nonBlank("question"),
    answer: nonBlank("answer"),
  })
  .strict();

export type ClarificationAnswer = z.infer<typeof ClarificationAnswerSchema>;

export const ConstraintConflictSchema = z
  .object({
    id: identifier,
    mustHaveIds: z.array(identifier),
    constraintIds: z.array(identifier),
    factDraftIds: z.array(identifier),
    explanation: nonBlank("explanation"),
  })
  .strict();

export type ConstraintConflict = z.infer<typeof ConstraintConflictSchema>;

export const ConfirmedCanonFactSchema = z
  .object({
    id: identifier,
    category: CanonCategorySchema,
    statement: nonBlank("statement"),
    timing: nonBlank("timing"),
    origin: FactOriginSchema,
    locked: z.literal(true),
  })
  .strict();

export type ConfirmedCanonFact = z.infer<typeof ConfirmedCanonFactSchema>;

export const AssumptionSchema = z
  .object({
    id: identifier,
    text: nonBlank("text"),
    source: z.enum(["user_provided", "ai_suggested"]),
  })
  .strict();

export type Assumption = z.infer<typeof AssumptionSchema>;

export const AnalyzeRequestSchema = z
  .object({
    intent: StoryIntentSchema,
    clarificationAnswers: z.array(ClarificationAnswerSchema),
  })
  .strict();

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalyzeResponseSchema = z
  .object({
    factDrafts: z.array(FactDraftSchema),
    questions: z.array(ClarificationQuestionSchema).min(0).max(3),
    conflicts: z.array(ConstraintConflictSchema),
    canContinueWithAssumptions: z.boolean(),
  })
  .strict();

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export const CausalStepSchema = z
  .object({
    order: z.number().int().positive(),
    cause: nonBlank("cause"),
    effect: nonBlank("effect"),
  })
  .strict();

export type CausalStep = z.infer<typeof CausalStepSchema>;

export const BranchSkeletonSchema = z
  .object({
    id: identifier,
    title: nonBlank("title"),
    divergencePoint: nonBlank("divergencePoint"),
    motivation: nonBlank("motivation"),
    causalSteps: z.array(CausalStepSchema).min(3).max(5),
    cost: nonBlank("cost"),
    outcome: nonBlank("outcome"),
    newAssumptions: z.array(AssumptionSchema),
  })
  .strict();

export type BranchSkeleton = z.infer<typeof BranchSkeletonSchema>;

export const BranchCandidateSchema = BranchSkeletonSchema.extend({
    coveredMustHaveIds: z.array(identifier),
    coveredPreferenceIds: z.array(identifier),
    respectedConstraintIds: z.array(identifier),
    evidenceFactIds: z.array(identifier),
    usedAssumptionIds: z.array(identifier),
    warnings: z.array(nonBlank("warning")),
  }).strict();

export type BranchCandidate = z.infer<typeof BranchCandidateSchema>;

export const BranchGeneratorOutputSchema = z
  .object({
    skeletons: z.array(BranchSkeletonSchema).length(5),
  })
  .strict();

export type BranchGeneratorOutput = z.infer<
  typeof BranchGeneratorOutputSchema
>;

export const RejectedCandidateSchema = z
  .object({
    candidateId: identifier,
    title: nonBlank("title"),
    reasons: z.array(nonBlank("reason")).min(1),
  })
  .strict();

export type RejectedCandidate = z.infer<typeof RejectedCandidateSchema>;

export const BranchesRequestSchema = z
  .object({
    intent: StoryIntentSchema,
    canonFacts: z.array(ConfirmedCanonFactSchema),
    assumptions: z.array(AssumptionSchema),
    unresolvedConflicts: z.array(ConstraintConflictSchema),
  })
  .strict();

export type BranchesRequest = z.infer<typeof BranchesRequestSchema>;

export const BranchesResponseSchema = z
  .object({
    generatedCount: z.literal(5),
    candidates: z.array(BranchCandidateSchema).min(1).max(3),
    rejected: z.array(RejectedCandidateSchema),
  })
  .strict();

export type BranchesResponse = z.infer<typeof BranchesResponseSchema>;

export const BranchCriticAcceptedSchema = z
  .object({
    candidateId: identifier,
    coveredPreferenceIds: z.array(identifier),
    evidenceFactIds: z.array(identifier),
    usedAssumptionIds: z.array(identifier),
    warnings: z.array(nonBlank("warning")),
  })
  .strict();

export type BranchCriticAccepted = z.infer<typeof BranchCriticAcceptedSchema>;

export const BranchCriticRejectedSchema = z
  .object({
    candidateId: identifier,
    reasons: z.array(nonBlank("reason")).min(1),
  })
  .strict();

export type BranchCriticRejected = z.infer<typeof BranchCriticRejectedSchema>;

export const BranchCriticOutputSchema = z
  .object({
    accepted: z.array(BranchCriticAcceptedSchema).max(3),
    rejected: z.array(BranchCriticRejectedSchema).max(5),
  })
  .strict();

export type BranchCriticOutput = z.infer<typeof BranchCriticOutputSchema>;

export const PanelRoleSchema = z.enum([
  "original_tension",
  "divergence_trigger",
  "different_choice",
  "action_and_cost",
  "changed_result",
  "emotional_aftertaste",
]);

export type PanelRole = z.infer<typeof PanelRoleSchema>;

export const PanelSchema = z
  .object({
    panelNo: z.number().int().min(1).max(6),
    role: PanelRoleSchema,
    visual: nonBlank("visual"),
    action: nonBlank("action"),
    dialogueOrNarration: nonBlank("dialogueOrNarration"),
  })
  .strict();

export type Panel = z.infer<typeof PanelSchema>;

export const ComplianceSchema = z
  .object({
    fulfilledMustHaveIds: z.array(identifier),
    fulfilledPreferenceIds: z.array(identifier),
    respectedConstraintIds: z.array(identifier),
    referencedFactIds: z.array(identifier),
    assumptions: z.array(AssumptionSchema),
    warnings: z.array(nonBlank("warning")),
  })
  .strict();

export type Compliance = z.infer<typeof ComplianceSchema>;

export const StoryboardSchema = z
  .object({
    title: nonBlank("title"),
    panels: z.array(PanelSchema).length(6),
    compliance: ComplianceSchema,
  })
  .strict();

export type Storyboard = z.infer<typeof StoryboardSchema>;

export const StoryboardWriterConflictSchema = z
  .object({
    kind: z.literal("conflict"),
    explanation: nonBlank("explanation"),
    relatedFactIds: z.array(identifier),
    relatedMustHaveIds: z.array(identifier),
    relatedConstraintIds: z.array(identifier),
    relatedBranchId: identifier.optional(),
  })
  .strict();

export const StoryboardWriterSuccessSchema = z
  .object({
    kind: z.literal("storyboard"),
    title: nonBlank("title"),
    panels: z.array(PanelSchema).length(6),
    compliance: ComplianceSchema,
  })
  .strict();

export const StoryboardWriterOutputSchema = z.discriminatedUnion("kind", [
  StoryboardWriterConflictSchema,
  StoryboardWriterSuccessSchema,
]);

export type StoryboardWriterOutput = z.infer<
  typeof StoryboardWriterOutputSchema
>;

export const StoryboardCriticOutputSchema = z
  .object({
    verdict: z.enum(["pass", "hard_fail"]),
    issues: z.array(nonBlank("issue")),
  })
  .strict();

export type StoryboardCriticOutput = z.infer<
  typeof StoryboardCriticOutputSchema
>;

export const StoryboardRequestSchema = z
  .object({
    intent: StoryIntentSchema,
    canonFacts: z.array(ConfirmedCanonFactSchema),
    assumptions: z.array(AssumptionSchema),
    selectedBranch: BranchCandidateSchema,
    finalAdjustment: z.string().optional(),
  })
  .strict();

export type StoryboardRequest = z.infer<typeof StoryboardRequestSchema>;

export const StoryboardResponseSchema = StoryboardSchema;
export type StoryboardResponse = Storyboard;

export const SafeConflictDetailsSchema = z
  .object({
    explanation: nonBlank("explanation"),
    relatedFactIds: z.array(identifier),
    relatedMustHaveIds: z.array(identifier),
    relatedConstraintIds: z.array(identifier),
    relatedBranchId: identifier.optional(),
  })
  .strict();

export type SafeConflictDetails = z.infer<typeof SafeConflictDetailsSchema>;

export const SafeErrorSchema = z
  .object({
    code: ErrorCodeSchema,
    message: nonBlank("message"),
    retryable: z.boolean(),
    requestId: identifier.optional(),
    details: SafeConflictDetailsSchema.optional(),
  })
  .strict();

export type SafeError = z.infer<typeof SafeErrorSchema>;

export const SessionStageSchema = z.enum([
  "input",
  "context_review",
  "branch_choice",
  "storyboard",
  "error",
]);

export type SessionStage = z.infer<typeof SessionStageSchema>;

const SessionDraftTextItemSchema = z
  .object({
    id: identifier,
    text: z.string(),
  })
  .strict();

export const SessionDraftSchema = z
  .object({
    plotContext: z.string(),
    regret: z.string(),
    mustHaves: z.array(SessionDraftTextItemSchema).min(1),
    preferences: z.array(SessionDraftTextItemSchema),
    constraints: z.array(SessionDraftTextItemSchema),
    desiredTone: z.string(),
  })
  .strict();

export type SessionDraft = z.infer<typeof SessionDraftSchema>;

export const RetryKindSchema = z.enum([
  "analyze",
  "reanalyze",
  "branches",
  "storyboard",
]);

export type RetryKind = z.infer<typeof RetryKindSchema>;

export const SessionSnapshotSchema = z
  .object({
    stage: SessionStageSchema,
    workTitle: z.string(),
    draft: SessionDraftSchema,
    intent: StoryIntentSchema.nullable(),
    analysis: AnalyzeResponseSchema.nullable(),
    clarificationAnswers: z.array(ClarificationAnswerSchema),
    questionSuggestions: z.record(z.string(), z.string()),
    factDrafts: z.array(FactDraftSchema),
    confirmedFacts: z.array(ConfirmedCanonFactSchema),
    assumptions: z.array(AssumptionSchema),
    candidates: z.array(BranchCandidateSchema),
    rejected: z.array(RejectedCandidateSchema),
    selectedBranch: BranchCandidateSchema.nullable(),
    finalAdjustment: z.string(),
    storyboard: StoryboardResponseSchema.nullable(),
    lastError: SafeErrorSchema.nullable(),
    retryKind: RetryKindSchema.nullable(),
  })
  .strict();

export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

export const SessionEnvelopeSchema = z
  .object({
    version: z.literal("comic-if-line:v1"),
    snapshot: SessionSnapshotSchema,
  })
  .strict();

export type SessionEnvelope = z.infer<typeof SessionEnvelopeSchema>;
