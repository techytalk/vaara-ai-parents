CREATE TABLE school_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  attendance_verified boolean NOT NULL DEFAULT false,
  academic_year text,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, author_id)
);

CREATE INDEX idx_school_reviews_school
  ON school_reviews(school_id, created_at DESC) WHERE hidden = false;

CREATE TABLE school_fee_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES curriculum_grades(id),
  academic_year text NOT NULL,
  tuition_amount numeric(10,2) NOT NULL,
  transport_amount numeric(10,2),
  books_uniform_amount numeric(10,2),
  other_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, reporter_id, academic_year, grade_id)
);

CREATE INDEX idx_school_fee_reports_school
  ON school_fee_reports(school_id, academic_year);

CREATE TABLE school_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  circle_post_id uuid REFERENCES circle_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_questions_asker
  ON school_questions(asker_id, created_at DESC);

ALTER TABLE schools
  ADD COLUMN board_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN grades_offered text,
  ADD COLUMN transport_available boolean,
  ADD COLUMN rating_avg numeric(3,2),
  ADD COLUMN rating_count int NOT NULL DEFAULT 0;

ALTER TABLE reports
  ADD COLUMN target_school_review_id uuid REFERENCES school_reviews(id);
