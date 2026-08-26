import { config } from "dotenv";
import { resolve } from "path";
import { Pool } from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return { rows: result.rows as T[] };
  } finally {
    client.release();
  }
}
