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
    avatarKey: string;
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
  author: {
    anonymousHandle: string;
    contextLabel: string;
    userId: string;
    avatarKey: string;
  },
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
      avatarKey: author.avatarKey,
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
             u.anonymous_handle, u.avatar_key
      FROM circle_posts p
      JOIN circle_post_targets pct ON pct.post_id = p.id
      JOIN users u ON u.id = p.author_id
      WHERE pct.circle_id = $1`;

    const sqlParams: unknown[] = [params.circleId];
    let paramIdx = 2;

    if (localFilter) {
      query += `
        AND (
          p.author_id = $${paramIdx}
          OR EXISTS (
            SELECT 1 FROM user_locations viewer_loc
            JOIN user_locations author_loc ON author_loc.pin_code = viewer_loc.pin_code
            WHERE viewer_loc.user_id = $${paramIdx}
              AND author_loc.user_id = p.author_id
          )
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
          circle,
          row.avatar_key
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

export type HomeFeedPost = FeedPost & {
  circleId: string;
  circleName: string;
  helpfulCount: number;
  myHelpful: boolean;
  discovery?: boolean;
};

export type HomeFeedResult = {
  posts: HomeFeedPost[];
  nextCursor: string | null;
};

type HomeFeedPhase = "primary" | "discovery";

function parseHomeFeedCursor(cursor?: string | null): {
  phase: HomeFeedPhase;
  before: string | null;
} {
  if (!cursor) {
    return { phase: "primary", before: null };
  }
  if (cursor.startsWith("d|")) {
    return { phase: "discovery", before: cursor.slice(2) || null };
  }
  if (cursor.startsWith("p|")) {
    return { phase: "primary", before: cursor.slice(2) || null };
  }
  return { phase: "primary", before: cursor };
}

function encodeHomeFeedCursor(
  phase: HomeFeedPhase,
  createdAt: string
): string {
  return `${phase === "primary" ? "p" : "d"}|${createdAt}`;
}

const MEMBER_HOME_FEED_SQL = `
  WITH member_circles AS (
    SELECT c.id, c.circle_type, c.display_name, c.key, c.metadata
    FROM circle_members cm
    JOIN circles c ON c.id = cm.circle_id
    WHERE cm.user_id = $1
  ),
  post_circles AS (
    SELECT
      p.id,
      p.body,
      p.tag,
      p.reply_count,
      p.created_at,
      p.author_id,
      u.anonymous_handle,
      u.avatar_key,
      mc.id AS circle_id,
      mc.display_name AS circle_name,
      mc.circle_type,
      mc.key AS circle_key,
      mc.metadata AS circle_metadata,
      ROW_NUMBER() OVER (
        PARTITION BY p.id
        ORDER BY CASE mc.circle_type
          WHEN 'school_class' THEN 1
          WHEN 'class' THEN 2
          WHEN 'school' THEN 3
          WHEN 'community' THEN 4
          WHEN 'locality' THEN 5
          WHEN 'curriculum' THEN 6
          ELSE 7
        END,
        mc.id
      ) AS rn
    FROM circle_posts p
    JOIN circle_post_targets pct ON pct.post_id = p.id
    JOIN member_circles mc ON mc.id = pct.circle_id
    JOIN users u ON u.id = p.author_id
    WHERE (
      mc.circle_type <> 'curriculum'
      OR p.author_id = $1
      OR EXISTS (
        SELECT 1
        FROM user_locations viewer_loc
        JOIN user_locations author_loc ON author_loc.pin_code = viewer_loc.pin_code
        WHERE viewer_loc.user_id = $1
          AND author_loc.user_id = p.author_id
      )
    )
    AND ($2::timestamptz IS NULL OR p.created_at < $2::timestamptz)
  )
  SELECT *
  FROM post_circles
  WHERE rn = 1
  ORDER BY created_at DESC
  LIMIT $3`;

const DISCOVERY_HOME_FEED_SQL = `
  WITH viewer_pin AS (
    SELECT pin_code FROM user_locations WHERE user_id = $1 LIMIT 1
  ),
  viewer_curricula AS (
    SELECT DISTINCT curriculum_id FROM children WHERE user_id = $1
  ),
  candidate AS (
    SELECT
      p.id,
      p.body,
      p.tag,
      p.reply_count,
      p.created_at,
      p.author_id,
      u.anonymous_handle,
      u.avatar_key,
      c.id AS circle_id,
      c.display_name AS circle_name,
      c.circle_type,
      c.key AS circle_key,
      c.metadata AS circle_metadata,
      CASE
        WHEN vp.pin_code IS NOT NULL AND al.pin_code = vp.pin_code THEN 0
        WHEN EXISTS (
          SELECT 1
          FROM children ach
          JOIN viewer_curricula vc ON ach.curriculum_id = vc.curriculum_id
          WHERE ach.user_id = p.author_id
        ) THEN 1
        ELSE 2
      END AS relevance,
      COALESCE(h.cnt, 0) AS helpful_count
    FROM circle_posts p
    JOIN circle_post_targets pct ON pct.post_id = p.id
    JOIN circles c ON c.id = pct.circle_id
    JOIN users u ON u.id = p.author_id
    LEFT JOIN viewer_pin vp ON true
    LEFT JOIN user_locations al ON al.user_id = p.author_id
    LEFT JOIN (
      SELECT post_id, COUNT(*)::int AS cnt
      FROM post_helpful_marks
      GROUP BY post_id
    ) h ON h.post_id = p.id
    WHERE p.author_id <> $1
      AND NOT EXISTS (
        SELECT 1
        FROM circle_members cm
        WHERE cm.circle_id = c.id AND cm.user_id = $1
      )
      AND ($2::timestamptz IS NULL OR p.created_at < $2::timestamptz)
  ),
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY id
        ORDER BY relevance ASC,
          CASE circle_type
            WHEN 'school_class' THEN 1
            WHEN 'class' THEN 2
            WHEN 'school' THEN 3
            WHEN 'community' THEN 4
            WHEN 'locality' THEN 5
            WHEN 'curriculum' THEN 6
            ELSE 7
          END,
          circle_id
      ) AS rn
    FROM candidate
  )
  SELECT *
  FROM ranked
  WHERE rn = 1
  ORDER BY relevance ASC, helpful_count DESC, created_at DESC
  LIMIT $3`;

async function hydrateHomeFeedPosts(
  client: PoolClient,
  userId: string,
  rows: Array<Record<string, unknown>>,
  discovery: boolean
): Promise<HomeFeedPost[]> {
  const postIds = rows.map((row) => row.id as string);
  const mediaByPost = await loadPostMedia(client, postIds);
  const topicsByPost = await loadTopicsForPosts(client, postIds);
  const helpfulByPost = await loadPostHelpfulCounts(client, postIds, userId);

  const circleIds = [...new Set(rows.map((row) => row.circle_id as string))];
  const memberCountByCircle = new Map<string, number>();
  if (circleIds.length > 0) {
    const { rows: memberRows } = await client.query(
      `SELECT circle_id, COUNT(*)::int AS count
       FROM circle_members
       WHERE circle_id = ANY($1::uuid[])
       GROUP BY circle_id`,
      [circleIds]
    );
    for (const row of memberRows) {
      memberCountByCircle.set(row.circle_id, row.count);
    }
  }

  const pollsByPost = new Map<string, PollView>();
  for (const circleId of circleIds) {
    const circlePostIds = rows
      .filter((row) => row.circle_id === circleId)
      .map((row) => row.id as string);
    const circlePolls = await loadPostPolls(
      client,
      circlePostIds,
      userId,
      memberCountByCircle.get(circleId) ?? 1
    );
    for (const [postId, poll] of circlePolls) {
      pollsByPost.set(postId, poll);
    }
  }

  return Promise.all(
    rows.map(async (row) => {
      const circle = {
        id: row.circle_id as string,
        circle_type: row.circle_type as string,
        key: row.circle_key as string,
        display_name: row.circle_name as string,
        metadata: (row.circle_metadata ?? {}) as Record<string, unknown>,
      };
      const author = await buildAuthorView(
        client,
        row.author_id as string,
        row.anonymous_handle as string,
        circle,
        row.avatar_key as string | null | undefined
      );
      const helpful = helpfulByPost.get(row.id as string) ?? {
        count: 0,
        mine: false,
      };
      return {
        ...mapPost(
          row,
          author,
          mediaByPost.get(row.id as string) ?? [],
          pollsByPost.get(row.id as string),
          topicsByPost.get(row.id as string) ?? []
        ),
        circleId: row.circle_id as string,
        circleName: row.circle_name as string,
        helpfulCount: helpful.count,
        myHelpful: helpful.mine,
        discovery,
      };
    })
  );
}

export async function isDiscoveryPostReadable(
  client: PoolClient,
  userId: string,
  circleId: string,
  postId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1
     FROM circle_posts p
     JOIN circle_post_targets pct ON pct.post_id = p.id AND pct.circle_id = $3
     WHERE p.id = $1
       AND p.author_id <> $2
       AND NOT EXISTS (
         SELECT 1
         FROM circle_members cm
         WHERE cm.circle_id = pct.circle_id AND cm.user_id = $2
       )
     LIMIT 1`,
    [postId, userId, circleId]
  );
  return rows.length > 0;
}

async function loadPostHelpfulCounts(
  client: PoolClient,
  postIds: string[],
  userId: string
): Promise<Map<string, { count: number; mine: boolean }>> {
  const result = new Map<string, { count: number; mine: boolean }>();
  if (postIds.length === 0) return result;

  const { rows: countRows } = await client.query(
    `SELECT post_id, COUNT(*)::int AS count
     FROM post_helpful_marks
     WHERE post_id = ANY($1::uuid[])
     GROUP BY post_id`,
    [postIds]
  );
  for (const row of countRows) {
    result.set(row.post_id, { count: row.count, mine: false });
  }

  const { rows: mineRows } = await client.query(
    `SELECT post_id
     FROM post_helpful_marks
     WHERE post_id = ANY($1::uuid[]) AND user_id = $2`,
    [postIds, userId]
  );
  for (const row of mineRows) {
    const current = result.get(row.post_id) ?? { count: 0, mine: false };
    result.set(row.post_id, { ...current, mine: true });
  }

  return result;
}

export async function loadHomeFeed(params: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<HomeFeedResult> {
  const limit = Math.min(params.limit ?? 20, 50);
  const { phase, before } = parseHomeFeedCursor(params.cursor);
  const client = await readPool.connect();

  try {
    if (phase === "discovery") {
      const { rows } = await client.query(DISCOVERY_HOME_FEED_SQL, [
        params.userId,
        before,
        limit,
      ]);
      const posts = await hydrateHomeFeedPosts(client, params.userId, rows, true);
      const nextCursor =
        rows.length === limit
          ? encodeHomeFeedCursor(
              "discovery",
              rows[rows.length - 1].created_at as string
            )
          : null;
      return { posts, nextCursor };
    }

    const { rows: primaryRows } = await client.query(MEMBER_HOME_FEED_SQL, [
      params.userId,
      before,
      limit,
    ]);

    if (primaryRows.length === limit) {
      const posts = await hydrateHomeFeedPosts(
        client,
        params.userId,
        primaryRows,
        false
      );
      return {
        posts,
        nextCursor: encodeHomeFeedCursor(
          "primary",
          primaryRows[primaryRows.length - 1].created_at as string
        ),
      };
    }

    const primaryPosts = await hydrateHomeFeedPosts(
      client,
      params.userId,
      primaryRows,
      false
    );
    const discoveryLimit = limit - primaryRows.length;
    if (discoveryLimit <= 0) {
      return { posts: primaryPosts, nextCursor: null };
    }

    const { rows: discoveryRows } = await client.query(
      DISCOVERY_HOME_FEED_SQL,
      [params.userId, null, discoveryLimit]
    );
    const discoveryPosts = await hydrateHomeFeedPosts(
      client,
      params.userId,
      discoveryRows,
      true
    );
    const posts = [...primaryPosts, ...discoveryPosts];
    const nextCursor =
      discoveryRows.length === discoveryLimit
        ? encodeHomeFeedCursor(
            "discovery",
            discoveryRows[discoveryRows.length - 1].created_at as string
          )
        : null;

    return { posts, nextCursor };
  } finally {
    client.release();
  }
}

export async function togglePostHelpful(params: {
  userId: string;
  postId: string;
}): Promise<
  | { helpful: boolean; helpfulCount: number }
  | { error: "not_found" | "forbidden" }
> {
  const client = await readPool.connect();
  try {
    const { rows: accessRows } = await client.query(
      `SELECT 1
       FROM circle_post_targets pct
       JOIN circle_members cm ON cm.circle_id = pct.circle_id
       WHERE pct.post_id = $1 AND cm.user_id = $2
       LIMIT 1`,
      [params.postId, params.userId]
    );
    if (accessRows.length === 0) {
      return { error: "forbidden" };
    }

    const { rows: postRows } = await client.query(
      `SELECT id FROM circle_posts WHERE id = $1`,
      [params.postId]
    );
    if (postRows.length === 0) {
      return { error: "not_found" };
    }

    const { rows: existing } = await client.query(
      `SELECT 1 FROM post_helpful_marks
       WHERE post_id = $1 AND user_id = $2`,
      [params.postId, params.userId]
    );

    if (existing.length > 0) {
      await client.query(
        `DELETE FROM post_helpful_marks
         WHERE post_id = $1 AND user_id = $2`,
        [params.postId, params.userId]
      );
    } else {
      await client.query(
        `INSERT INTO post_helpful_marks (post_id, user_id)
         VALUES ($1, $2)`,
        [params.postId, params.userId]
      );
    }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM post_helpful_marks
       WHERE post_id = $1`,
      [params.postId]
    );

    return {
      helpful: existing.length === 0,
      helpfulCount: countRows[0]?.count ?? 0,
    };
  } finally {
    client.release();
  }
}

export async function assertPostVisibleToUser(
  client: PoolClient,
  postId: string,
  userId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1
     FROM circle_post_targets pct
     JOIN circle_members cm ON cm.circle_id = pct.circle_id
     WHERE pct.post_id = $1 AND cm.user_id = $2
     LIMIT 1`,
    [postId, userId]
  );
  if (rows.length > 0) {
    return true;
  }

  const { rows: discoveryRows } = await client.query(
    `SELECT pct.circle_id
     FROM circle_post_targets pct
     JOIN circle_posts p ON p.id = pct.post_id
     WHERE pct.post_id = $1
       AND p.author_id <> $2
       AND NOT EXISTS (
         SELECT 1
         FROM circle_members cm
         WHERE cm.circle_id = pct.circle_id AND cm.user_id = $2
       )
     LIMIT 1`,
    [postId, userId]
  );
  return discoveryRows.length > 0;
}
