#!/usr/bin/env bash
set -euo pipefail

node e2e/audit/audit138-fixture.mjs create
trap 'node e2e/audit/audit138-fixture.mjs cleanup' EXIT
node e2e/audit/audit138-admin-apis.mjs
