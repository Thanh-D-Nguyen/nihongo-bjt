# Mobile Implementation Log — NihonGo BJT (Flutter)

> Execution log for the Flutter mobile app, complementing `docs/mobile/IMPLEMENTATION_PLAN.md`.
> Each phase records actual work and **real verify evidence** (commands run + observed output).
> If a verify step was not actually run, it is recorded as **missing evidence** — never assumed.

---

## Phase 0 — Foundation Minimal

**Date:** 2026-06-01
**Status:** ✅ Done — 4/4 verify passed.
**Toolchain:** Flutter 3.44.0 (stable) · Dart 3.12.0 (SDK at `C:\flutter`).

### Goal

A runnable, analyzable Flutter app skeleton at `apps/mobile` wiring the
foundation only: `flutter_riverpod` (ProviderScope + DI), `go_router`
(declarative routing with a single `/` route), brand theme tokens from
`DESIGN.md`, a guarded bootstrap entrypoint, and a passing smoke test.
**No real features** (no Auth/OpenAPI client/Drift/Flashcard-SRS/Reading Assist).

### Files created

App scaffold (`flutter create --org com.nihongobjt --project-name nihongo_bjt --platforms=android,ios apps/mobile`) generated `apps/mobile/{android,ios,...}` plus base config (75 files). Hand-written Phase 0 source:

| File | Purpose |
|------|---------|
| `apps/mobile/lib/main.dart` | Entrypoint → calls `bootstrap()`. |
| `apps/mobile/lib/app/bootstrap.dart` | Composition root: `WidgetsFlutterBinding`, `registerErrorHandlers()`, `runZonedGuarded` + `ProviderScope`. |
| `apps/mobile/lib/app/app.dart` | `NihonGoApp` — `MaterialApp.router` wiring router + theme. |
| `apps/mobile/lib/app/router.dart` | `routerProvider` (`Provider<GoRouter>`), `Routes` constants, `/` → Home. |
| `apps/mobile/lib/core/config/app_config.dart` | Build-invariant metadata (appName, tagline). |
| `apps/mobile/lib/core/theme/app_colors.dart` | Brand color tokens from `DESIGN.md`. |
| `apps/mobile/lib/core/theme/app_theme.dart` | Material 3 `ThemeData` (navy/blue, radius 10). |
| `apps/mobile/lib/core/errors/error_handler.dart` | `registerErrorHandlers()` / `reportError()` (used by bootstrap). |
| `apps/mobile/lib/shared/widgets/app_logo.dart` | Brand wordmark (used by Home). |
| `apps/mobile/lib/features/home/presentation/home_screen.dart` | Home placeholder (app-shell surface). |
| `apps/mobile/lib/features/flashcards/README.md` | Module seam only — **no code** (Flashcard lands in P2). |
| `apps/mobile/test/app_smoke_test.dart` | Smoke test: app boots and renders Home. |
| `apps/mobile/analysis_options.yaml` | Strict lint ruleset (very_good_analysis + strict-casts/inference/raw-types). |
| `apps/mobile/pubspec.yaml` | Dependency manifest (see below). |

### Files modified

| File | Change |
|------|--------|
| `apps/mobile/pubspec.yaml` | Real description; added runtime + dev deps; removed `flutter_lints`. |
| `docs/mobile/IMPLEMENTATION_PLAN.md` | Marked Phase 0 done; recorded deviations. |

### Files deleted

| File | Reason |
|------|--------|
| `apps/mobile/lib/main.dart` (default) | Replaced with the real entrypoint. |
| `apps/mobile/test/widget_test.dart` (default) | Referenced the removed `MyApp` counter scaffold; would break analyze/test. |

### Dependencies added — with rationale

Each dependency is imported and exercised by real code (no unused deps).

| Dependency | Version | Type | Why (actual usage) |
|------------|---------|------|--------------------|
| `flutter_riverpod` | ^3.3.1 | runtime | `ProviderScope` in `bootstrap.dart`; `Provider<GoRouter>` in `router.dart`; `ConsumerWidget` in `app.dart`. |
| `go_router` | ^17.2.3 | runtime | `GoRouter`/`GoRoute` with `/` route; `MaterialApp.router(routerConfig:)`. |
| `cupertino_icons` | ^1.0.8 | runtime | Default iOS icon font (kept from scaffold). |
| `very_good_analysis` | ^10.2.0 | dev | Activated by `analysis_options.yaml` include for the strict ruleset. |
| `flutter_test` | SDK | dev | Smoke test in `test/app_smoke_test.dart`. |

**Intentionally NOT added** (would be unused → violates "no unused dependency"):
- `dio` — no real `ApiClient` until **Phase 3**.
- `build_runner` / `riverpod_generator` / `freezed` / `json_serializable` — no codegen targets exist yet; added in **Phase 2**.
- `flutter_lints` — removed in favor of `very_good_analysis`.

### Verify commands run

```bash
# PATH included C:\flutter\bin for the session.
cd apps/mobile
flutter pub get
dart format .
flutter analyze
flutter test
```

### Verify results (observed output)

| # | Command | Result | Observed output |
|---|---------|--------|-----------------|
| 1 | `flutter pub get` | ✅ Pass | `Got dependencies!` (note: "8 packages have newer versions incompatible with dependency constraints" — informational, transitive). |
| 2 | `dart format .` | ✅ Pass | `Formatted 11 files (0 changed) in 0.14 seconds.` |
| 3 | `flutter analyze` | ✅ Pass | `No issues found! (ran in 3.0s)` |
| 4 | `flutter test` | ✅ Pass | `00:00 +1: All tests passed!` (1 test: "app boots and renders the Home placeholder"). |

> During development, `flutter analyze` first reported 10 issues (`prefer_const_constructors`, `comment_references`, `sort_pub_dependencies`). All were fixed; the final run above is clean.

### Verify summary

**4/4 verify passed** — `flutter pub get`, `dart format .`, `flutter analyze`, `flutter test`.

### Deviations from plan

Intentional, to honor "no unused deps / no fake code":

1. **Codegen toolchain deferred to Phase 2.** No `@riverpod`/freezed targets exist yet, so `build_runner`/`riverpod_generator`/`freezed`/`json_serializable` were not added. Plain `flutter_riverpod` is used (manual `Provider`).
2. **No `dio`** — no real ApiClient surface in Phase 0 (Phase 3).
3. **`features/flashcards/` is a `README.md` seam only** — module boundary fixed, no logic (Phase 2).
4. **Custom fonts (Inter / Noto Sans JP) deferred to Phase 1.** Theme ships color + shape tokens now; default Material text theme retained.
5. **Riverpod resolved to 3.3.1, not 2.x** as the architecture docs assumed — 3.x is the current 2026 release. APIs used (`ProviderScope`/`ConsumerWidget`/`Provider`) remain compatible.

### Known issues

- **Riverpod 3.x vs docs (2.x):** `docs/mobile/03-state-management-riverpod.md` was written for Riverpod 2.x. No impact on Phase 0 code, but the doc should be updated when codegen (`@riverpod`) is introduced in Phase 2.
- **Transitive version notice:** pub reports 8 packages with newer-but-incompatible versions (held back by current constraints). Informational only; build/analyze/test are green.
- **`flutter doctor` not run** for full platform toolchain (Android SDK / Xcode) — not required for Phase 0 verify (analyze/test pass on host). Validate device toolchain before first `flutter run` on a device.

### Recommendation for Phase 1

- Add **typography**: bundle Inter + Noto Sans JP fonts; build `AppText` styles (jpHeadword/jpBody/viExplain) with Japanese line-height ≥ 1.8 per `DESIGN.md`.
- Add the **app shell**: `ShellRoute` + bottom navigation with placeholder tabs (Home, Flashcards).
- Add the **minimal shared-widget states** needed by Phase 2: skeleton, empty, error-retry, `AppButton`, `AppCard`.
- Introduce **i18n**: slang config + `vi`/`ja` skeletons; migrate the existing `AppConfig.tagline` literal to a key (or a temporary typed-strings file with the same keys if slang setup is deferred).
- Keep changes within `apps/mobile`; no backend dependency in Phase 1.

---

## Phase 1 — App Shell + Design System Minimal

**Date:** 2026-06-01
**Status:** ✅ Done — 3/3 verify passed.
**Toolchain:** Flutter 3.44.0 (stable) · Dart 3.12.0 (SDK at `C:\flutter`).

### Goal

Build the minimal design-system foundation from `DESIGN.md` (spacing, radius,
shadow, typography tokens), wire them into the theme, add the one shared widget
actually consumed (`AppCard`), and ship a clean, structured Home placeholder.
**No real learning features** (no Flashcard/SRS, API client, Auth, local DB,
Reading Assist). Tokens/widgets are only created when a consumer exists.

### Files created

| File | Purpose | Consumer |
|------|---------|----------|
| `apps/mobile/lib/core/theme/app_spacing.dart` | 4px-base spacing scale (`xs`–`xl`). | `HomePage`, `AppCard`. |
| `apps/mobile/lib/core/theme/app_radius.dart` | Corner radius tokens (`md`, `lg`). | `AppTheme`, `AppCard`. |
| `apps/mobile/lib/core/theme/app_shadows.dart` | Elevation shadow `sm` (resting card). | `AppCard`. |
| `apps/mobile/lib/core/theme/app_typography.dart` | Type scale mapped onto Material `TextTheme`. | `AppTheme`, `HomePage`. |
| `apps/mobile/lib/shared/widgets/app_card.dart` | Surface container (radius `lg` + shadow `sm` + border). | `HomePage`. |
| `apps/mobile/lib/features/home/presentation/home_page.dart` | Polished Home shell built on tokens + `AppCard`. | `routerProvider`, smoke test. |

### Files modified

| File | Change |
|------|--------|
| `apps/mobile/lib/core/theme/app_theme.dart` | Removed the single `radius` const; now consumes `AppRadius` (button `md`, card `lg`), `AppTypography.textTheme`, and adds a flat `appBarTheme` (canvas bg, no elevation). |
| `apps/mobile/lib/app/router.dart` | `HomeScreen` → `HomePage` import + builder. |
| `apps/mobile/test/app_smoke_test.dart` | `HomeScreen` → `HomePage` reference. |

### Files deleted

| File | Reason |
|------|--------|
| `apps/mobile/lib/features/home/presentation/home_screen.dart` | Replaced by `home_page.dart` (Phase 1 polished shell). |

### Tokens / components added + rationale

- **AppSpacing** — only `xs`/`s`/`m`/`l`/`xl` (all consumed by `HomePage`/`AppCard`); `xxl` omitted (no consumer yet).
- **AppRadius** — only `md` (buttons/inputs) and `lg` (cards), the two radii in use; `sm`/`xl` omitted until a badge/feature-card needs them.
- **AppShadows** — only `sm` defined; other elevation levels deferred until a modal/popover consumes them.
- **AppTypography** — six `TextTheme` slots (`headlineSmall`…`labelSmall`) from the `DESIGN.md` type scale, wired globally via the theme and used directly in `HomePage`.
- **AppCard** — the only new shared widget; created because `HomePage` consumes it twice.

### Dependencies added / removed

**None.** No new packages. Fonts were **not** bundled and `google_fonts` was **not** added (would violate "no UI package if built-in works"); typography uses `fontFamilyFallback: ['Inter', 'Noto Sans JP']` and degrades to the platform default. Bundling licensed `.ttf` assets remains deferred (see deviations).

### Verify

Run from `apps/mobile` (bash needs `export PATH="$PATH:/c/flutter/bin"`).

| # | Command | Result | Evidence |
|---|---------|--------|----------|
| 1 | `dart format .` | ✅ Pass | `Formatted 16 files (1 changed) in 0.32 seconds.` |
| 2 | `flutter analyze` | ✅ Pass | `No issues found! (ran in 2.9s)` |
| 3 | `flutter test` | ✅ Pass | `00:04 +1: All tests passed!` (smoke test: app boots, renders `HomePage` + tagline). |

### Verify summary

**3/3 verify passed** — `dart format .`, `flutter analyze`, `flutter test`.

### Deviations from plan

1. **Custom fonts still deferred.** Phase 0 recommended bundling Inter + Noto Sans JP. The `.ttf` asset files are not available in-repo, so bundling/fabricating them was skipped to avoid fake assets; `fontFamilyFallback` is used instead. To complete: add licensed font files under `assets/fonts/`, declare them in `pubspec.yaml`, then set `fontFamily` on the type scale.
2. **No bottom-nav `ShellRoute`.** Phase 0 suggested a bottom nav with Home/Flashcards tabs. A Flashcards tab would route to a non-existent screen (fake surface), so the shell stays single-route until a second real destination exists.
3. **i18n not introduced.** `AppConfig.tagline` plus two new Vietnamese strings in `HomePage` remain inline literals; the slang/i18n setup is deferred to keep Phase 1 scoped to the design system. These strings must migrate to keys when i18n lands.
4. **No skeleton/empty/error/AppButton widgets yet.** Only `AppCard` was built (it has a consumer). The other shared-state widgets are created in Phase 2 when screens consume them.

### Known issues

- **Japanese typography tokens (jpHeadword/jpBody, line-height ≥ 1.8) not yet defined** — deferred with font bundling; the current `TextTheme` is the Latin scale only.
- **Inline UI strings** (`ようこそ`, `Lộ trình học`, build-status copy) are not i18n keys yet — tracked in deviation 3.

---

_Missing evidence: none for Phase 0. All four verify commands were executed on 2026-06-01 with the outputs quoted above._

_Missing evidence: none for Phase 1. All three verify commands were executed on 2026-06-01 with the outputs quoted above (`flutter pub get` not re-run — no dependency change)._

---

## Phase 2 — Flashcard + SRS Vertical Slice (Mock Repository)

**Date:** 2026-06-01
**Status:** ✅ Done — 3/3 verify passed (7 tests).
**Toolchain:** Flutter 3.44.0 (stable) · Dart 3.12.0 (SDK at `C:\flutter`).

### Goal

First end-to-end vertical slice on a mock repository:
Home → deck list → review → reveal answer → grade (Again/Hard/Good/Easy) →
update in-memory SRS state → completion. No real API/DB/Auth/Reading-Assist.

### Files created

| File | Purpose |
|------|---------|
| `apps/mobile/lib/features/flashcards/domain/srs_rating.dart` | `SrsRating` enum + `srsIntervalDays` placeholder cadence. |
| `apps/mobile/lib/features/flashcards/domain/flashcard.dart` | `Flashcard` entity (front/reading/back). |
| `apps/mobile/lib/features/flashcards/domain/flashcard_deck.dart` | `FlashcardDeck` entity (title/description/cardCount). |
| `apps/mobile/lib/features/flashcards/domain/flashcard_repository.dart` | `FlashcardRepository` interface. |
| `apps/mobile/lib/features/flashcards/data/mock_flashcard_repository.dart` | In-memory mock with 2 decks / 7 verified BJT cards. |
| `apps/mobile/lib/features/flashcards/presentation/flashcard_providers.dart` | Repository/deck-list providers + `ReviewSessionController`. |
| `apps/mobile/lib/features/flashcards/presentation/flashcard_deck_list_page.dart` | Deck-list screen (loading/empty/error/data). |
| `apps/mobile/lib/features/flashcards/presentation/flashcard_review_page.dart` | Review screen: card face, reveal, rating bar, completion. |
| `apps/mobile/test/features/flashcards/mock_flashcard_repository_test.dart` | Repo data integrity tests. |
| `apps/mobile/test/features/flashcards/review_session_controller_test.dart` | Controller state-transition tests. |
| `apps/mobile/test/features/flashcards/flashcard_flow_test.dart` | Widget e2e: Home → decks → review → completion. |

### Files modified

| File | Change |
|------|--------|
| `apps/mobile/lib/app/router.dart` | Added nested routes `/flashcards` and `/flashcards/:deckId/review`. |
| `apps/mobile/lib/features/home/presentation/home_page.dart` | Added "Ôn Flashcard" CTA → `Routes.flashcards`. |
| `apps/mobile/lib/core/theme/app_colors.dart` | Added `success` (#059669) and `warning` (#D97706) status tokens from `DESIGN.md`. |
| `apps/mobile/lib/features/flashcards/README.md` | Seam doc updated from "Phase 0 placeholder" to "Phase 2 implemented". |

### Domain models added + rationale

- **`SrsRating`** (again/hard/good/easy) — the four-button grade; required by the review UI and the in-memory SRS state.
- **`srsIntervalDays`** — documented simple cadence (0/1/3/7 days), **not** SM-2. Consumed by the rating buttons (shown as "Hôm nay / N ngày"); justifies its existence (no unused code).
- **`Flashcard`** — minimal study item (Japanese front, kana reading, Vietnamese back). Reading + back separated so the answer can be hidden until reveal.
- **`FlashcardDeck`** — deck summary for the list (title/description/cardCount).
- **`FlashcardRepository`** — interface so the mock is swapped for a real source later without touching presentation.

### Providers / controllers added + rationale

- **`flashcardRepositoryProvider`** — single binding point for the data source (mock now, real later).
- **`deckListProvider`** (`FutureProvider`) — async decks for the list screen, with native loading/error handling.
- **`reviewSessionProvider`** (`AsyncNotifierProvider.autoDispose.family<…, String>`) + **`ReviewSessionController`** — loads a deck's cards and owns the in-memory session state (`currentIndex`, `answerRevealed`, `ratings`). `autoDispose.family` keyed by `deckId` resets progress when the screen is left. Methods: `revealAnswer`, `rate`, `restart`.

### Dependencies added / removed

**None.** No new packages. `flutter_riverpod` + `go_router` (already present) cover all needs.

### Verify

Run from `apps/mobile` (bash needs `export PATH="$PATH:/c/flutter/bin"`).

| # | Command | Result | Evidence |
|---|---------|--------|----------|
| 1 | `dart format .` | ✅ Pass | `Formatted 27 files (0 changed) in 0.20 seconds.` |
| 2 | `flutter analyze` | ✅ Pass | `No issues found! (ran in 3.1s)` |
| 3 | `flutter test` | ✅ Pass | `00:08 +7: All tests passed!` (7 tests: smoke + repo ×2 + controller ×3 + flow). |

> An earlier analyze run reported `valueOrNull` (renamed to `value` in Riverpod 3.x), an unnameable provider type, and minor lints — all fixed before the clean run above.

### Verify summary

**3/3 verify passed** — `dart format .`, `flutter analyze`, `flutter test` (7/7).

### Deviations / Known issues

1. **`reviewSessionProvider` carries `// ignore: specify_nonobvious_property_types`.** Its concrete type (`AsyncNotifierProviderFamily`) is `@internal` in Riverpod 3.x and cannot be named, so the variable type cannot be annotated explicitly. Generic args are supplied on `.family<…>`; the ignore is scoped to one line.
2. **SRS is intentionally non-persistent and non-SM-2.** `srsIntervalDays` is a documented placeholder; the `ratings` map is in-memory only and is cleared on `autoDispose`/`restart`. Real scheduling + persistence land in a later phase.
3. **Loading state is a `CircularProgressIndicator`, not a shimmer skeleton.** The mock resolves synchronously, so an animated shimmer would never be seen; a real skeleton is added when a latent data source justifies it.
4. **UI strings are inline Vietnamese literals** (deck/review/completion copy), consistent with the pre-i18n state of Phases 0–1. They migrate to keys when the i18n layer lands.

---

_Missing evidence: none for Phase 2. All three verify commands were executed on 2026-06-01 with the outputs quoted above (`flutter pub get` not re-run — no dependency change)._

---

## Phase 3 — Networking + API Client Foundation

**Date:** 2026-06-01
**Status:** ✅ Done — 3/3 verify passed (14 tests). API **not** wired to UI (contract incomplete — see blockers).
**Toolchain:** Flutter 3.44.0 (stable) · Dart 3.12.0 (SDK at `C:\flutter`).

### Goal

A clean networking foundation that a real API can plug into later without
touching the Flashcard UI. No Auth/Keycloak, no Drift/local DB, no sync queue,
no idempotency, no codegen. The mock repository stays the default source.

### Files created

| File | Purpose |
|------|---------|
| `apps/mobile/lib/core/config/app_environment.dart` | `AppEnvironment` — per-environment `apiBaseUrl` from `--dart-define` (dev default `http://localhost:4000`, no hard-coded prod URL). |
| `apps/mobile/lib/core/api/api_exception.dart` | Sealed `ApiException` with `NetworkApiException` (transport) and `HttpApiException` (non-2xx, carries `statusCode`/`body`). |
| `apps/mobile/lib/core/api/api_client.dart` | `ApiClient` — thin `http.Client` wrapper: base-URL resolution, JSON decode, error normalization. Auth-agnostic. |
| `apps/mobile/test/core/config/app_environment_test.dart` | Verifies the dev base-URL default + no trailing slash. |
| `apps/mobile/test/core/api/api_client_test.dart` | `MockClient`-driven tests: 200 decode, URL build, empty→null, 404→`HttpApiException`, transport failure→`NetworkApiException`. |

### Files modified

| File | Change |
|------|--------|
| `apps/mobile/pubspec.yaml` | Added `http: ^1.2.0` (runtime). |
| `apps/mobile/lib/core/config/app_config.dart` | Doc comment updated: env values now live in `AppEnvironment` (was "`EnvConfig` in Phase 3"). |

### Files deleted

None.

### Dependencies added / removed

| Dependency | Version | Type | Why (actual usage) |
|------------|---------|------|--------------------|
| `http` | ^1.2.0 | runtime | `ApiClient` performs requests via `http.Client`; tests use the bundled `package:http/testing.dart` `MockClient`. Genuinely exercised — no unused dep. |

No dependency removed. **No codegen tooling added** (`build_runner`/`openapi-generator`/`freezed`) — see API-contract status + Q10 blocker.

### API contract status — **INCOMPLETE**

`docs/openapi.json` exists and contains flashcard paths
(`GET /api/flashcards/decks`, `POST /api/flashcards/decks`,
`DELETE /api/flashcards/decks/{deckId}`, plus reading-assist / admin
flashcard endpoints). However, for this slice the contract is **not usable**:

1. **No success-response schema.** `GET /api/flashcards/decks` declares
   `"200": { "description": "" }` with **no body schema** — only error schemas
   (400/401/403/404/409/422/429/500) are defined. A typed deck/card DTO cannot
   be derived from it.
2. **No "fetch cards for a deck" endpoint** matching the Phase 2 review shape
   (`fetchCards(deckId) -> List<Flashcard>`). Card review is modeled as
   user-scoped SRS over `user_flashcard`, not a plain card list.
3. **Auth-gated.** Every deck endpoint declares `security: [{ bearer: [] }]`.
   Calling them needs the auth flow, which is explicitly **out of scope** for
   Phase 3.
4. **Q10 unresolved.** `docs/mobile/IMPLEMENTATION_PLAN.md` lists Q10 (commit
   vs gitignore codegen artifacts) as a required, still-open P0 decision. Per
   scope rules, no generated client is produced or committed.

Given the above, no endpoints were invented and **no `ApiFlashcardRepository`
was created** (it would have to fabricate responses for an undefined schema).

### Repository source status — **mock remains default**

`flashcardRepositoryProvider` (the Phase 2 swap seam) is **unchanged** and still
returns `MockFlashcardRepository`. No Flashcard UI, domain, or provider wiring
was altered. The API layer ships as a verified, standalone foundation only.

### Verify

Run from `apps/mobile` (bash needs `export PATH="$PATH:/c/flutter/bin"`).

| # | Command | Result | Evidence |
|---|---------|--------|----------|
| 0 | `flutter pub get` | ✅ Pass | `Got dependencies!` (resolved `http: ^1.2.0`; 8 transitive packages held back — informational). |
| 1 | `dart format .` | ✅ Pass | `Formatted 32 files (0 changed) in 0.17 seconds.` |
| 2 | `flutter analyze` | ✅ Pass | `No issues found! (ran in 2.7s)` |
| 3 | `flutter test` | ✅ Pass | `00:10 +14: All tests passed!` (14 tests: 7 prior + 7 new API/env). |

> An earlier analyze run reported `prefer_initializing_formals` on `ApiClient`'s
> constructor; resolved by switching to initializing formals. The clean run
> above is the final state.

### Verify summary

**3/3 verify passed** — `dart format .`, `flutter analyze`, `flutter test` (14/14).

### Deviations / Known issues / blockers

1. **BLOCKER — flashcard response contract undefined.** `openapi.json` declares
   no 200 body schema for the flashcard deck endpoints and no card-list
   endpoint. Until the backend documents these (and a "list cards for review"
   contract exists), the API cannot be wired without fabricating data.
2. **BLOCKER — Q10 (codegen commit policy) unresolved.** No OpenAPI/Dart client
   was generated; the plan requires this decision before introducing codegen
   artifacts.
3. **Auth deferred (by scope).** Deck endpoints are bearer-gated; `ApiClient`
   is intentionally auth-agnostic and adds no token handling yet.
4. **`ApiClient` exposes only `getJson`.** Only GET is needed by the first
   read path and is the only method under test; write verbs are added when a
   real write endpoint is wired (no speculative surface).
5. **`httpClient`/`environment` are public final fields** on `ApiClient` (not
   private) — required to satisfy `prefer_initializing_formals`; `httpClient`
   doubles as the test injection seam.

### Next phase recommendation

- Resolve **Q10** and obtain a **complete flashcard response schema** (or a
  hand-written contract) → then add `ApiFlashcardRepository` (implements the
  existing `FlashcardRepository`) + an `apiClientProvider`, and flip
  `flashcardRepositoryProvider` behind an environment flag.
- Introduce the **auth token** layer before calling bearer-gated endpoints.

---

_Missing evidence: none for Phase 3. All four verify commands (`flutter pub get`, `dart format .`, `flutter analyze`, `flutter test`) were executed on 2026-06-01 with the outputs quoted above._

---

## Phase 3.5 — Flashcard/SRS API contract fix

**Date:** 2026-06-01
**Status:** DONE
**Scope:** Backend-only + docs. No `apps/mobile` Flutter code touched. Completes
the typed flashcard/SRS contract in `docs/openapi.json` so a future phase (P5)
can generate a type-safe `ApiFlashcardRepository`. Resolves **Q8** and records
**Q10**.

### Key finding — `docs/openapi.json` is GENERATED, not hand-maintained

It is produced by `apps/api/scripts/generate-openapi.ts` (npm script
`openapi:generate`), which boots the full NestJS `AppModule` and runs
`SwaggerModule.createDocument`. Therefore the contract is fixed at the **source**
(Swagger DTO classes + controller decorators), **never** by hand-editing the JSON.
Generator confirmed **deterministic** (two consecutive runs produced byte-identical
output). The previously committed `docs/openapi.json` was **stale** (drift from
backend changes made without regenerating) — see "Pre-existing drift" below.

### Files created

- `apps/api/src/openapi/dto/flashcards-openapi.dto.ts` — 14 Swagger response/request
  DTO classes mirroring the **real** runtime shapes (verified against Prisma models
  `Deck`/`FlashcardVariant`/`UserFlashcard`/`ReviewEvent`, the `FlashcardsService`
  mappers, and `FlashcardsRepository.applySubmitReview`):
  `FlashcardDeckCountOpenApiDto`, `FlashcardDeckOpenApiDto`,
  `FlashcardReviewCardCoreOpenApiDto`, `FlashcardMediaRefOpenApiDto`,
  `FlashcardReviewExampleOpenApiDto`, `FlashcardReviewItemOpenApiDto`,
  `SubmitFlashcardReviewRequestOpenApiDto`, `FlashcardReviewRemediationOpenApiDto`,
  `FlashcardReviewRemediationPolicyOpenApiDto`,
  `SubmitFlashcardReviewResponseOpenApiDto`, `ReviewBatchItemRequestOpenApiDto`,
  `SubmitFlashcardReviewBatchRequestOpenApiDto`,
  `FlashcardReviewBatchResultOpenApiDto`,
  `SubmitFlashcardReviewBatchResponseOpenApiDto`.

### Files modified

- `apps/api/src/flashcards/flashcards.controller.ts` — added Swagger
  `@ApiOkResponse` / `@ApiBody` decorators to the four learner endpoints
  (`decks`, `dueReviews`, `submitReview`, `submitReviewBatch`). **No logic
  changed** — decorators only; imports extended (`ApiBody`, `ApiOkResponse`).
- `apps/api/scripts/generate-openapi.ts` — registered the six top-level new DTOs
  in `extraModels` (nested DTOs are pulled in transitively).
- `docs/openapi.json` + `apps/api/openapi/openapi.json` — regenerated.
- `docs/mobile/IMPLEMENTATION_PLAN.md` — recorded **Q8** (resolved) and **Q10**
  (resolved) decisions.

### Files deleted

- None.

### API contract added (real endpoints — naming reconciliation)

The endpoint names originally *proposed* for this phase do **not** exist in the
backend. The real, documented endpoints are:

| Real endpoint | Request | Response |
|---|---|---|
| `GET /api/flashcards/decks` | query `userId`, `limit` | `FlashcardDeckOpenApiDto[]` |
| `GET /api/flashcards/reviews/due` | query `userId`, `limit`, `deckId?` | `FlashcardReviewItemOpenApiDto[]` |
| `POST /api/flashcards/reviews/:userFlashcardId` | `SubmitFlashcardReviewRequestOpenApiDto` | `SubmitFlashcardReviewResponseOpenApiDto` |
| `POST /api/flashcards/reviews/batch` | `SubmitFlashcardReviewBatchRequestOpenApiDto` | `SubmitFlashcardReviewBatchResponseOpenApiDto` |

- Proposed `GET /decks/{deckId}/review-cards` → **does not exist**; real queue is
  `GET /reviews/due` (optionally `?deckId=`).
- Proposed `POST /review-events` → **does not exist**; real single submit is
  `POST /reviews/:userFlashcardId`; batch is `POST /reviews/batch`.
- SRS grade enum = `again | hard | good | easy`. All endpoints Bearer-gated and
  require `userId` (query for GET, body for POST).

### Q10 decision recorded

Generated artifacts (OpenAPI JSON now; future Flutter generated client +
`*.g.dart`/`*.freezed.dart`) are **committed**; generated code is **never
hand-edited**; generator command documented
(`pnpm --filter @nihongo-bjt/api openapi:generate`). Full text in
`docs/mobile/IMPLEMENTATION_PLAN.md` (Open Questions → Q10).

### Verify results (real, 2026-06-01)

- Backend typecheck — `npx tsc --noEmit` in `apps/api`: `TYPECHECK_EXIT=0`.
- Lint/IDE diagnostics on the three changed source files: **No errors found**.
- Regeneration — `pnpm run openapi:generate`:
  `Generated OpenAPI document: D:\AI\nihongo-bjt\apps\api\openapi\openapi.json`
  / `...\docs\openapi.json`.
- JSON validity + contract presence — `node -e require('./docs/openapi.json')`:
  `JSON_VALID ok`; all 14 flashcard DTOs present in `components.schemas`;
  `GET /api/flashcards/reviews/due` 200 = `array of FlashcardReviewItemOpenApiDto`;
  `GET /api/flashcards/decks` 200 = `array of FlashcardDeckOpenApiDto`.
- Related backend tests — `vitest run` on
  `canonical-flashcards.controller.review-submit.test.ts` +
  `flashcard-gen.service.test.ts`: `Test Files 2 passed (2)`, `Tests 6 passed (6)`.

### Pre-existing drift (surfaced, not caused by this phase)

Regenerating produced a large `docs/openapi.json` diff (~45k lines) because the
committed copy was **stale** — proven by regenerating with **no** source changes,
which alone produced a ~45k-line diff (path ordering + accumulated backend
changes). This phase's intentional contribution is the flashcard schemas; the
remainder is the generator correcting prior drift. A stale generated contract is
itself a defect, so committing the fresh regeneration is the correct artifact
state. **Recommendation:** add `scripts/check_openapi_drift.sh` in CI (already
planned for P3) to prevent future drift.

### Remaining blockers

- None for Phase 3.5. (Auth/token layer and the actual Dart `ApiFlashcardRepository`
  remain future-phase work — P4/P5 — by design, not blockers of this contract phase.)

---

_Missing evidence: none for Phase 3.5. Typecheck, regeneration, JSON-validity +
contract-presence check, and related backend tests were all executed on
2026-06-01 with outputs quoted above._

---


## Phase 4 — Auth: Keycloak Authorization Code + PKCE & Session Guards

Goal: a production-grade authentication foundation for the mobile app using
Keycloak Authorization Code + PKCE, secure token storage, session restore on
launch, and route guards. No fake login success — if the browser flow or config
is unavailable, `signIn` surfaces an honest `AuthException`.

### Dependencies added

| Package | Version | Why |
| --- | --- | --- |
| `flutter_appauth` | `^9.0.1` | AppAuth wrapper: Authorization Code + PKCE, code exchange, refresh, end-session. |
| `flutter_secure_storage` | `^9.2.4` | Encrypted token persistence (Android EncryptedSharedPreferences, iOS Keychain). |
| `meta` | `^1.18.0` | `@immutable` for the auth value types (`AuthTokens`). |

Newer majors of `flutter_appauth` (12.x) / `flutter_secure_storage` (10.x) exist
but pull incompatible transitive constraints in this workspace; the chosen
versions resolve green. Informational only — not a blocker.

### Files created

- `lib/features/auth/domain/auth_status.dart` — `AuthStatus { unknown, authenticated, unauthenticated }`.
- `lib/features/auth/domain/auth_tokens.dart` — immutable `AuthTokens` value type, `isAccessTokenExpired` (30s skew, UTC).
- `lib/features/auth/domain/auth_session.dart` — `AuthSession` (`.unknown()/.unauthenticated()/.authenticated(tokens)`).
- `lib/features/auth/domain/auth_repository.dart` — `AuthRepository` interface + `AuthException`.
- `lib/features/auth/data/keycloak_auth_repository.dart` — AppAuth-backed impl (signIn/refresh/signOut).
- `lib/features/auth/presentation/auth_controller.dart` — Riverpod providers + `AuthController` (`AsyncNotifier<AuthSession>`).
- `lib/features/auth/presentation/login_page.dart` — login screen with loading + error states.
- `lib/core/auth/auth_token_store.dart` — `AuthTokenStore` interface.
- `lib/core/auth/secure_auth_token_store.dart` — `flutter_secure_storage` impl.
- `lib/core/auth/auth_redirect.dart` — pure `authRedirect()` guard function.
- `test/core/auth/auth_redirect_test.dart`, `test/features/auth/auth_controller_test.dart` — new tests.

### Files modified

- `lib/core/config/app_environment.dart` — OIDC config (`keycloakIssuer`, `oauthClientId`, `oauthRedirectUri`, `oauthScopes`, `allowInsecureAuthConnections`) read from `--dart-define` with localhost dev defaults.
- `lib/app/router.dart` — `routerProvider` with `refreshListenable` bridged to `authControllerProvider`, redirect via `authRedirect`, `/login` route.
- `lib/features/home/presentation/home_page.dart` — `ConsumerWidget`; AppBar logout action.
- `lib/core/api/api_client.dart` — optional `accessTokenProvider` seam attaching `Authorization: Bearer` (not yet wired to flashcards).
- `android/app/build.gradle.kts`, `ios/Runner/Info.plist` — AppAuth redirect scheme registration.
- `test/app_smoke_test.dart`, `test/core/api/api_client_test.dart`, `test/core/config/app_environment_test.dart` — updated for required env fields + authed smoke path + OIDC default coverage.

### Keycloak config source

All values come from `AppEnvironment.fromDartDefine()` (`KEYCLOAK_ISSUER`,
`OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`, `API_BASE_URL`). Dev defaults:
issuer `http://localhost:9080/realms/nihongo-bjt`, client `nihongo-mobile`,
redirect `com.nihongobjt.app://oauth2redirect`. No production URL is hardcoded.

### Auth flow status

Implemented in code (PKCE authorize + code exchange, refresh, end-session,
restore-on-launch, guarded routing). **True end-to-end requires a real device/
emulator and a provisioned public Keycloak client** with the matching redirect
URI registered (open blockers Q3 client provisioning, Q4 redirect URIs). Until
then `signIn` returns a real `AuthException` rather than a fake session.

### Token storage strategy

`SecureAuthTokenStore` persists access/refresh/id tokens + expiry in
`flutter_secure_storage` (Android `encryptedSharedPreferences: true`, iOS
`KeychainAccessibility.first_unlock`). No `SharedPreferences`, no plaintext, no
token logging. `read()` returns `null` if any field is missing/unparseable.

### Route guard behavior

`authRedirect`: `unknown` → no redirect (splash); `unauthenticated` → `/login`
(unless already there); `authenticated` → `/` when on `/login`, else stay.
Router refreshes whenever `AuthStatus` changes.

### Verify results (2026-06-01)

```
flutter pub get   → green
dart format .     → green
flutter analyze   → No issues found! (ran in 3.6s)
flutter test      → All tests passed! (+27)
```

---

_Missing evidence: none for Phase 4. All verify commands were executed on 2026-06-01 with the outputs quoted above._

---

## Phase 5 — Generated API Client + ApiFlashcardRepository

Goal: connect the Flashcard feature to the real flashcard/SRS API through a
typed (generated) client and an `ApiFlashcardRepository`, while keeping the
in-memory mock as the **default** source for stable dev/test.

### Codegen policy (Q10)

`json_serializable` + `build_runner`. DTOs are annotated by hand; their
`*.g.dart` serialization code is **generated and committed**, never hand-edited
(`**/*.g.dart` is already excluded from analysis). Regenerate with:

```
dart run build_runner build --delete-conflicting-outputs
```

Drift check = re-run codegen and assert `git diff` on `*.g.dart` is empty (the
second run reported "wrote 0 outputs"). There is no Dart-side OpenAPI generator
script in the workspace; the contract source of truth is `docs/openapi.json`.

### API endpoints actually wired

| Domain method | Endpoint | Notes |
| --- | --- | --- |
| `fetchDecks()` | `GET /api/flashcards/decks` | Maps `FlashcardDeckOpenApiDto[]`. |
| `fetchCards(deckId)` | `GET /api/flashcards/reviews/due` | Maps `FlashcardReviewItemOpenApiDto[]`. The contract's due-reviews endpoint is **not deck-scoped**, so it returns the learner's global due queue; `deckId` is accepted but not yet used as a server filter. |

Submit-rating (`POST /api/flashcards/reviews/{userFlashcardId}`,
`SubmitFlashcardReviewRequestOpenApiDto`) exists in the contract but the current
`FlashcardRepository` interface is read-only (Phase 2 grades in memory). Writing
grades to the server is intentionally **out of Phase 5 scope** — no unused
endpoint code was added.

### Files created

- `lib/features/flashcards/data/dto/flashcard_deck_dto.dart` (+ committed `.g.dart`)
- `lib/features/flashcards/data/dto/flashcard_review_item_dto.dart` (+ committed `.g.dart`)
- `lib/features/flashcards/data/flashcard_dto_mapper.dart`
- `lib/features/flashcards/data/api_flashcard_repository.dart`
- `test/features/flashcards/flashcard_dto_mapper_test.dart`
- `test/features/flashcards/api_flashcard_repository_test.dart`
- `test/features/flashcards/flashcard_provider_test.dart`

### Files modified

- `lib/core/config/app_environment.dart` — added `flashcardDataSource`
  (`--dart-define=FLASHCARD_DATA_SOURCE`, default `mock`) + `useApiFlashcards`.
- `lib/features/flashcards/presentation/flashcard_providers.dart` — added
  `flashcardApiClientProvider` (wired to the Phase 4 bearer seam) and a
  source switch in `flashcardRepositoryProvider`.
- `pubspec.yaml` — codegen deps (below).
- `test/core/api/api_client_test.dart`, `test/core/config/app_environment_test.dart`
  — updated for the new required env field.

### Repository source behavior

- **mock (default):** `MockFlashcardRepository`. The entire Phase 2 flow
  (home → deck list → review → completion) is unchanged and still passes.
- **api (`FLASHCARD_DATA_SOURCE=api`):** `ApiFlashcardRepository` over
  `ApiClient`. The client attaches `Authorization: Bearer <token>` only when a
  valid, non-expired session exists (Phase 4 `authControllerProvider`). When the
  learner is not authenticated, no token is sent → server returns 401/403 →
  the repository throws a clear `FlashcardRepositoryException`
  ("Bạn cần đăng nhập…"). No fake data is ever returned; network failures map to
  a connection error message. Access/refresh tokens are never logged.

### DTO → domain mapping summary

- `FlashcardDeckDto → FlashcardDeck`: Japanese-first title (`titleJa`, falling
  back to `titleVi` when blank), `descriptionVi` (→ `''` when null),
  `_count.cards → cardCount`.
- `FlashcardReviewItemDto → Flashcard`: uses the stable `cardId` for identity,
  `card.frontText → front`, `card.reading → reading` (`''` when null),
  `card.backText → back`.

### Dependencies added

| Package | Version | Why |
| --- | --- | --- |
| `json_annotation` | `^4.12.0` | Annotations for the generated DTO serializers. |
| `build_runner` (dev) | `^2.4.13` | Runs Dart code generation. |
| `json_serializable` (dev) | `^6.9.0` | Generates `fromJson` for the DTOs. |

No dependency was added that is not actually used by committed code.

### Verify results (2026-06-01)

```
flutter pub get                                   → green
dart run build_runner build --delete-...outputs   → wrote outputs; rerun wrote 0 (no drift)
dart format .                                      → green
flutter analyze                                    → No issues found!
flutter test                                       → All tests passed! (40 tests)
```

### Deviations / known issues / blockers

- Due-reviews endpoint is not deck-scoped in the current contract → `fetchCards`
  returns the global due queue regardless of `deckId`. Documented, not faked.
- Submitting grades to the server is deferred (read-only repository interface).
- End-to-end `api` mode requires a running backend + a provisioned Keycloak
  session (Phase 4 blockers Q3/Q4); default `mock` mode is fully functional now.

---

_Missing evidence: none for Phase 5. All verify commands were executed on 2026-06-01 with the outputs quoted above._


## Phase 5.5 — SRS Write Contract + Repository Rating Method

Extends `FlashcardRepository` with grade submission so a review rating can be
written through the repository (server now, offline queue in a later phase).
Mock remains the default source; API mode wires the real submit endpoint.

### Submit endpoint status — **implemented** (not blocked)

`POST /api/flashcards/reviews/{userFlashcardId}` with body
`SubmitFlashcardReviewRequestOpenApiDto`.

### Identifier decision — `userFlashcardId` (sourced from contract)

- `FlashcardReviewItemOpenApiDto.id` is documented as **"userFlashcard id."**
  (`apps/api/openapi/openapi.json`), distinct from `cardId` ("Underlying card
  id."). The review item already exposes the value, so **no contract change is
  needed** and nothing is guessed.
- The submit path parameter is `userFlashcardId`; the grade is therefore keyed
  by the per-learner review row, never by `cardId`.
- `userId` is marked required in `SubmitFlashcardReviewRequestOpenApiDto`, but
  the controller resolves it from the verified Keycloak token
  (`resolveLearnerUserId`, `apps/api/src/keycloak/learner-identity.util.ts`):
  a token-authenticated request needs no body `userId`, and a mismatched one is
  rejected (403). The mobile client sends **only `{ "rating" }`** and relies on
  the bearer token — no client-supplied user id, no IDOR surface.

### Files created / modified / deleted

- **Modified** `lib/core/api/api_client.dart` — added `postJson(path, {body})`
  (mirrors `getJson`; sets `content-type: application/json; charset=utf-8` only
  when a body is sent; attaches bearer via the existing seam).
- **Modified** `lib/features/flashcards/domain/flashcard.dart` — added
  `userFlashcardId` (per-learner review row id) alongside the display `id`.
- **Modified** `lib/features/flashcards/domain/flashcard_repository.dart` —
  added `submitReviewRating({required String userFlashcardId, required SrsRating rating})`.
- **Modified** `lib/features/flashcards/data/flashcard_dto_mapper.dart` —
  maps DTO `id → userFlashcardId`, keeping `cardId → id` for display identity.
- **Modified** `lib/features/flashcards/data/api_flashcard_repository.dart` —
  implemented `submitReviewRating` → `POST /api/flashcards/reviews/{id}` body
  `{rating: SrsRating.name}`, reusing `_guard` for 401/403/network mapping.
- **Modified** `lib/features/flashcards/data/mock_flashcard_repository.dart` —
  added `userFlashcardId` to the seven seed cards; dropped `const` ctor; records
  grades in an in-memory `submittedRatings` map.
- **Modified** `lib/features/flashcards/presentation/flashcard_providers.dart` —
  `ReviewSessionState` gained `unsyncedReviewIds`; `rate` advances optimistically
  then submits via the repository, recording failed submits (no silent swallow,
  no offline queue). Mock provider no longer `const`.
- **Modified tests** — `flashcard_dto_mapper_test.dart` (asserts
  `userFlashcardId`), `api_flashcard_repository_test.dart` (submit success +
  401), `review_session_controller_test.dart` (recording-repo asserts submit on
  rate), `mock_flashcard_repository_test.dart` (non-const ctor).
- **Deleted** — none.
- **Generated artifacts** — none changed; no DTO schema was added or edited, so
  `build_runner` was a no-op ("wrote 0 outputs", clean `*.g.dart` diff).

### Repository interface change

```dart
Future<void> submitReviewRating({
  required String userFlashcardId,
  required SrsRating rating,
});
```

- **API mode**: POSTs `{rating}` to the user-flashcard review endpoint; learner
  resolved server-side from the token; failures surface as
  `FlashcardRepositoryException` (clear VI copy, never fakes success, never logs
  tokens).
- **Mock mode** (default): records the grade in-memory (`submittedRatings`), no
  network.

### Controller behavior change

`ReviewSessionController.rate` advances the UI optimistically (unchanged flow),
then fires `submitReviewRating` for the current card's `userFlashcardId`.
A `FlashcardRepositoryException` is caught and the id is added to
`ReviewSessionState.unsyncedReviewIds` (the seed for the future offline-sync
phase) instead of being silently dropped. No UI changes were required; the
rating bar callback signature is unchanged.

### Verify results (executed 2026-06-01)

```text
dart run build_runner build --delete-conflicting-outputs → "wrote 0 outputs" (no drift; *.g.dart diff empty)
dart format .  → Formatted 53 files (0 changed)
flutter analyze → No issues found! (ran in 2.7s)
flutter test    → All tests passed! (43 tests, +3 since Phase 5)
```

### Remaining blockers / known issues

- End-to-end API-mode submit still requires a running backend + a real Keycloak
  session (Phase 4 blockers Q3/Q4); `mock` default is fully functional.
- Out of scope by design (not implemented, no stubs): batch submit
  (`POST /api/flashcards/reviews` batch), `elapsedMs`/`reviewedAt` telemetry,
  offline persistence/queue, retry/idempotency, and Drift/local DB.
  `unsyncedReviewIds` is the documented handoff point for the offline phase.

---

_Missing evidence: none for Phase 5.5. All verify commands were executed on 2026-06-01 with the outputs quoted above._


## Phase 6A — Drift Local Cache Foundation

Adds an on-device Drift (SQLite) cache for flashcard decks and due-review cards
so a successful API read can be persisted and replayed when the network fails.
This is **foundation only**: no offline write queue, no background sync worker,
no SRS scheduling. Grade submission still goes straight to the server.

### Files created / modified / deleted

- **Created** `lib/features/flashcards/data/local/flashcard_cache_tables.dart` —
  Drift `Table` definitions: `FlashcardDecks` (PK `id`) and
  `FlashcardReviewCards` (composite PK `{deckId, userFlashcardId}`). Generated
  row classes renamed via `@DataClassName` (`FlashcardDeckRow`,
  `FlashcardReviewCardRow`) to avoid clashing with the domain models.
- **Created** `lib/core/database/app_database.dart` — `@DriftDatabase`
  (`schemaVersion = 1`); real ctor lazily opens
  `<app-docs>/nihongo_bjt_cache.sqlite` via `NativeDatabase.createInBackground`;
  `AppDatabase.forTesting(super.e)` accepts an injected executor.
- **Created** `lib/features/flashcards/data/local/flashcard_cache_dao.dart` —
  `@DriftAccessor` DAO with `upsertDecks` / `readDecks` /
  `upsertReviewCards(deckId, …)` / `readReviewCards(deckId)`; upserts via
  `batch(insertAllOnConflictUpdate)`; maps rows ↔ domain models.
- **Created** `lib/core/database/database_provider.dart` — `appDatabaseProvider`
  (owns + disposes the single `AppDatabase`) and `flashcardCacheDaoProvider`.
- **Created** `lib/features/flashcards/data/cached_flashcard_repository.dart` —
  `CachedFlashcardRepository(remote, dao)` read-through wrapper.
- **Modified** `lib/features/flashcards/presentation/flashcard_providers.dart` —
  the `api` branch now returns `CachedFlashcardRepository` wrapping
  `ApiFlashcardRepository` + the cache DAO. Mock branch unchanged.
- **Modified** `pubspec.yaml` — added `drift`, `path`, `path_provider`,
  `sqlite3_flutter_libs` (deps) and `drift_dev` (dev dep); deps kept
  alphabetical.
- **Created tests** — `test/features/flashcards/flashcard_cache_dao_test.dart`
  (DAO round-trip / overwrite / per-deck isolation) and
  `test/features/flashcards/cached_flashcard_repository_test.dart` (cache-on-read,
  fallback, rethrow-on-empty, submit delegation).
- **Modified test** — `test/features/flashcards/flashcard_provider_test.dart`
  (`api` source now expects `CachedFlashcardRepository`).
- **Deleted** — none (a throwaway `test/_sqlite_smoke_test.dart` was used to
  confirm native sqlite3 loads under `flutter test`, then removed).
- **Generated artifacts** — `lib/core/database/app_database.g.dart` and
  `lib/features/flashcards/data/local/flashcard_cache_dao.g.dart` (Drift
  codegen, committed, never hand-edited; stable on re-run).

### Dependencies added — rationale

- `drift ^2.20.0` + `drift_dev ^2.20.0` (dev) — type-safe reactive SQLite ORM
  with compile-time-checked queries; backs the cache and its codegen.
- `sqlite3_flutter_libs ^0.5.24` — bundles the native SQLite engine for
  Android/iOS/macOS/Windows/Linux so `NativeDatabase` has sqlite3 at runtime.
- `path ^1.9.0` — cross-platform join for the database file path.
- `path_provider ^2.1.4` — resolves the platform app-documents directory for the
  on-device db file.
- Removed — none.

### Database schema (v1)

| Table | Primary key | Columns |
| --- | --- | --- |
| `flashcard_decks` | `id` | `id`, `title`, `description`, `card_count`, `cached_at` |
| `flashcard_review_cards` | `(deck_id, user_flashcard_id)` | `deck_id`, `user_flashcard_id`, `card_id`, `front`, `reading`, `back`, `cached_at` |

Composite PK on review cards: the due-review endpoint is global server-side, but
the repository fetches per review session, so the cache is scoped by the
requesting `deckId` to match the read contract. `cached_at` (UTC) is stamped on
every upsert for a future staleness policy; no eviction logic exists yet.

### Cache behavior

- Upsert-based (`insertAllOnConflictUpdate`) — a fresh fetch overwrites existing
  rows in place; no delete-all-then-insert, no orphan cleanup in this phase.
- Empty input lists are a no-op (no write).
- Reads return rows mapped back to the domain models; review-card reads are
  filtered to the requested `deckId`.

### Repository source behavior

`CachedFlashcardRepository` (used only in `api` mode):

- `fetchDecks` / `fetchCards(deckId)` — call the remote; on success persist via
  the DAO and return the fresh data; on `FlashcardRepositoryException` return the
  last cached snapshot when non-empty, otherwise **rethrow** (no fake empty UI).
- `submitReviewRating` — delegates straight to the remote; never cached, no
  queue.
- `mock` mode (default) is unchanged: it returns `MockFlashcardRepository`
  directly and never touches the database.

### Verify results (executed 2026-06-01)

```text
flutter pub get  → Changed 9 dependencies!
dart run build_runner build --delete-conflicting-outputs → wrote outputs; re-run stable (*.g.dart unchanged)
dart format .    → Formatted 62 files (0 changed)
flutter analyze  → No issues found!
flutter test     → All tests passed! (56 tests, +13 since Phase 5.5)
```

Native sqlite3 availability under `flutter test` on Windows was confirmed before
implementation (throwaway smoke test, passed, then deleted), so the DAO tests
run on `NativeDatabase.memory()` with no DLL workaround.

### Remaining blockers / known issues

- Out of scope by design (not implemented, no stubs): offline write queue,
  background sync worker, retry/idempotency, batch submit, cache eviction /
  staleness enforcement, and schema migrations beyond v1.
- End-to-end `api` mode still needs a running backend + a real Keycloak session
  (Phase 4 blockers Q3/Q4); `mock` default is fully functional and DB-free.

### Deviations

- None. The planned file set was delivered as scoped; the only addition was
  `@DataClassName` annotations to resolve a generated/domain name collision.

---

_Missing evidence: none for Phase 6A. All verify commands were executed on 2026-06-01 with the outputs quoted above._

---

## Phase 6B — Offline Review Queue + Idempotency Foundation

Date: 2026-06-01. Goal: persist review grades that fail to submit (offline/auth
error) into a local queue with a locally generated idempotency key, and provide
a manual, testable sync service to drain the queue. No background worker, timer,
or polling.

### Idempotency support status

Investigated the backend before adding any wire seam. The flashcard review
endpoint `POST /api/flashcards/reviews/:userFlashcardId`
(`apps/api/src/flashcards/flashcards.controller.ts → submitReview`) reads only
the route param and body (`rating`, optional `userId`). It does **not** read an
`Idempotency-Key` header. Idempotency machinery exists elsewhere (battle
orchestrator in-memory set, a webhook description in `openapi.json`) but **not**
for flashcard reviews.

Decision: **server-side idempotency is NOT enforced (blocker).** The idempotency
key is therefore **local-only** — stored on each queue row (unique column,
`insertOrIgnore` dedup) to guarantee a logical grade event is never enqueued
twice. It is intentionally **not transmitted** on the wire, because adding a
header the server ignores would be fake/unused code. When the backend adds
idempotency support, the sync service can start sending the stored key.

### Database schema migration

`schemaVersion` bumped **1 → 2**. New table `flashcard_review_queue`
(`FlashcardReviewQueue`, row class `FlashcardReviewQueueRow`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int, autoincrement | queue row key |
| `userFlashcardId` | text | per-learner review row |
| `rating` | text | `SrsRating.name` |
| `answeredAt` | dateTime | when graded (UTC) |
| `idempotencyKey` | text, **unique** | local dedup key |
| `status` | text, default `pending` | `pending` / `synced` |
| `attemptCount` | int, default 0 | failed sync attempts |
| `lastError` | text, nullable | last sync error |
| `createdAt` | dateTime | enqueue time |
| `updatedAt` | dateTime | last mutation |

`MigrationStrategy`: `onCreate → createAll()`;
`onUpgrade → if (from < 2) createTable(flashcardReviewQueue)`.

### Queue behavior

`ReviewQueueDao` (`@DriftAccessor`) + `OfflineReviewQueue` (domain wrapper owning
idempotency-key generation and the clock, both injectable for tests).

- `enqueueReview` / `enqueueFailedReview`: insert with `InsertMode.insertOrIgnore`
  — a duplicate `idempotencyKey` is silently ignored (no second row).
- `readPendingReviews` / `pending`: `status == pending`, FIFO by `createdAt`.
- `markSynced`: sets `status = synced` (drops it from the pending set).
- `markFailed`: increments `attemptCount`, stores `lastError`, **stays
  `pending`** so a later manual sync retries it. No give-up/expiry policy.
- Default idempotency key: 128-bit `Random.secure()` hex, no new dependency.

### Sync behavior

`FlashcardReviewSyncService.sync()` is **manual only**. It reads `queue.pending()`
and, per row, calls `remote.submitReviewRating(...)`:

- success → `queue.markSynced(id)`, `synced++`;
- `FlashcardRepositoryException` → `queue.markFailed(id, message)`, `failed++`,
  row remains queued.

Returns `ReviewSyncResult { synced, failed, total }`. The injected `remote` is
the **bare** `ApiFlashcardRepository`, never the cache wrapper — so a failed sync
cannot recursively re-enqueue. No timers/isolates/background work.

### Repository source behavior

- **mock mode (default):** `MockFlashcardRepository` — fully in-memory, never
  opens the database or queue.
- **api mode:** `CachedFlashcardRepository(apiRepo, cacheDao, offlineQueue)`.
  Reads are read-through cache (Phase 6A). `submitReviewRating` now: on success
  delegates to remote; on `FlashcardRepositoryException` it
  `enqueueFailedReview(...)` **then rethrows** — never swallowed, never faked as
  success. The existing UI `unsyncedReviewIds` session indicator is unchanged.

Providers added: `reviewQueueDaoProvider`, `apiFlashcardRepositoryProvider`
(shared bare API repo), `offlineReviewQueueProvider`,
`flashcardReviewSyncServiceProvider`. `flashcardRepositoryProvider` api branch
now injects the offline queue.

### Files created/modified

Created:
- `lib/features/flashcards/data/local/queued_review.dart`
- `lib/features/flashcards/data/local/review_queue_dao.dart` (+ generated `.g.dart`)
- `lib/features/flashcards/data/offline_review_queue.dart`
- `lib/features/flashcards/data/flashcard_review_sync_service.dart`
- `test/features/flashcards/review_queue_dao_test.dart`
- `test/features/flashcards/offline_review_queue_test.dart`
- `test/features/flashcards/flashcard_review_sync_service_test.dart`

Modified:
- `lib/features/flashcards/data/local/flashcard_cache_tables.dart` (queue table)
- `lib/core/database/app_database.dart` (table + DAO + schemaVersion 2 + migration)
- `lib/core/database/database_provider.dart` (`reviewQueueDaoProvider`)
- `lib/features/flashcards/data/cached_flashcard_repository.dart` (enqueue-on-fail)
- `lib/features/flashcards/presentation/flashcard_providers.dart` (new providers)
- `test/features/flashcards/cached_flashcard_repository_test.dart` (3-arg ctor + queue)
- regenerated `lib/core/database/app_database.g.dart`

### Verify (executed 2026-06-01)

- `dart run build_runner build` → `wrote 58 outputs`; re-run reported
  `3 same, 3 no-op` (stable generated diff).
- `dart format .` → no changes pending.
- `flutter analyze` → **`No issues found!`**
- `flutter test` → **`All tests passed!` (71 tests)**.

_Missing evidence: none for Phase 6B. Blocker recorded above: backend does not
enforce idempotency for flashcard reviews, so the key is local-only and not yet
sent on the wire._

---

## Phase 7 — Real E2E Validation Harness (API / Auth / Offline Queue)

Date: 2026-06-01. Goal: a production-grade harness + checklist to run the app
**for real** on an emulator/device against Keycloak + backend in API mode, plus a
minimal debug-only hook to exercise the Phase 6B manual sync. No background
worker, no new large production UI, mock stays default.

### E2E status

**Ready for manual validation.** This phase delivers the harness/checklist and a
debug hook; it does **not** claim a passing E2E run — no real device/emulator run
has been executed here, so there is no evidence to assert "passed". The results
table in `docs/mobile/E2E_VALIDATION.md` is left pending for a real run.

### Files created/modified

Created:
- `docs/mobile/E2E_VALIDATION.md` — dart-define table, emulator localhost
  mapping, Keycloak client checklist, manual E2E checklist, idempotency caveat,
  pending results log.
- `lib/features/flashcards/presentation/debug_review_sync_action.dart` —
  `DebugReviewSyncAction` widget + unit-tested `formatReviewSyncResult`.
- `test/features/flashcards/debug_review_sync_action_test.dart`.

Modified:
- `lib/features/flashcards/presentation/flashcard_deck_list_page.dart` — debug
  action wired into the deck-list `AppBar`.
- this log (Phase 7 section).

Deleted: none.

### Debug/manual sync hook status

**Added.** `DebugReviewSyncAction`:
- renders nothing unless `kDebugMode` **and** `FLASHCARD_DATA_SOURCE=api` — never
  in a release build, never in mock mode (which has no queue);
- one tap → `flashcardReviewSyncServiceProvider.sync()` once (no timer/polling);
- shows `synced / failed / total` via SnackBar, formatted by the pure,
  unit-tested `formatReviewSyncResult`.

### Required `--dart-define`

`API_BASE_URL`, `KEYCLOAK_ISSUER`, `OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`,
`FLASHCARD_DATA_SOURCE=api`. Android emulator example (host loopback `10.0.2.2`):

```bash
flutter run \
  --dart-define=FLASHCARD_DATA_SOURCE=api \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000 \
  --dart-define=KEYCLOAK_ISSUER=http://10.0.2.2:9080/realms/nihongo-bjt \
  --dart-define=OAUTH_CLIENT_ID=nihongo-mobile \
  --dart-define=OAUTH_REDIRECT_URI=com.nihongobjt.app://oauth2redirect
```

### Emulator/device notes

- Android AVD → host via `10.0.2.2`; Genymotion → `10.0.3.2`; iOS sim →
  `localhost`; physical device → host LAN IP + open firewall.
- Cleartext (`http://`) auth permitted only for a dev `http://` issuer
  (`allowInsecureAuthConnections`); production issuers are HTTPS.

### Keycloak client checklist (summary)

Public client, standard flow ON, PKCE **S256** required, valid redirect URI
`com.nihongobjt.app://oauth2redirect` (matches `OAUTH_REDIRECT_URI` + native
manifests), web origins only if a web build is used, scopes
`openid profile email offline_access`. Full checklist in `E2E_VALIDATION.md`.

### Verify (executed 2026-06-01)

- `dart format .` → no changes pending.
- `flutter analyze` → **`No issues found!`**
- `flutter test` → **`All tests passed!` (73 tests)**.

### Known limitation

Server-side idempotency still **not enforced** (carried from Phase 6B): the local
key prevents double-enqueue but is not transmitted, so a lost-response retry
could double-submit. Flagged in the E2E checklist as a manual duplicate check.

_Missing evidence: none for the Phase 7 deliverable (harness + debug hook +
unit tests, all verify commands run above). The manual E2E run itself is
intentionally not yet performed — status is "ready for manual validation", and
no "passed" claim is made without real device/emulator evidence._

---

## Phase 7.1 — Manual E2E Run (attempted)

Date: 2026-06-01. Goal: actually run the manual E2E (Keycloak PKCE + backend +
`FLASHCARD_DATA_SOURCE=api`) and record real evidence.

### E2E status

**BLOCKED — infrastructure not running.** The run could not start; no step was
exercised. Honest status, no "passed" claim. **Docs-only** — no code changed.

### Readiness checks actually executed

| Check | Command | Result |
| --- | --- | --- |
| Devices | `flutter devices` | only `windows`, `chrome`, `edge` — no Android/iOS device |
| Emulators | `flutter emulators` | `Unable to find any emulator sources` (no AVD images) |
| Backend API | `curl -m4 -o/dev/null -w%{http_code} http://localhost:4000/` | `000` (down) |
| Keycloak | `curl -m4 … http://localhost:9080/realms/nihongo-bjt/.well-known/openid-configuration` | `000` (down) |

### Blockers (must clear before re-attempt)

1. No emulator/device connected — PKCE login needs a native browser tab; the
   custom-scheme redirect flow is not exercised on Windows/web targets.
2. Backend API not running (`pnpm dev:api`, port 4000).
3. Keycloak realm not running (port 9080).

### Step-by-step result

| Step | Result |
| --- | --- |
| login redirect | not run (blocked) |
| return app | not run (blocked) |
| session restore | not run (blocked) |
| deck fetch | not run (blocked) |
| review fetch | not run (blocked) |
| submit rating | not run (blocked) |
| offline enqueue | not run (blocked) |
| manual sync drain | not run (blocked) |
| logout guard | not run (blocked) |

### Config to use when re-running (no secrets/tokens recorded)

`FLASHCARD_DATA_SOURCE=api`, `API_BASE_URL`, `KEYCLOAK_ISSUER`,
`OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI` — values per `E2E_VALIDATION.md` §1
(Android emulator uses host alias `10.0.2.2`). Keycloak client must be public,
standard-flow ON, PKCE S256, redirect `com.nihongobjt.app://oauth2redirect`
matching native manifests.

### Bugs found

None — run did not start, so nothing was exercised.

### Files modified

- `docs/mobile/E2E_VALIDATION.md` (Phase 7.1 BLOCKED evidence in results log).
- this log (Phase 7.1 section).

No application code changed → no `dart format` / `flutter analyze` /
`flutter test` required for this phase (docs-only).

_Missing evidence: none — the blockers are documented with the exact commands
and their outputs. E2E remains unproven (blocked), and no "passed" is claimed._


---

## Phase 8 — Reading Assist + JapaneseText + Exam-mode Suppression

**Date:** 2026-06-01
**Status:** ✅ Done — verify green (analyze clean, 81 tests passed).

### Scope

Foundation reading-assist layer: a reusable `JapaneseText` widget gated by a
`ReadingAssistPolicy`, wired into flashcard review so reading help (furigana)
is suppressed during active recall and revealed with the answer. No tokenizer,
dictionary, NLP, or external dependency.

### Files created

- `lib/features/reading_assist/domain/reading_assist_policy.dart` —
  `ReadingAssistMode { enabled, examSuppressed }` + immutable
  `ReadingAssistPolicy` (context `mode` + per-user `userEnabled`).
  `showsReading` is true only when the user wants it **and** the context
  permits it. `ReadingAssistPolicy.exam()` always suppresses.
- `lib/features/reading_assist/presentation/japanese_text.dart` —
  `JapaneseText` (StatelessWidget). Always renders the main text; renders the
  reading line above it only when `policy.showsReading` **and** a non-empty
  reading is supplied. Built from `Text`/`Column` only.
- `test/features/reading_assist/japanese_text_test.dart` — 3 policy unit tests
  + 5 widget tests (renders text, shows reading, exam suppresses, no reading,
  blank reading treated as none).

### Files modified

- `lib/features/flashcards/presentation/flashcard_review_page.dart` —
  `_CardFace` renders the front via `JapaneseText`. Before reveal the policy is
  `ReadingAssistPolicy.exam()` (reading hidden = active recall); after reveal
  the default policy shows the reading together with the answer. The
  "Hiện đáp án" → rating flow is unchanged.
- `test/features/flashcards/flashcard_flow_test.dart` — added assertions: before
  reveal the reading (ほうこく) and answer (báo cáo) are hidden; after reveal both
  appear.

### Policy behavior

- **Browse / free study** (default `ReadingAssistPolicy()`): reading shown when
  a reading exists and the user toggle is on.
- **Review (active recall)**: front uses exam policy before reveal → reading
  suppressed; after reveal → reading shown with the answer.
- **Exam** (`ReadingAssistPolicy.exam()`): reading always suppressed regardless
  of the user toggle.

### Verify evidence

| Command | Result |
| --- | --- |
| `dart format .` | applied, no diff failures |
| `flutter analyze` | **No issues found!** (ran in 3.2s) |
| `flutter test` | **All tests passed!** — `+81` (73 prior + 8 new) |

### Deviations / known issues

- Previous `_CardFace` showed the reading **before** reveal; it is now hidden
  until reveal (active recall). Intentional; the flow test was updated to
  assert it. No regression to the reveal/rating flow.
- No new dependency; furigana is a kana line above the term (no ruby glyph
  positioning) — sufficient for this foundation layer.

_Missing evidence: none._

---

## Phase 9 — i18n + Japanese Font / Typography Polish

**Date:** 2026-06-01
**Status:** ✅ Done — verify green (analyze clean, 84 tests passed).

### Scope

Minimal i18n foundation (Flutter gen-l10n) + a clear Japanese/Vietnamese
typography policy. Inline UI strings on existing screens were migrated to
localization keys. No new business feature, no new API, no Auth/API/cache/queue
changes.

### i18n mechanism

- Built-in **Flutter gen-l10n** (`flutter_localizations` SDK package + `intl`).
  No third-party i18n package added.
- `l10n.yaml` → ARB in `lib/l10n`, generated sources in `lib/l10n/gen`
  (committed like other generated code, excluded from analysis).
- `app.dart` wires `AppLocalizations.localizationsDelegates` /
  `supportedLocales` and a `localeListResolutionCallback` that prefers the
  device locale but **falls back to Vietnamese** (the learner audience) instead
  of the first listed locale.

### Locale / string migration

- Locales: **vi** (template/default) + **ja** (secondary). 25 keys each,
  including `int` placeholders (`deckCardCount`, `reviewCompleteSummary`,
  `ratingIntervalDays`).
- Migrated screens: Home, Login, Flashcard deck list, Flashcard review
  (titles, CTAs, empty/error/retry copy, SRS grade labels, interval labels).
- **Not migrated (deliberate):** `debug_review_sync_action.dart` — debug-only,
  dev-build-gated tool whose `formatReviewSyncResult` is a `@visibleForTesting`
  pure function tested without a `BuildContext`. Localizing it would force a
  context dependency for no production benefit. Recorded as a known decision.

### Typography / font strategy

- `AppTypography` gained explicit Japanese tokens: `japaneseDisplay` (44, h1.5),
  `japaneseBody` (18, h1.8 per `production-first`), `japaneseReading` (16, h1.4).
  Latin/Vietnamese body & UI chrome keep the Material `textTheme` slots.
- `JapaneseText` now defaults to `japaneseBody` / `japaneseReading`; the review
  card passes `japaneseDisplay`. The inline 44px TextStyle in the review page
  was removed in favor of the token.
- **Font blocker:** no licensed font asset exists in the repo, so no `fonts:`
  section was added to `pubspec.yaml` (no fake bundling). `fontFamilyFallback`
  stays clean: Inter for Latin glyphs → platform CJK (e.g. Noto Sans JP) for
  Japanese → system default. Bundling licensed assets remains deferred.

### Dependencies

- Added: `flutter_localizations` (SDK) and `intl: any` — both required by
  gen-l10n. No external/non-SDK package added.
- Removed: none.

### Files

- Created: `l10n.yaml`, `lib/l10n/app_vi.arb`, `lib/l10n/app_ja.arb`,
  `lib/l10n/gen/app_localizations*.dart` (generated, committed),
  `test/l10n/app_localizations_test.dart`.
- Modified: `pubspec.yaml`, `analysis_options.yaml` (exclude `lib/l10n/gen`),
  `lib/app/app.dart`, `lib/core/theme/app_typography.dart`,
  `lib/features/reading_assist/presentation/japanese_text.dart`,
  `lib/features/home/presentation/home_page.dart`,
  `lib/features/auth/presentation/login_page.dart`,
  `lib/features/flashcards/presentation/flashcard_deck_list_page.dart`,
  `lib/features/flashcards/presentation/flashcard_review_page.dart`,
  `test/features/reading_assist/japanese_text_test.dart`,
  `test/features/flashcards/flashcard_flow_test.dart` (unchanged this phase —
  still green under the vi fallback).
- Deleted: none.

### Verify evidence

| Command | Result |
| --- | --- |
| `flutter gen-l10n` | generated `app_localizations{,_vi,_ja}.dart` |
| `dart format lib test` | applied, no diff failures |
| `flutter analyze` | **No issues found!** (ran in 4.6s) |
| `flutter test` | **All tests passed!** — `+84` (81 prior + 3 new l10n/typography) |

### Deviations / known issues / blockers

- **Font asset blocker** (above): no bundled font; relying on platform fonts.
- Debug sync action left un-migrated by design (above).
- Phase 7.1 manual E2E remains **deferred/blocked** (no emulator/device or
  running backend); no production E2E is claimed.

_Missing evidence: none._

---

## Phase 10 — Learning Home Dashboard MVP

- **Date:** 2026-06-01
- **Status:** Done

### Scope

Promote Home from a static placeholder to a Learning Home Dashboard MVP using
only existing data seams (flashcard repository + offline review queue). No new
business feature, API endpoint, dependency, or fabricated metric.

### Dashboard data sources

| Metric | Source | Notes |
| --- | --- | --- |
| `deckCount` | `flashcardRepositoryProvider.fetchDecks()` | Same repo/source the deck-list screen uses. |
| `totalCardCount` | sum of `deck.cardCount` over fetched decks | Derived, no extra call. |
| `pendingSyncCount` | `offlineReviewQueueProvider.pending().length` | **Only** when `appEnvironmentProvider.useApiFlashcards` is true; stays `null` in mock mode (queue N/A). |

### Real-metric justification (no fake completion)

- No streak / SRS-due / accuracy metrics shown — those have no real backing
  store yet, so they are intentionally absent rather than fabricated.
- Sync card renders only when a real queue exists (API mode); mock mode hides
  it instead of showing a fake `0`.
- Welcome copy uses a generic localized greeting (`homeWelcome`) — auth session
  tokens are opaque, so no display name is invented.

### Controller behaviour note

`homeDashboardProvider` is a `FutureProvider`. Riverpod 3 keeps a *first failed
load* flagged as `AsyncLoading` with `hasError == true`, so a plain
`AsyncValue.when` would show the skeleton forever on error. `HomePage` therefore
prioritises `hasValue` → `hasError` → loading explicitly, which fixes the error
branch in both tests and production.

### Files

- Created:
  `lib/features/home/domain/home_dashboard_data.dart`,
  `lib/features/home/presentation/home_dashboard_controller.dart`,
  `test/features/home/home_page_test.dart`.
- Modified:
  `lib/features/home/presentation/home_page.dart` (placeholder → dashboard),
  `lib/l10n/app_vi.arb`, `lib/l10n/app_ja.arb`,
  `lib/l10n/gen/app_localizations{,_vi,_ja}.dart` (regenerated).
- Deleted: none.

### i18n keys

- Removed (orphaned after rewrite): `homeRoadmapTitle`, `homeRoadmapBody`.
- Added (VI + JA, 13 keys): `homeContinueTitle`, `homeContinueBody`,
  `homeReviewReadyTitle`, `homeReviewReadyCount`, `homeDeckSummaryTitle`,
  `homeDeckSummaryCount`, `homeSyncStatusTitle`, `homeSyncPending`,
  `homeSyncAllSynced`, `homeDashboardEmptyTitle`, `homeDashboardEmptyBody`,
  `homeDashboardError`. (`homeReviewFlashcards` reused unchanged.)

### Dependencies

- Added: none. Removed: none. Flutter + Riverpod were sufficient.

### Verify evidence

| Command | Result |
| --- | --- |
| `flutter gen-l10n` | regenerated `app_localizations{,_vi,_ja}.dart` |
| `dart format lib test` | applied, no diff failures |
| `flutter analyze` | **No issues found!** (ran in 3.9s) |
| `flutter test` | **All tests passed!** — `+90` (84 prior + 6 new home tests) |

Home tests cover: metrics from data, offline sync status (API mode), empty
state, loading skeleton, error state + retry (real repo-throw path), and JA
localization.

### Deviations / known issues / blockers

- Phase 7.1 manual E2E remains **deferred/blocked** (no emulator/device or
  running backend); no production E2E is claimed.
- Debug sync action still un-migrated by design (carried from prior phases).
- Font asset blocker from Phase 9 still stands (platform fonts in use).

_Missing evidence: none._

---

## Phase 10.1 — Auth Fix: provision Keycloak `nihongo-mobile` client (Q3/Q4)

**Date:** 2026-06-02
**Status:** ✅ Fixed (config + dev provisioning). Manual sign-in re-verify is the
user's to run (infra started locally).
**Scope:** Keycloak realm config + dev bootstrap script only. **No Flutter code
changed.**

### Root cause

Mobile sign-in failed with the app's honest fallback message *"Không thể đăng
nhập. Vui lòng thử lại."* (`KeycloakAuthRepository.signIn` → `AuthException`).
The cause was **not** the app: realm `nihongo-bjt` only defined the clients
`nihongo-web` and `nihongo-admin`. The public client **`nihongo-mobile`**
(referenced by `AppEnvironment.oauthClientId` and the AppAuth PKCE flow) **did
not exist** in `docker/keycloak/realm-export.json`, so Keycloak rejected the
authorize request (`invalid_client`) and AppAuth surfaced an exception. This is
exactly the long-standing **Q3/Q4** blocker.

### Diagnosis evidence (2026-06-02)

- `grep` confirmed `nihongo-mobile` appeared only in Flutter source/tests, never
  in the realm export → client missing server-side.
- `realm-export.json` `clients[]` listed only `nihongo-web`, `nihongo-admin`.
- Live Keycloak was **down** at the time (`curl http://localhost:9080/...` →
  `000`; no service on the port, Docker containers exited) — consistent with the
  user's note that they had not started it yet. Fix is config-level so it applies
  on next start.

### Fix

1. **`docker/keycloak/realm-export.json`** — added the `nihongo-mobile` client:
   `publicClient: true` (no secret on device), `standardFlowEnabled: true`,
   `directAccessGrantsEnabled` + `implicitFlowEnabled: false`, PKCE
   `pkce.code.challenge.method = S256`, redirect URIs
   `com.nihongobjt.app://oauth2redirect` (+ `http://localhost:4000/*` for tooling),
   `post.logout.redirect.uris` = the custom scheme, `webOrigins: ["+"]`, and an
   audience protocol mapper. Matches `AppEnvironment` defaults and the native
   manifests (Android `appAuthRedirectScheme`, iOS URL type).
2. **`docker/keycloak/configure-realms-http.sh`** — added `ensure_mobile_client`:
   the realm directory-import only runs on first container start, so a persisted
   Keycloak DB created before this client existed would still be missing it.
   The function checks via `kcadm get clients -q clientId=nihongo-mobile` and
   **creates it idempotently** (public/PKCE) when absent. Runs after the existing
   `ensure_direct_access_grants` calls.

### Verify

- `node -e "require('./docker/keycloak/realm-export.json')"` → JSON valid;
  clients now = `nihongo-web, nihongo-admin, nihongo-mobile`;
  `nihongo-mobile.publicClient = true`, redirect URIs include the custom scheme.
- Live sign-in re-test deferred to the user (they start Keycloak/API/emulator
  locally). With the client present, the authorize request will no longer be
  rejected as `invalid_client`.

### Docs updated

- `docs/mobile/IMPLEMENTATION_PLAN.md` — **Q3** and **Q4** marked RESOLVED.
- `docs/mobile/E2E_VALIDATION.md` — §3 checklist annotated "Provisioned".

_Missing evidence: live PKCE round-trip not run here (infra is user-started);
config validity proven by the JSON parse above._

---

## Phase 10.2 — Profile & Settings (device-scoped prefs + real identity)

User-selected mobile track: "Màn hình hồ sơ + cài đặt: logout, đổi ngôn ngữ,
furigana toggle, thông tin phiên — kết nối auth thật."

A complete vertical slice: a Profile/Settings screen showing the learner's real
identity (decoded from their own ID token), an app-language override, a furigana
toggle, and sign-out. Preferences persist **device-locally** (no server round-trip
needed for a per-device display setting) via Drift; identity is read from the live
auth session; sign-out reuses the existing auth controller + guard.

### Added

- `features/settings/data/local/user_settings_table.dart` — Drift `UserSettings`
  key/value table (`@DataClassName('UserSettingRow')`).
- `features/settings/data/local/user_settings_dao.dart` — `UserSettingsDao`
  (`readAll` / `read` / `write` via `insertOnConflictUpdate` / `remove`).
- `features/settings/data/user_settings_repository.dart` — owns storage keys
  (`locale_override`, `furigana_enabled`) and per-preference encoding; applies
  defaults for absent/corrupt values so the app always loads.
- `features/settings/domain/app_locale_option.dart` — `AppLocaleOption`
  (system / vietnamese / japanese) with `storageValue` ↔ `Locale` mapping and a
  safe `fromStorage` fallback to `system`.
- `features/settings/domain/user_settings.dart` — immutable settings snapshot
  (`localeOption`, `furiganaEnabled`) + `defaults` + `copyWith`/value equality.
- `features/settings/domain/id_token_claims.dart` — display-only OIDC claim
  decode (`name` / `preferred_username` / `email`). **Display only**: no signature
  verification, never used for authorization; returns `empty` for any malformed
  token (must never throw on the profile screen).
- `features/settings/presentation/settings_controller.dart` — providers:
  repository, `settingsControllerProvider` (`AsyncNotifier`, optimistic update
  that reverts + rethrows on persist failure), derived `localeOverrideProvider`
  and `furiganaEnabledProvider`, and `profileClaimsProvider` (from the live
  session's ID token).
- `features/settings/presentation/profile_page.dart` — `ProfilePage`: account
  card (avatar + name/email), language card (radio-style rows, ≥48px targets,
  animated check), furigana toggle (Row + `Switch.adaptive` inside `AppCard` —
  **not** `SwitchListTile`, which asserts when wrapped in a decorated surface),
  and a danger-styled sign-out button with spinner. Persist failures surface a
  `profileSaveError` SnackBar.

### Modified

- `core/database/app_database.dart` — registered `UserSettings`/`UserSettingsDao`;
  `schemaVersion` 2 → 3 with `if (from < 3) createTable(userSettings)` migration.
- `core/database/database_provider.dart` — `userSettingsDaoProvider`.
- `app/app.dart` — `locale: ref.watch(localeOverrideProvider)` (null defers to the
  existing device-locale fallback → `vi`).
- `app/router.dart` — `Routes.profile` + `/profile` child route under home.
- `features/home/.../home_page.dart` — AppBar action now opens Profile
  (`account_circle_outlined`) instead of an inline logout button.
- `features/flashcards/.../flashcard_review_page.dart` — reveal-time furigana now
  honours `furiganaEnabledProvider` (exam-suppression before reveal unchanged).
- `l10n/app_vi.arb`, `l10n/app_ja.arb` — added `profile*` keys; removed the now
  orphaned `homeSignOutTooltip`.

### Verify

- `flutter gen-l10n && dart run build_runner build` — 170 outputs; DAO/table code
  generated; `app_database.g.dart` references `userSettings`.
- `flutter analyze` → **No issues found!**
- `flutter test` → **All tests passed!** (110 total = 90 baseline + 20 new:
  `id_token_claims_test`, `app_locale_option_test`, `user_settings_repository_test`
  [in-memory Drift round-trip + corrupt-value fallback], `profile_page_test`
  [widget: identity render, fallback label, language persist, furigana persist]).

_Live on-device run deferred to the user (they start API/Keycloak/emulator).
Android emulator reaches host services via `10.0.2.2`._
