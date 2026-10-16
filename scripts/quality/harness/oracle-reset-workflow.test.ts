// The one-time Oracle database reset is destructive. The workflow is tiny, so the
// test pins its executable content exactly: any change to a guard (a fail-open
// suffix, a step condition or an env override) must be made here deliberately.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./fixture";

const file = path.join(REPO_ROOT, ".github/workflows/oracle-reset-database.yml");
const executable = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#") && !line.trim().startsWith("description:"))
    .join("\n");

const EXPECTED = String.raw`name: Reset Oracle database (one time)


on:
  workflow_dispatch:
    inputs:
      confirm:
        required: true
        type: string

permissions:
  contents: read

concurrency:
  group: oracle-production
  cancel-in-progress: false

jobs:
  reset:
    if: __DOLLAR__{{ github.ref == 'refs/heads/main' }}
    runs-on: [self-hosted, Linux, ARM64, kotobawork-oci]
    timeout-minutes: 10
    environment:
      name: oracle-production
    env:
      CONFIRM: __DOLLAR__{{ inputs.confirm }}
    steps:
      - name: Require typed confirmation
        run: test "$CONFIRM" = "WIPE-ORACLE-DATABASE"
      - name: Refuse after the first release, back up, drop and recreate
        run: |
          set -euo pipefail
          base=/srv/kotobawork
          exec 9>"$base/runtime/deploy.lock"
          flock -n 9
          exists="$(docker exec -u postgres oci-postgres-1 psql -U postgres -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname = 'nihongo_bjt'")"
          if [ "$exists" = "1" ]; then
            released="$(docker exec -u postgres oci-postgres-1 psql -U postgres -d nihongo_bjt -Atc "SELECT to_regclass('content._prisma_migrations') IS NOT NULL")"
            if [ "$released" != "f" ]; then
              echo "Refusing: a release already recorded migration history; this one-time reset is spent." >&2
              exit 3
            fi
            install -d -m 700 "$base/data/backups/resets"
            dump="$base/data/backups/resets/nihongo_bjt-before-reset-__DOLLAR__{GITHUB_RUN_ID}-__DOLLAR__{GITHUB_RUN_ATTEMPT}.dump"
            test ! -e "$dump"
            umask 077
            docker exec -u postgres oci-postgres-1 pg_dump -U postgres -d nihongo_bjt -Fc > "$dump.partial"
            docker exec -i oci-postgres-1 pg_restore --list < "$dump.partial" > /dev/null
            mv -n "$dump.partial" "$dump"
          fi
          docker exec -u postgres oci-postgres-1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
            -c "DROP DATABASE IF EXISTS nihongo_bjt WITH (FORCE);" \
            -c "CREATE DATABASE nihongo_bjt;"
      - name: Verify the database is empty
        run: |
          set -euo pipefail
          tables="$(docker exec -u postgres oci-postgres-1 psql -U postgres -d nihongo_bjt -Atc \
            "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
          test "$tables" = "0"
          echo "nihongo_bjt recreated empty; run 'Deploy Oracle production' next."
`.replaceAll("__DOLLAR__", "$");

describe("Oracle database reset workflow", () => {
  it("is exactly the reviewed manual, main-only, confirmed, backed-up and self-expiring reset", () => {
    expect(existsSync(file), "reset workflow is missing").toBe(true);
    expect(executable(readFileSync(file, "utf8")).trimEnd()).toBe(EXPECTED.trimEnd());
  });

  it("keeps the structural guards readable in the pinned text", () => {
    expect(EXPECTED).toMatch(/^on:\n {2}workflow_dispatch:\n/mu);
    expect(EXPECTED).not.toMatch(/\|\| true|continue-on-error|if: (always|failure|false)|\n {6,}- ?if:/u);
    expect(EXPECTED.match(/DROP DATABASE/gu)).toHaveLength(1);
    expect(EXPECTED.indexOf('test "$CONFIRM"')).toBeLessThan(EXPECTED.indexOf("pg_dump"));
    expect(EXPECTED.indexOf("pg_restore --list")).toBeLessThan(EXPECTED.indexOf("DROP DATABASE"));
    expect(EXPECTED.indexOf("_prisma_migrations")).toBeLessThan(EXPECTED.indexOf("pg_dump"));
  });
});
