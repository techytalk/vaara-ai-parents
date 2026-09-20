-- Internal seed parents: admin-spawned accounts that behave like normal parents.
-- is_internal is admin-only; mobile APIs must not expose these columns.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS internal_kind text,
  ADD COLUMN IF NOT EXISTS internal_spawn_key text,
  ADD COLUMN IF NOT EXISTS session_version int NOT NULL DEFAULT 0;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_internal_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_internal_status_check
  CHECK (internal_status IN ('active', 'inactive'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_internal_kind_check;

ALTER TABLE users
  ADD CONSTRAINT users_internal_kind_check
  CHECK (
    internal_kind IS NULL
    OR internal_kind IN ('asker', 'responder', 'review', 'other')
  );

CREATE UNIQUE INDEX IF NOT EXISTS users_internal_spawn_key_uidx
  ON users (internal_spawn_key)
  WHERE internal_spawn_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_internal_status
  ON users (is_internal, internal_status)
  WHERE is_internal IS TRUE;

-- Existing store-review accounts
UPDATE users
SET
  is_internal = true,
  internal_kind = 'review',
  internal_status = 'active',
  updated_at = now()
WHERE email IN (
  'playstore.review@vaara.ai',
  'apple.review@vaara.ai'
);

CREATE TABLE IF NOT EXISTS admin_seed_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor text,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_seed_actions_created
  ON admin_seed_actions (created_at DESC);
