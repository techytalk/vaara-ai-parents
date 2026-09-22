-- Ops audit log for hiding / restoring circle chat messages.

CREATE TABLE IF NOT EXISTS admin_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor text,
  reason text,
  note text,
  message_ids uuid[] NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_moderation_actions_action_check
    CHECK (action IN ('hide', 'unhide'))
);

CREATE INDEX IF NOT EXISTS idx_admin_moderation_actions_created
  ON admin_moderation_actions (created_at DESC);
