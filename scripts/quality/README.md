# Quality Verification Scripts

Canonical verification commands. CI (`.github/workflows/ci.yml`) runs these same scripts. Which gates a change needs is derived from [`docs/engineering/engineering-policy.json`](../../docs/engineering/engineering-policy.json) (human summary: [`ENGINEERING_POLICY.md`](../../docs/engineering/ENGINEERING_POLICY.md) §3); status vocabulary in §12; the lifecycle harness in §16.

## Task lifecycle (humans and agents alike)

```bash
pnpm quality begin WEB-42 "Show streak freeze in profile"    # records START_HEAD + pre-existing changes
pnpm quality spec --acceptance "Profile shows remaining freezes" --acceptance "0 freezes hides the badge"
pnpm quality classify UI_ONLY,API_CONTRACT --kind add          # paths force classes; gates are derived
pnpm quality red --vitest apps/web/x.test.tsx::"Profile > shows freezes" --expect "freezes"
#   ... implement ...
pnpm quality green
pnpm quality verify                                            # required suites with execution accounting
pnpm quality review prepare && pnpm quality review run         # high-risk classes / exceptions only
pnpm quality close                                             # fails unless every gate has current evidence
git add tasks/WEB-42.json ...                                  # the task record ships with the change
```

| Situation | Command |
|-----------|---------|
| Where am I / what's next (also: resuming in a fresh session) | `pnpm quality status` |
| Bug fix | `classify <CLASS> --kind bugfix` + `spec --observed ... --expected ...`; the RED is the reproduction |
| Tests for existing behavior | `--kind characterization`, then `pnpm quality sensitivity --file <prod> --find <s> --replace <r> --go ./pkg:TestX --expect "<assertion text>"` |
| Brand-new module (test cannot compile against base) | `classify ... --red-exception new_component --reason "..."` → sensitivity + review replace RED |
| Removing a feature | `classify FUNCTION_DELETION --kind delete`, removal RED, `pnpm quality deletion --symbol X --audit "..."` |
| E2E / infra / search evidence | `pnpm quality evidence browser_e2e -- pnpm test:e2e e2e/auth.spec.ts` |
| External dependency really unavailable | `pnpm quality block <gate> --protocol blocker.json` (protocol: policy §16.4) → task closes PARTIAL |
| Weakening change you really intend (`.skip`, baseline growth…) | add `{ "finding": "<id from status>", "reason": "..." }` to `risk_acknowledgements`; review becomes mandatory |
| A file was already modified when the task began | it is not owned; `pnpm quality claim <path>` if the task changes it (`disown` hands a file back) |
| Check a range like CI does | `pnpm quality check` (working tree vs origin/main) · `pnpm quality replay` |

The Claude Code `PreToolUse` hook (`.claude/settings.json` → `harness/hook.mjs`) denies production edits before the task is classified (and before VALID_RED when RED applies) and denies edits to evidence fields. It is local friction only: CI's `lifecycle` job is the authority (policy §16.6 lists what is enforced where). Optional git pre-push hook: `pnpm quality install-hooks --yes`.

## Agent execution profiles

Flags below were verified against the installed Claude Code CLI (2.1.x: `--model`, `--effort low|medium|high|xhigh|max`, `--permission-mode`, `-p`). Other Claude-compatible runners (e.g. GhostCLI) may map models/effort differently; equivalence of the underlying model is **not** verified — the lifecycle and CI gates apply identically whatever runs the session.

| Role | Suggested invocation |
|------|----------------------|
| Builder | `claude --model opus --effort xhigh` |
| High-risk reviewer (fresh session) | `pnpm quality review run` — default `claude -p --model opus --effort max --permission-mode plan --setting-sources user,project --no-session-persistence`; override with `QUALITY_REVIEW_CMD="<command reading the package on stdin>"` |
| Fixer | `claude --model opus --effort high`, scoped to verified review findings |

Sessions started with `--bare` skip project hooks (the write guard); CI still enforces the lifecycle.

## Autonomy and resumable decisions

Recover local dependencies yourself; missing/stopped tooling is not BLOCKED (policy §17). Example request for the canonical disposable DB verification:

```json
{"kind":"docker-stopped","retry":{"argv":["bash","scripts/quality/with-test-db.sh","bash","scripts/quality/verify-go.sh"]}}
```

`pnpm quality recover --request /tmp/recovery.json` records recipe execution, health and the original retry. Missing CLI: `{"kind":"missing-cli","tool":"pnpm","retry":{"argv":["pnpm","quality","status"]}}`; Compose: `kind:"local-service"`, `compose_file`, `service`; history: `kind:"missing-history"`, `task_id`. Installs prefer repo pins/project tooling/user-local prefixes; remote Docker, privilege and unverified destructive effects require a decision. A recipe failure means try another reasonable safe path, not ask the human to operate the machine.

For consequential operations use native AskUserQuestion first. The client-independent broker accepts native-question, permission or structured callbacks and resumes the saved operation. CLI fallback:

1. Save a target descriptor (path: `type,path,id,environment`; DB: `type:"database",connection_env,id,environment`). `pnpm quality decision inspect --input target.json` returns its live fingerprint; never put connection secrets in files.
2. Request with `pnpm quality decision request --input decision.json`. The JSON has `action:{kind,target,impact}` and `continuation:{step,argv,alternative?:{step,argv}}`. It persists WAITING_FOR_DECISION and emits four choices. Show those through the available interactive UI; keep working independently while waiting.
3. On selection: `pnpm quality decision answer --id <id> --choice approve_once|approve_task|alternative|cancel`. It rechecks identity and executes the saved argv immediately. Scope is the one displayed by the selected choice; requesting `action.requested_scope:"WORKSPACE_CLASS"` displays workspace consent instead of task consent. Existing matching consent resumes automatically on request. `decision resume --id <id>` resumes a durably answered operation.

Cancel affects one operation; a supplied AUTO alternative runs instead. Native hook permission is ONCE for the exact tool call and never grants reusable task scope. Declined native prompts with no post event remain waiting: cancel via the CLI. Failed/interrupted effects remain UNKNOWN_OUTCOME pending diagnosis; never blindly rerun or remove evidence. Consent journals are local ignored state; task summaries never authorize another worktree. Hooks protect obvious risks; arbitrary-program reasoning, user identity and recovery strategy remain model/host/review boundaries.

## PR gate commands

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
| `verify-harness.sh` | Quality-system invariants + harness unit / lifecycle e2e / adversarial mutation tests (zero skips allowed) |
| `verify-ci-passed.sh <sha>` | Release gate used by `deploy-gcp.yml`: refuses unless CI succeeded for exactly that SHA on a push to main |

With `QUALITY_SUMMARY_DIR` set, `check-go-test-report.mjs`, `check-frontend-debt.mjs` and the harness self-test write `<suite>.json` execution accounting that `pnpm quality verify` records as evidence.

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
