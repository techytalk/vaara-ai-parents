import type { PoolClient } from "pg";
import { isBlocked } from "../lib/author.js";

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
  canMessageAuthor: boolean;
  discovery: boolean;
};

const LINEAR_TYPES = new Set(["school_class"]);

export function isLinearCircleType(circleType: string): boolean {
  return LINEAR_TYPES.has(circleType);
}

/** Viewer $1 is eligible to see a discoverable thread `t` in circle `c`. */
export const DISCOVERY_MATCH_SQL = `
(
  EXISTS (
    SELECT 1 FROM user_locations v
    WHERE v.user_id = $1
      AND (
        c.metadata->>'pin_code' = v.pin_code
        OR EXISTS (
          SELECT 1 FROM user_locations a
          WHERE a.user_id = t.author_id AND a.pin_code = v.pin_code
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM children ch
    WHERE ch.user_id = $1
      AND ch.school_id IS NOT NULL
      AND (
        ch.school_id::text = c.metadata->>'school_id'
        OR EXISTS (
          SELECT 1 FROM children ah
          WHERE ah.user_id = t.author_id
            AND ah.school_id IS NOT NULL
            AND ah.school_id = ch.school_id
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM children ch
    WHERE ch.user_id = $1
      AND (
        (
          c.metadata->>'curriculum_id' IS NOT NULL
          AND ch.curriculum_id::text = c.metadata->>'curriculum_id'
        )
        OR EXISTS (
          SELECT 1 FROM children ah
          WHERE ah.user_id = t.author_id
            AND ah.curriculum_id = ch.curriculum_id
            AND ah.grade_id = ch.grade_id
        )
      )
  )
)
`;

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

export async function isCircleDiscoveryEligible(
  client: PoolClient,
  circleId: string,
  userId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1
     FROM circles c
     LEFT JOIN LATERAL (
       SELECT author_id FROM circle_threads t
       WHERE t.circle_id = c.id
       LIMIT 1
     ) dummy ON false
     WHERE c.id = $2
       AND (
         EXISTS (
           SELECT 1 FROM user_locations v
           WHERE v.user_id = $1
             AND (
               c.metadata->>'pin_code' = v.pin_code
               OR EXISTS (
                 SELECT 1 FROM user_locations a
                 WHERE a.pin_code = v.pin_code
                   AND a.user_id IN (
                     SELECT cm.user_id FROM circle_members cm WHERE cm.circle_id = c.id
                   )
               )
             )
         )
         OR EXISTS (
           SELECT 1 FROM children ch
           WHERE ch.user_id = $1
             AND ch.school_id IS NOT NULL
             AND ch.school_id::text = c.metadata->>'school_id'
         )
         OR EXISTS (
           SELECT 1 FROM children ch
           WHERE ch.user_id = $1
             AND c.metadata->>'curriculum_id' IS NOT NULL
             AND ch.curriculum_id::text = c.metadata->>'curriculum_id'
         )
       )`,
    [userId, circleId]
  );
  return rows.length > 0;
}

export async function loadThreadAccess(
  client: PoolClient,
  threadId: string,
  userId: string
): Promise<(ThreadAccess & { circleId: string; status: string; authorId: string }) | null> {
  const thread = await client.query(
    `SELECT t.id, t.circle_id, t.status, t.author_id, t.home_visibility, c.circle_type
     FROM circle_threads t
     JOIN circles c ON c.id = t.circle_id
     WHERE t.id = $1`,
    [threadId]
  );
  if (thread.rows.length === 0) return null;

  const circleId = String(thread.rows[0].circle_id);
  const status = String(thread.rows[0].status);
  const authorId = String(thread.rows[0].author_id);
  const homeVisibility = String(thread.rows[0].home_visibility);
  const blocked = await isBlocked(client, userId, authorId);

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

  let discovery = false;
  if (!member && grantRole == null && status === "open" && homeVisibility === "discoverable") {
    const eligible = await client.query(
      `SELECT 1
       FROM circle_threads t
       JOIN circles c ON c.id = t.circle_id
       WHERE t.id = $2 AND ${DISCOVERY_MATCH_SQL}`,
      [userId, threadId]
    );
    discovery = eligible.rows.length > 0;
  }

  const canRead =
    !blocked &&
    status !== "deleted" &&
    (member || grantRole != null || discovery || authorId === userId);

  const canReply =
    status === "open" &&
    !blocked &&
    (member || (grantRole != null && canReplyGrant));

  return {
    circleId,
    status,
    authorId,
    isMember: member,
    grantRole,
    canRead,
    canReply,
    canOpenGroup: member,
    canMessageAuthor: canRead && authorId !== userId && !blocked,
    discovery,
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

export async function listCircleInboxRecipients(
  client: PoolClient,
  circleId: string,
  threadId?: string | null
): Promise<string[]> {
  const members = await client.query(
    `SELECT user_id FROM circle_members WHERE circle_id = $1`,
    [circleId]
  );
  const ids = new Set(members.rows.map((row) => String(row.user_id)));
  if (threadId) {
    const grants = await client.query(
      `SELECT user_id FROM circle_thread_access_grants
       WHERE thread_id = $1 AND revoked_at IS NULL`,
      [threadId]
    );
    for (const row of grants.rows) ids.add(String(row.user_id));
  }
  return [...ids];
}
