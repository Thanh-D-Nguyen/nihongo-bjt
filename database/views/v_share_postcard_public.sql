-- Perf: postcard_asset_count via grouped join (not correlated subquery per share_item).
CREATE OR REPLACE VIEW reporting.v_share_postcard_public AS
SELECT
  si.id AS share_item_id,
  si.public_token,
  si.kind,
  si.summary_payload,
  si.expires_at,
  si.created_at,
  st.slug AS template_slug,
  st.kind AS template_kind,
  st.version AS template_version,
  coalesce(sca.asset_count, 0)::bigint AS postcard_asset_count
FROM growth.share_item si
LEFT JOIN growth.share_template st ON st.id = si.template_id
LEFT JOIN (
  SELECT share_item_id, count(*)::bigint AS asset_count
  FROM growth.share_card_asset
  GROUP BY share_item_id
) sca ON sca.share_item_id = si.id;

COMMENT ON VIEW reporting.v_share_postcard_public IS
  'Public share rows with template metadata and aggregated postcard asset counts.';
