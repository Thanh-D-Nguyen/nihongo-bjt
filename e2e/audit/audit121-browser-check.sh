#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
set -a
. ./.env
set +a

source_id="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At <<'SQL'
WITH m AS (SELECT id FROM daily.daily_radar_module_config ORDER BY created_at LIMIT 1),
c AS (
  INSERT INTO daily.daily_radar_card (module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,metadata,created_at,updated_at)
  SELECT m.id,'audit121-browser-'||replace(gen_random_uuid()::text,'-',''),'AUDIT-121 browser fixture','Disposable duplicate fixture','daily','reading','Open fixture','draft','{"body":"visible browser fixture"}'::jsonb,NOW(),NOW()
  FROM m RETURNING id
)
SELECT id::text FROM c;
SQL
)"
if [[ ! "$source_id" =~ ^[0-9a-f-]{36}$ ]]; then
  echo "Could not create disposable Daily Radar source fixture" >&2
  exit 1
fi

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v source_id="$source_id" <<'SQL' >/dev/null
BEGIN;
DELETE FROM daily.daily_radar_card
WHERE id=:'source_id'::uuid OR id::text IN (
  SELECT target_id FROM ops.admin_audit_log
  WHERE target_type='daily_radar_card' AND action='daily_radar.card.duplicated'
    AND after->>'duplicatedFrom'=:'source_id'
);
DELETE FROM ops.admin_audit_log
WHERE target_type='daily_radar_card' AND action='daily_radar.card.duplicated'
  AND after->>'duplicatedFrom'=:'source_id';
COMMIT;
SQL
}
trap cleanup EXIT

AUDIT_SOURCE_ID="$source_id" browser-use <<'PY'
import json
import os
from urllib.parse import quote

tab = page_info()
if not tab['url'].startswith('http://localhost:18081/admin/') or '/login' in tab['url']:
    raise RuntimeError(f"Expected the real authenticated Admin page, got {tab['url']}")
body = js("document.body.innerText")
if 'Japan Daily Radar' not in body:
    raise RuntimeError('Admin Daily Radar screen did not render')
cdp('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=1, mobile=True)

source_id = os.environ['AUDIT_SOURCE_ID']
url = '/api/admin/daily-radar/cards/' + quote(source_id) + '/duplicate'
result = js("fetch(" + json.dumps(url) + ",{method:'POST',credentials:'same-origin'}).then(async r=>({status:r.status,body:await r.json()}))")
if result.get('status') != 201 or result.get('body',{}).get('status') != 'draft' or result.get('body',{}).get('duplicatedFrom') != source_id:
    raise RuntimeError(f"Browser API contract failed: {result}")
requests = js("performance.getEntriesByType('resource').filter(x=>x.name.includes('/api/admin/daily-radar/cards/')&&x.name.endsWith('/duplicate')).map(x=>x.name)")
if not requests:
    raise RuntimeError('Browser did not record the duplicate API request')
print(f"AUDIT-121 headed Admin API PASS: {result['status']} draft duplicate, same-origin session; request={requests[-1]}")
cdp('Emulation.clearDeviceMetricsOverride')
PY

clone_id="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v source_id="$source_id" -At <<'SQL'
SELECT target_id FROM ops.admin_audit_log
WHERE action='daily_radar.card.duplicated' AND after->>'duplicatedFrom'=:'source_id'
ORDER BY created_at DESC LIMIT 1;
SQL
)"
if [[ ! "$clone_id" =~ ^[0-9a-f-]{36}$ ]]; then
  echo "Duplicate audit record was not persisted" >&2
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v clone_id="$clone_id" -At <<'SQL' | grep -qx PERSISTED_DRAFT_PASS
SELECT CASE WHEN c.status='draft' AND c.metadata->>'body'='visible browser fixture' THEN 'PERSISTED_DRAFT_PASS' ELSE 'PERSISTED_DRAFT_FAIL' END
FROM daily.daily_radar_card c WHERE c.id=:'clone_id'::uuid;
SQL
echo "AUDIT-121 PostgreSQL persistence and audit PASS"
