import type { Circle } from "@/lib/api";

const circlePriority: Circle["circleType"][] = [
  "school_class",
  "class",
  "school",
  "community",
  "locality",
  "curriculum",
];

export function pickPrimaryCircle(circles: Circle[]): Circle | null {
  for (const type of circlePriority) {
    const match = circles.find((circle) => circle.circleType === type);
    if (match) return match;
  }
  return circles[0] ?? null;
}

export type ComposeMode = "photo" | "poll" | "recommendation" | "question";

export function composeParamsForMode(mode: ComposeMode) {
  switch (mode) {
    case "photo":
      return { compose: "photo" };
    case "poll":
      return { compose: "poll" };
    case "recommendation":
      return { compose: "recommendation", tag: "recommendation" };
    case "question":
      return { compose: "question", tag: "question" };
    default:
      return {};
  }
}
