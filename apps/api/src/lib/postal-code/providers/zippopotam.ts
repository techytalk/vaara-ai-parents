import type { PoolClient } from "pg";
import { titleCaseWords } from "../format.js";
import type { PostalCodeLocality, PostalCodeLookup } from "../types.js";
import { loadPostalCodeFromDb, savePostalCodeOffices } from "./storage.js";

type ZippopotamPlace = {
  "place name"?: string;
  state?: string;
  "state abbreviation"?: string;
  latitude?: string;
  longitude?: string;
};

type ZippopotamResponse = {
  country?: string;
  "country abbreviation"?: string;
  "post code"?: string;
  places?: ZippopotamPlace[];
};

function buildZippopotamLookup(
  countryCode: string,
  countryName: string,
  postalCode: string,
  places: ZippopotamPlace[]
): PostalCodeLookup {
  const localities: PostalCodeLocality[] = places
    .map((place) => ({
      name: titleCaseWords(place["place name"]?.trim() ?? ""),
      officeType: null,
      deliveryStatus: null,
    }))
    .filter((place) => place.name.length > 0);

  const primary = places[0] ?? {};
  const state =
    primary["state abbreviation"]?.trim() ||
    titleCaseWords(primary.state?.trim() ?? "");
  const city = localities[0]?.name ?? titleCaseWords(primary["place name"]?.trim() ?? "");

  return {
    countryCode,
    countryName,
    postalCode,
    state,
    city,
    district: city,
    localities,
  };
}

function zippopotamPostalPath(countryCode: string, postalCode: string): string {
  const compact = postalCode.replace(/\s+/g, "");
  if (countryCode === "US") {
    return compact.replace(/-.*/, "").slice(0, 5);
  }
  return compact;
}

async function loadZippopotamPostalCode(
  countryCode: string,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const pathCode = zippopotamPostalPath(countryCode, postalCode);
  const response = await fetch(
    `https://api.zippopotam.us/${countryCode.toLowerCase()}/${encodeURIComponent(pathCode)}`,
    { headers: { Accept: "application/json" } }
  );
  if (response.status === 404) return null;
  if (!response.ok) return null;

  const payload = (await response.json()) as ZippopotamResponse;
  const places = payload.places ?? [];
  if (places.length === 0) return null;

  const countryName =
    payload.country?.trim() ||
    payload["country abbreviation"]?.trim() ||
    countryCode;

  return buildZippopotamLookup(
    countryCode,
    titleCaseWords(countryName),
    payload["post code"]?.trim() || postalCode,
    places
  );
}

export async function lookupZippopotamPostalCode(
  client: PoolClient,
  countryCode: string,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const cached = await loadPostalCodeFromDb(client, countryCode, postalCode);
  if (cached) return cached;

  const remote = await loadZippopotamPostalCode(countryCode, postalCode);
  if (!remote) return null;

  await savePostalCodeOffices(
    client,
    countryCode,
    remote.postalCode,
    remote.state,
    remote.district,
    remote.localities
  );
  return remote;
}
