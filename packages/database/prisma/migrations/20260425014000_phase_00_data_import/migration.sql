CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS content;

CREATE TABLE content.content_import_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type varchar(64) NOT NULL,
  source_dir text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'created',
  file_count integer NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  profile_summary jsonb,
  validation_summary jsonb,
  transform_summary jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_content_import_batch_status
    CHECK (status IN ('created', 'running', 'profiled', 'validated', 'failed', 'completed'))
);

CREATE TABLE content.content_raw_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES content.content_import_batch(id) ON DELETE CASCADE,
  source_file text NOT NULL,
  source_type varchar(64) NOT NULL,
  source_key text NOT NULL,
  item_index integer NOT NULL,
  raw_hash char(64) NOT NULL,
  raw jsonb NOT NULL,
  profile jsonb,
  validation_state varchar(32) NOT NULL DEFAULT 'pending',
  provenance jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_content_raw_item_validation_state
    CHECK (validation_state IN ('pending', 'valid', 'invalid', 'warning'))
);

CREATE TABLE content.content_import_error (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES content.content_import_batch(id) ON DELETE CASCADE,
  raw_item_id uuid REFERENCES content.content_raw_item(id) ON DELETE SET NULL,
  source_file text,
  source_key text,
  phase varchar(32) NOT NULL,
  severity varchar(16) NOT NULL DEFAULT 'error',
  code varchar(80) NOT NULL,
  message text NOT NULL,
  sample jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_content_import_error_severity
    CHECK (severity IN ('info', 'warning', 'error'))
);

CREATE TABLE content.content_import_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid REFERENCES content.content_import_batch(id) ON DELETE SET NULL,
  source_type varchar(64) NOT NULL,
  target_type varchar(64) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status varchar(32) NOT NULL DEFAULT 'draft',
  mapping jsonb NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_content_import_mapping_status
    CHECK (status IN ('draft', 'approved', 'deprecated'))
);

CREATE UNIQUE INDEX uq_content_raw_item_batch_file_key
  ON content.content_raw_item(import_batch_id, source_file, source_key);

CREATE UNIQUE INDEX uq_content_raw_item_batch_file_hash
  ON content.content_raw_item(import_batch_id, source_file, raw_hash);

CREATE INDEX idx_content_import_batch_status_created_at
  ON content.content_import_batch(status, created_at DESC);

CREATE INDEX idx_content_raw_item_source
  ON content.content_raw_item(source_type, source_key);

CREATE INDEX idx_content_raw_item_validation_state
  ON content.content_raw_item(validation_state);

CREATE INDEX idx_content_import_error_batch_phase
  ON content.content_import_error(import_batch_id, phase, severity);

CREATE UNIQUE INDEX uq_content_import_mapping_type_target_version
  ON content.content_import_mapping(source_type, target_type, version);

CREATE INDEX idx_content_import_mapping_status_source
  ON content.content_import_mapping(status, source_type);
