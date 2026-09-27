/** Pure catalogue matching helpers. Catalogue size is small; ranking stays in process. */

export type RegistrationSchedule = {
  scheduleType: string;
  startsOn: string | null;
  endsOn: string | null;
  dateStatus: string;
};

export function eligibilityCoversGrade(
  text: string | null | undefined,
  grade: number | null
): boolean {
  if (grade == null || !text) return false;
  const ranges = [...text.matchAll(/classes?\s*(\d+)\s*[–—-]\s*(\d+)/gi)];
  if (ranges.length > 0) {
    return ranges.some((m) => {
      const a = Number(m[1]);
      const b = Number(m[2]);
      return grade >= Math.min(a, b) && grade <= Math.max(a, b);
    });
  }
  const singles = [...text.matchAll(/class(?:es)?\s*(\d+)/gi)];
  return singles.some((m) => Number(m[1]) === grade);
}

export function scopeMatchesSchool(
  scopeLevel: string | null | undefined,
  schoolState: string | null | undefined,
  editionState: string | null | undefined
): boolean {
  const scope = scopeLevel || "unknown";
  if (scope !== "state") return true;
  const school = (schoolState || "").trim().toLowerCase();
  const edition = (editionState || "").trim().toLowerCase();
  if (!school || !edition) return true;
  return school === edition || school.includes(edition) || edition.includes(school);
}

export function deriveRegistrationState(input: {
  eventStatus: string | null;
  registrationMethod: string | null;
  schedules: RegistrationSchedule[];
  now?: Date;
}): string {
  const event = input.eventStatus || "unknown";
  if (event === "cancelled") return "cancelled";
  if (event === "completed") return "closed";
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const windows = input.schedules.filter(
    (row) =>
      row.scheduleType === "registration" &&
      row.dateStatus !== "unannounced" &&
      row.dateStatus !== "unknown"
  );
  if (windows.length === 0) {
    return input.registrationMethod === "through_school"
      ? "check_with_school"
      : "dates_unannounced";
  }
  let open = false;
  let future = false;
  let provedClosed = 0;
  for (const row of windows) {
    if (row.endsOn && row.endsOn < today) {
      provedClosed += 1;
      continue;
    }
    if (row.startsOn && row.startsOn > today) {
      future = true;
      continue;
    }
    if (row.startsOn || row.endsOn) open = true;
  }
  if (open) return "open";
  if (future) return "opening_soon";
  if (provedClosed === windows.length) return "closed";
  if (input.registrationMethod === "through_school") return "check_with_school";
  return "unknown";
}

export function gradeCheck(
  eligibility: string | null | undefined,
  grade: number | null
): "pass" | "fail" | "unknown" {
  if (grade == null || !eligibility) return "unknown";
  if (!/class/i.test(eligibility)) return "unknown";
  return eligibilityCoversGrade(eligibility, grade) ? "pass" : "fail";
}

export type EligibilitySummary =
  | "known_requirements_match"
  | "does_not_match"
  | "needs_confirmation";

export function evaluateEligibility(input: {
  eligibilityText: string | null | undefined;
  grade: number | null;
  scopeLevel: string | null | undefined;
  schoolState: string | null | undefined;
  editionState: string | null | undefined;
  curriculumPolicy: string | null | undefined;
}): {
  grade: "pass" | "fail" | "unknown";
  geography: "pass" | "fail" | "unknown";
  curriculum: "pass" | "fail" | "unknown";
  summary: EligibilitySummary;
  copy: string;
} {
  const grade = gradeCheck(input.eligibilityText, input.grade);
  const scope = input.scopeLevel || "unknown";
  let geography: "pass" | "fail" | "unknown" = "unknown";
  if (scope === "national" || scope === "international") geography = "pass";
  else if (scope === "state") {
    const school = (input.schoolState || "").trim().toLowerCase();
    const edition = (input.editionState || "").trim().toLowerCase();
    if (school && edition) {
      geography = scopeMatchesSchool(scope, school, edition) ? "pass" : "fail";
    }
  }
  const policy = input.curriculumPolicy || "unknown";
  const curriculum = policy === "all" ? "pass" : "unknown";
  const results = [grade, geography, curriculum];
  let summary: EligibilitySummary = "needs_confirmation";
  if (results.includes("fail")) summary = "does_not_match";
  else if (results.every((item) => item === "pass")) summary = "known_requirements_match";
  const copy =
    summary === "does_not_match"
      ? "A requirement does not match"
      : summary === "known_requirements_match"
        ? "Matches the requirements we could check"
        : "Check these requirements";
  return { grade, geography, curriculum, summary, copy };
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

export function searchScore(
  query: string | null | undefined,
  fields: { title: string; organizer: string | null; editionLabel: string | null }
): number {
  const q = (query || "").trim().toLowerCase();
  if (!q) return 1;
  const title = fields.title.toLowerCase();
  const organizer = (fields.organizer || "").toLowerCase();
  const edition = (fields.editionLabel || "").toLowerCase();
  const hay = `${title} ${organizer} ${edition}`;
  if (title === q) return 100;
  if (title.startsWith(q)) return 90;
  if (title.includes(q)) return 80;
  if (organizer.includes(q)) return 60;
  if (edition.includes(q)) return 50;
  let score = 0;
  for (const token of q.split(/\s+/).filter((part) => part.length >= 2)) {
    if (hay.includes(token)) {
      score += 20;
      continue;
    }
    const near = hay.split(/[^a-z0-9]+/).some((word) => {
      if (word.length < 4 || token.length < 4) return false;
      return levenshtein(word, token) <= 1;
    });
    if (near) score += 12;
  }
  return score;
}
