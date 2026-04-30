-- Perf: raw_item / import_error counts via grouped joins (one scan each of child tables).
CREATE OR REPLACE VIEW reporting.v_import_batch_summary AS
SELECT
  b.id AS import_batch_id,
  b.source_type,
  b.source_dir,
  b.status,
  b.file_count,
  b.item_count,
  b.error_count,
  b.profile_summary,
  b.validation_summary,
  b.transform_summary,
  b.started_at,
  b.completed_at,
  b.created_at,
  b.updated_at,
  coalesce(r.cnt, 0)::bigint AS raw_item_row_count,
  coalesce(err.cnt, 0)::bigint AS import_error_row_count
FROM content.content_import_batch b
LEFT JOIN (
  SELECT import_batch_id, count(*)::bigint AS cnt
  FROM content.content_raw_item
  GROUP BY import_batch_id
) r ON r.import_batch_id = b.id
LEFT JOIN (
  SELECT import_batch_id, count(*)::bigint AS cnt
  FROM content.content_import_error
  GROUP BY import_batch_id
) err ON err.import_batch_id = b.id;

COMMENT ON VIEW reporting.v_import_batch_summary IS
  'Import batches with child row counts from hash-friendly aggregates.';
