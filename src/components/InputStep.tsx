import type { SessionDraft, StoryIntent } from "../lib/contracts.ts";
import { getInputReadiness } from "../lib/input-readiness.ts";

type InputStepProps = {
  workTitle: string;
  intent: SessionDraft;
  disabled: boolean;
  onWorkTitleChange: (value: string) => void;
  onIntentChange: (value: SessionDraft) => void;
  onLoadDemo: () => void;
  onSubmit: (value: StoryIntent) => void;
};

function nextId(prefix: string, items: Readonly<SessionDraft["mustHaves"]>) {
  let index = items.length + 1;
  while (items.some((item) => item.id === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function ListEditor({
  label,
  hint,
  prefix,
  itemPlaceholder,
  items,
  disabled,
  minimum,
  onChange,
}: {
  label: string;
  hint: string;
  prefix: string;
  itemPlaceholder?: string;
  items: SessionDraft["mustHaves"];
  disabled: boolean;
  minimum?: number;
  onChange: (items: SessionDraft["mustHaves"]) => void;
}) {
  return (
    <fieldset className="list-editor">
      <legend>{label}</legend>
      <p className="field-hint">{hint}</p>
      {items.map((item, index) => (
        <div className="repeat-row" key={item.id}>
          <label className="sr-only" htmlFor={`${prefix}-${item.id}`}>
            {label}第 {index + 1} 项
          </label>
          <input
            id={`${prefix}-${item.id}`}
            type="text"
            value={item.text}
            disabled={disabled}
            placeholder={itemPlaceholder ?? `${label}第 ${index + 1} 项`}
            onChange={(event) =>
              onChange(
                items.map((current) =>
                  current.id === item.id
                    ? { ...current, text: event.target.value }
                    : current,
                ),
              )
            }
          />
          <button
            className="icon-button"
            type="button"
            aria-label={`删除${label}第 ${index + 1} 项`}
            disabled={disabled || (minimum !== undefined && items.length <= minimum)}
            onClick={() => onChange(items.filter((current) => current.id !== item.id))}
          >
            删除
          </button>
        </div>
      ))}
      <button
        className="button button-quiet"
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([...items, { id: nextId(prefix, items), text: "" }])
        }
      >
        + 添加一项
      </button>
    </fieldset>
  );
}

export default function InputStep({
  workTitle,
  intent,
  disabled,
  onWorkTitleChange,
  onIntentChange,
  onLoadDemo,
  onSubmit,
}: InputStepProps) {
  const readiness = getInputReadiness(intent);

  const setField = <K extends keyof SessionDraft>(
    key: K,
    value: SessionDraft[K],
  ) => onIntentChange({ ...intent, [key]: value });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      plotContext: intent.plotContext,
      regret: intent.regret,
      mustHaves: intent.mustHaves,
      preferences: intent.preferences,
      constraints: intent.constraints,
      ...(intent.desiredTone ? { desiredTone: intent.desiredTone } : {}),
    });
  };

  return (
    <form className="step-card" onSubmit={submit}>
      <div className="step-heading">
        <div>
          <p className="section-kicker">01 / 写下遗憾</p>
          <h2>先把你不愿意妥协的部分说清楚</h2>
        </div>
        <button className="button button-quiet" type="button" disabled={disabled} onClick={onLoadDemo}>
          载入自创示例
        </button>
      </div>

      <aside className="input-guide" aria-labelledby="input-guide-title">
        <p className="section-kicker">开始分析前的最低标准</p>
        <h3 id="input-guide-title">先说清三件事</h3>
        <ol>
          <li>
            <strong>故事背景：</strong>通常 2—4 句，让人看懂关键人物、当前冲突或阶段，以及原本发生的结果。
          </li>
          <li>
            <strong>遗憾及原因：</strong>通常 1—3 句，说明哪个结果不能接受，以及为什么不合理或不满足。
          </li>
          <li>
            <strong>IF 线必须实现的结果：</strong>至少一条具体、可判断“实现了/没实现”的结果；它和遗憾不是同一件事。
          </li>
        </ol>
        <p className="field-hint">
          这里没有字符数硬门槛，以上句数只是帮助你组织表达。偏好、不能破坏的约束和余韵都可留空，约束也没有条数上限。通过最低检查只代表可以开始分析，不代表信息已经完整；后续缺口会由 AI 用 1—3 个问题补齐。
        </p>
      </aside>

      <label className="field-label" htmlFor="work-title">
        作品或场景名 <span className="optional">可选</span>
      </label>
      <input
        id="work-title"
        type="text"
        value={workTitle}
        disabled={disabled}
        placeholder="例如：雨夜车站"
        onChange={(event) => onWorkTitleChange(event.target.value)}
      />
      <p className="field-hint">仅用于本页展示，不会发送给模型接口。</p>

      <label className="field-label" htmlFor="plot-context">
        故事背景 <span className="required">必填</span>
      </label>
      <textarea
        id="plot-context"
        value={intent.plotContext}
        disabled={disabled}
        rows={4}
        placeholder="交代人物、时间、地点，以及故事走到哪里。"
        onChange={(event) => setField("plotContext", event.target.value)}
      />
      <p className="field-hint">通常写 2—4 句：关键人物、当前冲突/阶段、原本发生的结果。</p>

      <label className="field-label" htmlFor="regret">
        遗憾及原因 <span className="required">必填</span>
      </label>
      <textarea
        id="regret"
        value={intent.regret}
        disabled={disabled}
        rows={3}
        placeholder="例如：误会没有被当场说开，导致两人错过；这个结果不合理，因为双方当时都有机会确认真相。"
        onChange={(event) => setField("regret", event.target.value)}
      />
      <p className="field-hint">通常写 1—3 句：哪个结果不能接受，以及为什么不合理/不满足。</p>

      <ListEditor
        label="IF 线必须实现的结果"
        hint="至少写一条可验证的具体结果；例如“导师在这场战斗后仍然活着”。它不是对遗憾的重复描述。"
        prefix="must-have"
        itemPlaceholder="例如：导师在这场战斗后仍然活着"
        items={intent.mustHaves}
        minimum={1}
        disabled={disabled}
        onChange={(items) => setField("mustHaves", items)}
      />
      <ListEditor
        label="偏好"
        hint="可留空；只作为软目标，不会被伪装成硬约束。"
        prefix="preference"
        items={intent.preferences}
        disabled={disabled}
        onChange={(items) => setField("preferences", items)}
      />
      <ListEditor
        label="不能破坏的约束"
        hint="可留空。没有数量上限，请逐条写出不能发生的事。"
        prefix="constraint"
        items={intent.constraints}
        disabled={disabled}
        onChange={(items) => setField("constraints", items)}
      />

      <label className="field-label" htmlFor="desired-tone">
        希望的余韵 <span className="optional">可选</span>
      </label>
      <input
        id="desired-tone"
        type="text"
        value={intent.desiredTone}
        disabled={disabled}
        placeholder="例如：克制、苦涩但有希望"
        onChange={(event) => setField("desiredTone", event.target.value)}
      />

      <section className="readiness-panel" aria-labelledby="readiness-title" aria-live="polite">
        <div className="readiness-heading">
          <div>
            <p className="section-kicker">提交前检查</p>
            <h3 id="readiness-title">达到最低标准即可开始分析</h3>
          </div>
          <span className={readiness.ready ? "clean-badge" : "dirty-badge"}>
            {readiness.ready ? "可以开始" : "还需补充"}
          </span>
        </div>
        <ul className="readiness-list">
          {([
            ["故事背景", readiness.plotContext],
            ["遗憾及原因", readiness.regret],
            ["IF 线必须实现的结果", readiness.mustHaves],
          ] as const).map(([label, filled]) => (
            <li className={filled ? "readiness-item ready" : "readiness-item"} key={label}>
              <span aria-hidden="true">{filled ? "✓" : "○"}</span>
              <span>{label}：{filled ? "已填写" : "待补充"}</span>
            </li>
          ))}
        </ul>
        {readiness.missing.length > 0 ? (
          <p className="readiness-missing">还需补充：{readiness.missing.join("、")}。</p>
        ) : null}
      </section>

      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={disabled || !readiness.ready}>
          开始理解这段遗憾
        </button>
      </div>
    </form>
  );
}
