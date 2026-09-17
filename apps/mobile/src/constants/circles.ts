import type { Circle } from "@/lib/api";

export const PLACEHOLDER_SCHOOL_KEY = "school_not_specified||unknown";

export const CIRCLE_TYPE_LABELS: Record<Circle["circleType"], string> = {
  curriculum: "Curriculum",
  locality: "Pincode / Area",
  class: "Class",
  school: "School",
  school_class: "School class",
  school_age: "School · age",
  age_locality: "Age · area",
  community: "Community",
};

export function isPlaceholderSchool(school: {
  name: string;
  normalizedKey?: string;
}): boolean {
  return (
    school.normalizedKey === PLACEHOLDER_SCHOOL_KEY ||
    school.name === "School not specified"
  );
}
