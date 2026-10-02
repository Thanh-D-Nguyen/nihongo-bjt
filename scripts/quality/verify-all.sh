#!/usr/bin/env bash
# Canonical PR-level quality gate: Go + frontend (same scripts CI runs).
# Browser E2E is NOT included and is not automated yet (manual only; see docs/engineering/ENGINEERING_POLICY.md §11).
# Usage:
#   TEST_DATABASE_URL=postgresql://... scripts/quality/verify-all.sh
#   scripts/quality/with-test-db.sh scripts/quality/verify-all.sh   # local, needs Docker
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=========================================="
echo "  PR QUALITY GATE (Go + frontend)"
echo "=========================================="

echo ""
echo "--- [1/2] Go ---"
bash "$REPO_ROOT/scripts/quality/verify-go.sh"

echo ""
echo "--- [2/2] Frontend ---"
bash "$REPO_ROOT/scripts/quality/verify-frontend.sh"

echo ""
echo "=========================================="
echo "  PR QUALITY GATE PASSED (browser E2E not included)"
echo "=========================================="
