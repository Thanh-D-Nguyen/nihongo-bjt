#!/usr/bin/env bash
set -euo pipefail

echo "== Git =="
pwd
git status --short || true
git branch --show-current || true
git rev-parse HEAD || true
echo

echo "== Top-level =="
find . -maxdepth 2 -type f \
  \( -name 'AGENTS.md' -o -name 'CLAUDE.md' -o -name 'README*' -o -name 'package.json' -o -name 'pnpm-workspace.yaml' -o -name 'go.mod' -o -name 'Dockerfile*' -o -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \) \
  -print | sort
echo

echo "== Package manifests =="
find . -maxdepth 4 -name package.json -print | sort
echo

echo "== Auth / Keycloak files =="
find . -maxdepth 5 -type f \
  \( -iname '*keycloak*' -o -iname '*auth*' -o -iname '*oidc*' -o -iname '*oauth*' \) \
  -print | head -300
echo

echo "== Keycloak/Auth code references =="
git grep -n -E 'Keycloak|keycloak|OIDC|openid|oauth|Authorization|Bearer|roles?|permissions?' -- \
  ':!node_modules' ':!.next' ':!dist' ':!coverage' | head -500 || true
echo

echo "== Infra code references =="
git grep -n -E 'redis|meilisearch|minio|socket\.io|websocket|cron|queue|bullmq|prisma' -- \
  ':!node_modules' ':!.next' ':!dist' ':!coverage' | head -500 || true
echo

echo "== Docker images =="
git grep -n -E '^[[:space:]]*image:[[:space:]]*' -- \
  '*docker-compose*.yml' '*docker-compose*.yaml' 2>/dev/null || true
echo


echo "== Storage references =="
git grep -n -E 'minio|MinIO|S3Client|s3\.|presign|bucket|object[_-]?key|upload|media' -- \
  ':!node_modules' ':!.next' ':!dist' ':!coverage' | head -700 || true
echo

echo "== Next runtime/static-export indicators =="
git grep -n -E 'getServerSideProps|server action|use server|NextRequest|middleware|cookies\(|headers\(|next/image|output:[[:space:]]*["'\'']export["'\'']' -- \
  ':!node_modules' ':!.next' ':!dist' ':!coverage' | head -500 || true
echo

echo "Audit complete. Read matched source/tests; do not treat grep output as final truth."
