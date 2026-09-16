CREATE TABLE IF NOT EXISTS circle_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigint NOT NULL,
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES circle_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('parent', 'provider')),
  body text,
  reply_to_message_id uuid REFERENCES circle_messages(id) ON DELETE SET NULL,
  client_message_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'deleted', 'moderated')),
  is_legacy boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  source_reply_id uuid REFERENCES circle_post_replies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, seq),
  UNIQUE (author_id, client_message_id)
);

ALTER TABLE circle_messages
  DROP CONSTRAINT IF EXISTS circle_messages_thread_circle_fkey;

ALTER TABLE circle_messages
  ADD CONSTRAINT circle_messages_thread_circle_fkey
  FOREIGN KEY (thread_id, circle_id)
  REFERENCES circle_threads (id, circle_id);

CREATE UNIQUE INDEX IF NOT EXISTS circle_messages_thread_source_reply
  ON circle_messages (thread_id, source_reply_id)
  WHERE source_reply_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_messages_linear
  ON circle_messages (circle_id, seq DESC)
  WHERE thread_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_circle_messages_thread
  ON circle_messages (thread_id, seq ASC)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_messages_author
  ON circle_messages (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS circle_message_reactions (
  message_id uuid NOT NULL REFERENCES circle_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS circle_message_mentions (
  message_id uuid NOT NULL REFERENCES circle_messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS circle_message_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES circle_messages(id) ON DELETE CASCADE,
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
  UNIQUE (message_id, storage_key)
);

CREATE TABLE IF NOT EXISTS circle_chat_reads (
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_seq bigint,
  last_seen_thread_seq bigint,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_thread_reads (
  thread_id uuid NOT NULL REFERENCES circle_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_seq bigint,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  following boolean NOT NULL DEFAULT false,
  muted_until timestamptz,
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_thread_reads_following
  ON circle_thread_reads (user_id, thread_id)
  WHERE following = true;

CREATE TABLE IF NOT EXISTS chat_daily_quotas (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quota_key text NOT NULL,
  day date NOT NULL DEFAULT CURRENT_DATE,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, quota_key, day)
);
