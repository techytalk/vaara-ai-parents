import type { PoolClient } from "pg";
import { normalizeCommunityKey } from "../lib/community.js";
import { formatSchoolLabel } from "../lib/school.js";

const PLACEHOLDER_SCHOOL_KEY = "school_not_specified||unknown";

type DesiredCircle = {
  circleType:
    | "curriculum"
    | "locality"
    | "class"
    | "school"
    | "school_class"
    | "community";
  key: string;
  displayName: string;
  metadata: Record<string, unknown>;
};

export async function syncCircleMembership(
  client: PoolClient,
  userId: string
): Promise<void> {
  const userResult = await client.query(
    "SELECT role FROM users WHERE id = $1",
    [userId]
  );
  if (userResult.rows.length === 0 || userResult.rows[0].role !== "parent") {
    return;
  }

  const childrenResult = await client.query(
    `SELECT ch.id, cur.code AS curriculum_code, cur.name AS curriculum_name, cur.id AS curriculum_id,
            g.id AS grade_id, g.code AS grade_code, g.label AS grade_label,
            s.id AS school_id, s.normalized_key AS school_normalized_key,
            s.name AS school_name, s.branch AS school_branch, s.city AS school_city
     FROM children ch
     JOIN curricula cur ON cur.id = ch.curriculum_id
     JOIN curriculum_grades g ON g.id = ch.grade_id
     JOIN schools s ON s.id = ch.school_id
     WHERE ch.user_id = $1`,
    [userId]
  );

  const locationResult = await client.query(
    `SELECT pin_code, locality, community_name, community_key
     FROM user_locations WHERE user_id = $1`,
    [userId]
  );

  const desired: DesiredCircle[] = [];
  const seenKeys = new Set<string>();

  for (const child of childrenResult.rows) {
    const key = `CURR_${child.curriculum_code}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      desired.push({
        circleType: "curriculum",
        key,
        displayName: `${child.curriculum_name} Parents`,
        metadata: {
          curriculum_id: child.curriculum_id,
          code: child.curriculum_code,
        },
      });
    }

    const classKey = `CLASS_${child.curriculum_code}_${child.grade_code}`;
    if (!seenKeys.has(classKey)) {
      seenKeys.add(classKey);
      desired.push({
        circleType: "class",
        key: classKey,
        displayName: `${child.curriculum_name} · ${child.grade_label}`,
        metadata: {
          curriculum_id: child.curriculum_id,
          grade_id: child.grade_id,
          code: child.curriculum_code,
          grade_code: child.grade_code,
        },
      });
    }

    if (
      child.school_normalized_key &&
      child.school_normalized_key !== PLACEHOLDER_SCHOOL_KEY
    ) {
      const schoolKey = `SCHOOL_${child.school_normalized_key}`;
      if (!seenKeys.has(schoolKey)) {
        seenKeys.add(schoolKey);
        desired.push({
          circleType: "school",
          key: schoolKey,
          displayName: formatSchoolLabel(
            child.school_name,
            child.school_branch,
            child.school_city
          ),
          metadata: {
            school_id: child.school_id,
            normalized_key: child.school_normalized_key,
          },
        });
      }

      const schoolClassKey =
        `SCHOOL_CLASS_${child.school_normalized_key}` +
        `_${child.curriculum_code}_${child.grade_code}`;
      if (!seenKeys.has(schoolClassKey)) {
        seenKeys.add(schoolClassKey);
        desired.push({
          circleType: "school_class",
          key: schoolClassKey,
          displayName:
            `${formatSchoolLabel(
              child.school_name,
              child.school_branch,
              child.school_city
            )} · ${child.curriculum_name} · ${child.grade_label}`,
          metadata: {
            school_id: child.school_id,
            normalized_key: child.school_normalized_key,
            curriculum_id: child.curriculum_id,
            grade_id: child.grade_id,
            code: child.curriculum_code,
            grade_code: child.grade_code,
          },
        });
      }
    }
  }

  if (locationResult.rows.length > 0) {
    const loc = locationResult.rows[0];
    const pinKey = `PIN_${loc.pin_code}`;
    if (!seenKeys.has(pinKey)) {
      seenKeys.add(pinKey);
      desired.push({
        circleType: "locality",
        key: pinKey,
        displayName: loc.locality
          ? `${loc.pin_code} · ${loc.locality}`
          : loc.pin_code,
        metadata: { pin_code: loc.pin_code },
      });
    }

    const communityKey =
      loc.community_key ??
      (loc.community_name
        ? normalizeCommunityKey(loc.community_name)
        : null);

    if (communityKey) {
      const commKey = `COMM_${communityKey}`;
      if (!seenKeys.has(commKey)) {
        seenKeys.add(commKey);
        desired.push({
          circleType: "community",
          key: commKey,
          displayName: loc.community_name ?? communityKey,
          metadata: { community_key: communityKey },
        });
      }
    }
  }

  if (desired.length === 0) {
    await client.query("DELETE FROM circle_members WHERE user_id = $1", [userId]);
    return;
  }

  for (const circle of desired) {
    await client.query(
      `INSERT INTO circles (circle_type, key, display_name, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         metadata = EXCLUDED.metadata`,
      [
        circle.circleType,
        circle.key,
        circle.displayName,
        JSON.stringify(circle.metadata),
      ]
    );
  }

  const keys = desired.map((d) => d.key);
  const circlesResult = await client.query(
    `SELECT id, key FROM circles WHERE key = ANY($1::text[])`,
    [keys]
  );

  const circleIds = circlesResult.rows.map((r) => r.id);

  await client.query(
    `DELETE FROM circle_members
     WHERE user_id = $1
       AND circle_id NOT IN (SELECT unnest($2::uuid[]))`,
    [userId, circleIds]
  );

  for (const row of circlesResult.rows) {
    await client.query(
      `INSERT INTO circle_members (circle_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [row.id, userId]
    );
  }
}

export async function evaluateOnboardingComplete(
  client: PoolClient,
  userId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM children WHERE user_id = $1) AS has_children,
       EXISTS (SELECT 1 FROM user_locations WHERE user_id = $1) AS has_location`,
    [userId]
  );
  return rows[0]?.has_children && rows[0]?.has_location;
}
