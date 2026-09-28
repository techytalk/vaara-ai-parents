-- Admin-only label for the lucky gift campaign. Parents never receive this.

ALTER TABLE lucky_gift_campaigns
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Suchitra';
