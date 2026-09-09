import type { SessionDraft, StoryIntent } from "../lib/contracts.ts";

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
  items,
  disabled,
  minimum,
  onChange,
}: {
  label: string;
  hint: string;
  prefix: string;
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
            placeholder={`${label}第 ${index + 1} 项`}
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

      <label className="field-label" htmlFor="regret">
        最遗憾的瞬间 <span className="required">必填</span>
      </label>
      <textarea
        id="regret"
        value={intent.regret}
        disabled={disabled}
        rows={3}
        placeholder="如果当时多做一件事，你希望改变什么？"
        onChange={(event) => setField("regret", event.target.value)}
      />

      <ListEditor
        label="必须保留的结果"
        hint="至少写一条。它们是故事不可失去的落点。"
        prefix="must-have"
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

      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={disabled}>
          开始理解这段遗憾
        </button>
      </div>
    </form>
  );
}
