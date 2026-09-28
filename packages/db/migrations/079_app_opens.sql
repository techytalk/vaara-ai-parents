-- App opens are foreground sessions, not logins.
-- A login token can stay valid for days. This records when the app
-- actually comes to the front, at most one new session per 30 minutes.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_app_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS app_open_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_last_app_open
  ON users (last_app_open_at DESC)
  WHERE last_app_open_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_app_open_days (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_on date NOT NULL,
  open_count int NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, opened_on)
);
