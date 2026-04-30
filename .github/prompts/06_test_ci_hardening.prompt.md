# 06 — Test / CI Hardening

<context-hint>
Use after implementation slices to make sure the repo remains runnable.
</context-hint>

<task>
Act as `bjt-qa` + `bjt-devops`. Harden tests and CI gates.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/qa_digest.md`, `docs/spec/digests/devops_digest.md`, and `docs/spec/compact/10_testing_acceptance.md`.
2. Inspect package scripts and CI config.
3. Run or document:
   - install
   - lint
   - typecheck
   - test
   - build
   - prisma generate
   - openapi generate
4. Add missing critical tests for recent changes.
5. Fix failures caused by recent work.
6. Update `docs/CI_TEST_STATUS.md`.
</instructions>

<gate-retry>
Use `protocols/gate-retry-protocol.md`.
</gate-retry>
