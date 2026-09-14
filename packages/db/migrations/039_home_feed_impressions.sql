ALTER TABLE circle_post_targets
  ALTER COLUMN post_created_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS feed_post_impressions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_post_impressions_user_last_seen
  ON feed_post_impressions (user_id, last_seen_at DESC, post_id);
