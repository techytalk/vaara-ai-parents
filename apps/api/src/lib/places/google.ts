import { parseGoogleAddress, type ParsedPlace } from "../areas/parse-address.js";

export type PlaceSuggestion = {
  id: string;
  source: "places";
  title: string;
  subtitle: string;
  kind: "building" | "area";
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      types?: string[];
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

const CITY_BIAS: Record<string, { latitude: number; longitude: number }> = {
  hyderabad: { latitude: 17.385, longitude: 78.4867 },
  secunderabad: { latitude: 17.4399, longitude: 78.4983 },
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
};

function apiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || null;
}

export async function autocompletePlaces(input: {
  query: string;
  city?: string | null;
  sessionToken: string;
}): Promise<PlaceSuggestion[]> {
  const key = apiKey();
  if (!key) return [];
  const bias = CITY_BIAS[(input.city ?? "").trim().toLowerCase()];
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
    },
    signal: AbortSignal.timeout(4000),
    body: JSON.stringify({
      input: input.query,
      sessionToken: input.sessionToken,
      languageCode: "en",
      regionCode: "in",
      ...(bias
        ? {
            locationBias: {
              circle: { center: bias, radius: 25000 },
            },
          }
        : {}),
    }),
  });
  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "places_autocomplete_error",
        status: response.status,
      })
    );
    return [];
  }
  const payload = (await response.json()) as AutocompleteResponse;
  const results: PlaceSuggestion[] = [];
  for (const suggestion of payload.suggestions ?? []) {
    const prediction = suggestion.placePrediction;
    const id = prediction?.placeId;
    const title =
      prediction?.structuredFormat?.mainText?.text?.trim() ||
      prediction?.text?.text?.trim();
    if (!id || !title) continue;
    const types = prediction.types ?? [];
    const kind =
      types.includes("premise") ||
      types.includes("subpremise") ||
      types.includes("point_of_interest") ||
      types.includes("establishment")
        ? "building"
        : "area";
    results.push({
      id,
      source: "places",
      title,
      subtitle: prediction.structuredFormat?.secondaryText?.text?.trim() || "",
      kind,
    });
    if (results.length >= 6) break;
  }
  return results;
}

export async function resolveGooglePlace(input: {
  placeId: string;
  sessionToken: string;
}): Promise<{ displayName: string; parsed: ParsedPlace } | null> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(input.placeId)}`);
  url.searchParams.set("sessionToken", input.sessionToken);
  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,types",
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "places_details_error",
        status: response.status,
      })
    );
    return null;
  }
  const payload = (await response.json()) as {
    displayName?: { text?: string };
    types?: string[];
    addressComponents?: Array<{
      longText?: string;
      shortText?: string;
      types?: string[];
    }>;
  };
  const displayName = payload.displayName?.text?.trim() || "";
  return {
    displayName,
    parsed: parseGoogleAddress({
      displayName,
      types: payload.types,
      addressComponents: payload.addressComponents,
    }),
  };
}
