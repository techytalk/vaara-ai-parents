CREATE TABLE pin_code_offices (
  pin_code text NOT NULL,
  office_name text NOT NULL,
  district text NOT NULL,
  state_name text NOT NULL,
  office_type text,
  delivery_status text,
  PRIMARY KEY (pin_code, office_name)
);

CREATE INDEX idx_pin_code_offices_pin ON pin_code_offices(pin_code);
