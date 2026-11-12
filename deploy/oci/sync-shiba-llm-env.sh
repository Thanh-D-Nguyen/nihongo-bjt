#!/usr/bin/env bash
# Sync the Shiba LLM settings (SHIBA_LLM_*) from the process environment —
# populated from the GitHub "oracle-production" environment vars/secrets by
# the deploy workflow — into the OCI production env file, so the settings
# are managed in GitHub instead of by editing the file on the host.
#
# Usage: sync-shiba-llm-env.sh <path-to-.env.production>
#
# Contract:
#   - only the four SHIBA_LLM_* keys are ever touched; every other line is
#     preserved byte-for-byte;
#   - a key whose incoming value is empty, or contains a newline, is skipped
#     (an existing value is never blanked);
#   - values travel to awk through the environment, never through argv or
#     awk -v, so they are neither visible in process lists nor mangled by
#     escape processing, and they are never printed;
#   - the write is atomic (temp file + rename), preserves the file mode and
#     keeps one rolling backup at <file>.bak-shiba-llm with the same mode;
#   - running it twice with the same inputs changes nothing the second time.
set -euo pipefail
umask 077

ENV_FILE="${1:?usage: sync-shiba-llm-env.sh <env-file>}"
KEYS="SHIBA_LLM_BASE_URL SHIBA_LLM_MODEL SHIBA_LLM_CF_ACCESS_CLIENT_ID SHIBA_LLM_CF_ACCESS_CLIENT_SECRET"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "sync-shiba-llm-env: env file not found: $ENV_FILE" >&2
  exit 1
fi

tmp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
trap 'rm -f "$tmp" "${tmp}.next"' EXIT
cp "$ENV_FILE" "$tmp"

changed=0
for key in $KEYS; do
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "sync-shiba-llm-env: $key is not set; leaving the env file unchanged for it"
    continue
  fi
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "sync-shiba-llm-env: $key contains a newline; skipping it" >&2
    continue
  fi
  line="${key}=${value}"
  stats="$(SYNC_KEY="$key" SYNC_LINE="$line" awk '
    BEGIN { k = ENVIRON["SYNC_KEY"]; l = ENVIRON["SYNC_LINE"]; total = 0; same = 0 }
    index($0, k "=") == 1 { total++; if ($0 == l) same++ }
    END { print total " " same }
  ' "$tmp")"
  total="${stats% *}"
  same="${stats#* }"
  if [[ "$total" -gt 0 && "$total" == "$same" ]]; then
    continue
  fi
  if [[ "$total" -gt 0 ]]; then
    SYNC_KEY="$key" SYNC_LINE="$line" awk '
      BEGIN { k = ENVIRON["SYNC_KEY"]; l = ENVIRON["SYNC_LINE"] }
      index($0, k "=") == 1 { print l; next }
      { print }
    ' "$tmp" > "${tmp}.next"
    mv "${tmp}.next" "$tmp"
  else
    if [[ -s "$tmp" && -n "$(tail -c 1 "$tmp")" ]]; then
      printf '\n' >> "$tmp"
    fi
    printf '%s\n' "$line" >> "$tmp"
  fi
  changed=1
done

if [[ "$changed" -eq 1 ]]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak-shiba-llm"
  chmod --reference="$ENV_FILE" "${ENV_FILE}.bak-shiba-llm" 2>/dev/null || chmod 600 "${ENV_FILE}.bak-shiba-llm"
  chmod --reference="$ENV_FILE" "$tmp" 2>/dev/null || chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
  trap - EXIT
  echo "sync-shiba-llm-env: env file updated"
else
  echo "sync-shiba-llm-env: no changes needed"
fi
