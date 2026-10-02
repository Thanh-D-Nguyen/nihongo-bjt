
## Engineering Policy — MANDATORY
All behavior-changing work MUST follow `docs/engineering/ENGINEERING_POLICY.md` (single source of truth; this is a summary).
- Lifecycle: SPEC → EVIDENCE → VALID RED → GREEN → REFACTOR → VERIFY → REVIEW (§1; where VALID_RED applies vs. exceptions)
- Change classification required before implementation (§2); gates per classification (§3)
- Bug fixes require regression TDD (§4); ADD / MODIFY / DELETE have equal rigor (§5)
- Canonical verification: `scripts/quality/with-test-db.sh scripts/quality/verify-all.sh` (§11) — CI runs the same scripts
- Status words COVERED / VERIFIED / BLOCKED / UNTESTED have strict meanings; skipped tests are never VERIFIED (§12)
- Known debt is ratcheted; never edit a baseline to make CI green without a reviewed reason (§13)
- Legacy NestJS is removed and the Go API is authoritative, but parity gaps remain open (`docs/migrations/MIGRATION_CLOSURE.md`)

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

If a PreToolUse hook denies an operation, change the execution mechanism.
Never retry the same denied Write/Edit call.
