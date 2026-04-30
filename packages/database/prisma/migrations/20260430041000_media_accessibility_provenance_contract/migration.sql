-- PH07-T02: persist media provenance + accessibility contract metadata
ALTER TABLE media.asset
ADD COLUMN provenance JSONB,
ADD COLUMN accessibility JSONB;
