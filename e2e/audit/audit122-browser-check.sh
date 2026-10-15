#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
set -a
. ./.env
set +a

fixture="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -AtF '|' <<'SQL'
WITH module AS (
  INSERT INTO daily.daily_radar_module_config
    (module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,default_priority,created_at,updated_at)
  VALUES ('audit122-'||replace(gen_random_uuid()::text,'-',''),'AUDIT-122 module fixture','監査','Disposable browser audit fixture','life','content','draft',true,27,NOW(),NOW())
  RETURNING id
), card AS (
  INSERT INTO daily.daily_radar_card
    (module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,created_at,updated_at)
  SELECT id,'audit122-'||replace(gen_random_uuid()::text,'-',''),'AUDIT-122 publish fixture','Disposable publish fixture','life','content','Open fixture','draft',NOW(),NOW()
  FROM module RETURNING id,module_config_id
)
SELECT module_config_id::text,id::text FROM card;
SQL
)"
IFS='|' read -r module_id card_id <<<"$fixture"
if [[ ! "$module_id" =~ ^[0-9a-f-]{36}$ || ! "$card_id" =~ ^[0-9a-f-]{36}$ ]]; then
  echo "Could not create disposable Daily Radar module/card fixture" >&2
  exit 1
fi

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v module_id="$module_id" -v card_id="$card_id" <<'SQL' >/dev/null
BEGIN;
DELETE FROM ops.admin_audit_log WHERE target_type='daily_radar_card' AND target_id=:'card_id';
DELETE FROM ops.admin_audit_log WHERE target_type='daily_radar_module' AND target_id=:'module_id';
DELETE FROM daily.daily_radar_module_config WHERE id=:'module_id'::uuid;
COMMIT;
SQL
}
trap cleanup EXIT

AUDIT_MODULE_ID="$module_id" AUDIT_CARD_ID="$card_id" BU_NAME=default browser-use <<'PY'
import json
import os
import re
import time

tab = page_info()
if not tab['url'].startswith('http://localhost:18081/admin/') or '/login' in tab['url']:
    raise RuntimeError(f"Expected real authenticated Admin UI, got {tab['url']}")

module_id = os.environ['AUDIT_MODULE_ID']
card_id = os.environ['AUDIT_CARD_ID']
goto_url('http://localhost:18081/admin/vi/daily-radar')
time.sleep(1)

module = js("fetch('/api/admin/daily-radar/modules/"+module_id+"',{credentials:'same-origin'}).then(async r=>({status:r.status,body:await r.json()}))")
if module.get('status') != 200 or module.get('body',{}).get('id') != module_id or module.get('body',{}).get('key','').startswith('audit122-') is False:
    raise RuntimeError(f"GET module detail contract failed: {module}")
print('AUDIT-122 GET module headed browser PASS:', json.dumps(module,ensure_ascii=False))

row_expr = "JSON.stringify((()=>{const row=[...document.querySelectorAll('tr')].find(x=>x.innerText.includes('AUDIT-122 publish fixture'));if(!row)return null;const b=[...row.querySelectorAll('button')].find(x=>/publish|xuất bản/i.test(x.innerText));if(!b)return {text:row.innerText,buttons:[...row.querySelectorAll('button')].map(x=>x.innerText)};const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,label:b.innerText,disabled:b.disabled,text:row.innerText}})())"
button = json.loads(js(row_expr))
viewport_height = js('innerHeight')
for _ in range(8):
    if button and button.get('y',0) > 0 and button.get('y',0) < viewport_height:
        break
    scroll(800, min(viewport_height-20, 760), dy=550)
    time.sleep(0.15)
    button = json.loads(js(row_expr))
if not button or 'x' not in button or button.get('disabled'):
    raise RuntimeError(f"Could not find enabled publish control for fixture: {button}")
click_at_xy(button['x'],button['y'])
time.sleep(1)
published_row = js("(()=>{const row=[...document.querySelectorAll('tr')].find(x=>x.innerText.includes('AUDIT-122 publish fixture'));return row?.innerText||''})()")
if not re.search(r'published|đã xuất bản',published_row,re.I):
    raise RuntimeError(f"Publish UI did not show published status: {published_row}")
publish_requests = js("performance.getEntriesByType('resource').filter(x=>x.name.includes('/api/admin/daily-radar/cards/')&&x.name.endsWith('/publish')).map(x=>x.name)")
if not publish_requests:
    raise RuntimeError('Admin UI did not issue the publish endpoint request')
print('AUDIT-122 POST publish UI PASS: clicked the rendered Admin action; observed',publish_requests[-1])

archive = js("fetch('/api/admin/daily-radar/modules/"+module_id+"/archive',{method:'POST',credentials:'same-origin'}).then(async r=>({status:r.status,body:await r.json()}))")
if archive.get('status') != 200 or archive.get('body',{}).get('status') != 'archived':
    raise RuntimeError(f"POST module archive contract failed: {archive}")
print('AUDIT-122 POST module archive headed same-origin session PASS:',json.dumps(archive,ensure_ascii=False))
PY

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v module_id="$module_id" -v card_id="$card_id" -At <<'SQL' | grep -qx 'PERSISTENCE_AUDIT_PASS'
SELECT CASE WHEN
  (SELECT status='published' FROM daily.daily_radar_card WHERE id=:'card_id'::uuid)
  AND (SELECT status='archived' FROM daily.daily_radar_module_config WHERE id=:'module_id'::uuid)
  AND (SELECT count(*)=1 FROM ops.admin_audit_log WHERE target_type='daily_radar_card' AND target_id=:'card_id' AND action='daily_radar.card.published')
  AND (SELECT count(*)=1 FROM ops.admin_audit_log WHERE target_type='daily_radar_module' AND target_id=:'module_id' AND action='daily_radar.module.archived')
THEN 'PERSISTENCE_AUDIT_PASS' ELSE 'PERSISTENCE_AUDIT_FAIL' END;
SQL
echo "AUDIT-122 PostgreSQL publish/archive persistence and audit PASS"
