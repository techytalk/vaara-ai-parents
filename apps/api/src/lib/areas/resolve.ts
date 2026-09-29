import type { PoolClient } from "pg";
import {
  areaKey,
  normalizePlace,
  stripSafeAreaSuffix,
} from "./normalize.js";

export type ResolvedArea = {
  id: string;
  canonicalName: string;
  city: string;
  state: string;
  countryCode: string;
  status: "active" | "pending_resolution" | "redirected";
  created: boolean;
};

type AreaRow = {
  id: string;
  canonical_name: string;
  city: string;
  state: string;
  country_code: string;
  status: ResolvedArea["status"];
  canonical_area_id: string | null;
};

function mapRow(row: AreaRow, created = false): ResolvedArea {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    city: row.city,
    state: row.state,
    countryCode: row.country_code,
    status: row.status === "redirected" ? "active" : row.status,
    created,
  };
}

async function followRedirect(
  client: PoolClient,
  row: AreaRow
): Promise<AreaRow> {
  let current = row;
  for (let hop = 0; hop < 5 && current.status === "redirected" && current.canonical_area_id; hop += 1) {
    const { rows } = await client.query<AreaRow>(
      `SELECT id, canonical_name, city, state, country_code, status, canonical_area_id
       FROM areas WHERE id = $1`,
      [current.canonical_area_id]
    );
    if (!rows[0]) break;
    current = rows[0];
  }
  return current;
}

async function findByKey(
  client: PoolClient,
  countryCode: string,
  city: string,
  areaName: string
): Promise<AreaRow | null> {
  const key = areaKey(countryCode, city, areaName);
  const { rows } = await client.query<AreaRow>(
    `SELECT id, canonical_name, city, state, country_code, status, canonical_area_id
     FROM areas WHERE normalized_key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

async function findByAlias(
  client: PoolClient,
  countryCode: string,
  city: string,
  areaName: string
): Promise<AreaRow | null> {
  const alias = normalizePlace(areaName);
  const cityKey = normalizePlace(city);
  const { rows } = await client.query<AreaRow>(
    `SELECT a.id, a.canonical_name, a.city, a.state, a.country_code, a.status, a.canonical_area_id
     FROM area_aliases al
     JOIN areas a ON a.id = al.area_id
     WHERE al.normalized_alias = $1
       AND a.country_code = $2
       AND lower(a.city) = $3
     LIMIT 1`,
    [alias, countryCode.toUpperCase(), cityKey]
  );
  return rows[0] ?? null;
}

async function enqueueResolution(
  client: PoolClient,
  areaId: string
): Promise<void> {
  await client.query(
    `INSERT INTO area_resolution_jobs (area_id)
     SELECT $1
     WHERE NOT EXISTS (
       SELECT 1 FROM area_resolution_jobs
       WHERE area_id = $1 AND status = 'pending'
     )`,
    [areaId]
  );
}

export async function resolveCanonicalArea(
  client: PoolClient,
  input: {
    countryCode: string;
    city: string;
    state: string;
    areaName: string;
    providerPlaceId?: string | null;
    postalCode?: string | null;
    createIfMissing?: boolean;
  }
): Promise<ResolvedArea | null> {
  const countryCode = input.countryCode.trim().toUpperCase();
  const city = input.city.trim();
  const areaName = input.areaName.trim();
  if (!countryCode || !city || !areaName) return null;

  if (input.providerPlaceId) {
    const { rows } = await client.query<AreaRow>(
      `SELECT a.id, a.canonical_name, a.city, a.state, a.country_code, a.status, a.canonical_area_id
       FROM area_sources s
       JOIN areas a ON a.id = s.area_id
       WHERE s.provider = 'google' AND s.provider_place_id = $1`,
      [input.providerPlaceId]
    );
    if (rows[0]) return mapRow(await followRedirect(client, rows[0]));
  }

  const candidates = [areaName];
  const stripped = stripSafeAreaSuffix(normalizePlace(areaName));
  if (stripped && stripped !== normalizePlace(areaName)) {
    candidates.push(stripped);
  }

  for (const candidate of candidates) {
    const exact = await findByKey(client, countryCode, city, candidate);
    if (exact) return mapRow(await followRedirect(client, exact));
    const alias = await findByAlias(client, countryCode, city, candidate);
    if (alias) return mapRow(await followRedirect(client, alias));
  }

  if (!input.createIfMissing) return null;

  const key = areaKey(countryCode, city, areaName);
  const inserted = await client.query<AreaRow>(
    `INSERT INTO areas (
       country_code, canonical_name, city, state, normalized_key, status
     )
     VALUES ($1, $2, $3, $4, $5, 'pending_resolution')
     ON CONFLICT (normalized_key) DO UPDATE SET updated_at = areas.updated_at
     RETURNING id, canonical_name, city, state, country_code, status, canonical_area_id`,
    [countryCode, areaName, city, input.state.trim() || city, key]
  );
  const row = inserted.rows[0];
  if (!row) return null;
  const created = row.status === "pending_resolution";
  if (created) await enqueueResolution(client, row.id);
  if (input.providerPlaceId) {
    await client.query(
      `INSERT INTO area_sources (area_id, provider, provider_place_id)
       VALUES ($1, 'google', $2)
       ON CONFLICT (provider, provider_place_id) DO NOTHING`,
      [row.id, input.providerPlaceId]
    );
  }
  if (input.postalCode) {
    await client.query(
      `INSERT INTO area_postal_codes (area_id, postal_code)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [row.id, input.postalCode]
    );
  }
  return mapRow(await followRedirect(client, row), created);
}
