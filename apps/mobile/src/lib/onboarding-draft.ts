import type { AuthUser, Child, Circle, Curriculum, Location, School } from "@/lib/api";

type OnboardingDraft = {
  school: School | null;
  location: Location | null;
  locationLoaded: boolean;
  children: Child[] | null;
  curricula: Curriculum[] | null;
  circles: Circle[] | null;
  user: AuthUser | null;
};

const draft: OnboardingDraft = {
  school: null,
  location: null,
  locationLoaded: false,
  children: null,
  curricula: null,
  circles: null,
  user: null,
};

export function setOnboardingSchool(school: School | null): void {
  draft.school = school;
}

export function getOnboardingSchool(): School | null {
  return draft.school;
}

export function setOnboardingLocation(
  location: Location | null,
  options?: { loaded?: boolean }
): void {
  draft.location = location;
  draft.locationLoaded = options?.loaded ?? true;
}

export function getOnboardingLocation(): {
  location: Location | null;
  locationLoaded: boolean;
} {
  return {
    location: draft.location,
    locationLoaded: draft.locationLoaded,
  };
}

export function setOnboardingChildren(children: Child[]): void {
  draft.children = children;
}

export function getOnboardingChildren(): Child[] | null {
  return draft.children;
}

export function setOnboardingCurricula(curricula: Curriculum[]): void {
  draft.curricula = curricula;
}

export function getOnboardingCurricula(): Curriculum[] | null {
  return draft.curricula;
}

export function setOnboardingCircles(circles: Circle[]): void {
  draft.circles = circles;
}

export function getOnboardingCircles(): Circle[] | null {
  return draft.circles;
}

export function setOnboardingUser(user: AuthUser): void {
  draft.user = user;
}

export function getOnboardingUser(): AuthUser | null {
  return draft.user;
}

export function clearOnboardingDraft(): void {
  draft.school = null;
  draft.location = null;
  draft.locationLoaded = false;
  draft.children = null;
  draft.curricula = null;
  draft.circles = null;
  draft.user = null;
}
