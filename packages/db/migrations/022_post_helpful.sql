CREATE TABLE IF NOT EXISTS post_helpful_marks (
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_helpful_marks_post ON post_helpful_marks(post_id);
