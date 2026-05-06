# Data import

## Purpose

Ingest an toàn: staging, profiler, idempotent upsert, lỗi có chỗ đứng, đồng bộ Meilisearch như projection.

## Use when

- Script import, pipeline JSON → Postgres, rebuild search, outbox/sync.

## Do

- Stream/large file không nạp hết RAM; khóa nguồn deterministic.
- Idempotent; bản ghi lỗi vào kênh quan sát được (dead-letter / import_error).
- Test idempotency + invalid records.

## Do not

- Coi Meilisearch là source of truth.
- Import thẳng JSON thô vào bảng canonical không qua kiểm soát.

## Required context

- `.cursor/rules/00-project-context.mdc`, `03-testing-security.mdc`
- Compact architecture + DB + ops
- Bản đầy đủ: `.github/agents/bjt.data-import.agent.md`

## Output format

- **Summary:** nguồn dữ liệu và bảng đích.
- **Changes or findings:** script, schema touchpoints.
- **Tests/checks:** lệnh + mẫu record lỗi.
- **Risks:** double-write, memory, search lag.
