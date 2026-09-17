import * as SecureStore from "expo-secure-store";
import type { AuthUser, Child, Circle, Curriculum, Location, School } from "@/lib/api";

const DRAFT_KEY = "vaara_onboarding_draft_v1";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DRAFT_VERSION = 3;

type PersistedDraft = {
  version: number;
  savedAt: number;
  onboardingAttemptId: string;
  step?: "location" | "school" | "age" | "class" | "ready";
  track?: "preschool" | "school";
  ageYears?: 3 | 4;
  countryCode?: string;
  pinCode?: string;
  locality?: string;
  schoolId?: string;
  school?: School | null;
  curriculumId?: string;
  gradeId?: string;
  catalogueGeneration?: number;
};

type OnboardingDraft = {
  school: School | null;
  location: Location | null;
  locationLoaded: boolean;
  children: Child[] | null;
  curricula: Curriculum[] | null;
  circles: Circle[] | null;
  user: AuthUser | null;
  onboardingAttemptId: string | null;
  step: PersistedDraft["step"] | null;
  track: "preschool" | "school" | null;
  ageYears: 3 | 4 | null;
  catalogueGeneration: number | null;
  curriculumId: string | null;
  gradeId: string | null;
};

const draft: OnboardingDraft = {
  school: null,
  location: null,
  locationLoaded: false,
  children: null,
  curricula: null,
  circles: null,
  user: null,
  onboardingAttemptId: null,
  step: null,
  track: null,
  ageYears: null,
  catalogueGeneration: null,
  curriculumId: null,
  gradeId: null,
};

let writeChain: Promise<void> = Promise.resolve();

function newAttemptId(): string {
  return `oba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function enqueuePersist(task: () => Promise<void>): Promise<void> {
  writeChain = writeChain.then(task, task);
  return writeChain;
}

async function persistNow(): Promise<void> {
  try {
    const payload: PersistedDraft = {
      version: DRAFT_VERSION,
      savedAt: Date.now(),
      onboardingAttemptId: draft.onboardingAttemptId ?? newAttemptId(),
      step: draft.step ?? undefined,
      track: draft.track ?? undefined,
      ageYears: draft.ageYears ?? undefined,
      countryCode: draft.location?.countryCode,
      pinCode: draft.location?.pinCode,
      locality: draft.location?.locality ?? undefined,
      schoolId: draft.school?.id,
      school: draft.school,
      curriculumId: draft.curriculumId ?? undefined,
      gradeId: draft.gradeId ?? undefined,
      catalogueGeneration: draft.catalogueGeneration ?? undefined,
    };
    if (!draft.onboardingAttemptId) {
      draft.onboardingAttemptId = payload.onboardingAttemptId;
    }
    await SecureStore.setItemAsync(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Persistence must never block onboarding.
  }
}

function persist(): Promise<void> {
  return enqueuePersist(persistNow);
}

export async function hydrateOnboardingDraft(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(DRAFT_KEY);
    if (!raw) {
      if (!draft.onboardingAttemptId) {
        draft.onboardingAttemptId = newAttemptId();
        await persist();
      }
      return;
    }
    const parsed = JSON.parse(raw) as PersistedDraft;
    if (parsed.version !== DRAFT_VERSION && parsed.version !== 1 && parsed.version !== 2) return;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      await SecureStore.deleteItemAsync(DRAFT_KEY);
      draft.onboardingAttemptId = newAttemptId();
      await persist();
      return;
    }
    draft.onboardingAttemptId = parsed.onboardingAttemptId || newAttemptId();
    draft.step = parsed.step ?? null;
    draft.track =
      parsed.track === "preschool" || parsed.track === "school"
        ? parsed.track
        : null;
    draft.ageYears =
      parsed.ageYears === 3 || parsed.ageYears === 4 ? parsed.ageYears : null;
    draft.catalogueGeneration = parsed.catalogueGeneration ?? null;
    draft.curriculumId = parsed.curriculumId ?? null;
    draft.gradeId = parsed.gradeId ?? null;
    if (parsed.school && parsed.school.id) {
      draft.school = parsed.school;
    } else if (parsed.schoolId) {
      draft.school = {
        id: parsed.schoolId,
        name: "",
        branch: null,
        city: "",
        state: null,
        pinCode: null,
        verified: true,
        displayLabel: parsed.schoolId,
      };
    }
    if (parsed.pinCode) {
      draft.location = {
        countryCode: parsed.countryCode ?? "IN",
        pinCode: parsed.pinCode,
        postalCode: parsed.pinCode,
        locality: parsed.locality ?? null,
        city: null,
        state: null,
        communityName: null,
        communityKey: null,
      };
      draft.locationLoaded = true;
    }
  } catch {
    draft.onboardingAttemptId = draft.onboardingAttemptId ?? newAttemptId();
  }
}

export function ensureOnboardingAttemptId(): string {
  if (!draft.onboardingAttemptId) {
    draft.onboardingAttemptId = newAttemptId();
    void persist();
  }
  return draft.onboardingAttemptId;
}

export function getOnboardingAttemptId(): string | null {
  return draft.onboardingAttemptId;
}

export function setOnboardingStep(step: PersistedDraft["step"]): void {
  draft.step = step ?? null;
  void persist();
}

export async function setOnboardingStepAsync(
  step: PersistedDraft["step"]
): Promise<void> {
  draft.step = step ?? null;
  await persist();
}

export function setCatalogueGeneration(gen: number | null): void {
  draft.catalogueGeneration = gen;
  void persist();
}

export function getCatalogueGeneration(): number | null {
  return draft.catalogueGeneration;
}

export function setOnboardingSchool(school: School | null): void {
  draft.school = school;
  void persist();
}

export async function setOnboardingSchoolAsync(
  school: School | null
): Promise<void> {
  draft.school = school;
  await persist();
}

export function getOnboardingSchool(): School | null {
  return draft.school;
}

export function setOnboardingClassSelection(input: {
  curriculumId: string | null;
  gradeId: string | null;
}): void {
  draft.curriculumId = input.curriculumId;
  draft.gradeId = input.gradeId;
  void persist();
}

export function getOnboardingClassSelection(): {
  curriculumId: string | null;
  gradeId: string | null;
} {
  return {
    curriculumId: draft.curriculumId,
    gradeId: draft.gradeId,
  };
}

export function setOnboardingTrack(track: "preschool" | "school" | null): void {
  draft.track = track;
  if (track === "preschool") {
    draft.curriculumId = null;
    draft.gradeId = null;
  } else if (track === "school") {
    draft.ageYears = null;
  }
  void persist();
}

export function getOnboardingTrack(): "preschool" | "school" | null {
  return draft.track;
}

export function setOnboardingAgeYears(ageYears: 3 | 4 | null): void {
  draft.ageYears = ageYears;
  void persist();
}

export function getOnboardingAgeYears(): 3 | 4 | null {
  return draft.ageYears;
}

export function setOnboardingLocation(
  location: Location | null,
  options?: { loaded?: boolean }
): void {
  draft.location = location;
  draft.locationLoaded = options?.loaded ?? true;
  void persist();
}

export async function setOnboardingLocationAsync(
  location: Location | null,
  options?: { loaded?: boolean }
): Promise<void> {
  draft.location = location;
  draft.locationLoaded = options?.loaded ?? true;
  await persist();
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

export function getOnboardingStep(): PersistedDraft["step"] | null {
  return draft.step;
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

export async function clearOnboardingDraft(): Promise<void> {
  await enqueuePersist(async () => {
    draft.school = null;
    draft.location = null;
    draft.locationLoaded = false;
    draft.children = null;
    draft.curricula = null;
    draft.circles = null;
    draft.user = null;
    draft.onboardingAttemptId = null;
    draft.step = null;
    draft.track = null;
    draft.ageYears = null;
    draft.catalogueGeneration = null;
    draft.curriculumId = null;
    draft.gradeId = null;
    try {
      await SecureStore.deleteItemAsync(DRAFT_KEY);
    } catch {
      // ignore
    }
  });
}
