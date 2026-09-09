import type { StoryIntent } from "../lib/contracts";

export const demoStory: {
  workTitle: string;
  intent: StoryIntent;
} = {
  workTitle: "雨夜车站",
  intent: {
    plotContext: "雨夜车站，阿禾准备离开，岑川不知道她已替他承担责任。",
    regret: "他们没有在误会扩大前说出真相。",
    mustHaves: [
      { id: "demo-m1", text: "两人最终当面说清误会" },
    ],
    preferences: [
      { id: "demo-p1", text: "保留苦涩但有希望的余韵" },
    ],
    constraints: [
      { id: "demo-c1", text: "岑川在此时不知道阿禾承担责任" },
      { id: "demo-c2", text: "不能凭空出现新能力" },
    ],
    desiredTone: "克制、苦涩但有希望",
  },
};
