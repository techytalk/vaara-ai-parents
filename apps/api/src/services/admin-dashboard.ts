import type { PoolClient } from "pg";

const TEST_EMAIL = `(
  u.email ILIKE '%@vaara.test'
  OR u.email ILIKE '%@example.com'
  OR u.email ILIKE '%@test.com'
  OR u.email ILIKE '%cloudtestlabaccounts.com'
  OR u.email ILIKE 'speedtest.%'
)`;

const REAL_PARENT = `u.role = 'parent'
  AND COALESCE(u.is_internal, false) IS NOT TRUE
  AND NOT ${TEST_EMAIL}`;

const PLACEHOLDER_SCHOOL = "school_not_specified||unknown";

export async function getAdminDashboard(client: PoolClient) {
  const [
    today,
    week,
    recentDays,
    chatTotals,
    circleActivity,
    unverifiedCount,
    unverifiedSchools,
    topSchools,
  ] = await Promise.all([
    client.query(
      `WITH day AS (
         SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS d
       )
       SELECT
         day.d::text AS date,
         COUNT(u.id)::int AS total,
         COUNT(u.id) FILTER (WHERE u.onboarding_complete IS TRUE)::int AS complete,
         COUNT(u.id) FILTER (
           WHERE u.id IS NOT NULL AND COALESCE(u.onboarding_complete, false) IS FALSE
         )::int AS incomplete
       FROM day
       LEFT JOIN users u
         ON ${REAL_PARENT}
        AND (u.created_at AT TIME ZONE 'Asia/Kolkata')::date = day.d
       GROUP BY day.d`
    ),
    client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE onboarding_complete IS TRUE)::int AS complete,
         COUNT(*) FILTER (WHERE COALESCE(onboarding_complete, false) IS FALSE)::int AS incomplete
       FROM users u
       WHERE ${REAL_PARENT}
         AND u.created_at >= (now() AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata'
                             - interval '6 days'`
    ),
    client.query(
      `SELECT
         (created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS date,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE onboarding_complete IS TRUE)::int AS complete,
         COUNT(*) FILTER (WHERE COALESCE(onboarding_complete, false) IS FALSE)::int AS incomplete
       FROM users u
       WHERE ${REAL_PARENT}
         AND created_at >= (now() AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata'
                         - interval '6 days'
       GROUP BY 1
       ORDER BY 1 DESC`
    ),
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE m.thread_id IS NULL)::int AS messages,
         COUNT(*) FILTER (WHERE m.thread_id IS NOT NULL)::int AS replies,
         COUNT(*) FILTER (
           WHERE m.created_at >= now() - interval '24 hours'
         )::int AS last_24h
       FROM circle_messages m
       LEFT JOIN users u ON u.id = m.author_id
       WHERE m.status = 'visible'
         AND m.created_at >= now() - interval '7 days'
         AND (u.id IS NULL OR (${REAL_PARENT}))`
    ),
    client.query(
      `SELECT
         c.id,
         c.display_name,
         c.circle_type::text AS circle_type,
         COUNT(*) FILTER (WHERE m.thread_id IS NULL)::int AS messages,
         COUNT(*) FILTER (WHERE m.thread_id IS NOT NULL)::int AS replies,
         COUNT(*) FILTER (
           WHERE m.created_at >= now() - interval '24 hours'
         )::int AS last_24h,
         to_char(
           MAX(m.created_at) AT TIME ZONE 'Asia/Kolkata',
           'YYYY-MM-DD HH24:MI'
         ) AS last_ist
       FROM circle_messages m
       JOIN circles c ON c.id = m.circle_id
       LEFT JOIN users u ON u.id = m.author_id
       WHERE m.status = 'visible'
         AND m.created_at >= now() - interval '7 days'
         AND (u.id IS NULL OR (${REAL_PARENT}))
       GROUP BY c.id
       ORDER BY MAX(m.created_at) DESC
       LIMIT 12`
    ),
    client.query(
      `SELECT COUNT(*)::int AS total
       FROM schools s
       WHERE s.verified = false
         AND s.redirect_to_school_id IS NULL
         AND s.normalized_key <> $1`,
      [PLACEHOLDER_SCHOOL]
    ),
    client.query(
      `SELECT
         s.id,
         s.name,
         s.branch,
         s.city,
         s.locality,
         to_char(s.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS created_ist,
         COUNT(DISTINCT ch.user_id) FILTER (WHERE u.id IS NOT NULL)::int AS parent_count
       FROM schools s
       LEFT JOIN children ch ON ch.school_id = s.id
       LEFT JOIN users u ON u.id = ch.user_id AND (${REAL_PARENT})
       WHERE s.verified = false
         AND s.redirect_to_school_id IS NULL
         AND s.normalized_key <> $1
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 8`,
      [PLACEHOLDER_SCHOOL]
    ),
    client.query(
      `SELECT
         s.id,
         s.name,
         s.branch,
         s.city,
         s.verified,
         COUNT(DISTINCT ch.user_id)::int AS parent_count
       FROM schools s
       JOIN children ch ON ch.school_id = s.id
       JOIN users u ON u.id = ch.user_id AND (${REAL_PARENT})
       WHERE s.redirect_to_school_id IS NULL
         AND s.normalized_key <> $1
       GROUP BY s.id
       ORDER BY parent_count DESC, s.name
       LIMIT 4`,
      [PLACEHOLDER_SCHOOL]
    ),
  ]);

  return {
    timezone: "Asia/Kolkata",
    signups: {
      today: today.rows[0] ?? {
        date: null,
        total: 0,
        complete: 0,
        incomplete: 0,
      },
      last7Days: week.rows[0] ?? { total: 0, complete: 0, incomplete: 0 },
      recentDays: recentDays.rows,
    },
    chat: {
      last7Days: chatTotals.rows[0] ?? { messages: 0, replies: 0, last_24h: 0 },
      circles: circleActivity.rows,
    },
    schools: {
      unverifiedTotal: Number(unverifiedCount.rows[0]?.total ?? 0),
      unverified: unverifiedSchools.rows,
      topByParents: topSchools.rows,
    },
  };
}
