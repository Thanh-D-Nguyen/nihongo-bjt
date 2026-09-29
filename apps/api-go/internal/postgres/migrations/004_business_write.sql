-- Migration: 004_business_write
-- Adds learner-facing write tables for bookmarks, exercise sessions, and quiz sessions.
-- All tables live in the learner schema and reference profile.user_profile.

CREATE SCHEMA IF NOT EXISTS learner;

-- Bookmark: idempotent toggle per (user, target_type, target_id).
-- target_type is normalized server-side ('word' → 'lexeme').
CREATE TABLE IF NOT EXISTS learner.bookmark (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('lexeme', 'kanji', 'grammar')),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_user_type_created
    ON learner.bookmark(user_id, target_type, created_at DESC);

-- Exercise session: tracks a batch of exercises started by a learner.
CREATE TABLE IF NOT EXISTS learner.exercise_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    exercise_type VARCHAR(50) NOT NULL,
    placement VARCHAR(50),
    started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ(6),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_session_user_status
    ON learner.exercise_session(user_id, status, started_at DESC);

-- Exercise attempt: one answer within a session, with SRS state snapshots.
CREATE TABLE IF NOT EXISTS learner.exercise_attempt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES learner.exercise_session(id) ON DELETE CASCADE,
    exercise_data JSONB NOT NULL DEFAULT '{}',
    user_answer JSONB NOT NULL DEFAULT '{}',
    correct BOOL NOT NULL DEFAULT false,
    srs_state_before JSONB,
    srs_state_after JSONB,
    answered_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_attempt_session
    ON learner.exercise_attempt(session_id, answered_at);

-- Quiz session: a scored BJT quiz attempt bound to a template.
CREATE TABLE IF NOT EXISTS learner.quiz_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    template_id UUID NOT NULL,
    started_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ(6),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    score JSONB
);

CREATE INDEX IF NOT EXISTS idx_quiz_session_user_status
    ON learner.quiz_session(user_id, status, started_at DESC);

-- Quiz answer: one selected option within a quiz session.
CREATE TABLE IF NOT EXISTS learner.quiz_answer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES learner.quiz_session(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    selected_option TEXT NOT NULL,
    correct BOOL NOT NULL DEFAULT false,
    answered_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_answer_session
    ON learner.quiz_answer(session_id, answered_at);