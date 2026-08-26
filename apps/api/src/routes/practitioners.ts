import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { buildReviewAuthorView } from "../lib/author.js";
import { detectMedicalAdvice } from "../lib/content-guard.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

const CATEGORIES = [
  "pediatrician",
  "dentist",
  "therapist",
  "optometrist",
  "other",
] as const;

const SENSITIVE_CATEGORIES = new Set(["therapist"]);

function normalizeKey(name: string, clinic: string | null, pinCode: string) {
  return `${name.trim().toLowerCase()}|${(clinic ?? "").trim().toLowerCase()}|${pinCode.trim()}`;
}

async function mapRecommendation(
  client: PoolClient,
  row: Record<string, unknown>,
  category: string
) {
  const author = await buildReviewAuthorView(
    client,
    row.author_id as string,
    row.anonymous_handle as string
  );
  return {
    id: row.id,
    note: row.note,
    waitTimeBand: row.wait_time_band,
    feeBand: row.fee_band,
    goodWithYoungChildren: row.good_with_young_children,
    createdAt: row.created_at,
    author: {
      anonymousHandle: author.anonymousHandle,
      contextLabel: SENSITIVE_CATEGORIES.has(category)
        ? ""
        : author.contextLabel,
    },
  };
}

export function createPractitionerRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const userId = c.get("user").sub;
    const category = c.req.query("category");
    const pin = c.req.query("pin");

    const client = await pool.connect();
    try {
      const loc = await client.query(
        `SELECT pin_code FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      const pinCode = pin?.trim() || loc.rows[0]?.pin_code;
      if (!pinCode) {
        return c.json({ error: "Set your location first" }, 400);
      }

      let query = `
        SELECT id, name, category, clinic_name, pin_code, locality, city,
               verified, recommendation_count
        FROM local_practitioners
        WHERE pin_code = $1`;
      const params: unknown[] = [pinCode];

      if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
        query += ` AND category = $2`;
        params.push(category);
      }

      query += ` ORDER BY recommendation_count DESC, name LIMIT 50`;

      const { rows } = await client.query(query, params);
      return c.json(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          clinicName: row.clinic_name,
          pinCode: row.pin_code,
          locality: row.locality,
          city: row.city,
          verified: row.verified,
          recommendationCount: row.recommendation_count,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.post("/", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      name?: string;
      category?: string;
      clinicName?: string;
      pinCode?: string;
      locality?: string;
      city?: string;
    }>();

    const name = body.name?.trim();
    const category = body.category?.trim();
    if (!name || !category) {
      return c.json({ error: "name and category are required" }, 400);
    }
    if (!CATEGORIES.includes(category as typeof CATEGORIES[number])) {
      return c.json({ error: "Invalid category" }, 400);
    }

    const client = await pool.connect();
    try {
      const loc = await client.query(
        `SELECT pin_code, locality, city FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      const pinCode = body.pinCode?.trim() || loc.rows[0]?.pin_code;
      if (!pinCode) {
        return c.json({ error: "Set your location first" }, 400);
      }

      const key = normalizeKey(name, body.clinicName ?? null, pinCode);
      const existing = await client.query(
        `SELECT id FROM local_practitioners WHERE normalized_key = $1`,
        [key]
      );
      if (existing.rows.length > 0) {
        return c.json({ id: existing.rows[0].id }, 200);
      }

      const { rows } = await client.query(
        `INSERT INTO local_practitioners
           (name, category, clinic_name, pin_code, locality, city, normalized_key, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          name,
          category,
          body.clinicName?.trim() || null,
          pinCode,
          body.locality?.trim() || loc.rows[0]?.locality || null,
          body.city?.trim() || loc.rows[0]?.city || null,
          key,
          userId,
        ]
      );
      return c.json({ id: rows[0].id }, 201);
    } finally {
      client.release();
    }
  });

  app.get("/:id", async (c) => {
    const practitionerId = c.req.param("id");
    const client = await pool.connect();
    try {
      const practitioner = await client.query(
        `SELECT * FROM local_practitioners WHERE id = $1`,
        [practitionerId]
      );
      if (practitioner.rows.length === 0) {
        return c.json({ error: "Not found" }, 404);
      }
      const p = practitioner.rows[0];

      const recs = await client.query(
        `SELECT pr.*, u.anonymous_handle
         FROM practitioner_recommendations pr
         JOIN users u ON u.id = pr.author_id
         WHERE pr.practitioner_id = $1 AND pr.hidden = false
         ORDER BY pr.created_at DESC`,
        [practitionerId]
      );

      const recommendations = await Promise.all(
        recs.rows.map((row) => mapRecommendation(client, row, p.category))
      );

      return c.json({
        id: p.id,
        name: p.name,
        category: p.category,
        clinicName: p.clinic_name,
        pinCode: p.pin_code,
        locality: p.locality,
        city: p.city,
        verified: p.verified,
        recommendationCount: p.recommendation_count,
        disclaimer:
          "Parent logistics only — not medical advice. Vaara does not verify clinical competence.",
        recommendations,
      });
    } finally {
      client.release();
    }
  });

  app.post("/:id/recommend", async (c) => {
    const userId = c.get("user").sub;
    const practitionerId = c.req.param("id");
    const body = await c.req.json<{
      note?: string;
      waitTimeBand?: string;
      feeBand?: string;
      goodWithYoungChildren?: boolean;
    }>();

    const guard = detectMedicalAdvice(body.note ?? "");
    if (guard.blocked) {
      return c.json({ error: guard.reason }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO practitioner_recommendations
           (practitioner_id, author_id, note, wait_time_band, fee_band, good_with_young_children)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (practitioner_id, author_id) DO UPDATE SET
           note = EXCLUDED.note,
           wait_time_band = EXCLUDED.wait_time_band,
           fee_band = EXCLUDED.fee_band,
           good_with_young_children = EXCLUDED.good_with_young_children`,
        [
          practitionerId,
          userId,
          body.note?.trim() || null,
          body.waitTimeBand ?? null,
          body.feeBand ?? null,
          body.goodWithYoungChildren ?? null,
        ]
      );

      await client.query(
        `UPDATE local_practitioners SET recommendation_count = (
           SELECT COUNT(*) FROM practitioner_recommendations
           WHERE practitioner_id = $1 AND hidden = false
         ) WHERE id = $1`,
        [practitionerId]
      );

      await client.query("COMMIT");
      return c.json({ ok: true }, 201);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  return app;
}
