ALTER TABLE circle_post_targets
  ADD COLUMN IF NOT EXISTS post_created_at timestamptz;

UPDATE circle_post_targets t
SET post_created_at = p.created_at
FROM circle_posts p
WHERE p.id = t.post_id
  AND t.post_created_at IS NULL;

ALTER TABLE circle_post_targets
  ALTER COLUMN post_created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_post_targets_circle_created
  ON circle_post_targets (circle_id, post_created_at DESC, post_id DESC);

CREATE TABLE IF NOT EXISTS timeline_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op text NOT NULL CHECK (op IN ('add', 'remove')),
  post_id uuid NOT NULL,
  circle_id uuid NOT NULL,
  post_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_timeline_outbox_pending
  ON timeline_outbox (created_at)
  WHERE processed_at IS NULL;
