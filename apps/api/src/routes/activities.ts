import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { pool } from "@vaara/db";
import {
  loadActivityExtras,
  mapActivity,
  syncActivityTargeting,
} from "../lib/activities.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

const PROVIDER_TYPES = ["teacher", "trainer", "institution"] as const;
const ACTIVITY_STATUSES = ["draft", "published", "archived"] as const;

async function requireProvider(
  client: import("pg").PoolClient,
  userId: string
) {
  const user = await client.query(
    "SELECT role FROM users WHERE id = $1",
    [userId]
  );
  if (user.rows.length === 0 || user.rows[0].role !== "provider") {
    throw new HTTPException(403, { message: "Provider account required" });
  }
  const provider = await client.query(
    "SELECT user_id FROM providers WHERE user_id = $1",
    [userId]
  );
  if (provider.rows.length === 0) {
    throw new HTTPException(400, { message: "Complete provider onboarding first" });
  }
}

export function createProviderRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/profile", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT p.provider_type, p.org_name, p.description, p.logo_url, p.verified,
                p.service_pin_codes, u.onboarding_complete
         FROM users u
         LEFT JOIN providers p ON p.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );
      if (rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      const row = rows[0];
      if (!row.org_name) {
        return c.json(null);
      }
      return c.json({
        providerType: row.provider_type,
        orgName: row.org_name,
        description: row.description,
        logoUrl: row.logo_url,
        verified: row.verified,
        servicePinCodes: row.service_pin_codes ?? [],
        onboardingComplete: row.onboarding_complete,
      });
    } finally {
      client.release();
    }
  });

  app.patch("/profile", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      providerType?: string;
      orgName?: string;
      description?: string;
      servicePinCodes?: string[];
    }>();

    const userCheck = await pool.query("SELECT role FROM users WHERE id = $1", [
      userId,
    ]);
    if (userCheck.rows[0]?.role !== "provider") {
      return c.json({ error: "Provider account required" }, 403);
    }

    const orgName = body.orgName?.trim();
    const providerType = body.providerType;
    const pinCodes = (body.servicePinCodes ?? [])
      .map((p) => p.trim())
      .filter(Boolean);

    if (!orgName || !providerType || pinCodes.length === 0) {
      return c.json(
        { error: "orgName, providerType, and servicePinCodes are required" },
        400
      );
    }

    if (!PROVIDER_TYPES.includes(providerType as typeof PROVIDER_TYPES[number])) {
      return c.json({ error: "Invalid providerType" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO providers (user_id, provider_type, org_name, description, service_pin_codes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           provider_type = EXCLUDED.provider_type,
           org_name = EXCLUDED.org_name,
           description = EXCLUDED.description,
           service_pin_codes = EXCLUDED.service_pin_codes,
           updated_at = now()`,
        [
          userId,
          providerType,
          orgName,
          body.description?.trim() || null,
          pinCodes,
        ]
      );

      await client.query(
        "UPDATE users SET onboarding_complete = true, updated_at = now() WHERE id = $1",
        [userId]
      );

      await client.query("COMMIT");

      return c.json({
        providerType,
        orgName,
        description: body.description?.trim() || null,
        servicePinCodes: pinCodes,
        onboardingComplete: true,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/activities", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      await requireProvider(client, userId);

      const { rows } = await client.query(
        `SELECT a.* FROM activities a
         WHERE a.provider_id = $1
         ORDER BY a.updated_at DESC`,
        [userId]
      );

      const activities = await Promise.all(
        rows.map(async (row) => {
          const extras = await loadActivityExtras(client, row.id);
          return mapActivity(row, extras.pinCodes, extras.curriculumIds);
        })
      );

      return c.json(activities);
    } finally {
      client.release();
    }
  });

  app.post("/activities", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      feeAmount?: number;
      feeCurrency?: string;
      minGradeId?: string;
      maxGradeId?: string;
      locationText?: string;
      pinCodes?: string[];
      curriculumIds?: string[];
      status?: string;
    }>();

    const title = body.title?.trim();
    const description = body.description?.trim();
    if (!title || !description) {
      return c.json({ error: "title and description are required" }, 400);
    }

    const pinCodes = (body.pinCodes ?? []).map((p) => p.trim()).filter(Boolean);
    if (pinCodes.length === 0) {
      return c.json({ error: "At least one pin code is required" }, 400);
    }

    const status =
      body.status === "published" ? "published" : "draft";
    if (!ACTIVITY_STATUSES.includes(status as typeof ACTIVITY_STATUSES[number])) {
      return c.json({ error: "Invalid status" }, 400);
    }

    const client = await pool.connect();
    try {
      await requireProvider(client, userId);
      await client.query("BEGIN");

      const { rows } = await client.query(
        `INSERT INTO activities (
           provider_id, title, description, status, starts_at, ends_at,
           fee_amount, fee_currency, min_grade_id, max_grade_id, location_text
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          userId,
          title,
          description,
          status,
          body.startsAt ?? null,
          body.endsAt ?? null,
          body.feeAmount ?? null,
          body.feeCurrency ?? "INR",
          body.minGradeId ?? null,
          body.maxGradeId ?? null,
          body.locationText?.trim() ?? null,
        ]
      );

      const activityId = rows[0].id;
      await syncActivityTargeting(
        client,
        activityId,
        pinCodes,
        body.curriculumIds ?? []
      );

      await client.query("COMMIT");

      const extras = await loadActivityExtras(client, activityId);
      return c.json(mapActivity(rows[0], extras.pinCodes, extras.curriculumIds), 201);
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof HTTPException) throw err;
      throw err;
    } finally {
      client.release();
    }
  });

  app.patch("/activities/:id", async (c) => {
    const userId = c.get("user").sub;
    const activityId = c.req.param("id");
    const body = await c.req.json<Record<string, unknown>>();

    const client = await pool.connect();
    try {
      await requireProvider(client, userId);

      const existing = await client.query(
        "SELECT id FROM activities WHERE id = $1 AND provider_id = $2",
        [activityId, userId]
      );
      if (existing.rows.length === 0) {
        return c.json({ error: "Activity not found" }, 404);
      }

      await client.query("BEGIN");

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (body.title !== undefined) {
        fields.push(`title = $${i++}`);
        values.push(String(body.title).trim());
      }
      if (body.description !== undefined) {
        fields.push(`description = $${i++}`);
        values.push(String(body.description).trim());
      }
      if (body.startsAt !== undefined) {
        fields.push(`starts_at = $${i++}`);
        values.push(body.startsAt || null);
      }
      if (body.endsAt !== undefined) {
        fields.push(`ends_at = $${i++}`);
        values.push(body.endsAt || null);
      }
      if (body.feeAmount !== undefined) {
        fields.push(`fee_amount = $${i++}`);
        values.push(body.feeAmount);
      }
      if (body.feeCurrency !== undefined) {
        fields.push(`fee_currency = $${i++}`);
        values.push(body.feeCurrency);
      }
      if (body.minGradeId !== undefined) {
        fields.push(`min_grade_id = $${i++}`);
        values.push(body.minGradeId || null);
      }
      if (body.maxGradeId !== undefined) {
        fields.push(`max_grade_id = $${i++}`);
        values.push(body.maxGradeId || null);
      }
      if (body.locationText !== undefined) {
        fields.push(`location_text = $${i++}`);
        values.push(body.locationText ? String(body.locationText).trim() : null);
      }
      if (body.status !== undefined) {
        const st = String(body.status);
        if (!ACTIVITY_STATUSES.includes(st as typeof ACTIVITY_STATUSES[number])) {
          await client.query("ROLLBACK");
          return c.json({ error: "Invalid status" }, 400);
        }
        fields.push(`status = $${i++}`);
        values.push(st);
      }

      if (fields.length > 0) {
        fields.push(`updated_at = now()`);
        const idIdx = i++;
        const providerIdx = i;
        values.push(activityId, userId);
        await client.query(
          `UPDATE activities SET ${fields.join(", ")}
           WHERE id = $${idIdx} AND provider_id = $${providerIdx}`,
          values
        );
      }

      if (body.pinCodes !== undefined || body.curriculumIds !== undefined) {
        const extras = await loadActivityExtras(client, activityId);
        const pinCodes =
          body.pinCodes !== undefined
            ? (body.pinCodes as string[]).map((p) => p.trim()).filter(Boolean)
            : extras.pinCodes;
        const curriculumIds =
          body.curriculumIds !== undefined
            ? (body.curriculumIds as string[])
            : extras.curriculumIds;
        if (pinCodes.length === 0) {
          await client.query("ROLLBACK");
          return c.json({ error: "At least one pin code is required" }, 400);
        }
        await syncActivityTargeting(client, activityId, pinCodes, curriculumIds);
      }

      await client.query("COMMIT");

      const updated = await client.query(
        "SELECT * FROM activities WHERE id = $1",
        [activityId]
      );
      const extras = await loadActivityExtras(client, activityId);
      return c.json(
        mapActivity(updated.rows[0], extras.pinCodes, extras.curriculumIds)
      );
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof HTTPException) throw err;
      throw err;
    } finally {
      client.release();
    }
  });

  app.delete("/activities/:id", async (c) => {
    const userId = c.get("user").sub;
    const activityId = c.req.param("id");
    const client = await pool.connect();
    try {
      await requireProvider(client, userId);
      const result = await client.query(
        "DELETE FROM activities WHERE id = $1 AND provider_id = $2 RETURNING id",
        [activityId, userId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Activity not found" }, 404);
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  return app;
}

export function createActivitiesRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.get("/", authMiddleware, async (c) => {
    const userId = c.get("user").sub;
    const pin = c.req.query("pin");
    const curriculumId = c.req.query("curriculum");
    const search = c.req.query("q");

    const client = await pool.connect();
    try {
      let userPin = pin?.trim();
      if (!userPin) {
        const loc = await client.query(
          "SELECT pin_code FROM user_locations WHERE user_id = $1",
          [userId]
        );
        userPin = loc.rows[0]?.pin_code;
      }
      if (!userPin) {
        return c.json({ error: "Pin code required — set your location first" }, 400);
      }

      let query = `
        SELECT DISTINCT a.*,
               p.org_name, p.provider_type, p.verified
        FROM activities a
        JOIN providers p ON p.user_id = a.provider_id
        JOIN activity_pin_codes apc ON apc.activity_id = a.id
        WHERE a.status = 'published'
          AND apc.pin_code = $1`;
      const params: unknown[] = [userPin];
      let idx = 2;

      if (curriculumId) {
        query += `
          AND (
            NOT EXISTS (SELECT 1 FROM activity_curricula ac WHERE ac.activity_id = a.id)
            OR EXISTS (
              SELECT 1 FROM activity_curricula ac
              WHERE ac.activity_id = a.id AND ac.curriculum_id = $${idx}
            )
          )`;
        params.push(curriculumId);
        idx++;
      } else {
        query += `
          AND (
            NOT EXISTS (SELECT 1 FROM activity_curricula ac WHERE ac.activity_id = a.id)
            OR EXISTS (
              SELECT 1 FROM activity_curricula ac
              JOIN children ch ON ch.curriculum_id = ac.curriculum_id
              WHERE ac.activity_id = a.id AND ch.user_id = $${idx}
            )
          )`;
        params.push(userId);
        idx++;
      }

      if (search?.trim()) {
        query += ` AND a.search_vector @@ plainto_tsquery('english', $${idx})`;
        params.push(search.trim());
        idx++;
      }

      query += ` ORDER BY a.starts_at NULLS LAST, a.created_at DESC LIMIT 50`;

      const { rows } = await client.query(query, params);

      const activities = await Promise.all(
        rows.map(async (row) => {
          const extras = await loadActivityExtras(client, row.id);
          return mapActivity(
            row,
            extras.pinCodes,
            extras.curriculumIds,
            {
              orgName: row.org_name,
              providerType: row.provider_type,
              verified: row.verified,
            }
          );
        })
      );

      return c.json(activities);
    } finally {
      client.release();
    }
  });

  app.get("/:id", authMiddleware, async (c) => {
    const userId = c.get("user").sub;
    const activityId = c.req.param("id");
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT a.*, p.org_name, p.provider_type, p.verified
         FROM activities a
         JOIN providers p ON p.user_id = a.provider_id
         WHERE a.id = $1 AND a.status = 'published'`,
        [activityId]
      );
      if (rows.length === 0) {
        return c.json({ error: "Activity not found" }, 404);
      }

      const loc = await client.query(
        "SELECT pin_code FROM user_locations WHERE user_id = $1",
        [userId]
      );
      const userPin = loc.rows[0]?.pin_code;
      const extras = await loadActivityExtras(client, activityId);

      if (userPin && !extras.pinCodes.includes(userPin)) {
        return c.json({ error: "Activity not available in your area" }, 403);
      }

      return c.json(
        mapActivity(rows[0], extras.pinCodes, extras.curriculumIds, {
          orgName: rows[0].org_name,
          providerType: rows[0].provider_type,
          verified: rows[0].verified,
        })
      );
    } finally {
      client.release();
    }
  });

  return app;
}
