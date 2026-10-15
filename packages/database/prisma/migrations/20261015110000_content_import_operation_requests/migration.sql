ALTER TABLE content.content_import_error
  ADD COLUMN status varchar(24) NOT NULL DEFAULT 'open',
  ADD CONSTRAINT chk_content_import_error_status
    CHECK (status IN ('open', 'retry_queued', 'discarded'));

CREATE TABLE content.content_import_operation_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_error_id uuid REFERENCES content.content_import_error(id) ON DELETE CASCADE,
  import_mapping_id uuid REFERENCES content.content_import_mapping(id) ON DELETE CASCADE,
  operation varchar(32) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'queued',
  reason text NOT NULL,
  requested_by uuid NOT NULL REFERENCES authz.admin_actor(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT chk_content_import_operation_kind
    CHECK (operation IN ('retry', 'manifest_run')),
  CONSTRAINT chk_content_import_operation_status
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT chk_content_import_operation_target
    CHECK (
      (operation = 'retry' AND import_error_id IS NOT NULL AND import_mapping_id IS NULL)
      OR (operation = 'manifest_run' AND import_error_id IS NULL AND import_mapping_id IS NOT NULL)
    )
);

CREATE INDEX idx_content_import_operation_queue
  ON content.content_import_operation_request(status, created_at)
  WHERE status IN ('queued', 'processing');

CREATE INDEX idx_content_import_operation_error_history
  ON content.content_import_operation_request(import_error_id, created_at DESC)
  WHERE import_error_id IS NOT NULL;

CREATE INDEX idx_content_import_operation_mapping_history
  ON content.content_import_operation_request(import_mapping_id, created_at DESC)
  WHERE import_mapping_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_import_operation_active_error
  ON content.content_import_operation_request(import_error_id)
  WHERE operation = 'retry' AND status IN ('queued', 'processing');

CREATE UNIQUE INDEX uq_content_import_operation_active_mapping
  ON content.content_import_operation_request(import_mapping_id)
  WHERE operation = 'manifest_run' AND status IN ('queued', 'processing');
