export type TimelineMode = "off" | "shadow" | "on";

function parseMode(raw: string | undefined, fallback: TimelineMode): TimelineMode {
  const value = (raw ?? fallback).trim().toLowerCase();
  if (value === "1" || value === "on" || value === "true") return "on";
  if (value === "shadow") return "shadow";
  return "off";
}

export function resolveTimelineMode(raw: string | undefined): TimelineMode {
  return parseMode(raw, "off");
}

export function resolveFreshnessFlag(raw: string | undefined): boolean {
  const value = (raw ?? "0").trim().toLowerCase();
  return value === "1" || value === "on" || value === "true";
}

export function circleTimelineMode(): TimelineMode {
  return resolveTimelineMode(process.env.CIRCLE_TIMELINE);
}

export function homeTimelineMode(): TimelineMode {
  return resolveTimelineMode(process.env.HOME_FEED_TIMELINE);
}

export function homeFeedFreshnessEnabled(): boolean {
  return resolveFreshnessFlag(process.env.HOME_FEED_FRESHNESS);
}
