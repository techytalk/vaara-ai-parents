import type { Hono } from "hono";
import { pool } from "@vaara/db";
import { publishChatNudge } from "../services/chat.js";
import {
  getModerationThread,
  hideMessages,
  isUuid,
  listCircleModerationMessages,
  listMessageReplies,
  listModerationActions,
  listParentModerationCircles,
  parseMessageIds,
  searchModeration,
  unhideMessages,
} from "../services/chat-moderation.js";

type AdminAuth = (c: {
  req: { header: (n: string) => string | undefined };
}) => Promise<{ email: string } | null>;

async function publishNudges(
  nudges: Array<{
    circleId: string;
    threadId: string | null;
    messageId: string;
    seq: number;
  }>
) {
  const seen = new Set<string>();
  for (const nudge of nudges) {
    const key = `${nudge.circleId}:${nudge.threadId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await publishChatNudge({
      circleId: nudge.circleId,
      threadId: nudge.threadId,
      messageId: nudge.messageId,
      seq: nudge.seq,
    });
  }
}

export function mountAdminModeration(app: Hono, requireAdminAuth: AdminAuth) {
  app.get("/admin/moderation/search", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const q = (c.req.query("q") ?? "").trim();
    const client = await pool.connect();
    try {
      const result = await searchModeration(client, q);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  app.get("/admin/moderation/parents/:userId/circles", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const userId = (c.req.param("userId") ?? "").trim();
    if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
    const client = await pool.connect();
    try {
      const result = await listParentModerationCircles(client, userId);
      if ("error" in result) return c.json({ error: result.error }, result.status as 404);
      return c.json({ ok: true, circles: result });
    } finally {
      client.release();
    }
  });

  app.get("/admin/moderation/circles/:circleId/messages", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const circleId = (c.req.param("circleId") ?? "").trim();
    if (!isUuid(circleId)) return c.json({ error: "Invalid circle id" }, 400);
    const authorId = (c.req.query("authorId") ?? "").trim();
    if (authorId && !isUuid(authorId)) {
      return c.json({ error: "Invalid author id" }, 400);
    }
    const beforeSeqRaw = c.req.query("beforeSeq");
    const beforeSeq = beforeSeqRaw ? Number(beforeSeqRaw) : null;
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 100);
    const client = await pool.connect();
    try {
      const result = await listCircleModerationMessages(client, {
        circleId,
        authorId: authorId || null,
        beforeSeq: Number.isFinite(beforeSeq) ? beforeSeq : null,
        limit,
      });
      if ("error" in result) return c.json({ error: result.error }, result.status as 404);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  app.get("/admin/moderation/messages/:messageId/replies", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const messageId = (c.req.param("messageId") ?? "").trim();
    if (!isUuid(messageId)) return c.json({ error: "Invalid message id" }, 400);
    const client = await pool.connect();
    try {
      const result = await listMessageReplies(client, messageId);
      if ("error" in result) return c.json({ error: result.error }, result.status as 404);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  app.get("/admin/moderation/threads/:threadId", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const threadId = (c.req.param("threadId") ?? "").trim();
    if (!isUuid(threadId)) return c.json({ error: "Invalid thread id" }, 400);
    const client = await pool.connect();
    try {
      const result = await getModerationThread(client, threadId);
      if ("error" in result) return c.json({ error: result.error }, result.status as 404);
      return c.json({ ok: true, ...result });
    } finally {
      client.release();
    }
  });

  app.get("/admin/moderation/actions", async (c) => {
    if (!(await requireAdminAuth(c))) return c.json({ error: "Unauthorized" }, 401);
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 20), 1), 50);
    const client = await pool.connect();
    try {
      const actions = await listModerationActions(client, limit);
      return c.json({ ok: true, actions });
    } finally {
      client.release();
    }
  });

  app.post("/admin/moderation/messages/hide", async (c) => {
    const admin = await requireAdminAuth(c);
    if (!admin) return c.json({ error: "Unauthorized" }, 401);
    let body: {
      messageIds?: unknown;
      reason?: string;
      note?: string;
      includeReplies?: boolean;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const ids = parseMessageIds(body.messageIds);
    if ("error" in ids) return c.json({ error: ids.error }, 400);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await hideMessages(client, {
        messageIds: ids,
        actor: admin.email,
        reason: body.reason,
        note: body.note,
        includeReplies: body.includeReplies === true,
      });
      await client.query("COMMIT");
      await publishNudges(result.nudges);
      return c.json({
        ok: true,
        updated: result.updated,
        skipped: result.skipped,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/admin/moderation/messages/unhide", async (c) => {
    const admin = await requireAdminAuth(c);
    if (!admin) return c.json({ error: "Unauthorized" }, 401);
    let body: { messageIds?: unknown; note?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const ids = parseMessageIds(body.messageIds);
    if ("error" in ids) return c.json({ error: ids.error }, 400);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await unhideMessages(client, {
        messageIds: ids,
        actor: admin.email,
        note: body.note,
      });
      await client.query("COMMIT");
      await publishNudges(result.nudges);
      return c.json({
        ok: true,
        updated: result.updated,
        skipped: result.skipped,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
