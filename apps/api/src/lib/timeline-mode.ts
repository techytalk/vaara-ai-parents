export type TimelineMode = "off" | "shadow" | "on";

function parseMode(raw: string | undefined, fallback: TimelineMode): TimelineMode {
  const value = (raw ?? fallback).trim().toLowerCase();
  if (value === "1" || value === "on" || value === "true") return "on";
  if (value === "shadow") return "shadow";
  return "off";
}

export function circleTimelineMode(): TimelineMode {
  return parseMode(process.env.CIRCLE_TIMELINE, "on");
}

export function homeTimelineMode(): TimelineMode {
  return parseMode(process.env.HOME_FEED_TIMELINE, "on");
}
