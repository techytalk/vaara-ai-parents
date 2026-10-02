import { Hono } from "hono";
import { pool } from "@vaara/db";
import {
  child360PageKey,
  getCachedJson,
  invalidateChild360Page,
  invalidateFamilyPage,
  PAGE_CACHE_TTL,
  setCachedJson,
} from "@vaara/redis";
import { formatSchoolLabel } from "../lib/school.js";
import { randomToken, sha256 } from "../lib/oauth.js";
import { jeePrepOrigin } from "../lib/prep-mail.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  isValidActivitySetting,
  isValidActivityStatus,
  isValidHealthLabel,
  isValidPathwayLean,
  isValidPlanStatus,
  loadOwnedChild,
  mapActivity,
  mapHealthNote,
  mapOpportunityPlan,
  rightBandForChild,
  type OwnedChildRow,
} from "../lib/child-360.js";

function hubChildSummary(child: OwnedChildRow) {
  const schoolLabel = formatSchoolLabel(
    child.school_name ?? "School",
    child.school_branch,
    child.school_city ?? ""
  );
  return {
    id: child.id,
    nickname: child.nickname,
    track: child.track,
    ageYears: child.age_years,
    pathwayLean: child.pathway_lean,
    curriculum:
      child.curriculum_code != null
        ? { code: child.curriculum_code, name: child.curriculum_name }
        : null,
    grade:
      child.grade_code != null
        ? { code: child.grade_code, label: child.grade_label }
        : null,
    school: {
      name: child.school_name,
      displayLabel: schoolLabel,
    },
    rightBand: rightBandForChild(child.track, child.grade_code),
  };
}

type Child360HubPayload = {
  child: ReturnType<typeof hubChildSummary>;
  activities: ReturnType<typeof mapActivity>[];
  healthNotes: ReturnType<typeof mapHealthNote>[];
  interests: string[];
  opportunityPlans: ReturnType<typeof mapOpportunityPlan>[];
  hub: {
    activityName: string | null;
    healthNoteCount: number;
    interestPreview: string | null;
    pathwayLean: string | null;
    opportunityPreview: string | null;
  };
};

function trimName(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t.length < 1 || t.length > max) return null;
  return t;
}

export function createChild360Routes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/children/:childId/360", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const cacheKey = child360PageKey(userId, childId);
    const cached = await getCachedJson<Child360HubPayload>(cacheKey);
    if (cached) return c.json(cached);

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);

      const [activities, notes, interests, plans] = await Promise.all([
        client.query(
          `SELECT * FROM child_activities
           WHERE child_id = $1
           ORDER BY sort_order ASC, created_at ASC`,
          [childId]
        ),
        client.query(
          `SELECT * FROM child_health_notes
           WHERE child_id = $1
           ORDER BY sort_order ASC, created_at ASC`,
          [childId]
        ),
        client.query(
          `SELECT label FROM child_interests
           WHERE child_id = $1
           ORDER BY label ASC`,
          [childId]
        ),
        client.query(
          `SELECT p.*,
                  COALESCE(o.title, os.title) AS opportunity_title,
                  COALESCE(o.publication_status, os.publication_status) AS opportunity_publication_status
           FROM child_opportunity_plans p
           LEFT JOIN opportunities o ON o.id = p.opportunity_id
           LEFT JOIN opportunities os
             ON p.opportunity_id IS NULL AND os.slug = p.opportunity_slug
           WHERE p.child_id = $1
           ORDER BY p.sort_order ASC, p.created_at ASC`,
          [childId]
        ),
      ]);

      const activityRows = activities.rows.map(mapActivity);
      const hubActivity =
        activityRows.find((a) => a.status === "active") ??
        activityRows[0] ??
        null;
      const interestLabels = interests.rows.map(
        (r) => r.label as string
      );
      const planRows = plans.rows.map(mapOpportunityPlan);
      const hubPlan =
        planRows.find((p) => p.status === "this_season") ??
        planRows[0] ??
        null;

      const payload: Child360HubPayload = {
        child: hubChildSummary(child),
        activities: activityRows,
        healthNotes: notes.rows.map(mapHealthNote),
        interests: interestLabels,
        opportunityPlans: planRows,
        hub: {
          activityName: hubActivity?.name ?? null,
          healthNoteCount: notes.rows.length,
          interestPreview: interestLabels[0] ?? null,
          pathwayLean: child.pathway_lean,
          opportunityPreview: hubPlan?.opportunitySlug ?? null,
        },
      };
      await setCachedJson(cacheKey, payload, PAGE_CACHE_TTL.child360);
      return c.json(payload);
    } finally {
      client.release();
    }
  });

  // ── Activities ──────────────────────────────────────────────

  app.get("/children/:childId/activities", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const { rows } = await client.query(
        `SELECT * FROM child_activities
         WHERE child_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [childId]
      );
      return c.json(rows.map(mapActivity));
    } finally {
      client.release();
    }
  });

  app.post("/children/:childId/activities", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const body = await c.req.json<{
      name?: string;
      setting?: string;
      howOften?: string | null;
      status?: string;
    }>();
    const name = trimName(body.name, 40);
    if (!name) return c.json({ error: "name is required (1–40 chars)" }, 400);
    if (!body.setting) {
      return c.json({ error: "setting is required" }, 400);
    }
    const status = body.status ?? "active";
    if (!isValidActivityStatus(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    const howOften =
      body.howOften == null || body.howOften === ""
        ? null
        : trimName(body.howOften, 80);
    if (body.howOften != null && body.howOften !== "" && !howOften) {
      return c.json({ error: "howOften must be at most 80 chars" }, 400);
    }

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      if (!isValidActivitySetting(child.track, body.setting)) {
        return c.json({ error: "Invalid setting for this child" }, 400);
      }
      const next = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
         FROM child_activities WHERE child_id = $1`,
        [childId]
      );
      const { rows } = await client.query(
        `INSERT INTO child_activities
           (child_id, name, setting, how_often, status, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [childId, name, body.setting, howOften, status, next.rows[0].n]
      );
      await invalidateChild360Page(userId, childId);
      return c.json(mapActivity(rows[0]), 201);
    } finally {
      client.release();
    }
  });

  app.patch("/children/:childId/activities/:activityId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const activityId = c.req.param("activityId");
    const body = await c.req.json<{
      name?: string;
      setting?: string;
      howOften?: string | null;
      status?: string;
    }>();

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);

      const existing = await client.query(
        `SELECT * FROM child_activities WHERE id = $1 AND child_id = $2`,
        [activityId, childId]
      );
      if (existing.rows.length === 0) {
        return c.json({ error: "Activity not found" }, 404);
      }

      const name =
        body.name !== undefined
          ? trimName(body.name, 40)
          : (existing.rows[0].name as string);
      if (!name) return c.json({ error: "name is required (1–40 chars)" }, 400);

      const setting =
        body.setting !== undefined
          ? body.setting
          : (existing.rows[0].setting as string);
      if (!isValidActivitySetting(child.track, setting)) {
        return c.json({ error: "Invalid setting for this child" }, 400);
      }

      const status =
        body.status !== undefined
          ? body.status
          : (existing.rows[0].status as string);
      if (!isValidActivityStatus(status)) {
        return c.json({ error: "Invalid status" }, 400);
      }

      let howOften: string | null = existing.rows[0].how_often ?? null;
      if (body.howOften !== undefined) {
        if (body.howOften == null || body.howOften === "") {
          howOften = null;
        } else {
          howOften = trimName(body.howOften, 80);
          if (!howOften) {
            return c.json({ error: "howOften must be at most 80 chars" }, 400);
          }
        }
      }

      const { rows } = await client.query(
        `UPDATE child_activities
         SET name = $1, setting = $2, how_often = $3, status = $4,
             updated_at = now()
         WHERE id = $5 AND child_id = $6
         RETURNING *`,
        [name, setting, howOften, status, activityId, childId]
      );
      await invalidateChild360Page(userId, childId);
      return c.json(mapActivity(rows[0]));
    } finally {
      client.release();
    }
  });

  app.delete("/children/:childId/activities/:activityId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const activityId = c.req.param("activityId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const result = await client.query(
        `DELETE FROM child_activities
         WHERE id = $1 AND child_id = $2
         RETURNING *`,
        [activityId, childId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Activity not found" }, 404);
      }
      await invalidateChild360Page(userId, childId);
      return c.json({ ok: true, deleted: mapActivity(result.rows[0]) });
    } finally {
      client.release();
    }
  });

  // ── Health notes ────────────────────────────────────────────

  app.get("/children/:childId/health-notes", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const { rows } = await client.query(
        `SELECT * FROM child_health_notes
         WHERE child_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [childId]
      );
      return c.json(rows.map(mapHealthNote));
    } finally {
      client.release();
    }
  });

  app.post("/children/:childId/health-notes", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const body = await c.req.json<{ label?: string; body?: string }>();
    if (!body.label || !isValidHealthLabel(body.label)) {
      return c.json({ error: "Invalid label" }, 400);
    }
    const noteBody = trimName(body.body, 280);
    if (!noteBody) {
      return c.json({ error: "body is required (1–280 chars)" }, 400);
    }

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const next = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
         FROM child_health_notes WHERE child_id = $1`,
        [childId]
      );
      const { rows } = await client.query(
        `INSERT INTO child_health_notes (child_id, label, body, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [childId, body.label, noteBody, next.rows[0].n]
      );
      await invalidateChild360Page(userId, childId);
      return c.json(mapHealthNote(rows[0]), 201);
    } finally {
      client.release();
    }
  });

  app.patch("/children/:childId/health-notes/:noteId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const noteId = c.req.param("noteId");
    const body = await c.req.json<{ label?: string; body?: string }>();

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const existing = await client.query(
        `SELECT * FROM child_health_notes WHERE id = $1 AND child_id = $2`,
        [noteId, childId]
      );
      if (existing.rows.length === 0) {
        return c.json({ error: "Note not found" }, 404);
      }

      const label =
        body.label !== undefined
          ? body.label
          : (existing.rows[0].label as string);
      if (!isValidHealthLabel(label)) {
        return c.json({ error: "Invalid label" }, 400);
      }

      const noteBody =
        body.body !== undefined
          ? trimName(body.body, 280)
          : (existing.rows[0].body as string);
      if (!noteBody) {
        return c.json({ error: "body is required (1–280 chars)" }, 400);
      }

      const { rows } = await client.query(
        `UPDATE child_health_notes
         SET label = $1, body = $2, updated_at = now()
         WHERE id = $3 AND child_id = $4
         RETURNING *`,
        [label, noteBody, noteId, childId]
      );
      await invalidateChild360Page(userId, childId);
      return c.json(mapHealthNote(rows[0]));
    } finally {
      client.release();
    }
  });

  app.delete("/children/:childId/health-notes/:noteId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const noteId = c.req.param("noteId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const result = await client.query(
        `DELETE FROM child_health_notes
         WHERE id = $1 AND child_id = $2
         RETURNING *`,
        [noteId, childId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Note not found" }, 404);
      }
      await invalidateChild360Page(userId, childId);
      return c.json({ ok: true, deleted: mapHealthNote(result.rows[0]) });
    } finally {
      client.release();
    }
  });

  // ── Interests ───────────────────────────────────────────────

  app.put("/children/:childId/interests", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const body = await c.req.json<{ labels?: string[] }>();
    if (!Array.isArray(body.labels)) {
      return c.json({ error: "labels must be an array" }, 400);
    }
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const raw of body.labels) {
      const label = trimName(raw, 40);
      if (!label) {
        return c.json({ error: "each label must be 1–40 chars" }, 400);
      }
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) {
        await client.query("ROLLBACK");
        return c.json({ error: "Child not found" }, 404);
      }
      await client.query(
        `DELETE FROM child_interests WHERE child_id = $1`,
        [childId]
      );
      for (const label of labels) {
        await client.query(
          `INSERT INTO child_interests (child_id, label) VALUES ($1, $2)`,
          [childId, label]
        );
      }
      await client.query("COMMIT");
      await invalidateChild360Page(userId, childId);
      return c.json({ labels });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // ── Pathway lean ────────────────────────────────────────────

  app.patch("/children/:childId/pathway-lean", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const body = await c.req.json<{ pathwayLean?: string | null }>();

    let value: string | null = null;
    if (body.pathwayLean != null && body.pathwayLean !== "") {
      const trimmed = trimName(body.pathwayLean, 40);
      if (!trimmed || !isValidPathwayLean(trimmed)) {
        return c.json({ error: "Invalid pathwayLean" }, 400);
      }
      value = trimmed;
    }

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const band = rightBandForChild(child.track, child.grade_code);
      if (band !== "pathway_lean" && value != null) {
        return c.json(
          { error: "pathway lean is only for Class 9–10" },
          400
        );
      }
      const { rows } = await client.query(
        `UPDATE children SET pathway_lean = $1, updated_at = now()
         WHERE id = $2 AND user_id = $3
         RETURNING pathway_lean`,
        [value, childId, userId]
      );
      await invalidateFamilyPage(userId);
      await invalidateChild360Page(userId, childId);
      return c.json({ pathwayLean: rows[0]?.pathway_lean ?? null });
    } finally {
      client.release();
    }
  });

  // ── Opportunity plans ───────────────────────────────────────

  app.get("/children/:childId/opportunity-plans", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const { rows } = await client.query(
        `SELECT p.*,
                COALESCE(o.title, os.title) AS opportunity_title,
                COALESCE(o.publication_status, os.publication_status) AS opportunity_publication_status
         FROM child_opportunity_plans p
         LEFT JOIN opportunities o ON o.id = p.opportunity_id
         LEFT JOIN opportunities os
           ON p.opportunity_id IS NULL AND os.slug = p.opportunity_slug
         WHERE p.child_id = $1
         ORDER BY p.sort_order ASC, p.created_at ASC`,
        [childId]
      );
      return c.json(rows.map(mapOpportunityPlan));
    } finally {
      client.release();
    }
  });

  app.post("/children/:childId/opportunity-plans", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const body = await c.req.json<{
      opportunitySlug?: string;
      opportunityId?: string;
      editionId?: string;
      status?: string;
      targetYear?: number | null;
    }>();
    let slug = trimName(body.opportunitySlug, 80);
    const opportunityId = body.opportunityId?.trim() || null;
    const editionId = body.editionId?.trim() || null;
    if (!slug && !opportunityId) {
      return c.json({ error: "opportunitySlug is required" }, 400);
    }
    const status = body.status ?? "exploring";
    if (!isValidPlanStatus(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    let targetYear: number | null = null;
    if (body.targetYear != null) {
      const y = Number(body.targetYear);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        return c.json({ error: "Invalid targetYear" }, 400);
      }
      targetYear = y;
    }

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);

      let resolvedOpportunityId = opportunityId;
      let resolvedEditionId = editionId;
      if (opportunityId) {
        const opp = await client.query(
          `SELECT id, slug FROM opportunities
           WHERE id = $1 AND publication_status = 'published'`,
          [opportunityId]
        );
        if (!opp.rows[0]) return c.json({ error: "Exam not found" }, 404);
        slug = opp.rows[0].slug as string;
        if (editionId) {
          const edition = await client.query(
            `SELECT id FROM opportunity_editions
             WHERE id = $1 AND opportunity_id = $2 AND publication_status = 'published'`,
            [editionId, opportunityId]
          );
          if (!edition.rows[0]) return c.json({ error: "Edition not found" }, 404);
        }
      }

      if (resolvedOpportunityId && resolvedEditionId) {
        const existing = await client.query(
          `SELECT id FROM child_opportunity_plans
           WHERE child_id = $1 AND opportunity_id = $2 AND edition_id = $3
             AND plan_lifecycle = 'active'`,
          [childId, resolvedOpportunityId, resolvedEditionId]
        );
        if (existing.rows[0]) {
          const { rows } = await client.query(
            `UPDATE child_opportunity_plans
             SET status = $1, target_year = $2, opportunity_slug = $3, updated_at = now()
             WHERE id = $4
             RETURNING *`,
            [status, targetYear, slug, existing.rows[0].id]
          );
          await invalidateChild360Page(userId, childId);
          return c.json(mapOpportunityPlan(rows[0]));
        }
      } else if (slug) {
        const existing = await client.query(
          `SELECT id FROM child_opportunity_plans
           WHERE child_id = $1 AND opportunity_slug = $2 AND opportunity_id IS NULL
             AND plan_lifecycle = 'active'`,
          [childId, slug]
        );
        if (existing.rows.length > 0) {
          const { rows } = await client.query(
            `UPDATE child_opportunity_plans
             SET status = $1, target_year = $2, updated_at = now()
             WHERE id = $3
             RETURNING *`,
            [status, targetYear, existing.rows[0].id]
          );
          await invalidateChild360Page(userId, childId);
          return c.json(mapOpportunityPlan(rows[0]));
        }
      }

      if (!slug) return c.json({ error: "opportunitySlug is required" }, 400);

      const next = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
         FROM child_opportunity_plans WHERE child_id = $1`,
        [childId]
      );
      const { rows } = await client.query(
        `INSERT INTO child_opportunity_plans
           (child_id, opportunity_slug, status, target_year, sort_order, opportunity_id, edition_id, plan_lifecycle)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING *`,
        [
          childId,
          slug,
          status,
          targetYear,
          next.rows[0].n,
          resolvedOpportunityId,
          resolvedEditionId,
        ]
      );
      await invalidateChild360Page(userId, childId);
      return c.json(mapOpportunityPlan(rows[0]), 201);
    } finally {
      client.release();
    }
  });

  app.patch("/children/:childId/opportunity-plans/:planId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const planId = c.req.param("planId");
    const body = await c.req.json<{
      status?: string;
      targetYear?: number | null;
    }>();

    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const existing = await client.query(
        `SELECT * FROM child_opportunity_plans WHERE id = $1 AND child_id = $2`,
        [planId, childId]
      );
      if (existing.rows.length === 0) {
        return c.json({ error: "Plan not found" }, 404);
      }

      const status =
        body.status !== undefined
          ? body.status
          : (existing.rows[0].status as string);
      if (!isValidPlanStatus(status)) {
        return c.json({ error: "Invalid status" }, 400);
      }

      let targetYear: number | null =
        existing.rows[0].target_year == null
          ? null
          : Number(existing.rows[0].target_year);
      if (body.targetYear !== undefined) {
        if (body.targetYear == null) {
          targetYear = null;
        } else {
          const y = Number(body.targetYear);
          if (!Number.isInteger(y) || y < 2000 || y > 2100) {
            return c.json({ error: "Invalid targetYear" }, 400);
          }
          targetYear = y;
        }
      }

      const { rows } = await client.query(
        `UPDATE child_opportunity_plans
         SET status = $1, target_year = $2, updated_at = now()
         WHERE id = $3 AND child_id = $4
         RETURNING *`,
        [status, targetYear, planId, childId]
      );
      await invalidateChild360Page(userId, childId);
      return c.json(mapOpportunityPlan(rows[0]));
    } finally {
      client.release();
    }
  });

  app.delete("/children/:childId/opportunity-plans/:planId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const planId = c.req.param("planId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const result = await client.query(
        `DELETE FROM child_opportunity_plans
         WHERE id = $1 AND child_id = $2
         RETURNING *`,
        [planId, childId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Plan not found" }, 404);
      }
      await invalidateChild360Page(userId, childId);
      return c.json({ ok: true, deleted: mapOpportunityPlan(result.rows[0]) });
    } finally {
      client.release();
    }
  });

  app.get("/children/:childId/prep", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const progress = await client.query(
        `SELECT streak, answered_count, accuracy, last_practiced_at
         FROM child_prep_progress WHERE child_id = $1`,
        [childId]
      );
      const devices = await client.query(
        `SELECT id, device_label, created_at, last_used_at, revoked_at
         FROM oauth_grants WHERE child_id = $1 AND parent_id = $2
         ORDER BY created_at DESC`,
        [childId, userId]
      );
      const row = progress.rows[0] as
        | { streak: number; answered_count: number; accuracy: number | null; last_practiced_at: string | null }
        | undefined;
      return c.json({
        practiceUrl: jeePrepOrigin(),
        progress: row
          ? {
              streak: row.streak,
              answeredCount: row.answered_count,
              accuracy: row.accuracy,
              lastPracticedAt: row.last_practiced_at,
            }
          : null,
        devices: devices.rows.map((device: {
          id: string;
          device_label: string | null;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        }) => ({
          id: device.id,
          label: device.device_label,
          createdAt: device.created_at,
          lastUsedAt: device.last_used_at,
          revokedAt: device.revoked_at,
        })),
      });
    } finally {
      client.release();
    }
  });

  app.post("/children/:childId/prep-links", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const body = await c.req.json().catch(() => ({})) as { mode?: string };
    const mode = body.mode === "share" ? "share" : "self";
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const token = randomToken();
      const lifetime = mode === "share" ? "7 days" : "2 minutes";
      await client.query(
        `INSERT INTO child_prep_links (child_id, parent_id, client_id, mode, invite_hash, expires_at)
         VALUES ($1, $2, 'jee', $3, $4, now() + $5::interval)`,
        [childId, userId, mode, sha256(token), lifetime]
      );
      return c.json({ url: `${jeePrepOrigin()}/c/${token}` });
    } finally {
      client.release();
    }
  });

  app.post("/children/:childId/prep-devices/:grantId/revoke", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const grantId = c.req.param("grantId");
    const client = await pool.connect();
    try {
      const child = await loadOwnedChild(client, userId, childId);
      if (!child) return c.json({ error: "Child not found" }, 404);
      const result = await client.query(
        `UPDATE oauth_grants SET revoked_at = now()
         WHERE id = $1 AND child_id = $2 AND parent_id = $3 AND revoked_at IS NULL
         RETURNING id`,
        [grantId, childId, userId]
      );
      if (result.rows.length === 0) return c.json({ error: "Device not found" }, 404);
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  return app;
}
