export type InputTextItem = {
  text: string;
};

export type InputDraftFields = {
  plotContext: string;
  regret: string;
  mustHaves: readonly InputTextItem[];
  preferences: readonly InputTextItem[];
  constraints: readonly InputTextItem[];
};

export type InputReadiness = {
  plotContext: boolean;
  regret: boolean;
  mustHaves: boolean;
  ready: boolean;
  missing: string[];
};

/** Blank repeatable rows are drafts, not user requirements. */
export function stripBlankItems<T extends InputTextItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.text.trim().length > 0);
}

/**
 * This is deliberately structural rather than semantic: the model remains
 * responsible for judging whether the story is sufficiently understood.
 */
export function getInputReadiness(input: InputDraftFields): InputReadiness {
  const plotContext = input.plotContext.trim().length > 0;
  const regret = input.regret.trim().length > 0;
  const mustHaves = stripBlankItems(input.mustHaves).length > 0;
  const missing = [
    ...(plotContext ? [] : ["故事背景"]),
    ...(regret ? [] : ["遗憾及原因"]),
    ...(mustHaves ? [] : ["至少一条 IF 线必须实现的结果"]),
  ];

  return {
    plotContext,
    regret,
    mustHaves,
    ready: missing.length === 0,
    missing,
  };
}
