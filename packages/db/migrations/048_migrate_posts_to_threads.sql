-- Idempotent backfill of legacy posts into single-circle threads.

INSERT INTO circle_threads (
  created_seq,
  last_activity_seq,
  circle_id,
  author_id,
  author_role,
  title,
  body,
  kind,
  home_visibility,
  service_replies_allowed,
  status,
  last_message_at,
  reply_count,
  source_post_id,
  source_target_circle_id,
  created_at,
  updated_at
)
SELECT
  0,
  0,
  t.circle_id,
  p.author_id,
  'parent',
  NULL,
  p.body,
  CASE p.tag::text
    WHEN 'question' THEN 'question'
    WHEN 'recommendation' THEN 'recommendation'
    WHEN 'heads_up' THEN 'heads_up'
    ELSE 'general'
  END,
  CASE WHEN t.access_mode = 'guest' THEN 'member' ELSE 'discoverable' END,
  false,
  'open',
  COALESCE(p.updated_at, p.created_at),
  COALESCE(p.reply_count, 0),
  p.id,
  t.circle_id,
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM circle_post_targets t
JOIN circle_posts p ON p.id = t.post_id
ON CONFLICT DO NOTHING;

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
  ct.id,
  m.storage_key,
  m.media_type::text,
  m.mime_type,
  m.size_bytes,
  m.width,
  m.height,
  m.duration_ms,
  m.file_name,
  COALESCE(m.scan_status, 'clean'),
  m.sort_order,
  m.created_at
FROM circle_threads ct
JOIN circle_post_media m ON m.post_id = ct.source_post_id
ON CONFLICT DO NOTHING;

INSERT INTO circle_thread_polls (
  thread_id, question, results_hidden_until_vote, closes_at, source_poll_id, created_at
)
SELECT
  ct.id,
  pp.question,
  pp.results_hidden_until_vote,
  pp.closes_at,
  pp.id,
  pp.created_at
FROM circle_threads ct
JOIN post_polls pp ON pp.post_id = ct.source_post_id
ON CONFLICT DO NOTHING;

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
ON CONFLICT (thread_id, user_id) DO UPDATE
SET following = true;

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
  source_reply_id,
  created_at
)
SELECT
  0,
  ct.circle_id,
  ct.id,
  r.author_id,
  'parent',
  r.body,
  gen_random_uuid(),
  'visible',
  true,
  r.id,
  r.created_at
FROM circle_threads ct
JOIN circle_post_replies r ON r.post_id = ct.source_post_id
ON CONFLICT DO NOTHING;

WITH numbered_threads AS (
  SELECT
    id,
    circle_id,
    row_number() OVER (
      PARTITION BY circle_id
      ORDER BY created_at, id
    ) AS seq
  FROM circle_threads
)
UPDATE circle_threads t
SET created_seq = n.seq,
    last_activity_seq = GREATEST(t.last_activity_seq, n.seq)
FROM numbered_threads n
WHERE t.id = n.id
  AND t.created_seq = 0;

WITH numbered_messages AS (
  SELECT
    m.id,
    row_number() OVER (
      PARTITION BY m.circle_id
      ORDER BY m.created_at, m.id
    ) + COALESCE(
      (SELECT MAX(created_seq) FROM circle_threads t WHERE t.circle_id = m.circle_id),
      0
    ) AS seq
  FROM circle_messages m
  WHERE m.seq = 0
)
UPDATE circle_messages m
SET seq = n.seq
FROM numbered_messages n
WHERE m.id = n.id;

UPDATE circle_threads t
SET last_activity_seq = GREATEST(
      t.last_activity_seq,
      COALESCE((SELECT MAX(seq) FROM circle_messages m WHERE m.thread_id = t.id), 0)
    ),
    last_message_at = GREATEST(
      t.last_message_at,
      COALESCE((SELECT MAX(created_at) FROM circle_messages m WHERE m.thread_id = t.id), t.last_message_at)
    ),
    reply_count = COALESCE(
      (SELECT COUNT(*) FROM circle_messages m WHERE m.thread_id = t.id AND m.status = 'visible'),
      0
    );

UPDATE circles c
SET chat_seq = GREATEST(
  c.chat_seq,
  COALESCE((SELECT MAX(created_seq) FROM circle_threads WHERE circle_id = c.id), 0),
  COALESCE((SELECT MAX(seq) FROM circle_messages WHERE circle_id = c.id), 0)
);
