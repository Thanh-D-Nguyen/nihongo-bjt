#!/usr/bin/env bash
set -euo pipefail

required=(
  ".github/copilot-instructions.md"
  "protocols/compiled-protocols.md"
  "company/PROJECT_STATE.md"
  "company/COMPANY_BACKLOG.md"
  "company/SPRINT_BOARD.md"
  "company/DECISION_LOG.md"
  "company/AGENT_HANDOFF.md"
)

for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required company file: $f" >&2
    exit 1
  fi
done

echo "AI company files OK"
