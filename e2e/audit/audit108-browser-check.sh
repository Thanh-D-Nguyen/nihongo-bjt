#!/usr/bin/env bash
# AUDIT-108 visible browser check: learner in-app notification feed on /settings/notifications.
# Uses the local dev learner test account from tmp/local-audit/accounts.private.json and
# disposable fixtures (kind audit108_fixture) that are deleted at the end.
set -euo pipefail
export AGENT_BROWSER_ENGINE=chrome
# Visible (headed) Chrome, as AC3 requires. Sessions started headless must be closed first.
export AGENT_BROWSER_HEADED=1
for sess in audit108-anon audit108; do agent-browser --session "$sess" close >/dev/null 2>&1 || true; done
base=http://localhost:18081
anon=audit108-anon
auth=audit108
cd "$(git rev-parse --show-toplevel)"

eval "$(python3 -I -c "
import json,shlex
d=json.load(open('tmp/local-audit/accounts.private.json'))['learner']
print('L_EMAIL='+shlex.quote(d['email'])); print('L_PASS='+shlex.quote(d['password']))")"

# 1. Anonymous: page redirects to login, API returns 401 (no bypass).
agent-browser --session "$anon" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$anon" wait 4000 >/dev/null
anon_url=$(agent-browser --session "$anon" get url)
[[ "$anon_url" == *'/vi/login'* ]] || { echo "anon page not redirected: $anon_url"; exit 1; }
anon_list=$(agent-browser --session "$anon" eval '(async () => (await fetch("/api/learner/in-app-notifications", {credentials:"include"})).status)()')
[[ "$anon_list" == "401" ]] || { echo "anon list status=$anon_list, want exactly 401"; exit 1; }
anon_mark=$(agent-browser --session "$anon" eval '(async () => (await fetch("/api/learner/in-app-notifications/00000000-0000-4000-8000-000000000001/read", {method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include"})).status)()')
[[ "$anon_mark" == "401" ]] || { echo "anon mark-read status=$anon_mark, want exactly 401"; exit 1; }

# 2. Learner login through the real form, then the settings page.
agent-browser --session "$auth" open "$base/vi/login?returnTo=%2Fvi%2Fsettings%2Fnotifications" >/dev/null
agent-browser --session "$auth" wait 1500 >/dev/null
agent-browser --session "$auth" find label "Email" >/dev/null 2>&1 || true
snap=$(agent-browser --session "$auth" snapshot -i)
email_ref=$(printf '%s\n' "$snap" | sed -n 's/.*textbox "Email".*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
pass_ref=$(printf '%s\n' "$snap" | sed -n 's/.*textbox "Mật khẩu".*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
submit_ref=$(printf '%s\n' "$snap" | sed -n 's/.*button "Đăng nhập".*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
[[ -n "$email_ref" && -n "$pass_ref" && -n "$submit_ref" ]] || { echo "login form refs not found"; exit 1; }
agent-browser --session "$auth" fill "@$email_ref" "$L_EMAIL" >/dev/null
agent-browser --session "$auth" fill "@$pass_ref" "$L_PASS" >/dev/null
agent-browser --session "$auth" click "@$submit_ref" >/dev/null
agent-browser --session "$auth" wait 2500 >/dev/null
agent-browser --session "$auth" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$auth" wait 2500 >/dev/null

# Phone width is set before the mark-read step, so the mark-read is verified at 390x844 (AC3).
agent-browser --session "$auth" set viewport 390 844 >/dev/null

# 3. Disposable fixtures for this learner (inserted via the local dev Postgres container).
[[ "$L_EMAIL" != *"'"* ]] || { echo 'unsafe test email'; exit 1; }
user_id=$(docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "SELECT id FROM profile.user_profile WHERE email = '$L_EMAIL';")
[[ -n "$user_id" ]] || { echo "learner profile not found"; exit 1; }
cleanup() {
  if ! docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "DELETE FROM profile.in_app_notification WHERE user_id='$user_id'::uuid AND kind='audit108_fixture';" >/dev/null; then
    echo "WARNING: failed to delete audit108 fixtures for $user_id" >&2
  fi
}
trap cleanup EXIT
docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "DELETE FROM profile.in_app_notification WHERE user_id='$user_id'::uuid AND kind='audit108_fixture';" >/dev/null
docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "INSERT INTO profile.in_app_notification (id,user_id,kind,payload,created_at) SELECT gen_random_uuid(), '$user_id'::uuid, 'audit108_fixture', '{\"message\":\"AUDIT-108 fixture older\"}'::jsonb, now()-interval '1 hour' UNION ALL SELECT gen_random_uuid(), '$user_id'::uuid, 'audit108_fixture', '{\"message\":\"AUDIT-108 fixture newer\"}'::jsonb, now();" >/dev/null
agent-browser --session "$auth" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$auth" wait 2500 >/dev/null
body=$(agent-browser --session "$auth" get text body)
[[ "$body" == *'Thông báo trong app'* && "$body" == *'AUDIT-108 fixture newer'* && "$body" == *'AUDIT-108 fixture older'* ]] || { echo "feed or preferences not rendered"; exit 1; }
[[ "$body" != *'Không tải hoặc lưu được'* ]] || { echo "page still shows load error"; exit 1; }

# 4. Mark the newest unread item read through its button, then reload and confirm persistence.
agent-browser --session "$auth" eval '(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Đánh dấu đã đọc"); if (!b) throw new Error("no mark-read button"); b.click(); return true; })()' >/dev/null
agent-browser --session "$auth" wait 1500 >/dev/null
state=$(agent-browser --session "$auth" eval '(async () => { const rows = await (await fetch("/api/learner/in-app-notifications?limit=20", {credentials:"include"})).json(); return rows.filter(r => r.kind === "audit108_fixture").map(r => r.payload.message + ":" + (r.readAt !== null)); })()')
[[ "$state" == *'AUDIT-108 fixture newer:true'* && "$state" == *'AUDIT-108 fixture older:false'* ]] || { echo "unexpected read state: $state"; exit 1; }
agent-browser --session "$auth" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$auth" wait 2500 >/dev/null
reloaded=$(agent-browser --session "$auth" eval '(() => { const li = [...document.querySelectorAll("li")].find(x => x.textContent.includes("AUDIT-108 fixture newer")); return !!li && li.textContent.includes("✓"); })()')
[[ "$reloaded" == *'true'* ]] || { echo "newer fixture row not marked read after reload: $reloaded"; exit 1; }

# 5. Layout at phone width and console health.
agent-browser --session "$auth" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$auth" wait 2000 >/dev/null
geometry=$(agent-browser --session "$auth" eval '(() => ({viewport: innerWidth, width: document.documentElement.scrollWidth}))()')
[[ "$geometry" == *'"viewport": 390'* && "$geometry" == *'"width": 390'* ]] || { echo "horizontal overflow: $geometry"; exit 1; }
console=$(agent-browser --session "$auth" console)
if [[ "$console" == *'[error]'* ]]; then printf '%s\n' "$console"; exit 1; fi

printf 'AUDIT-108 browser PASS: anon redirect + 401/401-403; learner login; feed renders newest-first; mark-read at 390px persisted after reload; width=%s; console clear.\n' "$geometry"
