# Spec Alignment

`docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` is the canonical v15 master spec for this repository.

Older spec names and phase prompts remain useful historical context, but when they conflict with v15, v15 wins. Development should preserve compatible working code and migrate incrementally toward the v15 contracts instead of rewriting the application.

Current alignment rules:

- PostgreSQL plus Prisma remains the canonical data layer.
- Meilisearch is a projection only.
- Redis/BullMQ and Socket.IO should be used for background jobs and battle realtime flows.
- Admin writes require backend RBAC and audit logs.
- Placeholders must have real contracts, schema, and feature flags, and must not report fake production success.
- Section 10 is the canonical API registry; new endpoints must be mirrored in docs before implementation.
