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
  mapSchoolListRow,
  mapSchoolRow,
} from "../lib/school.js";
import {
  getIdempotentResponse,
  reserveIdempotencyKey,
  storeIdempotentResponse,
} from "../lib/idempotency.js";
import {
  issueSchoolCreateConfirmToken,
  verifySchoolCreateConfirmToken,
} from "../lib/school-create-confirm.js";
import { schoolVisiblePredicate, schoolNotRedirected } from "../lib/school-visibility.js";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";
import { createThread, publishChatNudge } from "../services/chat.js";
import { incrementDailyQuota, isCircleMember } from "../services/chat-access.js";
import { syncCircleMembership } from "../services/circle-sync.js";
import { userHasRole } from "../lib/user-roles.js";

const PLACEHOLDER_SCHOOL_KEY = "school_not_specified||unknown";
const SCHOOL_DEDUPE_HEADER = "x-vaara-school-dedupe";
const SCHOOL_DEDUPE_CAPABILITY = "candidates-v1";

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
    const userId = c.get("user").sub;
    const q = c.req.query("q")?.trim() ?? "";
    const city = c.req.query("city")?.trim();
    const pin = c.req.query("pin")?.trim();
    const sort = c.req.query("sort") === "rating" ? "rating" : "relevance";
    const limit = Math.min(Number(c.req.query("limit") ?? 15), 30);
    const list = c.req.query("list")?.trim();
    // list=preschool | school | preschool_campus
    const kindClause =
      list === "preschool"
        ? `AND s.kind = 'preschool'`
        : list === "preschool_campus"
          ? `AND s.kind = 'school' AND s.offers_preschool = true`
          : list === "school"
            ? `AND s.kind = 'school'`
            : "";

    if (q.length < 2) {
      return c.json([]);
    }

    const started = Date.now();
    const client = await pool.connect();
    try {
      const pattern = `%${q}%`;
      const prefix = `${q}%`;
      const visible = schoolVisiblePredicate(7);
      const notRedirected = schoolNotRedirected("s");

      const locationRank = `CASE
             WHEN $5::text IS NOT NULL AND s.pin_code = $5 THEN 0
             WHEN $4::text IS NOT NULL AND s.city ILIKE $4 THEN 1
             ELSE 2
           END`;
      const orderBy =
        sort === "rating"
          ? `${locationRank},
             s.verified DESC,
             CASE WHEN s.rating_count >= 3 THEN s.rating_avg END DESC NULLS LAST,
             s.rating_count DESC, rank_bucket, sm DESC, s.name`
          : `rank_bucket, sm DESC,
             ${locationRank}, s.verified DESC, s.name`;
      const { rows } = await client.query(
        `SELECT s.id, s.name, s.branch, s.city, s.state, s.pin_code, s.verified,
                s.rating_avg, s.rating_count, s.board_codes, s.locality, s.region, s.aliases,
                s.kind, s.offers_preschool,
                CASE
                  WHEN s.name ILIKE $2 THEN 0
                  WHEN s.search_text ILIKE $2 THEN 1
                  WHEN s.search_text ILIKE $1 THEN 2
                  ELSE 3
                END AS rank_bucket,
                similarity(s.search_text, $3) AS sm
         FROM schools s
         WHERE s.normalized_key <> 'school_not_specified||unknown'
           AND ${notRedirected}
           AND ${visible}
           ${kindClause}
           AND (
             s.search_text ILIKE $1
             OR s.search_text % $3
           )
         ORDER BY ${orderBy}
         LIMIT $6`,
        [pattern, prefix, q.toLowerCase(), city ?? null, pin ?? null, limit, userId]
      );

      console.log(
        JSON.stringify({
          event: "school_search",
          source: "authenticated",
          ms: Date.now() - started,
          results: rows.length,
          qLen: q.length,
          list: list ?? null,
        })
      );
      return c.json(rows.map(mapSchoolListRow));
    } finally {
      client.release();
    }
  });

  app.get("/nearby", async (c) => {
    const userId = c.get("user").sub;
    const requestedPin = c.req.query("pin")?.trim();
    const requestedCity = c.req.query("city")?.trim();
    const sort = c.req.query("sort") === "rating" ? "rating" : "nearby";
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 30);
    const client = await pool.connect();
    try {
      let pin = requestedPin;
      let city = requestedCity;

      if (!pin || !city) {
        const location = await client.query(
          `SELECT pin_code, city
           FROM user_locations
           WHERE user_id = $1`,
          [userId]
        );
        pin ||= location.rows[0]?.pin_code?.trim();
        city ||= location.rows[0]?.city?.trim();
      }

      if (!city) {
        const childSchool = await client.query(
          `SELECT s.city
           FROM children ch
           JOIN schools s ON s.id = ch.school_id
           WHERE ch.user_id = $1
             AND s.normalized_key <> $2
             AND s.city <> 'Unknown'
           ORDER BY ch.created_at
           LIMIT 1`,
          [userId, PLACEHOLDER_SCHOOL_KEY]
        );
        city = childSchool.rows[0]?.city?.trim();
      }

      if (!pin && !city) {
        return c.json(
          {
            error: "Add your pin code or city to discover nearby schools",
            code: "LOCATION_REQUIRED",
          },
          400
        );
      }

      const ratingOrder =
        sort === "rating"
          ? `CASE WHEN s.rating_count >= 3 THEN s.rating_avg END DESC NULLS LAST,
             s.rating_count DESC, s.verified DESC, s.name`
          : `s.verified DESC,
             CASE WHEN s.rating_count >= 3 THEN s.rating_avg END DESC NULLS LAST,
             s.name`;
      const { rows } = await client.query(
        `SELECT s.id, s.name, s.branch, s.city, s.state, s.pin_code, s.verified,
                s.rating_avg, s.rating_count, s.board_codes, s.locality, s.region, s.aliases
         FROM schools s
         WHERE s.normalized_key <> $1
           AND s.redirect_to_school_id IS NULL
           AND (s.verified = true OR s.created_by_user_id = $5)
           AND (
             ($2::text IS NOT NULL AND s.pin_code = $2)
             OR ($3::text IS NOT NULL AND s.city ILIKE $3)
           )
         ORDER BY
           CASE WHEN s.pin_code = $2 THEN 0 ELSE 1 END,
           ${ratingOrder}
         LIMIT $4`,
        [PLACEHOLDER_SCHOOL_KEY, pin ?? null, city ?? null, limit, userId]
      );

      return c.json(rows.map(mapSchoolListRow));
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
                s.name AS school_name,
                (
                  SELECT pct.circle_id FROM circle_post_targets pct
                  WHERE pct.post_id = sq.circle_post_id AND pct.is_primary
                  LIMIT 1
                ) AS circle_id
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
        `SELECT p.id, p.body, p.created_at, p.edited_at, u.anonymous_handle
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
        circleId: question.rows[0].circle_id ?? null,
        postId,
        post: post.rows[0]
          ? {
              id: post.rows[0].id,
              body: post.rows[0].body,
              createdAt: post.rows[0].created_at,
              editedAt: post.rows[0].edited_at ?? null,
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

  app.post(
    "/",
    rateLimitMiddleware({
      prefix: "school-create",
      limit: 10,
      windowSeconds: 3600,
    }),
    async (c) => {
      const userId = c.get("user").sub;
      const capability = c.req.header(SCHOOL_DEDUPE_HEADER)?.trim();
      const wantsCandidates = capability === SCHOOL_DEDUPE_CAPABILITY;
      const idempotencyKey =
        c.req.header("Idempotency-Key")?.trim() ||
        c.req.header("idempotency-key")?.trim() ||
        null;

      const body = await c.req.json<{
        name?: string;
        branch?: string;
        city?: string;
        state?: string;
        pinCode?: string;
        locality?: string;
        kind?: "preschool" | "school";
        offersPreschool?: boolean;
        confirmCreateToken?: string;
      }>();

      const name = body.name?.trim();
      const branch = body.branch?.trim() || null;
      const city = body.city?.trim();
      const state = body.state?.trim() || null;
      const pinCode = body.pinCode?.trim() || null;
      const locality = body.locality?.trim() || branch;
      const confirmCreateToken = body.confirmCreateToken?.trim() || null;
      const kind = body.kind === "preschool" ? "preschool" : "school";
      const offersPreschool =
        kind === "preschool" ? true : Boolean(body.offersPreschool);

      if (!name || !city) {
        return c.json({ error: "name and city are required" }, 400);
      }

      const normalizedKey = buildSchoolNormalizedKey(name, branch, city);
      const client = await pool.connect();
      try {
        // Replay completed responses only — do not reserve until final create.
        if (idempotencyKey) {
          const existingIdem = await getIdempotentResponse(
            client,
            userId,
            "POST /v1/schools",
            idempotencyKey
          );
          if (existingIdem && existingIdem.statusCode !== 409) {
            return c.json(
              existingIdem.response,
              existingIdem.statusCode as 200
            );
          }
          // Ignore incomplete reservations from the old buggy flow.
          if (
            existingIdem &&
            existingIdem.statusCode === 409 &&
            (existingIdem.response as { error?: string })?.error ===
              "Request in progress"
          ) {
            await client.query(
              `DELETE FROM api_idempotency_keys
               WHERE user_id = $1 AND route = $2 AND idempotency_key = $3
                 AND status_code IS NULL`,
              [userId, "POST /v1/schools", idempotencyKey]
            );
          }
        }

        const existing = await client.query(
          `SELECT id, name, branch, city, state, pin_code, verified, locality, region, aliases
           FROM schools
           WHERE normalized_key = $1 AND redirect_to_school_id IS NULL
           ORDER BY verified DESC, created_at ASC
           LIMIT 1`,
          [normalizedKey]
        );
        if (existing.rows.length > 0) {
          const mapped = mapSchoolRow(existing.rows[0]);
          if (idempotencyKey) {
            await storeIdempotentResponse(
              client,
              userId,
              "POST /v1/schools",
              idempotencyKey,
              200,
              mapped
            );
          }
          return c.json(mapped);
        }

        const searchNeedle = [name, branch, locality, city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const { rows: fuzzy } = await client.query(
          `SELECT id, name, branch, city, state, pin_code, verified, locality, region, aliases,
                  similarity(search_text, $1) AS sm
           FROM schools
           WHERE redirect_to_school_id IS NULL
             AND normalized_key <> $2
             AND search_text % $1
           ORDER BY verified DESC, sm DESC
           LIMIT 8`,
          [searchNeedle, PLACEHOLDER_SCHOOL_KEY]
        );

        const strong = fuzzy.find((row) => Number(row.sm) >= 0.72);
        if (strong) {
          // Strong matches always bind to existing school — no bypass.
          const mapped = mapSchoolRow(strong);
          if (idempotencyKey) {
            await storeIdempotentResponse(
              client,
              userId,
              "POST /v1/schools",
              idempotencyKey,
              200,
              mapped
            );
          }
          return c.json(mapped);
        }

        const weak = fuzzy.filter(
          (row) => Number(row.sm) >= 0.4 && Number(row.sm) < 0.72
        );

        if (weak.length > 0 && !confirmCreateToken) {
          const candidates = weak.map(mapSchoolRow);
          if (wantsCandidates) {
            const confirmationToken = issueSchoolCreateConfirmToken({
              userId,
              name,
              branch,
              city,
              locality,
              candidateIds: candidates.map((x) => String(x.id)),
            });
            return c.json(
              {
                error: "Possible existing schools",
                code: "SCHOOL_CANDIDATES",
                candidates,
                confirmationToken,
              },
              409
            );
          }
          console.log(
            JSON.stringify({
              event: "school_create_weak_match_legacy",
              userId,
              name,
              candidateIds: candidates.map((x) => x.id),
            })
          );
          // Legacy clients without capability continue to create.
        }

        if (weak.length > 0 && confirmCreateToken) {
          const verified = verifySchoolCreateConfirmToken(confirmCreateToken, {
            userId,
            name,
            branch,
            city,
            locality,
          });
          if (verified.ok === false) {
            return c.json({ error: verified.error }, 400);
          }
        }

        await client.query("BEGIN");
        try {
          if (idempotencyKey) {
            const reserved = await reserveIdempotencyKey(
              client,
              userId,
              "POST /v1/schools",
              idempotencyKey
            );
            if (reserved === "exists") {
              const again = await getIdempotentResponse(
                client,
                userId,
                "POST /v1/schools",
                idempotencyKey
              );
              await client.query("COMMIT");
              if (again && again.statusCode !== 409) {
                return c.json(again.response, again.statusCode as 200);
              }
              return c.json({ error: "Request in progress" }, 409);
            }
          }

          const { rows } = await client.query(
            `INSERT INTO schools
               (name, branch, city, state, pin_code, locality, normalized_key,
                created_by_user_id, verified, kind, offers_preschool)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)
             RETURNING id, name, branch, city, state, pin_code, verified, locality, region, aliases,
                       kind, offers_preschool`,
            [
              name,
              branch,
              city,
              state,
              pinCode,
              locality,
              normalizedKey,
              userId,
              kind,
              offersPreschool,
            ]
          );

          const mapped = mapSchoolRow(rows[0]);
          if (idempotencyKey) {
            await storeIdempotentResponse(
              client,
              userId,
              "POST /v1/schools",
              idempotencyKey,
              201,
              mapped
            );
          }
          await client.query("COMMIT");
          return c.json(mapped, 201);
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      } finally {
        client.release();
      }
    }
  );

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
      if (!(await userHasRole(client, userId, "parent"))) {
        await client.query("ROLLBACK");
        return c.json({ error: "Parent role required" }, 403);
      }
      await syncCircleMembership(client, userId);

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

      const member = await isCircleMember(client, circleId, userId);
      const guest = !member;
      if (guest && !(await incrementDailyQuota(client, userId, "guest_thread", 5))) {
        await client.query("ROLLBACK");
        return c.json({ error: "Guest thread daily limit reached" }, 429);
      }

      const result = await createThread({
        client,
        userId,
        circleId,
        title: text.slice(0, 140),
        body: text,
        kind: "question",
        homeVisibility: guest ? "member" : "discoverable",
        guest,
      });

      if ("error" in result) {
        await client.query("ROLLBACK");
        return c.json({ error: result.error }, result.status as 400 | 403 | 404 | 429);
      }

      const threadId = String(result.thread.id);

      const question = await client.query(
        `INSERT INTO school_questions (school_id, asker_id, body, circle_post_id)
         VALUES ($1, $2, $3, NULL)
         RETURNING id, created_at`,
        [schoolId, userId, text]
      );

      await client.query("COMMIT");

      await publishChatNudge({
        circleId,
        threadId,
        seq: Number(result.thread.created_seq ?? result.thread.last_activity_seq ?? 0),
        authorId: userId,
      });

      return c.json(
        {
          id: question.rows[0].id,
          createdAt: question.rows[0].created_at,
          authorHandle: userRow.rows[0].anonymous_handle,
          circleId,
          threadId,
          postId: null,
          guest,
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
