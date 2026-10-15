#!/usr/bin/env bash
set -euo pipefail

INPUT="$(cat)"

TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""')"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')"

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# ------------------------------------------------------------
# 1. Never use local Write/Edit for remote Linux paths
# ------------------------------------------------------------

# ------------------------------------------------------------
# Never use Claude filesystem tools for remote/special OS paths
# ------------------------------------------------------------

case "$TOOL_NAME" in
  Write|Edit)
    case "$FILE_PATH" in
      /srv/*)
        deny "/srv/* belongs to a REMOTE Linux host. Do not use local Claude Write/Edit. Use Bash with SSH/SCP/rsync. Do not retry this tool call."
        ;;

      /dev/*)
        deny "/dev/* is an OS device path. Never use Claude Write/Edit on device files such as /dev/null. If output must be discarded, use Bash redirection: command >/dev/null 2>&1."
        ;;

      /proc/*|/sys/*)
        deny "$FILE_PATH is a kernel/pseudo-filesystem path. Do not use Claude Write/Edit. Use the appropriate Bash command on the correct host."
        ;;

      /run/*|/var/run/*)
        deny "$FILE_PATH is a runtime/system path. Do not use Claude Write/Edit. Use Bash on the correct host if runtime inspection or modification is actually required."
        ;;
    esac
    ;;
esac

# ------------------------------------------------------------
# 2. Protect local Bash from accidentally manipulating remote paths
# ------------------------------------------------------------

if [[ "$TOOL_NAME" == "Bash" ]]; then

  if [[ "$COMMAND" == *"/srv/kotobawork"* ]]; then
    IS_REMOTE=0

    if [[ "$COMMAND" == ssh\ * ||
          "$COMMAND" == *" ssh "* ||
          "$COMMAND" == scp\ * ||
          "$COMMAND" == *" scp "* ||
          "$COMMAND" == rsync\ * ||
          "$COMMAND" == *" rsync "* ]]; then
      IS_REMOTE=1
    fi

    if [[ "$IS_REMOTE" -eq 0 ]]; then
      deny "/srv/kotobawork is remote-only. Do not manipulate it using local macOS Bash. Use SSH, SCP, or rsync."
    fi
  fi

  # Consequential/destructive decisions are handled by the canonical project
  # PreToolUse hook (scripts/quality/harness/hook.mjs). Keep this legacy hook
  # focused on remote/device scope; a second unconditional deny would override
  # native scoped permission and prevent authorized recovery.

fi

exit 0