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

function requireCronSecret(c: { req: { header: (n: string) => string | undefined } }) {
  const secret = c.req.header("X-Cron-Secret");
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && secret === expected);
}

function requireAdminSecret(c: {
  req: { header: (n: string) => string | undefined };
}) {
  // Fail closed: cron secret must not authorize destructive admin tools.
  const secret = c.req.header("X-Admin-Secret");
  const expected = process.env.ADMIN_API_SECRET;
  return Boolean(expected && secret === expected);
}

function mergesEnabled(): boolean {
  return process.env.SCHOOL_MERGES_ENABLED === "true";
}

export function createInternalRoutes() {
  const app = new Hono();

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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);
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

  // ---- Admin parent signups (secret-gated) ----

  app.get("/admin/parents", async (c) => {
    if (!requireAdminSecret(c)) return c.json({ error: "Unauthorized" }, 401);

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

  return app;
}
