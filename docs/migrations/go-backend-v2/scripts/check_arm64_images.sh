#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  cat <<'EOF'
Usage:
  check_arm64_images.sh image[:tag] [image[:tag] ...]

Example:
  check_arm64_images.sh postgres:16 redis:7
EOF
  exit 2
fi

fail=0
for image in "$@"; do
  echo "== $image =="
  if docker buildx imagetools inspect "$image" 2>/dev/null | grep -E 'linux/arm64|Platform:[[:space:]]*linux/arm64' >/dev/null; then
    echo "ARM64: YES"
  else
    echo "ARM64: NOT CONFIRMED"
    fail=1
  fi
  echo
done

exit "$fail"
