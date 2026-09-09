import type {
  AnalyzeResponse,
  Assumption,
  CanonCategory,
  ClarificationAnswer,
  ConfirmedCanonFact,
  FactDraft,
} from "../lib/contracts.ts";

type ContextReviewStepProps = {
  analysis: AnalyzeResponse | null;
  factDrafts: FactDraft[];
  clarificationAnswers: ClarificationAnswer[];
  answerBaseline: ClarificationAnswer[];
  questionSuggestions: Record<string, string>;
  disabled: boolean;
  onAnswerChange: (questionId: string, question: string, answer: string) => void;
  onQuestionSuggestionChange: (questionId: string, value: string) => void;
  onFactChange: (fact: FactDraft) => void;
  onFactDelete: (factId: string) => void;
  onReanalyze: () => void;
  onConfirm: (facts: ConfirmedCanonFact[], assumptions: Assumption[]) => void;
  onBack: () => void;
};

const categories: Array<{ value: CanonCategory; label: string }> = [
  { value: "timeline", label: "时间线" },
  { value: "character", label: "人物" },
  { value: "knowledge", label: "知情范围" },
  { value: "relationship", label: "关系" },
  { value: "world_rule", label: "世界规则" },
  { value: "setup", label: "背景设定" },
  { value: "preserved_future", label: "后续伏笔" },
];

function answerFor(
  answers: readonly ClarificationAnswer[],
  questionId: string,
) {
  return answers.find((answer) => answer.questionId === questionId)?.answer ?? "";
}

function sameAnswers(
  current: readonly ClarificationAnswer[],
  baseline: readonly ClarificationAnswer[],
) {
  if (current.length !== baseline.length) return false;
  return baseline.every((answer) =>
    current.some(
      (item) =>
        item.questionId === answer.questionId &&
        item.answer.trim() === answer.answer.trim(),
    ),
  );
}

function buildConfirmation(
  facts: readonly FactDraft[],
  analysis: AnalyzeResponse | null,
  answers: readonly ClarificationAnswer[],
  suggestions: Record<string, string>,
) {
  const confirmedFacts: ConfirmedCanonFact[] = [];
  const assumptions: Assumption[] = [];

  for (const fact of facts) {
    if (fact.suggestedDisposition === "canon") {
      confirmedFacts.push({
        id: fact.id,
        category: fact.category,
        statement: fact.statement,
        timing: fact.timing,
        origin: fact.origin,
        locked: true,
      });
    } else {
      assumptions.push({
        id: `fact-assumption-${fact.id}`,
        text: fact.statement,
        source: fact.origin === "model_inference" ? "ai_suggested" : "user_provided",
      });
    }
  }

  for (const question of analysis?.questions ?? []) {
    const answer = answerFor(answers, question.id).trim();
    const suggestion = (suggestions[question.id] ?? question.suggestedAssumption).trim();
    if (!answer && suggestion) {
      assumptions.push({
        id: `question-assumption-${question.id}`,
        text: suggestion,
        source: "ai_suggested",
      });
    }
  }

  return { confirmedFacts, assumptions };
}

export default function ContextReviewStep({
  analysis,
  factDrafts,
  clarificationAnswers,
  answerBaseline,
  questionSuggestions,
  disabled,
  onAnswerChange,
  onQuestionSuggestionChange,
  onFactChange,
  onFactDelete,
  onReanalyze,
  onConfirm,
  onBack,
}: ContextReviewStepProps) {
  const dirty = !sameAnswers(clarificationAnswers, answerBaseline);
  const hasConflicts = (analysis?.conflicts.length ?? 0) > 0;
  const confirmation = () => {
    const result = buildConfirmation(
      factDrafts,
      analysis,
      clarificationAnswers,
      questionSuggestions,
    );
    onConfirm(result.confirmedFacts, result.assumptions);
  };

  return (
    <section className="step-card">
      <div className="step-heading">
        <div>
          <p className="section-kicker">02 / 核对事实</p>
          <h2>哪些是确定发生过的，哪些只是你愿意尝试的假设？</h2>
        </div>
        <button className="button button-quiet" type="button" disabled={disabled} onClick={onBack}>
          返回修改输入
        </button>
      </div>

      {analysis?.questions.length ? (
        <section className="subsection" aria-labelledby="questions-title">
          <div className="subsection-heading">
            <h3 id="questions-title">需要你补充的 {analysis.questions.length} 个问题</h3>
            <span className={dirty ? "dirty-badge" : "clean-badge"}>
              {dirty ? "回答尚未重新理解" : "已同步"}
            </span>
          </div>
          <p className="field-hint">
            填写回答后，必须点击“用回答重新理解”；未填写的问题可以把建议假设带入下一步。
          </p>
          {analysis.questions.map((question) => (
            <div className="question-card" key={question.id}>
              <label className="field-label" htmlFor={`question-${question.id}`}>
                {question.question}
              </label>
              <p className="why">为什么重要：{question.whyItMatters}</p>
              <textarea
                id={`question-${question.id}`}
                value={answerFor(clarificationAnswers, question.id)}
                disabled={disabled}
                rows={2}
                placeholder="如果没有补充，留空即可。"
                onChange={(event) =>
                  onAnswerChange(question.id, question.question, event.target.value)
                }
              />
              <label className="field-label" htmlFor={`suggestion-${question.id}`}>
                未回答时采用的创作假设
              </label>
              <input
                id={`suggestion-${question.id}`}
                type="text"
                value={questionSuggestions[question.id] ?? question.suggestedAssumption}
                disabled={disabled}
                onChange={(event) => onQuestionSuggestionChange(question.id, event.target.value)}
              />
            </div>
          ))}
          <button
            className="button button-secondary"
            type="button"
            disabled={disabled || !dirty}
            onClick={onReanalyze}
          >
            用回答重新理解
          </button>
        </section>
      ) : (
        <p className="quiet-note">这次理解没有需要追问的问题，可以直接核对下方事实。</p>
      )}

      <section className="subsection" aria-labelledby="facts-title">
        <div className="subsection-heading">
          <h3 id="facts-title">事实草稿</h3>
          <span className="count-badge">{factDrafts.length} 条</span>
        </div>
        {factDrafts.length === 0 ? (
          <p className="quiet-note">没有可锁定的事实；你仍可以继续使用自己的输入。</p>
        ) : (
          <div className="fact-list">
            {factDrafts.map((fact) => (
              <article className="fact-card" key={fact.id}>
                <div className="fact-card-topline">
                  <span className="id-chip">{fact.id}</span>
                  <button
                    className="text-button danger-text"
                    type="button"
                    disabled={disabled}
                    onClick={() => onFactDelete(fact.id)}
                  >
                    删除此条
                  </button>
                </div>
                <div className="two-col">
                  <label className="field-label">
                    分类
                    <select
                      value={fact.category}
                      disabled={disabled}
                      onChange={(event) =>
                        onFactChange({
                          ...fact,
                          category: event.target.value as CanonCategory,
                        })
                      }
                    >
                      {categories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    时间
                    <input
                      type="text"
                      value={fact.timing}
                      disabled={disabled}
                      onChange={(event) => onFactChange({ ...fact, timing: event.target.value })}
                    />
                  </label>
                </div>
                <label className="field-label">
                  事实表述
                  <textarea
                    rows={2}
                    value={fact.statement}
                    disabled={disabled}
                    onChange={(event) => onFactChange({ ...fact, statement: event.target.value })}
                  />
                </label>
                <div className="choice-group" aria-label="事实处置">
                  <span className="field-label">这条内容是：</span>
                  <button
                    className={fact.suggestedDisposition === "canon" ? "choice active" : "choice"}
                    type="button"
                    disabled={disabled}
                    onClick={() => onFactChange({ ...fact, suggestedDisposition: "canon" })}
                  >
                    确认事实
                  </button>
                  <button
                    className={fact.suggestedDisposition === "assumption" ? "choice active" : "choice"}
                    type="button"
                    disabled={disabled}
                    onClick={() => onFactChange({ ...fact, suggestedDisposition: "assumption" })}
                  >
                    创作假设
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {hasConflicts ? (
        <section className="conflict-box" aria-labelledby="conflicts-title">
          <h3 id="conflicts-title">这些要求目前互相冲突</h3>
          {analysis?.conflicts.map((conflict) => (
            <div key={conflict.id} className="conflict-item">
              <span className="id-chip">{conflict.id}</span>
              <p>{conflict.explanation}</p>
              <p className="muted">
                必达结果：{conflict.mustHaveIds.join("、") || "无"}；约束：
                {conflict.constraintIds.join("、") || "无"}
              </p>
            </div>
          ))}
          <p className="field-hint">请返回修改输入，解除冲突后再继续。</p>
        </section>
      ) : null}

      <div className="form-actions split-actions">
        <button className="button button-quiet" type="button" disabled={disabled} onClick={onBack}>
          返回修改输入
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={disabled || dirty || hasConflicts}
          onClick={confirmation}
        >
          确认事实并生成分支
        </button>
      </div>
    </section>
  );
}
