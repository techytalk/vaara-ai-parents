import type { PoolClient } from "pg";
import { pool } from "@vaara/db";
import {
  addPostToCircleTimeline,
  enqueueTimelineSync,
  isRedisEnabled,
  removePostFromCircleTimeline,
} from "@vaara/redis";
import { toIsoTimestamp } from "../lib/feed-cursor.js";

export async function insertTimelineOutbox(
  client: PoolClient,
  rows: Array<{
    op: "add" | "remove";
    postId: string;
    circleId: string;
    createdAt?: string | Date | null;
  }>
) {
  if (rows.length === 0 || !isRedisEnabled()) return;
  await client.query(
    `INSERT INTO timeline_outbox (op, post_id, circle_id, post_created_at)
     SELECT *
     FROM unnest($1::text[], $2::uuid[], $3::uuid[], $4::timestamptz[])`,
    [
      rows.map((row) => row.op),
      rows.map((row) => row.postId),
      rows.map((row) => row.circleId),
      rows.map((row) => (row.createdAt ? toIsoTimestamp(row.createdAt) : null)),
    ]
  );
}

export async function markTimelineOutboxProcessed(
  client: PoolClient,
  postId: string,
  circleIds: string[],
  op: "add" | "remove"
) {
  if (circleIds.length === 0) return;
  await client.query(
    `UPDATE timeline_outbox
     SET processed_at = now()
     WHERE post_id = $1
       AND circle_id = ANY($2::uuid[])
       AND op = $3
       AND processed_at IS NULL`,
    [postId, circleIds, op]
  );
}

export async function applyTimelineWrite(params: {
  op: "add" | "remove";
  postId: string;
  circleId: string;
  createdAt?: string | Date | null;
}): Promise<boolean> {
  if (params.op === "remove") {
    return removePostFromCircleTimeline({
      circleId: params.circleId,
      postId: params.postId,
    });
  }
  if (!params.createdAt) return false;
  return addPostToCircleTimeline({
    circleId: params.circleId,
    postId: params.postId,
    createdAt: params.createdAt,
  });
}

export async function applyTimelineWrites(params: {
  op: "add" | "remove";
  postId: string;
  circleIds: string[];
  createdAt?: string | Date | null;
}): Promise<string[]> {
  const failed: string[] = [];
  for (const circleId of params.circleIds) {
    const ok = await applyTimelineWrite({
      op: params.op,
      postId: params.postId,
      circleId,
      createdAt: params.createdAt,
    });
    if (!ok) failed.push(circleId);
  }
  if (failed.length === 0 && isRedisEnabled()) {
    const client = await pool.connect();
    try {
      await markTimelineOutboxProcessed(
        client,
        params.postId,
        params.circleIds,
        params.op
      );
    } finally {
      client.release();
    }
  } else if (failed.length > 0) {
    console.error("[timeline.zadd.fail]", {
      op: params.op,
      postId: params.postId,
      failed,
    });
    await enqueueTimelineSync({ reason: `${params.op}:${params.postId}` });
  }
  return failed;
}

export async function drainTimelineOutbox(limit = 100): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, op, post_id, circle_id, post_created_at
       FROM timeline_outbox
       WHERE processed_at IS NULL
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    let processed = 0;
    for (const row of rows) {
      await client.query(
        `UPDATE timeline_outbox
         SET attempts = attempts + 1
         WHERE id = $1`,
        [row.id]
      );
      const ok = await applyTimelineWrite({
        op: row.op,
        postId: String(row.post_id),
        circleId: String(row.circle_id),
        createdAt: row.post_created_at,
      });
      if (ok) {
        await client.query(
          `UPDATE timeline_outbox
           SET processed_at = now(), last_error = NULL
           WHERE id = $1`,
          [row.id]
        );
        processed += 1;
      } else {
        await client.query(
          `UPDATE timeline_outbox
           SET last_error = $2
           WHERE id = $1`,
          [row.id, "redis write failed"]
        );
        console.error("[timeline.outbox.retry]", {
          id: row.id,
          op: row.op,
          postId: row.post_id,
        });
      }
    }
    await client.query("COMMIT");
    return processed;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
