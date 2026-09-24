-- Lucky gift scratch-card campaign (Suchitra ₹500 voucher promo).
-- Campaign stays inactive until admin enables it after terms review.

CREATE TABLE lucky_gift_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  prize_label text NOT NULL,
  support_phone text NOT NULL,
  winner_quota integer NOT NULL DEFAULT 20 CHECK (winner_quota = 20),
  carry_unclaimed_forward boolean NOT NULL DEFAULT true,
  period_windows jsonb NOT NULL DEFAULT '{
    "morning": {"start": "06:00", "end": "11:00", "count": 7},
    "afternoon": {"start": "11:00", "end": "17:00", "count": 6},
    "evening": {"start": "17:00", "end": "22:00", "count": 7}
  }'::jsonb,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  claim_deadline timestamptz NOT NULL,
  claims_open boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (claim_deadline >= ends_at)
);

CREATE TABLE lucky_gift_winning_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lucky_gift_campaigns(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening')),
  available_at timestamptz NOT NULL,
  expires_at timestamptz,
  claimed_by_user_id uuid REFERENCES users(id),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, available_at)
);

CREATE INDEX idx_lucky_gift_moments_available
  ON lucky_gift_winning_moments (campaign_id, available_at)
  WHERE claimed_at IS NULL;

CREATE TABLE lucky_gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES lucky_gift_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winning_moment_id uuid UNIQUE REFERENCES lucky_gift_winning_moments(id),
  outcome text NOT NULL CHECK (outcome IN ('win', 'lose')),
  claim_code text NOT NULL,
  scratched_at timestamptz,
  winner_phone text,
  phone_submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id),
  UNIQUE (campaign_id, claim_code),
  CHECK (
    (outcome = 'win' AND winning_moment_id IS NOT NULL)
    OR (outcome = 'lose' AND winning_moment_id IS NULL)
  ),
  CHECK (
    (winner_phone IS NULL AND phone_submitted_at IS NULL)
    OR (winner_phone IS NOT NULL AND phone_submitted_at IS NOT NULL)
  )
);

CREATE INDEX idx_lucky_gift_cards_campaign_outcome
  ON lucky_gift_cards (campaign_id, outcome);

CREATE INDEX idx_lucky_gift_cards_user
  ON lucky_gift_cards (user_id);

-- Hard cap: refuse a 21st win even if application logic fails.
CREATE OR REPLACE FUNCTION lucky_gift_enforce_win_quota()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  quota integer;
  wins integer;
BEGIN
  IF NEW.outcome <> 'win' THEN
    RETURN NEW;
  END IF;

  SELECT winner_quota INTO quota
  FROM lucky_gift_campaigns
  WHERE id = NEW.campaign_id
  FOR UPDATE;

  SELECT COUNT(*)::integer INTO wins
  FROM lucky_gift_cards
  WHERE campaign_id = NEW.campaign_id
    AND outcome = 'win';

  IF wins >= quota THEN
    RAISE EXCEPTION 'lucky gift winner quota exceeded for campaign %', NEW.campaign_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lucky_gift_enforce_win_quota
  BEFORE INSERT ON lucky_gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION lucky_gift_enforce_win_quota();

-- Seed inactive campaign. Admin must set real dates / phone before activating.
INSERT INTO lucky_gift_campaigns (
  slug,
  prize_label,
  support_phone,
  starts_at,
  ends_at,
  claim_deadline,
  active
) VALUES (
  'suchitra-500',
  '₹500 gift voucher',
  '+910000000000',
  '2099-01-01 00:30:00+00',
  '2099-01-01 18:30:00+00',
  '2099-01-08 18:30:00+00',
  false
);
