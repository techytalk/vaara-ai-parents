import type { PoolClient } from "pg";
import { batchCreateNotifications } from "../services/notifications.js";

const MAX_TOPICS_PER_POST = 3;

export type TopicSummary = {
  slug: string;
  name: string;
  category: string | null;
};

export async function resolveTopicSlugs(
  client: PoolClient,
  slugs: string[]
): Promise<{ topicIds: string[]; topics: TopicSummary[] } | { error: string }> {
  const unique = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (unique.length > MAX_TOPICS_PER_POST) {
    return { error: `Up to ${MAX_TOPICS_PER_POST} topics per post` };
  }
  if (unique.length === 0) {
    return { topicIds: [], topics: [] };
  }

  const { rows } = await client.query(
    `SELECT i.slug AS input_slug,
            COALESCE(t_direct.id, t_alias.id) AS id,
            COALESCE(t_direct.slug, t_alias.slug) AS slug,
            COALESCE(t_direct.name, t_alias.name) AS name,
            COALESCE(t_direct.category, t_alias.category) AS category
     FROM unnest($1::text[]) AS i(slug)
     LEFT JOIN topics t_direct ON t_direct.slug = i.slug AND t_direct.active = true
     LEFT JOIN topic_aliases ta ON ta.alias = i.slug
     LEFT JOIN topics t_alias ON t_alias.id = ta.topic_id AND t_alias.active = true`,
    [unique]
  );

  const resolved = new Map<string, { id: string; slug: string; name: string; category: string | null }>();
  for (const row of rows) {
    if (row.id) {
      resolved.set(row.input_slug, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category,
      });
    }
  }

  for (const slug of unique) {
    if (!resolved.has(slug)) {
      return { error: `Unknown topic: ${slug}` };
    }
  }

  const topics = unique.map((slug) => {
    const t = resolved.get(slug)!;
    return { slug: t.slug, name: t.name, category: t.category };
  });
  const topicIds = unique.map((slug) => resolved.get(slug)!.id);

  return { topicIds, topics };
}

export async function attachTopicsToPost(
  client: PoolClient,
  postId: string,
  topicIds: string[]
) {
  if (topicIds.length === 0) return;

  for (const topicId of topicIds) {
    const inserted = await client.query(
      `INSERT INTO post_topics (post_id, topic_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING topic_id`,
      [postId, topicId]
    );
    if (inserted.rows.length > 0) {
      await client.query(
        `UPDATE topics SET post_count = post_count + 1 WHERE id = $1`,
        [topicId]
      );
    }
  }
}

export async function loadTopicsForPosts(
  client: PoolClient,
  postIds: string[]
): Promise<Map<string, TopicSummary[]>> {
  const result = new Map<string, TopicSummary[]>();
  if (postIds.length === 0) return result;

  const { rows } = await client.query(
    `SELECT pt.post_id, t.slug, t.name, t.category
     FROM post_topics pt
     JOIN topics t ON t.id = pt.topic_id
     WHERE pt.post_id = ANY($1::uuid[])
     ORDER BY t.name`,
    [postIds]
  );

  for (const row of rows) {
    const list = result.get(row.post_id) ?? [];
    list.push({ slug: row.slug, name: row.name, category: row.category });
    result.set(row.post_id, list);
  }
  return result;
}

export async function notifyTopicFollowers(
  client: PoolClient,
  params: {
    postId: string;
    authorId: string;
    topicIds: string[];
    preview: string;
  }
) {
  if (params.topicIds.length === 0) return;

  const { rows: followers } = await client.query(
    `SELECT u.id, u.push_token, u.notification_prefs, MIN(t.name) AS topic_name
     FROM topic_follows tf
     JOIN users u ON u.id = tf.user_id
     JOIN topics t ON t.id = tf.topic_id
     WHERE tf.topic_id = ANY($1::uuid[])
       AND tf.user_id <> $2
       AND NOT EXISTS (
         SELECT 1 FROM notification_mutes nm
         WHERE nm.user_id = tf.user_id
           AND nm.scope = 'topic'
           AND nm.scope_id = tf.topic_id
       )
     GROUP BY u.id, u.push_token, u.notification_prefs`,
    [params.topicIds, params.authorId]
  );

  const preview =
    params.preview.length > 80
      ? `${params.preview.slice(0, 80)}…`
      : params.preview;

  await batchCreateNotifications(
    client,
    "topic_digest",
    followers.map((follower) => ({
      userId: follower.id,
      title: `New post in ${follower.topic_name}`,
      body: preview,
      data: { postId: params.postId },
      pushToken: follower.push_token,
      notificationPrefs: follower.notification_prefs,
    })),
    {
      delivery: "digest",
      prefKey: "topics",
    }
  );
}
