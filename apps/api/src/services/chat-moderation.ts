import type { PoolClient } from "pg";
import { PROFILE_SUSPENDED_COPY } from "../lib/chat-copy.js";
import { insertChatOutbox } from "./chat-access.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;
const HANDLE_RE = /^Parent-[A-HJ-NP-Z2-9]{4}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export const POSTING_BLOCKED_ERROR = PROFILE_SUSPENDED_COPY;

export async function assertCanPost(
  client: PoolClient,
  userId: string
): Promise<{ error: string; status: number } | null> {
  const { rows } = await client.query(
    `SELECT content_blocked FROM users WHERE id = $1`,
    [userId]
  );
  if (rows[0]?.content_blocked === true) {
    return { error: POSTING_BLOCKED_ERROR, status: 403 };
  }
  return null;
}

export function parseMessageIds(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "messageIds is required" };
  const ids = [
    ...new Set(
      raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
  if (ids.length === 0) return { error: "messageIds is required" };
  if (ids.length > MAX_IDS) {
    return { error: `Select at most ${MAX_IDS} messages` };
  }
  if (ids.some((id) => !isUuid(id))) return { error: "Invalid message id" };
  return ids;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function isUndefinedColumn(err: unknown, column: string): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === "42703" || (e.message ?? "").includes(column);
}

export async function searchModeration(
  client: PoolClient,
  q: string
): Promise<{
  parents: Array<Record<string, unknown>>;
  circles: Array<Record<string, unknown>>;
}> {
  const query = q.trim();
  if (query.length < 2) return { parents: [], circles: [] };

  const like = `%${escapeLike(query)}%`;
  const uuid = isUuid(query) ? query : null;
  const handleExact = HANDLE_RE.test(query) ? query : null;
  const parentParams = [like, uuid, handleExact];

  const parentSql = (blockedColumn: boolean) =>
    `SELECT
       u.id,
       u.email,
       u.anonymous_handle,
       u.display_name,
       ${blockedColumn ? "u.content_blocked" : "false AS content_blocked"},
       to_char(u.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist
     FROM users u
     WHERE u.role = 'parent'
       AND (
         ($2::uuid IS NOT NULL AND u.id = $2)
         OR ($3::text IS NOT NULL AND u.anonymous_handle ILIKE $3)
         OR u.anonymous_handle ILIKE $1 ESCAPE '\\'
         OR u.email ILIKE $1 ESCAPE '\\'
       )
     ORDER BY
       CASE
         WHEN $3::text IS NOT NULL AND u.anonymous_handle ILIKE $3 THEN 0
         WHEN $2::uuid IS NOT NULL AND u.id = $2 THEN 0
         ELSE 1
       END,
       u.created_at DESC
     LIMIT 20`;

  let parentRows: Array<Record<string, unknown>> = [];
  try {
    parentRows = (await client.query(parentSql(true), parentParams)).rows;
  } catch (err) {
    if (!isUndefinedColumn(err, "content_blocked")) throw err;
    parentRows = (await client.query(parentSql(false), parentParams)).rows;
  }

  const circles = await client.query(
    `SELECT
       c.id,
       c.circle_type::text AS circle_type,
       c.display_name,
       c.key,
       COUNT(m.id)::int AS hit_count
     FROM circles c
     LEFT JOIN circle_messages m ON m.circle_id = c.id
     WHERE c.display_name ILIKE $1 ESCAPE '\\'
        OR c.key ILIKE $1 ESCAPE '\\'
        OR coalesce(c.metadata->>'pin_code', '') ILIKE $1 ESCAPE '\\'
        OR coalesce(c.metadata->>'code', '') ILIKE $1 ESCAPE '\\'
        OR coalesce(c.metadata->>'normalized_key', '') ILIKE $1 ESCAPE '\\'
     GROUP BY c.id
     ORDER BY COUNT(m.id) DESC, c.display_name
     LIMIT 40`,
    [like]
  );

  return { parents: parentRows, circles: circles.rows };
}

export async function listParentModerationCircles(
  client: PoolClient,
  userId: string
): Promise<Array<Record<string, unknown>> | { error: string; status: number }> {
  const user = await client.query(
    `SELECT id FROM users WHERE id = $1 AND role = 'parent'`,
    [userId]
  );
  if (user.rows.length === 0) return { error: "Parent not found", status: 404 };

  const { rows } = await client.query(
    `SELECT
       c.id,
       c.circle_type::text AS circle_type,
       c.display_name,
       c.key,
       COUNT(*) FILTER (WHERE m.status = 'visible')::int AS visible_count,
       COUNT(*) FILTER (WHERE m.status = 'moderated')::int AS moderated_count,
       COUNT(*)::int AS total_count,
       to_char(MAX(m.created_at) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS last_ist
     FROM circle_messages m
     JOIN circles c ON c.id = m.circle_id
     WHERE m.author_id = $1
     GROUP BY c.id
     ORDER BY MAX(m.created_at) DESC`,
    [userId]
  );
  return rows;
}

export async function listCircleModerationMessages(
  client: PoolClient,
  params: {
    circleId: string;
    authorId?: string | null;
    beforeSeq?: number | null;
    limit: number;
  }
): Promise<
  | {
      messages: Array<Record<string, unknown>>;
      nextCursor: number | null;
    }
  | { error: string; status: number }
> {
  const circle = await client.query(`SELECT id FROM circles WHERE id = $1`, [
    params.circleId,
  ]);
  if (circle.rows.length === 0) return { error: "Circle not found", status: 404 };

  const values: unknown[] = [params.circleId];
  const filters = [`m.circle_id = $1`, `m.thread_id IS NULL`];
  if (params.authorId) {
    values.push(params.authorId);
    filters.push(`(
      m.author_id = $${values.length}
      OR m.id IN (
        SELECT t.root_message_id
        FROM circle_threads t
        JOIN circle_messages r ON r.thread_id = t.id
        WHERE t.circle_id = $1
          AND r.author_id = $${values.length}
          AND t.root_message_id IS NOT NULL
      )
    )`);
  }
  if (params.beforeSeq != null) {
    values.push(params.beforeSeq);
    filters.push(`m.seq < $${values.length}`);
  }
  values.push(params.limit);
  const { rows } = await client.query(
    `SELECT
       m.id,
       m.seq,
       m.status,
       m.body,
       m.thread_id,
       t.id AS side_thread_id,
       to_char(m.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
       u.id AS author_id,
       u.anonymous_handle,
       u.email,
       COALESCE(t.reply_count, 0) AS reply_count,
       0 AS attachment_count
     FROM circle_messages m
     JOIN users u ON u.id = m.author_id
     LEFT JOIN circle_threads t
       ON t.root_message_id = m.id AND t.status <> 'deleted'
     WHERE ${filters.join(" AND ")}
     ORDER BY m.seq DESC
     LIMIT $${values.length}`,
    values
  );
  const messageIds = rows.map((row) => String(row.id));
  if (messageIds.length > 0) {
    const threadIds = rows
      .map((row) => (row.side_thread_id ? String(row.side_thread_id) : null))
      .filter((id): id is string => Boolean(id));
    const [media, replies] = await Promise.all([
      client.query(
        `SELECT message_id, COUNT(*)::int AS attachment_count
         FROM circle_message_media
         WHERE message_id = ANY($1::uuid[])
         GROUP BY message_id`,
        [messageIds]
      ),
      threadIds.length > 0
        ? client.query(
            `SELECT thread_id, COUNT(*)::int AS reply_count
             FROM circle_messages
             WHERE thread_id = ANY($1::uuid[])
             GROUP BY thread_id`,
            [threadIds]
          )
        : Promise.resolve({ rows: [] as Array<{ thread_id: string; reply_count: number }> }),
    ]);
    const mediaCounts = new Map<string, number>(
      media.rows.map((row) => [
        String(row.message_id),
        Number(row.attachment_count),
      ] as [string, number])
    );
    const replyCounts = new Map<string, number>(
      replies.rows.map((row) => [
        String(row.thread_id),
        Number(row.reply_count),
      ] as [string, number])
    );
    for (const row of rows) {
      row.attachment_count = mediaCounts.get(String(row.id)) ?? 0;
      row.reply_count = row.side_thread_id
        ? (replyCounts.get(String(row.side_thread_id)) ?? 0)
        : 0;
    }
  }
  const nextCursor =
    rows.length === params.limit ? Number(rows[rows.length - 1].seq) : null;
  return { messages: rows, nextCursor };
}

export async function listMessageReplies(
  client: PoolClient,
  messageId: string
): Promise<
  | { replies: Array<Record<string, unknown>>; root: Record<string, unknown> }
  | { error: string; status: number }
> {
  const root = await client.query(
    `SELECT
       m.id,
       m.seq,
       m.status,
       m.body,
       m.circle_id,
       t.id AS side_thread_id,
       to_char(m.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
       u.id AS author_id,
       u.anonymous_handle,
       u.email
     FROM circle_messages m
     JOIN users u ON u.id = m.author_id
     LEFT JOIN circle_threads t
       ON t.root_message_id = m.id AND t.status <> 'deleted'
     WHERE m.id = $1`,
    [messageId]
  );
  if (root.rows.length === 0) return { error: "Message not found", status: 404 };

  const { rows } = await client.query(
    `SELECT
       m.id,
       m.seq,
       m.status,
       m.body,
       m.thread_id,
       to_char(m.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
       u.id AS author_id,
       u.anonymous_handle,
       u.email,
       0 AS attachment_count
     FROM circle_messages m
     JOIN users u ON u.id = m.author_id
     JOIN circle_threads t ON t.id = m.thread_id
     WHERE t.root_message_id = $1
     ORDER BY m.seq ASC`,
    [messageId]
  );
  const replyIds = rows.map((row) => String(row.id));
  if (replyIds.length > 0) {
    const media = await client.query(
      `SELECT message_id, COUNT(*)::int AS attachment_count
       FROM circle_message_media
       WHERE message_id = ANY($1::uuid[])
       GROUP BY message_id`,
      [replyIds]
    );
    const counts = new Map<string, number>(
      media.rows.map((row) => [
        String(row.message_id),
        Number(row.attachment_count),
      ] as [string, number])
    );
    for (const row of rows) {
      row.attachment_count = counts.get(String(row.id)) ?? 0;
    }
  }
  return { root: root.rows[0], replies: rows };
}

export async function getModerationThread(
  client: PoolClient,
  threadId: string
): Promise<
  | { circleId: string; rootMessageId: string; threadId: string }
  | { error: string; status: number }
> {
  const { rows } = await client.query(
    `SELECT id, circle_id, root_message_id
     FROM circle_threads WHERE id = $1`,
    [threadId]
  );
  if (!rows[0]?.root_message_id) {
    return { error: "Thread not found", status: 404 };
  }
  return {
    threadId: String(rows[0].id),
    circleId: String(rows[0].circle_id),
    rootMessageId: String(rows[0].root_message_id),
  };
}

export async function hideMessages(
  client: PoolClient,
  params: {
    messageIds: string[];
    actor: string;
    reason?: string;
    note?: string;
    includeReplies?: boolean;
  }
): Promise<{
  updated: string[];
  skipped: string[];
  circleIds: string[];
  nudges: Array<{
    circleId: string;
    threadId: string | null;
    messageId: string;
    seq: number;
  }>;
}> {
  const ids = params.messageIds;
  const expanded = await client.query<{ id: string }>(
    params.includeReplies
      ? `SELECT DISTINCT m.id
         FROM circle_messages m
         WHERE m.id = ANY($1::uuid[])
            OR m.thread_id IN (
              SELECT t.id FROM circle_threads t
              WHERE t.root_message_id = ANY($1::uuid[])
            )`
      : `SELECT id FROM circle_messages WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const targetIds = expanded.rows.map((row) => row.id);
  const requested = new Set(ids);

  const updated = await client.query<{
    id: string;
    circle_id: string;
    thread_id: string | null;
    seq: string | number;
  }>(
    `UPDATE circle_messages
     SET status = 'moderated'
     WHERE id = ANY($1::uuid[]) AND status = 'visible'
     RETURNING id, circle_id, thread_id, seq`,
    [targetIds]
  );

  const updatedIds = new Set(updated.rows.map((row) => row.id));
  const skipped = ids.filter((id) => !updatedIds.has(id) && requested.has(id));
  const circleIds = [...new Set(updated.rows.map((row) => String(row.circle_id)))];

  if (updated.rows.length === 0) {
    return { updated: [], skipped, circleIds: [], nudges: [] };
  }

  await client.query(
    `INSERT INTO admin_moderation_actions (
       action, actor, reason, note, message_ids, payload
     )
     VALUES ('hide', $1, $2, $3, $4::uuid[], $5::jsonb)`,
    [
      params.actor,
      params.reason?.trim() || "not_appropriate",
      params.note?.trim() || null,
      updated.rows.map((row) => row.id),
      JSON.stringify({
        circleIds,
        includeReplies: params.includeReplies === true,
        requestedIds: ids,
      }),
    ]
  );

  const nudges = [];
  for (const row of updated.rows) {
    const circleId = String(row.circle_id);
    const threadId = row.thread_id ? String(row.thread_id) : null;
    await insertChatOutbox(client, "message.updated", "message", row.id, {
      circleId,
      threadId,
      messageId: row.id,
      seq: Number(row.seq),
    });
    nudges.push({
      circleId,
      threadId,
      messageId: row.id,
      seq: Number(row.seq),
    });
  }

  return {
    updated: updated.rows.map((row) => row.id),
    skipped,
    circleIds,
    nudges,
  };
}

export async function unhideMessages(
  client: PoolClient,
  params: { messageIds: string[]; actor: string; note?: string }
): Promise<{
  updated: string[];
  skipped: string[];
  circleIds: string[];
  nudges: Array<{
    circleId: string;
    threadId: string | null;
    messageId: string;
    seq: number;
  }>;
}> {
  const ids = params.messageIds;
  const updated = await client.query<{
    id: string;
    circle_id: string;
    thread_id: string | null;
    seq: string | number;
  }>(
    `UPDATE circle_messages
     SET status = 'visible'
     WHERE id = ANY($1::uuid[]) AND status = 'moderated'
     RETURNING id, circle_id, thread_id, seq`,
    [ids]
  );
  const updatedIds = new Set(updated.rows.map((row) => row.id));
  const skipped = ids.filter((id) => !updatedIds.has(id));
  const circleIds = [...new Set(updated.rows.map((row) => String(row.circle_id)))];

  if (updated.rows.length === 0) {
    return { updated: [], skipped, circleIds: [], nudges: [] };
  }

  await client.query(
    `INSERT INTO admin_moderation_actions (
       action, actor, reason, note, message_ids, payload
     )
     VALUES ('unhide', $1, NULL, $2, $3::uuid[], $4::jsonb)`,
    [
      params.actor,
      params.note?.trim() || null,
      updated.rows.map((row) => row.id),
      JSON.stringify({ circleIds, requestedIds: ids }),
    ]
  );

  const nudges = [];
  for (const row of updated.rows) {
    const circleId = String(row.circle_id);
    const threadId = row.thread_id ? String(row.thread_id) : null;
    await insertChatOutbox(client, "message.updated", "message", row.id, {
      circleId,
      threadId,
      messageId: row.id,
      seq: Number(row.seq),
    });
    nudges.push({
      circleId,
      threadId,
      messageId: row.id,
      seq: Number(row.seq),
    });
  }

  return {
    updated: updated.rows.map((row) => row.id),
    skipped,
    circleIds,
    nudges,
  };
}

export async function setParentPostingBlock(
  client: PoolClient,
  params: {
    userId: string;
    blocked: boolean;
    actor: string;
    reason?: string;
    note?: string;
  }
): Promise<
  | {
      userId: string;
      anonymousHandle: string;
      contentBlocked: boolean;
    }
  | { error: string; status: number }
> {
  const updated = await client.query<{
    id: string;
    anonymous_handle: string;
    content_blocked: boolean;
  }>(
    `UPDATE users
     SET
       content_blocked = $2,
       content_blocked_at = CASE
         WHEN $2 THEN now()
         ELSE content_blocked_at
       END,
       content_blocked_reason = CASE
         WHEN $2 THEN COALESCE(NULLIF($3, ''), 'not_appropriate')
         ELSE content_blocked_reason
       END,
       updated_at = now()
     WHERE id = $1 AND role = 'parent'
     RETURNING id, anonymous_handle, content_blocked`,
    [params.userId, params.blocked, params.reason?.trim() || null]
  );
  if (updated.rows.length === 0) {
    return { error: "Parent not found", status: 404 };
  }
  await client.query(
    `INSERT INTO admin_moderation_actions (
       action, actor, reason, note, message_ids, payload
     )
     VALUES ($1, $2, $3, $4, '{}'::uuid[], $5::jsonb)`,
    [
      params.blocked ? "block_posting" : "unblock_posting",
      params.actor,
      params.blocked ? params.reason?.trim() || "not_appropriate" : null,
      params.note?.trim() || null,
      JSON.stringify({
        userId: params.userId,
        anonymousHandle: updated.rows[0].anonymous_handle,
      }),
    ]
  );
  return {
    userId: String(updated.rows[0].id),
    anonymousHandle: String(updated.rows[0].anonymous_handle),
    contentBlocked: updated.rows[0].content_blocked === true,
  };
}

export async function listModerationActions(
  client: PoolClient,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const { rows } = await client.query(
    `SELECT
       id,
       action,
       actor,
       reason,
       note,
       cardinality(message_ids) AS message_count,
       to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist
     FROM admin_moderation_actions
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
