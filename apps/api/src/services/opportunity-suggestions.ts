import type { PoolClient } from "pg";
import { eligibilityCoversGrade } from "./opportunity-match.js";

export async function rebuildOpportunitySuggestions(
  client: PoolClient
): Promise<{ inserted: number }> {
  await client.query("BEGIN");
  try {
    await client.query(`DELETE FROM opportunity_suggestion_buckets`);
    const grades = await client.query(
      `SELECT g.id AS grade_id, g.code, g.curriculum_id, s.state
       FROM curriculum_grades g
       JOIN children ch ON ch.grade_id = g.id
       JOIN schools s ON s.id = ch.school_id
       WHERE ch.track = 'school' AND s.state IS NOT NULL
       GROUP BY g.id, g.code, g.curriculum_id, s.state`
    );
    const exams = await client.query(
      `SELECT o.id AS opportunity_id, e.id AS edition_id, e.eligibility_summary,
              e.scope_level,
              (SELECT l.state_code FROM opportunity_locations l
                WHERE l.edition_id = e.id AND l.role = 'eligibility_school'
                ORDER BY l.created_at LIMIT 1) AS state_code
       FROM opportunities o
       JOIN opportunity_editions e ON e.opportunity_id = o.id
       WHERE o.publication_status = 'published'
         AND e.publication_status = 'published'`
    );
    let inserted = 0;
    for (const grade of grades.rows) {
      const state = String(grade.state || "").trim();
      if (!state || state.length > 16) continue;
      const match = String(grade.code || "").match(/^[GY](\d+)$/i);
      const n = match ? Number(match[1]) : null;
      if (n == null) continue;
      let rank = 0;
      for (const exam of exams.rows) {
        if (!eligibilityCoversGrade(exam.eligibility_summary as string | null, n)) continue;
        if (exam.scope_level === "state") {
          const school = state.toLowerCase();
          const edition = String(exam.state_code || "").trim().toLowerCase();
          if (!edition || (school !== edition && !school.includes(edition) && !edition.includes(school))) {
            continue;
          }
        }
        await client.query(
          `INSERT INTO opportunity_suggestion_buckets (
             curriculum_id, curriculum_grade_id, state_code, opportunity_id, edition_id, rank, reason_code
           ) VALUES ($1, $2, $3, $4, $5, $6, 'class_state_match')
           ON CONFLICT DO NOTHING`,
          [
            grade.curriculum_id,
            grade.grade_id,
            state,
            exam.opportunity_id,
            exam.edition_id,
            rank,
          ]
        );
        rank += 1;
        inserted += 1;
      }
    }
    await client.query("COMMIT");
    return { inserted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
