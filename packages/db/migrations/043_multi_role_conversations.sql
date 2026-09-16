-- One account may hold both parent and provider capabilities.
-- Conversation uniqueness includes a role-context key so the same pair can
-- have parent–parent and parent–tutor conversations.

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('parent', 'provider')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

INSERT INTO user_roles (user_id, role)
SELECT id, role::text FROM users
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sync_user_role_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, NEW.role::text)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_sync_user_roles ON users;
CREATE TRIGGER trg_users_sync_user_roles
AFTER INSERT OR UPDATE OF role ON users
FOR EACH ROW
EXECUTE PROCEDURE sync_user_role_row();

CREATE TABLE IF NOT EXISTS provider_categories (
  provider_id uuid NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('tutor', 'trainer', 'nutritionist', 'institution')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, category)
);

INSERT INTO provider_categories (provider_id, category)
SELECT
  user_id,
  CASE provider_type::text
    WHEN 'teacher' THEN 'tutor'
    WHEN 'trainer' THEN 'trainer'
    WHEN 'institution' THEN 'institution'
    ELSE 'tutor'
  END
FROM providers
ON CONFLICT DO NOTHING;

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS presentation_role text NOT NULL DEFAULT 'parent';

ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_presentation_role_check;

ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_presentation_role_check
  CHECK (presentation_role IN ('parent', 'provider'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS context_key text;

UPDATE conversations
SET context_key = 'parent:parent'
WHERE context_key IS NULL;

ALTER TABLE conversations
  ALTER COLUMN context_key SET DEFAULT 'parent:parent';

ALTER TABLE conversations
  ALTER COLUMN context_key SET NOT NULL;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS initiated_from_thread_id uuid;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_user_a_id_user_b_id_key;

DROP INDEX IF EXISTS conversations_user_a_id_user_b_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_context_key
  ON conversations (user_a_id, user_b_id, context_key);
