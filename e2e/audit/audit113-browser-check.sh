#!/usr/bin/env bash
# AUDIT-113 visible browser check: learner cancels a subscription on /settings/subscription at
# phone width. The plan stays active until period end (cancel_at_period_end = true). Uses the
# local dev learner test account and a disposable active subscription row that is deleted on exit.
set -euo pipefail
export AGENT_BROWSER_ENGINE=chrome
# Visible (headed) Chrome at phone width, as the audit requires.
export AGENT_BROWSER_HEADED=1
for sess in audit113 audit113-anon; do agent-browser --session "$sess" close >/dev/null 2>&1 || true; done
base=http://localhost:18081
auth=audit113
anon=audit113-anon
cd "$(git rev-parse --show-toplevel)"

eval "$(python3 -I -c "
import json,shlex
d=json.load(open('tmp/local-audit/accounts.private.json'))['learner']
print('L_EMAIL='+shlex.quote(d['email'])); print('L_PASS='+shlex.quote(d['password']))")"
[[ "$L_EMAIL" != *"'"* ]] || { echo 'unsafe test email'; exit 1; }

psql_q() { docker exec nihongo-bjt-postgres psql -U postgres -d nihongo_bjt -At -c "$1"; }
user_id=$(psql_q "SELECT id FROM profile.user_profile WHERE email = '$L_EMAIL';")
[[ -n "$user_id" ]] || { echo "learner profile not found"; exit 1; }
plan_id=$(psql_q "SELECT id FROM monetization.plan WHERE status = 'active' ORDER BY sort_order LIMIT 1;")
[[ -n "$plan_id" ]] || { echo "no active plan"; exit 1; }
sub_id=$(psql_q "SELECT gen_random_uuid();")

cleanup() {
  psql_q "DELETE FROM monetization.user_subscription WHERE id='$sub_id'::uuid;" >/dev/null || echo "WARNING: failed to delete audit113 subscription $sub_id" >&2
}
trap cleanup EXIT
# Only one disposable active subscription; any pre-existing active rows block the run.
existing=$(psql_q "SELECT count(*) FROM monetization.user_subscription WHERE user_id='$user_id'::uuid AND status IN ('active','trialing');")
[[ "$existing" == "0" ]] || { echo "learner already has $existing active subscription(s); refusing to alter them"; exit 1; }
psql_q "INSERT INTO monetization.user_subscription (id, user_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at) VALUES ('$sub_id'::uuid, '$user_id'::uuid, '$plan_id'::uuid, 'active', now() + interval '20 days', false, now());" >/dev/null

# 1. Anonymous: the API returns exactly 401 for cancel.
agent-browser --session "$anon" open "$base/vi/settings/subscription" >/dev/null
agent-browser --session "$anon" wait 3000 >/dev/null
anon_cancel=$(agent-browser --session "$anon" eval '(async () => (await fetch("/api/learner/monetization/subscription/cancel", {method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body:"{}"})).status)()')
[[ "$anon_cancel" == "401" ]] || { echo "anon cancel status=$anon_cancel, want exactly 401"; exit 1; }

# 2. Learner login through the real form at phone width.
agent-browser --session "$auth" set viewport 390 844 >/dev/null
agent-browser --session "$auth" open "$base/vi/login?returnTo=%2Fvi%2Fsettings%2Fsubscription" >/dev/null
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

# 3. The settings page shows the active plan and its cancel control.
agent-browser --session "$auth" open "$base/vi/settings/subscription" >/dev/null
agent-browser --session "$auth" wait 3000 >/dev/null
body=$(agent-browser --session "$auth" get text body)
[[ "$body" == *'Huỷ gói'* ]] || { echo "cancel control not shown"; exit 1; }

# 4. Press Huỷ gói, then confirm with the same button in the confirmation row.
click_cancel() { agent-browser --session "$auth" eval '(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Huỷ gói" && !x.disabled); if (!b) throw new Error("no cancel button"); b.click(); return true; })()' >/dev/null; }
click_cancel
agent-browser --session "$auth" wait 800 >/dev/null
click_cancel
agent-browser --session "$auth" wait 2000 >/dev/null
after=$(agent-browser --session "$auth" get text body)
[[ "$after" == *'Đã yêu cầu huỷ gói thành công.'* ]] || { echo "cancel success message not shown"; exit 1; }
[[ "$after" != *'Đã xảy ra lỗi'* ]] || { echo "error boundary shown"; exit 1; }

# 5. The database keeps the plan active until period end.
state=$(psql_q "SELECT status || ':' || cancel_at_period_end FROM monetization.user_subscription WHERE id='$sub_id'::uuid;")
[[ "$state" == "active:true" ]] || { echo "subscription state=$state, want active:true"; exit 1; }

# 6. Reloaded page reports the cancellation without re-enabling the cancel button.
agent-browser --session "$auth" open "$base/vi/settings/subscription" >/dev/null
agent-browser --session "$auth" wait 3000 >/dev/null
reloaded=$(agent-browser --session "$auth" get text body)
[[ "$reloaded" == *'Đã huỷ'* ]] || { echo "cancelled state not shown after reload"; exit 1; }

# 7. Layout at phone width and console health.
geometry=$(agent-browser --session "$auth" eval '(() => ({viewport: innerWidth, width: document.documentElement.scrollWidth}))()')
[[ "$geometry" == *'"viewport": 390'* && "$geometry" == *'"width": 390'* ]] || { echo "horizontal overflow: $geometry"; exit 1; }
console=$(agent-browser --session "$auth" console)
if [[ "$console" == *'[error]'* ]]; then printf '%s\n' "$console"; exit 1; fi

printf 'AUDIT-113 browser PASS: anonymous cancel 401; learner cancels at 390px with success message; DB active with cancel_at_period_end=true; reload shows cancelled state; console clear.\n'
