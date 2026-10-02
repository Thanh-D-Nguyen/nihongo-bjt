# Engineering Policy — Evidence-Driven TDD

**Status**: ACTIVE  
**Effective**: 2026-10-02  
**Scope**: All behavior-changing work in this repository  
**Authority**: This document is the canonical engineering workflow. Repository-level instructions (`CLAUDE.md`, `AGENTS.md`, `AI_CONTEXT.md`) reference it. CI enforces the gates (§11–§13); the lifecycle and classification (§1–§5) are enforced in review — CI cannot prove a test was written first.

---

## 1. Core Lifecycle

Every behavior-changing modification follows:

```
SPEC → EVIDENCE → VALID RED → GREEN → REFACTOR → VERIFY → REVIEW
```

### Definitions

| Term | Meaning |
|------|---------|
| **SPEC** | Requirement, acceptance criteria, affected contracts, risk classification documented before code |
| **EVIDENCE** | Understanding of current behavior from tests, logs, runtime inspection, or documentation |
| **VALID RED** | A failing test that (a) executes — it is not skipped and it compiles, (b) fails because the target behavior is missing/wrong, (c) has valid infrastructure/fixtures, (d) is not broken by unrelated causes, (e) fails with an assertion/message you have read and can explain |
| **GREEN** | Smallest maintainable implementation satisfying the SPEC |
| **REFACTOR** | Design improvement after GREEN with tests still passing; no external behavior change |
| **VERIFY** | Run all gates required by the change classification |
| **REVIEW** | Correctness, test quality, security, regression risk, scope discipline |

### INVALID_RED Examples (do NOT proceed to GREEN)

- Database/service unavailable
- Missing fixture or seed data
- Compile error unrelated to intended change
- Wrong test setup or environment misconfiguration
- Pre-existing test failure masked as new failure
- A test that was skipped (e.g. `TEST_DATABASE_URL` unset) — a skip is neither RED nor GREEN

### Where VALID_RED applies

| Change | Requirement |
|--------|-------------|
| New behavior, behavior modification, bug fix, intentional removal | VALID_RED first (§4, §5) |
| Characterization tests for existing, unchanged behavior | No RED possible (behavior already exists). Instead prove **sensitivity**: temporarily break the behavior (or the assertion) locally, observe the test fail for the right reason, revert. Label the change "characterization", never "TDD". |
| Formatting, docs, generated files, dependency metadata, build-only/CI-only fixes, mechanical non-behavioral refactors | Exempt from VALID_RED; follow §9 (state the classification and the alternative verification) |

Never manufacture a meaningless RED (e.g. asserting on a function that does not exist yet just to see a compile error).

---

## 2. Change Classification

Classify every nontrivial change before implementation. A change may have multiple classifications.

| Classification | Description |
|---------------|-------------|
| `DOC_ONLY` | Documentation, comments, README updates with no runtime effect |
| `TEST_ONLY` | Test additions/modifications with no production code change |
| `UI_ONLY` | Frontend visual/layout changes with no API/domain logic change |
| `DOMAIN_LOGIC` | Business rules, validation, transformations, state transitions |
| `API_CONTRACT` | HTTP endpoints, request/response schemas, status codes, headers |
| `AUTH_SECURITY` | Authentication, authorization, session management, CSRF, rate limiting |
| `DATABASE` | Schema migrations, query changes, constraint modifications |
| `CACHE` | Redis/cache behavior, TTL changes, invalidation logic |
| `SEARCH` | Meilisearch indexing, query behavior, relevance tuning |
| `REALTIME` | WebSocket protocol, message handling, connection lifecycle |
| `INFRASTRUCTURE` | Build, deployment, Caddy config, Docker, CI pipeline changes |
| `CROSS_CUTTING` | Changes spanning multiple classifications |

---

## 3. Risk-Based Quality Gate Matrix

| Classification | Required Gates |
|---------------|----------------|
| `DOC_ONLY` | Review only |
| `TEST_ONLY` | Tests pass; review test quality |
| `UI_ONLY` | Component/frontend tests; browser E2E for critical flows (manual today — §11) |
| `DOMAIN_LOGIC` | VALID_RED + unit/domain tests + related regression |
| `API_CONTRACT` | VALID_RED + component/HTTP contract tests + integration where applicable |
| `AUTH_SECURITY` | VALID_RED + unit/component + auth/security matrix + integration + real-browser login E2E |
| `DATABASE` | VALID_RED + real PostgreSQL integration + migration verification + SQL conformance gate (§13) + rollback analysis |
| `CACHE` | VALID_RED + relevant Redis integration |
| `SEARCH` | VALID_RED + relevant Meilisearch integration |
| `REALTIME` | VALID_RED + protocol/component tests + real-upgrade tests (`internal/realtime/upgrade_integration_test.go`) + race verification |
| `INFRASTRUCTURE` | Config validation + build/deployment test + health/readiness + smoke |
| `CROSS_CUTTING` | Union of all affected gates |

---

## 4. Bug Fix Policy — Regression TDD

Every reproducible behavior bug:

```
BUG REPORT → REPRODUCE WITH FAILING TEST → VALID_RED → FIX → GREEN → REGRESSION SUITE
```

- Do NOT fix code first and add a test afterward unless reproduction before fix is genuinely impossible.
- If reproduction is impossible, document why in the commit/PR.
- Never delete or weaken a failing regression test to make CI green.

---

## 5. Add / Modify / Delete Symmetry

Adding, modifying and deleting functionality carry the same rigor. All three follow §1.

**ADD** — SPEC → VALID_RED → GREEN → gates for the classification.

**MODIFY** — a behavior change is not lighter than an addition:

1. Find the existing tests that pin the current behavior; they must go RED against the new SPEC (or a new test must).
2. Update an existing assertion only when the contract legitimately changed, and say so in the commit (which contract, why). Updating a test to match whatever the code now does is weakening, not modifying.
3. Keep or add regression coverage for the unchanged parts of the contract.

**DELETE**:

1. Consumer/reference discovery: callers (CodeGraph `codegraph_callers`/`codegraph_impact`), HTTP/WebSocket consumers in `apps/web`, `apps/admin`, `apps/mobile`, SQL/DB dependencies, jobs, docs, and tests (`rg` for routes, event names, table names).
2. Decide whether removal changes public behavior; if so update the contract (OpenAPI, shared types, docs).
3. Add a test proving the expected absence/denial (e.g. 404/405, event ignored) — this is the VALID_RED for a removal.
4. Remove obsolete tests only with a written justification per test (what contract they pinned and why it no longer exists). Deleting a failing test to get green is forbidden (§4).
5. Stale-reference audit after removal: `rg` the removed identifiers across the repo; zero runtime references may remain.
6. Run the gates for every classification the removal touched. Test-count floors in the baselines (§13) must be lowered in the same reviewed change.

---

## 6. Authentication/Security Change Matrix

Changes touching auth/security require executable coverage for:

- Valid login / registration
- Invalid credentials rejection
- Authenticated `/me` response
- Anonymous `/me` → 401
- Logout clears session
- `/me` after logout → 401
- Expired session handling
- Learner denied admin functionality
- Admin authorization enforcement
- Trusted Origin acceptance
- Untrusted/malformed Origin rejection
- Incorrect port Origin rejection (where applicable)

Do NOT infer security correctness from happy-path E2E alone.

---

## 7. Database Change Policy

Use safe migration practices:

```
EXPAND → DEPLOY COMPATIBLE CODE → MIGRATE/BACKFILL → VERIFY → CONTRACT/CLEANUP
```

- Avoid destructive schema changes that prevent rollback unless explicitly required.
- Database changes require real-database integration tests.
- Test both migration correctness and application compatibility.

---

## 8. Test Strategy — Practical Pyramid

| Layer | Use For | Properties |
|-------|---------|------------|
| Unit/Domain | Business rules, validation, transformations | Fast, deterministic, parallelizable, no external deps |
| Component/HTTP | Routing, middleware, JSON contracts, cookies, auth | Go `net/http/httptest`, real handler wiring |
| Integration | SQL semantics, constraints, cache TTL, search indexing | Real disposable PostgreSQL/Redis/Meilisearch |
| Contract | API boundaries used by learner/admin clients | Stable assertions on externally meaningful behavior |
| WebSocket | Connection auth, Origin rules, protocol schema, subscribe/disconnect | Protocol-level tests with real WS |
| Browser E2E | Critical user journeys only | Anonymous, login, authenticated, logout, admin flows |

### Test Quality Rules

- Tests must protect meaningful behavior, not merely execute lines.
- Prefer behavioral assertions over implementation-detail coupling.
- Do NOT mock away semantics you need to validate (PostgreSQL constraints, Redis TTL, etc.).
- Normalize nondeterministic values (request IDs, timestamps, UUIDs) unless they are part of the contract.
- Coverage is a signal, not the objective. Changed logic must be tested; 100% coverage is not required.

---

## 9. Exception Process

Legitimate exceptions to standard TDD:

- Pure documentation/generated files
- Pure formatting (`gofmt`, prettier) — no semantic diff
- Dependency metadata updates
- Build-only or CI-only fixes (verified by the build/CI run itself)
- Mechanical non-behavioral refactors (verified by the unchanged test suite)
- Characterization tests for existing behavior (verified by a sensitivity check, §1)
- Environment-only changes with no meaningful unit RED possible

**Exception requirements:**
- Explicit classification and reason
- Why VALID_RED does not apply
- Alternative verification performed
- Documented in commit/PR description

Exceptions must be uncommon and auditable. Silent bypass is forbidden.

---

## 10. Definition of Done

A change is Done when ALL applicable conditions are met:

- [ ] SPEC documented (requirement, acceptance criteria, classification)
- [ ] VALID_RED established (or exception documented)
- [ ] GREEN implementation satisfies SPEC
- [ ] REFACTOR completed (if needed)
- [ ] All gates from §3 Quality Gate Matrix pass
- [ ] REVIEW completed (correctness, security, regression risk, scope)
- [ ] No weakened/deleted assertions without contract reasoning
- [ ] CI passes all enforced gates
- [ ] Documentation updated where contracts/interfaces changed

---


## 11. Canonical Verification Commands

CI (`.github/workflows/ci.yml`) runs exactly these scripts; there is no separate CI-only path. Details: [`scripts/quality/README.md`](../../scripts/quality/README.md).

| Command | Purpose |
|---------|---------|
| `scripts/quality/with-test-db.sh scripts/quality/verify-all.sh` | Full PR gate locally (throwaway PostgreSQL 17 via Docker) |
| `scripts/quality/verify-go.sh` | gofmt · vet · `go test` with PostgreSQL integration + skip audit · race · ARM64 build. Requires `TEST_DATABASE_URL`; `--unit-only` is explicitly PARTIAL |
| `scripts/quality/verify-frontend.sh` | typecheck · lint + unit-test debt ratchet · build |
| `node scripts/quality/check-frontend-debt.mjs` | Frontend debt ratchet alone (§13) |
| `pnpm test:e2e` / `playwright test -c playwright.staging.config.ts` | Browser E2E — **manual only** (see below) |

Running `pnpm lint` or `pnpm test` directly shows the pre-existing debt and exits non-zero; the ratchet is what decides PASS/FAIL.

**Browser E2E execution model (current, not aspirational):**

| Stage | Automated? |
|-------|-----------|
| PR | No |
| Merge to `main` | No |
| Nightly | No |
| Release / deploy | No |
| Manual | Yes — `pnpm test:e2e` against local dev servers; `PLAYWRIGHT_BASE_URL=<staging> pnpm exec playwright test -c playwright.staging.config.ts e2e/staging-auth-parity.spec.ts` against staging |

Prerequisites for an automated (nightly/main) job, tracked as open work: a repo-reproducible Caddy config that matches the admin `basePath`, a build-time `NEXT_PUBLIC_API_URL` ARG in `apps/web/Dockerfile.staging`, and a real-UI admin login spec (none exists yet).

---

## 12. Verification Semantics

When reporting test/gate status, use these precise definitions:

| Term | Meaning |
|------|---------|
| **COVERED** | An adequate executable automated test exists for this behavior in the repository |
| **VERIFIED** | The test/gate was executed against the current HEAD and passed — skipped tests are not verified |
| **BLOCKED** | Adequate executable verification exists but cannot currently run due to an external/environment dependency (missing service, credentials, device) |
| **UNTESTED** | No adequate executable coverage exists for this behavior |
| **PR_HEAD_VERIFIED** | All CI gates (§11, excluding browser E2E) passed for the head commit |
| **FULL_SYSTEM_VERIFIED** | PR_HEAD_VERIFIED **and** the browser E2E journeys passed against a live stack built from the same commit |

**Rules:**
- Do NOT report an existing-but-not-executed (or skipped) test as VERIFIED. `go test` printing `ok` while tests `t.Skip` is not verification; CI fails any skip not in `scripts/quality/go-test-skips-baseline.json`.
- Do NOT report BLOCKED as UNTESTED if the test code exists and is correct; do NOT report UNTESTED as BLOCKED.
- Loopback testing (`httptest.NewServer`, Docker on 127.0.0.1) is not an external dependency; "the sandbox cannot bind ports" must be demonstrated, not assumed.
- Do NOT call a commit FULL_SYSTEM_VERIFIED while browser E2E is manual and has not been run against that commit.

---

## 13. Debt Ratchets and Integration Audits

Known debt is recorded explicitly so that it stays visible; NEW debt fails CI. CI never writes a baseline. Every baseline change is a reviewed diff in git.

### 13.1 Frontend lint/test debt — `scripts/quality/check-frontend-debt.mjs`

- Runs the canonical `pnpm lint` / `pnpm test` itself and keeps their exit codes.
- Identity, not counts: ESLint debt is `file × severity:rule → count` (line-independent); test debt is the exact failing test id (`file > suite > test`), file-level load/collection errors, and newly skipped tests.
- Only files in the git index are measured (gitignored/untracked local files would otherwise give CI hidden slack).
- Results: `PASS` (0) · `RATCHET_VIOLATION` (1: new debt, or a test/lint coverage floor dropped) · `BASELINE_STALE` (1: debt was fixed — shrink the baseline in the same change) · `TOOL_FAILURE` (2: ESLint config/crash, missing or unparseable report, exit code inconsistent with the report, unhandled test errors, interrupted run, zero tests, timeout). Tool failures can never be baselined.
- Update: `node scripts/quality/check-frontend-debt.mjs --update-baseline` (refuses new debt); `--accept-new-debt` only as a reviewed exception (§9).
- TypeScript errors and build failures are not baselined: they must be zero.

### 13.2 Go integration audit — `scripts/quality/check-go-test-report.mjs`

- CI provisions PostgreSQL with the canonical schema (`scripts/quality/provision-test-schema.sh`) and sets `TEST_DATABASE_URL`.
- Any skipped test not listed in `scripts/quality/go-test-skips-baseline.json` fails, as does a listed skip that no longer skips, and a drop below `min_passed_tests`.

### 13.3 SQL ↔ schema conformance — `apps/api-go/internal/postgres/sql_conformance_test.go`

- Every static SQL literal in the Go API is `PREPARE`d against the canonical schema; INSERT column lists are checked for NOT NULL columns without defaults.
- Known drift (existing product defects) lives in `apps/api-go/internal/postgres/testdata/sql_conformance_baseline.json`; new drift fails. Shrink with `UPDATE_SQL_CONFORMANCE_BASELINE=1`.

---

## 14. Migration Status

| Item | Status |
|------|--------|
| Legacy NestJS backend code and runtime | REMOVED (no service in any compose/Caddy/deploy config) |
| Go API | AUTHORITATIVE backend |
| Parity | GAPS OPEN — see "Known gaps" in the closure record |
| Source of truth | Contracts + automated tests + current requirements |

See [`docs/migrations/MIGRATION_CLOSURE.md`](../migrations/MIGRATION_CLOSURE.md).

---

## 15. Agent Discoverability

`CLAUDE.md`, `AGENTS.md` and `AI_CONTEXT.md` all point here; this document is the single source of truth for workflow and gates. Future coding agents MUST:

1. Classify the change (§2) and pick the gates (§3)
2. Follow the lifecycle (§1) — VALID_RED where §1 says it applies; ADD/MODIFY/DELETE per §5
3. Run the canonical commands (§11) — never report skipped or unexecuted checks as VERIFIED (§12)
4. Document exceptions (§9) in the commit/PR

This workflow survives any individual AI session. The repository is the source of truth.
