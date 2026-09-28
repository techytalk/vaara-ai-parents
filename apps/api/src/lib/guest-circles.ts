/** Circles outsiders may ask as a guest thread. Child-specific types stay members-only. */
export const GUEST_CIRCLE_TYPES = [
  "school",
  "locality",
  "curriculum",
  "class",
  "community",
] as const;

export type GuestCircleType = (typeof GUEST_CIRCLE_TYPES)[number];

const GUEST_TYPE_SET = new Set<string>(GUEST_CIRCLE_TYPES);

export function isGuestCircleType(type: string | null | undefined): boolean {
  return Boolean(type && GUEST_TYPE_SET.has(type));
}

/** Reject filters outside the allowlist (e.g. type=school_class). */
export function parseGuestCircleTypeFilter(
  type: string | null | undefined
): { ok: true; type: GuestCircleType | null } | { ok: false; error: string } {
  const trimmed = type?.trim() || null;
  if (!trimmed) return { ok: true, type: null };
  if (!isGuestCircleType(trimmed)) {
    return {
      ok: false,
      error: "That circle type does not accept guest questions",
    };
  }
  return { ok: true, type: trimmed as GuestCircleType };
}

export const GUEST_THREAD_DAILY_LIMIT = 5;
