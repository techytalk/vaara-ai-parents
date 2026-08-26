import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
  { version: "001_initial", file: "001_initial.sql" },
  { version: "002_activity_search", file: "002_activity_search.sql" },
  { version: "003_schools", file: "003_schools.sql" },
  { version: "004_class_school_circles", file: "004_class_school_circles.sql" },
  { version: "005_multi_circle_posts", file: "005_multi_circle_posts.sql" },
  { version: "006_post_media", file: "006_post_media.sql" },
];

async function isMigrationApplied(
  client: import("pg").PoolClient,
  version: string
): Promise<boolean> {
  const reg = await client.query(
    "SELECT to_regclass('public.schema_migrations') AS reg"
  );
  if (!reg.rows[0]?.reg) return false;

  const { rows } = await client.query(
    "SELECT version FROM schema_migrations WHERE version = $1",
    [version]
  );
  return rows.length > 0;
}

async function migrate() {
  const client = await pool.connect();
  try {
    for (const migration of MIGRATIONS) {
      if (await isMigrationApplied(client, migration.version)) {
        console.log(`Migration ${migration.version} already applied — skipping`);
        continue;
      }

      const sql = readFileSync(
        resolve(__dirname, "../migrations", migration.file),
        "utf-8"
      );

      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
        [migration.version]
      );
      await client.query("COMMIT");
      console.log(`Migration ${migration.version} applied successfully`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
