#!/usr/bin/env bash
# Canonical harness gate (suite_harness). CI runs exactly this script.
#   quality-system invariants · harness unit/lifecycle-e2e/adversarial mutation tests
#   (zero skips allowed, required self-test files must run) · execution accounting
# Needs: node, pnpm install, git, go (the e2e tests drive real `go test` in temp repos).
# Usage: scripts/quality/verify-harness.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Propagate QUALITY_SUMMARY_DIR so the parent `verify --suite suite_harness`
# command can read the execution-accounting JSON produced by self-test.
export QUALITY_SUMMARY_DIR="${QUALITY_SUMMARY_DIR:-}"
node scripts/quality/harness/cli.mjs self-test
