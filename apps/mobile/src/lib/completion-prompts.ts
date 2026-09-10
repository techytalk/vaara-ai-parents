import * as SecureStore from "expo-secure-store";
import type { Child, Circle } from "@/lib/api";
import { isPlaceholderSchool } from "@/constants/circles";
import { hasCompletedAppTour } from "@/lib/app-tour";

const DISMISSALS_KEY = "vaara_completion_prompt_dismissals";

const BACKOFF_MS = [
  7 * 24 * 60 * 60 * 1000, // first dismiss → 7 days
  30 * 24 * 60 * 60 * 1000, // second dismiss → 30 days
] as const;

export type CompletionPromptKind =
  | "missing_school"
  | "missing_nickname"
  | "missing_area"
  | "missing_community"
  | "add_another_child";

export type CompletionPromptCandidate = {
  kind: CompletionPromptKind;
  /** Stable id used for dismissal backoff. */
  key: string;
  cta: string;
  childId?: string;
};

type DismissalEntry = {
  count: number;
  lastDismissedAt: number;
};

type DismissalMap = Record<string, DismissalEntry>;

const KIND_PRIORITY: CompletionPromptKind[] = [
  "missing_school",
  "missing_nickname",
  "missing_area",
  "missing_community",
  "add_another_child",
];

/**
 * All profile gaps currently true for this parent (no dismissal filtering).
 * Circles placeholders and the home banner both derive from this list.
 */
export function evaluateCompletionGaps(input: {
  children: Child[];
  circles: Circle[];
}): CompletionPromptCandidate[] {
  const { children, circles } = input;
  const candidates: CompletionPromptCandidate[] = [];

  for (const child of children) {
    if (isPlaceholderSchool(child.school)) {
      candidates.push({
        kind: "missing_school",
        key: `missing_school:${child.id}`,
        childId: child.id,
        cta: `Add school for ${child.nickname?.trim() || "your child"}`,
      });
    }
  }

  for (const child of children) {
    if (!child.nickname?.trim()) {
      candidates.push({
        kind: "missing_nickname",
        key: `missing_nickname:${child.id}`,
        childId: child.id,
        cta: child.grade?.label
          ? `Add a private nickname for your ${child.grade.label} child`
          : "Add a private nickname for your child",
      });
    }
  }

  if (!circles.some((c) => c.circleType === "locality")) {
    candidates.push({
      kind: "missing_area",
      key: "missing_area",
      cta: "Add your pin code and area",
    });
  }

  if (!circles.some((c) => c.circleType === "community")) {
    candidates.push({
      kind: "missing_community",
      key: "missing_community",
      cta: "Add your apartment or community",
    });
  }

  if (children.length === 1) {
    candidates.push({
      kind: "add_another_child",
      key: "add_another_child",
      cta: "Have another child? Add them to join their circles too",
    });
  }

  return candidates;
}

/** Circles tab: school / area / community only (existing surface). */
export function circlePlaceholderCandidates(
  gaps: CompletionPromptCandidate[]
): CompletionPromptCandidate[] {
  return gaps.filter(
    (item) =>
      item.kind === "missing_school" ||
      item.kind === "missing_area" ||
      item.kind === "missing_community"
  );
}

function isSuppressed(entry: DismissalEntry | undefined, now: number): boolean {
  if (!entry) return false;
  if (entry.count >= BACKOFF_MS.length + 1) return true; // stopped
  const backoff = BACKOFF_MS[entry.count - 1];
  if (backoff == null) return true;
  return now - entry.lastDismissedAt < backoff;
}

async function loadDismissals(): Promise<DismissalMap> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISSALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissalMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveDismissals(map: DismissalMap): Promise<void> {
  await SecureStore.setItemAsync(DISMISSALS_KEY, JSON.stringify(map));
}

/**
 * Highest-priority gap that is not in backoff, and only after the app tour.
 * Returns null during / before the tour so it owns the first session.
 */
export async function pickActiveCompletionPrompt(
  gaps: CompletionPromptCandidate[],
  now = Date.now()
): Promise<CompletionPromptCandidate | null> {
  if (!(await hasCompletedAppTour())) return null;

  const dismissals = await loadDismissals();
  const sorted = [...gaps].sort(
    (a, b) => KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind)
  );

  for (const candidate of sorted) {
    if (!isSuppressed(dismissals[candidate.key], now)) {
      return candidate;
    }
  }
  return null;
}

export async function dismissCompletionPrompt(
  key: string
): Promise<{ count: number }> {
  const dismissals = await loadDismissals();
  const prev = dismissals[key];
  const next: DismissalEntry = {
    count: (prev?.count ?? 0) + 1,
    lastDismissedAt: Date.now(),
  };
  dismissals[key] = next;
  await saveDismissals(dismissals);
  return { count: next.count };
}

export function hrefForCompletionPrompt(
  prompt: CompletionPromptCandidate
):
  | { pathname: "/onboarding/location" }
  | {
      pathname: "/onboarding/children/add";
      params: { from: "prompt" };
    }
  | {
      pathname: "/onboarding/children/edit/[id]";
      params: { id: string; focus?: "identity" };
    }
  | { pathname: "/onboarding/children" } {
  switch (prompt.kind) {
    case "missing_area":
    case "missing_community":
      return { pathname: "/onboarding/location" };
    case "add_another_child":
      // `from` sends the parent back to the app after saving, since they never
      // asked to visit the children list.
      return {
        pathname: "/onboarding/children/add",
        params: { from: "prompt" },
      };
    case "missing_school":
    case "missing_nickname":
      if (prompt.childId) {
        return {
          pathname: "/onboarding/children/edit/[id]",
          params: {
            id: prompt.childId,
            // Open on the field the prompt asked for.
            ...(prompt.kind === "missing_nickname"
              ? { focus: "identity" as const }
              : {}),
          },
        };
      }
      return { pathname: "/onboarding/children" };
    default:
      return { pathname: "/onboarding/children" };
  }
}
