import { normalizePlace, stripSafeAreaSuffix } from "./normalize.js";

/** Localities that belong to Hyderabad even when postal lookup stored the district. */
const HYDERABAD_LOCALITIES = new Set([
  "gachibowli",
  "gachibowli village",
  "nanakramguda",
  "financial district",
  "financial district nanakramguda",
  "rai durg",
  "raidurg",
  "raidurgam",
  "kokapet",
  "kondapur",
  "kphb",
  "kphb colony",
  "kukatpally",
  "kukatpally housing board",
  "madhapur",
  "hitec city",
  "jubilee hills",
  "banjara hills",
  "manikonda",
  "miyapur",
  "nallagandla",
  "tellapur",
]);

export function areaCityForStoredLocation(
  locality: string,
  city: string
): { city: string; hyderabadOverride: boolean } {
  const normalized = normalizePlace(locality);
  const stripped = stripSafeAreaSuffix(normalized);
  if (HYDERABAD_LOCALITIES.has(normalized) || HYDERABAD_LOCALITIES.has(stripped)) {
    return { city: "Hyderabad", hyderabadOverride: true };
  }
  return { city: city.trim(), hyderabadOverride: false };
}
