# Quality Verification Scripts

Canonical verification commands. CI (`.github/workflows/ci.yml`) runs these same scripts. Which gates a change needs is defined in [`docs/engineering/ENGINEERING_POLICY.md`](../../docs/engineering/ENGINEERING_POLICY.md) §3; status vocabulary in §12.

## PR gate

```bash
scripts/quality/with-test-db.sh scripts/quality/verify-all.sh   # local; needs Docker
TEST_DATABASE_URL=postgresql://... scripts/quality/verify-all.sh # existing disposable DB with the canonical schema
```

| Script | What it does |
|--------|--------------|
| `verify-all.sh` | `verify-go.sh` + `verify-frontend.sh` |
| `verify-go.sh` | gofmt · `go vet` · `go test -json` with PostgreSQL integration → `check-go-test-report.mjs` · `go test -race` · ARM64 Linux build. Fails without `TEST_DATABASE_URL`; `--unit-only` prints an explicit PARTIAL result |
| `verify-frontend.sh` | `pnpm typecheck` · `check-frontend-debt.mjs` · `pnpm build` |
| `with-test-db.sh <cmd>` | Throwaway PostgreSQL 17 container + `provision-test-schema.sh`, exports `TEST_DATABASE_URL`, runs `<cmd>`, removes the container |
| `provision-test-schema.sh <url>` | Prisma migrations + `apps/api-go/internal/postgres/migrations/*.sql` on an empty database |

## Ratchets and audits

| Script / test | Baseline (reviewed in git; CI never writes it) | Update |
|---------------|-----------------------------------------------|--------|
| `check-frontend-debt.mjs` — ESLint debt by `file × severity:rule`, failing/skipped tests by exact id, fail-closed on tool failure | `frontend-debt-baseline.json` | `node scripts/quality/check-frontend-debt.mjs --update-baseline` |
| `check-go-test-report.mjs` — no unexpected `t.Skip`, passed-test floor | `go-test-skips-baseline.json` | edit by hand, with a reason per entry |
| `apps/api-go/internal/postgres/sql_conformance_test.go` — Go SQL vs canonical schema | `apps/api-go/internal/postgres/testdata/sql_conformance_baseline.json` | `UPDATE_SQL_CONFORMANCE_BASELINE=1 go test -run TestSQLConformsToCanonicalSchema ./internal/postgres/` |

Frontend ratchet results: `PASS` (exit 0), `RATCHET_VIOLATION` / `BASELINE_STALE` (exit 1), `TOOL_FAILURE` (exit 2). Stage new files (`git add`) before running locally — only files in the git index are measured, exactly as in CI.

`pnpm lint` and `pnpm test` on their own show the pre-existing debt and exit non-zero; use the ratchet for a PASS/FAIL decision.

## Browser E2E (manual only)

| Command | Target |
|---------|--------|
| `pnpm test:e2e` | local dev servers (`playwright.config.ts` starts web + admin; Go API must run on :4001) |
| `PLAYWRIGHT_BASE_URL=<url> pnpm exec playwright test -c playwright.staging.config.ts e2e/staging-auth-parity.spec.ts` | a deployed stack (anonymous + real-UI register/login/logout) |

Not automated at any lifecycle stage yet, and there is no real-UI admin login spec. See policy §11.
