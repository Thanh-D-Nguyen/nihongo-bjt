#!/usr/bin/env bash
set -euo pipefail
cd /Users/thanhnguyen/Documents/Projects/nihongo-bjt/apps/api-go

CONTAINER="m3-login-v5-$(date +%s)"
PORT=15441
PASS="testpass"
DB="m3_login_v5"
MIGRATIONS=/Users/thanhnguyen/Documents/Projects/nihongo-bjt/packages/database/prisma/migrations

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$CONTAINER" -p "$PORT:5432" -e POSTGRES_PASSWORD="$PASS" postgres:17-alpine >/dev/null 2>&1
echo "CONTAINER=$CONTAINER"
until pg_isready -h localhost -p "$PORT" -U postgres -q; do sleep 0.5; done
echo "PG_READY"

PGPASSWORD="$PASS" psql -h localhost -p "$PORT" -U postgres -c "CREATE DATABASE $DB;" >/dev/null 2>&1

# Minimal media.asset stub (FK target for profile.user_profile.cover_asset_id)
PGPASSWORD="$PASS" psql -h localhost -p "$PORT" -U postgres -d "$DB" -c "
CREATE SCHEMA IF NOT EXISTS media;
CREATE TABLE media.asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);" >/dev/null 2>&1
echo "SCHEMA: media.asset created"

# RBAC + profile + authz (creates profile.user_profile base table)
PGPASSWORD="$PASS" psql -h localhost -p "$PORT" -U postgres -d "$DB" \
  -f "$MIGRATIONS/20260425234500_admin_cms_rbac/migration.sql" >/dev/null 2>&1
echo "SCHEMA: admin_cms_rbac applied"

# Profile column additions in chronological order
PGPASSWORD="$PASS" psql -h localhost -p "$PORT" -U postgres -d "$DB" -c "
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS ads_personalization_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS share_postcard_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS cover_asset_id UUID;
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profile_cover_asset_id_fkey') THEN
    ALTER TABLE profile.user_profile ADD CONSTRAINT user_profile_cover_asset_id_fkey
      FOREIGN KEY (cover_asset_id) REFERENCES media.asset(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END \$\$;
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(16) NOT NULL DEFAULT 'system';
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS font_size_preference VARCHAR(16) NOT NULL DEFAULT 'default';
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS density_preference VARCHAR(16) NOT NULL DEFAULT 'comfortable';
ALTER TABLE profile.user_profile ADD COLUMN IF NOT EXISTS flashcard_style_slug VARCHAR(64);
" >/dev/null 2>&1
echo "SCHEMA: profile columns added"

# Auth schema + M2 persistence tables
PGPASSWORD="$PASS" psql -h localhost -p "$PORT" -U postgres -d "$DB" -c "CREATE SCHEMA IF NOT EXISTS auth;" >/dev/null 2>&1
PGPASSWORD="$PASS" psql -h localhost -p "$PORT" -U postgres -d "$DB" \
  -f "$MIGRATIONS/20260928120000_m2_auth_session_persistence/migration.sql" >/dev/null 2>&1
echo "SCHEMA: M2 auth persistence applied"

export TEST_DATABASE_URL="postgres://postgres:$PASS@localhost:$PORT/$DB?sslmode=disable"

echo "---LOGIN TESTS count=2---"
GOTOOLCHAIN=go1.23.0 go test ./internal/httpserver/... -count=2 -v \
  -run 'TestLearnerLogin|TestAdminLogin|TestLogin_Namespace' 2>&1 | \
  grep -E '^(=== RUN|--- PASS|--- FAIL|FAIL|ok)' | tail -60

echo "---EXIT CODE---"
GOTOOLCHAIN=go1.23.0 go test ./internal/httpserver/... -count=2 \
  -run 'TestLearnerLogin|TestAdminLogin|TestLogin_Namespace' 2>&1 | tail -5

echo "DONE"