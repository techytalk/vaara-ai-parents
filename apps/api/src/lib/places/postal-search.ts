import type { PoolClient } from "pg";
import { cleanOfficeName, formatDistrictAsCity, formatStateName } from "../postal-code/format.js";
import { issuePlaceSelection, readPlaceSelection } from "../areas/selection.js";

export type PostalSuggestion = {
  id: string;
  source: "postal";
  title: string;
  subtitle: string;
  kind: "area";
};

type PostalChoice = {
  source: "postal";
  countryCode: string;
  areaName: string;
  city: string;
  state: string;
  postalCode: string | null;
  exp: number;
};

export async function searchPostalAreas(
  client: PoolClient,
  query: string
): Promise<PostalSuggestion[]> {
  const digits = query.replace(/\D/g, "");
  const pinQuery = digits.length === 6 && digits === query.trim();
  const like = `%${query.trim().replace(/[\\%_]/g, "")}%`;
  const { rows } = await client.query<{
    office_name: string;
    district: string;
    state_name: string;
    postal_code: string;
  }>(
    pinQuery
      ? `SELECT office_name, district, state_name, postal_code
         FROM postal_code_offices
         WHERE country_code = 'IN' AND postal_code = $1
         ORDER BY office_name
         LIMIT 40`
      : `SELECT office_name, district, state_name, postal_code
         FROM postal_code_offices
         WHERE country_code = 'IN' AND office_name ILIKE $1
         ORDER BY office_name
         LIMIT 40`,
    [pinQuery ? digits : like]
  );

  const grouped = new Map<string, PostalSuggestion & { postalCodes: Set<string> }>();
  for (const row of rows) {
    const areaName = cleanOfficeName(row.office_name);
    if (!areaName) continue;
    const city = formatDistrictAsCity(row.district);
    const state = formatStateName(row.state_name);
    const key = `${areaName.toLowerCase()}|${city.toLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.postalCodes.add(row.postal_code);
      continue;
    }
    const token = issuePlaceSelection({
      source: "postal",
      countryCode: "IN",
      areaName,
      city,
      state,
      postalCode: null,
      communityName: null,
      providerPlaceId: null,
      needsArea: false,
    });
    grouped.set(key, {
      id: token,
      source: "postal",
      title: areaName,
      subtitle: `${city}${state ? `, ${state}` : ""}`,
      kind: "area",
      postalCodes: new Set([row.postal_code]),
    });
  }

  return [...grouped.values()].map((row) => {
    const postalCode = row.postalCodes.size === 1 ? [...row.postalCodes][0] : null;
    const selection = readPlaceSelection(row.id);
    return {
      id: selection
        ? issuePlaceSelection({ ...selection, postalCode, exp: selection.exp })
        : row.id,
      source: "postal",
      title: row.title,
      subtitle: row.subtitle,
      kind: "area",
    };
  });
}

export function readPostalChoice(token: string): PostalChoice | null {
  const selection = readPlaceSelection(token);
  if (!selection || selection.source !== "postal" || !selection.areaName) return null;
  return {
    source: "postal",
    countryCode: selection.countryCode,
    areaName: selection.areaName,
    city: selection.city,
    state: selection.state,
    postalCode: selection.postalCode,
    exp: selection.exp,
  };
}
