import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { pool } from "@vaara/db";
import { processBackgroundJobs } from "../services/notifications.js";
import {
  dryRunSchoolMerge,
  listDuplicateCandidates,
  queueSchoolMerge,
  processQueuedSchoolMerges,
  refreshAffinityViews,
} from "../services/school-merge.js";
import { buildSchoolCatalog } from "../services/school-catalog.js";
import {
  comparePastedToCatalog,
  parsePastedSchoolList,
  summarizeCompare,
  type CatalogSchool,
} from "../services/school-list-compare.js";
import {
  findSeedGaps,
  listInternalSeeds,
  postAsInternal,
  setInternalStatus,
  spawnInternalPair,
  type SeedTarget,
} from "../services/internal-seed.js";
import { publishChatNudge } from "../services/chat.js";
import { signAdminToken, verifyAdminToken } from "../lib/jwt.js";
import { mountAdminModeration } from "./admin-moderation.js";
import { rebuildOpportunitySuggestions } from "../services/opportunity-suggestions.js";
import { getAdminDashboard } from "../services/admin-dashboard.js";
import {
  adminGenerateWinningMoments,
  adminGetLuckyGiftCampaign,
  adminListWinners,
  adminUpdateLuckyGiftCampaign,
} from "../services/lucky-gift.js";

function cronBearer(c: { req: { header: (n: string) => string | undefined } }) {
  const expected = process.env.CRON_SECRET;
  const auth = c.req.header("Authorization") ?? "";
  return Boolean(expected && auth === `Bearer ${expected}`);
}

function requireCronSecret(c: { req: { header: (n: string) => string | undefined } }) {
  const secret = c.req.header("X-Cron-Secret");
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && secret === expected);
}

function safeEqualString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function extractBearer(c: { req: { header: (n: string) => string | undefined } }) {
  const auth = c.req.header("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return m?.[1]?.trim() || null;
}

/** Login session (Bearer) or legacy X-Admin-Secret for scripts. */
async function requireAdminAuth(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<{ email: string } | null> {
  const bearer = extractBearer(c);
  if (bearer) {
    try {
      const admin = await verifyAdminToken(bearer);
      return { email: admin.email };
    } catch {
      /* fall through */
    }
  }

  const secret = c.req.header("X-Admin-Secret");
  const expected = process.env.ADMIN_API_SECRET;
  if (expected && secret && safeEqualString(secret, expected)) {
    return { email: "admin-secret" };
  }
  return null;
}

function seedFail(result: { ok: false; error: string; status: number }) {
  return result;
}

function mergesEnabled(): boolean {
  return process.env.SCHOOL_MERGES_ENABLED === "true";
}

export function createInternalRoutes() {
  const app = new Hono();

  // ---- Ops admin login (email + password from env) ----
  app.post("/admin/login", async (c) => {
    const expectedEmail = (process.env.ADMIN_LOGIN_EMAIL ?? "").trim().toLowerCase();
    const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD ?? "";
    if (!expectedEmail || !expectedPassword) {
      return c.json(
        { error: "Admin login is not configured (ADMIN_LOGIN_EMAIL / ADMIN_LOGIN_PASSWORD)" },
        503
      );
    }

    let body: { email?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return c.json({ error: "email and password required" }, 400);
    }

    if (!safeEqualString(email, expectedEmail) || !safeEqualString(password, expectedPassword)) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const token = await signAdminToken(email);
    return c.json({
      ok: true,
      token,
      email,
      expiresIn: "12h",
    });
  });

  app.get("/admin/me", async (c) => {
    const admin = await requireAdminAuth(c);
    if (!admin) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ ok: true, email: admin.email });
  });

  app.post("/cron/opportunity-suggestions", async (c) => {
    if (!requireCronSecret(c) && !cronBearer(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const client = await pool.connect();
    try {
      const result = await rebuildOpportunitySuggestions(client);
      return c.json({ ok: true, ...result });
    } catch (error) {
      console.error("[cron.opportunity-suggestions] failed", error);
      return c.json({ error: "Could not rebuild suggestions" }, 500);
    } finally {
      client.release();
    }
  });

  app.get("/cron/opportunity-suggestions", async (c) => {
    if (!requireCronSecret(c) && !cronBearer(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const client = await pool.connect();
    try {
      const result = await rebuildOpportunitySuggestions(client);
      return c.json({ ok: true, ...result });
    } catch (error) {
      console.error("[cron.opportunity-suggestions] failed", error);
      return c.json({ error: "Could not rebuild suggestions" }, 500);
    } finally {
      client.release();
    }
  });

  app.post("/cron/reminders", async (c) => {
    if (!requireCronSecret(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const client = await pool.connect();
    try {
      const result = await processBackgroundJobs(client);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  app.post("/cron/school-affinity-refresh", async (c) => {
    if (!requireCronSecret(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const client = await pool.connect();
    try {
      await refreshAffinityViews(client);
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/cron/school-catalog-rebuild", async (c) => {
    if (!requireCronSecret(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const client = await pool.connect();
    try {
      const result = await buildSchoolCatalog(client);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  app.post("/cron/school-merges", async (c) => {
    if (!requireCronSecret(c)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!mergesEnabled()) {
      return c.json({
        ok: true,
        skipped: true,
        reason: "SCHOOL_MERGES_ENABLED is not true",
      });
    }
    const limit = Math.min(Number(c.req.query("limit") ?? 3), 10);
    const client = await pool.connect();
    try {
      const result = await processQueuedSchoolMerges(client, limit);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  // ---- Admin school moderation (secret-gated) ----

  app.get("/admin/schools/duplicates", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const status = c.req.query("status") ?? "open";
    const client = await pool.connect();
    try {
      const rows = await listDuplicateCandidates(client, status);
      return c.json({ candidates: rows });
    } finally {
      client.release();
    }
  });

  app.post("/admin/schools/duplicates/:id/dismiss", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const body = (await c.req
      .json<{ note?: string; reviewer?: string }>()
      .catch(() => ({}))) as { note?: string; reviewer?: string };
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE school_duplicate_candidates
         SET status = 'dismissed',
             admin_note = coalesce($2, admin_note),
             decided_by = $3,
             decided_at = now()
         WHERE id = $1`,
        [id, body.note ?? null, body.reviewer ?? "admin"]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/admin/schools/duplicates/:id/investigate", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const body = (await c.req
      .json<{ note?: string; reviewer?: string }>()
      .catch(() => ({}))) as { note?: string; reviewer?: string };
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE school_duplicate_candidates
         SET status = 'investigating',
             admin_note = coalesce($2, admin_note),
             decided_by = $3,
             decided_at = now()
         WHERE id = $1`,
        [id, body.note ?? null, body.reviewer ?? "admin"]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/admin/schools/merge/dry-run", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json<{
      sourceId?: string;
      survivorId?: string;
    }>();
    if (!body.sourceId || !body.survivorId) {
      return c.json({ error: "sourceId and survivorId required" }, 400);
    }
    const client = await pool.connect();
    try {
      const preview = await dryRunSchoolMerge(
        client,
        body.sourceId,
        body.survivorId
      );
      return c.json(preview);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Dry-run failed" },
        400
      );
    } finally {
      client.release();
    }
  });

  app.post("/admin/schools/merge", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json<{
      sourceId?: string;
      survivorId?: string;
      candidateId?: string;
      reviewer?: string;
      conflictPolicy?: { reviews?: "keep_survivor" | "keep_newer" | "keep_source" };
      confirm?: boolean;
    }>();
    if (!body.sourceId || !body.survivorId) {
      return c.json({ error: "sourceId and survivorId required" }, 400);
    }
    if (!body.confirm) {
      return c.json(
        { error: "Set confirm=true after reviewing dry-run results" },
        400
      );
    }
    const client = await pool.connect();
    try {
      // Queue only — execution requires SCHOOL_MERGES_ENABLED + cron worker.
      const queued = await queueSchoolMerge(client, {
        sourceId: body.sourceId,
        survivorId: body.survivorId,
        candidateId: body.candidateId,
        reviewer: body.reviewer ?? "admin",
        conflictPolicy: body.conflictPolicy,
      });
      return c.json({
        ok: true,
        queued: true,
        ledgerId: queued.ledgerId,
        mergesEnabled: mergesEnabled(),
        message: mergesEnabled()
          ? "Queued. Cron /internal/cron/school-merges will process it."
          : "Queued. Set SCHOOL_MERGES_ENABLED=true and run school-merges cron to execute.",
      });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Queue failed" },
        400
      );
    } finally {
      client.release();
    }
  });

  app.get("/admin/schools/unverified", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT s.id, s.name, s.branch, s.city, s.state, s.pin_code, s.locality,
                s.region, s.aliases, s.created_at, s.created_by_user_id,
                u.email AS creator_email
         FROM schools s
         LEFT JOIN users u ON u.id = s.created_by_user_id
         WHERE s.verified = false
           AND s.redirect_to_school_id IS NULL
           AND s.normalized_key <> 'school_not_specified||unknown'
         ORDER BY s.created_at DESC
         LIMIT 100`
      );
      return c.json({ schools: rows });
    } finally {
      client.release();
    }
  });

  app.post("/admin/schools/:id/verify", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const body = await c.req
      .json<{
        reviewer?: string;
        name?: string;
        branch?: string;
        locality?: string;
        region?: string;
        city?: string;
        state?: string;
        pinCode?: string;
        aliases?: string[];
      }>()
      .catch(() => ({} as Record<string, never>));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE schools SET
           name = coalesce($2, name),
           branch = coalesce($3, branch),
           locality = coalesce($4, locality),
           region = coalesce($5, region),
           city = coalesce($6, city),
           state = coalesce($7, state),
           pin_code = coalesce($8, pin_code),
           aliases = coalesce($9::text[], aliases),
           verified = true,
           verified_at = now(),
           verified_by = $10,
           updated_at = now()
         WHERE id = $1`,
        [
          id,
          body.name ?? null,
          body.branch ?? null,
          body.locality ?? null,
          body.region ?? null,
          body.city ?? null,
          body.state ?? null,
          body.pinCode ?? null,
          body.aliases ?? null,
          body.reviewer ?? "admin",
        ]
      );
      const catalog = await buildSchoolCatalog(client);
      await client.query("COMMIT");
      return c.json({ ok: true, catalog });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // ---- Admin parent signups ----

  app.get("/admin/parents", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const dateParam = (c.req.query("date") ?? "").trim();
    const status = (c.req.query("status") ?? "all").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 200), 1), 500);

    // YYYY-MM-DD in Asia/Kolkata; default = today IST
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
    const daySql = dateOk ? dateParam : null;
    const statusFilter =
      status === "complete"
        ? "AND u.onboarding_complete IS TRUE"
        : status === "incomplete"
          ? "AND COALESCE(u.onboarding_complete, false) IS FALSE"
          : status === "blocked"
            ? "AND u.content_blocked IS TRUE"
            : "";

    const client = await pool.connect();
    try {
      const { rows: summaryRows } = await client.query(
        `WITH day AS (
           SELECT COALESCE($1::date, (now() AT TIME ZONE 'Asia/Kolkata')::date) AS d
         )
         SELECT
           day.d::text AS date,
           COUNT(u.id)::int AS total,
           COUNT(u.id) FILTER (WHERE u.onboarding_complete IS TRUE)::int AS complete,
           COUNT(u.id) FILTER (WHERE u.id IS NOT NULL AND COALESCE(u.onboarding_complete, false) IS FALSE)::int AS incomplete,
           COUNT(u.id) FILTER (WHERE u.content_blocked IS TRUE)::int AS blocked
         FROM day
         LEFT JOIN users u
           ON u.role = 'parent'
          AND (u.created_at AT TIME ZONE 'Asia/Kolkata')::date = day.d
         GROUP BY day.d`,
        [daySql]
      );

      const { rows: parents } = await client.query(
        `WITH day AS (
           SELECT COALESCE($1::date, (now() AT TIME ZONE 'Asia/Kolkata')::date) AS d
         )
         SELECT
           u.id,
           u.email,
           u.display_name,
           u.anonymous_handle,
           u.onboarding_complete,
           u.content_blocked,
           u.content_blocked_reason,
           to_char(u.content_blocked_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS blocked_ist,
           to_char(u.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
           to_char(u.updated_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS updated_ist,
           loc.pin_code,
           loc.locality,
           loc.city,
           loc.state,
           COALESCE(ch.child_count, 0)::int AS child_count,
           ch.first_school
         FROM day
         JOIN users u
           ON u.role = 'parent'
          AND (u.created_at AT TIME ZONE 'Asia/Kolkata')::date = day.d
         LEFT JOIN user_locations loc ON loc.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS child_count,
             MIN(
               NULLIF(
                 concat_ws(
                   ' · ',
                   NULLIF(trim(s.name), ''),
                   NULLIF(trim(s.branch), ''),
                   NULLIF(trim(s.city), '')
                 ),
                 ''
               )
             ) AS first_school
           FROM children c
           LEFT JOIN schools s ON s.id = c.school_id
           WHERE c.user_id = u.id
         ) ch ON true
         WHERE TRUE
           ${statusFilter}
         ORDER BY u.created_at DESC
         LIMIT $2`,
        [daySql, limit]
      );

      const { rows: recentDays } = await client.query(
        `SELECT
           (created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS date,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE onboarding_complete IS TRUE)::int AS complete,
           COUNT(*) FILTER (WHERE COALESCE(onboarding_complete, false) IS FALSE)::int AS incomplete,
           COUNT(*) FILTER (WHERE content_blocked IS TRUE)::int AS blocked
         FROM users
         WHERE role = 'parent'
         GROUP BY 1
         ORDER BY 1 DESC`
      );

      return c.json({
        ok: true,
        timezone: "Asia/Kolkata",
        summary: summaryRows[0] ?? null,
        recentDays,
        parents,
      });
    } finally {
      client.release();
    }
  });

  // ---- Admin school list compare (analysis only) ----

  app.post("/admin/schools/compare", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    let body: {
      text?: string;
      area?: string | null;
      region?: string | null;
      limit?: number;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return c.json({ error: "text is required (paste a school list)" }, 400);
    }
    if (text.length > 200_000) {
      return c.json({ error: "text too long (max 200k chars)" }, 400);
    }

    const defaultArea =
      typeof body.area === "string" && body.area.trim()
        ? body.area.trim()
        : null;
    const regionFilter =
      typeof body.region === "string" && body.region.trim()
        ? body.region.trim()
        : null;
    const limit = Math.min(Math.max(Number(body.limit ?? 8000), 100), 12000);

    const pasted = parsePastedSchoolList(text, defaultArea);
    if (pasted.length === 0) {
      return c.json({
        error: "Could not parse any schools from the pasted text",
      }, 400);
    }
    if (pasted.length > 500) {
      return c.json({ error: "Max 500 schools per compare" }, 400);
    }

    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let sql = `
        SELECT
          s.id::text AS id,
          s.name,
          s.branch,
          s.locality,
          s.region,
          s.city,
          s.board_codes,
          s.grades_offered,
          s.normalized_key,
          s.verified
        FROM schools s
        WHERE s.redirect_to_school_id IS NULL
          AND s.normalized_key <> 'school_not_specified||unknown'
      `;
      if (regionFilter) {
        params.push(regionFilter);
        sql += ` AND s.region = $${params.length}`;
      }
      params.push(limit);
      sql += ` ORDER BY s.name LIMIT $${params.length}`;

      const { rows } = await client.query(sql, params);
      const catalog = rows as CatalogSchool[];
      const results = comparePastedToCatalog(pasted, catalog, defaultArea);
      const summary = summarizeCompare(results);

      return c.json({
        ok: true,
        analysisOnly: true,
        filters: {
          area: defaultArea,
          region: regionFilter,
          catalogSize: catalog.length,
        },
        summary,
        results,
        buckets: {
          on_site: results.filter((r) => r.status === "on_site"),
          brand_elsewhere: results.filter((r) => r.status === "brand_elsewhere"),
          maybe: results.filter((r) => r.status === "maybe"),
          missing: results.filter((r) => r.status === "missing"),
        },
      });
    } finally {
      client.release();
    }
  });

  // ---- Admin school directory by region/locality ----

  app.get("/admin/schools/directory", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const regionParam = (c.req.query("region") ?? "").trim();
    const localityParam = (c.req.query("locality") ?? "").trim();
    const verifiedParam = (c.req.query("verified") ?? "all").trim().toLowerCase();
    const q = (c.req.query("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 2000), 1), 5000);

    const client = await pool.connect();
    try {
      const { rows: tree } = await client.query(
        `SELECT
           coalesce(region, '(no region)') AS region,
           coalesce(locality, '(no locality)') AS locality,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE verified IS TRUE)::int AS verified,
           COUNT(*) FILTER (WHERE verified IS NOT TRUE)::int AS unverified
         FROM schools s
         WHERE s.redirect_to_school_id IS NULL
           AND s.normalized_key <> 'school_not_specified||unknown'
         GROUP BY 1, 2
         ORDER BY 1, 2`
      );

      const { rows: regions } = await client.query(
        `SELECT
           coalesce(region, '(no region)') AS region,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE verified IS TRUE)::int AS verified,
           COUNT(*) FILTER (WHERE verified IS NOT TRUE)::int AS unverified,
           COUNT(DISTINCT coalesce(locality, '(no locality)'))::int AS localities
         FROM schools s
         WHERE s.redirect_to_school_id IS NULL
           AND s.normalized_key <> 'school_not_specified||unknown'
         GROUP BY 1
         ORDER BY 1`
      );

      const params: unknown[] = [];
      let sql = `
        SELECT
          s.id,
          s.name,
          s.branch,
          s.locality,
          s.region,
          s.city,
          s.state,
          s.pin_code,
          s.verified,
          to_char(s.verified_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS verified_at_ist,
          s.verified_by,
          to_char(s.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist
        FROM schools s
        WHERE s.redirect_to_school_id IS NULL
          AND s.normalized_key <> 'school_not_specified||unknown'
      `;

      if (regionParam === "(no region)") {
        sql += ` AND s.region IS NULL`;
      } else if (regionParam) {
        params.push(regionParam);
        sql += ` AND s.region = $${params.length}`;
      }

      if (localityParam === "(no locality)") {
        sql += ` AND s.locality IS NULL`;
      } else if (localityParam) {
        params.push(localityParam);
        sql += ` AND s.locality = $${params.length}`;
      }

      if (verifiedParam === "verified") {
        sql += ` AND s.verified IS TRUE`;
      } else if (verifiedParam === "unverified") {
        sql += ` AND s.verified IS NOT TRUE`;
      }

      if (q) {
        params.push(q);
        sql += ` AND (
          s.name ILIKE '%' || $${params.length} || '%'
          OR coalesce(s.branch, '') ILIKE '%' || $${params.length} || '%'
          OR coalesce(s.locality, '') ILIKE '%' || $${params.length} || '%'
          OR coalesce(s.city, '') ILIKE '%' || $${params.length} || '%'
        )`;
      }

      params.push(limit);
      sql += `
        ORDER BY s.region NULLS LAST, s.locality NULLS LAST, s.verified DESC, s.name, s.branch
        LIMIT $${params.length}`;

      const { rows: schools } = await client.query(sql, params);

      const { rows: totals } = await client.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE verified IS TRUE)::int AS verified,
           COUNT(*) FILTER (WHERE verified IS NOT TRUE)::int AS unverified,
           COUNT(DISTINCT coalesce(region, '(no region)'))::int AS regions,
           COUNT(DISTINCT coalesce(locality, '(no locality)'))::int AS localities
         FROM schools s
         WHERE s.redirect_to_school_id IS NULL
           AND s.normalized_key <> 'school_not_specified||unknown'`
      );

      return c.json({
        ok: true,
        filters: {
          region: regionParam || null,
          locality: localityParam || null,
          verified: verifiedParam,
          q: q || null,
        },
        summary: totals[0] ?? null,
        regions,
        tree,
        schools,
      });
    } finally {
      client.release();
    }
  });

  // ---- Admin circle membership overview (open for now; re-gate later) ----

  const CIRCLE_TYPES = new Set([
    "locality",
    "school",
    "class",
    "curriculum",
    "school_class",
    "school_age",
    "age_locality",
    "community",
  ]);

  /** Automated / seed accounts created by speed tests, e2e, and fixtures. */
  function testEmailSql(emailCol = "u.email") {
    return `(
      ${emailCol} ILIKE '%@vaara.test'
      OR ${emailCol} ILIKE '%@example.com'
      OR ${emailCol} ILIKE '%@test.com'
      OR ${emailCol} ILIKE '%cloudtestlabaccounts.com'
      OR ${emailCol} ILIKE 'speedtest.%'
    )`;
  }

  app.get("/admin/circles", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const typeParam = (c.req.query("type") ?? "all").trim().toLowerCase();
    const q = (c.req.query("q") ?? "").trim();
    const minMembers = Math.max(Number(c.req.query("minMembers") ?? 1), 0);
    const excludeTest =
      ["1", "true", "yes"].includes(
        (c.req.query("excludeTest") ?? "").trim().toLowerCase()
      );
    const excludeInternal =
      ["1", "true", "yes"].includes(
        (c.req.query("excludeInternal") ?? "").trim().toLowerCase()
      );
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 500), 1), 2000);

    if (typeParam !== "all" && !CIRCLE_TYPES.has(typeParam)) {
      return c.json({ error: "Invalid type" }, 400);
    }

    const testU = testEmailSql("u.email");
    const parentClauses = [`u.role = 'parent'`];
    if (excludeTest) parentClauses.push(`NOT ${testU}`);
    if (excludeInternal) parentClauses.push(`u.is_internal IS NOT TRUE`);
    const parentFilterSql = parentClauses.join(" AND ");

    const usersClauses = [`role = 'parent'`];
    if (excludeTest) usersClauses.push(`NOT ${testEmailSql("email")}`);
    if (excludeInternal) usersClauses.push(`is_internal IS NOT TRUE`);
    const usersParentSql = usersClauses.join(" AND ");

    const client = await pool.connect();
    try {
      const { rows: testEmailRows } = await client.query(
        `SELECT email
         FROM users u
         WHERE u.role = 'parent' AND ${testU}
         ORDER BY email`
      );

      const { rows: summaryRows } = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM users WHERE ${usersParentSql}) AS parents_total,
           (SELECT COUNT(*)::int FROM users WHERE ${usersParentSql} AND onboarding_complete IS TRUE) AS parents_complete,
           (SELECT COUNT(DISTINCT cm.user_id)::int
              FROM circle_members cm
              JOIN users u ON u.id = cm.user_id
             WHERE ${parentFilterSql}) AS parents_in_circles,
           (SELECT COUNT(*)::int FROM circles) AS circles_total,
           (SELECT COUNT(*)::int
              FROM circles c
              WHERE EXISTS (
                SELECT 1
                FROM circle_members cm
                JOIN users u ON u.id = cm.user_id
                WHERE cm.circle_id = c.id AND ${parentFilterSql}
              )
           ) AS circles_with_members,
           (SELECT COUNT(*)::int
              FROM circle_members cm
              JOIN users u ON u.id = cm.user_id
             WHERE ${parentFilterSql}) AS memberships,
           (SELECT COUNT(*)::int FROM users u WHERE u.role = 'parent' AND ${testU}) AS test_parents,
           (SELECT COUNT(*)::int FROM users u WHERE u.role = 'parent' AND u.is_internal IS TRUE) AS internal_parents`
      );

      const { rows: byType } = await client.query(
        `SELECT
           c.circle_type::text AS circle_type,
           COUNT(*)::int AS circles,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1
               FROM circle_members cm
               JOIN users u ON u.id = cm.user_id
               WHERE cm.circle_id = c.id AND ${parentFilterSql}
             )
           )::int AS circles_with_members,
           COALESCE(SUM(m.member_count), 0)::int AS memberships,
           COALESCE(SUM(m.parent_count), 0)::int AS parents
         FROM circles c
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS member_count,
             COUNT(*) FILTER (WHERE ${parentFilterSql})::int AS parent_count
           FROM circle_members cm
           JOIN users u ON u.id = cm.user_id
           WHERE cm.circle_id = c.id
         ) m ON true
         GROUP BY c.circle_type
         ORDER BY parents DESC, circles DESC`
      );

      const params: unknown[] = [];
      let sql = `
        SELECT
          c.id,
          c.circle_type::text AS circle_type,
          c.key,
          c.display_name,
          c.metadata,
          COALESCE(m.member_count, 0)::int AS member_count,
          COALESCE(m.parent_count, 0)::int AS parent_count,
          to_char(c.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist
        FROM circles c
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS member_count,
            COUNT(*) FILTER (WHERE ${parentFilterSql})::int AS parent_count
          FROM circle_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.circle_id = c.id
        ) m ON true
        WHERE TRUE
      `;

      if (typeParam !== "all") {
        params.push(typeParam);
        sql += ` AND c.circle_type::text = $${params.length}`;
      }

      if (minMembers > 0) {
        params.push(minMembers);
        sql += ` AND COALESCE(m.parent_count, 0) >= $${params.length}`;
      }

      if (q) {
        params.push(q);
        sql += ` AND (
          c.display_name ILIKE '%' || $${params.length} || '%'
          OR c.key ILIKE '%' || $${params.length} || '%'
          OR coalesce(c.metadata->>'pin_code', '') ILIKE '%' || $${params.length} || '%'
          OR coalesce(c.metadata->>'code', '') ILIKE '%' || $${params.length} || '%'
        )`;
      }

      params.push(limit);
      sql += `
        ORDER BY COALESCE(m.parent_count, 0) DESC, c.display_name
        LIMIT $${params.length}`;

      const { rows: circles } = await client.query(sql, params);

      return c.json({
        ok: true,
        filters: {
          type: typeParam,
          q: q || null,
          minMembers,
          excludeTest,
          excludeInternal,
        },
        summary: summaryRows[0] ?? null,
        byType,
        circles,
        testEmails: testEmailRows.map((r) => r.email as string),
      });
    } finally {
      client.release();
    }
  });

  app.get("/admin/circles/:id/members", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const id = (c.req.param("id") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return c.json({ error: "Invalid circle id" }, 400);
    }
    const excludeTest =
      ["1", "true", "yes"].includes(
        (c.req.query("excludeTest") ?? "").trim().toLowerCase()
      );
    const excludeInternal =
      ["1", "true", "yes"].includes(
        (c.req.query("excludeInternal") ?? "").trim().toLowerCase()
      );
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 300), 1), 500);
    const testU = testEmailSql("u.email");
    const memberClauses = [`cm.circle_id = $1`];
    if (excludeTest) memberClauses.push(`NOT ${testU}`);
    if (excludeInternal) memberClauses.push(`u.is_internal IS NOT TRUE`);
    const memberFilterSql = memberClauses.join(" AND ");

    const client = await pool.connect();
    try {
      const { rows: circleRows } = await client.query(
        `SELECT
           c.id,
           c.circle_type::text AS circle_type,
           c.key,
           c.display_name,
           c.metadata,
           (
             SELECT COUNT(*)::int
             FROM circle_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE ${memberFilterSql}
           ) AS member_count
         FROM circles c
         WHERE c.id = $1`,
        [id]
      );
      const circle = circleRows[0];
      if (!circle) {
        return c.json({ error: "Circle not found" }, 404);
      }

      const { rows: members } = await client.query(
        `SELECT
           u.id,
           u.email,
           u.display_name,
           u.role,
           u.onboarding_complete,
           u.is_internal,
           u.internal_kind,
           u.internal_status,
           (${testU}) AS is_test,
           to_char(cm.joined_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS joined_ist,
           to_char(u.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
           loc.pin_code,
           loc.locality,
           loc.city,
           loc.state,
           COALESCE(ch.child_count, 0)::int AS child_count,
           ch.first_school
         FROM circle_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN user_locations loc ON loc.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*)::int AS child_count,
             MIN(
               NULLIF(
                 concat_ws(
                   ' · ',
                   NULLIF(trim(s.name), ''),
                   NULLIF(trim(s.branch), ''),
                   NULLIF(trim(s.city), '')
                 ),
                 ''
               )
             ) AS first_school
           FROM children c
           LEFT JOIN schools s ON s.id = c.school_id
           WHERE c.user_id = u.id
         ) ch ON true
         WHERE ${memberFilterSql}
         ORDER BY cm.joined_at DESC
         LIMIT $2`,
        [id, limit]
      );

      return c.json({
        ok: true,
        circle,
        members,
        filters: { excludeTest, excludeInternal },
      });
    } finally {
      client.release();
    }
  });

  app.get("/admin/circles/:id/threads", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const id = (c.req.param("id") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return c.json({ error: "Invalid circle id" }, 400);
    }
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 40), 1), 100);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT
           t.id,
           t.title,
           t.status,
           t.author_id,
           u.display_name AS author_name,
           u.email AS author_email,
           u.is_internal AS author_is_internal,
           to_char(t.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
           to_char(COALESCE(t.last_message_at, t.created_at) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS last_activity_ist,
           (
             SELECT COUNT(*)::int FROM circle_messages m
             WHERE m.thread_id = t.id AND m.status = 'visible'
           ) AS message_count
         FROM circle_threads t
         LEFT JOIN users u ON u.id = t.author_id
         WHERE t.circle_id = $1
         ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
         LIMIT $2`,
        [id, limit]
      );
      return c.json({ ok: true, threads: rows });
    } finally {
      client.release();
    }
  });

  // ---- Internal seed parents (secret-gated) ----

  app.get("/admin/seed", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const schoolId = (c.req.query("schoolId") ?? "").trim() || null;
    const status = (c.req.query("status") ?? "").trim() || null;
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 200), 1), 500);
    const client = await pool.connect();
    try {
      const seeds = await listInternalSeeds(client, { schoolId, status, limit });
      return c.json({ ok: true, seeds });
    } finally {
      client.release();
    }
  });

  app.get("/admin/seed/gaps", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const minRealParents = Math.max(Number(c.req.query("minReal") ?? 1), 1);
    const client = await pool.connect();
    try {
      const report = await findSeedGaps(client, { minRealParents });
      return c.json({ ok: true, ...report });
    } finally {
      client.release();
    }
  });

  app.post("/admin/seed/spawn", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    let body: {
      target?: SeedTarget;
      schoolId?: string;
      curriculumId?: string;
      gradeId?: string;
      pinCode?: string;
      actor?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await spawnInternalPair(client, {
        target: body.target ?? "school",
        schoolId: body.schoolId,
        curriculumId: body.curriculumId,
        gradeId: body.gradeId,
        pinCode: body.pinCode,
        actor: body.actor ?? "admin",
      });
      if (result.ok === true) {
        await client.query("COMMIT");
        return c.json(result, 201);
      }
      const fail = seedFail(result as { ok: false; error: string; status: number });
      await client.query("ROLLBACK");
      return c.json({ error: fail.error }, fail.status as 400 | 404);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/admin/seed/:userId/circles", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const userId = (c.req.param("userId") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return c.json({ error: "Invalid user id" }, 400);
    }
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT
           c.id,
           c.display_name,
           c.circle_type::text AS circle_type,
           c.key,
           to_char(cm.joined_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS joined_ist
         FROM circle_members cm
         JOIN circles c ON c.id = cm.circle_id
         WHERE cm.user_id = $1
         ORDER BY
           CASE c.circle_type::text
             WHEN 'school' THEN 1
             WHEN 'school_class' THEN 2
             WHEN 'class' THEN 3
             WHEN 'curriculum' THEN 4
             WHEN 'locality' THEN 5
             ELSE 9
           END,
           c.display_name`,
        [userId]
      );
      return c.json({ ok: true, circles: rows });
    } finally {
      client.release();
    }
  });

  app.post("/admin/seed/:userId/status", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const userId = (c.req.param("userId") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return c.json({ error: "Invalid user id" }, 400);
    }
    let body: { status?: "active" | "inactive"; actor?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (body.status !== "active" && body.status !== "inactive") {
      return c.json({ error: "status must be active or inactive" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await setInternalStatus(
        client,
        userId,
        body.status,
        body.actor ?? "admin"
      );
      if (result.ok === true) {
        await client.query("COMMIT");
        return c.json(result);
      }
      const fail = seedFail(result as { ok: false; error: string; status: number });
      await client.query("ROLLBACK");
      return c.json({ error: fail.error }, fail.status as 400 | 404);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/admin/seed/:userId/post", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const userId = (c.req.param("userId") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return c.json({ error: "Invalid user id" }, 400);
    }
    let body: {
      circleId?: string;
      title?: string;
      body?: string;
      kind?: string;
      threadId?: string;
      replyToMessageId?: string;
      actor?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!body.circleId || !body.body?.trim()) {
      return c.json({ error: "circleId and body are required" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await postAsInternal(client, {
        userId,
        circleId: body.circleId,
        body: body.body,
        title: body.title,
        kind: body.kind,
        threadId: body.threadId,
        replyToMessageId: body.replyToMessageId,
        actor: body.actor ?? "admin",
      });
      if (result.ok === true) {
        await client.query("COMMIT");
        await publishChatNudge(result.nudge);
        return c.json(
          { ok: true, mode: result.mode, result: result.result },
          201
        );
      }
      const fail = seedFail(result as { ok: false; error: string; status: number });
      await client.query("ROLLBACK");
      return c.json({ error: fail.error }, fail.status as 400 | 403 | 404 | 429);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  mountAdminModeration(app, requireAdminAuth);

  app.get("/admin/dashboard", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const client = await pool.connect();
    try {
      const dashboard = await getAdminDashboard(client);
      return c.json({ ok: true, ...dashboard });
    } finally {
      client.release();
    }
  });

  app.get("/admin/lucky-gift", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    try {
      const data = await adminGetLuckyGiftCampaign();
      if (!data) return c.json({ error: "Campaign not found" }, 404);
      return c.json({ ok: true, ...data });
    } catch (error) {
      console.error("[admin.lucky-gift.get] failed", error);
      return c.json({ error: "Could not load campaign" }, 500);
    }
  });

  app.get("/admin/lucky-gift/winners", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    try {
      const data = await adminListWinners();
      if (!data) return c.json({ error: "Campaign not found" }, 404);
      return c.json({ ok: true, ...data });
    } catch (error) {
      console.error("[admin.lucky-gift.winners] failed", error);
      return c.json({ error: "Could not load winners" }, 500);
    }
  });

  app.patch("/admin/lucky-gift", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    try {
      const result = await adminUpdateLuckyGiftCampaign({
        prizeLabel:
          typeof body.prizeLabel === "string" ? body.prizeLabel : undefined,
        supportPhone:
          typeof body.supportPhone === "string" ? body.supportPhone : undefined,
        carryUnclaimedForward:
          typeof body.carryUnclaimedForward === "boolean"
            ? body.carryUnclaimedForward
            : undefined,
        periodWindows:
          body.periodWindows && typeof body.periodWindows === "object"
            ? (body.periodWindows as never)
            : undefined,
        startsAt: typeof body.startsAt === "string" ? body.startsAt : undefined,
        endsAt: typeof body.endsAt === "string" ? body.endsAt : undefined,
        claimDeadline:
          typeof body.claimDeadline === "string" ? body.claimDeadline : undefined,
        claimsOpen:
          typeof body.claimsOpen === "boolean" ? body.claimsOpen : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
      });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 404);
      }
      return c.json(result);
    } catch (error) {
      console.error("[admin.lucky-gift.patch] failed", error);
      return c.json({ error: "Could not update campaign" }, 500);
    }
  });

  app.post("/admin/lucky-gift/generate-moments", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    try {
      const result = await adminGenerateWinningMoments();
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 404);
      }
      return c.json(result);
    } catch (error) {
      console.error("[admin.lucky-gift.generate] failed", error);
      return c.json({ error: "Could not generate moments" }, 500);
    }
  });

  app.get("/admin/opportunities", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const status = c.req.query("status") ?? "all";
    if (!["all", "draft", "in_review", "published", "retired"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    const { rows } = await pool.query(
      `SELECT o.id, o.slug, o.title, o.kind, o.organizer_name, o.official_url, o.publication_status,
              (SELECT count(*)::int FROM opportunity_editions e WHERE e.opportunity_id = o.id) AS edition_count,
              latest.edition_label,
              latest.eligibility_summary,
              latest.event_status,
              latest.scope_level,
              latest.registration_method,
              latest.fee_status,
              latest.fee_count,
              latest.registration_date_count,
              latest.event_date_count,
              latest.registration_url,
              fee.fee_amount,
              reg.registration_opens_on,
              reg.registration_closes_on,
              ev.event_starts_on,
              ev.event_ends_on,
              loc.venue_name,
              src.source_urls,
              cats.categories
       FROM opportunities o
       LEFT JOIN LATERAL (
         SELECT ed.id,
                ed.edition_label,
                ed.eligibility_summary,
                ed.event_status,
                ed.scope_level,
                ed.registration_method,
                ed.fee_status,
                ed.registration_url,
                (SELECT count(*)::int FROM opportunity_fees f WHERE f.edition_id = ed.id) AS fee_count,
                (SELECT count(*)::int FROM opportunity_schedules s
                  WHERE s.edition_id = ed.id
                    AND s.schedule_type = 'registration'
                    AND s.superseded_at IS NULL) AS registration_date_count,
                (SELECT count(*)::int FROM opportunity_schedules s
                  WHERE s.edition_id = ed.id
                    AND s.schedule_type = 'event'
                    AND s.superseded_at IS NULL) AS event_date_count
         FROM opportunity_editions ed
         WHERE ed.opportunity_id = o.id
         ORDER BY ed.updated_at DESC
         LIMIT 1
       ) latest ON true
       LEFT JOIN LATERAL (
         SELECT amount AS fee_amount
         FROM opportunity_fees
         WHERE edition_id = latest.id
         ORDER BY created_at
         LIMIT 1
       ) fee ON true
       LEFT JOIN LATERAL (
         SELECT starts_on::text AS registration_opens_on,
                ends_on::text AS registration_closes_on
         FROM opportunity_schedules
         WHERE edition_id = latest.id
           AND schedule_type = 'registration'
           AND superseded_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 1
       ) reg ON true
       LEFT JOIN LATERAL (
         SELECT starts_on::text AS event_starts_on,
                ends_on::text AS event_ends_on
         FROM opportunity_schedules
         WHERE edition_id = latest.id
           AND schedule_type = 'event'
           AND superseded_at IS NULL
         ORDER BY starts_on NULLS LAST, updated_at DESC
         LIMIT 1
       ) ev ON true
       LEFT JOIN LATERAL (
         SELECT venue_name
         FROM opportunity_locations
         WHERE edition_id = latest.id
           AND role = 'venue'
           AND venue_name IS NOT NULL
         LIMIT 1
       ) loc ON true
       LEFT JOIN LATERAL (
         SELECT string_agg(s.url, E'\n' ORDER BY s.created_at) AS source_urls
         FROM (
           SELECT url, created_at
           FROM opportunity_sources
           WHERE edition_id = latest.id
           ORDER BY created_at
           LIMIT 3
         ) s
       ) src ON true
       LEFT JOIN LATERAL (
         SELECT string_agg(c.label, ', ' ORDER BY c.sort_order) AS categories
         FROM opportunity_category_links l
         JOIN opportunity_categories c ON c.id = l.category_id
         WHERE l.opportunity_id = o.id
       ) cats ON true
       WHERE ($1::text = 'all' OR o.publication_status = $1)
       ORDER BY o.title
       LIMIT 200`,
      [status]
    );
    const flag = await pool.query(
      `SELECT enabled FROM app_feature_flags WHERE key = 'competitive_exams'`
    );
    return c.json({
      enabled: flag.rows[0]?.enabled === true,
      items: rows,
    });
  });

  app.post("/admin/opportunities/:slug/publish", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const opp = await client.query(
        `UPDATE opportunities
         SET publication_status = 'published', updated_at = now()
         WHERE slug = $1 AND publication_status <> 'retired'
         RETURNING id, slug, title`,
        [slug]
      );
      if (!opp.rows[0]) {
        await client.query("ROLLBACK");
        return c.json({ error: "Not found" }, 404);
      }
      const editions = await client.query(
        `UPDATE opportunity_editions
         SET publication_status = 'published', updated_at = now()
         WHERE opportunity_id = $1 AND publication_status = 'draft'
         RETURNING id, edition_key`,
        [opp.rows[0].id]
      );
      await client.query(
        `INSERT INTO opportunity_change_log (entity_type, entity_id, reason, after_data)
         VALUES ('opportunity', $1, 'admin publish', $2::jsonb)`,
        [
          opp.rows[0].id,
          JSON.stringify({ editions: editions.rows.map((e) => e.edition_key) }),
        ]
      );
      await client.query("COMMIT");
      return c.json({
        ok: true,
        slug: opp.rows[0].slug,
        publishedEditions: editions.rows.length,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[admin.opportunities.publish] failed", error);
      return c.json({ error: "Could not publish" }, 500);
    } finally {
      client.release();
    }
  });

  app.post("/admin/opportunities/:slug/unpublish", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const opp = await client.query(
        `UPDATE opportunities
         SET publication_status = 'draft', updated_at = now()
         WHERE slug = $1 AND publication_status = 'published'
         RETURNING id, slug`,
        [slug]
      );
      if (!opp.rows[0]) {
        await client.query("ROLLBACK");
        return c.json({ error: "Not found" }, 404);
      }
      const editions = await client.query(
        `UPDATE opportunity_editions
         SET publication_status = 'draft', updated_at = now()
         WHERE opportunity_id = $1 AND publication_status = 'published'
         RETURNING id`,
        [opp.rows[0].id]
      );
      await client.query(
        `INSERT INTO opportunity_change_log (entity_type, entity_id, reason, after_data)
         VALUES ('opportunity', $1, 'admin unpublish', $2::jsonb)`,
        [opp.rows[0].id, JSON.stringify({ editions: editions.rowCount })]
      );
      await client.query("COMMIT");
      return c.json({ ok: true, slug: opp.rows[0].slug });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[admin.opportunities.unpublish] failed", error);
      return c.json({ error: "Could not unpublish" }, 500);
    } finally {
      client.release();
    }
  });

  app.post("/admin/opportunities/feature", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    let body: { enabled?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (typeof body.enabled !== "boolean") {
      return c.json({ error: "enabled boolean required" }, 400);
    }
    await pool.query(
      `UPDATE app_feature_flags
       SET enabled = $1, updated_at = now()
       WHERE key = 'competitive_exams'`,
      [body.enabled]
    );
    return c.json({ ok: true, enabled: body.enabled });
  });

  app.post("/admin/opportunities", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    let body: {
      title?: string;
      kind?: string;
      organizerName?: string | null;
      officialUrl?: string | null;
      editionLabel?: string | null;
      eligibilitySummary?: string | null;
      scopeLevel?: string | null;
      registrationMethod?: string | null;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const title = (body.title ?? "").trim();
    const kinds = ["competition", "olympiad", "exam", "scholarship", "admission_route"];
    if (!title || !body.kind || !kinds.includes(body.kind)) {
      return c.json({ error: "title and kind are required" }, 400);
    }
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "exam";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let slug = base;
      for (let n = 0; n < 20; n++) {
        const trySlug = n === 0 ? slug : `${base}-${n + 1}`;
        const exists = await client.query(`SELECT 1 FROM opportunities WHERE slug = $1`, [trySlug]);
        if (exists.rowCount === 0) {
          slug = trySlug;
          break;
        }
      }
      const opp = await client.query(
        `INSERT INTO opportunities (slug, title, kind, organizer_name, official_url, publication_status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         RETURNING id, slug`,
        [slug, title, body.kind, body.organizerName?.trim() || null, body.officialUrl?.trim() || null]
      );
      let editionId: string | null = null;
      if (body.editionLabel?.trim()) {
        const key = body.editionLabel.trim().toLowerCase().replace(/[–—\s]+/g, "-");
        const edition = await client.query(
          `INSERT INTO opportunity_editions (
             opportunity_id, edition_key, edition_label, scope_level,
             registration_method, eligibility_summary, publication_status
           ) VALUES ($1, $2, $3, $4, $5, $6, 'draft')
           RETURNING id`,
          [
            opp.rows[0].id,
            key,
            body.editionLabel.trim(),
            body.scopeLevel || "unknown",
            body.registrationMethod || "unknown",
            body.eligibilitySummary?.trim() || null,
          ]
        );
        editionId = edition.rows[0].id as string;
      }
      await client.query("COMMIT");
      return c.json({ ok: true, slug: opp.rows[0].slug, editionId }, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[admin.opportunities.create] failed", error);
      return c.json({ error: "Could not create exam" }, 500);
    } finally {
      client.release();
    }
  });

  app.patch("/admin/opportunities/:slug", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    let body: {
      title?: string;
      organizerName?: string | null;
      officialUrl?: string | null;
      eligibilitySummary?: string | null;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const client = await pool.connect();
    try {
      const opp = await client.query(
        `UPDATE opportunities
         SET title = COALESCE($2, title),
             organizer_name = COALESCE($3, organizer_name),
             official_url = COALESCE($4, official_url),
             updated_at = now()
         WHERE slug = $1
         RETURNING id`,
        [
          slug,
          body.title?.trim() || null,
          body.organizerName === undefined ? null : body.organizerName,
          body.officialUrl === undefined ? null : body.officialUrl,
        ]
      );
      if (!opp.rows[0]) return c.json({ error: "Not found" }, 404);
      if (body.eligibilitySummary !== undefined) {
        await client.query(
          `UPDATE opportunity_editions
           SET eligibility_summary = $2, updated_at = now()
           WHERE opportunity_id = $1`,
          [opp.rows[0].id, body.eligibilitySummary]
        );
      }
      return c.json({ ok: true, slug });
    } finally {
      client.release();
    }
  });

  app.post("/admin/opportunities/suggestions/rebuild", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const client = await pool.connect();
    try {
      const result = await rebuildOpportunitySuggestions(client);
      return c.json({ ok: true, ...result });
    } catch (error) {
      console.error("[admin.opportunities.suggestions] failed", error);
      return c.json({ error: "Could not rebuild suggestions" }, 500);
    } finally {
      client.release();
    }
  });

  app.get("/admin/opportunities/:slug", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    const opp = await pool.query(
      `SELECT id, slug, title, kind, organizer_name, official_url, publication_status
       FROM opportunities WHERE slug = $1`,
      [slug]
    );
    if (!opp.rows[0]) return c.json({ error: "Not found" }, 404);
    const editions = await pool.query(
      `SELECT id, edition_key, edition_label, scope_level, event_status,
              registration_method, eligibility_summary, fee_status, registration_url
       FROM opportunity_editions WHERE opportunity_id = $1
       ORDER BY updated_at DESC`,
      [opp.rows[0].id]
    );
    const edition = editions.rows[0];
    const fees = edition
      ? await pool.query(
          `SELECT label, amount, currency, applicability_text FROM opportunity_fees WHERE edition_id = $1`,
          [edition.id]
        )
      : { rows: [] };
    const schedules = edition
      ? await pool.query(
          `SELECT schedule_type, label, starts_on::text, ends_on::text, date_status
           FROM opportunity_schedules WHERE edition_id = $1 AND superseded_at IS NULL`,
          [edition.id]
        )
      : { rows: [] };
    const sources = edition
      ? await pool.query(
          `SELECT url, source_type FROM opportunity_sources WHERE edition_id = $1`,
          [edition.id]
        )
      : { rows: [] };
    return c.json({
      opportunity: opp.rows[0],
      edition,
      fees: fees.rows,
      schedules: schedules.rows,
      sources: sources.rows,
    });
  });

  app.post("/admin/opportunities/:slug/facts", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    let body: {
      eventStatus?: string;
      eligibilitySummary?: string | null;
      registrationMethod?: string;
      scopeLevel?: string;
      feeAmount?: number | null;
      feeCurrency?: string | null;
      feeBasis?: string | null;
      registrationOpensOn?: string | null;
      registrationClosesOn?: string | null;
      sourceUrl?: string | null;
      officialUrl?: string | null;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const events = new Set(["scheduled", "postponed", "cancelled", "completed", "unknown"]);
    const methods = new Set([
      "direct",
      "through_school",
      "nomination",
      "qualification",
      "mixed",
      "unknown",
    ]);
    const scopes = new Set([
      "school",
      "local",
      "district",
      "state",
      "national",
      "international",
      "unknown",
    ]);
    if (body.eventStatus && !events.has(body.eventStatus)) {
      return c.json({ error: "Unknown event status" }, 400);
    }
    if (body.registrationMethod && !methods.has(body.registrationMethod)) {
      return c.json({ error: "Unknown registration method" }, 400);
    }
    if (body.scopeLevel && !scopes.has(body.scopeLevel)) {
      return c.json({ error: "Unknown geography" }, 400);
    }
    if (
      body.feeAmount !== undefined &&
      body.feeAmount !== null &&
      (!Number.isFinite(body.feeAmount) || body.feeAmount < 0)
    ) {
      return c.json({ error: "Fee amount must be a number, or left blank" }, 400);
    }
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (body.registrationOpensOn && !day.test(body.registrationOpensOn)) {
      return c.json({ error: "Registration open date must be YYYY-MM-DD" }, 400);
    }
    if (body.registrationClosesOn && !day.test(body.registrationClosesOn)) {
      return c.json({ error: "Registration close date must be YYYY-MM-DD" }, 400);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const opp = await client.query(
        `UPDATE opportunities
         SET official_url = COALESCE($2, official_url), updated_at = now()
         WHERE slug = $1
         RETURNING id`,
        [slug, body.officialUrl?.trim() || null]
      );
      if (!opp.rows[0]) {
        await client.query("ROLLBACK");
        return c.json({ error: "Not found" }, 404);
      }
      const edition = await client.query(
        `SELECT id FROM opportunity_editions
         WHERE opportunity_id = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [opp.rows[0].id]
      );
      if (!edition.rows[0]) {
        const touchesEdition =
          Boolean(body.eventStatus) ||
          Boolean(body.registrationMethod) ||
          Boolean(body.scopeLevel) ||
          (body.eligibilitySummary != null && body.eligibilitySummary !== "") ||
          body.feeAmount !== undefined ||
          Boolean(body.registrationOpensOn) ||
          Boolean(body.registrationClosesOn) ||
          Boolean(body.sourceUrl?.trim());
        if (touchesEdition) {
          await client.query("ROLLBACK");
          return c.json({ error: "Add an edition before editing these facts" }, 400);
        }
        await client.query(
          `INSERT INTO opportunity_change_log (entity_type, entity_id, reason, after_data)
           VALUES ('opportunity', $1, 'admin facts', $2::jsonb)`,
          [opp.rows[0].id, JSON.stringify({ officialUrl: body.officialUrl ?? null })]
        );
        await client.query("COMMIT");
        return c.json({ ok: true, slug });
      }
      const editionId = edition.rows[0].id as string;
      await client.query(
        `UPDATE opportunity_editions
         SET event_status = COALESCE($2, event_status),
             eligibility_summary = COALESCE($3, eligibility_summary),
             registration_method = COALESCE($4, registration_method),
             scope_level = COALESCE($5, scope_level),
             fee_status = CASE
               WHEN $6::numeric IS NULL THEN fee_status
               WHEN $6 = 0 THEN 'free'
               ELSE 'paid'
             END,
             updated_at = now()
         WHERE id = $1`,
        [
          editionId,
          body.eventStatus || null,
          body.eligibilitySummary === undefined ? null : body.eligibilitySummary,
          body.registrationMethod || null,
          body.scopeLevel || null,
          body.feeAmount === undefined ? null : body.feeAmount,
        ]
      );
      if (body.feeAmount !== undefined && body.feeAmount !== null) {
        await client.query(`DELETE FROM opportunity_fees WHERE edition_id = $1`, [editionId]);
        await client.query(
          `INSERT INTO opportunity_fees (edition_id, label, amount, currency, fee_type, applicability_text)
           VALUES ($1, $2, $3, $4, 'registration', $5)`,
          [
            editionId,
            body.feeBasis?.trim() || "Entry",
            body.feeAmount,
            (body.feeCurrency || "INR").slice(0, 3),
            body.feeBasis || null,
          ]
        );
      }
      if (body.registrationOpensOn || body.registrationClosesOn) {
        await client.query(
          `DELETE FROM opportunity_schedules
           WHERE edition_id = $1 AND schedule_type = 'registration'`,
          [editionId]
        );
        await client.query(
          `INSERT INTO opportunity_schedules (
             edition_id, schedule_type, label, date_status, precision, starts_on, ends_on
           ) VALUES ($1, 'registration', 'Registration', 'verified', 'date', $2, $3)`,
          [editionId, body.registrationOpensOn || null, body.registrationClosesOn || null]
        );
      }
      if (body.sourceUrl?.trim()) {
        await client.query(
          `INSERT INTO opportunity_sources (edition_id, url, source_type, verification_status)
           VALUES ($1, $2, 'organizer_page', 'unverified')`,
          [editionId, body.sourceUrl.trim()]
        );
      }
      await client.query(
        `INSERT INTO opportunity_change_log (entity_type, entity_id, reason, after_data)
         VALUES ('edition', $1, 'admin facts', $2::jsonb)`,
        [editionId, JSON.stringify(body)]
      );
      await client.query("COMMIT");
      return c.json({ ok: true, slug });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("[admin.opportunities.facts] failed", error);
      return c.json({ error: "Could not save facts" }, 500);
    } finally {
      client.release();
    }
  });

  return app;
}
