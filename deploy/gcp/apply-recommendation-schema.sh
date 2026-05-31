#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/nihongo-bjt

sudo docker exec -i gcp-postgres-1 \
  psql \
  --username postgres \
  --dbname nihongo_bjt \
  --set ON_ERROR_STOP=1 \
  < database/scripts/migrations/20260519_recommendation_schema.sql
