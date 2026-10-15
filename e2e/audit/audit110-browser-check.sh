#!/usr/bin/env bash
# AUDIT-110 visible browser check: saving notification preferences on /settings/notifications
# for a learner who has no notification_preference row. Uses the local dev learner test account
# from tmp/local-audit/accounts.private.json. The row is removed before the run to reproduce the
# missing-row case; the save recreates it with the defaults the page shows.
set -euo pipefail
export AGENT_BROWSER_ENGINE=chrome
# Visible (headed) Chrome at phone width, as the audit requires.
export AGENT_BROWSER_HEADED=1
for sess in audit110 audit110-anon; do agent-browser --session "$sess" close >/dev/null 2>&1 || true; done
base=http://localhost:18081
auth=audit110
anon=audit110-anon
cd "$(git rev-parse --show-toplevel)"

eval "$(python3 -I -c "
import json,shlex
d=json.load(open('tmp/local-audit/accounts.private.json'))['learner']
print('L_EMAIL='+shlex.quote(d['email'])); print('L_PASS='+shlex.quote(d['password']))")"

# 1. Anonymous: settings page redirects to login.
agent-browser --session "$anon" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$anon" wait 4000 >/dev/null
anon_url=$(agent-browser --session "$anon" get url)
[[ "$anon_url" == *'/vi/login'* ]] || { echo "anon page not redirected: $anon_url"; exit 1; }
anon_put=$(agent-browser --session "$anon" eval '(async () => (await fetch("/api/learner/notification-preferences", {method:"PUT", headers:{"Content-Type":"application/json"}, credentials:"include", body:"{}"})).status)()')
[[ "$anon_put" == "401" ]] || { echo "anon PUT status=$anon_put, want exactly 401"; exit 1; }

# 2. Learner login through the real form at phone width.
agent-browser --session "$auth" set viewport 390 844 >/dev/null
agent-browser --session "$auth" open "$base/vi/login?returnTo=%2Fvi%2Fsettings%2Fnotifications" >/dev/null
agent-browser --session "$auth" wait 2000 >/dev/null
snap=$(agent-browser --session "$auth" snapshot -i)
email_ref=$(printf '%s\n' "$snap" | sed -n 's/.*textbox "Email".*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
pass_ref=$(printf '%s\n' "$snap" | sed -n 's/.*textbox "Mật khẩu".*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
submit_ref=$(printf '%s\n' "$snap" | sed -n 's/.*button "Đăng nhập".*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
[[ -n "$email_ref" && -n "$pass_ref" && -n "$submit_ref" ]] || { echo "login form refs not found"; exit 1; }
agent-browser --session "$auth" fill "@$email_ref" "$L_EMAIL" >/dev/null
agent-browser --session "$auth" fill "@$pass_ref" "$L_PASS" >/dev/null
agent-browser --session "$auth" click "@$submit_ref" >/dev/null
agent-browser --session "$auth" wait 2500 >/dev/null

# 3. Remove the learner's preferences row to reproduce the missing-row case.
[[ "$L_EMAIL" != *"'"* ]] || { echo 'unsafe test email'; exit 1; }
user_id=$(docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "SELECT id FROM profile.user_profile WHERE email = '$L_EMAIL';")
[[ -n "$user_id" ]] || { echo "learner profile not found"; exit 1; }
docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "DELETE FROM profile.notification_preference WHERE user_id='$user_id'::uuid;" >/dev/null
agent-browser --session "$auth" open "$base/vi/settings/notifications" >/dev/null
agent-browser --session "$auth" wait 2500 >/dev/null
body=$(agent-browser --session "$auth" get text body)
[[ "$body" == *'Thông báo trong app'* ]] || { echo "preferences form not rendered"; exit 1; }

# 4. Press Lưu and expect the localized success message, not the load/save error.
agent-browser --session "$auth" eval '(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Lưu"); if (!b) throw new Error("no save button"); b.click(); return true; })()' >/dev/null
agent-browser --session "$auth" wait 2000 >/dev/null
after=$(agent-browser --session "$auth" get text body)
[[ "$after" == *'Đã lưu cài đặt.'* ]] || { echo "save success message not shown"; exit 1; }
[[ "$after" != *'Không tải hoặc lưu được'* ]] || { echo "save error still shown"; exit 1; }

# 5. The saved row exists and the API returns it.
row=$(docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "SELECT count(*) || ':' || (bool_and(updated_at IS NOT NULL)) FROM profile.notification_preference WHERE user_id='$user_id'::uuid;")
[[ "$row" == "1:true" ]] || { echo "saved row state=$row, want 1:true"; exit 1; }
api=$(agent-browser --session "$auth" eval '(async () => (await fetch("/api/learner/notification-preferences", {credentials:"include"})).status)()')
[[ "$api" == "200" ]] || { echo "GET after save status=$api"; exit 1; }

# 6. Layout at phone width and console health.
geometry=$(agent-browser --session "$auth" eval '(() => ({viewport: innerWidth, width: document.documentElement.scrollWidth}))()')
[[ "$geometry" == *'"viewport": 390'* && "$geometry" == *'"width": 390'* ]] || { echo "horizontal overflow: $geometry"; exit 1; }
console=$(agent-browser --session "$auth" console)
if [[ "$console" == *'[error]'* ]]; then printf '%s\n' "$console"; exit 1; fi

printf 'AUDIT-110 browser PASS: anonymous redirect and PUT 401; learner with no row saves via Lưu at 390px with success message; row persisted with updated_at; GET 200; console clear.\n'
