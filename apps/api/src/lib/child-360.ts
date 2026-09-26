/** Child 360 helpers — grade bands and row mappers. See docs/CHILD_360.md. */

export type Child360Track = "school" | "preschool";

export type Child360RightBand =
  | "interests"
  | "enjoy"
  | "pathway_lean"
  | "opportunities";

const PRESCHOOL_SETTINGS = new Set([
  "preschool",
  "outside_class",
  "at_home",
]);
const SCHOOL_SETTINGS = new Set(["school", "academy", "casual"]);
const HEALTH_LABELS = new Set([
  "allergy",
  "doctor",
  "vision",
  "dental",
  "sleep",
  "other",
]);
const ACTIVITY_STATUSES = new Set(["active", "paused"]);
const PLAN_STATUSES = new Set(["exploring", "planning", "this_season"]);
const PATHWAY_LEANS = new Set([
  "pcm",
  "pcb",
  "commerce",
  "arts",
  "not_sure",
]);

export function parseGradeNumber(code: string | null | undefined): number | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (/^(NURSERY|LKG|UKG|K)$/i.test(trimmed)) return 0;
  const match = trimmed.match(/^[GY](\d+)$/i);
  if (match) return Number(match[1]);
  return null;
}

export function rightBandForChild(
  track: Child360Track,
  gradeCode: string | null | undefined
): Child360RightBand {
  if (track === "preschool") return "interests";
  const n = parseGradeNumber(gradeCode);
  if (n == null || n <= 5) return "interests";
  if (n <= 8) return "enjoy";
  if (n <= 10) return "pathway_lean";
  return "opportunities";
}

export function allowedActivitySettings(track: Child360Track): string[] {
  return track === "preschool"
    ? [...PRESCHOOL_SETTINGS]
    : [...SCHOOL_SETTINGS];
}

export function isValidActivitySetting(
  track: Child360Track,
  setting: string
): boolean {
  return (
    track === "preschool"
      ? PRESCHOOL_SETTINGS
      : SCHOOL_SETTINGS
  ).has(setting);
}

export function isValidHealthLabel(label: string): boolean {
  return HEALTH_LABELS.has(label);
}

export function isValidActivityStatus(status: string): boolean {
  return ACTIVITY_STATUSES.has(status);
}

export function isValidPlanStatus(status: string): boolean {
  return PLAN_STATUSES.has(status);
}

export function isValidPathwayLean(value: string): boolean {
  return PATHWAY_LEANS.has(value);
}

export function mapActivity(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    name: row.name as string,
    setting: row.setting as string,
    howOften: (row.how_often as string | null) ?? null,
    status: row.status as string,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export function mapHealthNote(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    label: row.label as string,
    body: row.body as string,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export function mapOpportunityPlan(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    opportunitySlug: row.opportunity_slug as string,
    status: row.status as string,
    targetYear:
      row.target_year == null ? null : Number(row.target_year),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export type OwnedChildRow = {
  id: string;
  track: Child360Track;
  grade_code: string | null;
  pathway_lean: string | null;
  nickname: string | null;
  age_years: number | null;
  curriculum_code: string | null;
  curriculum_name: string | null;
  grade_label: string | null;
  school_name: string | null;
  school_branch: string | null;
  school_city: string | null;
};

export async function loadOwnedChild(
  client: import("pg").PoolClient,
  userId: string,
  childId: string
): Promise<OwnedChildRow | null> {
  const { rows } = await client.query(
    `SELECT ch.id, ch.track, ch.pathway_lean, ch.nickname, ch.age_years,
            g.code AS grade_code, g.label AS grade_label,
            cur.code AS curriculum_code, cur.name AS curriculum_name,
            s.name AS school_name, s.branch AS school_branch, s.city AS school_city
     FROM children ch
     LEFT JOIN curricula cur ON cur.id = ch.curriculum_id
     LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
     JOIN schools s ON s.id = ch.school_id
     WHERE ch.id = $1 AND ch.user_id = $2`,
    [childId, userId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    track: row.track === "preschool" ? "preschool" : "school",
    grade_code: row.grade_code ?? null,
    pathway_lean: row.pathway_lean ?? null,
    nickname: row.nickname ?? null,
    age_years: row.age_years == null ? null : Number(row.age_years),
    curriculum_code: row.curriculum_code ?? null,
    curriculum_name: row.curriculum_name ?? null,
    grade_label: row.grade_label ?? null,
    school_name: row.school_name ?? null,
    school_branch: row.school_branch ?? null,
    school_city: row.school_city ?? null,
  };
}
