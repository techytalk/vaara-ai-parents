import type { PoolClient } from "pg";
import { publishUserInboxEvent } from "@vaara/redis";
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
    | "school_age"
    | "age_locality"
    | "community";
  key: string;
  displayName: string;
  metadata: Record<string, unknown>;
};

type ChildRow = {
  id: string;
  track: string;
  age_years: number | null;
  experienced_age_years: number | null;
  age_circle_until: Date | string | null;
  curriculum_code: string | null;
  curriculum_name: string | null;
  curriculum_id: string | null;
  grade_id: string | null;
  grade_code: string | null;
  grade_label: string | null;
  school_id: string;
  school_normalized_key: string | null;
  school_name: string;
  school_branch: string | null;
  school_city: string;
};

function ageBandLabel(years: number): string {
  return `${years} years`;
}

function ageKeySuffix(years: number): string {
  return `Y${years}`;
}

function pushCircle(
  desired: DesiredCircle[],
  seenKeys: Set<string>,
  circle: DesiredCircle
) {
  if (seenKeys.has(circle.key)) return;
  seenKeys.add(circle.key);
  desired.push(circle);
}

function effectiveAgeYears(child: ChildRow): number | null {
  if (child.track === "preschool" && child.age_years != null) {
    return child.age_years;
  }
  if (
    child.experienced_age_years != null &&
    child.age_circle_until != null &&
    new Date(child.age_circle_until).getTime() > Date.now()
  ) {
    return child.experienced_age_years;
  }
  return null;
}

function addSchoolCircles(
  desired: DesiredCircle[],
  seenKeys: Set<string>,
  child: ChildRow
) {
  if (
    !child.school_normalized_key ||
    child.school_normalized_key === PLACEHOLDER_SCHOOL_KEY
  ) {
    return;
  }

  const schoolLabel = formatSchoolLabel(
    child.school_name,
    child.school_branch,
    child.school_city
  );

  pushCircle(desired, seenKeys, {
    circleType: "school",
    key: `SCHOOL_${child.school_normalized_key}`,
    displayName: schoolLabel,
    metadata: {
      school_id: child.school_id,
      normalized_key: child.school_normalized_key,
    },
  });

  if (
    child.track === "school" &&
    child.curriculum_code &&
    child.grade_code &&
    child.curriculum_id &&
    child.grade_id
  ) {
    pushCircle(desired, seenKeys, {
      circleType: "school_class",
      key:
        `SCHOOL_CLASS_${child.school_normalized_key}` +
        `_${child.curriculum_code}_${child.grade_code}`,
      displayName: `${schoolLabel} · ${child.curriculum_name} · ${child.grade_label}`,
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

  const ageYears = effectiveAgeYears(child);
  if (ageYears != null) {
    const suffix = ageKeySuffix(ageYears);
    pushCircle(desired, seenKeys, {
      circleType: "school_age",
      key: `SCHOOL_AGE_${child.school_normalized_key}_${suffix}`,
      displayName: `${schoolLabel} · ${ageBandLabel(ageYears)}`,
      metadata: {
        school_id: child.school_id,
        normalized_key: child.school_normalized_key,
        age_years: ageYears,
        experienced: child.track === "school",
      },
    });
  }
}

function addSchoolAgeBoardCircles(
  desired: DesiredCircle[],
  seenKeys: Set<string>,
  child: ChildRow
) {
  if (
    child.track !== "school" ||
    !child.curriculum_code ||
    !child.curriculum_id ||
    !child.grade_code ||
    !child.grade_id
  ) {
    return;
  }

  pushCircle(desired, seenKeys, {
    circleType: "curriculum",
    key: `CURR_${child.curriculum_code}`,
    displayName: `${child.curriculum_name} Parents`,
    metadata: {
      curriculum_id: child.curriculum_id,
      code: child.curriculum_code,
    },
  });

  pushCircle(desired, seenKeys, {
    circleType: "class",
    key: `CLASS_${child.curriculum_code}_${child.grade_code}`,
    displayName: `${child.curriculum_name} · ${child.grade_label}`,
    metadata: {
      curriculum_id: child.curriculum_id,
      grade_id: child.grade_id,
      code: child.curriculum_code,
      grade_code: child.grade_code,
    },
  });
}

function addAgeLocalityCircles(
  desired: DesiredCircle[],
  seenKeys: Set<string>,
  children: ChildRow[],
  loc: {
    country_code: string | null;
    pin_code: string;
    locality: string | null;
  }
) {
  const country = (loc.country_code ?? "IN").trim().toUpperCase() || "IN";
  const pin = loc.pin_code;
  for (const child of children) {
    const ageYears = effectiveAgeYears(child);
    if (ageYears == null) continue;
    const suffix = ageKeySuffix(ageYears);
    pushCircle(desired, seenKeys, {
      circleType: "age_locality",
      key: `AGE_POSTAL_${country}_${pin}_${suffix}`,
      displayName: loc.locality
        ? `${ageBandLabel(ageYears)} · ${pin} · ${loc.locality}`
        : `${ageBandLabel(ageYears)} · ${pin}`,
      metadata: {
        country_code: country,
        pin_code: pin,
        age_years: ageYears,
        experienced: child.track === "school",
      },
    });
  }
}

export async function syncCircleMembership(
  client: PoolClient,
  userId: string
): Promise<void> {
  const userResult = await client.query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'parent'`,
    [userId]
  );
  if (userResult.rows.length === 0) {
    return;
  }

  const childrenResult = await client.query(
    `SELECT ch.id, ch.track, ch.age_years, ch.experienced_age_years, ch.age_circle_until,
            cur.code AS curriculum_code, cur.name AS curriculum_name, cur.id AS curriculum_id,
            g.id AS grade_id, g.code AS grade_code, g.label AS grade_label,
            s.id AS school_id, s.normalized_key AS school_normalized_key,
            s.name AS school_name, s.branch AS school_branch, s.city AS school_city
     FROM children ch
     LEFT JOIN curricula cur ON cur.id = ch.curriculum_id
     LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
     JOIN schools s ON s.id = ch.school_id
     WHERE ch.user_id = $1`,
    [userId]
  );

  const locationResult = await client.query(
    `SELECT country_code, pin_code, locality, community_name, community_key
     FROM user_locations WHERE user_id = $1`,
    [userId]
  );

  const desired: DesiredCircle[] = [];
  const seenKeys = new Set<string>();
  const children = childrenResult.rows as ChildRow[];

  for (const child of children) {
    addSchoolAgeBoardCircles(desired, seenKeys, child);
    addSchoolCircles(desired, seenKeys, child);
  }

  if (locationResult.rows.length > 0) {
    const loc = locationResult.rows[0];
    addAgeLocalityCircles(desired, seenKeys, children, loc);

    const pinKey = `PIN_${loc.pin_code}`;
    pushCircle(desired, seenKeys, {
      circleType: "locality",
      key: pinKey,
      displayName: loc.locality
        ? `${loc.pin_code} · ${loc.locality}`
        : loc.pin_code,
      metadata: {
        pin_code: loc.pin_code,
        country_code: loc.country_code ?? "IN",
      },
    });

    const communityKey =
      loc.community_key ??
      (loc.community_name
        ? normalizeCommunityKey(loc.community_name)
        : null);

    if (communityKey) {
      pushCircle(desired, seenKeys, {
        circleType: "community",
        key: `COMM_${communityKey}`,
        displayName: loc.community_name ?? communityKey,
        metadata: { community_key: communityKey },
      });
    }
  }

  if (desired.length === 0) {
    await client.query(
      `UPDATE circle_membership_periods
       SET left_at = now()
       WHERE user_id = $1 AND left_at IS NULL`,
      [userId]
    );
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

  const leaving = await client.query(
    `DELETE FROM circle_members
     WHERE user_id = $1
       AND circle_id NOT IN (SELECT unnest($2::uuid[]))
     RETURNING circle_id`,
    [userId, circleIds]
  );

  if (leaving.rows.length > 0) {
    await client.query(
      `UPDATE circle_membership_periods
       SET left_at = now()
       WHERE user_id = $1
         AND left_at IS NULL
         AND circle_id = ANY($2::uuid[])`,
      [userId, leaving.rows.map((row) => row.circle_id)]
    );
    await Promise.all(
      leaving.rows.map((row) =>
        publishUserInboxEvent(userId, {
          type: "access.revoked",
          userId,
          circleId: String(row.circle_id),
        })
      )
    );
  }

  for (const row of circlesResult.rows) {
    const inserted = await client.query(
      `INSERT INTO circle_members (circle_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING circle_id`,
      [row.id, userId]
    );
    if ((inserted.rowCount ?? 0) > 0) {
      await client.query(
        `INSERT INTO circle_membership_periods (circle_id, user_id, joined_at, reason)
         VALUES ($1, $2, now(), 'sync')
         ON CONFLICT DO NOTHING`,
        [row.id, userId]
      );
    }
  }
}

export type UserCircleSummary = {
  id: string;
  circleType: string;
  key: string;
  displayName: string;
  metadata: unknown;
  memberCount: number;
  newPostCount: number;
};

export async function listUserCircles(
  client: PoolClient,
  userId: string
): Promise<UserCircleSummary[]> {
  const { rows } = await client.query(
    `SELECT c.id, c.circle_type, c.key, c.display_name, c.metadata,
            (SELECT COUNT(*)::int FROM circle_members WHERE circle_id = c.id) AS member_count,
            COALESCE((
              SELECT COUNT(*)::int
              FROM circle_posts p
              JOIN circle_post_targets pct
                ON pct.post_id = p.id AND pct.circle_id = c.id
              WHERE p.created_at > COALESCE(cm.last_read_at, cm.joined_at)
                AND p.author_id != $1
            ), 0) AS new_post_count
     FROM circle_members cm
     JOIN circles c ON c.id = cm.circle_id
     WHERE cm.user_id = $1
     ORDER BY
       CASE c.circle_type
         WHEN 'school_class' THEN 1
         WHEN 'school_age' THEN 1
         WHEN 'class' THEN 2
         WHEN 'school' THEN 3
         WHEN 'age_locality' THEN 4
         WHEN 'community' THEN 5
         WHEN 'locality' THEN 6
         WHEN 'curriculum' THEN 7
       END,
       c.display_name`,
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    circleType: row.circle_type,
    key: row.key,
    displayName: row.display_name,
    metadata: row.metadata,
    memberCount: row.member_count,
    newPostCount: row.new_post_count,
  }));
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
