#!/usr/bin/env bash
# Canonical Go quality gate. CI runs exactly this script.
#   gofmt · go vet · go test incl. PostgreSQL integration + skip audit · go test -race · ARM64 build
#
# Usage:
#   TEST_DATABASE_URL=postgresql://... scripts/quality/verify-go.sh   # DB must have the canonical schema
#   scripts/quality/with-test-db.sh scripts/quality/verify-go.sh      # local: throwaway PG17 via Docker
#   scripts/quality/verify-go.sh --unit-only                          # PARTIAL — DB tests skip; NOT a verification
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API_DIR="$REPO_ROOT/apps/api-go"
UNIT_ONLY=0
[ "${1:-}" = "--unit-only" ] && UNIT_ONLY=1

if [ "$UNIT_ONLY" -eq 0 ] && [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "ERROR: TEST_DATABASE_URL is not set. Without it ~150 auth/session/RBAC/realtime/SQL integration" >&2
  echo "tests skip and 'go test' still reports PASS. Run via scripts/quality/with-test-db.sh, or pass" >&2
  echo "--unit-only to get an explicitly PARTIAL result." >&2
  exit 2
fi

cd "$API_DIR"

echo "=== gofmt"
unformatted="$(gofmt -l .)"
if [ -n "$unformatted" ]; then
  echo "FAIL: unformatted files:" >&2
  echo "$unformatted" >&2
  exit 1
fi

echo "=== go vet"
go vet ./...

if [ "$UNIT_ONLY" -eq 1 ]; then
  echo "=== go test (unit only)"
  go test -count=1 ./...
  echo "=== go test -race (unit only)"
  go test -race -count=1 ./...
else
  echo "=== go test (with PostgreSQL integration) + skip audit"
  report="$(mktemp)"
  trap 'rm -f "$report"' EXIT
  status=0
  go test -count=1 -p 1 -json ./... >"$report" || status=$?
  node "$REPO_ROOT/scripts/quality/check-go-test-report.mjs" "$report" "$status"

  echo "=== go test -race (with PostgreSQL integration)"
  go test -race -count=1 -p 1 ./...
fi

echo "=== ARM64 Linux build"
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o /dev/null ./cmd/api

if [ "$UNIT_ONLY" -eq 1 ]; then
  echo ""
  echo "PARTIAL: unit-only run. DB integration tests were skipped — this is NOT a VERIFIED result."
else
  echo ""
  echo "ALL GO GATES PASSED"
fi
