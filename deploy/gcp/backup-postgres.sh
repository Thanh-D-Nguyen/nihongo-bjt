#!/usr/bin/env bash
set -euo pipefail

repo_root="/home/deploy/nihongo-bjt"
backup_dir="/home/deploy/backups/postgres"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

cd "$repo_root"
set -a
. deploy/gcp/runtime/infrastructure.env
set +a

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

sudo docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" gcp-postgres-1 \
  pg_dump -U postgres -d nihongo_bjt -Fc > "$backup_dir/nihongo_bjt-$timestamp.dump"

sudo docker exec -e PGPASSWORD="$KEYCLOAK_DB_PASSWORD" gcp-keycloak-db-1 \
  pg_dump -U keycloak -d keycloak -Fc > "$backup_dir/keycloak-$timestamp.dump"

chmod 600 "$backup_dir"/*.dump
find "$backup_dir" -type f -name '*.dump' -mtime +7 -delete
