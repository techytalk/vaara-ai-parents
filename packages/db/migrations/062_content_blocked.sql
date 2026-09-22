-- Posting block / profile suspension: parent can still read, but cannot send.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS content_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_blocked_reason text;

CREATE INDEX IF NOT EXISTS idx_users_content_blocked
  ON users (id)
  WHERE content_blocked IS TRUE;

ALTER TABLE admin_moderation_actions
  DROP CONSTRAINT IF EXISTS admin_moderation_actions_action_check;

ALTER TABLE admin_moderation_actions
  ADD CONSTRAINT admin_moderation_actions_action_check
  CHECK (action IN ('hide', 'unhide', 'block_posting', 'unblock_posting'));

UPDATE users
SET
  content_blocked = true,
  content_blocked_at = COALESCE(content_blocked_at, now()),
  content_blocked_reason = COALESCE(content_blocked_reason, 'not_appropriate'),
  updated_at = now()
WHERE role = 'parent'
  AND anonymous_handle ILIKE 'Parent-MXS3'
  AND content_blocked IS NOT TRUE;
