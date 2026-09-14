import { pool } from "@vaara/db";

export const MAX_FEED_IMPRESSIONS = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseImpressionPostIds(
  body: unknown
): { postIds: string[] } | { error: string } {
  const raw =
    body && typeof body === "object" && "postIds" in body
      ? (body as { postIds: unknown }).postIds
      : undefined;
  if (!Array.isArray(raw)) {
    return { error: "postIds must be an array" };
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
      return { error: "Invalid post id" };
    }
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  if (unique.length > MAX_FEED_IMPRESSIONS) {
    return { error: `A request can include up to ${MAX_FEED_IMPRESSIONS} post ids` };
  }
  return { postIds: unique };
}

export async function recordHomeFeedImpressions(params: {
  userId: string;
  postIds: string[];
}): Promise<void> {
  if (params.postIds.length === 0) return;
  await pool.query(
    `INSERT INTO feed_post_impressions
       (user_id, post_id, first_seen_at, last_seen_at)
     SELECT $1, p.id, now(), now()
     FROM circle_posts p
     WHERE p.id = ANY($2::uuid[])
     ON CONFLICT (user_id, post_id)
     DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
    [params.userId, params.postIds]
  );
}
