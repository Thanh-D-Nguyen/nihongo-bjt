# BJT production lesson implementation note

## Audit result

- Canonical level identifiers are `J5`, `J4`, `J3`, `J2`, `J1`, and `J1+` in
  `apps/api/src/levels/levels.module.ts` and shared quiz contracts.
- `curriculum.bjt_lesson` previously stored only localized titles/descriptions
  plus links to lexeme, kanji, and grammar rows. It could not represent a
  complete learning session, reviews, checkpoints, objectives, exercises, or
  content versions.
- The legacy `seed-bjt-lessons.mjs` creates five generic themes per level,
  deletes their lesson-item links on rerun, hard-codes a database URL, and has
  no validation or dry-run. It remains untouched for backward compatibility,
  but is superseded by the production runner documented in
  `BJT_LESSON_DATA_GUIDE.md`.
- Assessment questions already have a production schema and admin workflow.
  Lesson activities remain embedded in versioned lesson JSON because they are
  instructional interactions, not reusable mock-exam bank items.
- No relational lesson-progress model exists. This change never deletes or
  updates learner progress, quiz sessions, quiz answers, exercise answers, or
  SRS state.

## Minimal schema decision

The existing `BjtLesson` aggregate remains the source of truth. Additive fields
describe curriculum position, unit type, duration, difficulty, taxonomy,
prerequisites, content version/hash, publication time, and a typed JSON lesson
document. Existing rows receive safe defaults; no destructive migration or
table replacement is used.

Stable `seedKey` and slug values make imports idempotent. New rows also use
deterministic UUIDs, while existing rows keep their current UUID so any external
references remain valid. `ContentVersion` snapshots are written once per
lesson/content version to support review and forward rollback without touching
learner history.

## Acceptance criteria

- 6 levels × 12 weeks × (5 lessons + 1 review + 1 checkpoint) = 504 units.
- Every core lesson has at least five activities; reviews/checkpoints have more.
- Validation covers structure, completeness, quality, duplicates, answer
  distribution, and taxonomy coverage before any database write.
- Seed supports all/level/week filters and dry-run, uses bounded transactions,
  never deletes, and reports created/updated/skipped/failed counts.
