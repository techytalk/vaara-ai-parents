import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { buildPeerView } from "../services/disclosure.js";
import { createNotification } from "../services/notifications.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

const ROLES = ["driver", "rider", "either"] as const;
const STATUSES = ["open", "forming", "active", "paused", "closed"] as const;

async function getOrCreateConversation(
  client: PoolClient,
  userA: string,
  userB: string
) {
  const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
  const existing = await client.query(
    `SELECT id FROM conversations WHERE user_a_id = $1 AND user_b_id = $2`,
    [a, b]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO conversations (user_a_id, user_b_id) VALUES ($1, $2) RETURNING id`,
    [a, b]
  );
  const convId = inserted.rows[0].id;
  await client.query(
    `INSERT INTO conversation_participants (conversation_id, user_id)
     VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
    [convId, userA, userB]
  );
  return convId;
}

export function createCarpoolRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/matches", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const child = await client.query(
        `SELECT ch.school_id, ul.pin_code, ul.community_key
         FROM children ch
         JOIN user_locations ul ON ul.user_id = ch.user_id
         WHERE ch.user_id = $1
         LIMIT 1`,
        [userId]
      );
      if (child.rows.length === 0) {
        return c.json({ error: "Add a child and location first" }, 400);
      }

      const { school_id, pin_code, community_key } = child.rows[0];
      const { rows } = await client.query(
        `SELECT o.id, o.role, o.direction, o.days_of_week, o.departure_time,
                o.seats, o.notes, u.anonymous_handle
         FROM carpool_offers o
         JOIN users u ON u.id = o.user_id
         WHERE o.user_id <> $1
           AND o.school_id = $2
           AND o.pin_code = $3
           AND (o.community_key IS NULL OR o.community_key = $4)
           AND o.status IN ('open', 'forming')
         ORDER BY o.departure_time
         LIMIT 30`,
        [userId, school_id, pin_code, community_key]
      );

      return c.json(
        rows.map((row) => ({
          id: row.id,
          role: row.role,
          direction: row.direction,
          daysOfWeek: row.days_of_week,
          departureTime: row.departure_time,
          seats: row.seats,
          notes: row.notes,
          ownerHandle: row.anonymous_handle,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.post("/offers", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      schoolId?: string;
      role?: string;
      direction?: string;
      daysOfWeek?: number[];
      departureTime?: string;
      seats?: number;
      notes?: string;
    }>();

    if (
      !body.role ||
      !body.direction ||
      !body.daysOfWeek?.length ||
      !body.departureTime
    ) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    if (!ROLES.includes(body.role as typeof ROLES[number])) {
      return c.json({ error: "Invalid role" }, 400);
    }

    const client = await pool.connect();
    try {
      const child = await client.query(
        `SELECT school_id FROM children WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const schoolId = body.schoolId ?? child.rows[0]?.school_id;
      if (!schoolId) {
        return c.json({ error: "Link a child to a school first" }, 400);
      }

      const loc = await client.query(
        `SELECT pin_code, community_key FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (loc.rows.length === 0) {
        return c.json({ error: "Set your location first" }, 400);
      }

      const { rows } = await client.query(
        `INSERT INTO carpool_offers
           (user_id, school_id, community_key, pin_code, role, direction,
            days_of_week, departure_time, seats, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          userId,
          schoolId,
          loc.rows[0].community_key,
          loc.rows[0].pin_code,
          body.role,
          body.direction,
          body.daysOfWeek,
          body.departureTime,
          body.seats ?? null,
          body.notes?.trim() || null,
        ]
      );
      return c.json({ id: rows[0].id }, 201);
    } finally {
      client.release();
    }
  });

  app.patch("/offers/:id", async (c) => {
    const userId = c.get("user").sub;
    const offerId = c.req.param("id");
    const body = await c.req.json<{ status?: string; notes?: string }>();

    const client = await pool.connect();
    try {
      const fields: string[] = ["updated_at = now()"];
      const values: unknown[] = [];
      let i = 1;

      if (body.status) {
        if (!STATUSES.includes(body.status as typeof STATUSES[number])) {
          return c.json({ error: "Invalid status" }, 400);
        }
        fields.push(`status = $${i++}`);
        values.push(body.status);
      }
      if (body.notes !== undefined) {
        fields.push(`notes = $${i++}`);
        values.push(body.notes?.trim() || null);
      }

      values.push(offerId, userId);
      await client.query(
        `UPDATE carpool_offers SET ${fields.join(", ")}
         WHERE id = $${i++} AND user_id = $${i}`,
        values
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/arrangements", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      schoolId?: string;
      daysOfWeek?: number[];
      departureTime?: string;
      offerIds?: string[];
    }>();

    if (!body.daysOfWeek?.length || !body.departureTime) {
      return c.json({ error: "daysOfWeek and departureTime are required" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const child = await client.query(
        `SELECT school_id FROM children WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const schoolId = body.schoolId ?? child.rows[0]?.school_id;
      if (!schoolId) {
        await client.query("ROLLBACK");
        return c.json({ error: "School required" }, 400);
      }

      const arr = await client.query(
        `INSERT INTO carpool_arrangements
           (school_id, status, departure_time, days_of_week, created_by)
         VALUES ($1, 'forming', $2, $3, $4)
         RETURNING id`,
        [schoolId, body.departureTime, body.daysOfWeek, userId]
      );
      const arrId = arr.rows[0].id;

      await client.query(
        `INSERT INTO carpool_participants (arrangement_id, user_id, role)
         VALUES ($1, $2, 'either')`,
        [arrId, userId]
      );

      if (Array.isArray(body.offerIds)) {
        for (const offerId of body.offerIds) {
          const offer = await client.query(
            `SELECT user_id, role FROM carpool_offers WHERE id = $1`,
            [offerId]
          );
          if (offer.rows.length === 0) continue;
          await client.query(
            `INSERT INTO carpool_participants (arrangement_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [arrId, offer.rows[0].user_id, offer.rows[0].role]
          );
        }
      }

      await client.query("COMMIT");
      return c.json({ id: arrId }, 201);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/arrangements/:id/join", async (c) => {
    const userId = c.get("user").sub;
    const arrangementId = c.req.param("id");
    const body = await c.req.json<{ role?: string }>();
    const role = body.role ?? "either";
    if (!ROLES.includes(role as typeof ROLES[number])) {
      return c.json({ error: "Invalid role" }, 400);
    }

    const client = await pool.connect();
    try {
      const arr = await client.query(
        `SELECT id, status FROM carpool_arrangements WHERE id = $1`,
        [arrangementId]
      );
      if (arr.rows.length === 0 || arr.rows[0].status === "closed") {
        return c.json({ error: "Arrangement not found" }, 404);
      }

      await client.query(
        `INSERT INTO carpool_participants (arrangement_id, user_id, role, left_at)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (arrangement_id, user_id) DO UPDATE SET
           role = EXCLUDED.role,
           left_at = NULL`,
        [arrangementId, userId, role]
      );

      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/arrangements/:id/confirm-disclosure", async (c) => {
    const userId = c.get("user").sub;
    const arrangementId = c.req.param("id");
    const client = await pool.connect();
    try {
      const contact = await client.query(
        `SELECT first_name, block_or_flat, contact_phone, vehicle_description
         FROM user_contact_details WHERE user_id = $1`,
        [userId]
      );
      if (
        contact.rows.length === 0 ||
        !contact.rows[0].first_name ||
        !contact.rows[0].block_or_flat ||
        !contact.rows[0].contact_phone ||
        !contact.rows[0].vehicle_description
      ) {
        return c.json(
          {
            error:
              "Add full contact details (name, flat, phone, vehicle) before carpool disclosure",
          },
          400
        );
      }

      const member = await client.query(
        `UPDATE carpool_participants
         SET disclosure_confirmed_at = now()
         WHERE arrangement_id = $1 AND user_id = $2 AND left_at IS NULL
         RETURNING arrangement_id`,
        [arrangementId, userId]
      );
      if (member.rows.length === 0) {
        return c.json({ error: "Not a participant" }, 404);
      }

      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/arrangements/:id/activate", async (c) => {
    const userId = c.get("user").sub;
    const arrangementId = c.req.param("id");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const arr = await client.query(
        `SELECT id, created_by FROM carpool_arrangements WHERE id = $1`,
        [arrangementId]
      );
      if (arr.rows.length === 0 || arr.rows[0].created_by !== userId) {
        await client.query("ROLLBACK");
        return c.json({ error: "Not authorized" }, 403);
      }

      await client.query(`SELECT assert_carpool_fully_disclosed($1)`, [
        arrangementId,
      ]);

      await client.query(
        `UPDATE carpool_arrangements SET status = 'active' WHERE id = $1`,
        [arrangementId]
      );

      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err instanceof Error && err.message.includes("disclosure")) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/arrangements/:id/leave", async (c) => {
    const userId = c.get("user").sub;
    const arrangementId = c.req.param("id");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE carpool_participants SET left_at = now()
         WHERE arrangement_id = $1 AND user_id = $2`,
        [arrangementId, userId]
      );

      const others = await client.query(
        `SELECT cp.user_id, u.push_token, u.notification_prefs
         FROM carpool_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.arrangement_id = $1
           AND cp.user_id <> $2
           AND cp.left_at IS NULL`,
        [arrangementId, userId]
      );

      for (const row of others.rows) {
        await createNotification(client, {
          userId: row.user_id,
          type: "carpool_update",
          title: "A parent left your carpool",
          body: "Open carpool to see who is still in the arrangement",
          data: { arrangementId },
          pushToken: row.push_token,
          notificationPrefs: row.notification_prefs,
        });
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

  app.get("/arrangements/:id", async (c) => {
    const userId = c.get("user").sub;
    const arrangementId = c.req.param("id");
    const client = await pool.connect();
    try {
      const member = await client.query(
        `SELECT 1 FROM carpool_participants
         WHERE arrangement_id = $1 AND user_id = $2 AND left_at IS NULL`,
        [arrangementId, userId]
      );
      if (member.rows.length === 0) {
        return c.json({ error: "Not found" }, 404);
      }

      const arr = await client.query(
        `SELECT * FROM carpool_arrangements WHERE id = $1`,
        [arrangementId]
      );

      const participants = await client.query(
        `SELECT cp.user_id, cp.role, cp.disclosure_confirmed_at, u.anonymous_handle
         FROM carpool_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.arrangement_id = $1 AND cp.left_at IS NULL`,
        [arrangementId]
      );

      const peerViews = await Promise.all(
        participants.rows.map(async (p) => {
          const convId = await getOrCreateConversation(client, userId, p.user_id);
          const peer = await buildPeerView(client, {
            conversationId: convId,
            viewerId: userId,
          });
          return {
            userId: p.user_id,
            role: p.role,
            disclosureConfirmed: Boolean(p.disclosure_confirmed_at),
            handle: p.anonymous_handle,
            peerView:
              arr.rows[0].status === "active" && p.disclosure_confirmed_at
                ? peer
                : null,
          };
        })
      );

      return c.json({
        id: arr.rows[0].id,
        status: arr.rows[0].status,
        departureTime: arr.rows[0].departure_time,
        daysOfWeek: arr.rows[0].days_of_week,
        disclaimer:
          "Vaara introduces parents and records the arrangement. It does not vet drivers, verify licences, insure rides, or track vehicles.",
        participants: peerViews,
      });
    } finally {
      client.release();
    }
  });

  return app;
}
