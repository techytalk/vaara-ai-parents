import { Hono } from "hono";
import { pool } from "@vaara/db";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";

export function createExpertSessionRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/", async (c) => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT s.id, s.title, s.description, s.status, s.starts_at, s.ends_at,
                e.display_name, e.credentials, e.verified
         FROM expert_sessions s
         JOIN experts e ON e.id = s.expert_id
         ORDER BY s.starts_at DESC
         LIMIT 50`
      );
      return c.json(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          expert: {
            displayName: row.display_name,
            credentials: row.credentials,
            verified: row.verified,
          },
        }))
      );
    } finally {
      client.release();
    }
  });

  app.get("/:id", async (c) => {
    const sessionId = c.req.param("id");
    const client = await pool.connect();
    try {
      const session = await client.query(
        `SELECT s.*, e.display_name, e.credentials, e.bio, e.verified, e.user_id AS expert_user_id
         FROM expert_sessions s
         JOIN experts e ON e.id = s.expert_id
         WHERE s.id = $1`,
        [sessionId]
      );
      if (session.rows.length === 0) {
        return c.json({ error: "Session not found" }, 404);
      }
      const s = session.rows[0];

      const questions = await client.query(
        `SELECT sq.id, sq.body, sq.upvote_count, sq.answer_body, sq.answered_at,
                sq.created_at, u.anonymous_handle
         FROM session_questions sq
         JOIN users u ON u.id = sq.asker_id
         WHERE sq.session_id = $1 AND sq.hidden = false
         ORDER BY sq.upvote_count DESC, sq.created_at ASC`,
        [sessionId]
      );

      return c.json({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        expert: {
          displayName: s.display_name,
          credentials: s.credentials,
          bio: s.bio,
          verified: s.verified,
        },
        questions: questions.rows.map((q) => ({
          id: q.id,
          body: q.body,
          upvoteCount: q.upvote_count,
          answerBody: q.answer_body,
          answeredAt: q.answered_at,
          createdAt: q.created_at,
          askerHandle: q.anonymous_handle,
        })),
      });
    } finally {
      client.release();
    }
  });

  app.post("/:id/questions", async (c) => {
    const userId = c.get("user").sub;
    const sessionId = c.req.param("id");
    const body = await c.req.json<{ body?: string }>();
    const text = body.body?.trim();
    if (!text) {
      return c.json({ error: "body is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const session = await client.query(
        `SELECT id, status FROM expert_sessions WHERE id = $1`,
        [sessionId]
      );
      if (
        session.rows.length === 0 ||
        !["announced", "collecting", "live"].includes(session.rows[0].status)
      ) {
        return c.json({ error: "Session not accepting questions" }, 400);
      }

      const { rows } = await client.query(
        `INSERT INTO session_questions (session_id, asker_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [sessionId, userId, text]
      );
      return c.json({ id: rows[0].id, createdAt: rows[0].created_at }, 201);
    } finally {
      client.release();
    }
  });

  app.post("/questions/:questionId/upvote", async (c) => {
    const userId = c.get("user").sub;
    const questionId = c.req.param("questionId");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO session_question_votes (question_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING question_id`,
        [questionId, userId]
      );
      if (inserted.rows.length > 0) {
        await client.query(
          `UPDATE session_questions SET upvote_count = upvote_count + 1
           WHERE id = $1`,
          [questionId]
        );
      }
      await client.query("COMMIT");
      return c.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.post("/questions/:questionId/answer", async (c) => {
    const userId = c.get("user").sub;
    const questionId = c.req.param("questionId");
    const body = await c.req.json<{ answerBody?: string }>();
    const answer = body.answerBody?.trim();
    if (!answer) {
      return c.json({ error: "answerBody is required" }, 400);
    }

    const client = await pool.connect();
    try {
      const q = await client.query(
        `SELECT sq.id, e.user_id
         FROM session_questions sq
         JOIN expert_sessions s ON s.id = sq.session_id
         JOIN experts e ON e.id = s.expert_id
         WHERE sq.id = $1`,
        [questionId]
      );
      if (q.rows.length === 0 || q.rows[0].user_id !== userId) {
        return c.json({ error: "Not authorized" }, 403);
      }

      await client.query(
        `UPDATE session_questions
         SET answer_body = $2, answered_at = now()
         WHERE id = $1`,
        [questionId, answer]
      );
      return c.json({ ok: true });
    } finally {
      client.release();
    }
  });

  return app;
}
