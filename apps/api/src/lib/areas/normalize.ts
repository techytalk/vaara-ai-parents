const SAFE_SUFFIXES = new Set(["village", "vlg", "vlge", "vill"]);

const METRO_ALIASES: Record<string, string> = {
  hyderabad: "hyderabad",
  secunderabad: "hyderabad",
  bengaluru: "bengaluru",
  bangalore: "bengaluru",
};

export function normalizePlace(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripSafeAreaSuffix(normalized: string): string {
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2) return normalized;
  const last = parts[parts.length - 1] ?? "";
  if (!SAFE_SUFFIXES.has(last)) return normalized;
  return parts.slice(0, -1).join(" ");
}

export function areaKey(
  countryCode: string,
  city: string,
  areaName: string
): string {
  return `${countryCode.trim().toUpperCase()}|${normalizePlace(city)}|${normalizePlace(areaName)}`;
}

export function sameMetroCity(left: string, right: string): boolean {
  const a = normalizePlace(left);
  const b = normalizePlace(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return METRO_ALIASES[a] != null && METRO_ALIASES[a] === METRO_ALIASES[b];
}

const CONFLICT_TOKENS = new Set([
  "east",
  "west",
  "north",
  "south",
  "phase",
  "sector",
  "extension",
  "nagar",
  "colony",
]);

export function areaNamesConflict(left: string, right: string): boolean {
  const a = new Set(normalizePlace(left).split(" ").filter(Boolean));
  const b = new Set(normalizePlace(right).split(" ").filter(Boolean));
  for (const token of CONFLICT_TOKENS) {
    if (a.has(token) !== b.has(token)) return true;
  }
  const digits = (tokens: Set<string>) =>
    [...tokens].filter((token) => /\d/.test(token)).sort().join(",");
  return digits(a) !== digits(b);
}

/** True when the names are the same area after safe suffix cleanup. */
export function areaNamesSupportMatch(left: string, right: string): boolean {
  const a = stripSafeAreaSuffix(normalizePlace(left));
  const b = stripSafeAreaSuffix(normalizePlace(right));
  if (!a || !b || a !== b) return false;
  return !areaNamesConflict(left, right);
}
