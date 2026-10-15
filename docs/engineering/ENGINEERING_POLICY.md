# Engineering Policy — Evidence-Driven TDD

**Status**: ACTIVE  
**Effective**: 2026-10-02  
**Scope**: All behavior-changing work in this repository  
**Authority**: This document is the canonical engineering workflow. Its machine-readable half is [`engineering-policy.json`](engineering-policy.json) (classes, change kinds, gate derivation, path rules, risk rules), consumed by the lifecycle harness (§16). Agent entrypoints (`CLAUDE.md`, `AGENTS.md`, `AI_CONTEXT.md`, `.github/copilot-instructions.md`) only point here. Which rule is enforced where (repo / local hook / CI / platform / review) is listed in §16.6 — nothing below is claimed as machine-enforced unless it appears there.

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
| `INFRASTRUCTURE` | Build, deployment, Caddy config, Docker |
| `CI_QUALITY_SYSTEM` | CI workflows, quality scripts, debt baselines, the lifecycle harness, write guard, this policy, agent entrypoints |
| `FORMAT_ONLY` / `GENERATED` / `DEPENDENCY_METADATA` | No semantic change: formatter output, generated code, lockfiles/manifests |
| `FUNCTION_DELETION` | Removing an endpoint, event, function or feature (change kind `delete`, §5) |
| `CROSS_CUTTING` | Changes spanning multiple classifications (adds review; does not replace the specific classes) |

Classification is declared with `pnpm quality classify` and checked by machine: changed paths force classes (`path_rules` in `engineering-policy.json`) — e.g. any file under `apps/api-go/internal/realtime/` requires `REALTIME`, `.github/**` and `scripts/quality/**` require `CI_QUALITY_SYSTEM`. A change kind (`add`, `modify`, `bugfix`, `delete`, `characterization`, `refactor`, `non_behavioral`) is declared alongside.

---

## 3. Risk-Based Quality Gate Matrix

The authoritative gate derivation is `requiredGates()` over `engineering-policy.json`: gates = `acceptance` + class gates + change-kind gates (`red`+`green` for add/modify/bugfix/delete unless a declared `red_exception`; `sensitivity`+`green` for characterization; `review` for refactor) + suites for the changed areas (`suite_go`, `suite_frontend`, `suite_harness`) + `review` for high-risk classes, exceptions and high-risk diff findings. The table is the human summary.

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
| `INFRASTRUCTURE` | Config validation + build/deployment test + health/readiness + smoke (`infra_validation`) + independent review |
| `CI_QUALITY_SYSTEM` | `suite_harness` (invariants + adversarial mutation suite) + independent review |
| `FUNCTION_DELETION` | removal RED + `deletion_audit` (consumer audit + stale-reference scan) |
| `CROSS_CUTTING` | Union of all affected gates + independent review |

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
- [ ] `pnpm quality close` succeeded (VERIFIED, or PARTIAL reported as PARTIAL) and `tasks/<ID>.json` is committed with the change (§16)

---


## 11. Canonical Verification Commands

CI (`.github/workflows/ci.yml`) runs exactly these scripts; there is no separate CI-only path. Details: [`scripts/quality/README.md`](../../scripts/quality/README.md).

| Command | Purpose |
|---------|---------|
| `scripts/quality/with-test-db.sh scripts/quality/verify-all.sh` | Full PR gate locally (throwaway PostgreSQL 17 via Docker) |
| `scripts/quality/verify-go.sh` | gofmt · vet · `go test` with PostgreSQL integration + skip audit · race · ARM64 build. Requires `TEST_DATABASE_URL`; `--unit-only` is explicitly PARTIAL |
| `scripts/quality/verify-frontend.sh` | typecheck · lint + unit-test debt ratchet · build |
| `node scripts/quality/check-frontend-debt.mjs` | Frontend debt ratchet alone (§13) |
| `scripts/quality/verify-harness.sh` | Quality-system invariants + harness adversarial self-test (§16) |
| `pnpm quality verify` / `pnpm quality check` | Run the suites a task requires (with execution accounting) / the CI lifecycle check locally (§16) |
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
| **BLOCKED** | Adequate executable verification exists but cannot currently run due to an external/environment dependency, **after the blocker protocol** (§16.4). A task with a BLOCKED gate closes as **PARTIAL**, never VERIFIED |
| **PARTIAL** | Some but not all required gates are VERIFIED; the rest are BLOCKED with a valid protocol |
| **UNTESTED** | No adequate executable coverage exists for this behavior |
| **PR_HEAD_VERIFIED** | All CI gates (§11, excluding browser E2E) passed for the head commit |
| **FULL_SYSTEM_VERIFIED** | PR_HEAD_VERIFIED **and** the browser E2E journeys passed against a live stack built from the same commit |
| **RELEASE_VERIFIED** | The deployed commit is exactly the SHA CI validated on `main` (`scripts/quality/verify-ci-passed.sh` in `deploy-gcp.yml`) and post-deploy health checks passed for it |

**Rules:**
- Do NOT report an existing-but-not-executed (or skipped) test as VERIFIED. `go test` printing `ok` while tests `t.Skip` is not verification; CI fails any skip not in `scripts/quality/go-test-skips-baseline.json`.
- Do NOT report BLOCKED as UNTESTED if the test code exists and is correct; do NOT report UNTESTED as BLOCKED.
- Loopback testing (`httptest.NewServer`, Docker on 127.0.0.1) is not an external dependency; "the sandbox cannot bind ports" must be demonstrated, not assumed.
- Do NOT call a commit FULL_SYSTEM_VERIFIED while browser E2E is manual and has not been run against that commit.
- Characterization tests are labeled characterization (change kind), never TDD; no historical RED is fabricated.
- Report task status from `pnpm quality status` / the CI lifecycle job, not from memory.

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

`CLAUDE.md`, `AGENTS.md`, `AI_CONTEXT.md` and `.github/copilot-instructions.md` all point here (checked by the `ENTRYPOINT_POINTER` invariant); this document is the single source of truth for workflow and gates. Future coding agents — Claude Code, GhostCLI, Codex, IDE agents — and humans MUST run every non-doc change through the lifecycle harness (§16): `pnpm quality begin` … `pnpm quality close`. A fresh session resumes from `pnpm quality status` + the task record + the diff; no conversation history is needed.

---

## 16. Lifecycle Harness (enforcement)

Prose is advisory; the harness makes the process executable. Code: `scripts/quality/harness/`; usage: [`scripts/quality/README.md`](../../scripts/quality/README.md).

### 16.1 Task records

Each change is a task `tasks/<ID>.json` (committed with the change): `start_head`, pre-existing uncommitted changes (never owned unless explicitly claimed with `pnpm quality claim`; `pnpm quality disown` hands a file back), spec/acceptance, classification, red targets, exceptions, risk acknowledgements, and **harness-written evidence** (each entry with `seq`, HEAD and the content fingerprint). Gate status is never stored as truth — it is recomputed from evidence, locally and in CI.

**Identity**: the fingerprint is a sha256 over the git blob ids of the task's changed files. Evidence counts only if its fingerprint equals the fingerprint at close, and CI checks that the merged blobs equal the closed ones. Branch names are never artifact identity. Tracked build artifacts that the gate tools rewrite on every run (`volatile_paths` in the policy JSON: `tsconfig.tsbuildinfo`, `next-env.d.ts`) are excluded from ownership and fingerprints.

### 16.2 States

`CREATED → SPECIFIED → CLASSIFIED → RED_REQUIRED → VALID_RED → IMPLEMENTING → GREEN → VERIFYING → REVIEW_REQUIRED → REVIEWED | EXCEPTION_APPROVED → READY_TO_CLOSE → CLOSED`, plus `BLOCKED`. Not every task passes every state: DOC_ONLY goes `CLASSIFIED → READY_TO_CLOSE`; characterization replaces RED with sensitivity. States are derived from evidence (`deriveState`), so a state cannot be skipped by editing the record.

### 16.3 VALID_RED, GREEN, sensitivity

- `pnpm quality red --go ./pkg:TestX --expect "<text>"` (or `--vitest <file>::"<suite > test>"`) runs the target with the task's production files at their **start_head state** (in place, or in a scratch worktree if production already changed). VALID only if the target executed and failed, the failure contains `expect`, and shows no infrastructure signature. PASS (behavior already exists), SKIP, NOT_FOUND, compile/import failure and runner/tool failure are rejected and recorded as such.
- Brand-new code whose tests cannot compile against the base declares `--red-exception new_component` at classification time; sensitivity replaces RED: `pnpm quality sensitivity --file F --find S --replace R --go ./pkg:TestX --expect "<assertion text>"` proves the tests fail **with their own assertion** when the production implementation is changed (the mutation must target a production file, may not inject a crash, and runs in a scratch worktree; the working tree is never mutated).
- CI **replays** RED (the task's production files reverted to the task's start, or the range base when that start is not in history), GREEN and sensitivity for every task in the range, each at the first commit matching its closed fingerprint and file blobs. Later task-record edits cannot move that historical replay. Retained production files also require GREEN on the final tree; sensitivity is repeated with the final tests when its production file remains unchanged. Go runtime panics and non-assertion Vitest exceptions cannot satisfy RED or sensitivity.

### 16.4 BLOCKED protocol

`pnpm quality block <gate> --protocol blocker.json` requires: `reproduced: true`, the exact `error`, every gate `known_alternatives` entry addressed (`attempted`, `result`), `workaround_attempted`, `why_not_viable`, `remaining.kind` from the external-blocker allowlist, and the exact `capability_required`. `recovery_ids` reference current-fingerprint EXHAUSTED recovery records with at least two distinct executed failed paths. A first failure, missing tooling/history or stopped local service cannot justify BLOCKED. A pending decision stays WAITING_FOR_DECISION. Only gates marked `blockable` can be BLOCKED; RED/GREEN/sensitivity/harness/review cannot. Recovery facts/external impossibility remain attested, not cryptographic proof of execution.

### 16.5 CI lifecycle job (`lifecycle` in `.github/workflows/ci.yml`)

1. `cli.mjs check --ci`: quality-system invariants; every changed non-doc file owned by a CLOSED task in the range (`UNOWNED` otherwise); classes forced by paths; gates recomputed from policy; evidence fingerprints = closed fingerprint; merged blobs = closed blobs (`STALE` otherwise); `closed.status` = what the evidence supports (PARTIAL cannot be relabeled VERIFIED); forbidden diff patterns (`.only`, `continue-on-error`, `|| true` in workflows, CI baseline writes) fail outright; high-risk patterns (`.skip`/`t.Skip`, deleted tests, fewer assertions, suppressions, swallowed failures in scripts, test-discovery config changes, weakened baselines) must be acknowledged in the task and force independent review.
2. `verify-harness.sh`: invariants + harness unit/e2e/adversarial mutation suite (zero skips; required files must run).
3. `cli.mjs replay --ci`: RED/GREEN/sensitivity re-execution against real PostgreSQL.

Suites record execution accounting (`discovered/executed/passed/failed/skipped/expected_skips/unexpected_skips`); missing accounting, zero executed tests, unexpected skips or a tool failure are never PASS. Exit codes everywhere: `0` PASS · `1` VIOLATION · `2` TOOL_FAILURE.

### 16.6 Enforcement map (honest)

| Rule | Where enforced | Bypass conditions |
|------|----------------|-------------------|
| Classification forced by paths; gates derived from policy | CI (`check`), LOCAL (`close`, hook) | none in CI |
| Every changed non-doc file owned by a CLOSED task | CI | pure docs are exempt by design (agent-instruction files under `.claude/`, `.cursor/`, `.github/` are not docs) |
| VALID_RED: target fails against the pre-task code for the declared reason, passes on the task's code | CI (`replay`, each task at the commit that closed it), LOCAL (`red`) | a declared `red_exception`: `new_component` is replaced by a CI-replayed sensitivity mutation of production code; `config_only`, `not_reproducible` (bugfix only), `visual_only`, `schema_only` and change kind `refactor` rest on **attested review** (see below). Chronological test-first ordering is LOCAL (hook) + REVIEW |
| Sensitivity mutation breaks production code (never the test itself) | CI (`check` + `replay`) | none |
| Deletion stale-reference scan | CI (recomputed on the merged tree) | `allowed_references` entries need a reason and are visible in the diff |
| Production edits wait for SPECIFIED/CLASSIFIED/VALID_RED | LOCAL (Claude Code `PreToolUse` hook) | sessions without project hooks (`--bare`, other CLIs), any program writing files (`node -e`, scripts), `QUALITY_GUARD=off` set by a human |
| Evidence fields written only by the harness | LOCAL (hook denies tool edits) | hand-written JSON. CI then recomputes what it can: classes, gates, fingerprints, freshness, RED/GREEN/sensitivity replay, deletion scan, suite results (CI re-runs every suite) |
| No unexpected skips / tool failure ≠ pass / zero tests ≠ pass | CI (suites + accounting) | none |
| Debt identity ratchets; baselines never written by CI; canonical baseline path | CI | baseline expansion with acknowledgement + review |
| BLOCKED needs the blocker protocol; PARTIAL never reported as VERIFIED | LOCAL + CI | — |
| A PARTIAL task merges only when accepted | CI (`QUALITY_ACCEPT_PARTIAL` from PR label `quality:accept-partial`) | PLATFORM: who may label PRs |
| Deploy only the CI-validated SHA | CI (`verify-ci-passed.sh` + invariants) | PLATFORM: who may edit workflows / environments |
| Unknown CI diff base (force push) | CI fails closed (TOOL_FAILURE) | — |
| **Attested gates**: `review`, command gates (`browser_e2e`, `infra_validation`, `search_integration`), `rollback_analysis`, BLOCKED claims | REVIEW. CI validates structure and fingerprint binding, lists them as *ATTESTED* in the job summary, but cannot prove who reviewed or that a command ran | an agent can write these records. Independent human approval for tasks with attested gates is **PLATFORM_SETTING_REQUIRED** (branch protection: required review, CODEOWNERS on `tasks/`, `.github/`, `scripts/quality/`) |
| Required checks block merge | PLATFORM_SETTING_REQUIRED (branch protection on `main`: require `checks`, `go-checks`, `lifecycle`; disallow direct pushes) | repository admins |

Limitations: replay of *dependent* tasks in one PR needs their intermediate commits (merge or rebase merge). If no historical commit matches a task's closed artifacts, replay fails closed; supersession never skips an entire task. Production files rewritten by a later task are validated by that task's replay and the suites on the final tree; unchanged files retain their final GREEN/sensitivity checks. Keep dependent tasks in separate PRs, or do not squash.

## 17. Autonomy-first execution, recovery, and decisions

The human is a decision maker, not a machine operator. Agents MUST repair ordinary local reversible problems themselves: discover the repository tool/version, prefer existing/project/user-local tooling, otherwise use a trusted nonprivileged package manager, verify health, then retry the original goal. This includes stopped Docker/Compose/PostgreSQL/Redis/Meilisearch/Caddy/API/frontend, missing dependencies/CLIs/Playwright browsers, stale artifacts, proven project-owned stale processes, disposable infrastructure, stopped local tools and missing conversation history. Reconstruct durable task/Git/evidence state. Never ask the human to run commands, start services, inspect logs, open a browser or restore context when the agent can do it.

`engineering-policy.json.autonomy` defines AUTO, DECISION_REQUIRED, FORBIDDEN and consent scopes. AUTO is normal local reversible work. Consequential privilege, valuable-data destruction, remote mutations, public exposure, paid actions, credential/security changes, published-history rewrites and irreversible work outside the workspace need a decision. Known-secret exposure, gate bypass, fabricated/deleted unverified evidence and out-of-scope production destruction are FORBIDDEN: ordinary consent cannot authorize them.

Recovery is DETECT → DIAGNOSE → RECOVER → VERIFY → RETRY ORIGINAL GOAL; failure means diagnose and try a reasonable alternative. `pnpm quality recover --request file.json` executes bounded recipes for local Docker, pinned/user-local tools, frozen dependencies, Chromium, validated Compose services, existing generation scripts and durable task/Git reconstruction. It health-checks, retries and durably records traces before effects. EXHAUSTED is recovery evidence, not a task BLOCKED transition. NEEDS_DIAGNOSIS means missing local inputs/recipe coverage: keep RUNNING and try another safe local tool/path, never ask the human merely because a recipe is unavailable. Only a proven consequential action returns DECISION_REQUIRED. Other safe recovery strategies remain the agent's responsibility.

Decisions are an execution overlay; quality gates do not change. WAITING_FOR_DECISION preserves action, target, impact, choices, suspended step and continuation, and prevents closure/BLOCKED. Prefer native AskUserQuestion with 2–4 meaningful options, then native permission, then a structured pending request. Do not issue a final report or terminate merely to ask. Continue independent safe work. After selection resume the saved operation immediately; cancellation applies only to that operation and invokes its safe alternative if supplied.

`lib/autonomy.mjs` provides client callbacks for interactive question/permission/structured transport and continuation. CLI inspect/request/answer/resume supports live path/database identity; answering runs saved argv without shell evaluation. Consent binds policy, worktree, exact target (including nested identity), operation and continuation. ONCE is consumed durably before the effect. TASK/WORKSPACE_CLASS reuse only that exact operation/identity within scope. Another DB, remote environment, changed server startup/DB identity, policy or copied worktree journal invalidates consent. Records reject secret values: use environment references. Authority stays in ignored `tasks/.logs/autonomy/`; committed task summaries carry no grants. Interrupted effects become UNKNOWN_OUTCOME, stay waiting and require diagnosis/reconciliation before retry. Never delete locks or uncertain evidence to get green.

Installed Claude Code 2.1.285 was inspected. Standard project hooks/permissions/AskUserQuestion are used; Anthropic Auto mode is neither assumed nor required for GhostCLI/providers. PreToolUse allows recognized ordinary local work, asks about obvious consequences and denies obvious forbidden operations. Native post-success resolves only its original tool call and mints no reusable grant. Denial without a post event remains waiting: cancel with the recorded CLI choice and continue safe alternatives. Post-failure remains uncertain. Headless clients without a question host use the broker's structured waiting request; absent UI is neither failure nor consent.

| Boundary | Enforcement |
|---|---|
| Action/consent/identity checks, secret rejection, durable ONCE consumption, waiting prevents closure | REPO_ENFORCED by broker/CLI; adversarial self-tests run in CI |
| Obvious shell consequences/forbidden operations and protected task execution/evidence fields | LOCAL hook when project hooks load; host permission authorizes only the exact native call |
| Recovery execution, health verification and original-goal retry before RECOVERED | REPO_ENFORCED for supported recovery recipes |
| Choose/attempt reasonable repairs, inspect arbitrary programs, continue parallel work, call native questions, reconcile uncertain effects | MODEL_POLICY_ENFORCED; this guard is heuristic, not a shell parser or sandbox |
| Authenticity of human answers/external blocker facts | Host/client identity + REVIEW_ENFORCED; journals/CLI are not cryptographic human-identity proof |
| Mandatory hooks and merge checks/reviews | PLATFORM_SETTING_REQUIRED; other CLIs, arbitrary program writes, disabled hooks and `--bare` bypass local hooks |

VALID_RED, replay, CI recomputation, debt ratchets, independent review, fingerprints and closure remain mandatory. Autonomy never authorizes weakening gates.
