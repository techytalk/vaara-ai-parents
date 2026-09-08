import type { PoolClient } from "pg";

export type PostCircleSummary = {
  id: string;
  displayName: string;
  circleType: string;
};

/** Circle placements of a post, in publish order (primary circle first). */
export async function loadCirclesForPosts(
  client: PoolClient,
  postIds: string[]
): Promise<Map<string, PostCircleSummary[]>> {
  const result = new Map<string, PostCircleSummary[]>();
  if (postIds.length === 0) return result;

  const { rows } = await client.query(
    `SELECT cpt.post_id, c.id, c.display_name, c.circle_type
     FROM circle_post_targets cpt
     JOIN circles c ON c.id = cpt.circle_id
     WHERE cpt.post_id = ANY($1::uuid[])
     ORDER BY cpt.post_id, cpt.created_at, c.display_name`,
    [postIds]
  );

  for (const row of rows) {
    const postId = String(row.post_id);
    const list = result.get(postId) ?? [];
    list.push({
      id: String(row.id),
      displayName: String(row.display_name),
      circleType: String(row.circle_type),
    });
    result.set(postId, list);
  }
  return result;
}
