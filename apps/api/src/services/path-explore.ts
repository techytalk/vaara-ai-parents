import type { PoolClient } from "pg";
import { createThread, publishChatNudge } from "./chat.js";
import { syncCircleMembership } from "./circle-sync.js";

export type ExploreNode = {
  id: string;
  slug: string;
  parentId: string | null;
  kind: string;
  title: string;
  kicker: string | null;
  summary: string | null;
  lead: string | null;
  depth: number;
  hasChildren: boolean;
  allowAsk: boolean;
  allowDiscussions: boolean;
  pathwayItemSlug: string | null;
  askPrompt: string | null;
};

type NodeRow = {
  id: string;
  slug: string;
  parent_id: string | null;
  kind: string;
  title: string;
  kicker: string | null;
  summary: string | null;
  lead: string | null;
  depth: number;
  allow_ask: boolean;
  allow_discussions: boolean;
  pathway_item_slug: string | null;
  ask_prompt_default: string | null;
};

export async function matchExploreRoot(
  client: PoolClient,
  input: {
    family: string;
    curriculumCode: string;
    gradeCode: string | null;
    stage: string;
    includeAfter10Fork: boolean;
  }
): Promise<{ id: string; label: string } | null> {
  const { rows } = await client.query(
    `SELECT r.root_node_id AS id, r.label,
            (
              CASE
                WHEN cardinality(r.curriculum_codes) > 0
                  AND $2 = ANY(r.curriculum_codes) THEN 8 ELSE 0
              END
              + CASE
                WHEN cardinality(r.grade_codes) > 0
                  AND $3 = ANY(r.grade_codes) THEN 4 ELSE 0
              END
              + CASE
                WHEN cardinality(r.board_families) > 0
                  AND $1 = ANY(r.board_families) THEN 2 ELSE 0
              END
              + CASE WHEN r.include_after_10_fork = $5 THEN 1 ELSE 0 END
            ) AS score
     FROM path_node_roots r
     WHERE r.status = 'published'
       AND $4 = ANY(r.stage_ids)
       AND (cardinality(r.board_families) = 0 OR $1 = ANY(r.board_families))
       AND (cardinality(r.curriculum_codes) = 0 OR $2 = ANY(r.curriculum_codes))
       AND (cardinality(r.grade_codes) = 0 OR $3 = ANY(r.grade_codes))
     ORDER BY score DESC, r.sort_order ASC, r.id ASC
     LIMIT 1`,
    [
      input.family,
      input.curriculumCode,
      input.gradeCode,
      input.stage,
      input.includeAfter10Fork,
    ]
  );
  const row = rows[0];
  if (!row || Number(row.score) < 4) return null;
  return { id: String(row.id), label: String(row.label) };
}

export async function loadExploreNodes(
  client: PoolClient,
  rootId: string,
  stateCode: string | null
): Promise<ExploreNode[]> {
  const { rows } = await client.query<NodeRow>(
    `WITH RECURSIVE tree AS (
       SELECT n.id, n.slug, n.parent_id, n.kind, n.title, n.kicker, n.summary, n.lead,
              n.allow_ask, n.allow_discussions, n.pathway_item_slug,
              n.ask_prompt_default, n.sort_order, n.state_codes,
              n.board_families, 0 AS depth, ARRAY[n.sort_order] AS ord
       FROM path_nodes n
       WHERE n.id = $1 AND n.status = 'published'
       UNION ALL
       SELECT c.id, c.slug, c.parent_id, c.kind, c.title, c.kicker, c.summary, c.lead,
              c.allow_ask, c.allow_discussions, c.pathway_item_slug,
              c.ask_prompt_default, c.sort_order, c.state_codes,
              c.board_families, t.depth + 1, t.ord || c.sort_order
       FROM path_nodes c
       JOIN tree t ON c.parent_id = t.id
       WHERE c.status = 'published'
         AND (
           cardinality(c.state_codes) = 0
           OR ($2::text IS NOT NULL AND $2 = ANY(c.state_codes))
         )
     )
     SELECT id, slug, parent_id, kind, title, kicker, summary, lead,
            allow_ask, allow_discussions, pathway_item_slug,
            ask_prompt_default, depth
     FROM tree
     ORDER BY ord`,
    [rootId, stateCode]
  );
  const childCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    childCounts.set(row.parent_id, (childCounts.get(row.parent_id) ?? 0) + 1);
  }
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    parentId: row.parent_id,
    kind: row.kind,
    title: row.title,
    kicker: row.kicker,
    summary: row.summary,
    lead: row.lead,
    depth: row.depth,
    hasChildren: (childCounts.get(row.id) ?? 0) > 0,
    allowAsk: row.allow_ask,
    allowDiscussions: row.allow_discussions,
    pathwayItemSlug: row.pathway_item_slug,
    askPrompt: row.ask_prompt_default,
  }));
}

export async function findCurriculumCircle(
  client: PoolClient,
  userId: string,
  curriculumCode: string
): Promise<{ id: string; displayName: string } | null> {
  await syncCircleMembership(client, userId);
  const { rows } = await client.query(
    `SELECT c.id, c.display_name
     FROM circles c
     JOIN circle_members cm ON cm.circle_id = c.id AND cm.user_id = $1
     WHERE c.circle_type = 'curriculum'
       AND c.key = $2
     LIMIT 1`,
    [userId, `CURR_${curriculumCode}`]
  );
  if (!rows[0]) return null;
  return {
    id: String(rows[0].id),
    displayName: String(rows[0].display_name),
  };
}

export async function listPathDiscussions(
  client: PoolClient,
  userId: string,
  nodeId: string
) {
  const { rows } = await client.query(
    `SELECT l.circle_id, c.display_name, l.message_id, l.thread_id,
            m.body, m.created_at,
            COALESCE(t.reply_count, 0) AS reply_count,
            COALESCE(t.last_message_at, m.created_at) AS activity_at
     FROM path_discussion_links l
     JOIN circle_messages m ON m.id = l.message_id AND m.circle_id = l.circle_id
     JOIN circles c ON c.id = l.circle_id
     JOIN circle_members cm ON cm.circle_id = l.circle_id AND cm.user_id = $1
     LEFT JOIN circle_threads t ON t.id = l.thread_id AND t.circle_id = l.circle_id
     WHERE l.path_node_id = $2
       AND m.status = 'visible'
       AND (t.id IS NULL OR t.status <> 'deleted')
     ORDER BY COALESCE(t.last_message_at, m.created_at) DESC
     LIMIT 30`,
    [userId, nodeId]
  );
  return rows.map((row) => {
    const threadId = row.thread_id ? String(row.thread_id) : null;
    const body = typeof row.body === "string" ? row.body.trim() : "";
    return {
      circleId: String(row.circle_id),
      circleName: String(row.display_name),
      messageId: String(row.message_id),
      threadId,
      openAs: threadId ? ("thread" as const) : ("message" as const),
      preview: body.slice(0, 180),
      replyCount: Number(row.reply_count) || 0,
      activityAt: row.activity_at,
    };
  });
}

export async function askOnPathNode(
  client: PoolClient,
  input: {
    userId: string;
    nodeId: string;
    body: string;
    curriculumCode: string;
  }
): Promise<
  | {
      circleId: string;
      circleName: string;
      messageId: string;
      threadId: string;
      openAs: "thread";
    }
  | { error: string; status: number }
> {
  const node = await client.query(
    `SELECT id, title, allow_ask, status
     FROM path_nodes WHERE id = $1`,
    [input.nodeId]
  );
  if (!node.rows[0] || node.rows[0].status !== "published") {
    return { error: "This path is not available", status: 404 };
  }
  if (!node.rows[0].allow_ask) {
    return { error: "Questions are not open on this row", status: 400 };
  }
  const circle = await findCurriculumCircle(
    client,
    input.userId,
    input.curriculumCode
  );
  if (!circle) {
    return {
      error: "Join your board circle before asking. Exploring does not add you to another board.",
      status: 400,
    };
  }
  const text = input.body.trim();
  if (!text) return { error: "Write a question first", status: 400 };
  const title = String(node.rows[0].title).slice(0, 140);
  const created = await createThread({
    client,
    userId: input.userId,
    circleId: circle.id,
    title,
    body: text,
    kind: "question",
  });
  if ("error" in created) return created;
  const threadId = String(created.thread.id);
  const messageId = created.thread.root_message_id
    ? String(created.thread.root_message_id)
    : "";
  if (!messageId) {
    return { error: "Could not save the question", status: 500 };
  }
  await client.query(
    `INSERT INTO path_discussion_links (path_node_id, circle_id, message_id, thread_id)
     VALUES ($1, $2, $3, $4)`,
    [input.nodeId, circle.id, messageId, threadId]
  );
  return {
    circleId: circle.id,
    circleName: circle.displayName,
    messageId,
    threadId,
    openAs: "thread",
  };
}

export async function nudgePathThread(result: {
  circleId: string;
  threadId: string;
  authorId: string;
}) {
  await publishChatNudge({
    circleId: result.circleId,
    threadId: result.threadId,
    authorId: result.authorId,
  });
}
