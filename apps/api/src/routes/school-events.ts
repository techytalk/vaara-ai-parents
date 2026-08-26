import { Hono } from "hono";
import { pool } from "@vaara/db";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

export function createSchoolEventsRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.post("/:id/flag", async (c) => {
    const userId = c.get("user").sub;
    const eventId = c.req.param("id");
    const body = await c.req.json<{ flag?: string; note?: string }>();

    if (body.flag !== "confirm" && body.flag !== "dispute") {
      return c.json({ error: "flag must be confirm or dispute" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const event = await client.query(
        `SELECT id, confirmed_count, disputed_count FROM school_events
         WHERE id = $1 AND hidden = false`,
        [eventId]
      );
      if (event.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "Event not found" }, 404);
      }

      const existing = await client.query(
        `SELECT flag FROM school_event_flags WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId]
      );

      if (existing.rows.length > 0) {
        const prev = existing.rows[0].flag;
        if (prev === "confirm") {
          await client.query(
            `UPDATE school_events SET confirmed_count = GREATEST(confirmed_count - 1, 0)
             WHERE id = $1`,
            [eventId]
          );
        } else if (prev === "dispute") {
          await client.query(
            `UPDATE school_events SET disputed_count = GREATEST(disputed_count - 1, 0)
             WHERE id = $1`,
            [eventId]
          );
        }
      }

      await client.query(
        `INSERT INTO school_event_flags (event_id, user_id, flag, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, user_id) DO UPDATE SET
           flag = EXCLUDED.flag,
           note = EXCLUDED.note,
           created_at = now()`,
        [eventId, userId, body.flag, body.note?.trim() || null]
      );

      if (body.flag === "confirm") {
        await client.query(
          `UPDATE school_events SET confirmed_count = confirmed_count + 1, updated_at = now()
           WHERE id = $1`,
          [eventId]
        );
      } else {
        await client.query(
          `UPDATE school_events SET disputed_count = disputed_count + 1, updated_at = now()
           WHERE id = $1`,
          [eventId]
        );
      }

      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/:id/remind", async (c) => {
    const userId = c.get("user").sub;
    const eventId = c.req.param("id");
    const body = await c.req.json<{ fireAt?: string }>();

    if (!body.fireAt) {
      return c.json({ error: "fireAt is required" }, 400);
    }

    const fireDate = new Date(body.fireAt);
    if (Number.isNaN(fireDate.getTime())) {
      return c.json({ error: "Invalid fireAt" }, 400);
    }

    const client = await pool.connect();
    try {
      const event = await client.query(
        `SELECT id, title, source, confirmed_count FROM school_events
         WHERE id = $1 AND hidden = false`,
        [eventId]
      );
      if (event.rows.length === 0) {
        return c.json({ error: "Event not found" }, 404);
      }

      const unconfirmed =
        event.rows[0].source === "parent_reported" &&
        event.rows[0].confirmed_count < 3;
      const title = unconfirmed
        ? `[Unconfirmed] ${event.rows[0].title}`
        : event.rows[0].title;

      const { rows } = await client.query(
        `INSERT INTO reminders (user_id, school_event_id, title, fire_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, fire_at, sent, created_at`,
        [userId, eventId, title, fireDate.toISOString()]
      );

      return c.json(
        {
          id: rows[0].id,
          title: rows[0].title,
          fireAt: rows[0].fire_at,
          sent: rows[0].sent,
          createdAt: rows[0].created_at,
        },
        201
      );
    } finally {
      client.release();
    }
  });

  return app;
}
