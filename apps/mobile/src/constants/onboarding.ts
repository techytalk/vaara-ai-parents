import type { Child, Curriculum } from "@/lib/api";

export const GENDERS = [
  { value: "boy", label: "Boy" },
  { value: "girl", label: "Girl" },
  { value: "other", label: "Other" },
  { value: "unspecified", label: "Prefer not to say" },
] as const;

export const GENDER_LABEL: Record<string, string> = {
  boy: "Boy",
  girl: "Girl",
  other: "Other",
  unspecified: "Prefer not to say",
};

/** Prefer CBSE (full K–12) as default; avoids IB PYP (only up to grade 5). */
export function pickDefaultCurriculum(curricula: Curriculum[]): Curriculum | null {
  if (curricula.length === 0) return null;
  const cbse = curricula.find((c) => c.code === "CBSE");
  if (cbse) return cbse;
  const with12 = curricula.find((c) =>
    c.grades.some((g) => g.code === "G12" || g.label.includes("12"))
  );
  return with12 ?? curricula[0];
}

export function sortCurricula(curricula: Curriculum[]): Curriculum[] {
  const order = ["CBSE", "SSC", "IGCSE", "IBDP", "IB_MYP", "IB_PYP"];
  return [...curricula].sort((a, b) => {
    const ai = order.indexOf(a.code);
    const bi = order.indexOf(b.code);
    if (ai === -1 && bi === -1) return a.code.localeCompare(b.code);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** Match curriculum + grade from saved child against latest reference data. */
export function resolveChildFormState(
  child: Child,
  curricula: Curriculum[]
): { curriculumId: string; gradeId: string | null } | null {
  const curriculum =
    curricula.find((c) => c.id === child.curriculumId) ??
    curricula.find((c) => c.code === child.curriculum.code);
  if (!curriculum) return null;

  const grade =
    curriculum.grades.find((g) => g.id === child.gradeId) ??
    curriculum.grades.find((g) => g.code === child.grade.code);

  return {
    curriculumId: curriculum.id,
    gradeId: grade?.id ?? curriculum.grades[0]?.id ?? null,
  };
}

/** When switching curriculum, keep the same grade code when possible (e.g. G8 → G8). */
export function pickGradeForCurriculum(
  curricula: Curriculum[],
  fromCurriculumId: string | null,
  fromGradeId: string | null,
  toCurriculumId: string
): string | null {
  const toCur = curricula.find((c) => c.id === toCurriculumId);
  if (!toCur || toCur.grades.length === 0) return null;

  const fromCur = curricula.find((c) => c.id === fromCurriculumId);
  const fromGrade = fromCur?.grades.find((g) => g.id === fromGradeId);
  if (fromGrade) {
    const sameCode = toCur.grades.find((g) => g.code === fromGrade.code);
    if (sameCode) return sameCode.id;
  }

  return toCur.grades[0]?.id ?? null;
}

/** True if curriculum only offers classes up to ~grade 5 (IB PYP, etc.). */
export function isLimitedCurriculum(curriculum: Curriculum): boolean {
  const hasG12 = curriculum.grades.some(
    (g) => g.code === "G12" || /grade\s*12/i.test(g.label)
  );
  return !hasG12 && curriculum.grades.length <= 8;
}

export function curriculumChipLabel(curriculum: Curriculum): string {
  const hasG12 = curriculum.grades.some((g) => g.code === "G12");
  if (hasG12) return `${curriculum.code} · K–12`;
  if (curriculum.code === "IB_MYP") return `${curriculum.code} · G6–10`;
  if (curriculum.code === "IB_PYP") return `${curriculum.code} · K–5`;
  return curriculum.code;
}
