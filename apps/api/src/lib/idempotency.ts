import type { PoolClient } from "pg";

export async function getIdempotentResponse(
  client: PoolClient,
  userId: string,
  route: string,
  key: string
): Promise<{ statusCode: number; response: unknown } | null> {
  const { rows } = await client.query(
    `SELECT status_code, response
     FROM api_idempotency_keys
     WHERE user_id = $1 AND route = $2 AND idempotency_key = $3`,
    [userId, route, key]
  );
  if (rows.length === 0) return null;
  if (rows[0].status_code == null || rows[0].response == null) {
    // In-flight reservation — treat as conflict for concurrent retries.
    return { statusCode: 409, response: { error: "Request in progress" } };
  }
  return {
    statusCode: Number(rows[0].status_code),
    response: rows[0].response,
  };
}

/** Reserve the key; returns false if another request already owns it. */
export async function reserveIdempotencyKey(
  client: PoolClient,
  userId: string,
  route: string,
  key: string
): Promise<"reserved" | "exists"> {
  const result = await client.query(
    `INSERT INTO api_idempotency_keys (user_id, route, idempotency_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, route, idempotency_key) DO NOTHING
     RETURNING user_id`,
    [userId, route, key]
  );
  return result.rowCount && result.rowCount > 0 ? "reserved" : "exists";
}

export async function storeIdempotentResponse(
  client: PoolClient,
  userId: string,
  route: string,
  key: string,
  statusCode: number,
  response: unknown
): Promise<void> {
  await client.query(
    `UPDATE api_idempotency_keys
     SET status_code = $4, response = $5::jsonb
     WHERE user_id = $1 AND route = $2 AND idempotency_key = $3`,
    [userId, route, key, statusCode, JSON.stringify(response)]
  );
}
