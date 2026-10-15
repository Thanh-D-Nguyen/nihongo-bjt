#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_BROWSER_SESSION:?set to the headed authenticated learner browser session}"
: "${AUDIT_USER_ID:?user ID returned after real learner registration/login UI}"
[[ "$AUDIT_USER_ID" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$ ]]
export AGENT_BROWSER_ENGINE=chrome

subscription_id="$(docker compose exec -T postgres psql -U postgres -d nihongo_bjt -XAt -v ON_ERROR_STOP=1 -c 'SELECT gen_random_uuid()')"
cleanup() {
  docker compose exec -T postgres psql -U postgres -d nihongo_bjt -Xq -v ON_ERROR_STOP=1 \
    -c "DELETE FROM monetization.user_subscription WHERE id='${subscription_id}'::uuid AND user_id='${AUDIT_USER_ID}'::uuid" >/dev/null
}
trap cleanup EXIT

docker compose exec -T postgres psql -U postgres -d nihongo_bjt -Xq -v ON_ERROR_STOP=1 \
  -c "INSERT INTO monetization.user_subscription (id,user_id,plan_id,status,provider,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at) SELECT '${subscription_id}'::uuid,'${AUDIT_USER_ID}'::uuid,id,'active','local',now()-interval '30 days',now()-interval '1 day',true,now(),now() FROM monetization.plan WHERE slug='plus' AND status='active'"
fixture="$(docker compose exec -T postgres psql -U postgres -d nihongo_bjt -XAt -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM monetization.user_subscription WHERE id='${subscription_id}'::uuid AND user_id='${AUDIT_USER_ID}'::uuid AND status='active' AND current_period_end < now()")"
[[ "$fixture" == "1" ]]

agent-browser network requests --clear >/dev/null
agent-browser open http://localhost:18081/vi/settings/subscription
agent-browser wait 1200 >/dev/null
body="$(agent-browser get text body)"
printf '%s\n' "$body"
printf '%s' "$body" | rg -Fq 'Bạn đang dùng gói miễn phí.'
if printf '%s' "$body" | rg -Fq 'Hết hạn vào:' || printf '%s' "$body" | rg -Fq 'premium_styles'; then
  echo 'Expired paid plan or entitlement still appears in the UI' >&2
  exit 1
fi
requests="$(agent-browser network requests --filter '/api/learner/monetization/subscription')"
printf '%s\n' "$requests"
printf '%s' "$requests" | rg -q 'GET .*api/learner/monetization/subscription.*\(Fetch\) 200'
