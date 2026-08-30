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
