import { Hono } from "hono";
import { pool } from "@vaara/db";

export function createReferenceRoutes() {
  const app = new Hono();

  app.get("/curricula", async (c) => {
    const client = await pool.connect();
    try {
      const { rows: curricula } = await client.query(
        `SELECT id, code, name, sort_order FROM curricula ORDER BY sort_order`
      );

      const { rows: grades } = await client.query(
        `SELECT id, curriculum_id, code, label, sort_order
         FROM curriculum_grades ORDER BY sort_order`
      );

      const gradesByCurriculum = new Map<string, typeof grades>();
      for (const g of grades) {
        const list = gradesByCurriculum.get(g.curriculum_id) ?? [];
        list.push(g);
        gradesByCurriculum.set(g.curriculum_id, list);
      }

      return c.json(
        curricula.map((cur) => ({
          id: cur.id,
          code: cur.code,
          name: cur.name,
          grades: (gradesByCurriculum.get(cur.id) ?? []).map((g) => ({
            id: g.id,
            code: g.code,
            label: g.label,
          })),
        }))
      );
    } finally {
      client.release();
    }
  });

  return app;
}
