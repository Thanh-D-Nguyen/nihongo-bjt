# Test hardening

Focus on **making the change verifiable**, not maximizing coverage in one shot.

## Agents

- `.cursor/agents/core/qa.md` (mindset chính)

## Load

- `.cursor/rules/03-testing-security.mdc`, `00-project-context.mdc`

## Do

1. Map recent code changes to critical paths (permissions, scoring, SRS, billing hooks, etc.).
2. Add missing unit/integration tests using existing test utilities and patterns in the repo.
3. Run targeted tests first; expand to package-level `test` / `lint` / `typecheck` per package scripts when appropriate.
4. If a check cannot run here, document the exact command and reason.

## Output

Tests added/changed, commands run, remaining gaps with severity.
