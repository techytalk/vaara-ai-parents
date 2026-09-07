CREATE TABLE post_shares (
  id text PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_shares_post_active
  ON post_shares(post_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_post_shares_creator_post
  ON post_shares(created_by, post_id, created_at DESC)
  WHERE revoked_at IS NULL;
