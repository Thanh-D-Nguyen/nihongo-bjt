-- M7: Add metadata columns to media.asset for upload/stream endpoints.
-- Idempotent: safe to re-run.

ALTER TABLE media.asset ADD COLUMN IF NOT EXISTS content_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE media.asset ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE media.asset ADD COLUMN IF NOT EXISTS storage_path TEXT NOT NULL DEFAULT '';
ALTER TABLE media.asset ADD COLUMN IF NOT EXISTS original_filename TEXT NOT NULL DEFAULT '';
ALTER TABLE media.asset ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES profile.user_profile(id);