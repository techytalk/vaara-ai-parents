CREATE TYPE school_event_source AS ENUM ('official', 'parent_reported');

CREATE TABLE school_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES curriculum_grades(id),
  title text NOT NULL,
  description text,
  event_type text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  source school_event_source NOT NULL DEFAULT 'parent_reported',
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_count int NOT NULL DEFAULT 0,
  disputed_count int NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_events_school_start
  ON school_events(school_id, starts_at) WHERE hidden = false;

CREATE TABLE school_event_flags (
  event_id uuid NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE reminders
  ADD COLUMN school_event_id uuid REFERENCES school_events(id) ON DELETE SET NULL;
