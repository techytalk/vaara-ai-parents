import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { syncCircleMembership } from "../src/services/circle-sync.js";

const SOURCE = "566f052f-3afe-47e0-a85a-019dd6f59425"; // Gaudium · Hyderabad unverified
const TARGET = "9d180b76-47c2-44e0-8347-6f692afcc0cd"; // The Gaudium School · Kollur
const REVIEWER = "manual-gaudium-merge";

async function mergeCircle(
  client: PoolClient,
  sourceCircleId: string,
  survivorCircleId: string
) {
  await client.query(
    `UPDATE circle_posts SET circle_id = $2 WHERE circle_id = $1`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(
    `DELETE FROM circle_post_targets a
     USING circle_post_targets b
     WHERE a.circle_id = $1 AND b.circle_id = $2 AND a.post_id = b.post_id`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(
    `UPDATE circle_post_targets SET circle_id = $2 WHERE circle_id = $1`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(
    `DELETE FROM post_shares a
     USING post_shares b
     WHERE a.target_circle_id = $1
       AND b.target_circle_id = $2
       AND a.post_id = b.post_id
       AND a.created_by = b.created_by`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(
    `UPDATE post_shares SET target_circle_id = $2 WHERE target_circle_id = $1`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(
    `DELETE FROM circle_members a
     USING circle_members b
     WHERE a.circle_id = $1 AND b.circle_id = $2 AND a.user_id = b.user_id`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(
    `UPDATE circle_members SET circle_id = $2 WHERE circle_id = $1`,
    [sourceCircleId, survivorCircleId]
  );
  await client.query(`DELETE FROM circles WHERE id = $1`, [sourceCircleId]);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: schools } = await client.query(
      `SELECT id, name, branch, normalized_key, redirect_to_school_id
       FROM schools WHERE id IN ($1, $2) FOR UPDATE`,
      [SOURCE, TARGET]
    );
    if (schools.length !== 2) throw new Error("Expected both schools");
    const source = schools.find((s) => s.id === SOURCE)!;
    const target = schools.find((s) => s.id === TARGET)!;
    if (source.redirect_to_school_id) {
      throw new Error("Source already tombstoned");
    }
    if (target.redirect_to_school_id) {
      throw new Error("Target is a tombstone");
    }

    const { rows: parents } = await client.query(
      `SELECT DISTINCT u.id, u.anonymous_handle, u.email
       FROM children c
       JOIN users u ON u.id = c.user_id
       WHERE c.school_id = $1
       ORDER BY u.anonymous_handle`,
      [SOURCE]
    );
    console.log(
      "moving_parents",
      parents.map((p) => `${p.anonymous_handle}<${p.email}>`)
    );

    const moved = await client.query(
      `UPDATE children SET school_id = $2 WHERE school_id = $1`,
      [SOURCE, TARGET]
    );
    console.log("children_moved", moved.rowCount);

    const { rows: sourceSchoolCircles } = await client.query(
      `SELECT id FROM circles
       WHERE circle_type = 'school' AND metadata->>'school_id' = $1
       FOR UPDATE`,
      [SOURCE]
    );
    const { rows: targetSchoolCircles } = await client.query(
      `SELECT id FROM circles
       WHERE circle_type = 'school' AND metadata->>'school_id' = $1
       FOR UPDATE`,
      [TARGET]
    );
    if (sourceSchoolCircles.length && targetSchoolCircles.length) {
      await mergeCircle(
        client,
        sourceSchoolCircles[0].id,
        targetSchoolCircles[0].id
      );
      console.log("merged_school_circle");
    }

    const { rows: sourceClasses } = await client.query(
      `SELECT id, key, display_name, metadata
       FROM circles
       WHERE circle_type = 'school_class' AND metadata->>'school_id' = $1
       FOR UPDATE`,
      [SOURCE]
    );

    for (const sc of sourceClasses) {
      const curriculumId = sc.metadata?.curriculum_id as string;
      const gradeId = sc.metadata?.grade_id as string;
      const code = sc.metadata?.code as string;
      const gradeCode = sc.metadata?.grade_code as string;

      const { rows: match } = await client.query(
        `SELECT id, display_name FROM circles
         WHERE circle_type = 'school_class'
           AND metadata->>'school_id' = $1
           AND metadata->>'curriculum_id' = $2
           AND metadata->>'grade_id' = $3
         LIMIT 1
         FOR UPDATE`,
        [TARGET, curriculumId, gradeId]
      );

      if (match.length) {
        await mergeCircle(client, sc.id, match[0].id);
        console.log(
          "merged_class",
          sc.display_name,
          "->",
          match[0].display_name
        );
      } else {
        const newKey = `SCHOOL_CLASS_${target.normalized_key}_${code}_${gradeCode}`;
        const parts = String(sc.display_name).split(" · ");
        const boardAndGrade = parts.slice(-2).join(" · ");
        const displayName = `The Gaudium School · Kollur · Hyderabad · ${boardAndGrade}`;

        await client.query(
          `UPDATE circles
           SET key = $2,
               display_name = $3,
               metadata = jsonb_set(
                 jsonb_set(metadata, '{school_id}', to_jsonb($4::text), true),
                 '{normalized_key}', to_jsonb($5::text), true
               )
           WHERE id = $1`,
          [sc.id, newKey, displayName, TARGET, target.normalized_key]
        );
        console.log("rekeyed_class", sc.display_name, "->", displayName);
      }
    }

    await client.query(
      `UPDATE schools
       SET aliases = (
         SELECT ARRAY(SELECT DISTINCT unnest(coalesce(aliases, '{}') || $2::text[]))
       ),
       updated_at = now()
       WHERE id = $1`,
      [TARGET, ["Gaudium", "Gaudium School", "TGS"]]
    );

    await client.query(
      `UPDATE schools
       SET redirect_to_school_id = $2,
           verified = false,
           updated_at = now()
       WHERE id = $1`,
      [SOURCE, TARGET]
    );

    await client.query(
      `INSERT INTO school_merge_ledger
         (source_school_id, survivor_school_id, reviewer, conflict_policy,
          before_counts, status, started_at, completed_at)
       VALUES ($1, $2, $3, '{"reviews":"keep_survivor"}'::jsonb,
               '{}'::jsonb, 'completed', now(), now())`,
      [SOURCE, TARGET, REVIEWER]
    );

    for (const parent of parents) {
      await syncCircleMembership(client, parent.id as string);
      console.log("synced", parent.anonymous_handle);
    }

    await client.query("COMMIT");

    const { rows: verify } = await client.query(
      `SELECT s.name, s.branch,
              s.redirect_to_school_id IS NOT NULL AS tombstoned,
              (SELECT COUNT(*)::int FROM children c WHERE c.school_id = s.id) AS children
       FROM schools s
       WHERE s.id IN ($1, $2)
       ORDER BY s.name`,
      [SOURCE, TARGET]
    );
    console.log("verify", verify);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("FAILED", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
