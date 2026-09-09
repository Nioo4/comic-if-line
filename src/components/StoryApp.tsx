"use client";

import { useEffect, useRef, useState, useReducer } from "react";
import {
  AnalyzeResponseSchema,
  BranchesResponseSchema,
  ConfirmedCanonFactSchema,
  ERROR_CODES,
  SafeErrorSchema,
  StoryboardResponseSchema,
  StoryIntentSchema,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type Assumption,
  type BranchCandidate,
  type BranchesRequest,
  type BranchesResponse,
  type ClarificationAnswer,
  type ConfirmedCanonFact,
  type FactDraft,
  type SafeError,
  type RetryKind,
  type SessionDraft,
  type SessionSnapshot,
  type StoryboardRequest,
  type StoryboardResponse,
  type StoryIntent,
} from "../lib/contracts.ts";
import { demoStory } from "../data/demo-story.ts";
import { clearSession, readSession, writeSession } from "../lib/session.ts";
import ErrorBanner from "./ErrorBanner.tsx";
import InputStep from "./InputStep.tsx";
import ContextReviewStep from "./ContextReviewStep.tsx";
import BranchChoiceStep from "./BranchChoiceStep.tsx";
import StoryboardStep from "./StoryboardStep.tsx";

type StablePhase = "input" | "context_review" | "branch_choice" | "storyboard";
type UIPhase = StablePhase | "analyzing" | "generating_branches" | "generating_storyboard" | "error";

type AppState = {
  phase: UIPhase;
  stablePhase: StablePhase;
  workTitle: string;
  draft: SessionDraft;
  intent: StoryIntent | null;
  analysis: AnalyzeResponse | null;
  clarificationAnswers: ClarificationAnswer[];
  answerBaseline: ClarificationAnswer[];
  questionSuggestions: Record<string, string>;
  factDrafts: FactDraft[];
  confirmedFacts: ConfirmedCanonFact[];
  assumptions: Assumption[];
  candidates: BranchCandidate[];
  rejected: BranchesResponse["rejected"];
  selectedBranch: BranchCandidate | null;
  finalAdjustment: string;
  storyboard: StoryboardResponse | null;
  lastError: SafeError | null;
  retryKind: RetryKind | null;
};

type Action =
  | { type: "HYDRATE"; snapshot: SessionSnapshot | null }
  | { type: "SET_DRAFT"; draft: SessionDraft }
  | { type: "SET_WORK_TITLE"; value: string }
  | { type: "LOAD_DEMO" }
  | { type: "ANALYZE_START"; intent: StoryIntent; answers: ClarificationAnswer[]; stablePhase: StablePhase; retryKind: RetryKind }
  | { type: "ANALYZE_SUCCESS"; intent: StoryIntent; response: AnalyzeResponse; answers: ClarificationAnswer[] }
  | { type: "SET_ANSWERS"; answers: ClarificationAnswer[] }
  | { type: "SET_QUESTION_SUGGESTION"; questionId: string; value: string }
  | { type: "SET_FACT"; fact: FactDraft }
  | { type: "DELETE_FACT"; factId: string }
  | { type: "CONTEXT_CONFIRMED"; facts: ConfirmedCanonFact[]; assumptions: Assumption[] }
  | { type: "BRANCHES_START" }
  | { type: "BRANCHES_SUCCESS"; response: BranchesResponse }
  | { type: "SELECT_BRANCH"; branch: BranchCandidate }
  | { type: "SET_FINAL_ADJUSTMENT"; value: string }
  | { type: "STORYBOARD_START" }
  | { type: "STORYBOARD_SUCCESS"; response: StoryboardResponse }
  | { type: "ERROR"; error: SafeError }
  | { type: "BACK_INPUT" }
  | { type: "BACK_BRANCH" }
  | { type: "CLEAR" };

const emptyDraft = (): SessionDraft => ({
  plotContext: "",
  regret: "",
  mustHaves: [{ id: "must-1", text: "" }],
  preferences: [],
  constraints: [],
  desiredTone: "",
});

const initialState = (): AppState => ({
  phase: "input",
  stablePhase: "input",
  workTitle: "",
  draft: emptyDraft(),
  intent: null,
  analysis: null,
  clarificationAnswers: [],
  answerBaseline: [],
  questionSuggestions: {},
  factDrafts: [],
  confirmedFacts: [],
  assumptions: [],
  candidates: [],
  rejected: [],
  selectedBranch: null,
  finalAdjustment: "",
  storyboard: null,
  lastError: null,
  retryKind: null,
});

function editableIntent(intent: StoryIntent): SessionDraft {
  return {
    plotContext: intent.plotContext,
    regret: intent.regret,
    mustHaves: intent.mustHaves,
    preferences: intent.preferences,
    constraints: intent.constraints,
    desiredTone: intent.desiredTone ?? "",
  };
}

function stablePhaseFromSession(stage: SessionSnapshot["stage"]): StablePhase {
  return stage === "context_review" || stage === "branch_choice" || stage === "storyboard"
    ? stage
    : "input";
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE": {
      if (!action.snapshot) return state;
      const stablePhase = stablePhaseFromSession(action.snapshot.stage);
      return {
        ...state,
        phase: action.snapshot.lastError ? "error" : stablePhase,
        stablePhase,
        workTitle: action.snapshot.workTitle,
        draft: action.snapshot.draft,
        intent: action.snapshot.intent,
        analysis: action.snapshot.analysis,
        clarificationAnswers: action.snapshot.clarificationAnswers,
        answerBaseline: action.snapshot.clarificationAnswers,
        questionSuggestions: action.snapshot.questionSuggestions,
        factDrafts: action.snapshot.factDrafts,
        confirmedFacts: action.snapshot.confirmedFacts,
        assumptions: action.snapshot.assumptions,
        candidates: action.snapshot.candidates,
        rejected: action.snapshot.rejected,
        selectedBranch: action.snapshot.selectedBranch,
        finalAdjustment: action.snapshot.finalAdjustment,
        storyboard: action.snapshot.storyboard,
        lastError: action.snapshot.lastError,
        retryKind: action.snapshot.retryKind,
      };
    }
    case "SET_DRAFT":
      return { ...state, draft: action.draft, lastError: null, retryKind: null };
    case "SET_WORK_TITLE":
      return { ...state, workTitle: action.value, lastError: null, retryKind: null };
    case "LOAD_DEMO":
      return {
        ...state,
        workTitle: demoStory.workTitle,
        draft: editableIntent(demoStory.intent),
        phase: "input",
        stablePhase: "input",
        lastError: null,
        retryKind: null,
      };
    case "ANALYZE_START":
      return {
        ...state,
        phase: "analyzing",
        stablePhase: action.stablePhase,
        intent: action.intent,
        clarificationAnswers: action.answers,
        lastError: null,
        retryKind: action.retryKind,
      };
    case "ANALYZE_SUCCESS":
      return {
        ...state,
        phase: "context_review",
        stablePhase: "context_review",
        intent: action.intent,
        draft: editableIntent(action.intent),
        analysis: action.response,
        clarificationAnswers: action.answers,
        answerBaseline: action.answers,
        questionSuggestions: Object.fromEntries(
          action.response.questions.map((question) => [question.id, question.suggestedAssumption]),
        ),
        factDrafts: action.response.factDrafts,
        confirmedFacts: [],
        assumptions: [],
        candidates: [],
        rejected: [],
        selectedBranch: null,
        finalAdjustment: "",
        storyboard: null,
        lastError: null,
        retryKind: null,
      };
    case "SET_ANSWERS":
      return { ...state, clarificationAnswers: action.answers, lastError: null, retryKind: null };
    case "SET_QUESTION_SUGGESTION":
      return {
        ...state,
        questionSuggestions: { ...state.questionSuggestions, [action.questionId]: action.value },
        retryKind: null,
      };
    case "SET_FACT":
      return {
        ...state,
        factDrafts: state.factDrafts.map((fact) => (fact.id === action.fact.id ? action.fact : fact)),
        retryKind: null,
      };
    case "DELETE_FACT":
      return { ...state, factDrafts: state.factDrafts.filter((fact) => fact.id !== action.factId), retryKind: null };
    case "CONTEXT_CONFIRMED":
      return { ...state, confirmedFacts: action.facts, assumptions: action.assumptions, lastError: null, retryKind: null };
    case "BRANCHES_START":
      return { ...state, phase: "generating_branches", stablePhase: "context_review", lastError: null, retryKind: "branches" };
    case "BRANCHES_SUCCESS":
      return {
        ...state,
        phase: "branch_choice",
        stablePhase: "branch_choice",
        candidates: action.response.candidates,
        rejected: action.response.rejected,
        selectedBranch: null,
        finalAdjustment: "",
        storyboard: null,
        lastError: null,
        retryKind: null,
      };
    case "SELECT_BRANCH":
      return { ...state, selectedBranch: action.branch, lastError: null, retryKind: null };
    case "SET_FINAL_ADJUSTMENT":
      return { ...state, finalAdjustment: action.value, lastError: null, retryKind: null };
    case "STORYBOARD_START":
      return { ...state, phase: "generating_storyboard", stablePhase: "branch_choice", lastError: null, retryKind: "storyboard" };
    case "STORYBOARD_SUCCESS":
      return {
        ...state,
        phase: "storyboard",
        stablePhase: "storyboard",
        storyboard: action.response,
        lastError: null,
        retryKind: null,
      };
    case "ERROR":
      return {
        ...state,
        phase: "error",
        lastError: action.error,
        retryKind: action.error.retryable ? state.retryKind : null,
      };
    case "BACK_INPUT":
      return {
        ...state,
        phase: "input",
        stablePhase: "input",
        intent: null,
        analysis: null,
        clarificationAnswers: [],
        answerBaseline: [],
        questionSuggestions: {},
        factDrafts: [],
        confirmedFacts: [],
        assumptions: [],
        candidates: [],
        rejected: [],
        selectedBranch: null,
        finalAdjustment: "",
        storyboard: null,
        lastError: null,
        retryKind: null,
      };
    case "BACK_BRANCH":
      return {
        ...state,
        phase: "branch_choice",
        stablePhase: "branch_choice",
        storyboard: null,
        lastError: null,
        retryKind: null,
      };
    case "CLEAR":
      return initialState();
  }
}

function snapshotFor(state: AppState): SessionSnapshot {
  const draftCheck = StoryIntentSchema.safeParse({
    ...state.draft,
    ...(state.draft.desiredTone ? { desiredTone: state.draft.desiredTone } : {}),
  });
  return {
    stage: state.stablePhase,
    workTitle: state.workTitle,
    draft: state.draft,
    intent: state.intent ?? (draftCheck.success ? draftCheck.data : null),
    analysis: state.analysis,
    clarificationAnswers: state.clarificationAnswers,
    questionSuggestions: state.questionSuggestions,
    factDrafts: state.factDrafts,
    confirmedFacts: state.confirmedFacts,
    assumptions: state.assumptions,
    candidates: state.candidates,
    rejected: state.rejected,
    selectedBranch: state.selectedBranch,
    finalAdjustment: state.finalAdjustment,
    storyboard: state.storyboard,
    lastError: state.lastError,
    retryKind: state.retryKind,
  };
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: SafeError };

async function postJson<T>(path: string, payload: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: body as T };
    if (typeof body === "object" && body !== null && "error" in body) {
      const errorCheck = SafeErrorSchema.safeParse(body.error);
      if (errorCheck.success) return { ok: false, error: errorCheck.data };
    }
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: "请求没有完成，请稍后重试。",
        retryable: true,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.MODEL_UNAVAILABLE,
        message: "暂时无法连接故事模型，请稍后重试。",
        retryable: true,
      },
    };
  }
}

function localError(message: string): SafeError {
  return { code: ERROR_CODES.INVALID_INPUT, message, retryable: false };
}

function normalizedIntent(input: StoryIntent): StoryIntent {
  return {
    plotContext: input.plotContext.trim(),
    regret: input.regret.trim(),
    mustHaves: input.mustHaves.map((item) => ({ ...item, text: item.text.trim() })),
    preferences: input.preferences.map((item) => ({ ...item, text: item.text.trim() })),
    constraints: input.constraints.map((item) => ({ ...item, text: item.text.trim() })),
    ...(input.desiredTone?.trim() ? { desiredTone: input.desiredTone.trim() } : {}),
  };
}

function loadingPhase(phase: UIPhase) {
  return phase === "analyzing" || phase === "generating_branches" || phase === "generating_storyboard";
}

export default function StoryApp() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [retryVersion, setRetryVersion] = useState(0);
  const retryAction = useRef<(() => void) | null>(null);
  const skipFirstPersist = useRef(true);

  useEffect(() => {
    dispatch({ type: "HYDRATE", snapshot: readSession() });
  }, []);

  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    writeSession(snapshotFor(state));
  }, [state]);

  const executeAnalyze = async (payload: AnalyzeRequest, stablePhase: StablePhase) => {
    retryAction.current = () => { void executeAnalyze(payload, stablePhase); };
    setRetryVersion((version) => version + 1);
    dispatch({
      type: "ANALYZE_START",
      intent: payload.intent,
      answers: payload.clarificationAnswers,
      stablePhase,
      retryKind: stablePhase === "context_review" ? "reanalyze" : "analyze",
    });
    const result = await postJson<AnalyzeResponse>("/api/analyze", payload);
    if (!result.ok) {
      dispatch({ type: "ERROR", error: result.error });
      return;
    }
    const responseCheck = AnalyzeResponseSchema.safeParse(result.data);
    if (!responseCheck.success) {
      dispatch({
        type: "ERROR",
        error: { code: ERROR_CODES.MODEL_OUTPUT_INVALID, message: "分析结果格式不完整，请重试。", retryable: true },
      });
      return;
    }
    dispatch({ type: "ANALYZE_SUCCESS", intent: payload.intent, response: responseCheck.data, answers: payload.clarificationAnswers });
  };

  const startAnalyze = async (rawIntent: StoryIntent, stablePhase: StablePhase) => {
    const intent = normalizedIntent(rawIntent);
    const intentCheck = StoryIntentSchema.safeParse(intent);
    if (!intentCheck.success) {
      dispatch({
        type: "ERROR",
        error: localError("请补全故事背景、遗憾和至少一条必须保留的结果。"),
      });
      return;
    }
    const payload: AnalyzeRequest = {
      intent: intentCheck.data,
      clarificationAnswers: stablePhase === "context_review"
        ? state.clarificationAnswers.filter((answer) => answer.answer.trim())
        : [],
    };
    await executeAnalyze(payload, stablePhase);
  };

  const startBranches = async (payload: BranchesRequest) => {
    retryAction.current = () => { void startBranches(payload); };
    setRetryVersion((version) => version + 1);
    dispatch({ type: "BRANCHES_START" });
    const result = await postJson<BranchesResponse>("/api/branches", payload);
    if (!result.ok) {
      dispatch({ type: "ERROR", error: result.error });
      return;
    }
    const responseCheck = BranchesResponseSchema.safeParse(result.data);
    if (!responseCheck.success) {
      dispatch({
        type: "ERROR",
        error: { code: ERROR_CODES.MODEL_OUTPUT_INVALID, message: "分支结果格式不完整，请重试。", retryable: true },
      });
      return;
    }
    dispatch({ type: "BRANCHES_SUCCESS", response: responseCheck.data });
  };

  const startStoryboard = async (payload: StoryboardRequest) => {
    retryAction.current = () => { void startStoryboard(payload); };
    setRetryVersion((version) => version + 1);
    dispatch({ type: "STORYBOARD_START" });
    const result = await postJson<StoryboardResponse>("/api/storyboard", payload);
    if (!result.ok) {
      dispatch({ type: "ERROR", error: result.error });
      return;
    }
    const responseCheck = StoryboardResponseSchema.safeParse(result.data);
    if (!responseCheck.success) {
      dispatch({
        type: "ERROR",
        error: { code: ERROR_CODES.MODEL_OUTPUT_INVALID, message: "成稿结果格式不完整，请重试。", retryable: true },
      });
      return;
    }
    dispatch({ type: "STORYBOARD_SUCCESS", response: responseCheck.data });
  };

  const submitInput = (rawIntent: StoryIntent) => { void startAnalyze(rawIntent, "input"); };

  const reanalyze = () => {
    if (!state.intent) return;
    void startAnalyze(state.intent, "context_review");
  };

  const updateAnswer = (questionId: string, question: string, answer: string) => {
    const remaining = state.clarificationAnswers.filter((item) => item.questionId !== questionId);
    const answers = answer.trim()
      ? [...remaining, { questionId, question, answer }]
      : remaining;
    dispatch({ type: "SET_ANSWERS", answers });
  };

  const confirmContext = (facts: ConfirmedCanonFact[], assumptions: Assumption[]) => {
    if (!state.intent) return;
    const factCheck = facts.every((fact) => ConfirmedCanonFactSchema.safeParse(fact).success);
    if (!factCheck) {
      dispatch({ type: "ERROR", error: localError("请补全事实分类、表述和时间后再继续。") });
      return;
    }
    const uniqueAssumptions = Array.from(
      new Map([...state.assumptions, ...assumptions].map((assumption) => [assumption.id, assumption])).values(),
    );
    dispatch({ type: "CONTEXT_CONFIRMED", facts, assumptions: uniqueAssumptions });
    void startBranches({
      intent: state.intent,
      canonFacts: facts,
      assumptions: uniqueAssumptions,
      unresolvedConflicts: [],
    });
  };

  const generateStoryboard = () => {
    if (!state.intent || !state.selectedBranch) return;
    const payload: StoryboardRequest = {
      intent: state.intent,
      canonFacts: state.confirmedFacts,
      assumptions: state.assumptions,
      selectedBranch: state.selectedBranch,
      ...(state.finalAdjustment.trim() ? { finalAdjustment: state.finalAdjustment.trim() } : {}),
    };
    void startStoryboard(payload);
  };

  const retryFromSession = () => {
    if (!state.lastError?.retryable || !state.retryKind) return;
    if (state.retryKind === "analyze" || state.retryKind === "reanalyze") {
      if (!state.intent) return;
      void executeAnalyze(
        {
          intent: state.intent,
          clarificationAnswers: state.clarificationAnswers.filter((answer) => answer.answer.trim()),
        },
        state.retryKind === "reanalyze" ? "context_review" : "input",
      );
      return;
    }
    if (state.retryKind === "branches") {
      if (!state.intent) return;
      void startBranches({
        intent: state.intent,
        canonFacts: state.confirmedFacts,
        assumptions: state.assumptions,
        unresolvedConflicts: state.analysis?.conflicts ?? [],
      });
      return;
    }
    if (state.selectedBranch && state.intent) {
      void startStoryboard({
        intent: state.intent,
        canonFacts: state.confirmedFacts,
        assumptions: state.assumptions,
        selectedBranch: state.selectedBranch,
        ...(state.finalAdjustment.trim() ? { finalAdjustment: state.finalAdjustment.trim() } : {}),
      });
    }
  };

  const displayPhase: StablePhase = state.phase === "error"
    ? state.stablePhase
    : state.phase === "analyzing"
      ? state.stablePhase
      : state.phase === "generating_branches"
        ? "context_review"
        : state.phase === "generating_storyboard"
          ? "branch_choice"
          : state.phase;
  const isLoading = loadingPhase(state.phase);
  const progress = [
    ["input", "写下遗憾"],
    ["context_review", "核对事实"],
    ["branch_choice", "选择分岔"],
    ["storyboard", "读完这条路"],
  ] as const;
  const currentIndex = progress.findIndex(([value]) => value === displayPhase);
  const loadingLabel = state.phase === "analyzing"
    ? "正在理解故事与事实……"
    : state.phase === "generating_branches"
      ? "正在生成并审查候选分支……"
      : state.phase === "generating_storyboard"
        ? "正在写作并复核六格成稿……"
        : "";
  const canRetry = retryVersion > 0 || Boolean(state.lastError?.retryable && state.retryKind);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">漫画IF线 · 约束感故事工作台</p>
          <h1>让遗憾拥有另一条可信的路</h1>
          <p className="intro">
            把想保留的结果、不能破坏的事实和愿意承担的代价写下来，再让模型在边界内寻找分岔。
          </p>
        </div>
        <button
          className="button button-quiet clear-button"
          type="button"
          disabled={isLoading}
          onClick={() => {
            clearSession();
            dispatch({ type: "CLEAR" });
          }}
        >
          清除本次会话
        </button>
      </header>

      <nav className="progress" aria-label="创作进度">
        {progress.map(([value, label], index) => (
          <div
            className={index === currentIndex ? "progress-item current" : index < currentIndex ? "progress-item done" : "progress-item"}
            key={value}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <span className="progress-number">{String(index + 1).padStart(2, "0")}</span>
            <span>{label}</span>
          </div>
        ))}
      </nav>

      <p className="timing-note" aria-live="polite">
        {loadingLabel || "DeepSeek 生成可能需要 1–5 分钟，请保持页面打开。"}
      </p>

      {state.lastError ? (
        <ErrorBanner
          error={state.lastError}
          onRetry={canRetry ? () => {
            if (retryAction.current) retryAction.current();
            else retryFromSession();
          } : undefined}
        />
      ) : null}

      {displayPhase === "input" ? (
        <InputStep
          workTitle={state.workTitle}
          intent={state.draft}
          disabled={isLoading}
          onWorkTitleChange={(value) => dispatch({ type: "SET_WORK_TITLE", value })}
          onIntentChange={(draft) => dispatch({ type: "SET_DRAFT", draft })}
          onLoadDemo={() => dispatch({ type: "LOAD_DEMO" })}
          onSubmit={submitInput}
        />
      ) : null}

      {displayPhase === "context_review" ? (
        <ContextReviewStep
          analysis={state.analysis}
          factDrafts={state.factDrafts}
          clarificationAnswers={state.clarificationAnswers}
          answerBaseline={state.answerBaseline}
          questionSuggestions={state.questionSuggestions}
          disabled={isLoading}
          onAnswerChange={updateAnswer}
          onQuestionSuggestionChange={(questionId, value) => dispatch({ type: "SET_QUESTION_SUGGESTION", questionId, value })}
          onFactChange={(fact) => dispatch({ type: "SET_FACT", fact })}
          onFactDelete={(factId) => dispatch({ type: "DELETE_FACT", factId })}
          onReanalyze={reanalyze}
          onConfirm={confirmContext}
          onBack={() => dispatch({ type: "BACK_INPUT" })}
        />
      ) : null}

      {displayPhase === "branch_choice" && state.intent ? (
        <BranchChoiceStep
          intent={state.intent}
          canonFacts={state.confirmedFacts}
          assumptions={state.assumptions}
          candidates={state.candidates}
          rejected={state.rejected}
          selectedBranch={state.selectedBranch}
          finalAdjustment={state.finalAdjustment}
          disabled={isLoading}
          onSelect={(branch) => dispatch({ type: "SELECT_BRANCH", branch })}
          onAdjustmentChange={(value) => dispatch({ type: "SET_FINAL_ADJUSTMENT", value })}
          onGenerate={generateStoryboard}
          onBack={() => dispatch({ type: "BACK_INPUT" })}
        />
      ) : null}

      {displayPhase === "storyboard" && state.storyboard && state.intent ? (
        <StoryboardStep
          storyboard={state.storyboard}
          intent={state.intent}
          canonFacts={state.confirmedFacts}
          assumptions={state.assumptions}
          onBackBranch={() => dispatch({ type: "BACK_BRANCH" })}
          onBackInput={() => dispatch({ type: "BACK_INPUT" })}
        />
      ) : null}
    </main>
  );
}
