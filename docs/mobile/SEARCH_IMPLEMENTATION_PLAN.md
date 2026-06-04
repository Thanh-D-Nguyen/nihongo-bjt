# Search / Reference Hub — Mobile Implementation Plan

Derived from the parity audit. Existing production-grade screens are preserved;
only verified gaps are filled. Each batch ends with
`flutter analyze` + `flutter test` (+ `git diff --check`).

---

## Batch 0 — Audit ✅
Docs: this file, `SEARCH_WEB_PARITY_AUDIT.md`, `SEARCH_API_CONTRACT.md`,
`SEARCH_MOBILE_UX_DECISION.md`.

## Batch 1 — Data / API foundation
- New Drift table `recent_searches` (query, createdAt) + DAO (upsert, list,
  delete one, clear) in `core/database`. Bump schema version + migration.
- `features/search/data/recent_search_*` repository + Riverpod providers.
- Reuse existing `ContentRepository` (search/dictionary/kanji/grammar) and
  `SavedRepository` (already present) — no duplication.
- Tests: DAO round-trip, repository ordering/cap (max 10), provider.

## Batch 2 — Search Hub UI
- Surface **recent searches** (chips, clear-all) on the Search idle hub above
  the existing lookup-tools cards. Hidden when empty.
- Tapping a chip re-runs the query; tapping a tool opens the subroute.
- Tests: hub renders tools; renders recent when present; hides when empty.

## Batch 3 — Search Results UI
- Add a compact **segmented kind filter** (All/Word/Kanji/Grammar) that appears
  only when results span >1 kind; filters client-side.
- Keep empty / error+retry / clear-query behavior (already present).
- Record submitted query into recent searches.
- Tests: filter narrows results; single-kind hides filter; empty state.

## Batch 4 — Detail navigation + bookmark
- Result/saved cards already navigate to real detail screens (verified).
- Add a **bookmark toggle** to Dictionary / Kanji / Grammar detail app bars,
  wired to `SavedRepository.toggle` via a new `savedToggleProvider` +
  per-target `isSavedProvider`. Optimistic, rollback on error, sign-in prompt on
  401.
- Tests: toggle calls repo, reflects state, handles unauthorized.

## Batch 5 — Saved / Recent / History
- Saved list: **remove** action (optimistic) using the toggle endpoint.
- Recent: **clear all** + remove-one already from Batch 1 DAO, surfaced in hub.
- No fake counts/history.
- Tests: remove from saved; clear recent.

## Batch 6 — UI/UX polish
- Spacing rhythm, dark-mode contrast, long JA/VI handling, tablet width cap,
  touch targets, focus/active states, skeletons.
- Add widget previews for the major Search components if the preview system is
  present.
- QA tests: 360 dp overflow + dark mode for hub and results.

## Batch 7 — Retest docs
- `SEARCH_RETEST_CHECKLIST.md`, `SEARCH_RETEST_PROMPT_FOR_CODEX.md`,
  update `MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_MANUAL_QA_CHECKLIST.md`.
- Final: `flutter analyze`, `flutter test`, `git diff --check`,
  `flutter build apk --debug` (if Android SDK available).

---

## Explicit non-fakes
- No trending/popular keywords (no API).
- No cross-feature lesson/scenario search results (endpoint is content-only).
- Suggest autocomplete deferred (documented, not stubbed).
