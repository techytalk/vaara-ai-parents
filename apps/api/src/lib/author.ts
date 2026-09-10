import type { PoolClient } from "pg";
import { resolveAvatarKey } from "./avatar.js";

export type AuthorView = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
  avatarKey: string;
  /** True when the author is not a member of the circle where this post is shown. */
  isGuest?: boolean;
};

export function mapAuthorView(
  userId: string,
  anonymousHandle: string,
  contextLabel: string,
  storedAvatarKey?: string | null,
  isGuest = false
): AuthorView {
  return {
    userId,
    anonymousHandle,
    contextLabel,
    avatarKey: resolveAvatarKey(storedAvatarKey, anonymousHandle),
    isGuest,
  };
}

type CircleRow = {
  id: string;
  circle_type: string;
  key: string;
  display_name?: string;
  metadata: Record<string, unknown>;
};

type ChildRow = {
  curriculum_id: string;
  curriculum_code: string;
  curriculum_name: string;
  grade_id: string;
  grade_code: string;
  grade_label: string;
};

export async function getAuthorContextForCircle(
  client: PoolClient,
  userId: string,
  circle: CircleRow
): Promise<string> {
  const { rows } = await client.query(
    `SELECT cur.id AS curriculum_id, cur.code AS curriculum_code,
            cur.name AS curriculum_name, g.id AS grade_id,
            g.code AS grade_code, g.label AS grade_label
     FROM children ch
     JOIN curricula cur ON cur.id = ch.curriculum_id
     JOIN curriculum_grades g ON g.id = ch.grade_id
     WHERE ch.user_id = $1
     ORDER BY ch.created_at`,
    [userId]
  );

  return contextLabelFromChildren(rows as ChildRow[], circle);
}

/** Badge-only; normal profile context (curriculum · grade) still shows for guests. */
export const OUTSIDER_AUTHOR_LABEL = "Guest";

export async function buildAuthorView(
  client: PoolClient,
  userId: string,
  anonymousHandle: string,
  circle: CircleRow,
  storedAvatarKey?: string | null
): Promise<AuthorView> {
  const contextLabel = await getAuthorContextForCircle(client, userId, circle);
  return mapAuthorView(userId, anonymousHandle, contextLabel, storedAvatarKey, false);
}

export async function buildAuthorViewForCircleAccess(
  client: PoolClient,
  userId: string,
  anonymousHandle: string,
  circle: CircleRow,
  storedAvatarKey?: string | null
): Promise<AuthorView> {
  const member = await assertCircleMember(client, circle.id, userId);
  const contextLabel = await getAuthorContextForCircle(client, userId, circle);
  return mapAuthorView(
    userId,
    anonymousHandle,
    contextLabel,
    storedAvatarKey,
    !member
  );
}

function authorPairKey(userId: string, circleId: string): string {
  return `${userId}:${circleId}`;
}

function contextLabelFromChildren(
  children: ChildRow[],
  circle: CircleRow
): string {
  if (children.length === 0) return "";

  if (circle.circle_type === "curriculum") {
    const curriculumId = circle.metadata?.curriculum_id as string | undefined;
    const code = circle.metadata?.code as string | undefined;
    const match =
      children.find((c) => c.curriculum_id === curriculumId) ??
      children.find((c) => c.curriculum_code === code) ??
      children[0];
    return `${match.curriculum_name} · ${match.grade_label}`;
  }

  if (circle.circle_type === "class" || circle.circle_type === "school_class") {
    const curriculumId = circle.metadata?.curriculum_id as string | undefined;
    const gradeId = circle.metadata?.grade_id as string | undefined;
    const gradeCode = circle.metadata?.grade_code as string | undefined;
    const code = circle.metadata?.code as string | undefined;
    const match =
      children.find(
        (c) => c.curriculum_id === curriculumId && c.grade_id === gradeId
      ) ??
      children.find(
        (c) => c.curriculum_code === code && c.grade_code === gradeCode
      ) ??
      children.find((c) => c.grade_id === gradeId) ??
      children.find((c) => c.grade_code === gradeCode) ??
      children[0];
    return `${match.curriculum_name} · ${match.grade_label}`;
  }

  const primary = children[0];
  return `${primary.curriculum_name} · ${primary.grade_label}`;
}

/**
 * Batch version of buildAuthorViewForCircleAccess — one membership query and
 * one children query for the whole feed page instead of 2N round trips.
 */
export async function buildAuthorViewsForCircleAccess(
  client: PoolClient,
  authors: Array<{
    userId: string;
    anonymousHandle: string;
    circle: CircleRow;
    storedAvatarKey?: string | null;
  }>
): Promise<Map<string, AuthorView>> {
  const result = new Map<string, AuthorView>();
  if (authors.length === 0) return result;

  const userIds = [...new Set(authors.map((a) => a.userId))];
  const circleIds = [...new Set(authors.map((a) => a.circle.id))];

  const { rows: memberRows } = await client.query(
    `SELECT cm.user_id, cm.circle_id
     FROM circle_members cm
     WHERE cm.user_id = ANY($1::uuid[])
       AND cm.circle_id = ANY($2::uuid[])`,
    [userIds, circleIds]
  );
  const memberKeys = new Set(
    memberRows.map((row) => authorPairKey(row.user_id, row.circle_id))
  );

  const { rows: childRows } = await client.query(
    `SELECT ch.user_id,
            cur.id AS curriculum_id, cur.code AS curriculum_code,
            cur.name AS curriculum_name, g.id AS grade_id,
            g.code AS grade_code, g.label AS grade_label
     FROM children ch
     JOIN curricula cur ON cur.id = ch.curriculum_id
     JOIN curriculum_grades g ON g.id = ch.grade_id
     WHERE ch.user_id = ANY($1::uuid[])
     ORDER BY ch.created_at`,
    [userIds]
  );

  const childrenByUser = new Map<string, ChildRow[]>();
  for (const row of childRows) {
    const list = childrenByUser.get(row.user_id) ?? [];
    list.push({
      curriculum_id: row.curriculum_id,
      curriculum_code: row.curriculum_code,
      curriculum_name: row.curriculum_name,
      grade_id: row.grade_id,
      grade_code: row.grade_code,
      grade_label: row.grade_label,
    });
    childrenByUser.set(row.user_id, list);
  }

  for (const author of authors) {
    const key = authorPairKey(author.userId, author.circle.id);
    const contextLabel = contextLabelFromChildren(
      childrenByUser.get(author.userId) ?? [],
      author.circle
    );
    result.set(
      key,
      mapAuthorView(
        author.userId,
        author.anonymousHandle,
        contextLabel,
        author.storedAvatarKey,
        !memberKeys.has(key)
      )
    );
  }

  return result;
}

export async function buildReviewAuthorView(
  client: PoolClient,
  userId: string,
  anonymousHandle: string,
  storedAvatarKey?: string | null
): Promise<AuthorView> {
  const { rows } = await client.query(
    `SELECT cur.name AS curriculum_name, g.label AS grade_label
     FROM children ch
     JOIN curricula cur ON cur.id = ch.curriculum_id
     JOIN curriculum_grades g ON g.id = ch.grade_id
     WHERE ch.user_id = $1
     ORDER BY ch.created_at
     LIMIT 1`,
    [userId]
  );

  const contextLabel =
    rows.length > 0
      ? `${rows[0].curriculum_name} · ${rows[0].grade_label}`
      : "";

  return mapAuthorView(userId, anonymousHandle, contextLabel, storedAvatarKey);
}

const CIRCLE_TYPE_RANK: Record<string, number> = {
  school_class: 6,
  class: 5,
  school: 4,
  community: 3,
  locality: 2,
  curriculum: 1,
};

export async function buildAuthorViewForPost(
  client: PoolClient,
  readerId: string,
  authorId: string,
  postId: string,
  anonymousHandle: string,
  storedAvatarKey?: string | null
): Promise<AuthorView> {
  const { rows } = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata
     FROM circle_post_targets pct
     JOIN circle_members reader_cm
       ON reader_cm.circle_id = pct.circle_id AND reader_cm.user_id = $1
     JOIN circle_members author_cm
       ON author_cm.circle_id = pct.circle_id AND author_cm.user_id = $2
     JOIN circles c ON c.id = pct.circle_id
     WHERE pct.post_id = $3`,
    [readerId, authorId, postId]
  );

  if (rows.length === 0) {
    return mapAuthorView(authorId, anonymousHandle, "", storedAvatarKey);
  }

  const best = (rows as CircleRow[]).reduce((a, b) =>
    (CIRCLE_TYPE_RANK[a.circle_type] ?? 0) >= (CIRCLE_TYPE_RANK[b.circle_type] ?? 0)
      ? a
      : b
  );

  return buildAuthorView(
    client,
    authorId,
    anonymousHandle,
    best,
    storedAvatarKey
  );
}

export async function assertCircleMember(
  client: PoolClient,
  circleId: string,
  userId: string
): Promise<CircleRow | null> {
  const { rows } = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata
     FROM circles c
     JOIN circle_members cm ON cm.circle_id = c.id
     WHERE c.id = $1 AND cm.user_id = $2`,
    [circleId, userId]
  );
  return rows.length > 0 ? (rows[0] as CircleRow) : null;
}

export async function assertSharedCircle(
  client: PoolClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM circle_members cm1
     JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
     WHERE cm1.user_id = $1 AND cm2.user_id = $2
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

export async function isBlocked(
  client: PoolClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM user_blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}
