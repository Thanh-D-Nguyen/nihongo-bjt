-- Add shuffle_map JSONB to quiz_session for exam-level answer distribution
-- Stores pre-computed balanced option permutations per question for the session
ALTER TABLE "assessment"."quiz_session"
ADD COLUMN "shuffle_map" JSONB;

-- Comment for documentation
COMMENT ON COLUMN "assessment"."quiz_session"."shuffle_map" IS 'Pre-computed exam-level shuffle permutation map: {questionId: [originalKeyOrder]}. Ensures balanced correct-answer distribution and anti-consecutive patterns across the session.';
