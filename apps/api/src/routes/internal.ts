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
import { getAdminDashboard } from "../services/admin-dashboard.js";
import {
  adminGenerateWinningMoments,
  adminGetLuckyGiftCampaign,
  adminListWinners,
  adminUpdateLuckyGiftCampaign,
} from "../services/lucky-gift.js";

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
           COUNT(u.id) FILTER (WHERE u.id IS NOT NULL AND COALESCE(u.onboarding_complete, false) IS FALSE)::int AS incomplete
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
           u.onboarding_complete,
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
           COUNT(*) FILTER (WHERE COALESCE(onboarding_complete, false) IS FALSE)::int AS incomplete
         FROM users
         WHERE role = 'parent'
           AND created_at >= (now() AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata'
                           - interval '14 days'
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

  return app;
}
