#!/bin/sh
set -eu

: "${AGENT_BROWSER_SESSION:?use the headed audit114 browser session}"
: "${PROFILE_ID:?set the disposable learner profile UUID}"
export AGENT_BROWSER_ENGINE=chrome

agent-browser set viewport 390 844
agent-browser open "http://localhost:18081/vi/u/${PROFILE_ID}"
agent-browser wait 800
snapshot=$(agent-browser snapshot -i)
for expected in "Profile Audit Learner" "Sửa hồ sơ" "Sao chép link"; do
  case "$snapshot" in *"$expected"*) ;; *) printf '%s\n' "self profile UI missing $expected" "$snapshot" >&2; exit 1 ;; esac
done
metrics=$(agent-browser eval 'document.documentElement.clientWidth===390 && document.documentElement.scrollWidth===390')
case "$metrics" in
  *true*) ;;
  *) printf '%s\n' "mobile viewport overflow: $metrics" >&2; exit 1 ;;
esac
agent-browser find role button click --name "Sao chép link"
agent-browser wait 200
copied=$(agent-browser eval 'document.body.innerText.includes("Đã sao chép!")')
case "$copied" in *true*) ;; *) printf '%s\n' "copy profile link action did not confirm" >&2; exit 1 ;; esac
requests=$(agent-browser network requests --filter "/api/users/${PROFILE_ID}/profile")
case "$requests" in *"/api/users/${PROFILE_ID}/profile (Fetch) 200"*) ;; *) printf '%s\n' "public profile request did not return 200: $requests" >&2; exit 1 ;; esac
console=$(agent-browser console)
case "$console" in
  *"[error]"*|*"Uncaught"*|*"TypeError"*|*"ReferenceError"*|*"SyntaxError"*) printf '%s\n' "browser console error: $console" >&2; exit 1 ;;
esac
printf '%s\n' "AUDIT-114 headed profile PASS: authenticated self, GET 200, copy action, 390x844 no overflow, no page errors."
