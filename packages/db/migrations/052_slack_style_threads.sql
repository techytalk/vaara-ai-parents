-- Slack-style threads: a thread hangs off a channel (linear) message.
-- circle_threads remains the grant/Home identity; root_message_id is the parent.
-- Reuses migration-050 school_class roots; does not allocate new sequences for
-- legacy threads that already have a channel message.

ALTER TABLE circle_threads
  ADD COLUMN IF NOT EXISTS root_message_id uuid REFERENCES circle_messages(id) ON DELETE SET NULL;

ALTER TABLE circle_messages
  ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES circle_messages(id) ON DELETE SET NULL;

ALTER TABLE circle_messages
  ADD COLUMN IF NOT EXISTS author_was_guest boolean NOT NULL DEFAULT false;

ALTER TABLE circle_thread_reads
  ADD COLUMN IF NOT EXISTS follow_explicit boolean NOT NULL DEFAULT false;

-- Snapshot historical guest authorship before active-grant badges go away.
UPDATE circle_messages m
SET author_was_guest = true
WHERE m.author_was_guest = false
  AND EXISTS (
    SELECT 1
    FROM circle_thread_access_grants g
    WHERE g.user_id = m.author_id
      AND g.grant_role = 'guest_author'
      AND (
        g.thread_id = m.thread_id
        OR EXISTS (
          SELECT 1
          FROM circle_threads t
          WHERE t.id = g.thread_id
            AND t.root_message_id = m.id
        )
      )
  );

CREATE UNIQUE INDEX IF NOT EXISTS circle_threads_root_message
  ON circle_threads (root_message_id)
  WHERE root_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_messages_parent
  ON circle_messages (parent_message_id, seq ASC)
  WHERE parent_message_id IS NOT NULL;

-- 1) Reuse existing linear roots created by migration 050 (same source_post_id).
UPDATE circle_threads t
SET root_message_id = root.id,
    updated_at = now()
FROM circle_messages root
WHERE t.root_message_id IS NULL
  AND t.source_post_id IS NOT NULL
  AND root.circle_id = t.circle_id
  AND root.thread_id IS NULL
  AND root.source_post_id = t.source_post_id
  AND root.status <> 'deleted';

-- 2) Reattach replies flattened by migration 050 onto those reused roots.
UPDATE circle_messages reply
SET thread_id = t.id,
    parent_message_id = t.root_message_id,
    reply_to_message_id = CASE
      WHEN reply.reply_to_message_id = t.root_message_id THEN NULL
      ELSE reply.reply_to_message_id
    END
FROM circle_threads t
WHERE t.root_message_id IS NOT NULL
  AND t.source_post_id IS NOT NULL
  AND reply.circle_id = t.circle_id
  AND reply.thread_id IS NULL
  AND reply.source_reply_id IS NOT NULL
  AND reply.reply_to_message_id = t.root_message_id;

-- 3) Create roots only for threads that still lack one, preserving chronology.
DO $$
DECLARE
  r RECORD;
  msg_id uuid;
  root_body text;
  seq_taken boolean;
BEGIN
  FOR r IN
    SELECT id, circle_id, author_id, author_role, title, body, created_seq, created_at
    FROM circle_threads
    WHERE root_message_id IS NULL
      AND status <> 'deleted'
  LOOP
    root_body := NULLIF(btrim(COALESCE(r.body, '')), '');
    IF root_body IS NULL THEN
      root_body := NULLIF(btrim(COALESCE(r.title, '')), '');
    END IF;
    IF root_body IS NULL THEN
      root_body := 'Thread';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM circle_messages m
      WHERE m.circle_id = r.circle_id
        AND m.seq = r.created_seq
    )
    INTO seq_taken;

    IF seq_taken THEN
      RAISE EXCEPTION
        'cannot create root for thread %: seq % already used in circle %',
        r.id, r.created_seq, r.circle_id;
    END IF;

    msg_id := gen_random_uuid();
    INSERT INTO circle_messages (
      id, seq, circle_id, thread_id, author_id, author_role, body,
      client_message_id, status, is_legacy, source_post_id, created_at
    )
    VALUES (
      msg_id,
      r.created_seq,
      r.circle_id,
      NULL,
      r.author_id,
      r.author_role,
      root_body,
      gen_random_uuid(),
      'visible',
      true,
      (
        SELECT source_post_id
        FROM circle_threads
        WHERE id = r.id
      ),
      r.created_at
    );

    UPDATE circle_threads
       SET root_message_id = msg_id,
           updated_at = now()
     WHERE id = r.id;
  END LOOP;
END $$;

-- 4) Point every attached reply at its thread root.
UPDATE circle_messages m
SET parent_message_id = t.root_message_id
FROM circle_threads t
WHERE m.thread_id = t.id
  AND t.root_message_id IS NOT NULL
  AND m.parent_message_id IS DISTINCT FROM t.root_message_id;

-- 5) Recompute thread activity from visible replies + root.
UPDATE circle_threads t
SET reply_count = COALESCE((
      SELECT COUNT(*)::int
      FROM circle_messages m
      WHERE m.thread_id = t.id
        AND m.status = 'visible'
    ), 0),
    last_activity_seq = GREATEST(
      root.seq,
      COALESCE((
        SELECT MAX(m.seq)
        FROM circle_messages m
        WHERE m.thread_id = t.id
          AND m.status = 'visible'
      ), root.seq)
    ),
    last_message_at = GREATEST(
      root.created_at,
      COALESCE((
        SELECT MAX(m.created_at)
        FROM circle_messages m
        WHERE m.thread_id = t.id
          AND m.status = 'visible'
      ), root.created_at)
    ),
    updated_at = now()
FROM circle_messages root
WHERE root.id = t.root_message_id
  AND t.status <> 'deleted';

-- 6) Ensure circle chat_seq covers every message/thread sequence.
UPDATE circles c
SET chat_seq = GREATEST(
  c.chat_seq,
  COALESCE((SELECT MAX(created_seq) FROM circle_threads WHERE circle_id = c.id), 0),
  COALESCE((SELECT MAX(last_activity_seq) FROM circle_threads WHERE circle_id = c.id), 0),
  COALESCE((SELECT MAX(seq) FROM circle_messages WHERE circle_id = c.id), 0)
);

-- 7) Postconditions — abort if the Slack shape is incomplete.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM circle_threads
    WHERE status <> 'deleted'
      AND root_message_id IS NULL
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: thread without root_message_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM circle_threads t
    JOIN circle_messages root ON root.id = t.root_message_id
    WHERE t.status <> 'deleted'
      AND root.circle_id <> t.circle_id
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: root in wrong circle';
  END IF;

  IF EXISTS (
    SELECT root_message_id
    FROM circle_threads
    WHERE root_message_id IS NOT NULL
      AND status <> 'deleted'
    GROUP BY root_message_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: shared root_message_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM circle_messages m
    JOIN circle_threads t ON t.id = m.thread_id
    WHERE m.thread_id IS NOT NULL
      AND m.parent_message_id IS DISTINCT FROM t.root_message_id
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: reply parent_message_id mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM circle_messages parent
    JOIN circle_messages child ON child.parent_message_id = parent.id
    WHERE parent.parent_message_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: nested thread parents';
  END IF;

  IF EXISTS (
    SELECT circle_id, source_post_id
    FROM circle_messages
    WHERE thread_id IS NULL
      AND source_post_id IS NOT NULL
      AND status <> 'deleted'
    GROUP BY circle_id, source_post_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: duplicate source_post roots';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM circles c
    WHERE EXISTS (
      SELECT 1 FROM circle_messages m
      WHERE m.circle_id = c.id AND m.seq > c.chat_seq
    )
    OR EXISTS (
      SELECT 1 FROM circle_threads t
      WHERE t.circle_id = c.id AND t.last_activity_seq > c.chat_seq
    )
  ) THEN
    RAISE EXCEPTION '052 postcondition failed: chat_seq behind messages';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_slack_thread_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_message_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_message_id = NEW.id THEN
    RAISE EXCEPTION 'message cannot parent itself';
  END IF;
  PERFORM 1
    FROM circle_messages p
   WHERE p.id = NEW.parent_message_id
     AND p.circle_id = NEW.circle_id
     AND p.parent_message_id IS NULL
     AND p.thread_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'thread parent must be a channel message in the same group';
  END IF;
  IF NEW.thread_id IS NOT NULL THEN
    PERFORM 1
      FROM circle_threads t
     WHERE t.id = NEW.thread_id
       AND t.circle_id = NEW.circle_id
       AND t.root_message_id = NEW.parent_message_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'thread parent must match the thread root message';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_messages_slack_parent ON circle_messages;
CREATE TRIGGER circle_messages_slack_parent
  BEFORE INSERT OR UPDATE OF parent_message_id, circle_id, thread_id
  ON circle_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_slack_thread_parent();

CREATE OR REPLACE FUNCTION refresh_circle_thread_summary(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  root_seq bigint;
  root_at timestamptz;
BEGIN
  IF p_thread_id IS NULL THEN
    RETURN;
  END IF;

  SELECT root.seq, root.created_at
    INTO root_seq, root_at
  FROM circle_threads t
  JOIN circle_messages root ON root.id = t.root_message_id
  WHERE t.id = p_thread_id;

  IF root_seq IS NULL THEN
    RETURN;
  END IF;

  UPDATE circle_threads t
  SET reply_count = COALESCE(s.reply_count, 0),
      last_activity_seq = GREATEST(root_seq, COALESCE(s.max_seq, root_seq)),
      last_message_at = GREATEST(root_at, COALESCE(s.max_at, root_at)),
      updated_at = now()
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE m.status = 'visible')::int AS reply_count,
      MAX(m.seq) FILTER (WHERE m.status = 'visible') AS max_seq,
      MAX(m.created_at) FILTER (WHERE m.status = 'visible') AS max_at
    FROM circle_messages m
    WHERE m.thread_id = p_thread_id
  ) s
  WHERE t.id = p_thread_id;
END;
$$;

CREATE OR REPLACE FUNCTION circle_messages_refresh_thread_summary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_circle_thread_summary(OLD.thread_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.thread_id IS DISTINCT FROM NEW.thread_id THEN
      PERFORM refresh_circle_thread_summary(OLD.thread_id);
    END IF;
    PERFORM refresh_circle_thread_summary(NEW.thread_id);
    RETURN NEW;
  END IF;

  PERFORM refresh_circle_thread_summary(NEW.thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_messages_thread_summary ON circle_messages;
CREATE TRIGGER circle_messages_thread_summary
  AFTER INSERT OR DELETE OR UPDATE OF thread_id, status, seq, created_at, parent_message_id
  ON circle_messages
  FOR EACH ROW
  EXECUTE FUNCTION circle_messages_refresh_thread_summary();
