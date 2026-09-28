#!/usr/bin/env bash
set -euo pipefail

out="${1:-runtime-baseline.txt}"

{
  echo "# Runtime baseline"
  date -Is || true
  echo
  echo "## Host"
  uname -a || true
  echo
  free -h || true
  echo
  df -h || true
  echo
  echo "## Docker"
  docker version 2>/dev/null || true
  echo
  docker compose version 2>/dev/null || true
  echo
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
  echo
  docker stats --no-stream 2>/dev/null || true
} > "$out"

echo "Wrote $out"
