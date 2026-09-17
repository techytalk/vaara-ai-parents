-- school_class circles use linear group chat, but migration 048 represented
-- every legacy post target as a thread. Keep those rows for migration
-- identity/share lookups, but materialize their content as linear messages.

ALTER TABLE circle_messages
  ADD COLUMN IF NOT EXISTS source_post_id uuid
  REFERENCES circle_posts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS circle_messages_linear_source_post
  ON circle_messages (circle_id, source_post_id)
  WHERE thread_id IS NULL AND source_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS circle_messages_linear_source_reply
  ON circle_messages (circle_id, source_reply_id)
  WHERE thread_id IS NULL AND source_reply_id IS NOT NULL;

INSERT INTO circle_messages (
  seq,
  circle_id,
  thread_id,
  author_id,
  author_role,
  body,
  client_message_id,
  status,
  is_legacy,
  source_post_id,
  created_at
)
SELECT
  thread.created_seq,
  thread.circle_id,
  NULL,
  thread.author_id,
  thread.author_role,
  thread.body,
  gen_random_uuid(),
  'visible',
  true,
  thread.source_post_id,
  thread.created_at
FROM circle_threads thread
JOIN circles circle ON circle.id = thread.circle_id
WHERE circle.circle_type = 'school_class'
  AND thread.source_post_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM circle_messages message
    WHERE message.circle_id = thread.circle_id
      AND message.thread_id IS NULL
      AND message.source_post_id = thread.source_post_id
  );

UPDATE circle_messages reply
SET thread_id = NULL,
    reply_to_message_id = root.id
FROM circle_threads thread
JOIN circles circle ON circle.id = thread.circle_id
JOIN circle_messages root
  ON root.circle_id = thread.circle_id
 AND root.thread_id IS NULL
 AND root.source_post_id = thread.source_post_id
WHERE reply.thread_id = thread.id
  AND circle.circle_type = 'school_class'
  AND thread.source_post_id IS NOT NULL
  AND reply.source_reply_id IS NOT NULL;

-- Linear class-chat content is intentionally not eligible for Home. Retain
-- the migrated thread row so source mappings and old share links still work.
UPDATE circle_threads thread
SET home_visibility = 'hidden'
FROM circles circle
WHERE circle.id = thread.circle_id
  AND circle.circle_type = 'school_class'
  AND thread.source_post_id IS NOT NULL;

INSERT INTO circle_message_media (
  message_id,
  storage_key,
  media_type,
  mime_type,
  size_bytes,
  width,
  height,
  duration_ms,
  file_name,
  scan_status,
  sort_order,
  created_at
)
SELECT
  message.id,
  media.storage_key,
  media.media_type::text,
  media.mime_type,
  media.size_bytes,
  media.width,
  media.height,
  media.duration_ms,
  media.file_name,
  COALESCE(media.scan_status, 'clean'),
  media.sort_order,
  media.created_at
FROM circle_messages message
JOIN circle_post_media media ON media.post_id = message.source_post_id
WHERE message.thread_id IS NULL
  AND message.source_post_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE circles circle
SET chat_seq = GREATEST(
  circle.chat_seq,
  COALESCE((
    SELECT MAX(message.seq)
    FROM circle_messages message
    WHERE message.circle_id = circle.id
  ), 0),
  COALESCE((
    SELECT MAX(thread.created_seq)
    FROM circle_threads thread
    WHERE thread.circle_id = circle.id
  ), 0)
)
WHERE circle.circle_type = 'school_class';
