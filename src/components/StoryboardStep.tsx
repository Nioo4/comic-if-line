"use client";

import { useState } from "react";
import type {
  Assumption,
  ConfirmedCanonFact,
  Storyboard,
  StoryIntent,
  TextItem,
} from "../lib/contracts.ts";

type StoryboardStepProps = {
  storyboard: Storyboard;
  intent: StoryIntent;
  canonFacts: ConfirmedCanonFact[];
  assumptions: Assumption[];
  onBackBranch: () => void;
  onBackInput: () => void;
};

const roleLabels: Record<Storyboard["panels"][number]["role"], string> = {
  original_tension: "原始张力",
  divergence_trigger: "分歧触发",
  different_choice: "不同选择",
  action_and_cost: "行动与代价",
  changed_result: "改变后的结果",
  emotional_aftertaste: "情绪余韵",
};

function labelsFor(ids: readonly string[], values: readonly TextItem[]) {
  return ids.map((id) => values.find((value) => value.id === id)?.text ?? id);
}

function makeCopyText(
  storyboard: Storyboard,
  intent: StoryIntent,
  canonFacts: readonly ConfirmedCanonFact[],
  assumptions: readonly Assumption[],
) {
  const lines = [`# ${storyboard.title}`, ""];
  for (const panel of storyboard.panels) {
    lines.push(`## 第${panel.panelNo}格｜${roleLabels[panel.role]}`);
    lines.push(`画面：${panel.visual}`);
    lines.push(`动作：${panel.action}`);
    lines.push(`对白 / 旁白：${panel.dialogueOrNarration}`);
    lines.push("");
  }
  lines.push("## 合规摘要");
  lines.push(`必达结果：${labelsFor(storyboard.compliance.fulfilledMustHaveIds, intent.mustHaves).join("；") || "无"}`);
  lines.push(`偏好：${labelsFor(storyboard.compliance.fulfilledPreferenceIds, intent.preferences).join("；") || "无"}`);
  lines.push(`约束：${labelsFor(storyboard.compliance.respectedConstraintIds, intent.constraints).join("；") || "无"}`);
  lines.push(
    `事实依据：${storyboard.compliance.referencedFactIds
      .map((id) => canonFacts.find((fact) => fact.id === id)?.statement ?? id)
      .join("；") || "无"}`,
  );
  lines.push(
    `假设：${storyboard.compliance.assumptions
      .map((item) => assumptions.find((assumption) => assumption.id === item.id)?.text ?? item.text)
      .join("；") || "无"}`,
  );
  if (storyboard.compliance.warnings.length) {
    lines.push(`提示：${storyboard.compliance.warnings.join("；")}`);
  }
  return lines.join("\n");
}

export default function StoryboardStep({
  storyboard,
  intent,
  canonFacts,
  assumptions,
  onBackBranch,
  onBackInput,
}: StoryboardStepProps) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "failure">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(makeCopyText(storyboard, intent, canonFacts, assumptions));
      setCopyState("success");
    } catch {
      setCopyState("failure");
    }
  };

  return (
    <section className="step-card">
      <div className="step-heading">
        <div>
          <p className="section-kicker">04 / 读完这条路</p>
          <h2>{storyboard.title}</h2>
        </div>
        <button className="button button-secondary" type="button" onClick={copy}>
          复制完整脚本
        </button>
      </div>
      <p className="field-hint">
        这是基于已锁定事实、选择分支和最后调整生成的六格草稿；它不是对原作的官方续写。
      </p>
      {copyState === "success" ? <p className="success-note" role="status">已复制到剪贴板。</p> : null}
      {copyState === "failure" ? (
        <p className="warning-note" role="status">浏览器没有允许复制，请手动选中脚本内容保存。</p>
      ) : null}

      <div className="panel-list">
        {storyboard.panels.map((panel) => (
          <article className="panel-card" key={panel.panelNo}>
            <div className="panel-number">{String(panel.panelNo).padStart(2, "0")}</div>
            <div className="panel-content">
              <p className="panel-role">{roleLabels[panel.role]}</p>
              <h3>画面</h3>
              <p>{panel.visual}</p>
              <h3>动作</h3>
              <p>{panel.action}</p>
              <h3>对白 / 旁白</h3>
              <p>{panel.dialogueOrNarration}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="compliance-card" aria-labelledby="compliance-title">
        <h3 id="compliance-title">合规摘要</h3>
        <dl className="detail-list">
          <div>
            <dt>已覆盖必达结果</dt>
            <dd>{labelsFor(storyboard.compliance.fulfilledMustHaveIds, intent.mustHaves).join("；") || "无"}</dd>
          </div>
          <div>
            <dt>实际满足偏好</dt>
            <dd>{labelsFor(storyboard.compliance.fulfilledPreferenceIds, intent.preferences).join("；") || "无"}</dd>
          </div>
          <div>
            <dt>已尊重约束</dt>
            <dd>{labelsFor(storyboard.compliance.respectedConstraintIds, intent.constraints).join("；") || "无"}</dd>
          </div>
          <div>
            <dt>引用事实</dt>
            <dd>
              {storyboard.compliance.referencedFactIds
                .map((id) => canonFacts.find((fact) => fact.id === id)?.statement ?? id)
                .join("；") || "无"}
            </dd>
          </div>
          <div>
            <dt>使用假设</dt>
            <dd>
              {storyboard.compliance.assumptions
                .map((item) => assumptions.find((assumption) => assumption.id === item.id)?.text ?? item.text)
                .join("；") || "无"}
            </dd>
          </div>
        </dl>
        {storyboard.compliance.warnings.length ? (
          <div className="warning-note">
            <strong>提示</strong>
            <ul>
              {storyboard.compliance.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="form-actions split-actions">
        <button className="button button-quiet" type="button" onClick={onBackBranch}>
          返回候选分支
        </button>
        <button className="button button-secondary" type="button" onClick={onBackInput}>
          重新修改输入
        </button>
      </div>
    </section>
  );
}
