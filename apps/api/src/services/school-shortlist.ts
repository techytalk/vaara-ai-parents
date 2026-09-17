import type { PoolClient } from "pg";
import { mapSchoolListRow } from "../lib/school.js";

const SHORTLIST_CAP = 30;

/**
 * Privacy-safe shortlist tiers:
 * 1. Dense PIN affinity (k>=5) — verified only
 * 2. Region affinity (k>=5) when PIN is sparse — verified only
 * 3. Directory: locality/region then alpha (verified first, pending allowed)
 * Never expose parent counts.
 */
export async function getSchoolShortlist(
  client: PoolClient,
  opts: {
    countryCode: string;
    pinCode: string;
    locality?: string | null;
    region?: string | null;
    /** preschool | school | preschool_campus (school kind with offers_preschool) */
    list?: "preschool" | "school" | "preschool_campus";
  }
) {
  const country = opts.countryCode.trim().toUpperCase() || "IN";
  const pin = opts.pinCode.trim();
  const seen = new Set<string>();
  const out: ReturnType<typeof mapSchoolListRow>[] = [];

  const kindClause =
    opts.list === "preschool"
      ? `AND s.kind = 'preschool'`
      : opts.list === "preschool_campus"
        ? `AND s.kind = 'school' AND s.offers_preschool = true`
        : opts.list === "school"
          ? `AND s.kind = 'school'`
          : "";

  async function pushRows(rows: Record<string, unknown>[]) {
    for (const row of rows) {
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(mapSchoolListRow(row));
      if (out.length >= SHORTLIST_CAP) return;
    }
  }

  const selectCols = `s.id, s.name, s.branch, s.city, s.state, s.pin_code, s.verified,
              s.rating_avg, s.rating_count, s.board_codes, s.locality, s.region, s.aliases,
              s.kind, s.offers_preschool`;

  // Tier 1 — dense PIN
  if (pin) {
    const { rows } = await client.query(
      `SELECT ${selectCols}
       FROM school_pin_affinity a
       JOIN schools s ON s.id = a.school_id
       WHERE a.country_code = $1 AND a.pin_code = $2
         AND s.verified = true AND s.redirect_to_school_id IS NULL
         ${kindClause}
       ORDER BY a.parents DESC, s.name
       LIMIT $3`,
      [country, pin, SHORTLIST_CAP]
    );
    await pushRows(rows);
  }

  if (out.length >= SHORTLIST_CAP) return out;

  // Resolve region from locality if not provided
  let region = opts.region?.trim() || null;
  if (!region && opts.locality?.trim()) {
    const { rows } = await client.query(
      `SELECT region FROM schools
       WHERE locality = $1 AND region IS NOT NULL AND verified = true
       LIMIT 1`,
      [opts.locality.trim()]
    );
    region = (rows[0]?.region as string | undefined) ?? null;
  }
  if (!region && pin) {
    const { rows } = await client.query(
      `SELECT s.region
       FROM schools s
       WHERE s.verified = true AND s.region IS NOT NULL
         AND s.redirect_to_school_id IS NULL
         AND (
           s.pin_code = $1
           OR s.locality ILIKE $2
         )
       LIMIT 1`,
      [pin, opts.locality?.trim() || null]
    );
    region = (rows[0]?.region as string | undefined) ?? null;
  }

  // Tier 2 — region affinity when PIN tier was thin
  if (out.length < 5 && region) {
    const { rows } = await client.query(
      `SELECT ${selectCols}
       FROM school_region_affinity a
       JOIN schools s ON s.id = a.school_id
       WHERE a.region = $1
         AND s.verified = true AND s.redirect_to_school_id IS NULL
         ${kindClause}
       ORDER BY a.parents DESC, s.name
       LIMIT $2`,
      [region, SHORTLIST_CAP]
    );
    await pushRows(rows);
  }

  if (out.length >= SHORTLIST_CAP) return out;

  // Tier 3 — directory: locality then region then alpha
  if (opts.locality?.trim()) {
    const { rows } = await client.query(
      `SELECT ${selectCols}
       FROM schools s
       WHERE s.redirect_to_school_id IS NULL
         AND s.normalized_key <> 'school_not_specified||unknown'
         AND s.locality ILIKE $1
         ${kindClause}
       ORDER BY s.verified DESC, s.name
       LIMIT $2`,
      [opts.locality.trim(), SHORTLIST_CAP]
    );
    await pushRows(rows);
  }

  if (out.length >= SHORTLIST_CAP) return out;

  if (region) {
    const { rows } = await client.query(
      `SELECT ${selectCols}
       FROM schools s
       WHERE s.redirect_to_school_id IS NULL
         AND s.normalized_key <> 'school_not_specified||unknown'
         AND s.region = $1
         ${kindClause}
       ORDER BY s.verified DESC, s.name
       LIMIT $2`,
      [region, SHORTLIST_CAP]
    );
    await pushRows(rows);
  }

  if (out.length >= SHORTLIST_CAP) return out;

  // Final fill — verified first, then pending (usable, awaiting review)
  const { rows } = await client.query(
    `SELECT ${selectCols}
     FROM schools s
     WHERE s.redirect_to_school_id IS NULL
       AND s.normalized_key <> 'school_not_specified||unknown'
       ${kindClause}
     ORDER BY s.verified DESC, s.name
     LIMIT $1`,
    [SHORTLIST_CAP]
  );
  await pushRows(rows);

  return out;
}

/** Public school search: verified ranked above pending; both are selectable. */
export async function searchVerifiedSchools(
  client: PoolClient,
  q: string,
  limit = 20
) {
  const query = q.trim().slice(0, 80);
  if (query.length < 3) return [];
  const capped =
    Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 20) : 20;
  const pattern = `%${query}%`;
  const prefix = `${query}%`;
  const { rows } = await client.query(
    `SELECT s.id, s.name, s.branch, s.city, s.state, s.pin_code, s.verified,
            s.rating_avg, s.rating_count, s.board_codes, s.locality, s.region, s.aliases,
            CASE
              WHEN s.verified AND s.name ILIKE $2 THEN 0
              WHEN s.verified AND s.search_text ILIKE $2 THEN 1
              WHEN s.verified THEN 2
              WHEN s.name ILIKE $2 THEN 3
              WHEN s.search_text ILIKE $2 THEN 4
              ELSE 5
            END AS rank_bucket,
            similarity(s.search_text, $3) AS sm
     FROM schools s
     WHERE s.redirect_to_school_id IS NULL
       AND s.normalized_key <> 'school_not_specified||unknown'
       AND (
         s.search_text ILIKE $1
         OR s.search_text % $3
       )
     ORDER BY rank_bucket, sm DESC, s.name
     LIMIT $4`,
    [pattern, prefix, query.toLowerCase(), capped]
  );
  return rows.map((row) => mapSchoolListRow(row));
}
