# Codex Retest Prompt — Search / Reference Hub

Copy everything in the fenced block below into a fresh Codex/agent session to
independently retest the rebuilt mobile Search / Reference Hub. The prompt is
self-contained.

```
You are retesting the rebuilt mobile global Search / Reference Hub in
apps/mobile of the NihonGo BJT monorepo. Do NOT change product behavior. Your
job is to verify, reproduce, and report — only fix if you find a concrete
defect, and keep any fix minimal and explained.

Context files to read first:
- docs/mobile/SEARCH_RETEST_CHECKLIST.md   (the checklist you must execute)
- docs/mobile/SEARCH_WEB_PARITY_AUDIT.md
- docs/mobile/SEARCH_MOBILE_UX_DECISION.md
- docs/mobile/SEARCH_API_CONTRACT.md
- docs/mobile/SEARCH_IMPLEMENTATION_PLAN.md

Entry points:
- apps/mobile/lib/features/search/presentation/search_page.dart
  (hub + recent searches + kind filter)
- apps/mobile/lib/features/search/presentation/recent_search_providers.dart
- apps/mobile/lib/features/search/data/local/recent_search_dao.dart
- apps/mobile/lib/features/search/data/local/recent_search_table.dart
- apps/mobile/lib/features/content/presentation/widgets/content_search_field.dart
  (300 ms debounce)
- apps/mobile/lib/features/saved/presentation/widgets/saved_bookmark_button.dart
- apps/mobile/lib/features/saved/presentation/saved_providers.dart
  (isSavedProvider derived from savedListProvider)
- apps/mobile/lib/features/saved/presentation/saved_page.dart  (remove + Undo)
- apps/mobile/lib/features/dictionary/presentation/dictionary_word_page.dart
- apps/mobile/lib/features/kanji/presentation/kanji_detail_page.dart
- apps/mobile/lib/features/grammar/presentation/grammar_detail_page.dart
- apps/mobile/lib/l10n/app_vi.arb + app_ja.arb  (must stay in sync)

Hard rules to enforce while retesting:
- No fabricated search results. Results come only from /api/search via
  contentSearchProvider; an empty/failed query shows an honest state, never
  guessed rows.
- No dead cards. Every hub tool card and every result tile routes to a real
  destination.
- Recent searches persist in the local Drift DB (recent_searches table), not in
  memory; they survive an app restart.
- Bookmark state is the REAL saved state, derived from the bookmarks API
  (isSavedProvider / savedListProvider). Toggles are optimistic with rollback;
  a signed-out toggle prompts sign-in; failures roll back.
- Saved removal is server-authoritative (SavedRepository.toggle) with a working
  Undo.
- VI/JA localization stays in sync; user-facing text uses l10n keys.
- Each Dart file stays under ~600 lines.

Steps:
1. Run, from apps/mobile:
   - flutter analyze        (expect: No issues found!)
   - flutter test           (expect: All tests passed!)
   Quote the exact final line of each. If red, STOP and report.
2. Run from the repo root: git diff --check (CRLF notices on Windows are OK).
3. Execute every item in docs/mobile/SEARCH_RETEST_CHECKLIST.md on 360 dp,
   390 dp, and a tablet width (>= 720 dp), in BOTH light and dark, and in BOTH
   vi and ja. For UI checks, drive the running app or widget tests; do not rely
   on reading code alone.
4. Pay special attention to:
   - Recent searches: record / re-run / remove one / clear all, and survival
     across an app restart. Newest-first, no duplicates.
   - Kind filter only appears with >1 result kind; selecting narrows; changing
     the query resets to All.
   - Bookmark icon reflects real saved state on open; optimistic toggle +
     rollback; sign-in prompt when signed out.
   - Saved remove + Undo round-trips the bookmark.
5. Known limitation (do NOT treat as a failure): `flutter build apk --debug`
   cannot run in the CI sandbox because no Android SDK is installed. Note it and
   move on; analyze + test are the gates. See docs/mobile/MOBILE_KNOWN_LIMITATIONS.md.

Report back exactly:
1. analyze result (final line, verbatim).
2. test result (final line, verbatim; note any added/failing tests).
3. Checklist pass/fail per section with the breakpoint+locale where any
   failure was observed.
4. Any defect found, with the minimal fix applied (or proposed) and why.
```
