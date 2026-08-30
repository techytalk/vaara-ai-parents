import type { PoolClient } from "pg";
import { titleCaseWords } from "../format.js";
import type { PostalCodeLocality, PostalCodeLookup } from "../types.js";
import {
  loadPostalCodeFromDb,
  mergePostalCodeLookups,
  savePostalCodeOffices,
} from "./storage.js";
import { fetchZippopotamPostalCode } from "./zippopotam.js";

type PostcodesIoResult = {
  postcode?: string;
  country?: string;
  region?: string;
  admin_district?: string;
  admin_county?: string;
  admin_ward?: string;
  parish?: string;
  nuts?: string;
};

function compactUkPostcode(postalCode: string): string {
  return postalCode.replace(/\s+/g, "").toUpperCase();
}

function cleanParishName(parish: string): string | null {
  const trimmed = parish.trim();
  if (!trimmed) return null;
  const withoutSuffix = trimmed.replace(/,?\s*unparished area$/i, "").trim();
  return titleCaseWords(withoutSuffix);
}

export function buildLocalitiesFromPostcodesIo(
  result: PostcodesIoResult
): PostalCodeLocality[] {
  const names = [
    result.admin_ward,
    result.admin_district,
    cleanParishName(result.parish ?? ""),
    result.nuts,
    result.region,
  ]
    .map((name) => (name ? titleCaseWords(name) : ""))
    .filter((name) => name.length > 0);

  const unique = [...new Set(names)];
  return unique.map((name) => ({
    name,
    officeType: null,
    deliveryStatus: null,
  }));
}

export function buildLookupFromPostcodesIo(
  postalCode: string,
  result: PostcodesIoResult
): PostalCodeLookup {
  const localities = buildLocalitiesFromPostcodesIo(result);
  const city = titleCaseWords(
    result.admin_district?.trim() ||
      result.nuts?.trim() ||
      result.region?.trim() ||
      localities[0]?.name ||
      ""
  );
  const state = titleCaseWords(
    result.country?.trim() || result.region?.trim() || result.admin_county?.trim() || ""
  );

  return {
    countryCode: "GB",
    countryName: "United Kingdom",
    postalCode: result.postcode?.trim() || postalCode,
    state,
    city,
    district: city,
    localities,
  };
}

async function loadPostcodesIoLookup(
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const compact = compactUkPostcode(postalCode);
  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    status?: number;
    result?: PostcodesIoResult | null;
  };
  if (payload.status !== 200 || !payload.result) {
    return null;
  }

  return buildLookupFromPostcodesIo(
    payload.result.postcode?.trim() || postalCode,
    payload.result
  );
}

function finalizeUkLookup(lookup: PostalCodeLookup): PostalCodeLookup {
  return {
    ...lookup,
    countryCode: "GB",
    countryName: "United Kingdom",
    city: titleCaseWords(lookup.city),
    state: titleCaseWords(lookup.state),
    district: titleCaseWords(lookup.district),
    localities: [...lookup.localities].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function isUkCacheComplete(lookup: PostalCodeLookup): boolean {
  return lookup.localities.length >= 2;
}

export async function lookupUkPostalCode(
  client: PoolClient,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const cached = await loadPostalCodeFromDb(client, "GB", postalCode);
  const cachedUk = cached ? finalizeUkLookup({ ...cached, countryName: "United Kingdom" }) : null;

  if (cachedUk && isUkCacheComplete(cachedUk)) {
    return cachedUk;
  }

  const [postcodesIo, zippopotam] = await Promise.all([
    loadPostcodesIoLookup(postalCode),
    fetchZippopotamPostalCode("GB", postalCode),
  ]);

  const merged = mergePostalCodeLookups(cachedUk, postcodesIo, zippopotam);
  if (!merged) return null;

  const result = finalizeUkLookup(merged);
  await savePostalCodeOffices(
    client,
    "GB",
    result.postalCode,
    result.state,
    result.district,
    result.localities
  );
  return result;
}
