-- Slack-style threads: a thread hangs off a channel (linear) message.
-- circle_threads remains the grant/Home identity; root_message_id is the parent.

ALTER TABLE circle_threads
  ADD COLUMN IF NOT EXISTS root_message_id uuid REFERENCES circle_messages(id) ON DELETE SET NULL;

ALTER TABLE circle_messages
  ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES circle_messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS circle_threads_root_message
  ON circle_threads (root_message_id)
  WHERE root_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_messages_parent
  ON circle_messages (parent_message_id, seq ASC)
  WHERE parent_message_id IS NOT NULL;

-- Existing topics become channel roots so wide groups have a firehose.
DO $$
DECLARE
  r RECORD;
  new_seq bigint;
  msg_id uuid;
  root_body text;
BEGIN
  FOR r IN
    SELECT id, circle_id, author_id, author_role, title, body
    FROM circle_threads
    WHERE root_message_id IS NULL
  LOOP
    UPDATE circles
       SET chat_seq = chat_seq + 1
     WHERE id = r.circle_id
     RETURNING chat_seq INTO new_seq;

    root_body := NULLIF(btrim(COALESCE(r.body, '')), '');
    IF root_body IS NULL THEN
      root_body := NULLIF(btrim(COALESCE(r.title, '')), '');
    END IF;
    IF root_body IS NULL THEN
      root_body := 'Thread';
    END IF;

    msg_id := gen_random_uuid();
    INSERT INTO circle_messages (
      id, seq, circle_id, thread_id, author_id, author_role, body,
      client_message_id, status
    )
    VALUES (
      msg_id, new_seq, r.circle_id, NULL, r.author_id, r.author_role,
      root_body, gen_random_uuid(), 'visible'
    );

    UPDATE circle_threads
       SET root_message_id = msg_id,
           updated_at = now()
     WHERE id = r.id;

    UPDATE circle_messages
       SET parent_message_id = msg_id
     WHERE thread_id = r.id
       AND parent_message_id IS NULL;
  END LOOP;
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_messages_slack_parent ON circle_messages;
CREATE TRIGGER circle_messages_slack_parent
  BEFORE INSERT OR UPDATE OF parent_message_id, circle_id, thread_id
  ON circle_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_slack_thread_parent();
