import { Hono } from "hono";
import { pool } from "@vaara/db";
import { randomUUID } from "crypto";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import { getOrCreateConversation } from "../lib/conversations.js";
import { isBlocked } from "../lib/author.js";
import { parseReportReason } from "../lib/report-reasons.js";
import { userHasRole } from "../lib/user-roles.js";
import {
  incrementDailyQuota,
  isCircleMember,
  isLinearCircleType,
  loadThreadAccess,
} from "../services/chat-access.js";
import {
  createCircleMessage,
  createThread,
  listHome,
  listInbox,
  listLinearMessages,
  listThreadMessages,
  publishChatNudge,
} from "../services/chat.js";
import { drainChatOutbox } from "../services/chat-outbox.js";

export { drainChatOutbox };

function parseSeq(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function createChatRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  const messageLimit = rateLimitMiddleware({
    prefix: "group-message",
    limit: 60,
    windowSeconds: 3600,
  });
  const threadLimit = rateLimitMiddleware({
    prefix: "thread-create",
    limit: 10,
    windowSeconds: 3600,
  });

  app.get("/inbox", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      return c.json(await listInbox(client, userId));
    } finally {
      client.release();
    }
  });

  app.get("/home", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      return c.json(await listHome(client, userId));
    } finally {
      client.release();
    }
  });

  app.post("/home/impressions", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      threadIds?: string[];
      updateIds?: string[];
      dismissedThreadIds?: string[];
    }>();
    const client = await pool.connect();
    try {
      for (const threadId of body.threadIds ?? []) {
        await client.query(
          `INSERT INTO home_thread_impressions (user_id, thread_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, thread_id)
           DO UPDATE SET last_seen_at = now()`,
          [userId, threadId]
        );
      }
      for (const updateId of body.updateIds ?? []) {
        await client.query(
          `INSERT INTO home_provider_update_impressions (user_id, update_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, update_id)
           DO UPDATE SET last_seen_at = now()`,
          [userId, updateId]
        );
      }
      for (const threadId of body.dismissedThreadIds ?? []) {
        await client.query(
          `UPDATE home_thread_impressions
           SET dismissed_at = now()
           WHERE user_id = $1 AND thread_id = $2`,
          [userId, threadId]
        );
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  return app;
}

export function createCircleChatRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  const messageLimit = rateLimitMiddleware({
    prefix: "group-message",
    limit: 60,
    windowSeconds: 3600,
  });
  const threadLimit = rateLimitMiddleware({
    prefix: "thread-create",
    limit: 10,
    windowSeconds: 3600,
  });

  app.get("/:circleId/messages", async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const client = await pool.connect();
    try {
      const result = await listLinearMessages({
        client,
        userId,
        circleId,
        beforeSeq: parseSeq(c.req.query("beforeSeq")),
        afterSeq: parseSeq(c.req.query("afterSeq")),
        limit: Math.min(Number(c.req.query("limit") ?? 40), 100),
      });
      return c.json(result);
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/messages", messageLimit, async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const body = await c.req.json<{
      body?: string;
      clientMessageId?: string;
      replyToMessageId?: string;
    }>();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await createCircleMessage({
        client,
        userId,
        circleId,
        body: body.body ?? "",
        clientMessageId: body.clientMessageId ?? randomUUID(),
        replyToMessageId: body.replyToMessageId,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 429);
      }
      await client.query("COMMIT");
      await publishChatNudge({
        circleId,
        messageId: result.message.id,
        seq: result.message.seq,
        authorId: userId,
      });
      return c.json(result.message, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/chat-read", async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const body = await c.req.json<{
      lastReadMessageSeq?: number;
      lastSeenThreadSeq?: number;
    }>();
    const client = await pool.connect();
    try {
      if (!(await isCircleMember(client, circleId, userId))) {
        return c.json({ error: "Not a member of this group" }, 403);
      }
      await client.query(
        `INSERT INTO circle_chat_reads (
           circle_id, user_id, last_read_message_seq, last_seen_thread_seq, last_read_at
         )
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (circle_id, user_id) DO UPDATE SET
           last_read_message_seq = COALESCE(EXCLUDED.last_read_message_seq, circle_chat_reads.last_read_message_seq),
           last_seen_thread_seq = COALESCE(EXCLUDED.last_seen_thread_seq, circle_chat_reads.last_seen_thread_seq),
           last_read_at = now()`,
        [
          circleId,
          userId,
          body.lastReadMessageSeq ?? null,
          body.lastSeenThreadSeq ?? null,
        ]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/:circleId/threads", async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const scope = c.req.query("scope") ?? "local";
    const client = await pool.connect();
    try {
      const member = await isCircleMember(client, circleId, userId);
      if (!member) return c.json({ error: "Not a member of this group" }, 403);
      const circle = await client.query(
        `SELECT circle_type FROM circles WHERE id = $1`,
        [circleId]
      );
      const loc = await client.query(
        `SELECT pin_code FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      const pin = loc.rows[0]?.pin_code ?? null;
      const localOnly =
        circle.rows[0]?.circle_type === "curriculum" && scope !== "all";
      const { rows } = await client.query(
        `SELECT t.*, COALESCE(tr.following, false) AS following, tr.last_read_seq
         FROM circle_threads t
         LEFT JOIN circle_thread_reads tr
           ON tr.thread_id = t.id AND tr.user_id = $2
         WHERE t.circle_id = $1
           AND t.status <> 'deleted'
           ${
             localOnly
               ? `AND EXISTS (
                    SELECT 1 FROM user_locations ul
                    WHERE ul.user_id = t.author_id AND ul.pin_code = $3
                  )`
               : ""
           }
         ORDER BY t.last_activity_seq DESC
         LIMIT 25`,
        localOnly ? [circleId, userId, pin] : [circleId, userId]
      );
      return c.json({
        linear: isLinearCircleType(String(circle.rows[0]?.circle_type)),
        threads: rows.map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          kind: row.kind,
          replyCount: row.reply_count,
          lastMessageAt: row.last_message_at,
          following: row.following === true,
          unread:
            Number(row.last_activity_seq) > Number(row.last_read_seq ?? 0),
        })),
      });
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/threads", threadLimit, async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const body = await c.req.json<{
      title?: string;
      body?: string;
      kind?: string;
      serviceRepliesAllowed?: boolean;
    }>();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await createThread({
        client,
        userId,
        circleId,
        title: body.title,
        body: body.body,
        kind: body.kind,
        serviceRepliesAllowed: body.serviceRepliesAllowed,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 429);
      }
      await client.query("COMMIT");
      await publishChatNudge({
        circleId,
        threadId: String(result.thread.id),
        seq: Number(result.thread.created_seq),
        authorId: userId,
      });
      return c.json(result.thread, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/guest-threads", threadLimit, async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const body = await c.req.json<{ title?: string; body?: string; kind?: string }>();
    const client = await pool.connect();
    try {
      if (!(await incrementDailyQuota(client, userId, "guest_thread", 5))) {
        return c.json({ error: "Guest thread daily limit reached" }, 429);
      }
      await client.query("BEGIN");
      const result = await createThread({
        client,
        userId,
        circleId,
        title: body.title,
        body: body.body,
        kind: body.kind,
        guest: true,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 429);
      }
      await client.query("COMMIT");
      return c.json(result.thread, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  return app;
}

export function createThreadRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  const messageLimit = rateLimitMiddleware({
    prefix: "group-message",
    limit: 60,
    windowSeconds: 3600,
  });

  app.get("/:threadId", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.canRead) {
        return c.json({ error: "Thread not found" }, 404);
      }
      const { rows } = await client.query(
        `SELECT t.*, c.display_name, c.circle_type
         FROM circle_threads t
         JOIN circles c ON c.id = t.circle_id
         WHERE t.id = $1`,
        [threadId]
      );
      const row = rows[0];
      return c.json({
        id: row.id,
        circleId: row.circle_id,
        circleName: row.display_name,
        circleType: row.circle_type,
        title: row.title,
        body: row.body,
        kind: row.kind,
        status: row.status,
        replyCount: row.reply_count,
        lastMessageAt: row.last_message_at,
        serviceRepliesAllowed: row.service_replies_allowed,
        access: {
          canReply: access.canReply,
          canOpenGroup: access.canOpenGroup,
          grantRole: access.grantRole,
        },
      });
    } finally {
      client.release();
    }
  });

  app.get("/:threadId/messages", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const result = await listThreadMessages({
        client,
        userId,
        threadId,
        beforeSeq: parseSeq(c.req.query("beforeSeq")),
        afterSeq: parseSeq(c.req.query("afterSeq")),
        limit: Math.min(Number(c.req.query("limit") ?? 40), 100),
      });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 429);
      }
      return c.json(result);
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/messages", messageLimit, async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const body = await c.req.json<{
      body?: string;
      clientMessageId?: string;
      replyToMessageId?: string;
      asProvider?: boolean;
    }>();
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access) return c.json({ error: "Thread not found" }, 404);
      const authorRole =
        body.asProvider && (await userHasRole(client, userId, "provider"))
          ? "provider"
          : "parent";
      await client.query("BEGIN");
      const result = await createCircleMessage({
        client,
        userId,
        circleId: access.circleId,
        threadId,
        body: body.body ?? "",
        clientMessageId: body.clientMessageId ?? randomUUID(),
        replyToMessageId: body.replyToMessageId,
        authorRole,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 429);
      }
      await client.query("COMMIT");
      await publishChatNudge({
        circleId: access.circleId,
        threadId,
        messageId: result.message.id,
        seq: result.message.seq,
        authorId: userId,
      });
      return c.json(result.message, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/read", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const body = await c.req.json<{ lastReadSeq?: number }>();
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.canRead) {
        return c.json({ error: "Thread not found" }, 404);
      }
      await client.query(
        `INSERT INTO circle_thread_reads (thread_id, user_id, last_read_seq, last_read_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (thread_id, user_id) DO UPDATE SET
           last_read_seq = COALESCE(EXCLUDED.last_read_seq, circle_thread_reads.last_read_seq),
           last_read_at = now()`,
        [threadId, userId, body.lastReadSeq ?? null]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/follow", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.canRead) {
        return c.json({ error: "Thread not found" }, 404);
      }
      await client.query(
        `INSERT INTO circle_thread_reads (thread_id, user_id, following, last_read_at)
         VALUES ($1, $2, true, now())
         ON CONFLICT (thread_id, user_id) DO UPDATE SET following = true`,
        [threadId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.delete("/:threadId/follow", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE circle_thread_reads SET following = false
         WHERE thread_id = $1 AND user_id = $2`,
        [threadId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/grants", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const body = await c.req.json<{ userId?: string }>();
    if (!body.userId) return c.json({ error: "userId is required" }, 400);
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.isMember) {
        return c.json({ error: "Only members can invite guests" }, 403);
      }
      if (await isBlocked(client, userId, body.userId)) {
        return c.json({ error: "Cannot invite this parent" }, 403);
      }
      await client.query(
        `INSERT INTO circle_thread_access_grants (
           thread_id, user_id, grant_role, granted_by, can_reply
         )
         VALUES ($1, $2, 'guest_replier', $3, true)
         ON CONFLICT DO NOTHING`,
        [threadId, body.userId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/message-author", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.canRead) {
        return c.json({ error: "Thread not found" }, 404);
      }
      const thread = await client.query(
        `SELECT author_id, circle_id FROM circle_threads WHERE id = $1`,
        [threadId]
      );
      const authorId = String(thread.rows[0].author_id);
      if (authorId === userId) {
        return c.json({ error: "Cannot message yourself" }, 400);
      }
      if (await isBlocked(client, userId, authorId)) {
        return c.json({ error: "Cannot message this parent" }, 403);
      }
      const conversationId = await getOrCreateConversation(client, {
        userId,
        peerUserId: authorId,
        initiatedFromCircleId: access.circleId,
        initiatedFromThreadId: threadId,
      });
      return c.json({ conversationId });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/report", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const parsed = parseReportReason(await c.req.json());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const client = await pool.connect();
    try {
      const thread = await client.query(
        `SELECT author_id FROM circle_threads WHERE id = $1`,
        [threadId]
      );
      if (thread.rows.length === 0) return c.json({ error: "Thread not found" }, 404);
      await client.query(
        `INSERT INTO reports (reporter_id, target_thread_id, target_user_id, reason)
         VALUES ($1, $2, $3, $4)`,
        [userId, threadId, thread.rows[0].author_id, parsed.reason]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  return app;
}

export function createProviderChannelRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/:providerId", async (c) => {
    const providerId = String(c.req.param("providerId"));
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT p.user_id, p.org_name, p.provider_type, ch.status
         FROM providers p
         JOIN provider_channels ch ON ch.provider_id = p.user_id
         WHERE p.user_id = $1`,
        [providerId]
      );
      if (rows.length === 0) return c.json({ error: "Channel not found" }, 404);
      const updates = await client.query(
        `SELECT id, title, preview, published_at, expires_at, activity_id, status
         FROM provider_channel_updates
         WHERE provider_id = $1 AND status IN ('published', 'expired')
         ORDER BY published_at DESC NULLS LAST
         LIMIT 40`,
        [providerId]
      );
      return c.json({
        providerId: rows[0].user_id,
        name: rows[0].org_name,
        status: rows[0].status,
        updates: updates.rows,
      });
    } finally {
      client.release();
    }
  });

  app.post("/:providerId/follow", async (c) => {
    const userId = c.get("user").sub;
    const providerId = String(c.req.param("providerId"));
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO provider_channel_follows (provider_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [providerId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.delete("/:providerId/follow", async (c) => {
    const userId = c.get("user").sub;
    const providerId = String(c.req.param("providerId"));
    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM provider_channel_follows WHERE provider_id = $1 AND user_id = $2`,
        [providerId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:providerId/updates", async (c) => {
    const userId = c.get("user").sub;
    const providerId = String(c.req.param("providerId"));
    if (userId !== providerId) {
      return c.json({ error: "Only the provider can publish updates" }, 403);
    }
    const body = await c.req.json<{
      title?: string;
      preview?: string;
      activityId?: string;
      expiresAt?: string;
    }>();
    if (!body.title?.trim()) return c.json({ error: "Title is required" }, 400);
    const client = await pool.connect();
    try {
      if (!(await incrementDailyQuota(client, userId, "channel_update", 5))) {
        return c.json({ error: "Daily update limit reached" }, 429);
      }
      const { rows } = await client.query(
        `INSERT INTO provider_channel_updates (
           provider_id, activity_id, title, preview, published_at, expires_at, status
         )
         VALUES ($1, $2, $3, $4, now(), $5, 'published')
         RETURNING *`,
        [
          providerId,
          body.activityId ?? null,
          body.title.trim(),
          body.preview ?? null,
          body.expiresAt ?? null,
        ]
      );
      return c.json(rows[0], 201);
    } finally {
      client.release();
    }
  });

  return app;
}
