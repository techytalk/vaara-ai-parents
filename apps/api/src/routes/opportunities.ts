import { Hono } from "hono";
import { pool } from "@vaara/db";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  deriveRegistrationState,
  eligibilityCoversGrade,
  gradeCheck,
  scopeMatchesSchool,
  searchScore,
} from "../services/opportunity-match.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type EditionRow = {
  id: string;
  edition_key: string;
  edition_label: string;
  scope_level: string;
  fee_status: string;
  registration_method: string;
  event_status: string;
  eligibility_summary: string | null;
  registration_url: string | null;
  official_notice_url: string | null;
};

async function catalogueEnabled(): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT enabled FROM app_feature_flags WHERE key = 'competitive_exams'`
  );
  return rows[0]?.enabled === true;
}

function parseGradeNumber(code: string | null | undefined): number | null {
  if (!code) return null;
  const match = code.trim().match(/^[GY](\d+)$/i);
  return match ? Number(match[1]) : null;
}

/** True when official eligibility text explicitly includes this class number. */
export { eligibilityCoversGrade };

async function loadOwnedChildContext(
  userId: string,
  childId: string
): Promise<
  | { grade: number | null; schoolState: string | null }
  | "missing"
> {
  const { rows } = await pool.query(
    `SELECT g.code, s.state
     FROM children ch
     JOIN schools s ON s.id = ch.school_id
     LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
     WHERE ch.id = $1 AND ch.user_id = $2`,
    [childId, userId]
  );
  if (!rows[0]) return "missing";
  return {
    grade: parseGradeNumber(rows[0].code as string | null),
    schoolState: (rows[0].state as string | null) ?? null,
  };
}

function mapEdition(
  row: (EditionRow & { edition_id?: string }) | null
) {
  const id = row?.edition_id ?? (row && "edition_key" in row ? row.id : undefined);
  if (!row || !id || !row.edition_key) return null;
  return {
    id,
    editionKey: row.edition_key,
    editionLabel: row.edition_label,
    scopeLevel: row.scope_level,
    feeStatus: row.fee_status,
    registrationMethod: row.registration_method,
    eventStatus: row.event_status,
    eligibilitySummary: row.eligibility_summary,
    registrationUrl: row.registration_url,
    officialNoticeUrl: row.official_notice_url,
  };
}

export function createOpportunityRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/summary", async (c) => {
    const enabled = await catalogueEnabled();
    if (!enabled) return c.json({ enabled: false, matchCount: 0, publishedCount: 0 });

    const childId = c.req.query("childId")?.trim() || null;
    const { rows } = await pool.query(
      `SELECT e.eligibility_summary, e.scope_level,
              (SELECT l.state_code FROM opportunity_locations l
                WHERE l.edition_id = e.id AND l.role = 'eligibility_school'
                ORDER BY l.created_at LIMIT 1) AS state_code
       FROM opportunities o
       JOIN opportunity_editions e ON e.opportunity_id = o.id
       WHERE o.publication_status = 'published'
         AND e.publication_status = 'published'`
    );
    const publishedCount = rows.length;
    if (!childId) {
      return c.json({ enabled: true, publishedCount, matchCount: publishedCount });
    }
    const owned = await loadOwnedChildContext(c.get("user").sub, childId);
    if (owned === "missing") return c.json({ error: "Not found" }, 404);
    const matchCount = rows.filter((row) => {
      if (!eligibilityCoversGrade(row.eligibility_summary as string | null, owned.grade)) {
        return false;
      }
      return scopeMatchesSchool(
        row.scope_level as string,
        owned.schoolState,
        row.state_code as string | null
      );
    }).length;
    return c.json({ enabled: true, publishedCount, matchCount });
  });

  app.get("/", async (c) => {
    if (!(await catalogueEnabled())) {
      return c.json({ enabled: false, items: [], nextCursor: null });
    }

    const limitRaw = Number(c.req.query("limit") ?? DEFAULT_LIMIT);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT)
    );
    const q = c.req.query("q")?.trim() || null;
    const cursor = c.req.query("cursor")?.trim() || null;
    const segment = c.req.query("segment") === "suggested" ? "suggested" : "all";
    const childId = c.req.query("childId")?.trim() || null;

    let child: { grade: number | null; schoolState: string | null } | null = null;
    if (childId) {
      const owned = await loadOwnedChildContext(c.get("user").sub, childId);
      if (owned === "missing") return c.json({ error: "Not found" }, 404);
      child = owned;
    }

    const { rows } = await pool.query(
      `SELECT o.id, o.slug, o.title, o.kind, o.organizer_name,
              e.id AS edition_id, e.edition_key, e.edition_label,
              e.scope_level, e.fee_status, e.registration_method, e.event_status,
              e.eligibility_summary, e.registration_url, e.official_notice_url,
              (SELECT l.state_code FROM opportunity_locations l
                WHERE l.edition_id = e.id AND l.role = 'eligibility_school'
                ORDER BY l.created_at LIMIT 1) AS state_code
       FROM opportunities o
       JOIN opportunity_editions e ON e.opportunity_id = o.id
       WHERE o.publication_status = 'published'
         AND e.publication_status = 'published'
       ORDER BY o.title, e.edition_label`
    );

    const editionIds = rows.map((row) => row.edition_id as string);
    const schedules = editionIds.length
      ? await pool.query(
          `SELECT edition_id, schedule_type, starts_on::text, ends_on::text, date_status
           FROM opportunity_schedules
           WHERE edition_id = ANY($1::uuid[]) AND superseded_at IS NULL`,
          [editionIds]
        )
      : { rows: [] as Array<Record<string, string>> };
    const byEdition = new Map<string, Array<Record<string, string>>>();
    for (const row of schedules.rows) {
      const list = byEdition.get(String(row.edition_id)) ?? [];
      list.push(row);
      byEdition.set(String(row.edition_id), list);
    }

    type Card = {
      id: string;
      slug: string;
      title: string;
      kind: string;
      organizerName: string | null;
      score: number;
      edition: ReturnType<typeof mapEdition>;
      registrationState: string;
      checks: { grade: string; geography: string; summary: string };
    };

    const cards: Card[] = [];
    for (const row of rows) {
      const editionSchedules = (byEdition.get(String(row.edition_id)) ?? []).map((item) => ({
        scheduleType: String(item.schedule_type),
        startsOn: item.starts_on ? String(item.starts_on).slice(0, 10) : null,
        endsOn: item.ends_on ? String(item.ends_on).slice(0, 10) : null,
        dateStatus: String(item.date_status),
      }));
      const registrationState = deriveRegistrationState({
        eventStatus: row.event_status as string,
        registrationMethod: row.registration_method as string,
        schedules: editionSchedules,
      });
      const openish = registrationState === "open" || registrationState === "opening_soon" || registrationState === "unknown" || registrationState === "check_with_school" || registrationState === "dates_unannounced";
      if (!openish && registrationState === "closed") {
        // Past editions stay in All, not in the suggested set.
      }
      const gradeResult = child ? gradeCheck(row.eligibility_summary as string | null, child.grade) : "unknown";
      const geoOk = scopeMatchesSchool(
        row.scope_level as string,
        child?.schoolState,
        row.state_code as string | null
      );
      if (segment === "suggested") {
        if (!child || gradeResult !== "pass" || !geoOk) continue;
        if (registrationState === "closed" || registrationState === "cancelled") continue;
      } else if (child && !geoOk && row.scope_level === "state") {
        continue;
      }
      const score = searchScore(q, {
        title: String(row.title),
        organizer: row.organizer_name as string | null,
        editionLabel: row.edition_label as string | null,
      });
      if (q && score <= 0) continue;
      const summary =
        gradeResult === "fail"
          ? "does_not_match"
          : gradeResult === "pass" && geoOk
            ? "needs_confirmation"
            : "needs_confirmation";
      cards.push({
        id: String(row.edition_id),
        slug: String(row.slug),
        title: String(row.title),
        kind: String(row.kind),
        organizerName: (row.organizer_name as string | null) ?? null,
        score,
        edition: mapEdition(row as EditionRow & { edition_id: string }),
        registrationState,
        checks: {
          grade: gradeResult,
          geography: geoOk ? "pass" : "unknown",
          summary,
        },
      });
    }

    if (segment === "suggested" && childId) {
      const bucket = await pool.query(
        `SELECT b.edition_id
         FROM opportunity_suggestion_buckets b
         JOIN children ch ON ch.grade_id = b.curriculum_grade_id
         JOIN schools s ON s.id = ch.school_id AND lower(s.state) = lower(b.state_code)
         WHERE ch.id = $1 AND ch.user_id = $2`,
        [childId, c.get("user").sub]
      );
      if (bucket.rows.length > 0) {
        const allowed = new Set(bucket.rows.map((row) => String(row.edition_id)));
        for (let i = cards.length - 1; i >= 0; i--) {
          if (!allowed.has(cards[i].id)) cards.splice(i, 1);
        }
      }
    }

    cards.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
    let start = 0;
    if (cursor) {
      const idx = cards.findIndex((card) => card.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const page = cards.slice(start, start + limit);
    const next = start + limit < cards.length ? page[page.length - 1]?.id ?? null : null;

    return c.json({
      enabled: true,
      items: page.map(({ score: _score, ...item }) => item),
      nextCursor: next,
    });
  });

  app.get("/:slug", async (c) => {
    if (!(await catalogueEnabled())) {
      return c.json({ enabled: false, opportunity: null }, 404);
    }
    const slug = c.req.param("slug");
    const { rows } = await pool.query(
      `SELECT id, slug, title, summary, description, kind, organizer_name, official_url
       FROM opportunities
       WHERE (slug = $1 OR id IN (
         SELECT opportunity_id FROM opportunity_slug_aliases WHERE alias = $1
       ))
         AND publication_status = 'published'`,
      [slug]
    );
    if (!rows[0]) return c.json({ error: "Not found" }, 404);

    const editions = await pool.query(
      `SELECT id, edition_key, edition_label, scope_level, fee_status,
              registration_method, event_status, eligibility_summary,
              registration_url, official_notice_url
       FROM opportunity_editions
       WHERE opportunity_id = $1 AND publication_status = 'published'
       ORDER BY edition_label, id`,
      [rows[0].id]
    );

    const editionIds = editions.rows.map((ed) => ed.id);
    const schedules =
      editionIds.length === 0
        ? { rows: [] as Array<Record<string, unknown>> }
        : await pool.query(
            `SELECT edition_id, schedule_type, label, date_status, precision,
                    starts_on, ends_on, expected_period_text, notes
             FROM opportunity_schedules
             WHERE edition_id = ANY($1::uuid[])
               AND superseded_at IS NULL
             ORDER BY starts_on NULLS LAST, id`,
            [editionIds]
          );
    const fees =
      editionIds.length === 0
        ? { rows: [] as Array<Record<string, unknown>> }
        : await pool.query(
            `SELECT edition_id, label, amount, currency, fee_type,
                    applicability_text, is_mandatory
             FROM opportunity_fees
             WHERE edition_id = ANY($1::uuid[])`,
            [editionIds]
          );

    return c.json({
      enabled: true,
      opportunity: {
        id: rows[0].id,
        slug: rows[0].slug,
        title: rows[0].title,
        summary: rows[0].summary,
        description: rows[0].description,
        kind: rows[0].kind,
        organizerName: rows[0].organizer_name,
        officialUrl: rows[0].official_url,
        editions: editions.rows.map((ed) => ({
          ...mapEdition(ed as EditionRow),
          registrationState: deriveRegistrationState({
            eventStatus: ed.event_status as string,
            registrationMethod: ed.registration_method as string,
            schedules: schedules.rows
              .filter((s) => s.edition_id === ed.id)
              .map((s) => ({
                scheduleType: String(s.schedule_type),
                startsOn: s.starts_on ? String(s.starts_on).slice(0, 10) : null,
                endsOn: s.ends_on ? String(s.ends_on).slice(0, 10) : null,
                dateStatus: String(s.date_status),
              })),
          }),
          schedules: schedules.rows
            .filter((s) => s.edition_id === ed.id)
            .map((s) => ({
              type: s.schedule_type,
              label: s.label,
              dateStatus: s.date_status,
              precision: s.precision,
              startsOn: s.starts_on,
              endsOn: s.ends_on,
              periodText: s.expected_period_text,
              notes: s.notes,
            })),
          fees: fees.rows
            .filter((f) => f.edition_id === ed.id)
            .map((f) => ({
              label: f.label,
              amount: f.amount,
              currency: f.currency,
              feeType: f.fee_type,
              applicability: f.applicability_text,
              mandatory: f.is_mandatory,
            })),
        })),
      },
    });
  });

  return app;
}
