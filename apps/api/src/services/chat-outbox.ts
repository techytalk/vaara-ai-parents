import type { PoolClient } from "pg";
import { batchCreateNotifications } from "./notifications.js";
import { publishChatNudge } from "./chat.js";

export async function drainChatOutbox(client: PoolClient): Promise<number> {
  const pending = await client.query(
    `SELECT id, event_type, payload
     FROM chat_event_outbox
     WHERE processed_at IS NULL
     ORDER BY id
     LIMIT 100`
  );
  let processed = 0;
  for (const row of pending.rows) {
    try {
      const payload = row.payload as {
        circleId?: string;
        threadId?: string;
        rootMessageId?: string;
        messageId?: string;
        seq?: number;
        replyCount?: number;
        authorId?: string;
      };
      if (payload.circleId) {
        await publishChatNudge({
          circleId: payload.circleId,
          threadId: payload.threadId,
          rootMessageId: payload.rootMessageId,
          messageId: payload.messageId,
          seq: payload.seq,
          replyCount: payload.replyCount,
          authorId: payload.authorId,
        });
      }
      if (row.event_type === "message.created" && payload.threadId) {
        await notifyThreadReply(client, {
          threadId: payload.threadId,
          authorId: payload.authorId ?? "",
          messageId: payload.messageId ?? "",
        });
        await notifyMentions(client, payload.messageId ?? "", payload.authorId ?? "");
      }
      if (row.event_type === "message.created" && payload.circleId && !payload.threadId) {
        await notifyGroupMessage(client, {
          circleId: payload.circleId,
          authorId: payload.authorId ?? "",
          messageId: payload.messageId ?? "",
        });
      }
      await client.query(
        `UPDATE chat_event_outbox SET processed_at = now() WHERE id = $1`,
        [row.id]
      );
      processed += 1;
    } catch (error) {
      await client.query(
        `UPDATE chat_event_outbox
         SET attempts = attempts + 1, last_error = $2
         WHERE id = $1`,
        [row.id, (error as Error).message]
      );
    }
  }
  return processed;
}

async function notifyThreadReply(
  client: PoolClient,
  params: { threadId: string; authorId: string; messageId: string }
) {
  const thread = await client.query(
    `SELECT t.id, t.title, t.body, t.author_id, t.circle_id, c.display_name,
            (
              SELECT LEFT(m.body, 140)
              FROM circle_messages m
              WHERE m.id = $2 AND m.status = 'visible'
            ) AS reply_preview
     FROM circle_threads t
     JOIN circles c ON c.id = t.circle_id
     WHERE t.id = $1`,
    [params.threadId, params.messageId]
  );
  if (thread.rows.length === 0) return;
  const recipients = await client.query(
    `SELECT DISTINCT tr.user_id, u.push_token, u.notification_prefs
     FROM circle_thread_reads tr
     JOIN users u ON u.id = tr.user_id
     WHERE tr.thread_id = $1
       AND tr.following = true
       AND (tr.muted_until IS NULL OR tr.muted_until < now())
       AND tr.user_id <> $2
       AND (
         EXISTS (
           SELECT 1 FROM circle_members cm
           WHERE cm.circle_id = $3 AND cm.user_id = tr.user_id
         )
         OR EXISTS (
           SELECT 1 FROM circle_thread_access_grants g
           WHERE g.thread_id = $1
             AND g.user_id = tr.user_id
             AND g.revoked_at IS NULL
             AND (g.expires_at IS NULL OR g.expires_at > now())
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = tr.user_id AND ub.blocked_id = $2)
            OR (ub.blocker_id = $2 AND ub.blocked_id = tr.user_id)
       )`,
    [params.threadId, params.authorId, thread.rows[0].circle_id]
  );
  if (recipients.rows.length === 0) return;
  const preview = String(
    thread.rows[0].reply_preview ??
      thread.rows[0].title ??
      thread.rows[0].body ??
      ""
  ).slice(0, 140);
  await batchCreateNotifications(
    client,
    "thread_reply",
    recipients.rows.map((row) => ({
      userId: String(row.user_id),
      title: thread.rows[0].display_name,
      body: preview,
      pushToken: row.push_token,
      notificationPrefs: row.notification_prefs,
      data: {
        type: "thread_reply",
        threadId: params.threadId,
        circleId: thread.rows[0].circle_id,
        messageId: params.messageId,
      },
    }))
  );
}

async function notifyMentions(
  client: PoolClient,
  messageId: string,
  authorId: string
) {
  if (!messageId) return;
  const { rows } = await client.query(
    `SELECT m.mentioned_user_id, msg.circle_id, msg.thread_id, c.display_name
     FROM circle_message_mentions m
     JOIN circle_messages msg ON msg.id = m.message_id
     JOIN circles c ON c.id = msg.circle_id
     WHERE m.message_id = $1 AND m.mentioned_user_id <> $2
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = m.mentioned_user_id AND ub.blocked_id = $2)
            OR (ub.blocker_id = $2 AND ub.blocked_id = m.mentioned_user_id)
       )`,
    [messageId, authorId]
  );
  if (rows.length === 0) return;
  await batchCreateNotifications(
    client,
    "thread_mention",
    rows.map((row) => ({
      userId: String(row.mentioned_user_id),
      title: row.display_name,
      body: "You were mentioned in a group chat",
      data: {
        type: "thread_mention",
        messageId,
        circleId: row.circle_id,
        threadId: row.thread_id,
      },
    }))
  );
}

async function notifyGroupMessage(
  client: PoolClient,
  params: { circleId: string; authorId: string; messageId: string }
) {
  const circle = await client.query(
    `SELECT display_name FROM circles WHERE id = $1`,
    [params.circleId]
  );
  if (circle.rows.length === 0) return;
  const recipients = await client.query(
    `SELECT cm.user_id FROM circle_members cm
     WHERE cm.circle_id = $1 AND cm.user_id <> $2
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks ub
         WHERE (ub.blocker_id = cm.user_id AND ub.blocked_id = $2)
            OR (ub.blocker_id = $2 AND ub.blocked_id = cm.user_id)
       )`,
    [params.circleId, params.authorId]
  );
  if (recipients.rows.length === 0) return;
  await batchCreateNotifications(
    client,
    "group_message",
    recipients.rows.map((row) => ({
      userId: String(row.user_id),
      title: circle.rows[0].display_name,
      body: "New message in your class group",
      data: {
        type: "group_message",
        circleId: params.circleId,
        messageId: params.messageId,
      },
    }))
  );
}
