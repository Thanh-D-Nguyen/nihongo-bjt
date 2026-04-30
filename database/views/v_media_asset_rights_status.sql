-- Perf: reference counts from grouped joins on card_media_link and profile avatars.
CREATE OR REPLACE VIEW reporting.v_media_asset_rights_status AS
SELECT
  a.id AS asset_id,
  a.owner_user_id,
  a.object_key,
  a.mime_type,
  a.byte_size,
  a.provider,
  a.source_url,
  a.license,
  a.rights_status,
  a.status AS asset_status,
  a.created_at,
  a.updated_at,
  coalesce(cml.card_link_count, 0)::bigint AS card_link_count,
  coalesce(av.avatar_ref_count, 0)::bigint AS profile_avatar_ref_count
FROM media.asset a
LEFT JOIN (
  SELECT asset_id, count(*)::bigint AS card_link_count
  FROM learning.card_media_link
  GROUP BY asset_id
) cml ON cml.asset_id = a.id
LEFT JOIN (
  SELECT avatar_asset_id, count(*)::bigint AS avatar_ref_count
  FROM profile.user_profile
  WHERE avatar_asset_id IS NOT NULL
  GROUP BY avatar_asset_id
) av ON av.avatar_asset_id = a.id;

COMMENT ON VIEW reporting.v_media_asset_rights_status IS
  'Media asset with aggregated link counts (flashcard images, profile avatars).';
