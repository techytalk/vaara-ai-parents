import { Hono } from "hono";
import { pool } from "@vaara/db";
import {
  buildPathwayContext,
  buildPathwayHub,
  getPathwayItemBySlug,
  getPathwayLinksForSlug,
  parseStageId,
  type HubStream,
} from "@vaara/shared/pathways";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import {
  askOnPathNode,
  findCurriculumCircle,
  listPathDiscussions,
  loadExploreNodes,
  matchExploreRoot,
  nudgePathThread,
} from "../services/path-explore.js";

const HUB_STREAMS = new Set<HubStream>([
  "pcm",
  "pcb",
  "pcmb",
  "commerce",
  "arts",
  "vocational",
  "undecided",
]);

function parseStream(raw: string | undefined): HubStream {
  if (raw && HUB_STREAMS.has(raw as HubStream)) return raw as HubStream;
  return "undecided";
}

type ChildRow = {
  id: string;
  nickname: string | null;
  track: string;
  curriculum_code: string | null;
  curriculum_name: string | null;
  grade_code: string | null;
  grade_label: string | null;
  school_state: string | null;
};

async function loadSchoolAgeChildren(userId: string): Promise<ChildRow[]> {
  const { rows } = await pool.query(
    `SELECT ch.id, ch.nickname, ch.track,
            c.code AS curriculum_code, c.name AS curriculum_name,
            g.code AS grade_code, g.label AS grade_label,
            s.state AS school_state
     FROM children ch
     JOIN schools s ON s.id = ch.school_id
     LEFT JOIN curricula c ON c.id = ch.curriculum_id
     LEFT JOIN curriculum_grades g ON g.id = ch.grade_id
     WHERE ch.user_id = $1
       AND ch.track = 'school'
       AND c.code IS NOT NULL
     ORDER BY ch.created_at ASC`,
    [userId]
  );
  return rows as ChildRow[];
}

function pickChild(
  children: ChildRow[],
  childId: string | undefined
): ChildRow | null {
  const requestedId = childId?.trim().toLowerCase() || null;
  if (!requestedId) return children[0] ?? null;
  return (
    children.find((row) => String(row.id).toLowerCase() === requestedId) ??
    null
  );
}

async function loadLocationState(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT state FROM user_locations WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return (rows[0]?.state as string | null | undefined) ?? null;
}

export function createPathwaysRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", authMiddleware);

  app.get("/hub", async (c) => {
    const userId = c.get("user").sub;
    const childIdParam = c.req.query("childId");
    const stream = parseStream(c.req.query("stream"));
    const stateOverride = c.req.query("state");
    const stageOverride = parseStageId(c.req.query("stage"));

    const [children, locationState] = await Promise.all([
      loadSchoolAgeChildren(userId),
      loadLocationState(userId),
    ]);

    if (children.length === 0) {
      return c.json(
        {
          error:
            "Add a school-age child with a board to open Child's Path.",
        },
        404
      );
    }

    const requestedId = childIdParam?.trim().toLowerCase() || null;
    const child =
      (requestedId
        ? children.find((row) => String(row.id).toLowerCase() === requestedId)
        : null) ?? (requestedId ? null : children[0]);

    if (!child) {
      return c.json({ error: "Child not found" }, 404);
    }

    const context = buildPathwayContext({
      childId: child.id,
      childNickname: child.nickname,
      curriculumCode: child.curriculum_code,
      curriculumName: child.curriculum_name,
      gradeCode: child.grade_code,
      gradeLabel: child.grade_label,
      track: "school",
      locationState: stateOverride || locationState,
      schoolState: child.school_state,
      stream,
      stageOverride,
    });

    if (!context) {
      return c.json(
        {
          error:
            "This child's board is not supported in Child's Path yet.",
        },
        404
      );
    }

    const hub = buildPathwayHub(context);

    return c.json({
      ...hub,
      children: children.map((row) => ({
        id: String(row.id),
        nickname: row.nickname,
        curriculumCode: row.curriculum_code,
        curriculumName: row.curriculum_name,
        gradeLabel: row.grade_label,
      })),
    });
  });

  app.get("/explore", async (c) => {
    const userId = c.get("user").sub;
    const childIdParam = c.req.query("childId");
    const [children, locationState] = await Promise.all([
      loadSchoolAgeChildren(userId),
      loadLocationState(userId),
    ]);
    if (children.length === 0) {
      return c.json(
        { error: "Add a school-age child with a board to open Child's Path." },
        404
      );
    }
    const child = pickChild(children, childIdParam);
    if (!child?.curriculum_code) {
      return c.json({ error: "Child not found" }, 404);
    }
    const context = buildPathwayContext({
      childId: child.id,
      childNickname: child.nickname,
      curriculumCode: child.curriculum_code,
      curriculumName: child.curriculum_name,
      gradeCode: child.grade_code,
      gradeLabel: child.grade_label,
      track: "school",
      locationState,
      schoolState: child.school_state,
      stream: "undecided",
    });
    if (!context) {
      return c.json(
        { error: "This child's board is not supported in Child's Path yet." },
        404
      );
    }
    const client = await pool.connect();
    try {
      const root = await matchExploreRoot(client, {
        family: context.family,
        curriculumCode: child.curriculum_code,
        gradeCode: child.grade_code,
        stage: context.primaryStage,
        includeAfter10Fork: context.includeAfter10Fork,
      });
      if (!root) {
        return c.json(
          {
            error:
              "A path for this grade is not published yet. Exploring does not change your child’s profile.",
          },
          404
        );
      }
      const nodes = await loadExploreNodes(client, root.id, context.stateCode);
      const circle = await findCurriculumCircle(
        client,
        userId,
        child.curriculum_code
      );
      return c.json({
        context,
        locationTitle: `${context.boardLabel} · ${context.gradeLabel}`,
        locationMeta: context.stageLead,
        lockLine: "Exploring does not change your child’s profile.",
        postingCircle: circle,
        nodes,
        children: children.map((row) => ({
          id: String(row.id),
          nickname: row.nickname,
          curriculumCode: row.curriculum_code,
          curriculumName: row.curriculum_name,
          gradeLabel: row.grade_label,
        })),
      });
    } finally {
      client.release();
    }
  });

  app.get("/nodes/:id/discussions", async (c) => {
    const userId = c.get("user").sub;
    const nodeId = c.req.param("id");
    const client = await pool.connect();
    try {
      const discussions = await listPathDiscussions(client, userId, nodeId);
      return c.json({ discussions });
    } finally {
      client.release();
    }
  });

  app.post("/ask", async (c) => {
    const userId = c.get("user").sub;
    const body = await c.req.json<{
      childId?: string;
      nodeId?: string;
      body?: string;
    }>();
    if (!body.nodeId || !body.body?.trim()) {
      return c.json({ error: "A question is required" }, 400);
    }
    const children = await loadSchoolAgeChildren(userId);
    const child = pickChild(children, body.childId);
    if (!child?.curriculum_code) {
      return c.json({ error: "Child not found" }, 404);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await askOnPathNode(client, {
        userId,
        nodeId: body.nodeId,
        body: body.body,
        curriculumCode: child.curriculum_code,
      });
      if ("error" in result) {
        await client.query("ROLLBACK");
        const status =
          result.status === 400 ||
          result.status === 403 ||
          result.status === 404 ||
          result.status === 500
            ? result.status
            : 400;
        return c.json({ error: result.error }, status);
      }
      await client.query("COMMIT");
      await nudgePathThread({
        circleId: result.circleId,
        threadId: result.threadId,
        authorId: userId,
      });
      return c.json(result, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/items/:slug", async (c) => {
    const slug = c.req.param("slug");
    const item = getPathwayItemBySlug(slug);
    if (!item || item.status === "draft") {
      return c.json({ error: "Pathway item not found" }, 404);
    }
    const links = getPathwayLinksForSlug(slug);
    const related = links
      .map((link) => {
        const otherSlug =
          link.fromSlug === slug ? link.toSlug : link.fromSlug;
        const other = getPathwayItemBySlug(otherSlug);
        if (!other || other.status === "draft") return null;
        return {
          rel: link.rel,
          slug: other.slug,
          title: other.title,
          summary: other.summary,
          kind: other.kind,
        };
      })
      .filter(Boolean);

    return c.json({ item, related });
  });

  return app;
}
