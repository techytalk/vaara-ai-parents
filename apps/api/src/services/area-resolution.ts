import { pool } from "@vaara/db";
import {
  areaNamesConflict,
  areaNamesSupportMatch,
  normalizePlace,
} from "../lib/areas/normalize.js";
import { syncCircleMembership } from "./circle-sync.js";

type Candidate = { id: string; canonical_name: string };

type ModelResult = {
  decision: "match" | "distinct" | "uncertain";
  matchName: string | null;
  confidence: number;
  secondConfidence: number;
};

const MODEL = "gemini-2.5-flash";

async function askModel(input: {
  areaName: string;
  city: string;
  state: string;
  countryCode: string;
  candidates: Candidate[];
}): Promise<ModelResult | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || input.candidates.length === 0) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Compare one locality name with candidate locality names in the same city. Reply with JSON only. Use match only when they are the same neighbourhood. Financial District, Nanakramguda, Rai Durg, and Gachibowli are different unless the names are obvious spelling variants. Never invent a name that is not in the candidate list.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  area: input.areaName,
                  country: input.countryCode,
                  city: input.city,
                  state: input.state,
                  candidates: input.candidates.map((item) => item.canonical_name),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              decision: { type: "STRING", enum: ["match", "distinct", "uncertain"] },
              matchName: { type: "STRING" },
              confidence: { type: "NUMBER" },
              secondConfidence: { type: "NUMBER" },
            },
            required: ["decision", "confidence"],
          },
        },
      }),
    }
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const parsed = JSON.parse(text) as ModelResult;
  if (parsed.decision !== "match" && parsed.decision !== "distinct" && parsed.decision !== "uncertain") {
    return null;
  }
  return parsed;
}

function canAutoMerge(rawName: string, result: ModelResult, candidates: Candidate[]): Candidate | null {
  if (result.decision !== "match" || !result.matchName) return null;
  if (result.confidence < 0.97) return null;
  if (result.confidence - (result.secondConfidence ?? 0) < 0.15) return null;
  const winner = candidates.find(
    (item) => item.canonical_name.toLowerCase() === result.matchName?.trim().toLowerCase()
  );
  if (!winner) return null;
  if (!areaNamesSupportMatch(rawName, winner.canonical_name)) return null;
  if (areaNamesConflict(rawName, winner.canonical_name)) return null;
  return winner;
}

export async function processPendingAreaResolutions(): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows: jobs } = await client.query<{
      id: string;
      area_id: string;
      attempts: number;
      canonical_name: string;
      city: string;
      state: string;
      country_code: string;
    }>(
      `SELECT j.id, j.area_id, j.attempts, a.canonical_name, a.city, a.state, a.country_code
       FROM area_resolution_jobs j
       JOIN areas a ON a.id = j.area_id
       WHERE j.status = 'pending'
         AND j.next_attempt_at <= now()
         AND a.status = 'pending_resolution'
       ORDER BY j.created_at
       LIMIT 5`
    );

    let finished = 0;
    for (const job of jobs) {
      const { rows: candidates } = await client.query<Candidate>(
        `SELECT id, canonical_name
         FROM areas
         WHERE country_code = $1
           AND lower(city) = lower($2)
           AND status = 'active'
           AND id <> $3
         ORDER BY canonical_name
         LIMIT 10`,
        [job.country_code, job.city, job.area_id]
      );
      let open = false;
      try {
        const model = await askModel({
          areaName: job.canonical_name,
          city: job.city,
          state: job.state,
          countryCode: job.country_code,
          candidates,
        });
        const winner = model ? canAutoMerge(job.canonical_name, model, candidates) : null;
        if (!model) {
          await client.query(
            `UPDATE area_resolution_jobs
             SET attempts = attempts + 1,
                 next_attempt_at = now() + interval '15 minutes',
                 last_error = 'model_unavailable',
                 status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE status END,
                 updated_at = now()
             WHERE id = $1`,
            [job.id]
          );
          continue;
        }
        await client.query("BEGIN");
        open = true;
        if (winner) {
          await client.query(
            `INSERT INTO area_aliases (area_id, alias, normalized_alias)
             VALUES ($1, $2, $3)
             ON CONFLICT (area_id, normalized_alias) DO NOTHING`,
            [winner.id, job.canonical_name, normalizePlace(job.canonical_name)]
          );
          await client.query(
            `UPDATE areas
             SET status = 'redirected', canonical_area_id = $2, updated_at = now()
             WHERE id = $1`,
            [job.area_id, winner.id]
          );
          const moved = await client.query<{ user_id: string }>(
            `UPDATE user_locations SET area_id = $2, locality = $3, updated_at = now()
             WHERE area_id = $1
             RETURNING user_id`,
            [job.area_id, winner.id, winner.canonical_name]
          );
          for (const row of moved.rows) {
            await syncCircleMembership(client, row.user_id);
          }
          await client.query(
            `INSERT INTO area_merge_events (from_area_id, to_area_id, confidence, model, evidence)
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [
              job.area_id,
              winner.id,
              model.confidence,
              MODEL,
              JSON.stringify({ raw: job.canonical_name, match: winner.canonical_name }),
            ]
          );
        } else {
          await client.query(
            `UPDATE areas SET status = 'active', updated_at = now() WHERE id = $1`,
            [job.area_id]
          );
        }
        await client.query(
          `UPDATE area_resolution_jobs
           SET status = 'done', result = $2::jsonb, updated_at = now()
           WHERE id = $1`,
          [job.id, JSON.stringify(model)]
        );
        await client.query("COMMIT");
        open = false;
        finished += 1;
      } catch (err) {
        if (open) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // No open transaction.
          }
        }
        await client.query(
          `UPDATE area_resolution_jobs
           SET attempts = attempts + 1,
               next_attempt_at = now() + interval '15 minutes',
               last_error = $2,
               updated_at = now()
           WHERE id = $1`,
          [job.id, err instanceof Error ? err.message.slice(0, 200) : "failed"]
        );
      }
    }
    return finished;
  } finally {
    client.release();
  }
}
