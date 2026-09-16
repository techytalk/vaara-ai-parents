ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS chat_seq bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS circle_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_seq bigint NOT NULL,
  last_activity_seq bigint NOT NULL,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('parent', 'provider')),
  title text,
  body text,
  kind text NOT NULL CHECK (
    kind IN ('question', 'recommendation', 'heads_up', 'poll', 'general')
  ),
  home_visibility text NOT NULL CHECK (
    home_visibility IN ('member', 'discoverable', 'hidden')
  ),
  service_replies_allowed boolean NOT NULL DEFAULT false,
  service_category text,
  status text NOT NULL CHECK (
    status IN ('open', 'closed', 'deleted', 'moderated')
  ) DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  reply_count int NOT NULL DEFAULT 0,
  source_post_id uuid REFERENCES circle_posts(id) ON DELETE SET NULL,
  source_target_circle_id uuid REFERENCES circles(id) ON DELETE SET NULL,
  reshared_from_thread_id uuid REFERENCES circle_threads(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_threads_id_circle
  ON circle_threads (id, circle_id);

CREATE UNIQUE INDEX IF NOT EXISTS circle_threads_circle_created_seq
  ON circle_threads (circle_id, created_seq);

CREATE INDEX IF NOT EXISTS idx_circle_threads_circle_activity
  ON circle_threads (circle_id, last_activity_seq DESC);

CREATE INDEX IF NOT EXISTS idx_circle_threads_circle_created
  ON circle_threads (circle_id, created_seq DESC);

CREATE INDEX IF NOT EXISTS idx_circle_threads_author
  ON circle_threads (author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circle_threads_discoverable
  ON circle_threads (last_message_at DESC, id DESC)
  WHERE home_visibility = 'discoverable' AND status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS circle_threads_source_target
  ON circle_threads (source_post_id, source_target_circle_id)
  WHERE source_post_id IS NOT NULL AND source_target_circle_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS circle_thread_topics (
  thread_id uuid NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_thread_topics_topic
  ON circle_thread_topics (topic_id, thread_id);

CREATE TABLE IF NOT EXISTS circle_thread_access_grants (
  thread_id uuid NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_role text NOT NULL CHECK (
    grant_role IN ('guest_author', 'guest_replier', 'provider_responder')
  ),
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  can_reply boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id, grant_role)
);

CREATE INDEX IF NOT EXISTS idx_circle_thread_grants_user
  ON circle_thread_access_grants (user_id, thread_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS circle_membership_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  reason text NOT NULL DEFAULT 'sync',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_membership_periods_open
  ON circle_membership_periods (circle_id, user_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_circle_membership_periods_user
  ON circle_membership_periods (user_id, joined_at DESC);

INSERT INTO circle_membership_periods (circle_id, user_id, joined_at, reason)
SELECT circle_id, user_id, joined_at, 'backfill'
FROM circle_members
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS circle_thread_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  media_type text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  width int,
  height int,
  duration_ms int,
  file_name text,
  scan_status text NOT NULL DEFAULT 'clean'
    CHECK (scan_status IN ('pending', 'clean', 'blocked', 'failed')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, storage_key)
);

CREATE TABLE IF NOT EXISTS circle_thread_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL UNIQUE REFERENCES circle_threads(id) ON DELETE CASCADE,
  question text NOT NULL,
  results_hidden_until_vote boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  source_poll_id uuid UNIQUE REFERENCES post_polls(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_thread_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES circle_thread_polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  source_option_id uuid REFERENCES poll_options(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS circle_thread_poll_votes (
  poll_id uuid NOT NULL REFERENCES circle_thread_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES circle_thread_poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_thread_helpful (
  thread_id uuid NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS home_thread_impressions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  PRIMARY KEY (user_id, thread_id)
);

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_initiated_from_thread_id_fkey;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_initiated_from_thread_id_fkey
  FOREIGN KEY (initiated_from_thread_id) REFERENCES circle_threads(id)
  ON DELETE SET NULL;
