import { Hono } from "hono";
import { pool } from "@vaara/db";
import { normalizeCommunityKey } from "../lib/community.js";
import { formatSchoolLabel } from "../lib/school.js";
import {
  evaluateOnboardingComplete,
  syncCircleMembership,
} from "../services/circle-sync.js";
import {
  loadHomeFeed,
  togglePostHelpful,
} from "../services/feed.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  mergeNotificationPrefs,
  type NotificationPrefs,
} from "../lib/notification-prefs.js";

const CHILD_SELECT = `
  ch.id, ch.nickname, ch.gender, ch.curriculum_id, ch.grade_id, ch.school_id,
  cur.code AS curriculum_code, cur.name AS curriculum_name,
  g.code AS grade_code, g.label AS grade_label,
  s.name AS school_name, s.branch AS school_branch, s.city AS school_city,
  s.state AS school_state, s.pin_code AS school_pin_code, s.verified AS school_verified,
  s.normalized_key AS school_normalized_key
`;

function mapChild(row: Record<string, unknown>) {
  const schoolName = row.school_name as string;
  const schoolCity = row.school_city as string;
  const schoolBranch = row.school_branch as string | null;

  return {
    id: row.id,
    nickname: row.nickname,
    gender: row.gender,
    curriculumId: row.curriculum_id,
    gradeId: row.grade_id,
    schoolId: row.school_id,
    curriculum: {
      code: row.curriculum_code,
      name: row.curriculum_name,
    },
    grade: {
      code: row.grade_code,
      label: row.grade_label,
    },
    school: {
      id: row.school_id,
      name: schoolName,
      branch: schoolBranch,
      city: schoolCity,
      state: row.school_state,
      pinCode: row.school_pin_code,
      verified: row.school_verified,
      normalizedKey: row.school_normalized_key,
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
     JOIN curricula cur ON cur.id = ch.curriculum_id
     JOIN curriculum_grades g ON g.id = ch.grade_id
     JOIN schools s ON s.id = ch.school_id
     WHERE ch.id = $1`,
    [childId]
  );
  return rows[0] ? mapChild(rows[0]) : null;
}

export function createMeRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const jwtUser = c.get("user");
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, email, role, display_name, anonymous_handle, onboarding_complete
         FROM users WHERE id = $1`,
        [jwtUser.sub]
      );
      if (rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      const user = rows[0];
      return c.json({
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        anonymousHandle: user.anonymous_handle,
        onboardingComplete: user.onboarding_complete,
      });
    } finally {
      client.release();
    }
  });

  app.get("/children", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT ${CHILD_SELECT}
         FROM children ch
         JOIN curricula cur ON cur.id = ch.curriculum_id
         JOIN curriculum_grades g ON g.id = ch.grade_id
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
    const body = await c.req.json<{
      nickname?: string;
      gender?: string;
      curriculumId?: string;
      gradeId?: string;
      schoolId?: string;
    }>();

    const nickname = body.nickname?.trim();
    if (!nickname) {
      return c.json({ error: "nickname is required" }, 400);
    }
    if (!body.curriculumId || !body.gradeId) {
      return c.json({ error: "curriculumId and gradeId are required" }, 400);
    }
    if (!body.schoolId) {
      return c.json({ error: "schoolId is required" }, 400);
    }

    const gender = body.gender ?? "unspecified";
    const validGenders = ["boy", "girl", "other", "unspecified"];
    if (!validGenders.includes(gender)) {
      return c.json({ error: "Invalid gender" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const schoolCheck = await client.query(
        `SELECT id FROM schools
         WHERE id = $1 AND normalized_key <> 'school_not_specified||unknown'`,
        [body.schoolId]
      );
      if (schoolCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "School not found" }, 404);
      }

      const gradeCheck = await client.query(
        `SELECT g.id FROM curriculum_grades g
         WHERE g.id = $1 AND g.curriculum_id = $2`,
        [body.gradeId, body.curriculumId]
      );
      if (gradeCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "Grade does not match curriculum" }, 400);
      }

      const { rows } = await client.query(
        `INSERT INTO children (user_id, nickname, gender, curriculum_id, grade_id, school_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          userId,
          nickname,
          gender,
          body.curriculumId,
          body.gradeId,
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

      await client.query("COMMIT");

      const child = await fetchChildById(client, rows[0].id);
      return c.json(child, 201);
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
      curriculumId?: string;
      gradeId?: string;
      schoolId?: string;
    }>();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT id FROM children WHERE id = $1 AND user_id = $2",
        [childId, userId]
      );
      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "Child not found" }, 404);
      }

      if (body.schoolId) {
        const schoolCheck = await client.query(
          `SELECT id FROM schools
           WHERE id = $1 AND normalized_key <> 'school_not_specified||unknown'`,
          [body.schoolId]
        );
        if (schoolCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return c.json({ error: "School not found" }, 404);
        }
      }

      if (body.curriculumId && body.gradeId) {
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

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (body.nickname !== undefined) {
        const nick = body.nickname.trim();
        if (!nick) {
          await client.query("ROLLBACK");
          return c.json({ error: "nickname cannot be empty" }, 400);
        }
        fields.push(`nickname = $${i++}`);
        values.push(nick);
      }
      if (body.gender !== undefined) {
        fields.push(`gender = $${i++}`);
        values.push(body.gender);
      }
      if (body.curriculumId !== undefined) {
        fields.push(`curriculum_id = $${i++}`);
        values.push(body.curriculumId);
      }
      if (body.gradeId !== undefined) {
        fields.push(`grade_id = $${i++}`);
        values.push(body.gradeId);
      }
      if (body.schoolId !== undefined) {
        fields.push(`school_id = $${i++}`);
        values.push(body.schoolId);
      }

      if (fields.length > 0) {
        fields.push(`updated_at = now()`);
        const childIdIdx = i++;
        const userIdIdx = i;
        values.push(childId, userId);
        await client.query(
          `UPDATE children SET ${fields.join(", ")} WHERE id = $${childIdIdx} AND user_id = $${userIdIdx}`,
          values
        );
      }

      await syncCircleMembership(client, userId);
      const complete = await evaluateOnboardingComplete(client, userId);
      await client.query(
        "UPDATE users SET onboarding_complete = $2, updated_at = now() WHERE id = $1",
        [userId, complete]
      );

      await client.query("COMMIT");

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
      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/location", async (c) => {
    const userId = c.get("user").sub;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT pin_code, locality, city, state, community_name, community_key
         FROM user_locations WHERE user_id = $1`,
        [userId]
      );
      if (rows.length === 0) {
        return c.json(null);
      }
      const loc = rows[0];
      return c.json({
        pinCode: loc.pin_code,
        locality: loc.locality,
        city: loc.city,
        state: loc.state,
        communityName: loc.community_name,
        communityKey: loc.community_key,
      });
    } finally {
      client.release();
    }
  });

  app.patch("/location", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      pinCode?: string;
      locality?: string;
      city?: string;
      state?: string;
      communityName?: string;
    }>();

    const pinCode = body.pinCode?.trim();
    if (!pinCode) {
      return c.json({ error: "pinCode is required" }, 400);
    }

    const communityName = body.communityName?.trim() || null;
    const communityKey = communityName
      ? normalizeCommunityKey(communityName)
      : null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO user_locations (user_id, pin_code, locality, city, state, community_name, community_key, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (user_id) DO UPDATE SET
           pin_code = EXCLUDED.pin_code,
           locality = EXCLUDED.locality,
           city = EXCLUDED.city,
           state = EXCLUDED.state,
           community_name = EXCLUDED.community_name,
           community_key = EXCLUDED.community_key,
           updated_at = now()`,
        [
          userId,
          pinCode,
          body.locality?.trim() || null,
          body.city?.trim() || null,
          body.state?.trim() || null,
          communityName,
          communityKey,
        ]
      );

      await syncCircleMembership(client, userId);
      const complete = await evaluateOnboardingComplete(client, userId);
      await client.query(
        "UPDATE users SET onboarding_complete = $2, updated_at = now() WHERE id = $1",
        [userId, complete]
      );

      await client.query("COMMIT");

      return c.json({
        pinCode,
        locality: body.locality?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
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
      return c.json({
        circleCount: row?.circle_count ?? 0,
        savedPostCount: row?.saved_post_count ?? 0,
        helpfulReceivedCount: row?.helpful_received_count ?? 0,
      });
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
          `SELECT p.id, p.body, p.tag, p.created_at, u.anonymous_handle,
                  EXISTS (
                    SELECT 1 FROM circle_post_targets pct
                    JOIN circle_members cm ON cm.circle_id = pct.circle_id
                    WHERE pct.post_id = p.id AND cm.user_id = $2
                  ) AS can_view,
                  (
                    SELECT pct.circle_id FROM circle_post_targets pct
                    JOIN circle_members cm ON cm.circle_id = pct.circle_id
                    WHERE pct.post_id = p.id AND cm.user_id = $2
                    LIMIT 1
                  ) AS circle_id
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
            authorHandle: post.rows[0].anonymous_handle,
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
    const body = await c.req.json<{ targetUserId?: string; reason?: string }>();
    const targetUserId = body.targetUserId?.trim();
    if (!targetUserId) {
      return c.json({ error: "targetUserId is required" }, 400);
    }
    if (targetUserId === userId) {
      return c.json({ error: "Cannot report yourself" }, 400);
    }

    const reason = body.reason?.trim() || "Reported from the app";
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

    const client = await pool.connect();
    try {
      const exists = await client.query("SELECT id FROM users WHERE id = $1", [
        blockedId,
      ]);
      if (exists.rows.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }

      await client.query(
        `INSERT INTO user_blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
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

      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  app.get("/feed", async (c) => {
    const userId = c.get("user").sub;
    const cursor = c.req.query("cursor");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
    const result = await loadHomeFeed({ userId, cursor, limit });
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

  return app;
}
