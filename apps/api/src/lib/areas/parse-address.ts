export type ParsedPlace = {
  communityName: string | null;
  areaName: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  countryCode: string | null;
  postalCode: string | null;
};

type GoogleComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

const AREA_TYPES = [
  "neighborhood",
  "sublocality_level_1",
  "sublocality",
  "sublocality_level_2",
];

function component(
  components: GoogleComponent[],
  type: string
): GoogleComponent | undefined {
  return components.find((item) => item.types?.includes(type));
}

function text(item: GoogleComponent | undefined, short = false): string | null {
  const value = (short ? item?.shortText : item?.longText)?.trim();
  return value || null;
}

export function parseGoogleAddress(input: {
  displayName?: string | null;
  types?: string[] | null;
  addressComponents?: GoogleComponent[] | null;
}): ParsedPlace {
  const components = input.addressComponents ?? [];
  const premise =
    text(component(components, "premise")) ??
    text(component(components, "subpremise"));
  const types = input.types ?? [];
  const display = input.displayName?.trim() || null;
  const looksLikeBuilding =
    Boolean(premise) ||
    types.includes("premise") ||
    types.includes("subpremise") ||
    types.includes("point_of_interest") ||
    types.includes("establishment");

  let areaName: string | null = null;
  for (const type of AREA_TYPES) {
    areaName = text(component(components, type));
    if (areaName) break;
  }

  const city =
    text(component(components, "locality")) ??
    text(component(components, "postal_town"));
  const district = text(component(components, "administrative_area_level_2"));
  if (areaName && city && normalizeLoose(areaName) === normalizeLoose(city)) {
    areaName = null;
  }
  if (
    areaName &&
    district &&
    normalizeLoose(areaName) === normalizeLoose(district)
  ) {
    areaName = null;
  }

  const communityName =
    looksLikeBuilding && display && normalizeLoose(display) !== normalizeLoose(areaName ?? "")
      ? display
      : premise && normalizeLoose(premise) !== normalizeLoose(areaName ?? "")
        ? premise
        : null;

  return {
    communityName,
    areaName,
    city,
    district,
    state: text(component(components, "administrative_area_level_1")),
    countryCode: text(component(components, "country"), true)?.toUpperCase() ?? null,
    postalCode: text(component(components, "postal_code")),
  };
}

function normalizeLoose(value: string): string {
  return value.trim().toLowerCase();
}
