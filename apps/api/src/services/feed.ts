import type { PoolClient } from "pg";
import { pool, readPool } from "@vaara/db";
import {
  encodeFeedCursor,
  encodeHomeFeedCursor,
  encodeHomeFeedCursorV2,
  isLegacyHomeCursor,
  nextFreshnessPhase,
  parseFeedCursor,
  parseHomeFeedCursor,
  toIsoTimestamp,
  type HomeFeedPhase,
} from "../lib/feed-cursor.js";
import { homeFeedFreshnessEnabled } from "../lib/timeline-mode.js";
import {
  assertCircleMember,
  buildAuthorViewForCircleAccess,
  buildAuthorViewsForCircleAccess,
  mapAuthorView,
} from "../lib/author.js";
import { loadPostPolls, type PollView } from "../lib/polls.js";
import {
  loadPostAttachments,
  type PostDocumentView,
  type PostMediaView,
} from "../lib/post-attachments.js";
import {
  loadCirclesForPosts,
  type PostCircleSummary,
} from "../lib/post-circles.js";
import { loadTopicsForPosts, type TopicSummary } from "../lib/topics.js";

export type FeedPost = {
  id: string;
  body: string;
  tag: string;
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
  media: PostMediaView[];
  documents: PostDocumentView[];
  poll: PollView | null;
  topics: TopicSummary[];
  circles: PostCircleSummary[];
  author: {
    userId: string;
    anonymousHandle: string;
    contextLabel: string;
    avatarKey: string;
    isGuest?: boolean;
  };
};

export type CircleFeedResult = {
  posts: FeedPost[];
  nextCursor: string | null;
};

export function mapPost(
  row: Record<string, unknown>,
  author: {
    anonymousHandle: string;
    contextLabel: string;
    userId: string;
    avatarKey: string;
    isGuest?: boolean;
  },
  media: PostMediaView[] = [],
  poll?: PollView | null,
  topics: TopicSummary[] = [],
  circles: PostCircleSummary[] = [],
  documents: PostDocumentView[] = []
): FeedPost {
  return {
    id: row.id as string,
    body: row.body as string,
    tag: row.tag as string,
    replyCount: row.reply_count as number,
    createdAt: toIsoTimestamp(row.created_at),
    editedAt: (row.edited_at as string | null) ?? null,
    media,
    documents,
    poll: poll ?? null,
    topics,
    circles,
    author: {
      userId: author.userId,
      anonymousHandle: author.anonymousHandle,
      contextLabel: author.contextLabel,
      avatarKey: author.avatarKey,
      isGuest: Boolean(author.isGuest),
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
      SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.edited_at, p.author_id,
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

    const parsedCursor = parseFeedCursor(params.cursor);
    if (parsedCursor) {
      if (parsedCursor.postId) {
        query += ` AND (p.created_at < $${paramIdx}::timestamptz OR (p.created_at = $${paramIdx}::timestamptz AND p.id < $${paramIdx + 1}::uuid))`;
        sqlParams.push(parsedCursor.createdAt, parsedCursor.postId);
        paramIdx += 2;
      } else {
        query += ` AND p.created_at < $${paramIdx}::timestamptz`;
        sqlParams.push(parsedCursor.createdAt);
        paramIdx += 1;
      }
    }

    query += ` ORDER BY p.created_at DESC, p.id DESC LIMIT $${paramIdx}`;
    sqlParams.push(limit);

    const { rows } = await client.query(query, sqlParams);
    const attachmentsByPost = await loadPostAttachments(
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
    const circlesByPost = await loadCirclesForPosts(
      client,
      rows.map((row) => row.id)
    );

    const posts = await Promise.all(
      rows.map(async (row) => {
        const author = await buildAuthorViewForCircleAccess(
          client,
          row.author_id,
          row.anonymous_handle,
          circle,
          row.avatar_key
        );
        const attachments = attachmentsByPost.get(row.id);
        return mapPost(
          row,
          author,
          attachments?.media ?? [],
          pollsByPost.get(row.id),
          topicsByPost.get(row.id) ?? [],
          circlesByPost.get(row.id) ?? [],
          attachments?.documents ?? []
        );
      })
    );

    const last = posts[posts.length - 1];
    const nextCursor =
      posts.length === limit && last
        ? encodeFeedCursor(last.createdAt, last.id)
        : null;

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
      p.edited_at,
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
    AND (
      $2::timestamptz IS NULL
      OR p.created_at < $2::timestamptz
      OR ($3::uuid IS NOT NULL AND p.created_at = $2::timestamptz AND p.id < $3::uuid)
    )
    AND ($6::timestamptz IS NULL OR p.created_at <= $6::timestamptz)
    AND (
      $5::text = 'any'
      OR (
        $5::text = 'unseen'
        AND NOT EXISTS (
          SELECT 1 FROM feed_post_impressions fpi
          WHERE fpi.user_id = $1 AND fpi.post_id = p.id
        )
      )
      OR (
        $5::text = 'seen'
        AND EXISTS (
          SELECT 1 FROM feed_post_impressions fpi
          WHERE fpi.user_id = $1 AND fpi.post_id = p.id
        )
      )
    )
  )
  SELECT *
  FROM post_circles
  WHERE rn = 1
  ORDER BY created_at DESC, id DESC
  LIMIT $4`;

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
      p.edited_at,
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
        FROM circle_post_targets already
        JOIN circle_members cm ON cm.circle_id = already.circle_id
        WHERE already.post_id = p.id
          AND cm.user_id = $1
      )
      AND ($6::timestamptz IS NULL OR p.created_at <= $6::timestamptz)
      AND (
        $5::text = 'any'
        OR (
          $5::text = 'unseen'
          AND NOT EXISTS (
            SELECT 1 FROM feed_post_impressions fpi
            WHERE fpi.user_id = $1 AND fpi.post_id = p.id
          )
        )
        OR (
          $5::text = 'seen'
          AND EXISTS (
            SELECT 1 FROM feed_post_impressions fpi
            WHERE fpi.user_id = $1 AND fpi.post_id = p.id
          )
        )
      )
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
    AND (
      $7::int IS NULL
      OR relevance > $7
      OR (relevance = $7 AND helpful_count < $8)
      OR (
        relevance = $7
        AND helpful_count = $8
        AND (
          $2::timestamptz IS NULL
          OR created_at < $2::timestamptz
          OR ($3::uuid IS NOT NULL AND created_at = $2::timestamptz AND id < $3::uuid)
        )
      )
    )
    AND (
      $7::int IS NOT NULL
      OR $2::timestamptz IS NULL
      OR created_at < $2::timestamptz
      OR ($3::uuid IS NOT NULL AND created_at = $2::timestamptz AND id < $3::uuid)
    )
  ORDER BY relevance ASC, helpful_count DESC, created_at DESC, id DESC
  LIMIT $4`;

export async function hydrateHomeRows(
  client: PoolClient,
  userId: string,
  rows: Array<Record<string, unknown>>,
  discovery: boolean
): Promise<HomeFeedPost[]> {
  const postIds = rows.map((row) => row.id as string);

  const [
    attachmentsByPost,
    topicsByPost,
    circlesByPost,
    helpfulByPost,
    pollsByPost,
    authorViews,
  ] = await Promise.all([
    loadPostAttachments(client, postIds),
    loadTopicsForPosts(client, postIds),
    loadCirclesForPosts(client, postIds),
    loadPostHelpfulCounts(client, postIds, userId),
    loadPostPolls(client, postIds, userId, 1),
    buildAuthorViewsForCircleAccess(
      client,
      rows.map((row) => ({
        userId: row.author_id as string,
        anonymousHandle: row.anonymous_handle as string,
        circle: {
          id: row.circle_id as string,
          circle_type: row.circle_type as string,
          key: row.circle_key as string,
          display_name: row.circle_name as string,
          metadata: (row.circle_metadata ?? {}) as Record<string, unknown>,
        },
        storedAvatarKey: row.avatar_key as string | null | undefined,
      }))
    ),
  ]);

  return rows.map((row) => {
    const authorKey = `${row.author_id as string}:${row.circle_id as string}`;
    const author =
      authorViews.get(authorKey) ??
      // Every row is fed to the batch builder above, so this only guards
      // against a missing key, where membership is unknown.
      mapAuthorView(
        row.author_id as string,
        row.anonymous_handle as string,
        "",
        row.avatar_key as string | null | undefined,
        true
      );
    const helpful = helpfulByPost.get(row.id as string) ?? {
      count: 0,
      mine: false,
    };
    const attachments = attachmentsByPost.get(row.id as string);
    return {
      ...mapPost(
        row,
        author,
        attachments?.media ?? [],
        pollsByPost.get(row.id as string),
        topicsByPost.get(row.id as string) ?? [],
        circlesByPost.get(row.id as string) ?? [],
        attachments?.documents ?? []
      ),
      circleId: row.circle_id as string,
      circleName: row.circle_name as string,
      helpfulCount: helpful.count,
      myHelpful: helpful.mine,
      discovery,
    };
  });
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

export type FeedSeenMode = "any" | "unseen" | "seen";

export async function loadMemberHomeRows(
  client: PoolClient,
  params: {
    userId: string;
    createdAt?: string | null;
    postId?: string;
    limit: number;
    seen?: FeedSeenMode;
    asOf?: string | null;
  }
): Promise<Array<Record<string, unknown>>> {
  const { rows } = await client.query(MEMBER_HOME_FEED_SQL, [
    params.userId,
    params.createdAt ?? null,
    params.postId ?? null,
    params.limit,
    params.seen ?? "any",
    params.asOf ?? null,
  ]);
  return rows;
}

export async function loadDiscoveryHomeRows(
  client: PoolClient,
  params: {
    userId: string;
    createdAt?: string | null;
    postId?: string;
    limit: number;
    seen?: FeedSeenMode;
    asOf?: string | null;
    relevance?: number;
    helpfulCount?: number;
  }
): Promise<Array<Record<string, unknown>>> {
  const { rows } = await client.query(DISCOVERY_HOME_FEED_SQL, [
    params.userId,
    params.createdAt ?? null,
    params.postId ?? null,
    params.limit,
    params.seen ?? "any",
    params.asOf ?? null,
    params.relevance ?? null,
    params.helpfulCount ?? null,
  ]);
  return rows;
}

export async function hydrateCirclePosts(params: {
  client: PoolClient;
  userId: string;
  circle: {
    id: string;
    circle_type: string;
    key: string;
    display_name?: string;
    metadata: Record<string, unknown>;
  };
  postIds: string[];
  includeMissingRetry?: boolean;
}): Promise<{ posts: FeedPost[]; missingIds: string[] }> {
  if (params.postIds.length === 0) return { posts: [], missingIds: [] };

  const loadRows = async (client: PoolClient, ids: string[]) => {
    if (ids.length === 0) return [];
    const { rows } = await client.query(
      `SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.edited_at, p.author_id,
              u.anonymous_handle, u.avatar_key
       FROM circle_posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.id = ANY($1::uuid[])`,
      [ids]
    );
    return rows as Array<Record<string, unknown>>;
  };

  let rows = await loadRows(params.client, params.postIds);
  let found = new Set(rows.map((row) => String(row.id)));
  let missing = params.postIds.filter((id) => !found.has(id));

  if (missing.length > 0 && params.includeMissingRetry !== false) {
    const primary = await pool.connect();
    try {
      const retried = await loadRows(primary, missing);
      rows = [...rows, ...retried];
      found = new Set(rows.map((row) => String(row.id)));
      missing = params.postIds.filter((id) => !found.has(id));
    } finally {
      primary.release();
    }
  }

  const attachmentsByPost = await loadPostAttachments(
    params.client,
    rows.map((row) => String(row.id))
  );
  const memberCountResult = params.circle.id === "home"
    ? { rows: [{ count: 1 }] }
    : await params.client.query(
        `SELECT COUNT(*)::int AS count FROM circle_members WHERE circle_id = $1`,
        [params.circle.id]
      );
  const memberCount = memberCountResult.rows[0]?.count ?? 0;
  const pollsByPost = await loadPostPolls(
    params.client,
    rows.map((row) => String(row.id)),
    params.userId,
    memberCount
  );
  const topicsByPost = await loadTopicsForPosts(
    params.client,
    rows.map((row) => String(row.id))
  );
  const circlesByPost = await loadCirclesForPosts(
    params.client,
    rows.map((row) => String(row.id))
  );

  const byId = new Map<string, FeedPost>();
  await Promise.all(
    rows.map(async (row) => {
      const author = await buildAuthorViewForCircleAccess(
        params.client,
        String(row.author_id),
        String(row.anonymous_handle),
        params.circle,
        row.avatar_key as string | null
      );
      const attachments = attachmentsByPost.get(String(row.id));
      byId.set(
        String(row.id),
        mapPost(
          row,
          author,
          attachments?.media ?? [],
          pollsByPost.get(String(row.id)),
          topicsByPost.get(String(row.id)) ?? [],
          circlesByPost.get(String(row.id)) ?? [],
          attachments?.documents ?? []
        )
      );
    })
  );

  return {
    posts: params.postIds
      .map((id) => byId.get(id))
      .filter((post): post is FeedPost => Boolean(post)),
    missingIds: missing,
  };
}

function isDiscoveryPhase(phase: HomeFeedPhase) {
  return (
    phase === "discovery" ||
    phase === "discovery_unseen" ||
    phase === "discovery_seen"
  );
}

function seenModeForPhase(phase: HomeFeedPhase): FeedSeenMode {
  if (phase === "member_unseen" || phase === "discovery_unseen") return "unseen";
  if (phase === "member_seen" || phase === "discovery_seen") return "seen";
  return "any";
}

async function loadHomeFeedLegacy(params: {
  userId: string;
  cursor?: string | null;
  limit: number;
  client: import("pg").PoolClient;
}): Promise<HomeFeedResult> {
  const { userId, limit, client } = params;
  const parsed = parseHomeFeedCursor(params.cursor);
  if (parsed.phase === "discovery") {
    const rows = await loadDiscoveryHomeRows(client, {
      userId,
      createdAt: parsed.createdAt || null,
      postId: parsed.postId,
      limit,
    });
    const posts = await hydrateHomeRows(client, userId, rows, true);
    const last = posts[posts.length - 1];
    return {
      posts,
      nextCursor:
        posts.length === limit && last
          ? encodeHomeFeedCursor("discovery", last.createdAt, last.id)
          : null,
    };
  }

  const primaryRows = await loadMemberHomeRows(client, {
    userId,
    createdAt: parsed.createdAt || null,
    postId: parsed.postId,
    limit,
  });

  if (primaryRows.length === limit) {
    const posts = await hydrateHomeRows(client, userId, primaryRows, false);
    const last = posts[posts.length - 1];
    return {
      posts,
      nextCursor: last
        ? encodeHomeFeedCursor("primary", last.createdAt, last.id)
        : null,
    };
  }

  const primaryPosts = await hydrateHomeRows(
    client,
    userId,
    primaryRows,
    false
  );
  const discoveryLimit = limit - primaryRows.length;
  if (discoveryLimit <= 0) {
    return { posts: primaryPosts, nextCursor: null };
  }

  const discoveryRows = await loadDiscoveryHomeRows(client, {
    userId,
    createdAt: null,
    postId: undefined,
    limit: discoveryLimit,
  });
  const discoveryPosts = await hydrateHomeRows(
    client,
    userId,
    discoveryRows,
    true
  );
  const seen = new Set(primaryPosts.map((post) => post.id));
  const posts = [
    ...primaryPosts,
    ...discoveryPosts.filter((post) => !seen.has(post.id)),
  ];
  const last = posts[posts.length - 1];
  const endedOnDiscovery = discoveryPosts.some((post) => post.id === last?.id);
  return {
    posts,
    nextCursor:
      posts.length === limit && last
        ? encodeHomeFeedCursor(
            endedOnDiscovery ? "discovery" : "primary",
            last.createdAt,
            last.id
          )
        : null,
  };
}

async function loadHomeFeedFresh(params: {
  userId: string;
  cursor?: string | null;
  limit: number;
  client: import("pg").PoolClient;
}): Promise<HomeFeedResult> {
  const { userId, limit, client } = params;
  const parsed = parseHomeFeedCursor(params.cursor);
  const asOf = parsed.asOf || new Date().toISOString();
  let phase: HomeFeedPhase =
    parsed.version === 2 ? parsed.phase : "member_unseen";
  let createdAt = parsed.version === 2 ? parsed.createdAt || null : null;
  let postId = parsed.version === 2 ? parsed.postId : undefined;
  let relevance = parsed.version === 2 ? parsed.relevance : undefined;
  let helpfulCount = parsed.version === 2 ? parsed.helpfulCount : undefined;

  const posts: HomeFeedPost[] = [];
  const seenIds = new Set<string>();
  const sourceById = new Map<string, Record<string, unknown>>();

  while (posts.length < limit && phase) {
    const need = limit - posts.length;
    const rows = isDiscoveryPhase(phase)
      ? await loadDiscoveryHomeRows(client, {
          userId,
          createdAt,
          postId,
          limit: need,
          seen: seenModeForPhase(phase),
          asOf,
          relevance,
          helpfulCount,
        })
      : await loadMemberHomeRows(client, {
          userId,
          createdAt,
          postId,
          limit: need,
          seen: seenModeForPhase(phase),
          asOf,
        });
    for (const row of rows) sourceById.set(String(row.id), row);
    const hydrated = await hydrateHomeRows(
      client,
      userId,
      rows.filter((row) => !seenIds.has(String(row.id))),
      isDiscoveryPhase(phase)
    );
    for (const post of hydrated) {
      if (seenIds.has(post.id)) continue;
      seenIds.add(post.id);
      posts.push(post);
      if (posts.length === limit) break;
    }

    if (posts.length === limit) break;

    if (rows.length < need) {
      const next = nextFreshnessPhase(phase);
      if (!next) break;
      phase = next;
      createdAt = null;
      postId = undefined;
      relevance = undefined;
      helpfulCount = undefined;
      continue;
    }

    const lastRow = rows[rows.length - 1];
    createdAt = toIsoTimestamp(lastRow.created_at);
    postId = String(lastRow.id);
    relevance =
      lastRow.relevance === undefined || lastRow.relevance === null
        ? undefined
        : Number(lastRow.relevance);
    helpfulCount =
      lastRow.helpful_count === undefined || lastRow.helpful_count === null
        ? undefined
        : Number(lastRow.helpful_count);
  }

  const last = posts[posts.length - 1];
  if (!last || posts.length < limit) {
    return { posts, nextCursor: null };
  }

  const source = sourceById.get(last.id);
  return {
    posts,
    nextCursor: encodeHomeFeedCursorV2({
      phase,
      asOf,
      createdAt: last.createdAt,
      postId: last.id,
      relevance:
        source?.relevance === undefined || source?.relevance === null
          ? undefined
          : Number(source.relevance),
      helpfulCount:
        source?.helpful_count === undefined || source?.helpful_count === null
          ? undefined
          : Number(source.helpful_count),
    }),
  };
}

export async function loadHomeFeed(params: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<HomeFeedResult> {
  const limit = Math.min(params.limit ?? 20, 50);
  const client = await readPool.connect();
  try {
    const freshnessOn =
      homeFeedFreshnessEnabled() &&
      (!params.cursor || !isLegacyHomeCursor(params.cursor));
    return freshnessOn
      ? loadHomeFeedFresh({
          userId: params.userId,
          cursor: params.cursor,
          limit,
          client,
        })
      : loadHomeFeedLegacy({
          userId: params.userId,
          cursor: params.cursor,
          limit,
          client,
        });
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
