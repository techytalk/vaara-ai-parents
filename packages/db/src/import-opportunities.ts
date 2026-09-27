/**
 * Import staging catalogue from docs/VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md
 * using slugs in docs/VAARA_COMPETITIONS_SEED_SLUGS.md.
 *
 * All rows stay publication_status = draft. Nulls stay NULL.
 * Blank geography is scope_level = unknown (never inferred national).
 * Review notes are stored only on the change log, not parent-facing fields.
 */
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { pool } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const docs = resolve(here, "../../../docs");

type Staging = {
  data: {
    name: string;
    organiser: string | null;
    subject: string | null;
    edition_label: string | null;
    eligibility_text: string | null;
    board_eligibility: string | null;
    age_eligibility: string | null;
    geographic_eligibility: string | null;
    participation_route: string | null;
    fee_amount: number | null;
    fee_currency: string | null;
    fee_basis: string | null;
    fee_tax_note: string | null;
    registration_opens_on: string | null;
    registration_closes_on: string | null;
    schedule: Record<string, unknown> | null;
    venue: string | null;
    registration_url: string | null;
    official_url: string | null;
    source_urls: string[] | null;
  };
  review_notes: string | null;
};

type SlugRow = {
  n: number;
  slug: string;
  kind: string;
  categories: string[];
};

function parseSlugMap(md: string): SlugRow[] {
  const rows: SlugRow[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(
      /^\| (\d+) \| ([a-z0-9-]+) \| [^|]+ \| [^|]+ \| ([a-z_]+) \| ([^|]+) \|$/
    );
    if (!m) continue;
    rows.push({
      n: Number(m[1]),
      slug: m[2],
      kind: m[3],
      categories: m[4]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return rows;
}

function parseRecords(md: string): Staging[] {
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) =>
    JSON.parse(m[1]) as Staging
  );
  return blocks;
}

function editionKey(label: string): string {
  return label.replace(/[–—]/g, "-").trim().toLowerCase().replace(/\s+/g, "-");
}

function registrationMethod(route: string | null): string {
  const v = (route ?? "").toLowerCase();
  if (!v) return "unknown";
  if (v.includes("school") && v.includes("individual")) return "mixed";
  if (v.includes("school")) return "through_school";
  if (v.includes("nominat")) return "nomination";
  if (v.includes("individual") || v.includes("direct")) return "direct";
  return "unknown";
}

function scopeFromGeo(geo: string | null): string {
  if (!geo || !geo.trim()) return "unknown";
  const v = geo.toLowerCase();
  if (v.includes("international")) return "international";
  if (v.includes("telangana") || v.includes("state")) return "state";
  if (v.includes("national") || v.includes("india")) return "national";
  if (v.includes("district")) return "district";
  if (v.includes("school")) return "school";
  return "unknown";
}

function feeStatus(amount: number | null): string {
  if (amount === null || amount === undefined) return "unknown";
  if (amount === 0) return "free";
  return "paid";
}

async function main() {
  const slugs = parseSlugMap(
    readFileSync(resolve(docs, "VAARA_COMPETITIONS_SEED_SLUGS.md"), "utf8")
  );
  const records = parseRecords(
    readFileSync(resolve(docs, "VAARA_EXAMS_COMPETITIONS_DB_ENTRY.md"), "utf8")
  );
  if (slugs.length !== records.length) {
    throw new Error(
      `Slug map (${slugs.length}) and JSON records (${records.length}) differ`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: cats } = await client.query<{ id: string; code: string }>(
      "SELECT id, code FROM opportunity_categories"
    );
    const catByCode = new Map(cats.map((c) => [c.code, c.id]));

    let inserted = 0;
    let editions = 0;
    for (let i = 0; i < records.length; i++) {
      const map = slugs[i];
      const data = records[i].data;
      const review = records[i].review_notes;
      if (!map || map.n !== i + 1) {
        throw new Error(`Slug row mismatch at index ${i}`);
      }

      const opp = await client.query<{ id: string }>(
        `INSERT INTO opportunities (
           slug, title, kind, organizer_name, official_url, publication_status
         ) VALUES ($1, $2, $3, $4, $5, 'draft')
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           kind = EXCLUDED.kind,
           organizer_name = EXCLUDED.organizer_name,
           official_url = EXCLUDED.official_url,
           updated_at = now()
         RETURNING id`,
        [
          map.slug,
          data.name,
          map.kind,
          data.organiser,
          data.official_url,
        ]
      );
      const opportunityId = opp.rows[0].id;
      inserted += 1;

      await client.query(
        `DELETE FROM opportunity_category_links WHERE opportunity_id = $1`,
        [opportunityId]
      );
      for (const code of map.categories) {
        const categoryId = catByCode.get(code);
        if (!categoryId) throw new Error(`Unknown category ${code} for ${map.slug}`);
        await client.query(
          `INSERT INTO opportunity_category_links (opportunity_id, category_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [opportunityId, categoryId]
        );
      }

      if (!data.edition_label) continue;

      const key = editionKey(data.edition_label);
      const method = registrationMethod(data.participation_route);
      const scope = scopeFromGeo(data.geographic_eligibility);
      const fee = feeStatus(data.fee_amount);
      const eligibility = [
        data.eligibility_text,
        data.board_eligibility ? `Board: ${data.board_eligibility}` : null,
        data.age_eligibility ? `Age: ${data.age_eligibility}` : null,
        data.geographic_eligibility
          ? `Geography: ${data.geographic_eligibility}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const ed = await client.query<{ id: string }>(
        `INSERT INTO opportunity_editions (
           opportunity_id, edition_key, edition_label, scope_level,
           publication_status, event_status, registration_method,
           registration_url, eligibility_summary, curriculum_policy,
           eligibility_completeness, fee_status
         ) VALUES (
           $1, $2, $3, $4,
           'draft', 'unknown', $5,
           $6, $7, 'unknown',
           'partial', $8
         )
         ON CONFLICT (opportunity_id, edition_key) DO UPDATE SET
           edition_label = EXCLUDED.edition_label,
           scope_level = EXCLUDED.scope_level,
           registration_method = EXCLUDED.registration_method,
           registration_url = EXCLUDED.registration_url,
           eligibility_summary = EXCLUDED.eligibility_summary,
           fee_status = EXCLUDED.fee_status,
           updated_at = now()
         RETURNING id`,
        [
          opportunityId,
          key,
          data.edition_label,
          scope,
          method,
          data.registration_url,
          eligibility || null,
          fee,
        ]
      );
      const editionId = ed.rows[0].id;
      editions += 1;

      await client.query(
        `DELETE FROM opportunity_schedules WHERE edition_id = $1`,
        [editionId]
      );
      await client.query(`DELETE FROM opportunity_fees WHERE edition_id = $1`, [
        editionId,
      ]);
      await client.query(
        `DELETE FROM opportunity_sources WHERE edition_id = $1`,
        [editionId]
      );
      await client.query(
        `DELETE FROM opportunity_eligibility_rules WHERE edition_id = $1`,
        [editionId]
      );
      await client.query(
        `DELETE FROM opportunity_locations WHERE edition_id = $1`,
        [editionId]
      );

      const sourceIds: string[] = [];
      for (const url of data.source_urls ?? []) {
        const src = await client.query<{ id: string }>(
          `INSERT INTO opportunity_sources (edition_id, url, source_type, verification_status)
           VALUES ($1, $2, 'secondary_reference', 'unverified')
           RETURNING id`,
          [editionId, url]
        );
        sourceIds.push(src.rows[0].id);
      }
      const sourceId = sourceIds[0] ?? null;

      if (data.eligibility_text) {
        await client.query(
          `INSERT INTO opportunity_eligibility_rules (
             edition_id, rule_type, operator, rule_text, evaluation_mode, source_id
           ) VALUES ($1, 'other', 'descriptive', $2, 'information_only', $3)`,
          [editionId, data.eligibility_text, sourceId]
        );
      }

      if (data.geographic_eligibility) {
        await client.query(
          `INSERT INTO opportunity_locations (
             edition_id, role, locality, source_id
           ) VALUES ($1, 'eligibility_school', $2, $3)`,
          [editionId, data.geographic_eligibility, sourceId]
        );
      }

      if (data.venue) {
        await client.query(
          `INSERT INTO opportunity_locations (
             edition_id, role, venue_name, source_id
           ) VALUES ($1, 'venue', $2, $3)`,
          [editionId, data.venue, sourceId]
        );
      }

      if (data.fee_amount !== null && data.fee_amount !== undefined) {
        await client.query(
          `INSERT INTO opportunity_fees (
             edition_id, label, amount, currency, fee_type, applicability_text,
             is_mandatory, source_id
           ) VALUES ($1, $2, $3, $4, 'registration', $5, true, $6)`,
          [
            editionId,
            data.fee_basis || "Entry",
            data.fee_amount,
            (data.fee_currency || "INR").slice(0, 3),
            [data.fee_basis, data.fee_tax_note].filter(Boolean).join("; ") ||
              null,
            sourceId,
          ]
        );
      }

      const addDate = async (
        type: "registration" | "event",
        label: string | null,
        startsOn: string | null,
        endsOn: string | null,
        notes: string | null,
        precision: string
      ) => {
        await client.query(
          `INSERT INTO opportunity_schedules (
             edition_id, schedule_type, label, date_status, precision,
             starts_on, ends_on, notes, source_id
           ) VALUES ($1, $2, $3, 'estimated', $4, $5, $6, $7, $8)`,
          [editionId, type, label, precision, startsOn, endsOn, notes, sourceId]
        );
      };

      if (data.registration_opens_on || data.registration_closes_on) {
        await addDate(
          "registration",
          "Registration",
          data.registration_opens_on,
          data.registration_closes_on,
          null,
          data.registration_opens_on && data.registration_closes_on
            ? "window"
            : "date"
        );
      }

      const schedule = data.schedule;
      if (schedule && typeof schedule === "object") {
        const stage =
          typeof schedule.stage === "string" ? schedule.stage : "Event";
        const selection =
          typeof schedule.selection_rule === "string"
            ? schedule.selection_rule
            : null;
        const options = Array.isArray(schedule.date_options)
          ? schedule.date_options.filter((d) => typeof d === "string")
          : [];
        for (const day of options) {
          await addDate("event", stage, day, null, selection, "date");
        }
        if (typeof schedule.date === "string") {
          await addDate("event", stage, schedule.date, null, selection, "date");
        }
        if (
          typeof schedule.window_start === "string" ||
          typeof schedule.window_end === "string"
        ) {
          await addDate(
            "event",
            stage,
            typeof schedule.window_start === "string"
              ? schedule.window_start
              : null,
            typeof schedule.window_end === "string" ? schedule.window_end : null,
            selection,
            "window"
          );
        }
        if (typeof schedule.month === "string") {
          await client.query(
            `INSERT INTO opportunity_schedules (
               edition_id, schedule_type, label, date_status, precision,
               expected_period_text, source_id
             ) VALUES ($1, 'event', $2, 'estimated', 'month', $3, $4)`,
            [editionId, stage, schedule.month, sourceId]
          );
        }
      }

      await client.query(
        `INSERT INTO opportunity_change_log (
           entity_type, entity_id, reason, after_data
         ) VALUES ('opportunity', $1, 'staging import', $2::jsonb)`,
        [
          opportunityId,
          JSON.stringify({
            slug: map.slug,
            review_notes: review,
            imported_as: "draft",
          }),
        ]
      );
    }

    await client.query("COMMIT");
    console.log(
      `Imported ${inserted} draft opportunities (${editions} with editions). Feature flag remains off.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
