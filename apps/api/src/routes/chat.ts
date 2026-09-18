import { publishThreadEvent, publishUserInboxEvent } from "@vaara/redis";
import { Hono } from "hono";
import { pool } from "@vaara/db";
import { randomUUID } from "crypto";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import { getOrCreateConversation } from "../lib/conversations.js";
import { isBlocked } from "../lib/author.js";
import { parseReportReason } from "../lib/report-reasons.js";
import { userHasRole } from "../lib/user-roles.js";
import { parseChatAttachments } from "../lib/chat-attachments.js";
import {
  createChatMediaUrl,
  createDocumentDownloadUrl,
  deleteStoredMedia,
  isMediaStorageConfigured,
} from "../lib/media-storage.js";
import {
  incrementDailyQuota,
  isCircleMember,
  loadThreadAccess,
} from "../services/chat-access.js";
import {
  createCircleMessage,
  createThread,
  deleteCircleMessage,
  editCircleMessage,
  ensureThreadForMessage,
  listHome,
  listInbox,
  listLinearMessages,
  listMatchedServiceThreads,
  listThreadMessages,
  openProviderThread,
  publishChatNudge,
  setMessageReaction,
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
      return c.json(
        await listHome(client, userId, {
          cursor: c.req.query("cursor"),
          limit: Number(c.req.query("limit") ?? 20),
        })
      );
    } finally {
      client.release();
    }
  });

  app.get("/matched-threads", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      if (!(await userHasRole(client, userId, "provider"))) {
        return c.json({ error: "Provider role required" }, 403);
      }
      return c.json({ threads: await listMatchedServiceThreads(client, userId) });
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

  /**
   * Resolve a chat attachment for the current viewer.
   *
   * Deliberately separate from `GET /v1/media/:mediaId/download`, which reads
   * `circle_post_media` and checks post membership. Documents get a 60-second
   * attachment URL; images and videos get an inline URL on the chat TTL.
   */
  app.get("/media/:mediaId/download", async (c) => {
    if (!isMediaStorageConfigured()) {
      return c.json({ error: "Attachments are not configured" }, 503);
    }
    const userId = c.get("user").sub;
    const mediaId = String(c.req.param("mediaId"));
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT mm.storage_key, mm.media_type, mm.mime_type, mm.file_name,
                mm.scan_status, m.circle_id, m.thread_id, m.author_id, m.status
         FROM circle_message_media mm
         JOIN circle_messages m ON m.id = mm.message_id
         WHERE mm.id = $1`,
        [mediaId]
      );
      const row = rows[0];
      if (!row || row.scan_status !== "clean" || row.status !== "visible") {
        return c.json({ error: "Attachment not found" }, 404);
      }

      if (row.thread_id) {
        const access = await loadThreadAccess(
          client,
          String(row.thread_id),
          userId
        );
        if (!access || !access.canRead) {
          return c.json({ error: "Attachment not found" }, 404);
        }
      } else if (
        !(await isCircleMember(client, String(row.circle_id), userId))
      ) {
        return c.json({ error: "You do not have access to this file" }, 403);
      }
      if (await isBlocked(client, userId, String(row.author_id))) {
        return c.json({ error: "Attachment not found" }, 404);
      }

      const storageKey = String(row.storage_key);
      const mimeType = String(row.mime_type);
      if (row.media_type === "document") {
        if (!row.file_name) return c.json({ error: "Attachment not found" }, 404);
        const download = await createDocumentDownloadUrl({
          storageKey,
          fileName: String(row.file_name),
          mimeType,
        });
        return c.json(download);
      }
      const signed = await createChatMediaUrl({ storageKey, mimeType });
      return c.json({
        downloadUrl: signed.url,
        expiresInSeconds: signed.expiresInSeconds,
      });
    } catch (error) {
      console.error("[chat] attachment download failed", error);
      return c.json({ error: "Could not prepare download" }, 500);
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
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 403);
      }
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
      attachments?: unknown;
    }>();
    const attachments = parseChatAttachments(body.attachments);
    if (!attachments.ok) return c.json({ error: attachments.error }, 400);
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
        attachments: attachments.items,
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

  const reactionLimit = rateLimitMiddleware({
    prefix: "group-reaction",
    limit: 120,
    windowSeconds: 3600,
  });

  app.patch("/:circleId/messages/:messageId", async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const messageId = String(c.req.param("messageId"));
    const body = await c.req.json<{ body?: string }>();
    const client = await pool.connect();
    try {
      const result = await editCircleMessage({
        client,
        userId,
        circleId,
        messageId,
        body: body.body ?? "",
      });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 403 | 404);
      }
      return c.json(result.message);
    } finally {
      client.release();
    }
  });

  app.delete("/:circleId/messages/:messageId", async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const messageId = String(c.req.param("messageId"));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await deleteCircleMessage({
        client,
        userId,
        circleId,
        messageId,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404);
      }
      await client.query("COMMIT");
      if (result.storageKeys.length > 0) {
        try {
          await deleteStoredMedia(result.storageKeys);
        } catch (error) {
          console.error("[chat] message delete S3 cleanup failed", error);
        }
      }
      return c.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/messages/:messageId/reactions", reactionLimit, async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const messageId = String(c.req.param("messageId"));
    const body = await c.req.json<{ reaction?: string }>();
    const client = await pool.connect();
    try {
      const result = await setMessageReaction({
        client,
        userId,
        circleId,
        messageId,
        reaction: body.reaction ?? "",
      });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 403 | 404);
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.delete("/:circleId/messages/:messageId/reactions", async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const messageId = String(c.req.param("messageId"));
    const reaction = c.req.query("reaction") ?? "";
    const client = await pool.connect();
    try {
      const result = await setMessageReaction({
        client,
        userId,
        circleId,
        messageId,
        reaction,
        remove: true,
      });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 403 | 404);
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  const reportLimit = rateLimitMiddleware({
    prefix: "chat-message-report",
    limit: 30,
    windowSeconds: 3600,
  });

  // Reporting a message implicitly reports its attachments. Access rules mirror
  // setMessageReaction: 404 (not 403) for thread messages the reporter cannot
  // read, so message IDs cannot be probed.
  app.post("/:circleId/messages/:messageId/report", reportLimit, async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const messageId = String(c.req.param("messageId"));
    const parsed = parseReportReason(await c.req.json());
    if (parsed.ok === false) return c.json({ error: parsed.error }, 400);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, thread_id, author_id FROM circle_messages
         WHERE id = $1 AND circle_id = $2 AND status = 'visible'`,
        [messageId, circleId]
      );
      const row = rows[0];
      if (!row) return c.json({ error: "Message not found" }, 404);
      if (row.thread_id) {
        const access = await loadThreadAccess(
          client,
          String(row.thread_id),
          userId
        );
        if (!access || !access.canRead) {
          return c.json({ error: "Message not found" }, 404);
        }
      } else if (!(await isCircleMember(client, circleId, userId))) {
        return c.json({ error: "Not a member of this group" }, 403);
      }
      if (String(row.author_id) === userId) {
        return c.json({ error: "You cannot report your own message" }, 400);
      }
      // Repeat reports of the same message are idempotent rather than stacking.
      const existing = await client.query(
        `SELECT 1 FROM reports
         WHERE reporter_id = $1 AND target_circle_message_id = $2
         LIMIT 1`,
        [userId, messageId]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO reports
             (reporter_id, target_circle_message_id, target_user_id, reason)
           VALUES ($1, $2, $3, $4)`,
          [userId, messageId, row.author_id, parsed.reason]
        );
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:circleId/messages/:messageId/thread", threadLimit, async (c) => {
    const userId = c.get("user").sub;
    const circleId = String(c.req.param("circleId"));
    const messageId = String(c.req.param("messageId"));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await ensureThreadForMessage({
        client,
        userId,
        circleId,
        messageId,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404);
      }
      await client.query("COMMIT");
      return c.json(result, result.created ? 201 : 200);
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
           last_read_message_seq = CASE
             WHEN EXCLUDED.last_read_message_seq IS NULL
               THEN circle_chat_reads.last_read_message_seq
             ELSE GREATEST(
               COALESCE(circle_chat_reads.last_read_message_seq, 0),
               EXCLUDED.last_read_message_seq
             )
           END,
           last_seen_thread_seq = CASE
             WHEN EXCLUDED.last_seen_thread_seq IS NULL
               THEN circle_chat_reads.last_seen_thread_seq
             ELSE GREATEST(
               COALESCE(circle_chat_reads.last_seen_thread_seq, 0),
               EXCLUDED.last_seen_thread_seq
             )
           END,
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
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $2 AND ub.blocked_id = t.author_id)
                OR (ub.blocker_id = t.author_id AND ub.blocked_id = $2)
           )
         ORDER BY t.last_activity_seq DESC
         LIMIT 25`,
        localOnly ? [circleId, userId, pin] : [circleId, userId]
      );
      return c.json({
        linear: true,
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
      await client.query("BEGIN");
      if (!(await incrementDailyQuota(client, userId, "guest_thread", 5))) {
        await client.query("ROLLBACK");
        return c.json({ error: "Guest thread daily limit reached" }, 429);
      }
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
      const muted = await client.query(
        `SELECT muted_until FROM circle_thread_reads
         WHERE thread_id = $1 AND user_id = $2`,
        [threadId, userId]
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
        lastActivitySeq: Number(row.last_activity_seq),
        rootMessageId: row.root_message_id,
        serviceRepliesAllowed: row.service_replies_allowed,
        muted: Boolean(
          muted.rows[0]?.muted_until &&
            new Date(muted.rows[0].muted_until).getTime() > Date.now()
        ),
        access: {
          canReply: access.canReply,
          canOpenGroup: access.canOpenGroup,
          canMessageAuthor: access.canMessageAuthor,
          grantRole: access.grantRole,
          discovery: access.discovery,
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
      attachments?: unknown;
    }>();
    const attachments = parseChatAttachments(body.attachments);
    if (!attachments.ok) return c.json({ error: attachments.error }, 400);
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
        attachments: attachments.items,
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
           last_read_seq = CASE
             WHEN EXCLUDED.last_read_seq IS NULL
               THEN circle_thread_reads.last_read_seq
             ELSE GREATEST(
               COALESCE(circle_thread_reads.last_read_seq, 0),
               EXCLUDED.last_read_seq
             )
           END,
           last_read_at = now()`,
        [threadId, userId, body.lastReadSeq ?? null]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/mute", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.canRead) {
        return c.json({ error: "Thread not found" }, 404);
      }
      await client.query(
        `INSERT INTO circle_thread_reads (thread_id, user_id, muted_until, last_read_at)
         VALUES ($1, $2, now() + interval '10 years', now())
         ON CONFLICT (thread_id, user_id) DO UPDATE SET muted_until = now() + interval '10 years'`,
        [threadId, userId]
      );
      return c.json({ ok: true, muted: true });
    } finally {
      client.release();
    }
  });

  app.delete("/:threadId/mute", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE circle_thread_reads SET muted_until = NULL
         WHERE thread_id = $1 AND user_id = $2`,
        [threadId, userId]
      );
      return c.json({ ok: true, muted: false });
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
        `INSERT INTO circle_thread_reads (thread_id, user_id, following, follow_explicit, last_read_at)
         VALUES ($1, $2, true, true, now())
         ON CONFLICT (thread_id, user_id) DO UPDATE SET
           following = true,
           follow_explicit = true`,
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
        `UPDATE circle_thread_reads
         SET following = false, follow_explicit = true
         WHERE thread_id = $1 AND user_id = $2`,
        [threadId, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/grants", async (c) => {
    // Manual guest invite is not a v1 product surface.
    return c.json({ error: "Guest invites are not available yet" }, 403);
  });

  app.patch("/:threadId", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const body = await c.req.json<{
      title?: string;
      body?: string;
      status?: "open" | "closed";
    }>();
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || access.authorId !== userId) {
        return c.json({ error: "Thread not found" }, 404);
      }
      const current = await client.query(
        `SELECT title, body, created_at, status, root_message_id
         FROM circle_threads WHERE id = $1`,
        [threadId]
      );
      const row = current.rows[0];
      if (row.status === "moderated" || row.status === "deleted") {
        return c.json({ error: "This thread cannot be changed" }, 400);
      }
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      if ((body.title != null || body.body != null) && ageMs > 60 * 60 * 1000) {
        return c.json({ error: "Edit window has closed" }, 400);
      }
      const title = body.title?.trim() ?? row.title;
      const text = body.body?.trim() ?? row.body;
      const status = body.status ?? row.status;
      if (status !== "open" && status !== "closed") {
        return c.json({ error: "Invalid status" }, 400);
      }
      await client.query("BEGIN");
      await client.query(
        `UPDATE circle_threads
         SET title = $2, body = $3, status = $4, updated_at = now()
         WHERE id = $1`,
        [threadId, title, text, status]
      );
      if (body.body != null && row.root_message_id) {
        await client.query(
          `UPDATE circle_messages
           SET body = $2, edited_at = now()
           WHERE id = $1 AND status = 'visible'`,
          [row.root_message_id, text]
        );
      }
      await client.query("COMMIT");
      return c.json({ ok: true, status });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.delete("/:threadId", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || access.authorId !== userId) {
        return c.json({ error: "Thread not found" }, 404);
      }
      const replies = await client.query(
        `SELECT COUNT(*)::int AS n FROM circle_messages WHERE thread_id = $1 AND status = 'visible'`,
        [threadId]
      );
      if (Number(replies.rows[0].n) > 0) {
        return c.json({ error: "Close the thread instead of deleting it" }, 400);
      }
      await client.query("BEGIN");
      const thread = await client.query(
        `UPDATE circle_threads
         SET status = 'deleted', updated_at = now()
         WHERE id = $1
         RETURNING root_message_id`,
        [threadId]
      );
      if (thread.rows[0]?.root_message_id) {
        await client.query(
          `UPDATE circle_messages
           SET status = 'deleted', body = NULL, deleted_at = now()
           WHERE id = $1`,
          [thread.rows[0].root_message_id]
        );
      }
      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.delete("/:threadId/grants/:grantUserId", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const grantUserId = String(c.req.param("grantUserId"));
    const client = await pool.connect();
    try {
      const access = await loadThreadAccess(client, threadId, userId);
      if (!access || !access.isMember) {
        return c.json({ error: "Not allowed" }, 403);
      }
      // guest_author revocation is moderator-only in v1.
      const grant = await client.query(
        `SELECT grant_role FROM circle_thread_access_grants
         WHERE thread_id = $1 AND user_id = $2 AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [threadId, grantUserId]
      );
      if (grant.rows[0]?.grant_role === "guest_author") {
        return c.json(
          { error: "Guest author access can only be revoked by moderation" },
          403
        );
      }
      if (
        grant.rows[0]?.grant_role !== "guest_replier" &&
        grant.rows[0]?.grant_role !== "provider_responder"
      ) {
        return c.json({ error: "No active grant found" }, 404);
      }
      await client.query(
        `UPDATE circle_thread_access_grants
         SET revoked_at = now()
         WHERE thread_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [threadId, grantUserId]
      );
      await publishUserInboxEvent(grantUserId, {
        type: "access.revoked",
        userId: grantUserId,
        circleId: access.circleId,
        threadId,
      });
      await publishThreadEvent(threadId, {
        type: "chat.message",
        circleId: access.circleId,
        threadId,
      });
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/provider-open", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const client = await pool.connect();
    try {
      const result = await openProviderThread(client, userId, threadId);
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 403 | 404);
      }
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
      if (!access || !access.canRead || !access.canMessageAuthor) {
        return c.json({ error: "Thread not found" }, 404);
      }
      const authorId = access.authorId;
      if (await isBlocked(client, userId, authorId)) {
        return c.json({ error: "Cannot message this parent" }, 403);
      }
      if (access.isMember) {
        const conversationId = await getOrCreateConversation(client, {
          userId,
          peerUserId: authorId,
          initiatedFromCircleId: access.circleId,
          initiatedFromThreadId: threadId,
        });
        return c.json({ kind: "conversation", conversationId });
      }
      if (!(await incrementDailyQuota(client, userId, "discovery_message", 10))) {
        return c.json({ error: "Daily message-author limit reached" }, 429);
      }
      const existing = await client.query(
        `SELECT id, status FROM parent_connection_requests
         WHERE sender_id = $1 AND recipient_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [userId, authorId]
      );
      if (existing.rows[0]?.status === "accepted") {
        const conversationId = await getOrCreateConversation(client, {
          userId,
          peerUserId: authorId,
          initiatedFromCircleId: access.circleId,
          initiatedFromThreadId: threadId,
        });
        return c.json({ kind: "conversation", conversationId });
      }
      await client.query(
        `INSERT INTO parent_connection_requests (sender_id, recipient_id, introduction)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, authorId, "From a thread on Home"]
      );
      return c.json({ kind: "request" });
    } finally {
      client.release();
    }
  });

  app.post("/:threadId/report", async (c) => {
    const userId = c.get("user").sub;
    const threadId = String(c.req.param("threadId"));
    const parsed = parseReportReason(await c.req.json());
    if (parsed.ok === false) return c.json({ error: parsed.error }, 400);
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
