DO $$
BEGIN
  IF to_regclass('public.pin_code_offices') IS NOT NULL
     AND to_regclass('public.postal_code_offices') IS NULL THEN
    ALTER TABLE pin_code_offices RENAME TO postal_code_offices;
    ALTER TABLE postal_code_offices RENAME COLUMN pin_code TO postal_code;
    ALTER TABLE postal_code_offices
      ADD COLUMN country_code text NOT NULL DEFAULT 'IN';
    ALTER TABLE postal_code_offices DROP CONSTRAINT pin_code_offices_pkey;
    ALTER TABLE postal_code_offices
      ADD PRIMARY KEY (country_code, postal_code, office_name);
    DROP INDEX IF EXISTS idx_pin_code_offices_pin;
  ELSIF to_regclass('public.postal_code_offices') IS NULL THEN
    CREATE TABLE postal_code_offices (
      country_code text NOT NULL DEFAULT 'IN',
      postal_code text NOT NULL,
      office_name text NOT NULL,
      district text NOT NULL,
      state_name text NOT NULL,
      office_type text,
      delivery_status text,
      PRIMARY KEY (country_code, postal_code, office_name)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_postal_code_offices_lookup
  ON postal_code_offices(country_code, postal_code);

ALTER TABLE user_locations
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'IN';

CREATE INDEX IF NOT EXISTS idx_user_locations_country_postal
  ON user_locations(country_code, pin_code);
