-- Add optional timed exam limit for BJT mock tests (server-side enforcement)
ALTER TABLE "assessment"."bjt_mock_test"
ADD COLUMN "time_limit_seconds" INTEGER;
