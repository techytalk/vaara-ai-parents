CREATE TYPE listing_kind AS ENUM ('for_sale', 'free', 'wanted');
CREATE TYPE listing_status AS ENUM ('active', 'reserved', 'completed', 'expired', 'removed');

CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind listing_kind NOT NULL,
  status listing_status NOT NULL DEFAULT 'active',
  category text NOT NULL,
  title text NOT NULL,
  description text,
  price_amount numeric(10,2),
  price_currency text DEFAULT 'INR',
  community_key text,
  pin_code text NOT NULL,
  school_id uuid REFERENCES schools(id),
  grade_id uuid REFERENCES curriculum_grades(id),
  search_vector tsvector,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'for_sale' OR price_amount IS NOT NULL)
);

CREATE INDEX idx_listings_community ON listings(community_key, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_pin ON listings(pin_code, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_school_grade ON listings(school_id, grade_id)
  WHERE status = 'active';
CREATE INDEX idx_listings_search ON listings USING GIN(search_vector);
CREATE INDEX idx_listings_expiry ON listings(expires_at) WHERE status = 'active';

CREATE TABLE listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  mime_type text NOT NULL,
  width int,
  height int,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX idx_listing_media_listing ON listing_media(listing_id, sort_order);

CREATE TABLE listing_interests (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

ALTER TABLE reports ADD COLUMN target_listing_id uuid REFERENCES listings(id);

CREATE OR REPLACE FUNCTION listings_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'english',
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.description, '') || ' ' ||
      coalesce(NEW.category, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description, category ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_search_vector_update();
