/** Labels for multi-child chips (Child's Path, etc.). */

export type ChildSwitcherFields = {
  nickname: string | null;
  curriculumCode: string | null;
  curriculumName: string | null;
  gradeLabel: string | null;
  ageYears?: number | null;
  track?: "school" | "preschool" | string;
};

export function boardShortLabel(child: ChildSwitcherFields): string {
  const code = child.curriculumCode?.trim();
  if (code === "IB_MYP") return "IB MYP";
  if (code === "IB_PYP") return "IB PYP";
  if (code === "IBDP") return "IB DP";
  if (code === "IGCSE") return "Cambridge";
  if (code === "CBSE") return "CBSE";
  if (code === "SSC") return "SSC";
  return child.curriculumName?.trim() || code || "School";
}

function curriculumGradePart(child: ChildSwitcherFields): string {
  if (child.track === "preschool" && child.ageYears != null) {
    return `${child.ageYears} years`;
  }
  const grade = child.gradeLabel?.trim() || "grade";
  return `${boardShortLabel(child)}-${grade}`;
}

function fallbackChildName(child: ChildSwitcherFields, index: number): string {
  if (child.track === "preschool" && child.ageYears != null) {
    return `Child ${index + 1}`;
  }
  return `Child ${index + 1}`;
}

/** e.g. Anirudh - IB MYP-Grade 9 or Child 2 - CBSE-Grade 10 */
export function childSwitcherTabLabel(
  child: ChildSwitcherFields,
  index: number
): string {
  const suffix = curriculumGradePart(child);
  const nick = child.nickname?.trim();
  if (nick) return `${nick} - ${suffix}`;
  return `${fallbackChildName(child, index)} - ${suffix}`;
}
