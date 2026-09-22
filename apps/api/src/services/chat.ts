import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { pool } from "@vaara/db";
import {
  publishCircleEvent,
  publishThreadEvent,
  publishUserInboxEvent,
  type RealtimeEvent,
} from "@vaara/redis";
import {
  detectMedicalAdvice,
  rejectObjectionableText,
} from "../lib/content-guard.js";
import {
  encodeChatHomeCursor,
  isAfterChatHomeCursor,
  parseChatHomeCursor,
} from "../lib/chat-home-cursor.js";
import { isBlocked } from "../lib/author.js";
import { MODERATED_MESSAGE_COPY } from "../lib/chat-copy.js";
import { userHasRole } from "../lib/user-roles.js";
import { assertCanPost } from "./chat-moderation.js";
import {
  insertChatAttachments,
  loadAttachmentPreviewLabels,
  loadChatAttachments,
  verifyChatAttachments,
  type ChatAttachmentInput,
  type ChatAttachmentView,
} from "../lib/chat-attachments.js";
import {
  DISCOVERY_MATCH_SQL,
  insertChatOutbox,
  incrementDailyQuota,
  isCircleMember,
  isLinearCircleType,
  listCircleInboxRecipients,
  loadThreadAccess,
  nextCircleSeq,
} from "./chat-access.js";

export type ChatAuthor = {
  userId: string;
  displayName: string;
  avatarKey: string | null;
  role: "parent" | "provider";
  isGuest: boolean;
  suspended: boolean;
};

export type ChatMessageView = {
  id: string;
  seq: number;
  circleId: string;
  threadId: string | null;
  sideThreadId: string | null;
  replyCount: number;
  lastReplyPreview: string | null;
  body: string | null;
  status: string;
  isLegacy: boolean;
  replyToMessageId: string | null;
  author: ChatAuthor;
  createdAt: string;
  editedAt: string | null;
  reactions: Array<{ reaction: string; count: number; mine: boolean }>;
  /** Always present, `[]` for messages without attachments. */
  attachments: ChatAttachmentView[];
};

export type ChatThreadView = {
  id: string;
  circleId: string;
  circleName: string;
  circleType: string;
  title: string | null;
  body: string | null;
  kind: string;
  homeVisibility: string;
  status: string;
  replyCount: number;
  lastMessageAt: string;
  lastActivitySeq: number;
  preview: string | null;
  unread: boolean;
  following: boolean;
  access: "member" | "guest" | "discovery";
};

function previewText(body: string | null, title: string | null): string {
  const source = (title ?? body ?? "").trim();
  return source.slice(0, 140);
}

function parentThreadPreview(
  rootStatus: unknown,
  body: string | null,
  title: string | null
): { title: string | null; preview: string } {
  if (rootStatus === "moderated") {
    return { title: null, preview: MODERATED_MESSAGE_COPY };
  }
  return { title, preview: previewText(body, title) };
}

function guardText(text: string): { error: string } | null {
  const medical = detectMedicalAdvice(text);
  if (medical.blocked) return { error: medical.reason ?? "Not allowed" };
  return rejectObjectionableText(text);
}

async function followThread(
  client: PoolClient,
  threadId: string,
  userId: string,
  options?: { lastReadSeq?: number | null; explicit?: boolean }
): Promise<void> {
  const lastReadSeq = options?.lastReadSeq ?? null;
  const explicit = options?.explicit === true;
  await client.query(
    `INSERT INTO circle_thread_reads (
       thread_id, user_id, following, follow_explicit, last_read_seq, last_read_at
     )
     VALUES ($1, $2, true, $3, $4, now())
     ON CONFLICT (thread_id, user_id)
     DO UPDATE SET
       following = CASE
         WHEN circle_thread_reads.follow_explicit AND NOT circle_thread_reads.following
           THEN circle_thread_reads.following
         ELSE true
       END,
       follow_explicit = CASE
         WHEN $3 THEN true
         ELSE circle_thread_reads.follow_explicit
       END,
       last_read_seq = CASE
         WHEN $4::bigint IS NULL THEN circle_thread_reads.last_read_seq
         ELSE GREATEST(COALESCE(circle_thread_reads.last_read_seq, 0), $4::bigint)
       END,
       last_read_at = now()`,
    [threadId, userId, explicit, lastReadSeq]
  );
}

async function authorView(
  client: PoolClient,
  userId: string,
  role: "parent" | "provider",
  isGuest: boolean
): Promise<ChatAuthor> {
  const { rows } = await client.query(
    `SELECT anonymous_handle, display_name, avatar_key, content_blocked
     FROM users WHERE id = $1`,
    [userId]
  );
  const handle = rows[0]?.anonymous_handle ?? "Parent";
  const suspended = rows[0]?.content_blocked === true;
  if (role === "provider") {
    const provider = await client.query(
      `SELECT org_name FROM providers WHERE user_id = $1`,
      [userId]
    );
    return {
      userId,
      displayName: provider.rows[0]?.org_name ?? handle,
      avatarKey: rows[0]?.avatar_key ?? null,
      role,
      isGuest,
      suspended,
    };
  }
  return {
    userId,
    displayName: handle,
    avatarKey: rows[0]?.avatar_key ?? null,
    role,
    isGuest,
    suspended,
  };
}

export function mapMessageRow(
  row: Record<string, unknown>,
  author: ChatAuthor
): ChatMessageView {
  return {
    id: String(row.id),
    seq: Number(row.seq),
    circleId: String(row.circle_id),
    threadId: row.thread_id ? String(row.thread_id) : null,
    sideThreadId: row.side_thread_id ? String(row.side_thread_id) : null,
    replyCount: Number(row.reply_count ?? 0),
    lastReplyPreview: row.last_reply_preview
      ? String(row.last_reply_preview)
      : null,
    body: row.status === "visible" ? (row.body as string | null) : null,
    status: String(row.status),
    isLegacy: row.is_legacy === true,
    replyToMessageId: row.reply_to_message_id
      ? String(row.reply_to_message_id)
      : null,
    author,
    createdAt: new Date(String(row.created_at)).toISOString(),
    editedAt: row.edited_at
      ? new Date(String(row.edited_at)).toISOString()
      : null,
    reactions: [],
    attachments: [],
  };
}

/**
 * Hydrate attachments for a page of messages in one query. Hidden messages get
 * nothing, matching how `mapMessageRow` withholds their body.
 */
async function attachAttachments(
  client: PoolClient,
  messages: ChatMessageView[]
): Promise<void> {
  const visible = messages.filter((message) => message.status === "visible");
  if (visible.length === 0) return;
  const byMessage = await loadChatAttachments(
    client,
    visible.map((message) => message.id)
  );
  for (const message of visible) {
    message.attachments = byMessage.get(message.id) ?? [];
  }
}

async function attachReactions(
  client: PoolClient,
  messages: ChatMessageView[],
  userId: string
): Promise<void> {
  if (messages.length === 0) return;
  const { rows } = await client.query(
    `SELECT message_id, reaction, COUNT(*)::int AS count,
            BOOL_OR(user_id = $2) AS mine
     FROM circle_message_reactions
     WHERE message_id = ANY($1::uuid[])
     GROUP BY message_id, reaction`,
    [messages.map((item) => item.id), userId]
  );
  const byId = new Map<string, ChatMessageView["reactions"]>();
  for (const row of rows) {
    const id = String(row.message_id);
    const list = byId.get(id) ?? [];
    list.push({
      reaction: String(row.reaction),
      count: Number(row.count),
      mine: row.mine === true,
    });
    byId.set(id, list);
  }
  for (const message of messages) {
    message.reactions = byId.get(message.id) ?? [];
  }
}

export async function editCircleMessage(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  messageId: string;
  body: string;
}): Promise<{ message: ChatMessageView } | { error: string; status: number }> {
  const body = params.body.trim();
  if (!body) return { error: "Message is required", status: 400 };
  if (body.length > 4000) return { error: "Message is too long", status: 400 };
  const blocked = guardText(body);
  if (blocked) return { error: blocked.error, status: 400 };
  const posting = await assertCanPost(params.client, params.userId);
  if (posting) return posting;
  const { rows } = await params.client.query(
    `SELECT * FROM circle_messages WHERE id = $1 AND circle_id = $2`,
    [params.messageId, params.circleId]
  );
  const row = rows[0];
  if (!row) return { error: "Message not found", status: 404 };
  if (String(row.author_id) !== params.userId) {
    return { error: "You can only edit your own message", status: 403 };
  }
  if (row.status !== "visible") {
    return { error: "Message cannot be edited", status: 400 };
  }
  if (Date.now() - new Date(row.created_at).getTime() > 15 * 60 * 1000) {
    return { error: "Edit window has closed", status: 400 };
  }
  const updated = await params.client.query(
    `UPDATE circle_messages SET body = $2, edited_at = now()
     WHERE id = $1 RETURNING *`,
    [params.messageId, body]
  );
  await params.client.query(
    `UPDATE circle_threads
     SET body = COALESCE(NULLIF(btrim(body), ''), $2),
         updated_at = now()
     WHERE root_message_id = $1`,
    [params.messageId, body]
  );
  const author = await authorView(
    params.client,
    params.userId,
    row.author_role,
    updated.rows[0].author_was_guest === true
  );
  const message = mapMessageRow(updated.rows[0], author);
  await attachAttachments(params.client, [message]);
  return { message };
}

export async function deleteCircleMessage(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  messageId: string;
}): Promise<
  | { ok: true; storageKeys: string[] }
  | { error: string; status: number }
> {
  const { rows } = await params.client.query(
    `SELECT * FROM circle_messages WHERE id = $1 AND circle_id = $2`,
    [params.messageId, params.circleId]
  );
  const row = rows[0];
  if (!row) return { error: "Message not found", status: 404 };
  if (String(row.author_id) !== params.userId) {
    return { error: "You can only delete your own message", status: 403 };
  }
  if (Date.now() - new Date(row.created_at).getTime() > 24 * 60 * 60 * 1000) {
    return { error: "Delete window has closed", status: 400 };
  }
  const media = await params.client.query<{ storage_key: string }>(
    `SELECT storage_key FROM circle_message_media WHERE message_id = $1`,
    [params.messageId]
  );
  const storageKeys = media.rows.map((item) => item.storage_key);
  await params.client.query(
    `UPDATE circle_messages
     SET status = 'deleted', body = NULL, deleted_at = now()
     WHERE id = $1`,
    [params.messageId]
  );
  // Drop attachment rows so reads cannot resurface them; S3 cleanup happens
  // after the transaction commits (caller).
  if (storageKeys.length > 0) {
    await params.client.query(
      `DELETE FROM circle_message_media WHERE message_id = $1`,
      [params.messageId]
    );
  }
  // Deleting a root closes its thread; deleting a reply refreshes counters via trigger.
  await params.client.query(
    `UPDATE circle_threads
     SET status = 'closed', updated_at = now()
     WHERE root_message_id = $1 AND status = 'open'`,
    [params.messageId]
  );
  return { ok: true, storageKeys };
}

export async function setMessageReaction(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  messageId: string;
  reaction: string;
  remove?: boolean;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const reaction = params.reaction.trim().slice(0, 32);
  if (!reaction) return { error: "Reaction is required", status: 400 };
  const { rows } = await params.client.query(
    `SELECT id, thread_id, author_id FROM circle_messages
     WHERE id = $1 AND circle_id = $2 AND status = 'visible'`,
    [params.messageId, params.circleId]
  );
  if (rows.length === 0) return { error: "Message not found", status: 404 };
  if (rows[0].thread_id) {
    const access = await loadThreadAccess(
      params.client,
      String(rows[0].thread_id),
      params.userId
    );
    if (!access || !access.canRead) return { error: "Message not found", status: 404 };
  } else if (!(await isCircleMember(params.client, params.circleId, params.userId))) {
    return { error: "Not a member of this group", status: 403 };
  }
  if (await isBlocked(params.client, params.userId, String(rows[0].author_id))) {
    return { error: "Cannot react to this message", status: 403 };
  }
  if (params.remove) {
    await params.client.query(
      `DELETE FROM circle_message_reactions
       WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
      [params.messageId, params.userId, reaction]
    );
  } else {
    await params.client.query(
      `INSERT INTO circle_message_reactions (message_id, user_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [params.messageId, params.userId, reaction]
    );
  }
  return { ok: true };
}

export async function listMatchedServiceThreads(
  client: PoolClient,
  providerUserId: string
) {
  const { rows } = await client.query(
    `SELECT t.id, t.title, t.body, t.kind, t.last_message_at, t.reply_count,
            c.display_name, c.circle_type, c.circle_type AS circle_label,
            root.status AS root_status
     FROM circle_threads t
     JOIN circles c ON c.id = t.circle_id
     JOIN providers p ON p.user_id = $1
     LEFT JOIN circle_messages root ON root.id = t.root_message_id
     WHERE t.service_replies_allowed = true
       AND t.status = 'open'
       AND NOT EXISTS (
         SELECT 1 FROM circle_members cm
         WHERE cm.circle_id = t.circle_id AND cm.user_id = $1
       )
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = $1 AND ub.blocked_id = t.author_id)
            OR (ub.blocker_id = t.author_id AND ub.blocked_id = $1)
       )
       AND (
         c.metadata->>'pin_code' = ANY (p.service_pin_codes)
         OR EXISTS (
           SELECT 1 FROM user_locations ul
           WHERE ul.user_id = t.author_id
             AND ul.pin_code = ANY (p.service_pin_codes)
         )
       )
     ORDER BY t.last_message_at DESC
     LIMIT 40`,
    [providerUserId]
  );
  return rows.map((row) => {
    const preview = parentThreadPreview(row.root_status, row.body, row.title);
    return {
      id: row.id,
      title: preview.title,
      body: preview.preview,
      kind: row.kind,
      circleName: row.display_name,
      circleType: row.circle_type,
      lastMessageAt: row.last_message_at,
      replyCount: row.reply_count,
    };
  });
}

export async function openProviderThread(
  client: PoolClient,
  userId: string,
  threadId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  if (!(await userHasRole(client, userId, "provider"))) {
    return { error: "Provider role required", status: 403 };
  }
  const thread = await client.query(
    `SELECT id, circle_id, author_id, status, service_replies_allowed
     FROM circle_threads WHERE id = $1`,
    [threadId]
  );
  if (thread.rows.length === 0) return { error: "Thread not found", status: 404 };
  if (thread.rows[0].status !== "open" || !thread.rows[0].service_replies_allowed) {
    return { error: "This thread is not open to providers", status: 403 };
  }
  if (await isBlocked(client, userId, String(thread.rows[0].author_id))) {
    return { error: "Cannot open this thread", status: 403 };
  }
  await client.query(
    `INSERT INTO circle_thread_access_grants (
       thread_id, user_id, grant_role, granted_by, can_reply
     )
     VALUES ($1, $2, 'provider_responder', $2, true)
     ON CONFLICT DO NOTHING`,
    [threadId, userId]
  );
  return { ok: true };
}

export async function createThread(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  title?: string | null;
  body?: string;
  kind?: string;
  homeVisibility?: string;
  serviceRepliesAllowed?: boolean;
  guest?: boolean;
}): Promise<{ thread: Record<string, unknown> } | { error: string; status: number }> {
  const client = params.client;
  const isParent = await userHasRole(client, params.userId, "parent");
  if (!isParent) return { error: "Parent role required", status: 403 };
  const posting = await assertCanPost(client, params.userId);
  if (posting) return posting;

  const member = await isCircleMember(client, params.circleId, params.userId);
  if (params.guest) {
    if (member) {
      return { error: "Use the group composer instead of a guest thread", status: 400 };
    }
    const circle = await client.query(
      `SELECT circle_type FROM circles WHERE id = $1`,
      [params.circleId]
    );
    if (circle.rows.length === 0) {
      return { error: "Group not found", status: 404 };
    }
    if (String(circle.rows[0].circle_type) !== "school") {
      return {
        error: "Guest questions are only allowed in whole-school groups",
        status: 403,
      };
    }
  } else if (!member) {
    return { error: "Not a member of this group", status: 403 };
  }

  const title = params.title?.trim() || null;
  const body = params.body?.trim() || "";
  if (!title && !params.guest) {
    return { error: "A thread title is required", status: 400 };
  }
  if (title && title.length > 140) {
    return { error: "Title is too long", status: 400 };
  }
  if (body.length > 4000) return { error: "Message is too long", status: 400 };
  const blocked = guardText(`${title ?? ""}\n${body}`);
  if (blocked) return { error: blocked.error, status: 400 };

  const kind = params.kind ?? "general";
  const allowedKinds = [
    "question",
    "recommendation",
    "heads_up",
    "poll",
    "general",
  ];
  if (!allowedKinds.includes(kind)) {
    return { error: "Invalid thread kind", status: 400 };
  }

  const seq = await nextCircleSeq(client, params.circleId);
  const { rows } = await client.query(
    `INSERT INTO circle_threads (
       created_seq, last_activity_seq, circle_id, author_id, author_role,
       title, body, kind, home_visibility, service_replies_allowed, status,
       last_message_at, reply_count
     )
     VALUES ($1, $1, $2, $3, 'parent', $4, $5, $6, $7, $8, 'open', now(), 0)
     RETURNING *`,
    [
      seq,
      params.circleId,
      params.userId,
      title,
      body || null,
      kind,
      params.homeVisibility ?? (params.guest ? "member" : "discoverable"),
      Boolean(params.serviceRepliesAllowed),
    ]
  );
  const thread = rows[0];
  const rootSeq = await nextCircleSeq(client, params.circleId);
  const rootBody = body || title || "Thread";
  const root = await client.query(
    `INSERT INTO circle_messages (
       seq, circle_id, thread_id, author_id, author_role, body,
       client_message_id, status, author_was_guest
     )
     VALUES ($1, $2, NULL, $3, 'parent', $4, $5, 'visible', $6)
     RETURNING id, seq`,
    [
      rootSeq,
      params.circleId,
      params.userId,
      rootBody,
      randomUUID(),
      Boolean(params.guest),
    ]
  );
  await client.query(
    `UPDATE circle_threads
     SET root_message_id = $2, last_activity_seq = $3, updated_at = now()
     WHERE id = $1`,
    [thread.id, root.rows[0].id, rootSeq]
  );
  thread.root_message_id = root.rows[0].id;
  await followThread(client, String(thread.id), params.userId, {
    lastReadSeq: Number(root.rows[0].seq),
  });
  if (params.guest) {
    await client.query(
      `INSERT INTO circle_thread_access_grants (
         thread_id, user_id, grant_role, granted_by, can_reply
       )
       VALUES ($1, $2, 'guest_author', $2, true)
       ON CONFLICT DO NOTHING`,
      [thread.id, params.userId]
    );
  }
  await insertChatOutbox(client, "thread.created", "thread", String(thread.id), {
    circleId: params.circleId,
    threadId: thread.id,
    seq,
  });
  return { thread };
}

export async function createCircleMessage(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  threadId?: string | null;
  body: string;
  clientMessageId: string;
  replyToMessageId?: string | null;
  authorRole?: "parent" | "provider";
  attachments?: ChatAttachmentInput[];
}): Promise<
  { message: ChatMessageView } | { error: string; status: number }
> {
  const client = params.client;
  const authorRole = params.authorRole ?? "parent";
  const body = params.body.trim();
  const attachments = params.attachments ?? [];
  // A message needs text or at least one attachment, not necessarily both.
  if (!body && attachments.length === 0) {
    return { error: "Message is required", status: 400 };
  }
  if (body.length > 4000) return { error: "Message is too long", status: 400 };
  if (body) {
    const blocked = guardText(body);
    if (blocked) return { error: blocked.error, status: 400 };
  }

  const existing = await client.query(
    `SELECT * FROM circle_messages WHERE author_id = $1 AND client_message_id = $2`,
    [params.userId, params.clientMessageId]
  );
  if (existing.rows[0]) {
    const prior = existing.rows[0];
    if (String(prior.circle_id) !== params.circleId) {
      return { error: "clientMessageId already used in another group", status: 400 };
    }
    const priorThread = prior.thread_id ? String(prior.thread_id) : null;
    if ((params.threadId ?? null) !== priorThread) {
      return { error: "clientMessageId already used in another thread", status: 400 };
    }
    const author = await authorView(
      client,
      params.userId,
      prior.author_role,
      prior.author_was_guest === true
    );
    // Replay: return the attachments already stored. Never insert them again.
    const replay = mapMessageRow(prior, author);
    await attachAttachments(client, [replay]);
    return { message: replay };
  }

  const posting = await assertCanPost(client, params.userId);
  if (posting) return posting;

  const verified = await verifyChatAttachments({
    userId: params.userId,
    attachments,
  });
  if (verified.ok === false) {
    return { error: verified.error, status: verified.status };
  }

  if (params.threadId) {
    const access = await loadThreadAccess(client, params.threadId, params.userId);
    if (!access || !access.canRead) {
      return { error: "Thread not found", status: 404 };
    }
    if (access.circleId !== params.circleId) {
      return { error: "Thread is not in this group", status: 400 };
    }
    if (!access.canReply) {
      return { error: "You cannot reply in this thread", status: 403 };
    }
      if (authorRole === "provider") {
        if (
          access.grantRole !== "provider_responder" &&
          !access.isMember
        ) {
          return { error: "Provider replies need a thread grant", status: 403 };
        }
        const prior = await client.query(
          `SELECT 1 FROM circle_messages
           WHERE thread_id = $1 AND author_id = $2 AND author_role = 'provider'
           LIMIT 1`,
          [params.threadId, params.userId]
        );
        if (prior.rows.length === 0) {
          if (!(await incrementDailyQuota(client, params.userId, "provider_reply", 20))) {
            return { error: "Provider reply daily limit reached", status: 429 };
          }
        } else {
          const parentFollowUp = await client.query(
            `SELECT 1 FROM circle_messages
             WHERE thread_id = $1 AND author_role = 'parent' AND status = 'visible'
               AND created_at > (
                 SELECT MAX(created_at) FROM circle_messages
                 WHERE thread_id = $1 AND author_id = $2 AND author_role = 'provider'
               )
             LIMIT 1`,
            [params.threadId, params.userId]
          );
          const dm = await client.query(
            `SELECT 1 FROM conversations
             WHERE (
               (user_a_id = LEAST($1::uuid, $3::uuid) AND user_b_id = GREATEST($1::uuid, $3::uuid))
             )
             LIMIT 1`,
            [params.userId, params.threadId, access.authorId]
          );
          if (parentFollowUp.rows.length === 0 && dm.rows.length === 0) {
            return {
              error: "Wait for the parent to reply, or continue in a tutor DM",
              status: 403,
            };
          }
        }
      }
  } else {
    const member = await isCircleMember(client, params.circleId, params.userId);
    if (!member) return { error: "Not a member of this group", status: 403 };
    if (authorRole !== "parent") {
      return { error: "Providers cannot post in parent group chat", status: 403 };
    }
  }

  let parentMessageId: string | null = null;
  if (params.threadId) {
    const root = await client.query(
      `SELECT root_message_id FROM circle_threads WHERE id = $1`,
      [params.threadId]
    );
    parentMessageId = root.rows[0]?.root_message_id
      ? String(root.rows[0].root_message_id)
      : null;
  }

  if (params.replyToMessageId) {
    const parent = await client.query(
      `SELECT id, circle_id, thread_id FROM circle_messages WHERE id = $1`,
      [params.replyToMessageId]
    );
    if (parent.rows.length === 0) {
      return { error: "Reply target not found", status: 400 };
    }
    if (String(parent.rows[0].circle_id) !== params.circleId) {
      return { error: "Reply must stay in the same group", status: 400 };
    }
    const parentThread = parent.rows[0].thread_id
      ? String(parent.rows[0].thread_id)
      : null;
    if ((params.threadId ?? null) !== parentThread) {
      return { error: "Reply must stay in the same thread", status: 400 };
    }
  }

  const seq = await nextCircleSeq(client, params.circleId);
  const isGuestAuthor = params.threadId
    ? !(await isCircleMember(client, params.circleId, params.userId))
    : false;
  const inserted = await client.query(
    `INSERT INTO circle_messages (
       seq, circle_id, thread_id, author_id, author_role, body,
       reply_to_message_id, parent_message_id, client_message_id, status,
       author_was_guest
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'visible', $10)
     RETURNING *`,
    [
      seq,
      params.circleId,
      params.threadId ?? null,
      params.userId,
      authorRole,
      // Attachment-only messages store NULL, not "", so preview fallbacks and
      // `COALESCE` checks behave consistently.
      body || null,
      params.replyToMessageId ?? null,
      parentMessageId,
      params.clientMessageId,
      isGuestAuthor,
    ]
  );
  const row = inserted.rows[0];
  if (verified.items.length > 0) {
    await insertChatAttachments(client, String(row.id), verified.items);
  }
  const handles = [...body.matchAll(/@([A-Za-z0-9_]{3,32})/g)].map((m) =>
    m[1].toLowerCase()
  );
  if (handles.length > 0) {
    const mentioned = await client.query(
      `SELECT id FROM users WHERE lower(anonymous_handle) = ANY($1::text[])`,
      [handles]
    );
    for (const person of mentioned.rows) {
      if (String(person.id) === params.userId) continue;
      if (await isBlocked(client, params.userId, String(person.id))) continue;
      await client.query(
        `INSERT INTO circle_message_mentions (message_id, mentioned_user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.id, person.id]
      );
    }
  }
  if (params.threadId) {
    await followThread(client, params.threadId, params.userId, {
      lastReadSeq: seq,
    });
  }
  await insertChatOutbox(client, "message.created", "message", String(row.id), {
    circleId: params.circleId,
    threadId: params.threadId ?? null,
    rootMessageId: parentMessageId,
    messageId: row.id,
    seq,
    authorId: params.userId,
  });
  const author = await authorView(client, params.userId, authorRole, isGuestAuthor);
  const message = mapMessageRow(row, author);
  await attachAttachments(client, [message]);
  return { message };
}

export async function ensureThreadForMessage(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  messageId: string;
}): Promise<{ threadId: string; created: boolean } | { error: string; status: number }> {
  const member = await isCircleMember(
    params.client,
    params.circleId,
    params.userId
  );
  if (!member) return { error: "Not a member of this group", status: 403 };

  const message = await params.client.query(
    `SELECT id, seq, circle_id, thread_id, parent_message_id, author_id, author_role, body, status
     FROM circle_messages
     WHERE id = $1 AND circle_id = $2`,
    [params.messageId, params.circleId]
  );
  const row = message.rows[0];
  if (!row) return { error: "Message not found", status: 404 };
  if (row.status !== "visible") {
    return { error: "Cannot start a thread on this message", status: 400 };
  }
  if (row.thread_id || row.parent_message_id) {
    return { error: "Reply in the existing thread instead", status: 400 };
  }
  if (await isBlocked(params.client, params.userId, String(row.author_id))) {
    return { error: "Message not found", status: 404 };
  }

  const existing = await params.client.query(
    `SELECT id FROM circle_threads
     WHERE root_message_id = $1 AND status <> 'deleted'
     LIMIT 1`,
    [params.messageId]
  );
  if (existing.rows[0]) {
    await followThread(params.client, String(existing.rows[0].id), params.userId);
    return { threadId: String(existing.rows[0].id), created: false };
  }

  const isParent = await userHasRole(params.client, params.userId, "parent");
  if (!isParent) return { error: "Parent role required", status: 403 };

  const seq = await nextCircleSeq(params.client, params.circleId);
  try {
    const inserted = await params.client.query(
      `INSERT INTO circle_threads (
         created_seq, last_activity_seq, circle_id, author_id, author_role,
         title, body, kind, home_visibility, status, last_message_at, reply_count,
         root_message_id
       )
       VALUES ($1, $1, $2, $3, $4, NULL, $5, 'general', 'member', 'open', now(), 0, $6)
       RETURNING id`,
      [
        seq,
        params.circleId,
        row.author_id,
        row.author_role,
        row.body,
        params.messageId,
      ]
    );
    const threadId = String(inserted.rows[0].id);
    await followThread(params.client, threadId, String(row.author_id), {
      lastReadSeq: Number(row.seq ?? seq),
    });
    if (params.userId !== String(row.author_id)) {
      await followThread(params.client, threadId, params.userId, {
        lastReadSeq: Number(row.seq ?? seq),
      });
    }
    await insertChatOutbox(params.client, "thread.created", "thread", threadId, {
      circleId: params.circleId,
      threadId,
      seq,
      rootMessageId: params.messageId,
    });
    return { threadId, created: true };
  } catch (error) {
    const raced = await params.client.query(
      `SELECT id FROM circle_threads
       WHERE root_message_id = $1 AND status <> 'deleted'
       LIMIT 1`,
      [params.messageId]
    );
    if (raced.rows[0]) {
      await followThread(params.client, String(raced.rows[0].id), params.userId, {
        lastReadSeq: Number(row.seq ?? seq),
      });
      return { threadId: String(raced.rows[0].id), created: false };
    }
    throw error;
  }
}

export async function listLinearMessages(params: {
  client: PoolClient;
  userId: string;
  circleId: string;
  beforeSeq?: number;
  afterSeq?: number;
  limit: number;
}): Promise<
  | { messages: ChatMessageView[]; nextCursor: number | null }
  | { error: string; status: number }
> {
  const member = await isCircleMember(
    params.client,
    params.circleId,
    params.userId
  );
  if (!member) return { error: "Not a member of this group", status: 403 };

  const filters = [`m.circle_id = $1`, `m.thread_id IS NULL`];
  const values: unknown[] = [params.circleId, params.userId];
  // school_class/school: history from current join only.
  // Wide groups: still-open thread roots remain visible (migrated topics
  // are channel roots now; hiding them by joined_at made groups look empty).
  filters.push(`(
    m.created_at >= COALESCE((
      SELECT MAX(joined_at) FROM circle_membership_periods
      WHERE circle_id = $1 AND user_id = $2 AND left_at IS NULL
    ), m.created_at)
    OR (
      EXISTS (
        SELECT 1 FROM circles c
        WHERE c.id = $1
          AND c.circle_type IN ('class', 'locality', 'curriculum', 'community')
      )
      AND EXISTS (
        SELECT 1 FROM circle_threads t
        WHERE t.root_message_id = m.id
          AND t.status = 'open'
      )
    )
  )`);
  if (params.beforeSeq != null) {
    values.push(params.beforeSeq);
    filters.push(`m.seq < $${values.length}`);
  }
  if (params.afterSeq != null) {
    values.push(params.afterSeq);
    filters.push(`m.seq > $${values.length}`);
  }
  values.push(params.limit);
  const { rows } = await params.client.query(
    `SELECT m.*,
            t.id AS side_thread_id,
            COALESCE(t.reply_count, 0) AS reply_count,
            (
              SELECT LEFT(r.body, 80)
              FROM circle_messages r
              WHERE r.thread_id = t.id AND r.status = 'visible'
              ORDER BY r.seq DESC
              LIMIT 1
            ) AS last_reply_preview,
            (
              SELECT r.id
              FROM circle_messages r
              WHERE r.thread_id = t.id AND r.status = 'visible'
              ORDER BY r.seq DESC
              LIMIT 1
            ) AS last_reply_id,
            EXISTS (
              SELECT 1
              FROM circle_thread_access_grants g
              WHERE g.thread_id = t.id
                AND g.user_id = m.author_id
                AND g.grant_role = 'guest_author'
            ) OR m.author_was_guest = true AS is_guest_author
     FROM circle_messages m
     LEFT JOIN circle_threads t
       ON t.root_message_id = m.id AND t.status <> 'deleted'
     WHERE ${filters.join(" AND ")}
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = $2 AND ub.blocked_id = m.author_id)
            OR (ub.blocker_id = m.author_id AND ub.blocked_id = $2)
       )
     ORDER BY m.seq ${params.afterSeq != null ? "ASC" : "DESC"}
     LIMIT $${values.length}`,
    values
  );
  const ordered = params.afterSeq != null ? rows : [...rows].reverse();
  const messages: ChatMessageView[] = [];
  for (const row of ordered) {
    const author = await authorView(
      params.client,
      String(row.author_id),
      row.author_role,
      row.is_guest_author === true
    );
    messages.push(mapMessageRow(row, author));
  }
  await attachReactions(params.client, messages, params.userId);
  await attachAttachments(params.client, messages);

  // A last reply that was attachment-only has no body, which would render as a
  // blank "N replies" preview.
  const emptyReplyIds = ordered
    .filter((row) => row.last_reply_id && !String(row.last_reply_preview ?? "").trim())
    .map((row) => String(row.last_reply_id));
  if (emptyReplyIds.length > 0) {
    const labels = await loadAttachmentPreviewLabels(params.client, [
      ...new Set(emptyReplyIds),
    ]);
    for (const [index, row] of ordered.entries()) {
      if (!row.last_reply_id) continue;
      if (String(row.last_reply_preview ?? "").trim()) continue;
      messages[index].lastReplyPreview =
        labels.get(String(row.last_reply_id)) ?? null;
    }
  }

  const nextCursor =
    !params.afterSeq && rows.length === params.limit
      ? Number(rows[rows.length - 1].seq)
      : null;
  return { messages, nextCursor };
}

export async function listThreadMessages(params: {
  client: PoolClient;
  userId: string;
  threadId: string;
  beforeSeq?: number;
  afterSeq?: number;
  limit: number;
}): Promise<
  | { messages: ChatMessageView[]; nextCursor: number | null }
  | { error: string; status: number }
> {
  const access = await loadThreadAccess(
    params.client,
    params.threadId,
    params.userId
  );
  if (!access || !access.canRead) {
    return { error: "Thread not found", status: 404 };
  }
  const filters = [`m.thread_id = $1`];
  const values: unknown[] = [params.threadId, params.userId];
  if (params.beforeSeq != null) {
    values.push(params.beforeSeq);
    filters.push(`m.seq < $${values.length}`);
  }
  if (params.afterSeq != null) {
    values.push(params.afterSeq);
    filters.push(`m.seq > $${values.length}`);
  }
  values.push(params.limit);
  const { rows } = await params.client.query(
    `SELECT m.*
     FROM circle_messages m
     WHERE ${filters.join(" AND ")}
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = $2 AND ub.blocked_id = m.author_id)
            OR (ub.blocker_id = m.author_id AND ub.blocked_id = $2)
       )
     ORDER BY m.seq ${params.afterSeq != null ? "ASC" : "DESC"}
     LIMIT $${values.length}`,
    values
  );
  const ordered = params.afterSeq != null ? rows : [...rows].reverse();
  const messages: ChatMessageView[] = [];
  for (const row of ordered) {
    const author = await authorView(
      params.client,
      String(row.author_id),
      row.author_role,
      row.author_was_guest === true
    );
    messages.push(mapMessageRow(row, author));
  }
  await attachReactions(params.client, messages, params.userId);
  await attachAttachments(params.client, messages);
  const nextCursor =
    !params.afterSeq && rows.length === params.limit
      ? Number(rows[rows.length - 1].seq)
      : null;
  return { messages, nextCursor };
}

export async function listInbox(client: PoolClient, userId: string) {
  const groups = await client.query(
    `SELECT
       c.id, c.display_name, c.circle_type, c.key,
       CASE
         WHEN linear.last_at IS NULL THEN thread.last_at
         WHEN thread.last_at IS NULL THEN linear.last_at
         WHEN thread.last_at > linear.last_at THEN thread.last_at
         ELSE linear.last_at
       END AS last_at,
       CASE
         WHEN linear.last_at IS NULL THEN thread.preview
         WHEN thread.last_at IS NULL THEN linear.preview
         WHEN thread.last_at > linear.last_at THEN thread.preview
         ELSE linear.preview
       END AS preview,
       CASE
         WHEN linear.last_at IS NULL THEN thread.preview_message_id
         WHEN thread.last_at IS NULL THEN linear.preview_message_id
         WHEN thread.last_at > linear.last_at THEN thread.preview_message_id
         ELSE linear.preview_message_id
       END AS preview_message_id,
       (
         COALESCE(channel_unread.unread_count, 0)
         + COALESCE(thread_unread.unread_count, 0)
       )::int AS unread_count
     FROM circle_members cm
     JOIN circles c ON c.id = cm.circle_id
     LEFT JOIN LATERAL (
       SELECT m.created_at AS last_at, m.body AS preview, m.id AS preview_message_id
       FROM circle_messages m
       WHERE m.circle_id = c.id AND m.thread_id IS NULL AND m.status = 'visible'
       ORDER BY m.seq DESC
       LIMIT 1
     ) linear ON true
     LEFT JOIN LATERAL (
       SELECT t.last_message_at AS last_at,
              CASE
                WHEN root.status = 'moderated' THEN $2
                ELSE COALESCE(t.title, t.body)
              END AS preview,
              t.root_message_id AS preview_message_id
       FROM circle_threads t
       LEFT JOIN circle_messages root ON root.id = t.root_message_id
       WHERE t.circle_id = c.id AND t.status = 'open'
       ORDER BY t.last_activity_seq DESC
       LIMIT 1
     ) thread ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM circle_messages m
       LEFT JOIN circle_chat_reads r
         ON r.circle_id = c.id AND r.user_id = $1
       WHERE m.circle_id = c.id
         AND m.thread_id IS NULL
         AND m.status = 'visible'
         AND m.author_id <> $1
         AND (r.last_read_message_seq IS NULL OR m.seq > r.last_read_message_seq)
         AND (
           m.created_at >= COALESCE((
             SELECT MAX(joined_at) FROM circle_membership_periods
             WHERE circle_id = c.id AND user_id = $1 AND left_at IS NULL
           ), m.created_at)
           OR (
             c.circle_type IN ('class', 'locality', 'curriculum', 'community')
             AND EXISTS (
               SELECT 1 FROM circle_threads t
               WHERE t.root_message_id = m.id
                 AND t.status = 'open'
             )
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks ub
           WHERE (ub.blocker_id = $1 AND ub.blocked_id = m.author_id)
              OR (ub.blocker_id = m.author_id AND ub.blocked_id = $1)
         )
     ) channel_unread ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM circle_messages m
       JOIN circle_threads t
         ON t.id = m.thread_id AND t.circle_id = c.id AND t.status = 'open'
       LEFT JOIN circle_thread_reads tr
         ON tr.thread_id = t.id AND tr.user_id = $1
       WHERE m.circle_id = c.id
         AND m.thread_id IS NOT NULL
         AND m.status = 'visible'
         AND m.author_id <> $1
         AND (tr.last_read_seq IS NULL OR m.seq > tr.last_read_seq)
         AND (
           m.created_at >= COALESCE((
             SELECT MAX(joined_at) FROM circle_membership_periods
             WHERE circle_id = c.id AND user_id = $1 AND left_at IS NULL
           ), m.created_at)
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks ub
           WHERE (ub.blocker_id = $1 AND ub.blocked_id = m.author_id)
              OR (ub.blocker_id = m.author_id AND ub.blocked_id = $1)
         )
     ) thread_unread ON true
     WHERE cm.user_id = $1
     ORDER BY last_at DESC NULLS LAST, c.display_name`,
    [userId, MODERATED_MESSAGE_COPY]
  );

  const dms = await client.query(
    `SELECT conv.id, conv.context_key, conv.last_message_at,
            peer.id AS peer_id, peer.anonymous_handle, peer.avatar_key,
            cp.presentation_role AS my_role,
            peer_p.presentation_role AS peer_role,
            lm.body AS last_body,
            (
              SELECT COUNT(*) FROM direct_messages dm
              WHERE dm.conversation_id = conv.id
                AND dm.sender_id <> $1
                AND (cp.last_read_at IS NULL OR dm.created_at > cp.last_read_at)
            )::int AS unread_count
     FROM conversation_participants cp
     JOIN conversations conv ON conv.id = cp.conversation_id
     JOIN conversation_participants peer_p
       ON peer_p.conversation_id = conv.id AND peer_p.user_id <> $1
     JOIN users peer ON peer.id = peer_p.user_id
     LEFT JOIN LATERAL (
       SELECT body FROM direct_messages
       WHERE conversation_id = conv.id
       ORDER BY created_at DESC LIMIT 1
     ) lm ON true
     WHERE cp.user_id = $1 AND cp.hidden = false
     ORDER BY conv.last_message_at DESC NULLS LAST`,
    [userId]
  );

  const services = await client.query(
    `SELECT
       p.user_id AS provider_id,
       p.org_name,
       ch.status,
       u.preview,
       u.published_at,
       f.last_read_at
     FROM provider_channel_follows f
     JOIN provider_channels ch ON ch.provider_id = f.provider_id
     JOIN providers p ON p.user_id = ch.provider_id
     LEFT JOIN LATERAL (
       SELECT title AS preview, published_at
       FROM provider_channel_updates
       WHERE provider_id = ch.provider_id AND status = 'published'
       ORDER BY published_at DESC NULLS LAST
       LIMIT 1
     ) u ON true
     WHERE f.user_id = $1 AND ch.status = 'active'
     ORDER BY u.published_at DESC NULLS LAST`,
    [userId]
  );

  // Guest school questions: thread-only access, not membership in the school group.
  const guestThreads = await client.query(
    `SELECT
       t.id,
       t.title,
       t.body,
       t.last_message_at,
       t.reply_count,
       t.root_message_id,
       root.status AS root_status,
       c.id AS circle_id,
       c.display_name AS circle_name,
       COALESCE(tr.last_read_seq, 0) AS last_read_seq,
       t.last_activity_seq
     FROM circle_thread_access_grants g
     JOIN circle_threads t ON t.id = g.thread_id
     JOIN circles c ON c.id = t.circle_id
     LEFT JOIN circle_messages root ON root.id = t.root_message_id
     LEFT JOIN circle_thread_reads tr
       ON tr.thread_id = t.id AND tr.user_id = $1
     WHERE g.user_id = $1
       AND g.grant_role = 'guest_author'
       AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > now())
       AND t.status = 'open'
       AND NOT EXISTS (
         SELECT 1 FROM circle_members cm
         WHERE cm.circle_id = t.circle_id AND cm.user_id = $1
       )
     ORDER BY t.last_message_at DESC NULLS LAST
     LIMIT 50`,
    [userId]
  );

  // Attachment-only messages have no body, so fall back to a label like
  // "Photo" or the document name rather than showing an empty row.
  const previewFallbackIds = [
    ...groups.rows
      .filter((row) => row.preview_message_id && !String(row.preview ?? "").trim())
      .map((row) => String(row.preview_message_id)),
    ...guestThreads.rows
      .filter(
        (row) =>
          row.root_status !== "moderated" &&
          row.root_message_id &&
          !previewText(row.body, row.title)
      )
      .map((row) => String(row.root_message_id)),
  ];
  const previewLabels = await loadAttachmentPreviewLabels(client, [
    ...new Set(previewFallbackIds),
  ]);

  return {
    groups: groups.rows.map((row) => ({
      kind: "group" as const,
      id: row.id,
      name: row.display_name,
      circleType: row.circle_type,
      preview:
        String(row.preview ?? "").trim() ||
        (row.preview_message_id
          ? previewLabels.get(String(row.preview_message_id)) ?? null
          : null),
      lastAt: row.last_at,
      unreadCount: Number(row.unread_count ?? 0),
    })),
    guestThreads: guestThreads.rows.map((row) => {
      const preview = parentThreadPreview(row.root_status, row.body, row.title);
      return {
        kind: "guest_thread" as const,
        id: row.id,
        circleId: row.circle_id,
        circleName: row.circle_name,
        title: preview.title,
        preview:
          preview.preview ||
          (row.root_message_id
            ? previewLabels.get(String(row.root_message_id)) ?? ""
            : ""),
        lastAt: row.last_message_at,
        replyCount: Number(row.reply_count ?? 0),
        unreadCount:
          Number(row.last_activity_seq) > Number(row.last_read_seq ?? 0) ? 1 : 0,
      };
    }),
    dms: dms.rows.map((row) => ({
      kind: "dm" as const,
      id: row.id,
      contextKey: row.context_key,
      myRole: row.my_role,
      peerRole: row.peer_role,
      peer: {
        userId: row.peer_id,
        anonymousHandle: row.anonymous_handle,
        avatarKey: row.avatar_key,
      },
      preview: row.last_body,
      lastAt: row.last_message_at,
      unreadCount: Number(row.unread_count ?? 0),
    })),
    services: services.rows.map((row) => ({
      kind: "service" as const,
      id: row.provider_id,
      name: row.org_name,
      preview: row.preview,
      lastAt: row.published_at,
      unreadCount: 0,
    })),
  };
}

export async function listHome(
  client: PoolClient,
  userId: string,
  options?: { cursor?: string | null; limit?: number }
) {
  const loc = await client.query(
    `SELECT pin_code FROM user_locations WHERE user_id = $1`,
    [userId]
  );
  const pin = loc.rows[0]?.pin_code ?? null;

  const memberThreads = await client.query(
    `SELECT
       t.*, c.display_name, c.circle_type, c.key,
       COALESCE(tr.following, false) AS following,
       tr.last_read_seq,
       hi.first_seen_at,
       root.status AS root_status
     FROM circle_members cm
     JOIN circle_threads t ON t.circle_id = cm.circle_id
     JOIN circles c ON c.id = t.circle_id
     LEFT JOIN circle_thread_reads tr
       ON tr.thread_id = t.id AND tr.user_id = $1
     LEFT JOIN home_thread_impressions hi
       ON hi.thread_id = t.id AND hi.user_id = $1
     LEFT JOIN circle_messages root ON root.id = t.root_message_id
     WHERE cm.user_id = $1
       AND t.status = 'open'
       AND t.home_visibility <> 'hidden'
       AND (
         t.reply_count > 0
         OR NULLIF(btrim(COALESCE(t.title, '')), '') IS NOT NULL
         OR NULLIF(btrim(COALESCE(t.body, '')), '') IS NOT NULL
         OR EXISTS (
           SELECT 1 FROM circle_message_media mm
           WHERE mm.message_id = t.root_message_id AND mm.scan_status = 'clean'
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = $1 AND ub.blocked_id = t.author_id)
            OR (ub.blocker_id = t.author_id AND ub.blocked_id = $1)
       )
     ORDER BY t.last_message_at DESC
     LIMIT 80`,
    [userId]
  );

  const discovery = await client.query(
    `SELECT
       t.*, c.display_name, c.circle_type, c.key,
       false AS following,
       NULL::bigint AS last_read_seq,
       hi.first_seen_at,
       root.status AS root_status
     FROM circle_threads t
     JOIN circles c ON c.id = t.circle_id
     LEFT JOIN home_thread_impressions hi
       ON hi.thread_id = t.id AND hi.user_id = $1
     LEFT JOIN circle_messages root ON root.id = t.root_message_id
     WHERE t.status = 'open'
       AND t.home_visibility = 'discoverable'
       AND (
         t.reply_count > 0
         OR NULLIF(btrim(COALESCE(t.title, '')), '') IS NOT NULL
         OR NULLIF(btrim(COALESCE(t.body, '')), '') IS NOT NULL
         OR EXISTS (
           SELECT 1 FROM circle_message_media mm
           WHERE mm.message_id = t.root_message_id AND mm.scan_status = 'clean'
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM circle_members cm
         WHERE cm.circle_id = t.circle_id AND cm.user_id = $1
       )
       AND (hi.dismissed_at IS NULL)
       AND ${DISCOVERY_MATCH_SQL}
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = $1 AND ub.blocked_id = t.author_id)
            OR (ub.blocker_id = t.author_id AND ub.blocked_id = $1)
       )
     ORDER BY t.last_message_at DESC
     LIMIT 40`,
    [userId]
  );

  const updates = await client.query(
    `SELECT u.id, u.title, u.preview, u.published_at, p.user_id AS provider_id, p.org_name
     FROM provider_channel_updates u
     JOIN provider_channels ch ON ch.provider_id = u.provider_id
     JOIN providers p ON p.user_id = u.provider_id
     WHERE u.status = 'published'
       AND (u.expires_at IS NULL OR u.expires_at > now())
       AND ch.status = 'active'
       AND ($1::text IS NULL OR $1 = ANY (p.service_pin_codes))
     ORDER BY u.published_at DESC
     LIMIT 10`,
    [pin]
  );

  // Roots that are attachment-only have no text to preview on Home.
  const homePreviewLabels = await loadAttachmentPreviewLabels(client, [
    ...new Set(
      [...memberThreads.rows, ...discovery.rows]
        .filter(
          (row) =>
            row.root_status !== "moderated" &&
            row.root_message_id &&
            !previewText(row.body, row.title)
        )
        .map((row) => String(row.root_message_id))
    ),
  ]);
  const homePreview = (row: Record<string, unknown>) => {
    const preview = parentThreadPreview(
      row.root_status,
      (row.body as string | null) ?? null,
      (row.title as string | null) ?? null
    );
    return {
      title: preview.title,
      body:
        preview.preview ||
        (row.root_message_id
          ? homePreviewLabels.get(String(row.root_message_id)) ?? ""
          : ""),
    };
  };

  type Row = {
    kind: "thread" | "service";
    bucket: number;
    lastAt: string;
    id: string;
    payload: Record<string, unknown>;
  };

  const circleRank: Record<string, number> = {
    school_class: 6,
    class: 5,
    school: 4,
    community: 3,
    locality: 2,
    curriculum: 1,
  };

  const rows: Row[] = [];
  for (const row of memberThreads.rows) {
    const following = row.following === true || String(row.author_id) === userId;
    const unseen = !row.first_seen_at;
    const hasNew =
      following &&
      Number(row.last_activity_seq) > Number(row.last_read_seq ?? 0);
    let bucket = 3;
    if (hasNew) bucket = 1;
    else if (unseen) bucket = 2;
    rows.push({
      kind: "thread",
      bucket,
      lastAt: new Date(row.last_message_at).toISOString(),
      id: row.id,
      payload: {
        kind: "thread",
        access: "member",
        id: row.id,
        circleId: row.circle_id,
        circleName: row.display_name,
        circleType: row.circle_type,
        title: homePreview(row).title,
        body: homePreview(row).body,
        lastMessageAt: row.last_message_at,
        replyCount: row.reply_count,
        following,
        relevance: circleRank[row.circle_type] ?? 0,
      },
    });
  }

  for (const row of discovery.rows) {
    const unseen = !row.first_seen_at;
    rows.push({
      kind: "thread",
      bucket: unseen ? 4 : 6,
      lastAt: new Date(row.last_message_at).toISOString(),
      id: row.id,
      payload: {
        kind: "thread",
        access: "discovery",
        id: row.id,
        circleId: row.circle_id,
        circleName: row.display_name,
        circleType: row.circle_type,
        title: homePreview(row).title,
        body: homePreview(row).body,
        lastMessageAt: row.last_message_at,
        replyCount: row.reply_count,
        following: false,
        relevance: circleRank[row.circle_type] ?? 0,
      },
    });
  }

  rows.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    return b.lastAt.localeCompare(a.lastAt);
  });

  const organic: Row[] = [];
  let organicCount = 0;
  let serviceIndex = 0;
  for (const row of rows) {
    organic.push(row);
    organicCount += 1;
    if (organicCount % 8 === 0 && serviceIndex < updates.rows.length) {
      const update = updates.rows[serviceIndex];
      serviceIndex += 1;
      organic.push({
        kind: "service",
        bucket: 5,
        lastAt: new Date(update.published_at).toISOString(),
        id: update.id,
        payload: {
          kind: "service",
          id: update.id,
          providerId: update.provider_id,
          name: update.org_name,
          title: update.title,
          preview: update.preview,
          lastMessageAt: update.published_at,
        },
      });
    }
  }

  if (organic.filter((r) => r.kind === "thread").length === 0) {
    organic.splice(0, organic.length, ...organic.filter((r) => r.kind !== "service"));
  }

  const raw = options?.limit ?? 20;
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 20, 1), 40);
  const cursor = parseChatHomeCursor(options?.cursor);
  const page = cursor
    ? organic.filter((row) =>
        isAfterChatHomeCursor(
          { bucket: row.bucket, lastAt: row.lastAt, id: row.id },
          cursor
        )
      )
    : organic;
  const sliced = page.slice(0, limit);
  const last = sliced[sliced.length - 1];
  return {
    items: sliced.map((r) => r.payload),
    nextCursor:
      sliced.length === limit && last
        ? encodeChatHomeCursor({
            bucket: last.bucket,
            lastAt: last.lastAt,
            id: last.id,
          })
        : null,
  };
}

export async function publishChatNudge(payload: {
  circleId: string;
  threadId?: string | null;
  rootMessageId?: string | null;
  messageId?: string;
  seq?: number;
  replyCount?: number;
  authorId?: string;
}) {
  const event: Extract<RealtimeEvent, { type: "chat.message" }> = {
    type: "chat.message",
    circleId: payload.circleId,
    threadId: payload.threadId ?? undefined,
    rootMessageId: payload.rootMessageId ?? undefined,
    messageId: payload.messageId,
    seq: payload.seq,
    replyCount: payload.replyCount,
  };
  await publishCircleEvent(payload.circleId, event);
  if (payload.threadId) {
    await publishThreadEvent(payload.threadId, event);
  }
  const client = await pool.connect();
  try {
    const recipients = await listCircleInboxRecipients(
      client,
      payload.circleId,
      payload.threadId
    );
    await Promise.all(
      recipients.map((userId) =>
        publishUserInboxEvent(userId, {
          type: "inbox.updated",
          userId,
          reason: "message",
        })
      )
    );
  } finally {
    client.release();
  }
}

export { isLinearCircleType };
