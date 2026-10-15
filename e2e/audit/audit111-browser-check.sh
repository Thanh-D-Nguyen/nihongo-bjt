#!/usr/bin/env bash
# AUDIT-111 visible browser check: learner subscription settings page renders the plan summary
# without the error boundary. Uses the local dev learner test account from
# tmp/local-audit/accounts.private.json. Read-only apart from the login session.
set -euo pipefail
export AGENT_BROWSER_ENGINE=chrome
# Visible (headed) Chrome at phone width, as the audit requires.
export AGENT_BROWSER_HEADED=1
for sess in audit111 audit111-anon; do agent-browser --session "$sess" close >/dev/null 2>&1 || true; done
base=http://localhost:18081
auth=audit111
anon=audit111-anon
cd "$(git rev-parse --show-toplevel)"

eval "$(python3 -I -c "
import json,shlex
d=json.load(open('tmp/local-audit/accounts.private.json'))['learner']
print('L_EMAIL='+shlex.quote(d['email'])); print('L_PASS='+shlex.quote(d['password']))")"

# 1. Anonymous: the API returns exactly 401. (The page itself lacks a RequireAuth redirect; tracked separately.)
agent-browser --session "$anon" open "$base/vi/settings/subscription" >/dev/null
agent-browser --session "$anon" wait 3000 >/dev/null
anon_api=$(agent-browser --session "$anon" eval '(async () => (await fetch("/api/learner/monetization/subscription", {credentials:"include"})).status)()')
[[ "$anon_api" == "401" ]] || { echo "anon subscription status=$anon_api, want exactly 401"; exit 1; }

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

# 3. The subscription API returns the summary fields alongside the existing ones.
api=$(agent-browser --session "$auth" eval '(async () => { const r = await fetch("/api/learner/monetization/subscription", {credentials:"include"}); const b = await r.json(); return JSON.stringify({status: r.status, hasSub: "subscription" in b, hasPending: "pendingSubscription" in b, source: b.source, planNameVi: b.planNameVi, entitlementsIsArray: Array.isArray(b.entitlements), quotasIsArray: Array.isArray(b.quotas)}); })()' | sed 's/\\//g')
[[ "$api" == *'"status":200'* && "$api" == *'"hasSub":true'* && "$api" == *'"hasPending":true'* && "$api" == *'"entitlementsIsArray":true'* && "$api" == *'"quotasIsArray":true'* ]] || { echo "subscription API shape wrong: $api"; exit 1; }

# 4. The settings page renders the plan name from the API with no error boundary.
agent-browser --session "$auth" open "$base/vi/settings/subscription" >/dev/null
agent-browser --session "$auth" wait 3000 >/dev/null
plan_vi=$(agent-browser --session "$auth" eval '(async () => { const b = await (await fetch("/api/learner/monetization/subscription", {credentials:"include"})).json(); return b.planNameVi || b.planName; })()' | tr -d '"')
body=$(agent-browser --session "$auth" get text body)
[[ "$body" != *'Đã xảy ra lỗi'* && "$body" != *'Xin lỗi, có lỗi xảy ra'* ]] || { echo "error boundary still shown"; exit 1; }
[[ "$body" != *'Không thể tải thông tin đăng ký'* ]] || { echo "subscription load error still shown"; exit 1; }
[[ -n "$plan_vi" && "$body" == *"$plan_vi"* ]] || { echo "plan name '$plan_vi' not rendered"; exit 1; }

# 5. Layout at phone width and console health.
geometry=$(agent-browser --session "$auth" eval '(() => ({viewport: innerWidth, width: document.documentElement.scrollWidth}))()')
[[ "$geometry" == *'"viewport": 390'* && "$geometry" == *'"width": 390'* ]] || { echo "horizontal overflow: $geometry"; exit 1; }
console=$(agent-browser --session "$auth" console)
if [[ "$console" == *'[error]'* ]]; then printf '%s\n' "$console"; exit 1; fi

printf 'AUDIT-111 browser PASS: anonymous API 401; learner subscription page renders plan "%s" with no error boundary at 390px; console clear.\n' "$plan_vi"
