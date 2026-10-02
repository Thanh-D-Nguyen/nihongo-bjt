#!/usr/bin/env bash
# Canonical frontend quality gate. CI runs exactly this script (after Prisma provisioning).
#   typecheck · lint + unit-test debt ratchet · production build
# Usage: scripts/quality/verify-frontend.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== typecheck"
pnpm typecheck

echo "=== lint + unit tests (debt ratchet: known debt only, fails closed on tool failure)"
node scripts/quality/check-frontend-debt.mjs

echo "=== production build"
pnpm build

echo ""
echo "ALL FRONTEND GATES PASSED"
