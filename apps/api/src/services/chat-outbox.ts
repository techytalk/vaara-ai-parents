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
        messageId?: string;
        seq?: number;
        authorId?: string;
      };
      if (payload.circleId) {
        await publishChatNudge({
          circleId: payload.circleId,
          threadId: payload.threadId,
          messageId: payload.messageId,
          seq: payload.seq,
          authorId: payload.authorId,
        });
      }
      if (row.event_type === "message.created" && payload.threadId) {
        await notifyThreadReply(client, {
          threadId: payload.threadId,
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
    `SELECT t.id, t.title, t.body, t.author_id, t.circle_id, c.display_name
     FROM circle_threads t
     JOIN circles c ON c.id = t.circle_id
     WHERE t.id = $1`,
    [params.threadId]
  );
  if (thread.rows.length === 0) return;
  const recipients = await client.query(
    `SELECT DISTINCT user_id FROM (
       SELECT author_id AS user_id FROM circle_threads WHERE id = $1
       UNION
       SELECT user_id FROM circle_thread_reads
       WHERE thread_id = $1 AND following = true
         AND (muted_until IS NULL OR muted_until < now())
     ) r
     WHERE user_id <> $2`,
    [params.threadId, params.authorId]
  );
  if (recipients.rows.length === 0) return;
  const preview = String(thread.rows[0].title ?? thread.rows[0].body ?? "").slice(
    0,
    140
  );
  await batchCreateNotifications(
    client,
    "thread_reply",
    recipients.rows.map((row) => ({
      userId: String(row.user_id),
      title: thread.rows[0].display_name,
      body: preview,
      data: {
        type: "thread_reply",
        threadId: params.threadId,
        circleId: thread.rows[0].circle_id,
        messageId: params.messageId,
      },
    }))
  );
}
