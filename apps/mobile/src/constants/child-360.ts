/** Child 360 UI constants and helpers. See docs/CHILD_360.md. */

export type Child360RightBand =
  | "interests"
  | "enjoy"
  | "pathway_lean"
  | "opportunities";

export function parseGradeNumber(code: string | null | undefined): number | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (/^(NURSERY|LKG|UKG|K)$/i.test(trimmed)) return 0;
  const match = trimmed.match(/^[GY](\d+)$/i);
  if (match) return Number(match[1]);
  return null;
}

export function rightBandForChild(
  track: "school" | "preschool",
  gradeCode: string | null | undefined
): Child360RightBand {
  if (track === "preschool") return "interests";
  const n = parseGradeNumber(gradeCode);
  if (n == null || n <= 5) return "interests";
  if (n <= 8) return "enjoy";
  if (n <= 10) return "pathway_lean";
  return "opportunities";
}

export const PRESCHOOL_INTEREST_CHIPS = [
  "Stories",
  "Music",
  "Drawing",
  "Art",
  "Dance",
  "Nature",
  "Numbers",
  "Building",
  "Pretend play",
  "Movement",
  "Reading",
  "Crafts",
  "Animals",
  "Outdoor play",
  "Singing",
  "Puzzles",
] as const;

export const ENJOY_INTEREST_CHIPS = [
  "Maths",
  "Biology",
  "Design",
  "Business",
  "Sport",
  "Languages",
  "Coding",
  "Performing arts",
  "Art",
  "Science",
  "History",
  "Music",
] as const;

export const PATHWAY_LEAN_OPTIONS = [
  { value: "pcm", label: "PCM" },
  { value: "pcb", label: "PCB" },
  { value: "commerce", label: "Commerce" },
  { value: "arts", label: "Arts / Humanities" },
  { value: "not_sure", label: "Not sure yet" },
] as const;

export const HEALTH_LABEL_OPTIONS = [
  { value: "allergy", label: "Allergy" },
  { value: "vision", label: "Vision" },
  { value: "sleep", label: "Sleep" },
  { value: "dental", label: "Dental" },
  { value: "doctor", label: "Doctor" },
  { value: "other", label: "Other" },
] as const;

export const PRESCHOOL_SETTINGS = [
  { value: "preschool", label: "Preschool" },
  { value: "outside_class", label: "Outside class" },
  { value: "at_home", label: "At home" },
] as const;

export const SCHOOL_SETTINGS = [
  { value: "school", label: "School" },
  { value: "academy", label: "Academy" },
  { value: "casual", label: "Casual" },
] as const;

export const PLAN_STATUS_OPTIONS = [
  { value: "exploring", label: "Exploring" },
  { value: "planning", label: "Planning" },
  { value: "this_season", label: "This season" },
] as const;

export function healthLabelDisplay(label: string): string {
  return (
    HEALTH_LABEL_OPTIONS.find((o) => o.value === label)?.label ?? label
  );
}

export function settingDisplay(
  setting: string,
  track: "school" | "preschool"
): string {
  const list = track === "preschool" ? PRESCHOOL_SETTINGS : SCHOOL_SETTINGS;
  return list.find((o) => o.value === setting)?.label ?? setting;
}

export function pathwayLeanDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  return PATHWAY_LEAN_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function childHeadline(child: {
  nickname: string | null;
  track: "school" | "preschool";
  ageYears: number | null;
  curriculum: { name: string | null } | null;
  grade: { label: string | null } | null;
  school: { displayLabel: string };
}): string {
  const name = child.nickname?.trim();
  const bits: string[] = [];
  if (name) bits.push(name);
  if (child.track === "preschool" && child.ageYears) {
    bits.push(`${child.ageYears} years`);
  } else if (child.curriculum?.name && child.grade?.label) {
    bits.push(`${child.curriculum.name} · ${child.grade.label}`);
  }
  bits.push(child.school.displayLabel);
  return bits.join(" · ");
}

export function centreName(child: {
  nickname: string | null;
  grade: { label: string | null } | null;
  ageYears: number | null;
  track: "school" | "preschool";
}): { title: string; subtitle: string } {
  const nick = child.nickname?.trim();
  const title = (nick || "Child").toUpperCase();
  if (child.track === "preschool" && child.ageYears) {
    return { title, subtitle: `${child.ageYears} years` };
  }
  return {
    title,
    subtitle: child.grade?.label ?? "School",
  };
}
