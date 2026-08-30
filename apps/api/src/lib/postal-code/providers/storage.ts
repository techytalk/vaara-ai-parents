import type { PoolClient } from "pg";
import { cleanOfficeName, formatDistrictAsCity, formatStateName, titleCaseWords } from "../format.js";
import type { PostalCodeLocality, PostalCodeLookup } from "../types.js";

export async function loadPostalCodeFromDb(
  client: PoolClient,
  countryCode: string,
  postalCode: string
): Promise<PostalCodeLookup | null> {
  const { rows } = await client.query(
    `SELECT office_name, district, state_name, office_type, delivery_status
     FROM postal_code_offices
     WHERE country_code = $1 AND postal_code = $2
     ORDER BY office_name`,
    [countryCode, postalCode]
  );
  if (rows.length === 0) return null;

  const district = rows[0].district as string;
  const stateName = rows[0].state_name as string;
  const localities: PostalCodeLocality[] = rows.map((row) => ({
    name: cleanOfficeName(row.office_name as string),
    officeType: (row.office_type as string | null) ?? null,
    deliveryStatus: (row.delivery_status as string | null) ?? null,
  }));

  const city =
    countryCode === "IN" ? formatDistrictAsCity(district) : titleCaseWords(district);
  const state =
    countryCode === "IN" ? formatStateName(stateName) : titleCaseWords(stateName);

  return {
    countryCode,
    countryName: countryCode,
    postalCode,
    state,
    city,
    district: titleCaseWords(district),
    localities,
  };
}

export async function savePostalCodeOffices(
  client: PoolClient,
  countryCode: string,
  postalCode: string,
  stateName: string,
  district: string,
  offices: PostalCodeLocality[]
): Promise<void> {
  for (const office of offices) {
    await client.query(
      `INSERT INTO postal_code_offices
         (country_code, postal_code, office_name, district, state_name, office_type, delivery_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (country_code, postal_code, office_name) DO UPDATE SET
         district = EXCLUDED.district,
         state_name = EXCLUDED.state_name,
         office_type = EXCLUDED.office_type,
         delivery_status = EXCLUDED.delivery_status`,
      [
        countryCode,
        postalCode,
        office.name,
        district,
        stateName,
        office.officeType,
        office.deliveryStatus,
      ]
    );
  }
}

/** Replace cached offices with the latest authoritative list from a live lookup. */
export async function syncPostalCodeOffices(
  client: PoolClient,
  countryCode: string,
  postalCode: string,
  stateName: string,
  district: string,
  offices: PostalCodeLocality[]
): Promise<void> {
  if (offices.length === 0) return;

  const officeNames = offices.map((office) => office.name);
  await client.query(
    `DELETE FROM postal_code_offices
     WHERE country_code = $1
       AND postal_code = $2
       AND NOT (office_name = ANY($3::text[]))`,
    [countryCode, postalCode, officeNames]
  );
  await savePostalCodeOffices(
    client,
    countryCode,
    postalCode,
    stateName,
    district,
    offices
  );
}

export function isIndiaCacheStale(lookup: PostalCodeLookup): boolean {
  if (lookup.localities.length === 0) return true;
  return !lookup.localities.some(
    (locality) => locality.officeType || locality.deliveryStatus
  );
}

function localityKey(name: string): string {
  return cleanOfficeName(name).toLowerCase();
}

export function mergeLocalities(
  ...groups: PostalCodeLocality[][]
): PostalCodeLocality[] {
  const map = new Map<string, PostalCodeLocality>();

  for (const group of groups) {
    for (const locality of group) {
      const name = cleanOfficeName(locality.name);
      if (!name) continue;

      const key = localityKey(name);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...locality, name });
        continue;
      }

      const preferExistingName =
        Boolean(existing.officeType || existing.deliveryStatus) &&
        !locality.officeType &&
        !locality.deliveryStatus;

      map.set(key, {
        name: preferExistingName ? existing.name : name,
        officeType: locality.officeType ?? existing.officeType,
        deliveryStatus: locality.deliveryStatus ?? existing.deliveryStatus,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergePostalCodeLookups(
  ...lookups: Array<PostalCodeLookup | null | undefined>
): PostalCodeLookup | null {
  const valid = lookups.filter(
    (lookup): lookup is PostalCodeLookup => Boolean(lookup)
  );
  if (valid.length === 0) return null;

  const primary =
    valid.find((lookup) =>
      lookup.localities.some(
        (locality) => locality.officeType || locality.deliveryStatus
      )
    ) ?? valid[0];

  return {
    ...primary,
    localities: mergeLocalities(...valid.map((lookup) => lookup.localities)),
  };
}
