CREATE TYPE expert_session_status AS ENUM ('announced', 'collecting', 'live', 'closed', 'cancelled');

CREATE TABLE experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  credentials text NOT NULL,
  bio text,
  photo_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  topic_id uuid REFERENCES topics(id),
  status expert_session_status NOT NULL DEFAULT 'announced',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expert_sessions_starts ON expert_sessions(starts_at);

CREATE TABLE session_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES expert_sessions(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  upvote_count int NOT NULL DEFAULT 0,
  answer_body text,
  answered_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_questions_session
  ON session_questions(session_id, upvote_count DESC) WHERE hidden = false;

CREATE TABLE session_question_votes (
  question_id uuid NOT NULL REFERENCES session_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);
