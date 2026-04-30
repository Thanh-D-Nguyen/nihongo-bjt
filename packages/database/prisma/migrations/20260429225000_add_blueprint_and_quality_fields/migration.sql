-- Add blueprintMeta JSON field to BjtMockTest
ALTER TABLE assessment.bjt_mock_test
ADD COLUMN blueprint_meta JSONB;

-- Add qualityFlags JSON field to BjtQuestion
ALTER TABLE assessment.bjt_question
ADD COLUMN quality_flags JSONB;

-- Index for quality flags queries (admin dashboard)
CREATE INDEX idx_bjt_question_quality_flags
ON assessment.bjt_question
USING gin(quality_flags);
