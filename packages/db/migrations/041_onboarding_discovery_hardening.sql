-- Hardening for onboarding discovery: cleanup, region fix, catalogue bytes, merge queue

-- Incomplete school-create reservations left by candidate-409 races
DELETE FROM api_idempotency_keys
WHERE route = 'POST /v1/schools'
  AND status_code IS NULL
  AND response IS NULL;

-- Exact catalogue bytes for stable checksums (jsonb can reorder keys)
ALTER TABLE school_catalog_generations
  ADD COLUMN IF NOT EXISTS payload_bytes text;

-- Region correction: west-hyderabad only for explicit west localities / seed set
UPDATE schools
SET region = 'hyderabad'
WHERE region = 'west-hyderabad'
  AND lower(coalesce(city, '')) IN ('hyderabad', 'secunderabad')
  AND NOT (
    lower(coalesce(locality, '')) IN (
      'kollur', 'gachibowli', 'kokapet', 'narsingi', 'tellapur', 'osman nagar',
      'neopolis', 'financial district', 'nanakramguda', 'madhapur', 'kondapur',
      'jubilee hills', 'banjara hills', 'manikonda', 'puppalaguda', 'nankramguda',
      'bowrampet', 'bachupally', 'miyapur', 'kukatpally', 'hitec city'
    )
    OR locality ILIKE '%HITEC%'
    OR locality ILIKE '%Madhapur%'
  );

UPDATE schools
SET region = 'hyderabad'
WHERE region IS NULL
  AND lower(coalesce(city, '')) IN ('hyderabad', 'secunderabad', 'medak');

-- Merge ledger: allow queued jobs before execution
ALTER TABLE school_merge_ledger
  DROP CONSTRAINT IF EXISTS school_merge_ledger_status_check;

ALTER TABLE school_merge_ledger
  ADD CONSTRAINT school_merge_ledger_status_check
  CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled'));

ALTER TABLE school_merge_ledger
  ADD COLUMN IF NOT EXISTS dry_run_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz;
