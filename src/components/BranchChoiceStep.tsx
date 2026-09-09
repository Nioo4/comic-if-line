import type {
  Assumption,
  BranchCandidate,
  ConfirmedCanonFact,
  RejectedCandidate,
  StoryIntent,
} from "../lib/contracts.ts";

type BranchChoiceStepProps = {
  intent: StoryIntent;
  canonFacts: ConfirmedCanonFact[];
  assumptions: Assumption[];
  candidates: BranchCandidate[];
  rejected: RejectedCandidate[];
  selectedBranch: BranchCandidate | null;
  finalAdjustment: string;
  disabled: boolean;
  onSelect: (candidate: BranchCandidate) => void;
  onAdjustmentChange: (value: string) => void;
  onGenerate: () => void;
  onBack: () => void;
};

function labelsFor(ids: readonly string[], values: readonly { id: string; text: string }[]) {
  return ids.map((id) => values.find((value) => value.id === id)?.text ?? id);
}

export default function BranchChoiceStep({
  intent,
  canonFacts,
  assumptions,
  candidates,
  rejected,
  selectedBranch,
  finalAdjustment,
  disabled,
  onSelect,
  onAdjustmentChange,
  onGenerate,
  onBack,
}: BranchChoiceStepProps) {
  return (
    <section className="step-card">
      <div className="step-heading">
        <div>
          <p className="section-kicker">03 / 选择分岔</p>
          <h2>每条路都要付出代价，你想看哪一条？</h2>
        </div>
        <button className="button button-quiet" type="button" disabled={disabled} onClick={onBack}>
          返回修改输入
        </button>
      </div>

      <div className="branch-grid">
        {candidates.map((candidate) => {
          const selected = selectedBranch?.id === candidate.id;
          const availableAssumptions = [...assumptions, ...candidate.newAssumptions];
          return (
            <article className={selected ? "branch-card selected" : "branch-card"} key={candidate.id}>
              <div className="branch-card-heading">
                <span className="id-chip">{candidate.id}</span>
                <button
                  className={selected ? "choice active" : "choice"}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onSelect(candidate)}
                >
                  {selected ? "已选择" : "选择这条路"}
                </button>
              </div>
              <h3>{candidate.title}</h3>
              <p className="branch-lead">分歧点：{candidate.divergencePoint}</p>
              <dl className="detail-list">
                <div>
                  <dt>动机</dt>
                  <dd>{candidate.motivation}</dd>
                </div>
                <div>
                  <dt>代价</dt>
                  <dd>{candidate.cost}</dd>
                </div>
                <div>
                  <dt>结果</dt>
                  <dd>{candidate.outcome}</dd>
                </div>
              </dl>
              <h4>因果步骤</h4>
              <ol className="causal-steps">
                {candidate.causalSteps.map((step) => (
                  <li key={`${candidate.id}-${step.order}`}>
                    <span>{step.order}</span>
                    <p>
                      {step.cause} → {step.effect}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="trace-grid">
                <div>
                  <h4>必达结果</h4>
                  <p>{labelsFor(candidate.coveredMustHaveIds, intent.mustHaves).join("；") || "无"}</p>
                </div>
                <div>
                  <h4>偏好（实际满足）</h4>
                  <p>{labelsFor(candidate.coveredPreferenceIds, intent.preferences).join("；") || "无"}</p>
                </div>
                <div>
                  <h4>约束</h4>
                  <p>{labelsFor(candidate.respectedConstraintIds, intent.constraints).join("；") || "无"}</p>
                </div>
                <div>
                  <h4>依据事实</h4>
                  <p>
                    {candidate.evidenceFactIds
                      .map((id) => canonFacts.find((fact) => fact.id === id)?.statement ?? id)
                      .join("；") || "无"}
                  </p>
                </div>
                <div>
                  <h4>使用假设</h4>
                  <p>
                    {candidate.usedAssumptionIds
                      .map((id) => availableAssumptions.find((assumption) => assumption.id === id)?.text ?? id)
                      .join("；") || "无"}
                  </p>
                </div>
                <div>
                  <h4>新增假设</h4>
                  <p>{candidate.newAssumptions.map((item) => item.text).join("；") || "无"}</p>
                </div>
              </div>
              {candidate.warnings.length ? (
                <div className="warning-note">
                  <strong>提示</strong>
                  <ul>
                    {candidate.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {rejected.length ? (
        <details className="rejected-list">
          <summary>查看未进入候选的 {rejected.length} 条方向</summary>
          {rejected.map((item) => (
            <div className="rejected-item" key={item.candidateId}>
              <strong>{item.title}</strong>
              <span className="id-chip">{item.candidateId}</span>
              <ul>
                {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          ))}
        </details>
      ) : null}

      <label className="field-label" htmlFor="final-adjustment">
        最后调整 <span className="optional">可选</span>
      </label>
      <textarea
        id="final-adjustment"
        rows={3}
        value={finalAdjustment}
        disabled={disabled}
        placeholder="只写希望成稿如何收束；不能覆盖已锁定事实、必达结果或约束。"
        onChange={(event) => onAdjustmentChange(event.target.value)}
      />
      <div className="form-actions split-actions">
        <button className="button button-quiet" type="button" disabled={disabled} onClick={onBack}>
          返回修改输入
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={disabled || !selectedBranch}
          onClick={onGenerate}
        >
          生成六格成稿
        </button>
      </div>
    </section>
  );
}
