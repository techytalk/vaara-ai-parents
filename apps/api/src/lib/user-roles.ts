import type { PoolClient } from "pg";

export type AccountRole = "parent" | "provider";

export async function userHasRole(
  client: PoolClient,
  userId: string,
  role: AccountRole
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2`,
    [userId, role]
  );
  return rows.length > 0;
}

export async function listUserRoles(
  client: PoolClient,
  userId: string
): Promise<AccountRole[]> {
  const { rows } = await client.query(
    `SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role`,
    [userId]
  );
  return rows.map((row) => row.role as AccountRole);
}

export async function ensureUserRole(
  client: PoolClient,
  userId: string,
  role: AccountRole
): Promise<void> {
  await client.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, role]
  );
}
