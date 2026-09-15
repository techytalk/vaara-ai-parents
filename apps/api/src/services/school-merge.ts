import type { PoolClient } from "pg";
import { syncCircleMembership } from "./circle-sync.js";
import { buildSchoolCatalog } from "./school-catalog.js";

export type DependentCounts = {
  children: number;
  reviews: number;
  feeReports: number;
  questions: number;
  events: number;
  listings: number;
  carpoolOffers: number;
  carpoolArrangements: number;
  schoolCircles: number;
  schoolClassCircles: number;
  circlePosts: number;
  circlePostTargets: number;
  postShares: number;
};

async function countDeps(
  client: PoolClient,
  schoolId: string
): Promise<DependentCounts> {
  const q = async (sql: string, params: unknown[] = [schoolId]) => {
    const { rows } = await client.query(sql, params);
    return Number(rows[0]?.c ?? 0);
  };

  const [
    children,
    reviews,
    feeReports,
    questions,
    events,
    listings,
    carpoolOffers,
    carpoolArrangements,
    schoolCircles,
    schoolClassCircles,
  ] = await Promise.all([
    q(`SELECT count(*)::int AS c FROM children WHERE school_id = $1`),
    q(`SELECT count(*)::int AS c FROM school_reviews WHERE school_id = $1`),
    q(`SELECT count(*)::int AS c FROM school_fee_reports WHERE school_id = $1`),
    q(`SELECT count(*)::int AS c FROM school_questions WHERE school_id = $1`),
    q(`SELECT count(*)::int AS c FROM school_events WHERE school_id = $1`),
    q(`SELECT count(*)::int AS c FROM listings WHERE school_id = $1`),
    q(`SELECT count(*)::int AS c FROM carpool_offers WHERE school_id = $1`),
    q(
      `SELECT count(*)::int AS c FROM carpool_arrangements WHERE school_id = $1`
    ),
    q(
      `SELECT count(*)::int AS c FROM circles
       WHERE circle_type = 'school' AND metadata->>'school_id' = $1`
    ),
    q(
      `SELECT count(*)::int AS c FROM circles
       WHERE circle_type = 'school_class' AND metadata->>'school_id' = $1`
    ),
  ]);

  const { rows: circleIds } = await client.query(
    `SELECT id FROM circles
     WHERE metadata->>'school_id' = $1
       AND circle_type IN ('school', 'school_class')`,
    [schoolId]
  );
  const ids = circleIds.map((r) => r.id as string);
  let circlePosts = 0;
  let circlePostTargets = 0;
  let postShares = 0;
  if (ids.length > 0) {
    circlePosts = await q(
      `SELECT count(*)::int AS c FROM circle_posts WHERE circle_id = ANY($1::uuid[])`,
      [ids]
    );
    circlePostTargets = await q(
      `SELECT count(*)::int AS c FROM circle_post_targets WHERE circle_id = ANY($1::uuid[])`,
      [ids]
    );
    postShares = await q(
      `SELECT count(*)::int AS c FROM post_shares WHERE target_circle_id = ANY($1::uuid[])`,
      [ids]
    );
  }

  return {
    children,
    reviews,
    feeReports,
    questions,
    events,
    listings,
    carpoolOffers,
    carpoolArrangements,
    schoolCircles,
    schoolClassCircles,
    circlePosts,
    circlePostTargets,
    postShares,
  };
}

async function loadSchool(client: PoolClient, id: string) {
  const { rows } = await client.query(
    `SELECT id, name, branch, city, state, pin_code, locality, region, aliases,
            verified, created_by_user_id, redirect_to_school_id, normalized_key
     FROM schools WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function dryRunSchoolMerge(
  client: PoolClient,
  sourceId: string,
  survivorId: string
) {
  if (sourceId === survivorId) {
    throw new Error("Source and survivor must differ");
  }
  const [source, survivor] = await Promise.all([
    loadSchool(client, sourceId),
    loadSchool(client, survivorId),
  ]);
  if (!source || !survivor) throw new Error("School not found");
  if (source.redirect_to_school_id) {
    throw new Error("Source is already a tombstone");
  }
  if (survivor.redirect_to_school_id) {
    throw new Error("Survivor is already a tombstone");
  }

  const [sourceCounts, survivorCounts] = await Promise.all([
    countDeps(client, sourceId),
    countDeps(client, survivorId),
  ]);

  // Review uniqueness conflicts: same author reviewing both schools
  const { rows: reviewConflicts } = await client.query(
    `SELECT a.author_id
     FROM school_reviews a
     JOIN school_reviews b ON a.author_id = b.author_id
     WHERE a.school_id = $1 AND b.school_id = $2`,
    [sourceId, survivorId]
  );

  const { rows: feeConflicts } = await client.query(
    `SELECT a.reporter_id, a.academic_year, a.grade_id
     FROM school_fee_reports a
     JOIN school_fee_reports b
       ON a.reporter_id = b.reporter_id
      AND a.academic_year = b.academic_year
      AND a.grade_id IS NOT DISTINCT FROM b.grade_id
     WHERE a.school_id = $1 AND b.school_id = $2`,
    [sourceId, survivorId]
  );

  const aliasesToAdd = [
    source.name as string,
    ...(Array.isArray(source.aliases) ? (source.aliases as string[]) : []),
  ].filter(Boolean);

  const { rows: parents } = await client.query(
    `SELECT DISTINCT u.id, u.email, u.anonymous_handle
     FROM children c
     JOIN users u ON u.id = c.user_id
     WHERE c.school_id = $1
     ORDER BY u.email`,
    [sourceId]
  );

  return {
    source,
    survivor,
    sourceCounts,
    survivorCounts,
    reviewAuthorConflicts: reviewConflicts.length,
    feeReportConflicts: feeConflicts.length,
    aliasesToAdd,
    parentsMoving: parents.map((p) => ({
      id: p.id,
      email: p.email,
      handle: p.anonymous_handle,
    })),
  };
}

export async function queueSchoolMerge(
  client: PoolClient,
  opts: {
    sourceId: string;
    survivorId: string;
    reviewer: string;
    candidateId?: string | null;
    conflictPolicy?: { reviews?: "keep_survivor" | "keep_newer" | "keep_source" };
  }
) {
  const preview = await dryRunSchoolMerge(
    client,
    opts.sourceId,
    opts.survivorId
  );
  if ((preview.survivor as { redirect_to_school_id?: string | null })
    .redirect_to_school_id) {
    throw new Error("Survivor is already a tombstone");
  }

  const { rows } = await client.query(
    `INSERT INTO school_merge_ledger
       (source_school_id, survivor_school_id, candidate_id, reviewer,
        conflict_policy, before_counts, dry_run_snapshot, status, queued_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, 'queued', now())
     RETURNING id`,
    [
      opts.sourceId,
      opts.survivorId,
      opts.candidateId ?? null,
      opts.reviewer,
      JSON.stringify(opts.conflictPolicy ?? { reviews: "keep_survivor" }),
      JSON.stringify({
        source: preview.sourceCounts,
        survivor: preview.survivorCounts,
      }),
      JSON.stringify(preview),
    ]
  );
  return { ledgerId: rows[0].id as string, preview };
}

export async function processQueuedSchoolMerges(
  client: PoolClient,
  limit = 3
): Promise<{ processed: number; completed: string[]; failed: string[] }> {
  const completed: string[] = [];
  const failed: string[] = [];
  let processed = 0;

  for (let i = 0; i < limit; i++) {
    await client.query("BEGIN");
    let ledgerId: string | null = null;
    try {
      const { rows } = await client.query(
        `SELECT id, source_school_id, survivor_school_id, candidate_id, reviewer, conflict_policy
         FROM school_merge_ledger
         WHERE status = 'queued'
         ORDER BY queued_at ASC NULLS LAST, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );
      if (rows.length === 0) {
        await client.query("COMMIT");
        break;
      }
      const job = rows[0];
      ledgerId = job.id as string;
      processed += 1;
      await client.query(
        `UPDATE school_merge_ledger SET status = 'running', started_at = now() WHERE id = $1`,
        [ledgerId]
      );
      const result = await executeSchoolMerge(client, {
        sourceId: job.source_school_id as string,
        survivorId: job.survivor_school_id as string,
        candidateId: (job.candidate_id as string | null) ?? null,
        reviewer: job.reviewer as string,
        conflictPolicy: (job.conflict_policy as {
          reviews?: "keep_survivor" | "keep_newer" | "keep_source";
        }) ?? { reviews: "keep_survivor" },
        existingLedgerId: ledgerId,
      });
      await client.query("COMMIT");
      completed.push(result.ledgerId);
    } catch (err) {
      await client.query("ROLLBACK");
      if (ledgerId) {
        await client.query(
          `UPDATE school_merge_ledger
           SET status = 'failed',
               error = $2,
               completed_at = now()
           WHERE id = $1`,
          [ledgerId, err instanceof Error ? err.message : String(err)]
        );
        failed.push(ledgerId);
      }
    }
  }

  return { processed, completed, failed };
}

/**
 * Execute a merge: repoint FKs, tombstone source, resync parents, rebuild catalog.
 * Conflict policy for duplicate reviews: 'keep_survivor' | 'keep_newer' | 'keep_source'
 */
export async function executeSchoolMerge(
  client: PoolClient,
  opts: {
    sourceId: string;
    survivorId: string;
    reviewer: string;
    candidateId?: string | null;
    conflictPolicy?: { reviews?: "keep_survivor" | "keep_newer" | "keep_source" };
    existingLedgerId?: string;
  }
) {
  const preview = await dryRunSchoolMerge(
    client,
    opts.sourceId,
    opts.survivorId
  );

  // Lock both rows to prevent concurrent merges into a tombstone.
  const { rows: locked } = await client.query(
    `SELECT id, redirect_to_school_id
     FROM schools
     WHERE id IN ($1, $2)
     FOR UPDATE`,
    [opts.sourceId, opts.survivorId]
  );
  if (locked.length !== 2) throw new Error("School not found");
  const survivorLock = locked.find((r) => r.id === opts.survivorId);
  const sourceLock = locked.find((r) => r.id === opts.sourceId);
  if (sourceLock?.redirect_to_school_id) {
    throw new Error("Source is already a tombstone");
  }
  if (survivorLock?.redirect_to_school_id) {
    throw new Error("Survivor is already a tombstone");
  }

  let ledgerId = opts.existingLedgerId;
  if (!ledgerId) {
    const { rows: ledgerRows } = await client.query(
      `INSERT INTO school_merge_ledger
         (source_school_id, survivor_school_id, candidate_id, reviewer,
          conflict_policy, before_counts, status, started_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'running', now())
       RETURNING id`,
      [
        opts.sourceId,
        opts.survivorId,
        opts.candidateId ?? null,
        opts.reviewer,
        JSON.stringify(opts.conflictPolicy ?? { reviews: "keep_survivor" }),
        JSON.stringify({
          source: preview.sourceCounts,
          survivor: preview.survivorCounts,
        }),
      ]
    );
    ledgerId = ledgerRows[0].id as string;
  }

  try {
    const reviewPolicy = opts.conflictPolicy?.reviews ?? "keep_survivor";

    if (reviewPolicy === "keep_survivor") {
      await client.query(
        `DELETE FROM school_reviews
         WHERE school_id = $1
           AND author_id IN (
             SELECT author_id FROM school_reviews WHERE school_id = $2
           )`,
        [opts.sourceId, opts.survivorId]
      );
    } else if (reviewPolicy === "keep_source") {
      await client.query(
        `DELETE FROM school_reviews
         WHERE school_id = $2
           AND author_id IN (
             SELECT author_id FROM school_reviews WHERE school_id = $1
           )`,
        [opts.sourceId, opts.survivorId]
      );
    } else {
      await client.query(
        `DELETE FROM school_reviews sr
         USING school_reviews other
         WHERE sr.school_id = $1
           AND other.school_id = $2
           AND sr.author_id = other.author_id
           AND sr.updated_at <= other.updated_at`,
        [opts.sourceId, opts.survivorId]
      );
      await client.query(
        `DELETE FROM school_reviews sr
         USING school_reviews other
         WHERE sr.school_id = $2
           AND other.school_id = $1
           AND sr.author_id = other.author_id
           AND sr.updated_at < other.updated_at`,
        [opts.sourceId, opts.survivorId]
      );
    }

    // Fee report uniqueness: keep survivor on conflict.
    await client.query(
      `DELETE FROM school_fee_reports a
       USING school_fee_reports b
       WHERE a.school_id = $1
         AND b.school_id = $2
         AND a.reporter_id = b.reporter_id
         AND a.academic_year = b.academic_year
         AND a.grade_id IS NOT DISTINCT FROM b.grade_id`,
      [opts.sourceId, opts.survivorId]
    );

    await client.query(
      `UPDATE children SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE school_reviews SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE school_fee_reports SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE school_questions SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE school_events SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE listings SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE carpool_offers SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );
    await client.query(
      `UPDATE carpool_arrangements SET school_id = $2 WHERE school_id = $1`,
      [opts.sourceId, opts.survivorId]
    );

    // Prefer consolidating into an existing survivor circle with the same type + key family.
    const { rows: sourceCircles } = await client.query(
      `SELECT id, circle_type, key, display_name, metadata
       FROM circles
       WHERE metadata->>'school_id' = $1
         AND circle_type IN ('school', 'school_class')
       FOR UPDATE`,
      [opts.sourceId]
    );
    const affectedCircleIds: string[] = [];

    for (const sourceCircle of sourceCircles) {
      const sourceKey = String(sourceCircle.key);
      // Survivor school circles use SCHOOL_<normalized_key> — look up by school_id metadata.
      const { rows: survivors } = await client.query(
        `SELECT id, key FROM circles
         WHERE circle_type = $1
           AND metadata->>'school_id' = $2
         LIMIT 1
         FOR UPDATE`,
        [sourceCircle.circle_type, opts.survivorId]
      );

      if (survivors.length > 0) {
        const survivorCircleId = survivors[0].id as string;
        affectedCircleIds.push(sourceCircle.id as string, survivorCircleId);

        await client.query(
          `UPDATE circle_posts SET circle_id = $2 WHERE circle_id = $1`,
          [sourceCircle.id, survivorCircleId]
        );
        // Drop duplicate targets/shares that already exist on survivor.
        await client.query(
          `DELETE FROM circle_post_targets a
           USING circle_post_targets b
           WHERE a.circle_id = $1
             AND b.circle_id = $2
             AND a.post_id = b.post_id`,
          [sourceCircle.id, survivorCircleId]
        );
        await client.query(
          `UPDATE circle_post_targets SET circle_id = $2 WHERE circle_id = $1`,
          [sourceCircle.id, survivorCircleId]
        );
        await client.query(
          `DELETE FROM post_shares a
           USING post_shares b
           WHERE a.target_circle_id = $1
             AND b.target_circle_id = $2
             AND a.post_id = b.post_id
             AND a.user_id = b.user_id`,
          [sourceCircle.id, survivorCircleId]
        );
        await client.query(
          `UPDATE post_shares SET target_circle_id = $2 WHERE target_circle_id = $1`,
          [sourceCircle.id, survivorCircleId]
        );
        await client.query(
          `DELETE FROM circle_members a
           USING circle_members b
           WHERE a.circle_id = $1
             AND b.circle_id = $2
             AND a.user_id = b.user_id`,
          [sourceCircle.id, survivorCircleId]
        );
        await client.query(
          `UPDATE circle_members SET circle_id = $2 WHERE circle_id = $1`,
          [sourceCircle.id, survivorCircleId]
        );
        await client.query(`DELETE FROM circles WHERE id = $1`, [
          sourceCircle.id,
        ]);
      } else {
        affectedCircleIds.push(sourceCircle.id as string);
        await client.query(
          `UPDATE circles
           SET metadata = jsonb_set(metadata, '{school_id}', to_jsonb($2::text), true)
           WHERE id = $1`,
          [sourceCircle.id, opts.survivorId]
        );
      }
      void sourceKey;
    }

    await client.query(
      `UPDATE schools
       SET aliases = (
             SELECT ARRAY(
               SELECT DISTINCT unnest(
                 coalesce(aliases, '{}') || $2::text[]
               )
             )
           ),
           updated_at = now()
       WHERE id = $1`,
      [opts.survivorId, preview.aliasesToAdd]
    );

    await client.query(
      `UPDATE schools
       SET redirect_to_school_id = $2,
           verified = false,
           updated_at = now()
       WHERE id = $1`,
      [opts.sourceId, opts.survivorId]
    );

    // Refresh rating aggregates after review moves.
    for (const schoolId of [opts.sourceId, opts.survivorId]) {
      await client.query(
        `UPDATE schools s SET
           rating_count = sub.count,
           rating_avg = sub.avg,
           updated_at = now()
         FROM (
           SELECT COUNT(*)::int AS count, AVG(rating)::numeric(3,2) AS avg
           FROM school_reviews
           WHERE school_id = $1 AND hidden = false
         ) sub
         WHERE s.id = $1`,
        [schoolId]
      );
    }

    for (const parent of preview.parentsMoving) {
      await syncCircleMembership(client, parent.id as string);
    }

    if (opts.candidateId) {
      await client.query(
        `UPDATE school_duplicate_candidates
         SET status = 'merged', decided_by = $2, decided_at = now()
         WHERE id = $1`,
        [opts.candidateId, opts.reviewer]
      );
    }

    const afterSource = await countDeps(client, opts.sourceId);
    const afterSurvivor = await countDeps(client, opts.survivorId);

    await client.query(
      `UPDATE school_merge_ledger
       SET status = 'completed',
           after_counts = $2::jsonb,
           affected_circle_ids = $3::uuid[],
           completed_at = now()
       WHERE id = $1`,
      [
        ledgerId,
        JSON.stringify({ source: afterSource, survivor: afterSurvivor }),
        affectedCircleIds,
      ]
    );

    await buildSchoolCatalog(client);

    return { ledgerId, affectedCircleIds, preview };
  } catch (err) {
    // Caller owns transaction rollback; mark failed only when we own the ledger insert.
    if (!opts.existingLedgerId) {
      await client.query(
        `UPDATE school_merge_ledger
         SET status = 'failed', error = $2, completed_at = now()
         WHERE id = $1`,
        [ledgerId, err instanceof Error ? err.message : String(err)]
      );
    }
    throw err;
  }
}

export async function refreshAffinityViews(client: PoolClient): Promise<void> {
  await client.query(
    `REFRESH MATERIALIZED VIEW CONCURRENTLY school_pin_affinity`
  );
  await client.query(
    `REFRESH MATERIALIZED VIEW CONCURRENTLY school_region_affinity`
  );
}

export async function listDuplicateCandidates(
  client: PoolClient,
  status = "open"
) {
  const { rows } = await client.query(
    `SELECT c.id, c.score, c.status, c.admin_note, c.created_at,
            a.id AS a_id, a.name AS a_name, a.branch AS a_branch, a.city AS a_city,
            a.locality AS a_locality, a.verified AS a_verified,
            b.id AS b_id, b.name AS b_name, b.branch AS b_branch, b.city AS b_city,
            b.locality AS b_locality, b.verified AS b_verified,
            (SELECT count(*)::int FROM children ch WHERE ch.school_id = a.id) AS a_parents,
            (SELECT count(*)::int FROM children ch WHERE ch.school_id = b.id) AS b_parents
     FROM school_duplicate_candidates c
     JOIN schools a ON a.id = c.school_a_id
     JOIN schools b ON b.id = c.school_b_id
     WHERE c.status = $1
     ORDER BY c.score DESC, c.created_at DESC
     LIMIT 100`,
    [status]
  );
  return rows;
}
