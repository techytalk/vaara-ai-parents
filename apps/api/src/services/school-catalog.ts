import { createHash } from "crypto";
import type { PoolClient } from "pg";
import { mapSchoolListRow } from "../lib/school.js";

export type CatalogSchoolRow = {
  id: string;
  name: string;
  branch: string | null;
  locality: string | null;
  region: string | null;
  aliases: string[];
  boards: string[];
  verified: boolean;
};

export type SchoolCatalogManifest = {
  schemaVersion: number;
  generation: number;
  checksum: string;
  compressedSize: number | null;
  rowCount: number;
  createdAt: string;
  url: string;
};

const SCHEMA_VERSION = 1;

export async function buildSchoolCatalog(
  client: PoolClient
): Promise<{ generation: number; manifest: SchoolCatalogManifest }> {
  const { rows } = await client.query(
    `SELECT id, name, branch, locality, region, aliases, board_codes, verified
     FROM schools
     WHERE redirect_to_school_id IS NULL
       AND normalized_key <> 'school_not_specified||unknown'
     ORDER BY verified DESC, name, coalesce(branch, ''), id`
  );

  const payload: CatalogSchoolRow[] = rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    branch: (row.branch as string | null) ?? null,
    locality: (row.locality as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
    boards: Array.isArray(row.board_codes)
      ? (row.board_codes as string[]).filter(
          (c): c is string => typeof c === "string"
        )
      : [],
    verified: Boolean(row.verified),
  }));

  // Deterministic exact bytes — checksum must match what we serve.
  const json = JSON.stringify(payload);
  const checksum = createHash("sha256").update(json, "utf8").digest("hex");
  const byteLength = Buffer.byteLength(json, "utf8");

  await client.query(`SELECT pg_advisory_xact_lock(hashtext('school_catalog_build'))`);

  const genResult = await client.query(
    `SELECT coalesce(max(generation), 0) + 1 AS next FROM school_catalog_generations`
  );
  const generation = Number(genResult.rows[0].next);

  await client.query(
    `INSERT INTO school_catalog_generations
       (generation, schema_version, checksum, compressed_size, row_count, payload, payload_bytes)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [generation, SCHEMA_VERSION, checksum, byteLength, payload.length, json, json]
  );

  await client.query(
    `UPDATE school_catalog_meta
     SET current_generation = $1, updated_at = now()
     WHERE id = 1`,
    [generation]
  );

  await client.query(
    `DELETE FROM school_catalog_generations
     WHERE generation < $1 - 2`,
    [generation]
  );

  return {
    generation,
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      generation,
      checksum,
      compressedSize: byteLength,
      rowCount: payload.length,
      createdAt: new Date().toISOString(),
      url: `/v1/reference/schools/catalog/v${generation}`,
    },
  };
}

export async function getCatalogManifest(
  client: PoolClient
): Promise<SchoolCatalogManifest | null> {
  const { rows } = await client.query(
    `SELECT g.generation, g.schema_version, g.checksum, g.compressed_size,
            g.row_count, g.created_at
     FROM school_catalog_meta m
     JOIN school_catalog_generations g ON g.generation = m.current_generation
     WHERE m.id = 1`
  );
  if (rows.length === 0 || rows[0].generation == null) return null;
  const row = rows[0];
  return {
    schemaVersion: Number(row.schema_version),
    generation: Number(row.generation),
    checksum: row.checksum as string,
    compressedSize: row.compressed_size != null ? Number(row.compressed_size) : null,
    rowCount: Number(row.row_count),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    url: `/v1/reference/schools/catalog/v${row.generation}`,
  };
}

export async function getCatalogPayload(
  client: PoolClient,
  generation: number
): Promise<{ checksum: string; payload: CatalogSchoolRow[]; raw: string } | null> {
  const { rows } = await client.query(
    `SELECT checksum, payload, payload_bytes
     FROM school_catalog_generations WHERE generation = $1`,
    [generation]
  );
  if (rows.length === 0) return null;
  const raw =
    typeof rows[0].payload_bytes === "string" && rows[0].payload_bytes.length > 0
      ? (rows[0].payload_bytes as string)
      : JSON.stringify(rows[0].payload);
  return {
    checksum: rows[0].checksum as string,
    payload: rows[0].payload as CatalogSchoolRow[],
    raw,
  };
}

export async function ensureCatalogExists(client: PoolClient): Promise<void> {
  const manifest = await getCatalogManifest(client);
  if (!manifest) {
    await buildSchoolCatalog(client);
  }
}

export function mapShortlistSchool(row: Record<string, unknown>) {
  return mapSchoolListRow(row);
}
