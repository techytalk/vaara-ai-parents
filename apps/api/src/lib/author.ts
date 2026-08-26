import type { PoolClient } from "pg";

export type AuthorView = {
  userId: string;
  anonymousHandle: string;
  contextLabel: string;
};

type CircleRow = {
  id: string;
  circle_type: string;
  key: string;
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

  if (rows.length === 0) return "";

  const children = rows as ChildRow[];

  if (circle.circle_type === "curriculum") {
    const curriculumId = circle.metadata?.curriculum_id as string | undefined;
    const code = circle.metadata?.code as string | undefined;
    const match =
      children.find((c) => c.curriculum_id === curriculumId) ??
      children.find((c) => c.curriculum_code === code) ??
      children[0];
    return `${match.curriculum_name} · ${match.grade_label}`;
  }

  if (circle.circle_type === "class") {
    const gradeId = circle.metadata?.grade_id as string | undefined;
    const gradeCode = circle.metadata?.grade_code as string | undefined;
    const match =
      children.find((c) => c.grade_id === gradeId) ??
      children.find((c) => c.grade_code === gradeCode) ??
      children[0];
    return `${match.curriculum_name} · ${match.grade_label}`;
  }

  const primary = children[0];
  return `${primary.curriculum_name} · ${primary.grade_label}`;
}

export async function buildAuthorView(
  client: PoolClient,
  userId: string,
  anonymousHandle: string,
  circle: CircleRow
): Promise<AuthorView> {
  const contextLabel = await getAuthorContextForCircle(client, userId, circle);
  return {
    userId,
    anonymousHandle,
    contextLabel,
  };
}

export async function assertCircleMember(
  client: PoolClient,
  circleId: string,
  userId: string
): Promise<CircleRow | null> {
  const { rows } = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.metadata
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
