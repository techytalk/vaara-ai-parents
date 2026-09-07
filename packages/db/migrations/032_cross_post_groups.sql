-- Cross-circle posting: one isolated post/thread per target circle,
-- linked by a group for the author's management view.

CREATE TABLE cross_post_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cross_post_groups_author_created
  ON cross_post_groups(author_id, created_at DESC);

ALTER TABLE circle_posts
  ADD COLUMN IF NOT EXISTS cross_post_group_id uuid
    REFERENCES cross_post_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS posting_context text NOT NULL DEFAULT 'member';

ALTER TABLE circle_posts DROP CONSTRAINT IF EXISTS circle_posts_posting_context_check;

ALTER TABLE circle_posts
  ADD CONSTRAINT circle_posts_posting_context_check
  CHECK (posting_context IN ('member', 'guest'));

CREATE INDEX IF NOT EXISTS idx_circle_posts_cross_group
  ON circle_posts(cross_post_group_id)
  WHERE cross_post_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_posts_guest_author_day
  ON circle_posts(author_id, created_at DESC)
  WHERE posting_context = 'guest';

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS accepts_guest_posts boolean NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
