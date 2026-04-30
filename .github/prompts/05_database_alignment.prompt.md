# 05 — Database / Prisma Alignment

<context-hint>
Use when Prisma schema/migrations may not match v15 spec.
</context-hint>

<task>
Act as `bjt-architect` + `bjt-backend`. Align database schema with the canonical v15 spec.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/backend_digest.md`, `docs/spec/compact/02_database_prisma.md`, and `docs/spec/compact/10_testing_acceptance.md`.
2. Inspect Prisma schema and migrations.
3. Identify missing schemas/tables/enums/indexes.
4. Implement only safe additive migrations unless explicitly approved.
5. Add seed data where required.
6. Run/document prisma generate and migration status.
7. Update docs/database-alignment.md.
</instructions>

<constraints>
- Do not drop existing tables without explicit migration notes.
- Do not store canonical source JSON as query blob.
- Use raw SQL migrations for advanced PostgreSQL features.
