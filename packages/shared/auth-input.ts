export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 6;
/** bcrypt silently truncates past 72 bytes. */
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_DISPLAY_NAME_LENGTH = 80;

export function normalizeEmail(raw: string | undefined | null): string {
  return (raw ?? "").trim().toLowerCase();
}

export function isValidEmail(raw: string | undefined | null): boolean {
  const email = normalizeEmail(raw);
  if (email.length < 5 || email.length > MAX_EMAIL_LENGTH) return false;
  if (email.includes(" ") || email.includes("..")) return false;
  // Local + @ + domain with at least one dot (blocks "8986", "kalpana 1gw1").
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeDisplayName(
  raw: string | undefined | null
): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  return name.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function passwordError(raw: string | undefined | null): string | null {
  if (typeof raw !== "string" || raw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (raw.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  return null;
}
