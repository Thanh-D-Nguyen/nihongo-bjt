# 12 — Data Import and Search Sync

<context-hint>
Use for import profiler, canonical import, outbox, Meilisearch sync, and fallback search.
</context-hint>

<task>
Act as Data Import Agent. Implement or harden one data import/search sync slice.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/backend_digest.md`, `docs/spec/compact/01_architecture_stack.md`, `docs/spec/compact/02_database_prisma.md`, and `docs/spec/compact/09_operations_ci_cd.md`.
2. Inspect import scripts, import APIs, outbox, Meilisearch client.
3. Pick one missing P0/P1 slice.
4. Add tests for idempotency/failure where feasible.
5. Update import/search docs.
</instructions>
