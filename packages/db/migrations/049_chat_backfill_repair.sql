-- Repair live DBs that applied 042–047 / a broken 048 without schema_migrations
-- rows, and close remaining integrity gaps.

INSERT INTO schema_migrations (version)
SELECT version
FROM unnest(ARRAY[
  '042_chat_notification_types',
  '043_multi_role_conversations',
  '044_circle_threads_and_access',
  '045_circle_messages_and_reads',
  '046_provider_channels',
  '047_chat_outbox_and_moderation',
  '048_migrate_posts_to_threads'
]) AS version
ON CONFLICT DO NOTHING;

-- One legacy poll may be copied onto every target thread.
ALTER TABLE circle_thread_polls
  DROP CONSTRAINT IF EXISTS circle_thread_polls_source_poll_id_key;

DROP INDEX IF EXISTS circle_thread_polls_source_poll_id_key;

-- Replay the repaired 048 backfill (seq-safe loops + remaining copies).
-- Included inline so already-applied 048 is still repaired.

DO $$
DECLARE
  target record;
  seq bigint;
BEGIN
  FOR target IN
    SELECT
      t.circle_id,
      t.access_mode,
      p.id AS post_id,
      p.author_id,
      p.body,
      p.tag::text AS tag,
      p.created_at,
      COALESCE(p.updated_at, p.created_at) AS updated_at,
      COALESCE(p.reply_count, 0) AS reply_count
    FROM circle_post_targets t
    JOIN circle_posts p ON p.id = t.post_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM circle_threads ct
      WHERE ct.source_post_id = t.post_id
        AND ct.source_target_circle_id = t.circle_id
    )
    ORDER BY t.circle_id, p.created_at, p.id
  LOOP
    UPDATE circles
    SET chat_seq = chat_seq + 1
    WHERE id = target.circle_id
    RETURNING chat_seq INTO seq;

    INSERT INTO circle_threads (
      created_seq, last_activity_seq, circle_id, author_id, author_role,
      title, body, kind, home_visibility, service_replies_allowed, status,
      last_message_at, reply_count, source_post_id, source_target_circle_id,
      created_at, updated_at
    )
    VALUES (
      seq, seq, target.circle_id, target.author_id, 'parent', NULL, target.body,
      CASE target.tag
        WHEN 'question' THEN 'question'
        WHEN 'recommendation' THEN 'recommendation'
        WHEN 'heads_up' THEN 'heads_up'
        ELSE 'general'
      END,
      CASE WHEN target.access_mode = 'guest' THEN 'member' ELSE 'discoverable' END,
      false, 'open', target.updated_at, target.reply_count,
      target.post_id, target.circle_id, target.created_at, target.updated_at
    );
  END LOOP;
END $$;

INSERT INTO circle_thread_topics (thread_id, topic_id, created_at)
SELECT ct.id, pt.topic_id, pt.created_at
FROM circle_threads ct
JOIN post_topics pt ON pt.post_id = ct.source_post_id
ON CONFLICT DO NOTHING;

INSERT INTO circle_thread_media (
  thread_id, storage_key, media_type, mime_type, size_bytes,
  width, height, duration_ms, file_name, scan_status, sort_order, created_at
)
SELECT
  ct.id, m.storage_key, m.media_type::text, m.mime_type, m.size_bytes,
  m.width, m.height, m.duration_ms, m.file_name,
  COALESCE(m.scan_status, 'clean'), m.sort_order, m.created_at
FROM circle_threads ct
JOIN circle_post_media m ON m.post_id = ct.source_post_id
ON CONFLICT DO NOTHING;

INSERT INTO circle_thread_polls (
  thread_id, question, results_hidden_until_vote, closes_at, source_poll_id, created_at
)
SELECT
  ct.id, pp.question, pp.results_hidden_until_vote, pp.closes_at, pp.id, pp.created_at
FROM circle_threads ct
JOIN post_polls pp ON pp.post_id = ct.source_post_id
WHERE NOT EXISTS (
  SELECT 1 FROM circle_thread_polls tp WHERE tp.thread_id = ct.id
);

INSERT INTO circle_thread_poll_options (poll_id, label, sort_order, source_option_id)
SELECT tp.id, po.label, po.sort_order, po.id
FROM circle_thread_polls tp
JOIN poll_options po ON po.poll_id = tp.source_poll_id
WHERE NOT EXISTS (
  SELECT 1 FROM circle_thread_poll_options o
  WHERE o.poll_id = tp.id AND o.source_option_id = po.id
);

INSERT INTO circle_thread_poll_votes (poll_id, user_id, option_id, created_at)
SELECT tp.id, pv.user_id, opt.id, pv.created_at
FROM circle_thread_polls tp
JOIN poll_votes pv ON pv.poll_id = tp.source_poll_id
JOIN circle_thread_poll_options opt
  ON opt.poll_id = tp.id AND opt.source_option_id = pv.option_id
ON CONFLICT DO NOTHING;

INSERT INTO circle_thread_helpful (thread_id, user_id, created_at)
SELECT ct.id, h.user_id, h.created_at
FROM circle_threads ct
JOIN post_helpful_marks h ON h.post_id = ct.source_post_id
ON CONFLICT DO NOTHING;

INSERT INTO circle_thread_reads (thread_id, user_id, following, last_read_at)
SELECT ct.id, s.user_id, true, s.created_at
FROM circle_threads ct
JOIN saved_items s ON s.item_id = ct.source_post_id AND s.item_type = 'post'
ON CONFLICT (thread_id, user_id) DO UPDATE SET following = true;

INSERT INTO saved_items (user_id, item_type, item_id, created_at)
SELECT s.user_id, 'thread', ct.id, s.created_at
FROM circle_threads ct
JOIN saved_items s ON s.item_id = ct.source_post_id AND s.item_type = 'post'
ON CONFLICT DO NOTHING;

INSERT INTO circle_thread_access_grants (
  thread_id, user_id, grant_role, granted_by, can_reply
)
SELECT ct.id, ct.author_id, 'guest_author', ct.author_id, true
FROM circle_threads ct
JOIN circle_post_targets t
  ON t.post_id = ct.source_post_id AND t.circle_id = ct.source_target_circle_id
WHERE t.access_mode = 'guest'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  reply record;
  seq bigint;
BEGIN
  FOR reply IN
    SELECT
      ct.id AS thread_id,
      ct.circle_id,
      r.id AS source_reply_id,
      r.author_id,
      r.body,
      r.created_at
    FROM circle_threads ct
    JOIN circle_post_replies r ON r.post_id = ct.source_post_id
    WHERE NOT EXISTS (
      SELECT 1 FROM circle_messages m
      WHERE m.thread_id = ct.id AND m.source_reply_id = r.id
    )
    ORDER BY ct.circle_id, r.created_at, r.id
  LOOP
    UPDATE circles
    SET chat_seq = chat_seq + 1
    WHERE id = reply.circle_id
    RETURNING chat_seq INTO seq;

    INSERT INTO circle_messages (
      seq, circle_id, thread_id, author_id, author_role, body,
      client_message_id, status, is_legacy, source_reply_id, created_at
    )
    VALUES (
      seq, reply.circle_id, reply.thread_id, reply.author_id, 'parent',
      reply.body, gen_random_uuid(), 'visible', true, reply.source_reply_id,
      reply.created_at
    );
  END LOOP;
END $$;

UPDATE circle_threads t
SET last_activity_seq = GREATEST(
      t.last_activity_seq,
      COALESCE((SELECT MAX(seq) FROM circle_messages m WHERE m.thread_id = t.id), 0)
    ),
    last_message_at = GREATEST(
      t.last_message_at,
      COALESCE((SELECT MAX(created_at) FROM circle_messages m WHERE m.thread_id = t.id), t.last_message_at)
    ),
    reply_count = (
      SELECT COUNT(*) FROM circle_messages m
      WHERE m.thread_id = t.id AND m.status = 'visible'
    );

UPDATE circles c
SET chat_seq = GREATEST(
  c.chat_seq,
  COALESCE((SELECT MAX(created_seq) FROM circle_threads WHERE circle_id = c.id), 0),
  COALESCE((SELECT MAX(seq) FROM circle_messages WHERE circle_id = c.id), 0)
);

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_context_key_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_context_key_check
  CHECK (context_key IN (
    'parent:parent', 'parent:provider', 'provider:parent', 'provider:provider'
  ));

ALTER TABLE circle_thread_media
  DROP CONSTRAINT IF EXISTS circle_thread_media_size_check;
ALTER TABLE circle_thread_media
  ADD CONSTRAINT circle_thread_media_size_check CHECK (size_bytes > 0);
ALTER TABLE circle_thread_media
  DROP CONSTRAINT IF EXISTS circle_thread_media_sort_check;
ALTER TABLE circle_thread_media
  ADD CONSTRAINT circle_thread_media_sort_check CHECK (sort_order >= 0);

ALTER TABLE circle_message_media
  DROP CONSTRAINT IF EXISTS circle_message_media_size_check;
ALTER TABLE circle_message_media
  ADD CONSTRAINT circle_message_media_size_check CHECK (size_bytes > 0);
ALTER TABLE circle_message_media
  DROP CONSTRAINT IF EXISTS circle_message_media_sort_check;
ALTER TABLE circle_message_media
  ADD CONSTRAINT circle_message_media_sort_check CHECK (sort_order >= 0);

ALTER TABLE post_shares
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES circle_threads(id) ON DELETE SET NULL;

UPDATE post_shares s
SET thread_id = ct.id
FROM circle_threads ct
WHERE s.thread_id IS NULL
  AND ct.source_post_id = s.post_id
  AND ct.source_target_circle_id = s.target_circle_id;

DO $$
BEGIN
  IF (
    SELECT COUNT(*) FROM circle_post_targets t
    JOIN circle_posts p ON p.id = t.post_id
  ) <> (
    SELECT COUNT(*) FROM circle_threads WHERE source_post_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'circle_threads backfill still incomplete after 049';
  END IF;
END $$;
