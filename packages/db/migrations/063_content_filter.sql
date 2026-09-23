-- Send-time language check: translation shown under a non-English message,
-- and an ops row when the check blocks or is unsure.

ALTER TABLE circle_messages
  ADD COLUMN IF NOT EXISTS english_body text;

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS english_body text;

CREATE TABLE IF NOT EXISTS content_filter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surface text NOT NULL,
  circle_id uuid,
  thread_id uuid,
  body text NOT NULL,
  is_english boolean NOT NULL,
  language text,
  english_text text,
  filthy real NOT NULL,
  sexual_or_romantic real NOT NULL,
  harassing real NOT NULL,
  model text NOT NULL,
  action text NOT NULL,
  enforced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_filter_events_action_check
    CHECK (action IN ('blocked', 'allowed', 'review'))
);

CREATE INDEX IF NOT EXISTS idx_content_filter_events_created
  ON content_filter_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_filter_events_user
  ON content_filter_events (user_id, created_at DESC);
