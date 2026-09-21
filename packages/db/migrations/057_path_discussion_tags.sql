-- Path × topic tags on existing circle posts.
-- Tags are discovery only; they never change audience or membership.

CREATE TABLE IF NOT EXISTS path_discussion_tags (
  post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  path_id text NOT NULL,
  topic_id text NOT NULL,
  origin text NOT NULL DEFAULT 'branch',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, path_id, topic_id),
  CONSTRAINT path_discussion_tags_origin_chk
    CHECK (origin IN ('branch', 'other_routes')),
  CONSTRAINT path_discussion_tags_path_chk
    CHECK (path_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT path_discussion_tags_topic_chk
    CHECK (topic_id IN (
      'subjects',
      'workload',
      'college_plans',
      'learning',
      'next_grade'
    ))
);

CREATE INDEX IF NOT EXISTS idx_path_discussion_tags_lookup
  ON path_discussion_tags (path_id, topic_id, created_at DESC);
