const DISTRICT_CITY_ALIASES: Record<string, string> = {
  "bengaluru urban": "Bengaluru",
  "bangalore urban": "Bengaluru",
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  "new delhi": "New Delhi",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  chennai: "Chennai",
  madras: "Chennai",
  kolkata: "Kolkata",
  calcutta: "Kolkata",
  hyderabad: "Hyderabad",
  secunderabad: "Secunderabad",
  pune: "Pune",
  gurgaon: "Gurugram",
  gurugram: "Gurugram",
};

export function titleCaseWords(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatDistrictAsCity(district: string): string {
  const trimmed = district.trim();
  if (!trimmed) return trimmed;
  const alias = DISTRICT_CITY_ALIASES[trimmed.toLowerCase()];
  return alias ?? titleCaseWords(trimmed);
}

export function formatStateName(state: string): string {
  const trimmed = state.trim();
  if (!trimmed) return trimmed;
  if (trimmed.toLowerCase() === "nct of delhi") return "Delhi";
  return titleCaseWords(trimmed);
}

export function cleanOfficeName(name: string): string {
  return name
    .replace(/\s+(S\.?O\.?|B\.?O\.?|H\.?O\.?|G\.?P\.?O\.?)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
