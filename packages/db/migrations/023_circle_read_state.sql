ALTER TABLE circle_members
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;
