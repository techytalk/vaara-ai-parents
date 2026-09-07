ALTER TABLE circle_posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;
