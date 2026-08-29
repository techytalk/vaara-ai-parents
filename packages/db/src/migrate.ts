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
  { version: "007_enum_additions", file: "007_enum_additions.sql" },
  { version: "008_post_polls", file: "008_post_polls.sql" },
  { version: "009_reviews_and_notifications", file: "009_reviews_and_notifications.sql" },
  { version: "010_disclosures", file: "010_disclosures.sql" },
  { version: "011_marketplace", file: "011_marketplace.sql" },
  { version: "012_post_saves", file: "012_post_saves.sql" },
  { version: "013_school_reviews", file: "013_school_reviews.sql" },
  { version: "014_topics", file: "014_topics.sql" },
  { version: "015_school_calendar", file: "015_school_calendar.sql" },
  { version: "016_local_recommendations", file: "016_local_recommendations.sql" },
  { version: "017_expert_sessions", file: "017_expert_sessions.sql" },
  { version: "018_playdates", file: "018_playdates.sql" },
  { version: "019_carpool", file: "019_carpool.sql" },
  { version: "020_notification_digest", file: "020_notification_digest.sql" },
  { version: "021_google_auth", file: "021_google_auth.sql" },
  { version: "022_post_helpful", file: "022_post_helpful.sql" },
  { version: "023_circle_read_state", file: "023_circle_read_state.sql" },
  { version: "024_activity_categories", file: "024_activity_categories.sql" },
  { version: "025_parent_connection_requests", file: "025_parent_connection_requests.sql" },
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
