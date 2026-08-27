import type { PoolClient } from "pg";
import { readPool } from "@vaara/db";
import {
  assertCircleMember,
  buildAuthorView,
} from "../lib/author.js";
import { mediaPublicUrl, type MediaType } from "../lib/media-storage.js";
import { loadPostPolls } from "../lib/polls.js";
import { loadTopicsForPosts, type TopicSummary } from "../lib/topics.js";
import type { PollView } from "../lib/polls.js";

type PostMediaView = {
  id: string;
  type: MediaType;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type FeedPost = {
  id: string;
  body: string;
  tag: string;
  replyCount: number;
  createdAt: string;
  media: PostMediaView[];
  poll: PollView | null;
  topics: TopicSummary[];
  author: {
    userId: string;
    anonymousHandle: string;
    contextLabel: string;
  };
};

export type CircleFeedResult = {
  posts: FeedPost[];
  nextCursor: string | null;
};

async function loadPostMedia(
  client: PoolClient,
  postIds: string[]
): Promise<Map<string, PostMediaView[]>> {
  const result = new Map<string, PostMediaView[]>();
  if (postIds.length === 0) return result;

  const { rows } = await client.query(
    `SELECT id, post_id, storage_key, media_type, mime_type,
            width, height, duration_ms
     FROM circle_post_media
     WHERE post_id = ANY($1::uuid[])
     ORDER BY post_id, sort_order`,
    [postIds]
  );

  for (const row of rows) {
    const media = result.get(row.post_id) ?? [];
    media.push({
      id: row.id,
      type: row.media_type,
      url: mediaPublicUrl(row.storage_key),
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      durationMs: row.duration_ms,
    });
    result.set(row.post_id, media);
  }
  return result;
}

function mapPost(
  row: Record<string, unknown>,
  author: { anonymousHandle: string; contextLabel: string; userId: string },
  media: PostMediaView[] = [],
  poll?: PollView | null,
  topics: TopicSummary[] = []
): FeedPost {
  return {
    id: row.id as string,
    body: row.body as string,
    tag: row.tag as string,
    replyCount: row.reply_count as number,
    createdAt: row.created_at as string,
    media,
    poll: poll ?? null,
    topics,
    author: {
      userId: author.userId,
      anonymousHandle: author.anonymousHandle,
      contextLabel: author.contextLabel,
    },
  };
}

export async function loadCircleFeed(params: {
  userId: string;
  circleId: string;
  scope?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<CircleFeedResult | { error: "not_found" }> {
  const scope = params.scope ?? "local";
  const limit = Math.min(params.limit ?? 20, 50);
  const client = await readPool.connect();

  try {
    const circle = await assertCircleMember(client, params.circleId, params.userId);
    if (!circle) {
      return { error: "not_found" };
    }

    const localFilter =
      circle.circle_type === "curriculum" && scope === "local";

    let query = `
      SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.author_id,
             u.anonymous_handle
      FROM circle_posts p
      JOIN circle_post_targets pct ON pct.post_id = p.id
      JOIN users u ON u.id = p.author_id
      WHERE pct.circle_id = $1`;

    const sqlParams: unknown[] = [params.circleId];
    let paramIdx = 2;

    if (localFilter) {
      query += `
        AND EXISTS (
          SELECT 1 FROM user_locations viewer_loc
          JOIN user_locations author_loc ON author_loc.pin_code = viewer_loc.pin_code
          WHERE viewer_loc.user_id = $${paramIdx}
            AND author_loc.user_id = p.author_id
        )`;
      sqlParams.push(params.userId);
      paramIdx++;
    }

    if (params.cursor) {
      query += ` AND p.created_at < $${paramIdx}::timestamptz`;
      sqlParams.push(params.cursor);
      paramIdx++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIdx}`;
    sqlParams.push(limit);

    const { rows } = await client.query(query, sqlParams);
    const mediaByPost = await loadPostMedia(
      client,
      rows.map((row) => row.id)
    );
    const memberCountResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
      [params.circleId]
    );
    const memberCount = memberCountResult.rows[0]?.count ?? 0;
    const pollsByPost = await loadPostPolls(
      client,
      rows.map((row) => row.id),
      params.userId,
      memberCount
    );
    const topicsByPost = await loadTopicsForPosts(
      client,
      rows.map((row) => row.id)
    );

    const posts = await Promise.all(
      rows.map(async (row) => {
        const author = await buildAuthorView(
          client,
          row.author_id,
          row.anonymous_handle,
          circle
        );
        return mapPost(
          row,
          author,
          mediaByPost.get(row.id) ?? [],
          pollsByPost.get(row.id),
          topicsByPost.get(row.id) ?? []
        );
      })
    );

    const nextCursor =
      rows.length === limit ? (rows[rows.length - 1].created_at as string) : null;

    return { posts, nextCursor };
  } finally {
    client.release();
  }
}
