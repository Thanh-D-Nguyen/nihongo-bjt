
## Engineering Policy — MANDATORY
All work follows `docs/engineering/ENGINEERING_POLICY.md` (single source of truth; this is a pointer, not a copy).
Every change other than pure docs runs through the lifecycle harness (§16); CI rejects changes without a CLOSED task:
```
pnpm quality begin <ID-123> "<title>"   →  pnpm quality spec --acceptance "..."  →  pnpm quality classify <CLASS> --kind <kind>
pnpm quality red --go ./pkg:TestX --expect "..."   (VALID_RED before production edits; the write guard enforces it)
pnpm quality green  →  pnpm quality verify  →  pnpm quality review run (high risk)  →  pnpm quality close
pnpm quality status        # where am I, which gate is missing, what next (resume from here in a fresh session)
```
- Status words: report only what `pnpm quality status` / CI evidence supports; PARTIAL is never VERIFIED (§12)
- Never weaken tests or baselines to get green; such diffs are detected and need acknowledgement + review (§13, §16)
- Autonomy-first execution (§17): recover/install/start ordinary local tooling/services yourself and reconstruct durable task state. The human makes consequential decisions, not machine repairs.
- Use native AskUserQuestion for consequential decisions, preserve WAITING_FOR_DECISION and continuation, then resume immediately. Continue independent safe work; first failure is never BLOCKED.
- Legacy NestJS is removed and the Go API is authoritative, but parity gaps remain open (`docs/migrations/MIGRATION_CLOSURE.md`)

## Go API contract — persistent reference

Before implementing, modifying, or integrating any Go `/api` endpoint, check:

- `docs/openapi.json` — canonical method/path coverage and documented schemas.
- `docs/api-route-inventory.json` — source registrations, conditions, and verification evidence.
- `docs/mobile/IOS_API_CONTRACT_GUIDE.md` — mobile auth, known gaps, and contract validation procedure.

Query the relevant endpoint(s) only; do not load the large JSON documents in
full at session startup. The 627 operations are a **static source inventory**;
they are not proof of runtime availability or request/response schema validity.
`test-evidenced` means a named handler test exists, not complete contract
verification. Validate unverified endpoints against Go handlers, tests, and
observed responses before depending on their DTOs or security behavior. Never
guess a field, authentication rule, or status code from the endpoint name, or
use superseded legacy `*_API_CONTRACT.md` files as authoritative contracts.

When Go routes change, follow the generator/drift checks in the mobile guide.
Quality gates remain governed by `docs/engineering/ENGINEERING_POLICY.md`.

## Remote host filesystem

Paths under `/srv/kotobawork` belong to the Linux staging/production host.

Never use Claude Code Read/Write/Edit tools directly on those paths from the
Mac coordinator.

Use native Bash with SSH/SCP for all remote filesystem and Docker operations.

If the same tool invocation fails twice identically, do not repeat it; diagnose
tool/environment scope first.

## Filesystem tool boundaries

Claude Read/Write/Edit are for normal local project files only.

Never use Write/Edit for:
- `/srv/**` — remote Linux paths
- `/dev/**` — device files
- `/proc/**`, `/sys/**` — kernel pseudo-filesystems
- `/run/**`, `/var/run/**` — runtime system paths

For `/dev/null`, use Bash redirection instead:
`command >/dev/null 2>&1`

If a PreToolUse hook denies an operation, diagnose scope and satisfy the guard.
Never switch execution mechanisms to bypass a quality/security denial.
