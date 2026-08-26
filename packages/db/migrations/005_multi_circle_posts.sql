-- Allow one post to appear in multiple circles while retaining circle_id as
-- the primary/origin circle for backwards compatibility.

CREATE TABLE circle_post_targets (
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, circle_id)
);

CREATE UNIQUE INDEX idx_circle_post_targets_one_primary
  ON circle_post_targets(post_id)
  WHERE is_primary;

CREATE INDEX idx_circle_post_targets_circle_post
  ON circle_post_targets(circle_id, post_id);

INSERT INTO circle_post_targets (post_id, circle_id, is_primary)
SELECT id, circle_id, true
FROM circle_posts
ON CONFLICT (post_id, circle_id) DO NOTHING;
