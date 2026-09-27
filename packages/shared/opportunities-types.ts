/**
 * Competitive Exams / opportunities catalogue contracts.
 * Spec: docs/VAARA_COMPETITIONS_IMPLEMENTATION_SPEC.md
 */

export const OPPORTUNITY_KINDS = [
  "competition",
  "olympiad",
  "exam",
  "scholarship",
  "admission_route",
] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const OPPORTUNITY_PUBLICATION_STATUSES = [
  "draft",
  "in_review",
  "published",
  "retired",
] as const;
export type OpportunityPublicationStatus =
  (typeof OPPORTUNITY_PUBLICATION_STATUSES)[number];

export const OPPORTUNITY_EVENT_STATUSES = [
  "scheduled",
  "postponed",
  "cancelled",
  "completed",
  "unknown",
] as const;
export type OpportunityEventStatus =
  (typeof OPPORTUNITY_EVENT_STATUSES)[number];

export const OPPORTUNITY_SCOPE_LEVELS = [
  "school",
  "local",
  "district",
  "state",
  "national",
  "international",
] as const;
export type OpportunityScopeLevel = (typeof OPPORTUNITY_SCOPE_LEVELS)[number];

export const OPPORTUNITY_REGISTRATION_METHODS = [
  "direct",
  "through_school",
  "nomination",
  "qualification",
  "mixed",
  "unknown",
] as const;
export type OpportunityRegistrationMethod =
  (typeof OPPORTUNITY_REGISTRATION_METHODS)[number];

export const OPPORTUNITY_FEE_STATUSES = [
  "free",
  "paid",
  "varies",
  "unknown",
] as const;
export type OpportunityFeeStatus = (typeof OPPORTUNITY_FEE_STATUSES)[number];

export const OPPORTUNITY_PLAN_STATUSES = [
  "exploring",
  "planning",
  "this_season",
] as const;
export type OpportunityPlanStatus = (typeof OPPORTUNITY_PLAN_STATUSES)[number];

export const OPPORTUNITY_PLAN_LIFECYCLES = ["active", "inactive"] as const;
export type OpportunityPlanLifecycle =
  (typeof OPPORTUNITY_PLAN_LIFECYCLES)[number];

export const OPPORTUNITY_LIST_SORTS = ["relevance", "closing_soon"] as const;
export type OpportunityListSort = (typeof OPPORTUNITY_LIST_SORTS)[number];

/** Derived registration presentation states (not a DB column). */
export const OPPORTUNITY_REGISTRATION_UI_STATES = [
  "open",
  "opening_soon",
  "closed",
  "dates_unannounced",
  "check_with_school",
  "suspended",
  "cancelled",
  "unknown",
] as const;
export type OpportunityRegistrationUiState =
  (typeof OPPORTUNITY_REGISTRATION_UI_STATES)[number];

export type OpportunityCategoryCode =
  | "mathematics"
  | "science"
  | "english"
  | "computing"
  | "general_knowledge"
  | "arts"
  | "environment"
  | "heritage"
  | "robotics"
  | "sports"
  | "language"
  | "reasoning";

export type OpportunityListCursor = {
  sort: OpportunityListSort;
  /** ISO timestamp or date string used for closing_soon sort. */
  registrationCloseAt?: string | null;
  relevanceScore?: number | null;
  opportunityId: string;
};

export type OpportunityCard = {
  id: string;
  slug: string;
  title: string;
  kind: OpportunityKind;
  organizerName: string | null;
  categories: { code: string; label: string }[];
  edition: {
    id: string;
    editionKey: string;
    editionLabel: string;
    scopeLevel: OpportunityScopeLevel;
    feeStatus: OpportunityFeeStatus;
    registrationMethod: OpportunityRegistrationMethod;
    eventStatus: OpportunityEventStatus;
  } | null;
  registrationState: OpportunityRegistrationUiState;
  registrationClosesOn: string | null;
};
