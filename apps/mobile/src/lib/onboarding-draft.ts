import type { School } from "@/lib/api";

let selectedSchool: School | null = null;

export function setOnboardingSchool(school: School | null): void {
  selectedSchool = school;
}

export function getOnboardingSchool(): School | null {
  return selectedSchool;
}

export function clearOnboardingDraft(): void {
  selectedSchool = null;
}
