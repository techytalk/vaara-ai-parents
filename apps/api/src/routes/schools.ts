import { Hono } from "hono";
import { pool } from "@vaara/db";
import type { PoolClient } from "pg";
import { buildReviewAuthorView } from "../lib/author.js";
import {
  currentAcademicYear,
  isFeeYearInRange,
  totalFeeAmount,
} from "../lib/school-fees.js";
import {
  buildSchoolNormalizedKey,
  formatSchoolLabel,
  mapSchoolRow,
} from "../lib/school.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

const PLACEHOLDER_SCHOOL_KEY = "school_not_specified||unknown";
const MAX_QUESTIONS_PER_WEEK = 3;

async function refreshSchoolRating(client: PoolClient, schoolId: string) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count, AVG(rating)::numeric(3,2) AS avg
     FROM school_reviews
     WHERE school_id = $1 AND hidden = false`,
    [schoolId]
  );
  await client.query(
    `UPDATE schools SET rating_count = $2, rating_avg = $3, updated_at = now()
     WHERE id = $1`,
    [schoolId, rows[0].count, rows[0].avg]
  );
}

async function childAtSchool(
  client: PoolClient,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM children ch
     JOIN schools s ON s.id = ch.school_id
     WHERE ch.user_id = $1 AND ch.school_id = $2
       AND s.normalized_key <> $3
     LIMIT 1`,
    [userId, schoolId, PLACEHOLDER_SCHOOL_KEY]
  );
  return rows.length > 0;
}

async function findSchoolCircle(
  client: PoolClient,
  schoolId: string
): Promise<string | null> {
  const { rows } = await client.query(
    `SELECT id FROM circles
     WHERE circle_type = 'school'
       AND metadata->>'school_id' = $1
     LIMIT 1`,
    [schoolId]
  );
  return rows[0]?.id ?? null;
}

function mapProfile(row: Record<string, unknown>) {
  const ratingCount = Number(row.rating_count ?? 0);
  return {
    ...mapSchoolRow(row),
    boardCodes: row.board_codes ?? [],
    gradesOffered: row.grades_offered,
    transportAvailable: row.transport_available,
    ratingAvg: ratingCount >= 3 ? Number(row.rating_avg) : null,
    ratingCount,
  };
}

export function createSchoolsRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/search", async (c) => {
    const q = c.req.query("q")?.trim() ?? "";
    const city = c.req.query("city")?.trim();
    const pin = c.req.query("pin")?.trim();
    const limit = Math.min(Number(c.req.query("limit") ?? 15), 30);

    if (q.length < 2) {
      return c.json([]);
    }

    const client = await pool.connect();
    try {
      const pattern = `%${q}%`;
      const prefix = `${q}%`;

      const { rows } = await client.query(
        `SELECT id, name, branch, city, state, pin_code, verified,
                CASE
                  WHEN name ILIKE $2 THEN 0
                  WHEN branch ILIKE $2 THEN 1
                  WHEN name ILIKE $1 THEN 2
                  ELSE 3
                END AS rank_bucket,
                similarity(coalesce(name, '') || ' ' || coalesce(branch, ''), $3) AS sm
         FROM schools
         WHERE normalized_key <> 'school_not_specified||unknown'
           AND (
             name ILIKE $1 OR branch ILIKE $1 OR city ILIKE $1
             OR name % $3 OR branch % $3
           )
           AND ($4::text IS NULL OR city ILIKE $4 OR pin_code = $5)
         ORDER BY rank_bucket, sm DESC, name
         LIMIT $6`,
        [pattern, prefix, q, city ?? null, pin ?? null, limit]
      );

      return c.json(rows.map(mapSchoolRow));
    } finally {
      client.release();
    }
  });

  app.get("/compare", async (c) => {
    const idsParam = c.req.query("ids")?.trim();
    if (!idsParam) {
      return c.json({ error: "ids query param is required" }, 400);
    }
    const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length < 2 || ids.length > 3) {
      return c.json({ error: "Provide 2 or 3 school ids" }, 400);
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, name, branch, city, state, pin_code, verified,
                board_codes, grades_offered, transport_available,
                rating_avg, rating_count
         FROM schools
         WHERE id = ANY($1::uuid[])
           AND normalized_key <> $2`,
        [ids, PLACEHOLDER_SCHOOL_KEY]
      );
      return c.json(rows.map(mapProfile));
    } finally {
      client.release();
    }
  });

  app.get("/questions/:questionId", async (c) => {
    const userId = c.get("user").sub;
    const questionId = c.req.param("questionId");
    const client = await pool.connect();
    try {
      const question = await client.query(
        `SELECT sq.id, sq.body, sq.created_at, sq.circle_post_id, sq.school_id,
                s.name AS school_name
         FROM school_questions sq
         JOIN schools s ON s.id = sq.school_id
         WHERE sq.id = $1 AND sq.asker_id = $2`,
        [questionId, userId]
      );
      if (question.rows.length === 0 || !question.rows[0].circle_post_id) {
        return c.json({ error: "Question not found" }, 404);
      }

      const postId = question.rows[0].circle_post_id;
      const post = await client.query(
        `SELECT p.id, p.body, p.created_at, u.anonymous_handle
         FROM circle_posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.id = $1`,
        [postId]
      );

      const replies = await client.query(
        `SELECT r.id, r.body, r.created_at, u.anonymous_handle
         FROM circle_post_replies r
         JOIN users u ON u.id = r.author_id
         WHERE r.post_id = $1
         ORDER BY r.created_at ASC`,
        [postId]
      );

      return c.json({
        id: question.rows[0].id,
        schoolId: question.rows[0].school_id,
        schoolName: question.rows[0].school_name,
        body: question.rows[0].body,
        createdAt: question.rows[0].created_at,
        post: post.rows[0]
          ? {
              id: post.rows[0].id,
              body: post.rows[0].body,
              createdAt: post.rows[0].created_at,
              authorHandle: post.rows[0].anonymous_handle,
            }
          : null,
        replies: replies.rows.map((row) => ({
          id: row.id,
          body: row.body,
          createdAt: row.created_at,
          authorHandle: row.anonymous_handle,
        })),
      });
    } finally {
      client.release();
    }
  });

  app.post("/", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      name?: string;
      branch?: string;
      city?: string;
      state?: string;
      pinCode?: string;
    }>();

    const name = body.name?.trim();
    const branch = body.branch?.trim() || null;
    const city = body.city?.trim();
    const state = body.state?.trim() || null;
    const pinCode = body.pinCode?.trim() || null;

    if (!name || !city) {
      return c.json({ error: "name and city are required" }, 400);
    }
    if (!branch) {
      return c.json({ error: "branch is required (area / locality of the school)" }, 400);
    }

    const normalizedKey = buildSchoolNormalizedKey(name, branch, city);
    const client = await pool.connect();
    try {
      const existing = await client.query(
        `SELECT id, name, branch, city, state, pin_code, verified
         FROM schools WHERE normalized_key = $1`,
        [normalizedKey]
      );
      if (existing.rows.length > 0) {
        return c.json(mapSchoolRow(existing.rows[0]));
      }

      const { rows } = await client.query(
        `INSERT INTO schools (name, branch, city, state, pin_code, normalized_key, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, branch, city, state, pin_code, verified`,
        [name, branch, city, state, pinCode, normalizedKey, userId]
      );

      return c.json(mapSchoolRow(rows[0]), 201);
    } finally {
      client.release();
    }
  });

  app.get("/:id/profile", async (c) => {
    const schoolId = c.req.param("id");
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, name, branch, city, state, pin_code, verified,
                board_codes, grades_offered, transport_available,
                rating_avg, rating_count
         FROM schools
         WHERE id = $1 AND normalized_key <> $2`,
        [schoolId, PLACEHOLDER_SCHOOL_KEY]
      );
      if (rows.length === 0) {
        return c.json({ error: "School not found" }, 404);
      }
      return c.json(mapProfile(rows[0]));
    } finally {
      client.release();
    }
  });

  app.get("/:id/reviews", async (c) => {
    const schoolId = c.req.param("id");
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT sr.id, sr.rating, sr.body, sr.attendance_verified,
                sr.academic_year, sr.created_at, u.anonymous_handle, u.id AS author_id
         FROM school_reviews sr
         JOIN users u ON u.id = sr.author_id
         WHERE sr.school_id = $1 AND sr.hidden = false
         ORDER BY sr.created_at DESC
         LIMIT 50`,
        [schoolId]
      );

      const reviews = await Promise.all(
        rows.map(async (row) => {
          const author = await buildReviewAuthorView(
            client,
            row.author_id,
            row.anonymous_handle
          );
          return {
            id: row.id,
            rating: row.rating,
            body: row.body,
            attendanceVerified: row.attendance_verified,
            academicYear: row.academic_year,
            createdAt: row.created_at,
            author: {
              anonymousHandle: author.anonymousHandle,
              contextLabel: author.contextLabel,
            },
          };
        })
      );

      return c.json({ reviews });
    } finally {
      client.release();
    }
  });

  app.post("/:id/reviews", async (c) => {
    const userId = c.get("user").sub;
    const schoolId = c.req.param("id");
    const body = await c.req.json<{ rating?: number; reviewBody?: string; academicYear?: string }>();

    const rating = body.rating;
    if (rating == null || rating < 1 || rating > 5) {
      return c.json({ error: "rating must be between 1 and 5" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const school = await client.query(
        `SELECT id FROM schools WHERE id = $1 AND normalized_key <> $2`,
        [schoolId, PLACEHOLDER_SCHOOL_KEY]
      );
      if (school.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "School not found" }, 404);
      }

      const verified = await childAtSchool(client, userId, schoolId);
      await client.query(
        `INSERT INTO school_reviews
           (school_id, author_id, rating, body, attendance_verified, academic_year, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (school_id, author_id) DO UPDATE SET
           rating = EXCLUDED.rating,
           body = EXCLUDED.body,
           attendance_verified = EXCLUDED.attendance_verified,
           academic_year = EXCLUDED.academic_year,
           updated_at = now()`,
        [
          schoolId,
          userId,
          rating,
          body.reviewBody?.trim() || null,
          verified,
          body.academicYear?.trim() || currentAcademicYear(),
        ]
      );

      await refreshSchoolRating(client, schoolId);
      await client.query("COMMIT");
      return c.json({ ok: true }, 201);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/:id/fees", async (c) => {
    const schoolId = c.req.param("id");
    const academicYear = c.req.query("year")?.trim() || currentAcademicYear();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT academic_year,
                tuition_amount, transport_amount, books_uniform_amount, other_amount,
                created_at
         FROM school_fee_reports
         WHERE school_id = $1`,
        [schoolId]
      );

      const currentRows = rows.filter(
        (row) =>
          row.academic_year === academicYear && isFeeYearInRange(row.academic_year)
      );
      const totals = currentRows.map((row) => ({
        total: totalFeeAmount(row),
        createdAt: row.created_at,
      }));

      let currentRange: {
        min: number;
        max: number;
        reportedCount: number;
        latestReportedAt: string | null;
        academicYear: string;
      } | null = null;

      if (totals.length >= 3) {
        const sorted = totals.map((t) => t.total).sort((a, b) => a - b);
        const p25 = sorted[Math.floor(sorted.length * 0.25)];
        const p75 = sorted[Math.floor(sorted.length * 0.75)];
        currentRange = {
          min: p25,
          max: p75,
          reportedCount: totals.length,
          latestReportedAt: totals.reduce((latest, row) =>
            !latest || new Date(row.createdAt) > new Date(latest)
              ? row.createdAt
              : latest,
          null as string | null),
          academicYear,
        };
      }

      const history = [...new Set(rows.map((r) => r.academic_year as string))]
        .filter(isFeeYearInRange)
        .sort()
        .reverse()
        .map((year) => {
          const yearRows = rows.filter((r) => r.academic_year === year);
          const yearTotals = yearRows.map((r) => totalFeeAmount(r));
          if (yearTotals.length < 3) {
            return { academicYear: year, reportedCount: yearTotals.length };
          }
          const sorted = yearTotals.sort((a, b) => a - b);
          return {
            academicYear: year,
            reportedCount: yearTotals.length,
            min: sorted[Math.floor(sorted.length * 0.25)],
            max: sorted[Math.floor(sorted.length * 0.75)],
          };
        });

      return c.json({ current: currentRange, history });
    } finally {
      client.release();
    }
  });

  app.post("/:id/fees", async (c) => {
    const userId = c.get("user").sub;
    const schoolId = c.req.param("id");
    const body = await c.req.json<{
      gradeId?: string;
      academicYear?: string;
      tuitionAmount?: number;
      transportAmount?: number;
      booksUniformAmount?: number;
      otherAmount?: number;
    }>();

    if (body.tuitionAmount == null || body.tuitionAmount < 0) {
      return c.json({ error: "tuitionAmount is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const verified = await childAtSchool(client, userId, schoolId);
      if (!verified) {
        return c.json({ error: "Link a child at this school to report fees" }, 403);
      }

      await client.query(
        `INSERT INTO school_fee_reports
           (school_id, reporter_id, grade_id, academic_year,
            tuition_amount, transport_amount, books_uniform_amount, other_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (school_id, reporter_id, academic_year, grade_id) DO UPDATE SET
           tuition_amount = EXCLUDED.tuition_amount,
           transport_amount = EXCLUDED.transport_amount,
           books_uniform_amount = EXCLUDED.books_uniform_amount,
           other_amount = EXCLUDED.other_amount`,
        [
          schoolId,
          userId,
          body.gradeId ?? null,
          body.academicYear?.trim() || currentAcademicYear(),
          body.tuitionAmount,
          body.transportAmount ?? null,
          body.booksUniformAmount ?? null,
          body.otherAmount ?? null,
        ]
      );

      return c.json({ ok: true }, 201);
    } finally {
      client.release();
    }
  });

  app.post("/:id/questions", async (c) => {
    const userId = c.get("user").sub;
    const schoolId = c.req.param("id");
    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();
    if (!text) {
      return c.json({ error: "body is required" }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const weekly = await client.query(
        `SELECT COUNT(*)::int AS count FROM school_questions
         WHERE asker_id = $1 AND created_at > now() - interval '7 days'`,
        [userId]
      );
      if (weekly.rows[0].count >= MAX_QUESTIONS_PER_WEEK) {
        await client.query("ROLLBACK");
        return c.json({ error: "Question limit reached for this week" }, 400);
      }

      const school = await client.query(
        `SELECT id FROM schools WHERE id = $1 AND normalized_key <> $2`,
        [schoolId, PLACEHOLDER_SCHOOL_KEY]
      );
      if (school.rows.length === 0) {
        await client.query("ROLLBACK");
        return c.json({ error: "School not found" }, 404);
      }

      const circleId = await findSchoolCircle(client, schoolId);
      if (!circleId) {
        await client.query("ROLLBACK");
        return c.json({ error: "No school circle exists yet for this school" }, 400);
      }

      const userRow = await client.query(
        "SELECT anonymous_handle FROM users WHERE id = $1",
        [userId]
      );

      const post = await client.query(
        `INSERT INTO circle_posts (circle_id, author_id, body, tag)
         VALUES ($1, $2, $3, 'question')
         RETURNING id`,
        [circleId, userId, `[Prospective parent] ${text}`]
      );

      await client.query(
        `INSERT INTO circle_post_targets (post_id, circle_id, is_primary)
         VALUES ($1, $2, true)`,
        [post.rows[0].id, circleId]
      );

      const question = await client.query(
        `INSERT INTO school_questions (school_id, asker_id, body, circle_post_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [schoolId, userId, text, post.rows[0].id]
      );

      await client.query("COMMIT");

      return c.json(
        {
          id: question.rows[0].id,
          createdAt: question.rows[0].created_at,
          authorHandle: userRow.rows[0].anonymous_handle,
        },
        201
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.get("/:id/events", async (c) => {
    const userId = c.get("user").sub;
    const schoolId = c.req.param("id");
    const from = c.req.query("from");
    const to = c.req.query("to");

    const client = await pool.connect();
    try {
      const grades = await client.query(
        `SELECT DISTINCT ch.grade_id FROM children ch
         WHERE ch.user_id = $1 AND ch.school_id = $2`,
        [userId, schoolId]
      );
      const gradeIds = grades.rows.map((r) => r.grade_id);

      let query = `
        SELECT e.* FROM school_events e
        WHERE e.school_id = $1 AND e.hidden = false`;
      const params: unknown[] = [schoolId];
      let idx = 2;

      if (gradeIds.length > 0) {
        query += ` AND (e.grade_id IS NULL OR e.grade_id = ANY($${idx}::uuid[]))`;
        params.push(gradeIds);
        idx++;
      }

      if (from) {
        query += ` AND e.starts_at >= $${idx}::timestamptz`;
        params.push(from);
        idx++;
      }
      if (to) {
        query += ` AND e.starts_at <= $${idx}::timestamptz`;
        params.push(to);
        idx++;
      }

      query += ` ORDER BY e.starts_at ASC LIMIT 100`;

      const { rows } = await client.query(query, params);
      return c.json(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          eventType: row.event_type,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          allDay: row.all_day,
          source: row.source,
          confirmedCount: row.confirmed_count,
          disputedCount: row.disputed_count,
          unconfirmed:
            row.source === "parent_reported" && row.confirmed_count < 3,
          needsReview: row.disputed_count >= 2,
        }))
      );
    } finally {
      client.release();
    }
  });

  app.post("/:id/events", async (c) => {
    const userId = c.get("user").sub;
    const schoolId = c.req.param("id");
    const body = await c.req.json<{
      title?: string;
      description?: string;
      eventType?: string;
      startsAt?: string;
      endsAt?: string;
      allDay?: boolean;
      gradeId?: string;
    }>();

    const title = body.title?.trim();
    if (!title || !body.startsAt || !body.eventType) {
      return c.json({ error: "title, eventType and startsAt are required" }, 400);
    }

    const client = await pool.connect();
    try {
      const atSchool = await childAtSchool(client, userId, schoolId);
      if (!atSchool) {
        return c.json({ error: "Link a child at this school to report events" }, 403);
      }

      const { rows } = await client.query(
        `INSERT INTO school_events
           (school_id, grade_id, title, description, event_type,
            starts_at, ends_at, all_day, source, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'parent_reported', $9)
         RETURNING id`,
        [
          schoolId,
          body.gradeId ?? null,
          title,
          body.description?.trim() || null,
          body.eventType,
          body.startsAt,
          body.endsAt ?? null,
          body.allDay ?? false,
          userId,
        ]
      );

      return c.json({ id: rows[0].id }, 201);
    } finally {
      client.release();
    }
  });

  return app;
}
