import { config } from "dotenv";
import { resolve } from "path";
import { Pool } from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const poolConfig = {
  connectionString,
  ssl: { rejectUnauthorized: false } as const,
};

export const pool = new Pool(poolConfig);

const readConnectionString =
  process.env.DATABASE_READ_URL ?? process.env.DATABASE_URL;

export const readPool =
  readConnectionString === connectionString
    ? pool
    : new Pool({
        connectionString: readConnectionString,
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

export async function readQuery<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const client = await readPool.connect();
  try {
    const result = await client.query(text, params);
    return { rows: result.rows as T[] };
  } finally {
    client.release();
  }
}
