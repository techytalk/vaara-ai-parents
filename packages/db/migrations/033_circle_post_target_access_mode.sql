-- Shared cross-circle posts: one post, many circle placements, one reply thread.
-- Record whether each placement was member or guest at publish time (quota + UI).

ALTER TABLE circle_post_targets
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'member';

ALTER TABLE circle_post_targets
  DROP CONSTRAINT IF EXISTS circle_post_targets_access_mode_check;

ALTER TABLE circle_post_targets
  ADD CONSTRAINT circle_post_targets_access_mode_check
  CHECK (access_mode IN ('member', 'guest'));

CREATE INDEX IF NOT EXISTS idx_circle_post_targets_guest_created
  ON circle_post_targets(access_mode, created_at DESC)
  WHERE access_mode = 'guest';
