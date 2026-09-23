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
  { version: "026_avatar_key", file: "026_avatar_key.sql" },
  { version: "027_child_date_of_birth", file: "027_child_date_of_birth.sql" },
  { version: "028_pin_code_offices", file: "028_pin_code_offices.sql" },
  { version: "029_international_postal_codes", file: "029_international_postal_codes.sql" },
  { version: "030_post_edited_at", file: "030_post_edited_at.sql" },
  { version: "031_post_shares", file: "031_post_shares.sql" },
  { version: "032_cross_post_groups", file: "032_cross_post_groups.sql" },
  { version: "033_circle_post_target_access_mode", file: "033_circle_post_target_access_mode.sql" },
  { version: "034_post_media_document_enum", file: "034_post_media_document_enum.sql" },
  { version: "035_post_document_media", file: "035_post_document_media.sql" },
  { version: "036_apple_auth", file: "036_apple_auth.sql" },
  { version: "037_child_nickname_optional", file: "037_child_nickname_optional.sql" },
  { version: "038_circle_timeline_index", file: "038_circle_timeline_index.sql" },
  { version: "039_home_feed_impressions", file: "039_home_feed_impressions.sql" },
  {
    version: "040_onboarding_school_discovery",
    file: "040_onboarding_school_discovery.sql",
  },
  {
    version: "041_onboarding_discovery_hardening",
    file: "041_onboarding_discovery_hardening.sql",
  },
  {
    version: "042_chat_notification_types",
    file: "042_chat_notification_types.sql",
  },
  {
    version: "043_multi_role_conversations",
    file: "043_multi_role_conversations.sql",
  },
  {
    version: "044_circle_threads_and_access",
    file: "044_circle_threads_and_access.sql",
  },
  {
    version: "045_circle_messages_and_reads",
    file: "045_circle_messages_and_reads.sql",
  },
  { version: "046_provider_channels", file: "046_provider_channels.sql" },
  {
    version: "047_chat_outbox_and_moderation",
    file: "047_chat_outbox_and_moderation.sql",
  },
  {
    version: "048_migrate_posts_to_threads",
    file: "048_migrate_posts_to_threads.sql",
  },
  {
    version: "049_chat_backfill_repair",
    file: "049_chat_backfill_repair.sql",
  },
  {
    version: "050_backfill_linear_school_class_messages",
    file: "050_backfill_linear_school_class_messages.sql",
  },
  {
    version: "051_preschool_onboarding",
    file: "051_preschool_onboarding.sql",
  },
  {
    version: "052_slack_style_threads",
    file: "052_slack_style_threads.sql",
  },
  {
    version: "053_circle_message_media_hardening",
    file: "053_circle_message_media_hardening.sql",
  },
  {
    version: "054_children_curriculum_grade_fk",
    file: "054_children_curriculum_grade_fk.sql",
  },
  {
    version: "055_internal_seed_parents",
    file: "055_internal_seed_parents.sql",
  },
  {
    version: "056_onboarding_geo_signals",
    file: "056_onboarding_geo_signals.sql",
  },
  {
    version: "057_path_discussion_tags",
    file: "057_path_discussion_tags.sql",
  },
  {
    version: "058_path_exploration_tree",
    file: "058_path_exploration_tree.sql",
  },
  {
    version: "059_path_node_orientation_copy",
    file: "059_path_node_orientation_copy.sql",
  },
  {
    version: "060_path_g9_stage_panes",
    file: "060_path_g9_stage_panes.sql",
  },
  {
    version: "061_admin_moderation_actions",
    file: "061_admin_moderation_actions.sql",
  },
  {
    version: "062_content_blocked",
    file: "062_content_blocked.sql",
  },
  {
    version: "063_content_filter",
    file: "063_content_filter.sql",
  },
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
