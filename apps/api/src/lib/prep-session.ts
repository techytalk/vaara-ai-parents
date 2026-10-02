import { pool } from "@vaara/db";
import { pairwiseSubject, randomToken, sha256, signIdToken } from "./oauth.js";

export type PrepSession = {
  token_type: "Bearer";
  expires_in: number;
  id_token: string;
  parent_sub: string;
  child_ref: string;
  child_nickname: string;
  class_label: string | null;
  progress_token: string;
};

export async function issuePrepSession(input: {
  clientId: string;
  parentId: string;
  childId: string;
  deviceLabel: string;
}): Promise<PrepSession> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const registered = await client.query(
      `SELECT pairwise_salt FROM oauth_clients WHERE client_id = $1`,
      [input.clientId]
    );
    const salt = registered.rows[0]?.pairwise_salt as string | undefined;
    if (!salt) throw new Error("Unknown prep client");

    const parentSub = await ensureSubject(client, input.clientId, salt, "parent", input.parentId);
    const childRef = await ensureSubject(client, input.clientId, salt, "child", input.childId);
    const child = await client.query(
      `SELECT COALESCE(NULLIF(c.nickname, ''), 'Child') AS nickname, g.label AS class_label
       FROM children c
       LEFT JOIN curriculum_grades g ON g.id = c.grade_id
       WHERE c.id = $1`,
      [input.childId]
    );
    const nickname = (child.rows[0]?.nickname as string) || "Child";
    const classLabel = (child.rows[0]?.class_label as string | null) ?? null;
    const progressToken = randomToken();
    await client.query(
      `INSERT INTO oauth_grants (parent_id, child_id, client_id, progress_token_hash, device_label)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.parentId, input.childId, input.clientId, sha256(progressToken), input.deviceLabel]
    );
    const idToken = await signIdToken({
      clientId: input.clientId,
      parentSub,
      childRef,
      childNickname: nickname,
      classLabel,
    });
    await client.query("COMMIT");
    return {
      token_type: "Bearer",
      expires_in: 600,
      id_token: idToken,
      parent_sub: parentSub,
      child_ref: childRef,
      child_nickname: nickname,
      class_label: classLabel,
      progress_token: progressToken,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSubject(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { subject?: string }[] }> },
  clientId: string,
  salt: string,
  kind: "parent" | "child",
  internalId: string
): Promise<string> {
  const subject = pairwiseSubject(salt, kind, internalId);
  await client.query(
    `INSERT INTO oauth_subjects (client_id, kind, internal_id, subject)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id, kind, internal_id) DO NOTHING`,
    [clientId, kind, internalId, subject]
  );
  const { rows } = await client.query(
    `SELECT subject FROM oauth_subjects WHERE client_id = $1 AND kind = $2 AND internal_id = $3`,
    [clientId, kind, internalId]
  );
  return rows[0]?.subject ?? subject;
}
