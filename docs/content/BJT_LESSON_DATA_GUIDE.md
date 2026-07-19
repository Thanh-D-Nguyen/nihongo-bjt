# BJT lesson data operations guide

## Curriculum and ownership

PostgreSQL `curriculum.bjt_lesson` is canonical. The production source files
live in `database/scripts/seeds/bjt-lessons/`; one level owns one curriculum
file and index. The canonical level identifiers are `J5`, `J4`, `J3`, `J2`,
`J1`, and `J1+`.

Every level contains 12 weeks. Each week has five 15–30 minute core lessons,
one review, and one checkpoint. The generated totals per level are:

| Units                | Count |
| -------------------- | ----: |
| Core lessons         |    60 |
| Reviews              |    12 |
| Checkpoints          |    12 |
| Total learning units |    84 |
| Activities/questions |   516 |

The typed JSON document stores objectives, a role-specific workplace scenario,
knowledge points, vocabulary, grammar, business usage, natural examples,
nuance and hierarchy notes, Vietnamese learner pitfalls, activities, answer
rationales, summary, and recommendation metadata. `BjtLessonItem` remains
available for links to canonical lexeme/kanji/grammar rows.

## Commands

Run validation without touching the database:

```bash
pnpm validate:bjt-lessons
```

Dry-run all levels, one level, or one week:

```bash
pnpm seed:bjt-lessons --dry-run
pnpm seed:bjt-lessons --level J3 --dry-run
pnpm seed:bjt-lessons --level J3 --week 4 --dry-run
```

Seed all content or a filtered scope after migrations are deployed:

```bash
pnpm seed:bjt-lessons
pnpm seed:bjt-lessons --level J3
pnpm seed:bjt-lessons --level J3 --week 4
```

The runner validates the complete selected level before opening a database
connection. Dry-run performs zero database reads and writes. Live runs use
bounded transactions of 20 units, compare stable content hashes, and report
created/updated/skipped/failed counts. There are no delete calls in the seed
path.

## IDs, slugs, versions, and ordering

- `seedKey`: `bjt-lessons:v1:<LEVEL>:w<WW>:u<U>`.
- New UUIDs are deterministic from the seed key. Existing legacy rows keep
  their UUID when upgraded by slug.
- New slugs use `<level>-w<WW>-l<LL>`, `-review`, or `-checkpoint`. The first
  five slugs retain the legacy names so old links upgrade in place.
- `sortOrder` is continuous `1..84`; week order is `1..7`.
- `contentVersion` is the human-readable release. `contentHash` prevents
  unnecessary writes.
- A published `content.content_version` snapshot is upserted for every changed
  lesson/version.

## Editing or adding content

1. Edit the relevant `levels/<level>/curriculum.ts` file. Do not generate a
   new level by copying another level and changing nouns; its scenarios,
   communicative demands, register, and decisions must match that band.
2. Each week needs six or more vocabulary items, two or more grammar points,
   and five distinct focus expressions.
3. Run validation for the level, then the full corpus.
4. Review every Japanese sentence with a native/professional reviewer. Record
   disputed keigo, legal, HR, compliance, or accounting wording in the content
   review workflow before publishing a new version.
5. Increment both `CONTENT_VERSION` and `CONTENT_VERSION_NUMBER` for a new
   release. Never overwrite a historical version number with different intent.
6. Deploy the additive migration, run dry-run, seed the narrow level/week, and
   rebuild search only after the database seed succeeds.

To add a new week beyond the current 12-week contract, first update the product
requirement and validator constants, then add a complete `WeekSeed`. Do not add
partial weeks or bypass the completeness gate.

## Duplicate and answer-quality policy

The validator applies Unicode NFKC normalization, Latin lowercasing,
whitespace/punctuation normalization, exact comparison, and deterministic
character 3-gram Jaccard similarity. It checks titles and full question bundles
(scenario, prompt, and options). Thematic reuse inside one week is expected;
near-duplicate comparisons therefore focus on different weeks while exact
duplicates are rejected everywhere.

Every question has exactly four unique options, one best answer, a Vietnamese
rationale for every option, and Japanese/Vietnamese explanations. Answer keys
cycle deterministically, producing exactly 129 A/B/C/D answers per level and no
same-key run longer than one.

## Rollback without learner-data loss

Do not delete lessons, quiz sessions, answers, exercise history, or progress.
To roll back a content release:

1. Identify the prior `content.content_version` snapshot for
   `entity_type = 'bjt_lesson'`.
2. Restore the snapshot through a reviewed forward seed/version (increment the
   version number); preserve the existing lesson UUID and slug.
3. Run full validation and a filtered dry-run.
4. Seed the affected level/week and rebuild the Meilisearch projection.

This forward-rollback pattern keeps external links and learner history stable.
The existing admin Content Versions screen can inspect lesson snapshots. Rich
lesson JSON editing is intentionally source-reviewed and seed-managed in this
release; a form-based lesson CMS is not yet implemented.

## Search, learner, admin, and media limits

- Learner level/detail APIs return week, unit type/order, duration, taxonomy,
  version, and the typed lesson document. The learner page renders objectives,
  scenario, vocabulary, grammar, examples, nuance, activities, feedback, and
  summaries.
- Meilisearch receives lesson documents only as a projection; PostgreSQL
  remains canonical. Run `pnpm search:index` after seeding.
- Admins can inspect version snapshots and manage reusable BJT assessment-bank
  questions in the existing admin modules. Source-reviewed lesson JSON does not
  yet have a dedicated WYSIWYG editor.
- Listening activities contain original scripts and speaker roles. Version
  `2026.07.2` uses explicit-action browser TTS (`ja-JP`, rate `0.9`) with
  `audioAssetStatus = tts_ready`, `audioProvider = browser_tts`, and no fake
  audio URL. This works on the deployed learner web without cloud TTS secrets.
- To promote an activity to AI-generated audio, upload the reviewed asset to
  the media/CDN pipeline, set `audioAssetStatus = generated`, provide an HTTPS
  `audioUrl`, provider, voice, and incremented audio/content version. Keep the
  transcript as the accessible fallback. The validator rejects generated audio
  without URL/provenance and rejects browser TTS records that claim a file URL.

## Google Cloud release integration

`deploy/gcp/deploy-release.sh` applies migrations, runs the idempotent BJT
lesson seed, builds the applications, and rebuilds the search projection. A
successful push to `main` triggers CI and then `.github/workflows/deploy-gcp.yml`.
The production workflow publishes to the existing Compute Engine VM only after
CI succeeds.
