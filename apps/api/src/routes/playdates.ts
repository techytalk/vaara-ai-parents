import { Hono } from "hono";
import { pool } from "@vaara/db";
import { isBlocked } from "../lib/author.js";
import { resolveAvatarKey } from "../lib/avatar.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

const AGE_BANDS = ["0_2", "2_4", "4_6", "6_8", "8_12", "12_plus"] as const;
const MIN_POOL_SIZE = 3;

export function createPlaydateRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/matches", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const user = await client.query(
        `SELECT onboarding_complete FROM users WHERE id = $1`,
        [userId]
      );
      if (!user.rows[0]?.onboarding_complete) {
        return c.json({ available: false, reason: "Complete onboarding first" });
      }

      const mine = await client.query(
        `SELECT age_band, scope, community_key, pin_code
         FROM playdate_optins
         WHERE user_id = $1 AND active = true`,
        [userId]
      );
      if (mine.rows.length === 0) {
        return c.json({ available: false, reason: "Opt in a child first" });
      }

      const opt = mine.rows[0];
      const { rows } = await client.query(
        `SELECT DISTINCT u.id, u.anonymous_handle, u.avatar_key, po.age_band
         FROM playdate_optins po
         JOIN users u ON u.id = po.user_id
         WHERE po.active = true
           AND po.user_id <> $1
           AND po.age_band = $2
           AND (
             (po.scope = 'community' AND po.community_key = $3)
             OR (po.scope = 'pin' AND po.pin_code = $4)
           )`,
        [userId, opt.age_band, opt.community_key, opt.pin_code]
      );

      if (rows.length < MIN_POOL_SIZE - 1) {
        return c.json({
          available: false,
          reason: "Not enough families nearby yet",
          count: rows.length,
        });
      }

      return c.json({
        available: true,
        ageBand: opt.age_band,
        count: rows.length,
        matches: rows.map((row) => ({
          userId: row.id,
          anonymousHandle: row.anonymous_handle,
          avatarKey: resolveAvatarKey(row.avatar_key, row.anonymous_handle),
          ageBand: row.age_band,
        })),
      });
    } finally {
      client.release();
    }
  });

  app.post("/optin", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      childId?: string;
      ageBand?: string;
      scope?: string;
    }>();

    if (!body.childId || !body.ageBand || !body.scope) {
      return c.json({ error: "childId, ageBand and scope are required" }, 400);
    }
    if (!AGE_BANDS.includes(body.ageBand as typeof AGE_BANDS[number])) {
      return c.json({ error: "Invalid age band" }, 400);
    }
    if (body.scope !== "community" && body.scope !== "pin") {
      return c.json({ error: "scope must be community or pin" }, 400);
    }

    const client = await pool.connect();
    try {
      const child = await client.query(
        `SELECT id FROM children WHERE id = $1 AND user_id = $2`,
        [body.childId, userId]
      );
      if (child.rows.length === 0) {
        return c.json({ error: "Child not found" }, 404);
      }

      const loc = await client.query(
        `SELECT pin_code, community_key FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (loc.rows.length === 0) {
        return c.json({ error: "Set your location first" }, 400);
      }

      await client.query(
        `INSERT INTO playdate_optins
           (user_id, child_id, age_band, scope, community_key, pin_code, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (child_id) DO UPDATE SET
           age_band = EXCLUDED.age_band,
           scope = EXCLUDED.scope,
           community_key = EXCLUDED.community_key,
           pin_code = EXCLUDED.pin_code,
           active = true`,
        [
          userId,
          body.childId,
          body.ageBand,
          body.scope,
          body.scope === "community" ? loc.rows[0].community_key : null,
          loc.rows[0].pin_code,
        ]
      );

      return c.json({ ok: true }, 201);
    } finally {
      client.release();
    }
  });

  app.delete("/optin/:childId", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("childId");
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE playdate_optins SET active = false
         WHERE child_id = $1 AND user_id = $2`,
        [childId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/connect", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{ peerUserId?: string }>();
    const peerUserId = body.peerUserId;
    if (!peerUserId || peerUserId === userId) {
      return c.json({ error: "peerUserId is required" }, 400);
    }

    const client = await pool.connect();
    try {
      if (await isBlocked(client, userId, peerUserId)) {
        return c.json({ error: "Cannot message this parent" }, 403);
      }

      const [userA, userB] =
        userId < peerUserId ? [userId, peerUserId] : [peerUserId, userId];

      let convId: string;
      const conv = await client.query(
        `SELECT id FROM conversations
         WHERE user_a_id = $1 AND user_b_id = $2`,
        [userA, userB]
      );

      if (conv.rows.length > 0) {
        convId = conv.rows[0].id;
      } else {
        const inserted = await client.query(
          `INSERT INTO conversations (user_a_id, user_b_id)
           VALUES ($1, $2)
           RETURNING id`,
          [userA, userB]
        );
        convId = inserted.rows[0].id;
        await client.query(
          `INSERT INTO conversation_participants (conversation_id, user_id)
           VALUES ($1, $2), ($1, $3)
           ON CONFLICT DO NOTHING`,
          [convId, userId, peerUserId]
        );
      }

      const peer = await client.query(
        `SELECT anonymous_handle, avatar_key FROM users WHERE id = $1`,
        [peerUserId]
      );

      return c.json({
        conversationId: convId,
        peer: {
          userId: peerUserId,
          anonymousHandle: peer.rows[0]?.anonymous_handle ?? "Parent",
          avatarKey: resolveAvatarKey(
            peer.rows[0]?.avatar_key,
            peer.rows[0]?.anonymous_handle ?? "Parent"
          ),
        },
      });
    } finally {
      client.release();
    }
  });

  return app;
}
