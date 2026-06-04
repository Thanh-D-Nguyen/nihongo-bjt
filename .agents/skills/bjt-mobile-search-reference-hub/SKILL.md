# BJT Mobile Search / Reference Hub Skill

Use this skill when implementing, auditing, or polishing the Search / Reference Hub for the Nihongo BJT mobile app.

## Goal

Build a production-grade mobile Search experience that combines:

* Dictionary search
* Kanji lookup
* Grammar search
* Saved items
* Recent searches
* Search suggestions
* Cross-feature search if supported by API
* Reference content discovery

The Search experience must be mobile-native, fast, readable, and useful for Japanese/Vietnamese learners.

## Core principle

Search is not just an input field.

Search should be a learning tool.

It must help users quickly answer:

* What does this Japanese word mean?
* How is this kanji read?
* What grammar pattern is this?
* Have I saved this before?
* Is there a BJT lesson/scenario related to this?
* Can I continue learning from this result?

## Hard rules

* Do not fake search results.
* Do not invent API responses.
* Do not create dead result cards.
* Do not mark API as missing unless repo search proves it.
* If web uses an API, inspect and reuse the contract.
* If backend is unreachable at runtime, show honest error/retry state.
* Keep VI/JA localization in sync.
* Search must be fast and keyboard-friendly.
* Do not clone desktop search UI.
* Do not overload the screen.
* Avoid horizontal overflow.
* Support 360–390 dp width.
* Support dark mode.
* Add/update tests.

## Required audit before coding

Inspect:

### Web

* web search page
* dictionary page
* kanji page
* grammar page
* saved items page
* API clients/hooks/services
* models/types/schemas
* debounce/search behavior
* empty/error/loading states
* result card UI
* filters/tabs/categories
* saved/bookmark behavior

### Mobile

* current Search route if any
* router/AppShell
* Search tab ownership
* dictionary/kanji/grammar mobile code
* saved items mobile code
* providers/repositories
* l10n
* theme/components
* tests

Create/update:

* `docs/mobile/SEARCH_WEB_PARITY_AUDIT.md`
* `docs/mobile/SEARCH_API_CONTRACT.md`
* `docs/mobile/SEARCH_MOBILE_UX_DECISION.md`
* `docs/mobile/SEARCH_IMPLEMENTATION_PLAN.md`

## Required Search structure

### 1. Search Hub initial state

Before user types, show useful entry points:

* search input
* recent searches if real/local
* saved items shortcut
* dictionary shortcut
* kanji shortcut
* grammar shortcut
* popular/recommended lookup only if real API/data exists

Do not show fake trending/search data.

### 2. Search input

Must support:

* autofocus decision suitable for mobile
* clear button
* debounce if API search
* keyboard-safe layout
* submit/search action
* loading state
* error state
* empty result state

### 3. Result categories

If API supports multiple categories, group results:

* Dictionary
* Kanji
* Grammar
* Lessons
* Scenarios
* News/Magazine
* Career
* Saved

If API only supports separate endpoints, implement segmented/tabs or category shortcuts.

Do not fake cross-search if no API supports it.

### 4. Result cards

Result cards must be readable:

* Japanese headword/title
* reading/furigana if available
* Vietnamese meaning/summary
* tag/type
* saved/bookmark state if available
* clear tap target
* no cramped desktop layout

### 5. Detail navigation

Every result must navigate to a real detail screen or honest unavailable state.

No dead taps.

### 6. Saved/recent/history

Use real local/API data only.

* recent search can be local if app has local persistence
* saved items must use real saved API/local store
* do not show fake counts

## UI/UX rules

Search should feel:

* fast
* focused
* calm
* premium
* useful for daily study
* readable for Japanese/Vietnamese
* consistent with web brand
* mobile-native

Avoid:

* too many filters visible at once
* dense desktop table/list
* fake trending keywords
* noisy animations
* huge result cards
* long unwrapped Japanese strings
* hidden primary actions

## Required tests

Add/update tests for:

* Search initial state
* Search input render
* Empty query behavior
* Loading state
* Populated dictionary result
* Populated kanji result
* Populated grammar result
* Empty result state
* Error/backend-unreachable state
* Clear query action
* Result tap navigation
* Saved/bookmark state if supported
* Recent search if supported
* 360 dp layout
* Dark mode
* Long Japanese/Vietnamese text

## Flutter skills to use

Use:

* `flutter-build-responsive-layout`
* `flutter-fix-layout-issues`
* `flutter-add-widget-test`
* `flutter-add-widget-preview`
* `flutter-add-integration-test`
* `flutter-use-http-package` if relevant
* `flutter-implement-json-serialization` if relevant

## Verification

After every batch:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
git diff --check
```

If available:

```bash
cd mobile && flutter build apk --debug
```

Stop if verification is red.

## Final docs

Create/update:

* `docs/mobile/SEARCH_WEB_PARITY_AUDIT.md`
* `docs/mobile/SEARCH_API_CONTRACT.md`
* `docs/mobile/SEARCH_MOBILE_UX_DECISION.md`
* `docs/mobile/SEARCH_IMPLEMENTATION_PLAN.md`
* `docs/mobile/SEARCH_RETEST_CHECKLIST.md`
* `docs/mobile/SEARCH_RETEST_PROMPT_FOR_CODEX.md`
* `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
* `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`

## Final response required

When using this skill, final response must include:

1. Search web parity summary
2. API/data wiring summary
3. Search UX structure
4. Screens/components implemented
5. Result categories supported
6. Saved/recent/history behavior
7. Tests added/updated
8. Verification results
9. Remaining limitations
10. Codex retest prompt path