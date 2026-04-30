CREATE SCHEMA IF NOT EXISTS assessment;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE assessment.bjt_mock_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_vi text NOT NULL,
  title_ja text,
  type varchar(32) NOT NULL DEFAULT 'practice',
  status varchar(32) NOT NULL DEFAULT 'draft',
  description text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_bjt_mock_test_status_type ON assessment.bjt_mock_test (status, type);

CREATE TABLE assessment.bjt_test_section (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES assessment.bjt_mock_test(id) ON DELETE CASCADE,
  code varchar(64) NOT NULL,
  title_vi text NOT NULL,
  title_ja text,
  display_order integer NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_bjt_test_section_code ON assessment.bjt_test_section (test_id, code);
CREATE INDEX idx_bjt_test_section_order ON assessment.bjt_test_section (test_id, display_order);

CREATE TABLE assessment.bjt_question (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES assessment.bjt_test_section(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  scenario text,
  explanation_vi text NOT NULL,
  skill_tag varchar(64) NOT NULL,
  difficulty varchar(32) NOT NULL DEFAULT 'standard',
  source_type varchar(64),
  source_id uuid,
  status varchar(32) NOT NULL DEFAULT 'published',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_bjt_question_section_skill ON assessment.bjt_question (section_id, difficulty, skill_tag);
CREATE INDEX idx_bjt_question_status ON assessment.bjt_question (status);

CREATE TABLE assessment.bjt_question_option (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES assessment.bjt_question(id) ON DELETE CASCADE,
  option_key varchar(8) NOT NULL,
  text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_bjt_question_option_key ON assessment.bjt_question_option (question_id, option_key);
CREATE INDEX idx_bjt_question_option_correct ON assessment.bjt_question_option (question_id, is_correct);

CREATE TABLE assessment.quiz_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_id uuid NOT NULL REFERENCES assessment.bjt_mock_test(id) ON DELETE RESTRICT,
  status varchar(32) NOT NULL DEFAULT 'in_progress',
  current_question_no integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  estimated_score integer,
  estimated_bjt_band varchar(16),
  started_at timestamptz(6) NOT NULL DEFAULT now(),
  completed_at timestamptz(6)
);

CREATE INDEX idx_quiz_session_user_started_at ON assessment.quiz_session (user_id, started_at);
CREATE INDEX idx_quiz_session_status ON assessment.quiz_session (status);

CREATE TABLE assessment.quiz_answer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES assessment.quiz_session(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES assessment.bjt_question(id) ON DELETE RESTRICT,
  selected_option varchar(8) NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_quiz_answer_question ON assessment.quiz_answer (session_id, question_id);
CREATE INDEX idx_quiz_answer_session_answered_at ON assessment.quiz_answer (session_id, answered_at);

CREATE TABLE analytics.analytics_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_name varchar(120) NOT NULL,
  source varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_event_name_created_at ON analytics.analytics_event (event_name, created_at);
CREATE INDEX idx_analytics_event_user_created_at ON analytics.analytics_event (user_id, created_at);
