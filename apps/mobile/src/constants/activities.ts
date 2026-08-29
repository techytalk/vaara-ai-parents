import type { ActivityCategory } from "@/lib/api";

export const ACTIVITY_CATEGORY_OPTIONS: Array<{
  value: ActivityCategory;
  label: string;
}> = [
  { value: "tutoring", label: "Tutoring" },
  { value: "coaching", label: "Coaching" },
  { value: "classes", label: "Classes" },
  { value: "arts", label: "Arts" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
];

export function defaultCategoryForProvider(
  providerType?: string
): ActivityCategory {
  if (providerType === "teacher") return "tutoring";
  if (providerType === "trainer") return "coaching";
  return "classes";
}
