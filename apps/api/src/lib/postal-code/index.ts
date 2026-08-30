import type { PoolClient } from "pg";
import { getPostalCountry, listPostalCountries, normalizeCountryCode } from "./countries.js";
import { lookupIndiaPostalCode } from "./providers/india.js";
import { lookupUkPostalCode } from "./providers/uk.js";
import { lookupZippopotamPostalCode } from "./providers/zippopotam.js";
import type { PostalCodeLookup } from "./types.js";

export type { PostalCodeLookup, PostalCodeLocality, PostalCountryConfig } from "./types.js";
export {
  formatDistrictAsCity,
  formatStateName,
  titleCaseWords,
} from "./format.js";
export {
  getPostalCountry,
  listPostalCountries,
  normalizeCountryCode,
} from "./countries.js";

export function isValidIndianPinCode(postalCode: string): boolean {
  return getPostalCountry("IN")?.validate(postalCode) ?? false;
}

export async function lookupPostalCode(
  client: PoolClient,
  countryCodeInput: string,
  postalCodeInput: string
): Promise<PostalCodeLookup | null> {
  const country = getPostalCountry(countryCodeInput);
  if (!country) return null;

  const postalCode = country.normalize(postalCodeInput);
  if (!country.validate(postalCode)) {
    return null;
  }

  let lookup: PostalCodeLookup | null = null;
  if (country.provider === "india") {
    lookup = await lookupIndiaPostalCode(client, postalCode);
  } else if (country.provider === "uk") {
    lookup = await lookupUkPostalCode(client, postalCode);
  } else if (country.provider === "zippopotam") {
    lookup = await lookupZippopotamPostalCode(
      client,
      country.code,
      postalCode
    );
  }

  if (!lookup) return null;
  return {
    ...lookup,
    countryCode: country.code,
    countryName: country.name,
    postalCode,
  };
}

export async function listCommunitySuggestions(
  client: PoolClient,
  countryCodeInput: string,
  postalCodeInput: string,
  limit = 10
): Promise<string[]> {
  const country = getPostalCountry(countryCodeInput);
  if (!country) return [];

  const postalCode = country.normalize(postalCodeInput);
  if (!country.validate(postalCode)) {
    return [];
  }

  const { rows } = await client.query(
    `SELECT community_name, COUNT(*)::int AS usage_count
     FROM user_locations
     WHERE country_code = $1
       AND pin_code = $2
       AND community_name IS NOT NULL
       AND TRIM(community_name) <> ''
     GROUP BY community_name
     ORDER BY usage_count DESC, community_name ASC
     LIMIT $3`,
    [country.code, postalCode, limit]
  );

  return rows.map((row) => row.community_name as string);
}

/** @deprecated Use lookupPostalCode(client, "IN", pinCode) */
export async function lookupIndianPinCode(
  client: PoolClient,
  pinCodeInput: string
): Promise<PostalCodeLookup | null> {
  return lookupPostalCode(client, "IN", pinCodeInput);
}
