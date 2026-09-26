import { Hono } from "hono";
import { pool } from "@vaara/db";
import { normalizeCommunityKey } from "../lib/community.js";
import { formatSchoolLabel } from "../lib/school.js";
import {
  evaluateOnboardingComplete,
  listUserCircles,
  syncCircleMembership,
} from "../services/circle-sync.js";
import { togglePostHelpful } from "../services/feed.js";
import {
  parseImpressionPostIds,
  recordHomeFeedImpressions,
} from "../services/feed-impressions.js";
import { loadHomeFeedResolved } from "../services/feed-timeline.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  mergeNotificationPrefs,
  type NotificationPrefs,
} from "../lib/notification-prefs.js";
import { isValidAvatarKey, resolveAvatarKey } from "../lib/avatar.js";
import { parseReportReason } from "../lib/report-reasons.js";
import {
  formatChildDateOfBirth,
  parseChildDateOfBirth,
} from "../lib/child-dob.js";
import { deleteUserAccount } from "../lib/account-deletion.js";
import {
  getIdempotentResponse,
  reserveIdempotencyKey,
  storeIdempotentResponse,
} from "../lib/idempotency.js";
import { listUserRoles } from "../lib/user-roles.js";
import { lookupPostalCode } from "../lib/postal-code/index.js";
import {
  recordOnboardingGeoLocation,
  recordOnboardingGeoSchool,
} from "../lib/onboarding-geo.js";
import {
  familyPageKey,
  getCachedJson,
  invalidateFamilyPage,
  PAGE_CACHE_TTL,
  setCachedJson,
} from "@vaara/redis";
import {
  fetchAuthUserLuckyGiftContext,
  getLuckyGiftForUser,
  scratchLuckyGift,
  submitLuckyGiftPhone,
} from "../services/lucky-gift.js";
import { sendParentBlockedAlert } from "../lib/safety-alert.js";

const CHILD_SELECT = `
  ch.id, ch.nickname, ch.gender, ch.date_of_birth, ch.curriculum_id, ch.grade_id, ch.school_id,
  ch.track, ch.age_years, ch.age_confirmed_at, ch.experienced_age_years, ch.age_circle_until,
  ch.pathway_lean,
  cur.code AS curriculum_code, cur.name AS curriculum_name,
  g.code AS grade_code, g.label AS grade_label,
  s.name AS school_name, s.branch AS school_branch, s.city AS school_city,
  s.state AS school_state, s.pin_code AS school_pin_code, s.verified AS school_verified,
  s.normalized_key AS school_normalized_key, s.kind AS school_kind,
  s.offers_preschool AS school_offers_preschool
`;

function mapChild(row: Record<string, unknown>) {
  const schoolName = row.school_name as string;
  const schoolCity = row.school_city as string;
  const schoolBranch = row.school_branch as string | null;
  const track = (row.track as string) === "preschool" ? "preschool" : "school";
  const ageYears =
    row.age_years == null ? null : Number(row.age_years);
  const experiencedAgeYears =
    row.experienced_age_years == null
      ? null
      : Number(row.experienced_age_years);

  return {
    id: row.id,
    nickname: row.nickname,
    gender: row.gender,
    dateOfBirth: formatChildDateOfBirth(row.date_of_birth),
    track,
    ageYears,
    ageConfirmedAt: row.age_confirmed_at
      ? new Date(row.age_confirmed_at as string | Date).toISOString()
      : null,
    experiencedAgeYears,
    ageCircleUntil: row.age_circle_until
      ? new Date(row.age_circle_until as string | Date).toISOString()
      : null,
    pathwayLean: (row.pathway_lean as string | null) ?? null,
    curriculumId: row.curriculum_id,
    gradeId: row.grade_id,
    schoolId: row.school_id,
    curriculum:
      row.curriculum_code != null
        ? {
            code: row.curriculum_code,
            name: row.curriculum_name,
          }
        : null,
    grade:
      row.grade_code != null
        ? {
            code: row.grade_code,
            label: row.grade_label,
          }
        : null,
    school: {
      id: row.school_id,
      name: schoolName,
      branch: schoolBranch,
      city: schoolCity,
      state: row.school_state,
      pinCode: row.school_pin_code,
      verified: row.school_verified,
      normalizedKey: row.school_normalized_key,
      kind: row.school_kind ?? "school",
      offersPreschool: Boolean(row.school_offers_preschool),
      displayLabel: formatSchoolLabel(schoolName, schoolBranch, schoolCity),
    },
  };
}

async function fetchChildById(
  client: import("pg").PoolClient,
  childId: string
) {
  const { rows } = await client.query(
    `SELECT ${CHILD_SELECT}
     FROM children ch
     LEFT JOIN curricula cur ON cur.id = ch.curriculum_id
     LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
     JOIN schools s ON s.id = ch.school_id
     WHERE ch.id = $1`,
    [childId]
  );
  return rows[0] ? mapChild(rows[0]) : null;
}

function mapLocationRow(loc: Record<string, unknown>) {
  return {
    countryCode: (loc.country_code as string | null) ?? "IN",
    pinCode: loc.pin_code,
    postalCode: loc.pin_code,
    locality: loc.locality,
    city: loc.city,
    state: loc.state,
    communityName: loc.community_name,
    communityKey: loc.community_key,
  };
}

function mapMeStats(row?: {
  circle_count?: number;
  saved_post_count?: number;
  helpful_received_count?: number;
}) {
  return {
    circleCount: row?.circle_count ?? 0,
    savedPostCount: row?.saved_post_count ?? 0,
    helpfulReceivedCount: row?.helpful_received_count ?? 0,
  };
}

async function fetchAuthUserById(
  client: import("pg").PoolClient,
  userId: string
) {
  const { rows } = await client.query(
    `SELECT id, email, role, display_name, anonymous_handle, onboarding_complete, avatar_key, content_blocked
     FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    anonymousHandle: user.anonymous_handle,
    onboardingComplete: user.onboarding_complete,
    avatarKey: resolveAvatarKey(user.avatar_key, user.anonymous_handle),
    suspended: user.content_blocked === true,
  };
}

async function fetchUserCircles(
  client: import("pg").PoolClient,
  userId: string
) {
  return listUserCircles(client, userId);
}

type FamilyPageCache = {
  user: NonNullable<Awaited<ReturnType<typeof fetchAuthUserById>>> & {
    roles: Awaited<ReturnType<typeof listUserRoles>>;
  };
  children: ReturnType<typeof mapChild>[];
  location: ReturnType<typeof mapLocationRow> | null;
  stats: ReturnType<typeof mapMeStats>;
};

async function readFamilyPage(userId: string) {
  return getCachedJson<FamilyPageCache>(familyPageKey(userId));
}

async function writeFamilyPage(userId: string, value: FamilyPageCache) {
  await setCachedJson(familyPageKey(userId), value, PAGE_CACHE_TTL.family);
}

export function createMeRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const jwtUser = c.get("user");
    const client = await pool.connect();
    try {
      const user = await fetchAuthUserById(client, jwtUser.sub);
      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }
      const roles = await listUserRoles(client, String(user.id));
      return c.json({
        ...user,
        roles,
      });
    } finally {
      client.release();
    }
  });

  app.get("/bootstrap", async (c) => {
    const jwtUser = c.get("user");
    const userId = jwtUser.sub;
    const cached = await readFamilyPage(userId);
    if (cached?.user && cached.children && cached.stats) {
      return c.json(cached);
    }
    const client = await pool.connect();
    try {
      const user = await fetchAuthUserById(client, userId);
      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      const [roles, childrenResult, locationResult, statsResult] =
        await Promise.all([
          listUserRoles(client, String(user.id)),
          client.query(
            `SELECT ${CHILD_SELECT}
             FROM children ch
             LEFT JOIN curricula cur ON cur.id = ch.curriculum_id
             LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
             JOIN schools s ON s.id = ch.school_id
             WHERE ch.user_id = $1
             ORDER BY ch.created_at`,
            [userId]
          ),
          client.query(
            `SELECT country_code, pin_code, locality, city, state, community_name, community_key
             FROM user_locations WHERE user_id = $1`,
            [userId]
          ),
          client.query<{
            circle_count: number;
            saved_post_count: number;
            helpful_received_count: number;
          }>(
            `SELECT
               (SELECT COUNT(*)::int FROM circle_members WHERE user_id = $1) AS circle_count,
               (SELECT COUNT(*)::int FROM saved_items
                WHERE user_id = $1 AND item_type = 'post') AS saved_post_count,
               (SELECT COUNT(*)::int
                FROM post_helpful_marks phm
                JOIN circle_posts cp ON cp.id = phm.post_id
                WHERE cp.author_id = $1 AND phm.user_id <> $1) AS helpful_received_count`,
            [userId]
          ),
        ]);

      const payload = {
        user: {
          ...user,
          roles,
        },
        children: childrenResult.rows.map(mapChild),
        location: locationResult.rows[0]
          ? mapLocationRow(locationResult.rows[0])
          : null,
        stats: mapMeStats(statsResult.rows[0]),
      };
      await writeFamilyPage(userId, payload);
      return c.json(payload);
    } finally {
      client.release();
    }
  });

  app.delete("/", async (c) => {
    const userId = c.get("user").sub;
    const deleted = await deleteUserAccount(userId);
    if (!deleted) {
      return c.json({ error: "User not found" }, 404);
    }
    await invalidateFamilyPage(userId);
    return c.json({ ok: true });
  });

  app.patch("/avatar", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{ avatarKey?: string }>();
    const avatarKey = body.avatarKey?.trim();

    if (!avatarKey || !isValidAvatarKey(avatarKey)) {
      return c.json({ error: "Invalid avatar selection" }, 400);
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `UPDATE users
         SET avatar_key = $2, updated_at = now()
         WHERE id = $1
         RETURNING anonymous_handle, avatar_key`,
        [userId, avatarKey]
      );
      if (rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      await invalidateFamilyPage(userId);
      return c.json({
        avatarKey: resolveAvatarKey(
          rows[0].avatar_key,
          rows[0].anonymous_handle
        ),
      });
    } finally {
      client.release();
    }
  });

  app.get("/children", async (c) => {
    const userId = c.get("user").sub;
    const cached = await readFamilyPage(userId);
    if (cached && Array.isArray(cached.children)) {
      return c.json(cached.children);
    }
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT ${CHILD_SELECT}
         FROM children ch
         LEFT JOIN curricula cur ON cur.id = ch.curriculum_id
         LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
         JOIN schools s ON s.id = ch.school_id
         WHERE ch.user_id = $1
         ORDER BY ch.created_at`,
        [userId]
      );
      return c.json(rows.map(mapChild));
    } finally {
      client.release();
    }
  });

  app.post("/children", async (c) => {
    const userId = c.get("user").sub;
    const idempotencyKey =
      c.req.header("Idempotency-Key")?.trim() ||
      c.req.header("idempotency-key")?.trim() ||
      null;

    const body = await c.req.json<{
      nickname?: string;
      gender?: string;
      dateOfBirth?: string;
      track?: "school" | "preschool";
      ageYears?: number;
      curriculumId?: string;
      gradeId?: string;
      schoolId?: string;
      onboardingAttemptId?: string;
    }>();

    const effectiveKey = idempotencyKey || body.onboardingAttemptId?.trim() || null;
    const track = body.track === "preschool" ? "preschool" : "school";

    const nickname = body.nickname?.trim() || null;
    let dateOfBirth: string | null = null;
    if (body.dateOfBirth?.trim()) {
      dateOfBirth = parseChildDateOfBirth(body.dateOfBirth);
      if (!dateOfBirth) {
        return c.json(
          { error: "Valid dateOfBirth is required (YYYY-MM-DD)" },
          400
        );
      }
    }
    if (!body.schoolId) {
      return c.json({ error: "schoolId is required" }, 400);
    }

    if (track === "preschool") {
      if (body.ageYears !== 3 && body.ageYears !== 4) {
        return c.json({ error: "ageYears must be 3 or 4 for preschool" }, 400);
      }
      if (body.curriculumId || body.gradeId) {
        return c.json(
          { error: "curriculumId and gradeId are not allowed for preschool" },
          400
        );
      }
    } else {
      if (!body.curriculumId || !body.gradeId) {
        return c.json({ error: "curriculumId and gradeId are required" }, 400);
      }
      if (body.ageYears != null) {
        return c.json({ error: "ageYears is not allowed for school track" }, 400);
      }
    }

    const gender = body.gender ?? "unspecified";
    const validGenders = ["boy", "girl", "other", "unspecified"];
    if (!validGenders.includes(gender)) {
      return c.json({ error: "Invalid gender" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (effectiveKey) {
        const existing = await getIdempotentResponse(
          client,
          userId,
          "POST /v1/me/children",
          effectiveKey
        );
        if (existing) {
          await client.query("COMMIT");
          return c.json(existing.response, existing.statusCode as 200);
        }
        const reserved = await reserveIdempotencyKey(
          client,
          userId,
          "POST /v1/me/children",
          effectiveKey
        );
        if (reserved === "exists") {
          const again = await getIdempotentResponse(
            client,
            userId,
            "POST /v1/me/children",
            effectiveKey
          );
          await client.query("COMMIT");
          if (again) return c.json(again.response, again.statusCode as 200);
          return c.json({ error: "Request in progress" }, 409);
        }
      }

      const schoolCheck = await client.query(
        `SELECT id, city, state, pin_code
         FROM schools
         WHERE id = $1 AND normalized_key <> 'school_not_specified||unknown'
           AND redirect_to_school_id IS NULL`,
        [body.schoolId]
      );
      if (schoolCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "School not found" }, 404);
      }

      if (track === "school") {
        const gradeCheck = await client.query(
          `SELECT g.id FROM curriculum_grades g
           WHERE g.id = $1 AND g.curriculum_id = $2`,
          [body.gradeId, body.curriculumId]
        );
        if (gradeCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return c.json({ error: "Grade does not match curriculum" }, 400);
        }
      }

      const { rows } = await client.query(
        `INSERT INTO children (
           user_id, nickname, gender, date_of_birth,
           track, age_years, age_confirmed_at,
           curriculum_id, grade_id, school_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          userId,
          nickname,
          gender,
          dateOfBirth,
          track,
          track === "preschool" ? body.ageYears : null,
          track === "preschool" ? new Date() : null,
          track === "school" ? body.curriculumId : null,
          track === "school" ? body.gradeId : null,
          body.schoolId,
        ]
      );

      await syncCircleMembership(client, userId);
      const complete = await evaluateOnboardingComplete(client, userId);
      if (complete) {
        await client.query(
          "UPDATE users SET onboarding_complete = true, updated_at = now() WHERE id = $1",
          [userId]
        );
      }

      const child = await fetchChildById(client, rows[0].id);
      const user = await fetchAuthUserById(client, userId);
      const circles = await fetchUserCircles(client, userId);
      const payload = { child, user, circles };

      const schoolRow = schoolCheck.rows[0] as {
        id: string;
        city: string | null;
        state: string | null;
        pin_code: string | null;
      };
      await recordOnboardingGeoSchool(
        client,
        userId,
        {
          id: schoolRow.id,
          city: schoolRow.city,
          state: schoolRow.state,
          pinCode: schoolRow.pin_code,
        },
        c.req
      );

      if (effectiveKey) {
        await storeIdempotentResponse(
          client,
          userId,
          "POST /v1/me/children",
          effectiveKey,
          201,
          payload
        );
      }

      await client.query("COMMIT");
      await invalidateFamilyPage(userId);
      return c.json(payload, 201);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.patch("/children/:id", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("id");
    const body = await c.req.json<{
      nickname?: string;
      gender?: string;
      dateOfBirth?: string;
      track?: "school" | "preschool";
      ageYears?: number | null;
      curriculumId?: string | null;
      gradeId?: string | null;
      schoolId?: string;
    }>();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id, track, age_years, curriculum_id, grade_id, school_id
         FROM children WHERE id = $1 AND user_id = $2`,
        [childId, userId]
      );
      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "Child not found" }, 404);
      }

      const current = existing.rows[0] as {
        track: string;
        age_years: number | null;
        curriculum_id: string | null;
        grade_id: string | null;
        school_id: string;
      };

      let patchedSchool: {
        id: string;
        city: string | null;
        state: string | null;
        pin_code: string | null;
      } | null = null;

      if (body.schoolId) {
        const schoolCheck = await client.query(
          `SELECT id, city, state, pin_code
           FROM schools
           WHERE id = $1
             AND normalized_key <> 'school_not_specified||unknown'
             AND redirect_to_school_id IS NULL`,
          [body.schoolId]
        );
        if (schoolCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return c.json({ error: "School not found" }, 404);
        }
        patchedSchool = schoolCheck.rows[0] as {
          id: string;
          city: string | null;
          state: string | null;
          pin_code: string | null;
        };
      }

      const nextTrack =
        body.track === "preschool" || body.track === "school"
          ? body.track
          : (current.track as "school" | "preschool");

      const nextSchoolId = body.schoolId ?? current.school_id;
      let nextCurriculumId =
        body.curriculumId !== undefined
          ? body.curriculumId
          : current.curriculum_id;
      let nextGradeId =
        body.gradeId !== undefined ? body.gradeId : current.grade_id;
      let nextAgeYears =
        body.ageYears !== undefined ? body.ageYears : current.age_years;

      let experiencedAgeYears: number | null | undefined;
      let ageCircleUntil: Date | null | undefined;
      let ageConfirmedAt: Date | null | undefined;

      if (nextTrack === "preschool") {
        if (nextAgeYears !== 3 && nextAgeYears !== 4) {
          await client.query("ROLLBACK");
          return c.json({ error: "ageYears must be 3 or 4 for preschool" }, 400);
        }
        nextCurriculumId = null;
        nextGradeId = null;
        if (body.ageYears !== undefined && body.ageYears !== current.age_years) {
          ageConfirmedAt = new Date();
        }
        experiencedAgeYears = null;
        ageCircleUntil = null;
      } else {
        if (!nextCurriculumId || !nextGradeId) {
          await client.query("ROLLBACK");
          return c.json(
            { error: "curriculumId and gradeId are required for school track" },
            400
          );
        }
        const gradeCheck = await client.query(
          `SELECT g.id FROM curriculum_grades g
           WHERE g.id = $1 AND g.curriculum_id = $2`,
          [nextGradeId, nextCurriculumId]
        );
        if (gradeCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return c.json({ error: "Grade does not match curriculum" }, 400);
        }

        // Promoting preschool → school: keep age circle for ~12 months.
        if (current.track === "preschool" && nextTrack === "school") {
          experiencedAgeYears =
            current.age_years === 3 || current.age_years === 4
              ? current.age_years
              : null;
          if (experiencedAgeYears != null) {
            const until = new Date();
            until.setFullYear(until.getFullYear() + 1);
            ageCircleUntil = until;
          }
        }
        nextAgeYears = null;
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (body.nickname !== undefined) {
        const nick =
          body.nickname == null ? "" : String(body.nickname).trim();
        fields.push(`nickname = $${i++}`);
        values.push(nick || null);
      }
      if (body.gender !== undefined) {
        fields.push(`gender = $${i++}`);
        values.push(body.gender);
      }
      if (body.dateOfBirth !== undefined) {
        const raw =
          body.dateOfBirth == null ? "" : String(body.dateOfBirth).trim();
        if (!raw) {
          fields.push(`date_of_birth = $${i++}`);
          values.push(null);
        } else {
          const parsed = parseChildDateOfBirth(raw);
          if (!parsed) {
            await client.query("ROLLBACK");
            return c.json({ error: "Invalid dateOfBirth (YYYY-MM-DD)" }, 400);
          }
          fields.push(`date_of_birth = $${i++}`);
          values.push(parsed);
        }
      }

      fields.push(`track = $${i++}`);
      values.push(nextTrack);
      fields.push(`school_id = $${i++}`);
      values.push(nextSchoolId);
      fields.push(`curriculum_id = $${i++}`);
      values.push(nextCurriculumId);
      fields.push(`grade_id = $${i++}`);
      values.push(nextGradeId);
      fields.push(`age_years = $${i++}`);
      values.push(nextAgeYears);

      if (ageConfirmedAt !== undefined) {
        fields.push(`age_confirmed_at = $${i++}`);
        values.push(ageConfirmedAt);
      } else if (nextTrack === "preschool" && current.track !== "preschool") {
        fields.push(`age_confirmed_at = $${i++}`);
        values.push(new Date());
      }

      if (experiencedAgeYears !== undefined) {
        fields.push(`experienced_age_years = $${i++}`);
        values.push(experiencedAgeYears);
      }
      if (ageCircleUntil !== undefined) {
        fields.push(`age_circle_until = $${i++}`);
        values.push(ageCircleUntil);
      }

      fields.push(`updated_at = now()`);
      const childIdIdx = i++;
      const userIdIdx = i;
      values.push(childId, userId);
      await client.query(
        `UPDATE children SET ${fields.join(", ")} WHERE id = $${childIdIdx} AND user_id = $${userIdIdx}`,
        values
      );

      await syncCircleMembership(client, userId);
      const complete = await evaluateOnboardingComplete(client, userId);
      await client.query(
        "UPDATE users SET onboarding_complete = $2, updated_at = now() WHERE id = $1",
        [userId, complete]
      );

      if (patchedSchool) {
        await recordOnboardingGeoSchool(
          client,
          userId,
          {
            id: patchedSchool.id,
            city: patchedSchool.city,
            state: patchedSchool.state,
            pinCode: patchedSchool.pin_code,
          },
          c.req
        );
      }

      await client.query("COMMIT");
      await invalidateFamilyPage(userId);

      const child = await fetchChildById(client, childId);
      return c.json(child);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.delete("/children/:id", async (c) => {
    const userId = c.get("user").sub;
    const childId = c.req.param("id");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "DELETE FROM children WHERE id = $1 AND user_id = $2 RETURNING id",
        [childId, userId]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "Child not found" }, 404);
      }
      await syncCircleMembership(client, userId);
      const complete = await evaluateOnboardingComplete(client, userId);
      await client.query(
        "UPDATE users SET onboarding_complete = $2, updated_at = now() WHERE id = $1",
        [userId, complete]
      );
      const remaining = await client.query(
        `SELECT id FROM children WHERE user_id = $1 ORDER BY created_at`,
        [userId]
      );
      const user = await fetchAuthUserById(client, userId);
      await client.query("COMMIT");
      await invalidateFamilyPage(userId);
      return c.json({
        ok: true,
        onboardingComplete: complete,
        remainingChildIds: remaining.rows.map((r) => r.id as string),
        user,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/location", async (c) => {
    const userId = c.get("user").sub;
    const cached = await readFamilyPage(userId);
    if (cached && "location" in cached) {
      return c.json(cached.location);
    }
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT country_code, pin_code, locality, city, state, community_name, community_key
         FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (rows.length === 0) {
        return c.json(null);
      }
      const loc = rows[0];
      return c.json(mapLocationRow(loc));
    } finally {
      client.release();
    }
  });

  app.patch("/location", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      countryCode?: string;
      pinCode?: string;
      locality?: string;
      city?: string;
      state?: string;
      communityName?: string;
    }>();

    const countryCode = (body.countryCode?.trim() || "IN").toUpperCase();
    const pinCode = body.pinCode?.trim();
    if (!pinCode) {
      return c.json({ error: "pinCode is required" }, 400);
    }

    const locality = body.locality?.trim();
    if (!locality) {
      return c.json({ error: "locality is required" }, 400);
    }

    const communityName = body.communityName?.trim() || null;
    const communityKey = communityName
      ? normalizeCommunityKey(communityName)
      : null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const lookup = await lookupPostalCode(client, countryCode, pinCode);
      const city = lookup?.city?.trim() || body.city?.trim() || null;
      const state = lookup?.state?.trim() || body.state?.trim() || null;

      console.log(
        JSON.stringify({
          event: "postal_lookup",
          route: "PATCH /v1/me/location",
          country: countryCode,
          source: lookup?.source ?? (city && state ? "client" : "miss"),
        })
      );

      if (!city || !state) {
        await client.query("ROLLBACK");
        return c.json(
          {
            error:
              "Could not resolve city/state for this postal code. Provide city and state.",
            code: "POSTAL_LOOKUP_FAILED",
          },
          400
        );
      }

      await client.query(
        `INSERT INTO user_locations (user_id, country_code, pin_code, locality, city, state, community_name, community_key, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (user_id) DO UPDATE SET
           country_code = EXCLUDED.country_code,
           pin_code = EXCLUDED.pin_code,
           locality = EXCLUDED.locality,
           city = EXCLUDED.city,
           state = EXCLUDED.state,
           community_name = EXCLUDED.community_name,
           community_key = EXCLUDED.community_key,
           updated_at = now()`,
        [
          userId,
          countryCode,
          pinCode,
          locality,
          city,
          state,
          communityName,
          communityKey,
        ]
      );

      await recordOnboardingGeoLocation(
        client,
        userId,
        { countryCode, pinCode, locality, city, state },
        c.req
      );

      await syncCircleMembership(client, userId);
      const complete = await evaluateOnboardingComplete(client, userId);
      await client.query(
        "UPDATE users SET onboarding_complete = $2, updated_at = now() WHERE id = $1",
        [userId, complete]
      );

      await client.query("COMMIT");
      await invalidateFamilyPage(userId);

      return c.json({
        countryCode,
        pinCode,
        postalCode: pinCode,
        locality,
        city,
        state,
        communityName,
        communityKey,
        onboardingComplete: complete,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/push-token", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{ pushToken?: string }>();
    const pushToken = body.pushToken?.trim();
    if (!pushToken) {
      return c.json({ error: "pushToken is required" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query(
        "UPDATE users SET push_token = $1, updated_at = now() WHERE id = $2",
        [pushToken, userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/stats", async (c) => {
    const userId = c.get("user").sub;
    const cached = await readFamilyPage(userId);
    if (cached?.stats) {
      return c.json(cached.stats);
    }
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{
        circle_count: number;
        saved_post_count: number;
        helpful_received_count: number;
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM circle_members WHERE user_id = $1) AS circle_count,
           (SELECT COUNT(*)::int FROM saved_items
            WHERE user_id = $1 AND item_type = 'post') AS saved_post_count,
           (SELECT COUNT(*)::int
            FROM post_helpful_marks phm
            JOIN circle_posts cp ON cp.id = phm.post_id
            WHERE cp.author_id = $1 AND phm.user_id <> $1) AS helpful_received_count`,
        [userId]
      );
      const row = rows[0];
      return c.json(mapMeStats(row));
    } finally {
      client.release();
    }
  });

  app.get("/notification-prefs", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        "SELECT notification_prefs FROM users WHERE id = $1",
        [userId]
      );
      return c.json(mergeNotificationPrefs(rows[0]?.notification_prefs));
    } finally {
      client.release();
    }
  });

  app.patch("/notification-prefs", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<NotificationPrefs>();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        "SELECT notification_prefs FROM users WHERE id = $1",
        [userId]
      );
      const merged = {
        ...mergeNotificationPrefs(rows[0]?.notification_prefs),
        ...body,
      };
      await client.query(
        "UPDATE users SET notification_prefs = $2, updated_at = now() WHERE id = $1",
        [userId, JSON.stringify(merged)]
      );
      return c.json(merged);
    } finally {
      client.release();
    }
  });

  app.get("/notification-mutes", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT scope, scope_id AS "scopeId", created_at AS "createdAt"
         FROM notification_mutes
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      return c.json({ mutes: rows });
    } finally {
      client.release();
    }
  });

  app.post("/notification-mutes", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{ scope?: string; scopeId?: string }>();
    const scope = body.scope?.trim();
    const scopeId = body.scopeId?.trim();

    if (!scope || !scopeId) {
      return c.json({ error: "scope and scopeId are required" }, 400);
    }
    if (!["circle", "topic", "listing"].includes(scope)) {
      return c.json({ error: "Invalid mute scope" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO notification_mutes (user_id, scope, scope_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, scope, scopeId]
      );
      return c.json({ ok: true }, 201);
    } finally {
      client.release();
    }
  });

  app.delete("/notification-mutes/:scope/:scopeId", async (c) => {
    const userId = c.get("user").sub;
    const scope = c.req.param("scope");
    const scopeId = c.req.param("scopeId");

    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM notification_mutes
         WHERE user_id = $1 AND scope = $2 AND scope_id = $3`,
        [userId, scope, scopeId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/reminders", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT r.id, r.title, r.note, r.fire_at, r.sent, r.activity_id, r.created_at,
                a.title AS activity_title
         FROM reminders r
         LEFT JOIN activities a ON a.id = r.activity_id
         WHERE r.user_id = $1
         ORDER BY r.fire_at DESC`,
        [userId]
      );
      return c.json(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          note: r.note,
          fireAt: r.fire_at,
          sent: r.sent,
          activityId: r.activity_id,
          activityTitle: r.activity_title,
          createdAt: r.created_at,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.post("/reminders", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      title?: string;
      note?: string;
      fireAt?: string;
      activityId?: string;
    }>();

    const title = body.title?.trim();
    const fireAt = body.fireAt;
    if (!title || !fireAt) {
      return c.json({ error: "title and fireAt are required" }, 400);
    }

    const fireDate = new Date(fireAt);
    if (Number.isNaN(fireDate.getTime())) {
      return c.json({ error: "Invalid fireAt" }, 400);
    }

    const client = await pool.connect();
    try {
      if (body.activityId) {
        const act = await client.query(
          "SELECT id FROM activities WHERE id = $1 AND status = 'published'",
          [body.activityId]
        );
        if (act.rows.length === 0) {
          return c.json({ error: "Activity not found" }, 404);
        }
      }

      const { rows } = await client.query(
        `INSERT INTO reminders (user_id, activity_id, title, note, fire_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, note, fire_at, sent, activity_id, created_at`,
        [
          userId,
          body.activityId ?? null,
          title,
          body.note?.trim() || null,
          fireDate.toISOString(),
        ]
      );

      const r = rows[0];
      return c.json(
        {
          id: r.id,
          title: r.title,
          note: r.note,
          fireAt: r.fire_at,
          sent: r.sent,
          activityId: r.activity_id,
          createdAt: r.created_at,
        },
        201
      );
    } finally {
      client.release();
    }
  });

  app.delete("/reminders/:id", async (c) => {
    const userId = c.get("user").sub;
    const reminderId = c.req.param("id");
    const client = await pool.connect();
    try {
      const result = await client.query(
        "DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id",
        [reminderId, userId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Reminder not found" }, 404);
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/notifications", async (c) => {
    const userId = c.get("user").sub;
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, type, title, body, data, read_at, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return c.json(
        rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          readAt: n.read_at,
          createdAt: n.created_at,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.patch("/notifications/read-all", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE notifications SET read_at = now()
         WHERE user_id = $1 AND read_at IS NULL`,
        [userId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.patch("/notifications/:id/read", async (c) => {
    const userId = c.get("user").sub;
    const notificationId = c.req.param("id");
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE notifications SET read_at = now()
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
      );
      if (result.rows.length === 0) {
        return c.json({ error: "Notification not found" }, 404);
      }
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/contact-details", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT first_name, block_or_flat, contact_phone, vehicle_description, updated_at
         FROM user_contact_details WHERE user_id = $1`,
        [userId]
      );
      if (rows.length === 0) return c.json(null);
      return c.json({
        firstName: rows[0].first_name,
        blockOrFlat: rows[0].block_or_flat,
        contactPhone: rows[0].contact_phone,
        vehicleDescription: rows[0].vehicle_description,
        updatedAt: rows[0].updated_at,
      });
    } finally {
      client.release();
    }
  });

  app.put("/contact-details", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      firstName?: string;
      blockOrFlat?: string;
      contactPhone?: string;
      vehicleDescription?: string;
    }>();

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO user_contact_details
           (user_id, first_name, block_or_flat, contact_phone, vehicle_description, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (user_id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           block_or_flat = EXCLUDED.block_or_flat,
           contact_phone = EXCLUDED.contact_phone,
           vehicle_description = EXCLUDED.vehicle_description,
           updated_at = now()`,
        [
          userId,
          body.firstName?.trim() || null,
          body.blockOrFlat?.trim() || null,
          body.contactPhone?.trim() || null,
          body.vehicleDescription?.trim() || null,
        ]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/topics", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT t.slug, t.name, t.category, t.post_count
         FROM topic_follows tf
         JOIN topics t ON t.id = tf.topic_id
         WHERE tf.user_id = $1 AND t.active = true
         ORDER BY t.name`,
        [userId]
      );
      return c.json(
        rows.map((row) => ({
          slug: row.slug,
          name: row.name,
          category: row.category,
          postCount: row.post_count,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.get("/school-events/upcoming", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT e.id, e.school_id, e.title, e.event_type, e.starts_at,
                e.source, e.confirmed_count, e.disputed_count,
                s.name AS school_name
         FROM school_events e
         JOIN schools s ON s.id = e.school_id
         JOIN children ch ON ch.school_id = e.school_id AND ch.user_id = $1
         WHERE e.hidden = false
           AND e.starts_at >= now()
           AND e.starts_at <= now() + interval '7 days'
           AND (e.grade_id IS NULL OR e.grade_id = ch.grade_id)
         ORDER BY e.starts_at ASC
         LIMIT 10`,
        [userId]
      );
      return c.json(
        rows.map((row) => ({
          id: row.id,
          schoolId: row.school_id,
          schoolName: row.school_name,
          title: row.title,
          eventType: row.event_type,
          startsAt: row.starts_at,
          unconfirmed:
            row.source === "parent_reported" && row.confirmed_count < 3,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.get("/saved", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT item_type, item_id, created_at
         FROM saved_items
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      const posts: Array<Record<string, unknown>> = [];

      for (const row of rows) {
        if (row.item_type !== "post") continue;
        const post = await client.query(
          `SELECT p.id, p.body, p.tag, p.created_at, p.edited_at, u.anonymous_handle, u.avatar_key,
                  EXISTS (
                    SELECT 1 FROM circle_post_targets pct
                    JOIN circle_members cm ON cm.circle_id = pct.circle_id
                    WHERE pct.post_id = p.id AND cm.user_id = $2
                  ) OR p.author_id = $2 AS can_view,
                  COALESCE((
                    SELECT pct.circle_id FROM circle_post_targets pct
                    JOIN circle_members cm ON cm.circle_id = pct.circle_id
                    WHERE pct.post_id = p.id AND cm.user_id = $2
                    LIMIT 1
                  ), (
                    SELECT pct.circle_id FROM circle_post_targets pct
                    WHERE pct.post_id = p.id AND pct.is_primary
                    LIMIT 1
                  )) AS circle_id
           FROM circle_posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = $1`,
          [row.item_id, userId]
        );
        if (post.rows.length === 0) {
          posts.push({
            id: row.item_id,
            unavailable: true,
            savedAt: row.created_at,
          });
        } else if (post.rows[0].can_view) {
          posts.push({
            id: post.rows[0].id,
            circleId: post.rows[0].circle_id,
            body: post.rows[0].body,
            tag: post.rows[0].tag,
            createdAt: post.rows[0].created_at,
            editedAt: post.rows[0].edited_at ?? null,
            authorHandle: post.rows[0].anonymous_handle,
            authorAvatarKey: resolveAvatarKey(
              post.rows[0].avatar_key,
              post.rows[0].anonymous_handle
            ),
            savedAt: row.created_at,
          });
        }
      }

      return c.json({ posts, activities: [], listings: [] });
    } finally {
      client.release();
    }
  });

  app.post("/saved", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{ itemType?: string; itemId?: string }>();
    if (!body.itemType || !body.itemId) {
      return c.json({ error: "itemType and itemId are required" }, 400);
    }
    if (!["post", "activity", "listing"].includes(body.itemType)) {
      return c.json({ error: "Invalid item type" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO saved_items (user_id, item_type, item_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, body.itemType, body.itemId]
      );
      return c.json({ ok: true }, 201);
    } finally {
      client.release();
    }
  });

  app.delete("/saved/:itemType/:itemId", async (c) => {
    const userId = c.get("user").sub;
    const itemType = c.req.param("itemType");
    const itemId = c.req.param("itemId");
    const client = await pool.connect();
    try {
      await client.query(
        `DELETE FROM saved_items
         WHERE user_id = $1 AND item_type = $2 AND item_id = $3`,
        [userId, itemType, itemId]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/reports", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      targetUserId?: string;
      reason?: string;
      reasonId?: string;
      otherDetail?: string;
    }>();
    const targetUserId = body.targetUserId?.trim();
    if (!targetUserId) {
      return c.json({ error: "targetUserId is required" }, 400);
    }
    if (targetUserId === userId) {
      return c.json({ error: "Cannot report yourself" }, 400);
    }

    const parsed = parseReportReason(body);
    if (parsed.ok === false) {
      return c.json({ error: parsed.error }, 400);
    }
    const reason = parsed.reason;
    const client = await pool.connect();
    try {
      const exists = await client.query("SELECT id FROM users WHERE id = $1", [
        targetUserId,
      ]);
      if (exists.rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }

      await client.query(
        `INSERT INTO reports (reporter_id, target_user_id, reason)
         VALUES ($1, $2, $3)`,
        [userId, targetUserId, reason]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.post("/blocks/:userId", async (c) => {
    const userId = c.get("user").sub;
    const blockedId = c.req.param("userId");

    if (blockedId === userId) {
      return c.json({ error: "Cannot block yourself" }, 400);
    }

    const body = (await c.req.json().catch(() => null)) as {
      postId?: string;
      circleId?: string;
      messageId?: string;
    } | null;
    const requestedPostId = body?.postId?.trim() || null;
    const requestedMessageId = body?.messageId?.trim() || null;

    const client = await pool.connect();
    try {
      const exists = await client.query(
        `SELECT id, anonymous_handle FROM users WHERE id = $1`,
        [blockedId]
      );
      if (exists.rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      const blockedHandle = String(exists.rows[0].anonymous_handle ?? "");

      let postId: string | null = null;
      let messageId: string | null = null;
      let contentPreview: string | null = null;
      if (requestedPostId) {
        const postResult = await client.query(
          `SELECT id, author_id, body FROM circle_posts WHERE id = $1`,
          [requestedPostId]
        );
        if (
          postResult.rows.length > 0 &&
          String(postResult.rows[0].author_id) === blockedId
        ) {
          postId = String(postResult.rows[0].id);
          contentPreview = String(postResult.rows[0].body ?? "");
        }
      } else if (requestedMessageId) {
        const messageResult = await client.query(
          `SELECT id, author_id, body FROM circle_messages WHERE id = $1`,
          [requestedMessageId]
        );
        if (
          messageResult.rows.length > 0 &&
          String(messageResult.rows[0].author_id) === blockedId
        ) {
          messageId = String(messageResult.rows[0].id);
          contentPreview = String(messageResult.rows[0].body ?? "");
        }
      }

      const insertResult = await client.query(
        `INSERT INTO user_blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING blocker_id`,
        [userId, blockedId]
      );
      await client.query(
        `UPDATE conversation_participants cp
         SET hidden = true
         FROM conversations c
         WHERE cp.conversation_id = c.id
           AND cp.user_id = $1
           AND (
             (c.user_a_id = $1 AND c.user_b_id = $2)
             OR (c.user_a_id = $2 AND c.user_b_id = $1)
           )`,
        [userId, blockedId]
      );
      await client.query(
        `UPDATE parent_connection_requests
         SET status = CASE
               WHEN sender_id = $1 THEN 'cancelled'
               ELSE 'declined'
             END,
             responded_at = now()
         WHERE status = 'pending'
           AND (
             (sender_id = $1 AND recipient_id = $2)
             OR (sender_id = $2 AND recipient_id = $1)
           )`,
        [userId, blockedId]
      );

      if (insertResult.rows.length > 0) {
        const reason = postId
          ? `Blocked parent (post ${postId})`
          : messageId
            ? `Blocked parent (message ${messageId})`
            : "Blocked parent";
        await client.query(
          `INSERT INTO reports (
             reporter_id, target_user_id, target_post_id,
             target_circle_message_id, reason
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, blockedId, postId, messageId, reason]
        );

        const blockerResult = await client.query(
          `SELECT anonymous_handle FROM users WHERE id = $1`,
          [userId]
        );
        const blockerHandle = String(
          blockerResult.rows[0]?.anonymous_handle ?? ""
        );

        void sendParentBlockedAlert({
          blockerId: userId,
          blockedId,
          blockerHandle,
          blockedHandle,
          postId,
          messageId,
          contentPreview,
        });
      }

      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/posts", async (c) => {
    const userId = c.get("user").sub;
    const before = c.req.query("before");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
    const client = await pool.connect();
    try {
      const params: unknown[] = [userId, limit];
      let beforeClause = "";
      if (before) {
        params.push(before);
        beforeClause = `AND p.created_at < $3::timestamptz`;
      }
      const { rows } = await client.query(
        `SELECT p.id, p.body, p.tag, p.reply_count, p.created_at, p.edited_at,
                p.cross_post_group_id, p.posting_context,
                pct.circle_id, c.display_name AS circle_name,
                EXISTS (
                  SELECT 1 FROM circle_members cm
                  WHERE cm.circle_id = pct.circle_id AND cm.user_id = $1
                ) AS is_member,
                (
                  SELECT COALESCE(
                    json_agg(
                      json_build_object(
                        'circleId', t.circle_id,
                        'circleName', tc.display_name,
                        'accessMode', t.access_mode
                      )
                      ORDER BY t.is_primary DESC, tc.display_name
                    ),
                    '[]'::json
                  )
                  FROM circle_post_targets t
                  JOIN circles tc ON tc.id = t.circle_id
                  WHERE t.post_id = p.id
                ) AS targets
         FROM circle_posts p
         JOIN circle_post_targets pct
           ON pct.post_id = p.id AND pct.is_primary
         JOIN circles c ON c.id = pct.circle_id
         WHERE p.author_id = $1
           ${beforeClause}
         ORDER BY p.created_at DESC
         LIMIT $2`,
        params
      );
      return c.json({
        posts: rows.map((row) => ({
          id: row.id,
          body: row.body,
          tag: row.tag,
          replyCount: row.reply_count,
          createdAt: row.created_at,
          editedAt: row.edited_at ?? null,
          circleId: row.circle_id,
          circleName: row.circle_name,
          accessState: row.is_member ? "member" : "author",
          postingContext: row.posting_context ?? "member",
          crossPostGroupId: row.cross_post_group_id ?? null,
          targets: row.targets ?? [],
        })),
        nextCursor:
          rows.length === limit ? rows[rows.length - 1].created_at : null,
      });
    } finally {
      client.release();
    }
  });

  app.post("/feed/impressions", async (c) => {
    const userId = c.get("user").sub;
    const parsed = parseImpressionPostIds(await c.req.json().catch(() => null));
    if ("error" in parsed) {
      return c.json({ error: parsed.error }, 400);
    }
    try {
      await recordHomeFeedImpressions({ userId, postIds: parsed.postIds });
    } catch (error) {
      console.error("[feed.impressions] write failed", error);
      return c.json({ error: "Could not record impressions" }, 500);
    }
    return c.body(null, 204);
  });

  app.get("/feed", async (c) => {
    const userId = c.get("user").sub;
    const cursor = c.req.query("cursor");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
    const result = await loadHomeFeedResolved({ userId, cursor, limit });
    return c.json(result);
  });

  app.post("/posts/:postId/helpful", async (c) => {
    const userId = c.get("user").sub;
    const postId = c.req.param("postId");
    const result = await togglePostHelpful({ userId, postId });
    if ("error" in result) {
      const status = result.error === "not_found" ? 404 : 403;
      return c.json({ error: result.error }, status);
    }
    return c.json(result);
  });

  app.get("/lucky-gift", async (c) => {
    const userId = c.get("user").sub;
    const ctx = await fetchAuthUserLuckyGiftContext(userId);
    if (!ctx) return c.json({ error: "User not found" }, 404);
    try {
      const result = await getLuckyGiftForUser({
        userId,
        role: ctx.role,
        onboardingComplete: ctx.onboardingComplete,
        accountCreatedAt: ctx.createdAt,
      });
      return c.json(result);
    } catch (error) {
      console.error("[lucky-gift.get] failed", error);
      return c.json({ error: "Could not load lucky gift" }, 500);
    }
  });

  app.post("/lucky-gift/scratch", async (c) => {
    const userId = c.get("user").sub;
    try {
      const result = await scratchLuckyGift({ userId });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 404);
      }
      return c.json(result);
    } catch (error) {
      console.error("[lucky-gift.scratch] failed", error);
      return c.json({ error: "Could not scratch card" }, 500);
    }
  });

  app.post("/lucky-gift/phone", async (c) => {
    const userId = c.get("user").sub;
    let body: { phone?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    try {
      const result = await submitLuckyGiftPhone({
        userId,
        phone: body.phone ?? "",
      });
      if ("error" in result) {
        return c.json({ error: result.error }, result.status as 400 | 404);
      }
      return c.json(result);
    } catch (error) {
      console.error("[lucky-gift.phone] failed", error);
      return c.json({ error: "Could not save phone" }, 500);
    }
  });

  return app;
}
