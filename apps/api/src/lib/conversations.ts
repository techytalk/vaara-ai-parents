import type { PoolClient } from "pg";
import { listUserRoles, type AccountRole } from "./user-roles.js";

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

export async function resolveConversationRoles(
  client: PoolClient,
  userId: string,
  peerUserId: string,
  requestedMy?: PresentationRole,
  requestedPeer?: PresentationRole
): Promise<
  | { myRole: PresentationRole; peerRole: PresentationRole }
  | { error: string; status: number }
> {
  const myRoles = await listUserRoles(client, userId);
  const peerRoles = await listUserRoles(client, peerUserId);
  const myRole = requestedMy ?? (myRoles.includes("parent") ? "parent" : myRoles[0]);
  const peerRole =
    requestedPeer ?? (peerRoles.includes("parent") ? "parent" : peerRoles[0]);
  if (!myRole || !peerRole) {
    return { error: "Both accounts need an active role", status: 400 };
  }
  if (!myRoles.includes(myRole)) {
    return { error: "You do not have that role", status: 403 };
  }
  if (!peerRoles.includes(peerRole as AccountRole)) {
    return { error: "That person does not have that role", status: 400 };
  }
  return { myRole, peerRole };
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
  const resolved = await resolveConversationRoles(
    client,
    params.userId,
    params.peerUserId,
    params.myRole,
    params.peerRole
  );
  if ("error" in resolved) {
    throw new Error(resolved.error);
  }
  const { myRole, peerRole } = resolved;
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
