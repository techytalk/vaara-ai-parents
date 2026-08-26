import { Hono } from "hono";
import { pool } from "@vaara/db";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  buildSchoolNormalizedKey,
  mapSchoolRow,
} from "../lib/school.js";

export function createSchoolsRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/search", async (c) => {
    const q = c.req.query("q")?.trim() ?? "";
    const city = c.req.query("city")?.trim();
    const pin = c.req.query("pin")?.trim();
    const limit = Math.min(Number(c.req.query("limit") ?? 15), 30);

    if (q.length < 2) {
      return c.json([]);
    }

    const client = await pool.connect();
    try {
      const pattern = `%${q}%`;
      const prefix = `${q}%`;

      const { rows } = await client.query(
        `SELECT id, name, branch, city, state, pin_code, verified,
                CASE
                  WHEN name ILIKE $2 THEN 0
                  WHEN branch ILIKE $2 THEN 1
                  WHEN name ILIKE $1 THEN 2
                  ELSE 3
                END AS rank_bucket,
                similarity(coalesce(name, '') || ' ' || coalesce(branch, ''), $3) AS sm
         FROM schools
         WHERE normalized_key <> 'school_not_specified||unknown'
           AND (
             name ILIKE $1 OR branch ILIKE $1 OR city ILIKE $1
             OR name % $3 OR branch % $3
           )
           AND ($4::text IS NULL OR city ILIKE $4 OR pin_code = $5)
         ORDER BY rank_bucket, sm DESC, name
         LIMIT $6`,
        [pattern, prefix, q, city ?? null, pin ?? null, limit]
      );

      return c.json(rows.map(mapSchoolRow));
    } finally {
      client.release();
    }
  });

  app.post("/", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      name?: string;
      branch?: string;
      city?: string;
      state?: string;
      pinCode?: string;
    }>();

    const name = body.name?.trim();
    const branch = body.branch?.trim() || null;
    const city = body.city?.trim();
    const state = body.state?.trim() || null;
    const pinCode = body.pinCode?.trim() || null;

    if (!name || !city) {
      return c.json({ error: "name and city are required" }, 400);
    }
    if (!branch) {
      return c.json({ error: "branch is required (area / locality of the school)" }, 400);
    }

    const normalizedKey = buildSchoolNormalizedKey(name, branch, city);
    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT id, name, branch, city, state, pin_code, verified
         FROM schools WHERE normalized_key = $1`,
        [normalizedKey]
      );
      if (existing.rows.length > 0) {
        return c.json(mapSchoolRow(existing.rows[0]));
      }

      const { rows } = await client.query(
        `INSERT INTO schools (name, branch, city, state, pin_code, normalized_key, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, branch, city, state, pin_code, verified`,
        [name, branch, city, state, pinCode, normalizedKey, userId]
      );

      return c.json(mapSchoolRow(rows[0]), 201);
    } finally {
      client.release();
    }
  });

  return app;
}
