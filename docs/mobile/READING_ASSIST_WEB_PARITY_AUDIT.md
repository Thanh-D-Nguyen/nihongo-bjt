# Reading Assist — Web → Mobile Parity Audit

Domain skill: `bjt-mobile-reading-assist-layer`
Baseline: `bjt-mobile-foundation-quality-gate`

## Web reference

- `/settings/reading` — learner reading preferences (furigana on/off, level).
- Reading assist on web: tap/hover a Japanese term → reading + meaning +
  add-to-flashcard; furigana toggle; suppressed during active timed exam.
- Source of truth: server (preferences + flashcard persistence). Free users
  keep basic reading support (per `AGENTS.md` Reading Assist layer).

## Mobile state (before this slice)

- `JapaneseText` (`features/reading_assist/presentation/japanese_text.dart`):
  presentational only — rendered an inline kana line above the term, gated by
  `ReadingAssistPolicy` (`enabled` vs `examSuppressed` + per-user toggle).
- No tap interaction, no meaning reveal, no add-to-flashcard, no lookup sheet.
- Callers: `lesson_detail_page`, `practice_page`, `result_question_card`,
  `flashcard_review_page` (all reading-only, no meaning).

## Gap matrix

| Capability | Web | Mobile (before) | Status now |
| --- | --- | --- | --- |
| Inline furigana, exam-gated | ✅ | ✅ | ✅ |
| Per-user furigana toggle | ✅ | ✅ (policy) | ✅ |
| Tap term → reading + meaning sheet | ✅ | ❌ | ✅ (this slice) |
| Add term → flashcard from lookup | ✅ | ❌ | ✅ (use-case + deck picker, wired in dictionary) |
| Lookup blocked in exam mode | ✅ | n/a | ✅ (`allowsLookup`) |
| Reading preferences synced to server | ✅ | 🟡 settings | 🟡 (separate slice) |
| Meaning/dictionary data source | ✅ | ❌ | 🔴 (needs API wiring) |

## This slice (delivered)

- `ReadingAssistPolicy.allowsLookup` — separates on-demand lookup from the
  inline furigana toggle; lookup blocked only in exam/active-recall contexts.
- `JapaneseText` gains optional `meaning` + `onAddToFlashcard`. Becomes tappable
  only when a meaning or add-handler is supplied (reading-only callers stay
  unchanged — zero behavior change for existing screens).
- `ReadingDetailSheet` — shared lookup bottom sheet: term, reading, meaning,
  and a server-authoritative add-to-flashcard action with loading/added/error
  states. Screens own the data + the add handler; the sheet never calls an API.
- i18n: `readingDetail*` keys added to `app_vi.arb` + `app_ja.arb`.
- Tests: policy `allowsLookup`; sheet opens with reading+meaning; exam policy
  blocks lookup; add-to-flashcard invokes handler + confirms; non-interactive
  without meaning/handler. 15/15 pass; `flutter analyze` clean.

## Add-to-flashcard wiring (delivered)

- `AddTermToDeck` use-case: fetches deck detail, appends the looked-up term as
  a new card (front=term, back=Vietnamese meaning, optional reading), resends
  the COMPLETE card list via `saveDeckCards` (preserves existing cards + ids +
  deck metadata). Trims input; throws `ArgumentError` on blank term/meaning;
  propagates repo errors (no fake success). User resolved server-side.
- `addTermToDeckProvider` exposes it; `showAddTermToFlashcardSheet` is a
  reusable deck picker that performs the add, invalidates deck list/detail,
  and returns whether a card was added.
- Wired into the dictionary word page: an “Add to flashcard” action on the
  headword card (hidden when the word has no Vietnamese meaning, since the
  card back is mandatory). Uses headword + reading + short meaning/first sense.
- Tests: 6 use-case tests (append + preserve existing, preserve metadata, trim,
  blank term/meaning throw, unknown deck propagates). All pass; analyze clean.

## Remaining (next slices)

1. Provide a real meaning/reading source (dictionary API) for vocab/search/news
   so inline terms expose meaning to the lookup sheet beyond callers that
   already have a translation. Then wire inline `JapaneseText.onAddToFlashcard`
   in content/news/example sentences (dictionary headword already wired).
2. Surface entitlement/quota on add-to-flashcard where gated.
3. Confirm `/settings/reading` preferences sync to server and drive
   `ReadingAssistPolicy.userEnabled` app-wide.

## Verification

- `cd apps/mobile && flutter analyze lib/features/reading_assist test/features/reading_assist` → clean.
- `flutter test test/features/reading_assist/japanese_text_test.dart` → 15/15 pass.
