import type { PoolClient } from "pg";
import { pool } from "@vaara/db";
import { deleteStoredMedia } from "./media-storage.js";

async function collectUserMediaKeys(
  client: PoolClient,
  userId: string
): Promise<string[]> {
  const [posts, listings] = await Promise.all([
    client.query<{ storage_key: string }>(
      `SELECT cpm.storage_key
       FROM circle_post_media cpm
       JOIN circle_posts cp ON cp.id = cpm.post_id
       WHERE cp.author_id = $1`,
      [userId]
    ),
    client.query<{ storage_key: string }>(
      `SELECT lm.storage_key
       FROM listing_media lm
       JOIN listings l ON l.id = lm.listing_id
       WHERE l.seller_id = $1`,
      [userId]
    ),
  ]);

  return [...posts.rows, ...listings.rows].map((row) => row.storage_key);
}

export async function deleteUserAccount(userId: string): Promise<boolean> {
  const client = await pool.connect();
  let mediaKeys: string[] = [];

  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    mediaKeys = await collectUserMediaKeys(client, userId);

    await client.query(
      `UPDATE reports
       SET target_post_id = NULL
       WHERE target_post_id IN (
         SELECT id FROM circle_posts WHERE author_id = $1
       )`,
      [userId]
    );

    await client.query(
      `UPDATE reports
       SET target_listing_id = NULL
       WHERE target_listing_id IN (
         SELECT id FROM listings WHERE seller_id = $1
       )`,
      [userId]
    );

    await client.query(
      `UPDATE reports
       SET target_conversation_id = NULL,
           target_disclosure_conversation_id = NULL
       WHERE target_conversation_id IN (
         SELECT id FROM conversations WHERE user_a_id = $1 OR user_b_id = $1
       )
       OR target_disclosure_conversation_id IN (
         SELECT id FROM conversations WHERE user_a_id = $1 OR user_b_id = $1
       )`,
      [userId]
    );

    await client.query(
      `UPDATE reports SET target_user_id = NULL WHERE target_user_id = $1`,
      [userId]
    );

    await client.query(`DELETE FROM reports WHERE reporter_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await deleteStoredMedia(mediaKeys);
  } catch {
    // Account row is already gone; media cleanup is best-effort.
  }

  return true;
}
