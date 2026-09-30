-- Winner quota is set per campaign from admin. Empty input defaults to 10 in the API.
-- Existing campaigns keep the quota already stored (previously locked at 20).

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'lucky_gift_campaigns'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%winner_quota%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE lucky_gift_campaigns DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE lucky_gift_campaigns
  ALTER COLUMN winner_quota SET DEFAULT 10;

ALTER TABLE lucky_gift_campaigns
  DROP CONSTRAINT IF EXISTS lucky_gift_campaigns_winner_quota_range;

ALTER TABLE lucky_gift_campaigns
  ADD CONSTRAINT lucky_gift_campaigns_winner_quota_range
  CHECK (winner_quota >= 1 AND winner_quota <= 100);
