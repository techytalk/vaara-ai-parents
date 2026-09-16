import type { PoolClient } from "pg";

export type PresentationRole = "parent" | "provider";

export function conversationContextKey(
  userId: string,
  peerUserId: string,
  myRole: PresentationRole,
  peerRole: PresentationRole
): string {
  return userId < peerUserId
    ? `${myRole}:${peerRole}`
    : `${peerRole}:${myRole}`;
}

export async function getOrCreateConversation(
  client: PoolClient,
  params: {
    userId: string;
    peerUserId: string;
    myRole?: PresentationRole;
    peerRole?: PresentationRole;
    initiatedFromCircleId?: string | null;
    initiatedFromPostId?: string | null;
    initiatedFromThreadId?: string | null;
  }
): Promise<string> {
  const myRole = params.myRole ?? "parent";
  const peerRole = params.peerRole ?? "parent";
  const contextKey = conversationContextKey(
    params.userId,
    params.peerUserId,
    myRole,
    peerRole
  );

  const inserted = await client.query(
    `INSERT INTO conversations (
       user_a_id, user_b_id, context_key,
       initiated_from_circle_id, initiated_from_post_id, initiated_from_thread_id
     )
     VALUES (
       LEAST($1::uuid, $2::uuid),
       GREATEST($1::uuid, $2::uuid),
       $3, $4, $5, $6
     )
     ON CONFLICT (user_a_id, user_b_id, context_key)
     DO UPDATE SET user_a_id = EXCLUDED.user_a_id
     RETURNING id`,
    [
      params.userId,
      params.peerUserId,
      contextKey,
      params.initiatedFromCircleId ?? null,
      params.initiatedFromPostId ?? null,
      params.initiatedFromThreadId ?? null,
    ]
  );
  const conversationId = String(inserted.rows[0].id);

  await client.query(
    `INSERT INTO conversation_participants (
       conversation_id, user_id, presentation_role
     )
     VALUES ($1, $2, $3), ($1, $4, $5)
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [conversationId, params.userId, myRole, params.peerUserId, peerRole]
  );

  await client.query(
    `UPDATE conversation_participants
     SET hidden = false
     WHERE conversation_id = $1 AND user_id = ANY($2::uuid[])`,
    [conversationId, [params.userId, params.peerUserId]]
  );

  return conversationId;
}

export async function findConversationByPair(
  client: PoolClient,
  userA: string,
  userB: string,
  contextKey = "parent:parent"
): Promise<string | null> {
  const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
  const { rows } = await client.query(
    `SELECT id FROM conversations
     WHERE user_a_id = $1 AND user_b_id = $2 AND context_key = $3`,
    [a, b, contextKey]
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}
