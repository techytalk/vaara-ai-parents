import type { PoolClient } from "pg";

export type ThreadGrantRole =
  | "guest_author"
  | "guest_replier"
  | "provider_responder";

export type ThreadAccess = {
  isMember: boolean;
  grantRole: ThreadGrantRole | null;
  canRead: boolean;
  canReply: boolean;
  canOpenGroup: boolean;
};

const LINEAR_TYPES = new Set(["school_class"]);

export function isLinearCircleType(circleType: string): boolean {
  return LINEAR_TYPES.has(circleType);
}

export async function isCircleMember(
  client: PoolClient,
  circleId: string,
  userId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2`,
    [circleId, userId]
  );
  return rows.length > 0;
}

export async function loadThreadAccess(
  client: PoolClient,
  threadId: string,
  userId: string
): Promise<(ThreadAccess & { circleId: string; status: string }) | null> {
  const thread = await client.query(
    `SELECT id, circle_id, status, author_id
     FROM circle_threads WHERE id = $1`,
    [threadId]
  );
  if (thread.rows.length === 0) return null;

  const circleId = String(thread.rows[0].circle_id);
  const status = String(thread.rows[0].status);
  const member = await isCircleMember(client, circleId, userId);
  const grant = await client.query(
    `SELECT grant_role, can_reply
     FROM circle_thread_access_grants
     WHERE thread_id = $1 AND user_id = $2
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [threadId, userId]
  );
  const grantRole = (grant.rows[0]?.grant_role ?? null) as ThreadGrantRole | null;
  const canReplyGrant = grant.rows[0]?.can_reply !== false;
  return {
    circleId,
    status,
    isMember: member,
    grantRole,
    canRead: member || grantRole != null,
    canReply:
      status === "open" &&
      (member || (grantRole != null && canReplyGrant)),
    canOpenGroup: member,
  };
}

export async function incrementDailyQuota(
  client: PoolClient,
  userId: string,
  quotaKey: string,
  limit: number
): Promise<boolean> {
  const { rows } = await client.query(
    `INSERT INTO chat_daily_quotas (user_id, quota_key, day, count)
     VALUES ($1, $2, CURRENT_DATE, 1)
     ON CONFLICT (user_id, quota_key, day)
     DO UPDATE SET count = chat_daily_quotas.count + 1
     RETURNING count`,
    [userId, quotaKey]
  );
  return Number(rows[0].count) <= limit;
}

export async function nextCircleSeq(
  client: PoolClient,
  circleId: string
): Promise<number> {
  const { rows } = await client.query(
    `UPDATE circles SET chat_seq = chat_seq + 1 WHERE id = $1 RETURNING chat_seq`,
    [circleId]
  );
  return Number(rows[0].chat_seq);
}

export async function insertChatOutbox(
  client: PoolClient,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await client.query(
    `INSERT INTO chat_event_outbox (event_type, aggregate_type, aggregate_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [eventType, aggregateType, aggregateId, JSON.stringify(payload)]
  );
}
