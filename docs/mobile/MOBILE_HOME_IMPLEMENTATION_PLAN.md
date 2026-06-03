# NihonGo BJT — Mobile Home Implementation Plan

Date: 2026-06-03  
Mobile app path: `apps/mobile`

## Goal

Upgrade the Flutter Home screen from a narrow review summary into a production-grade mobile dashboard that preserves the web Home hierarchy while using only real mobile data contracts and existing production routes.

## Working Assumptions

- Do not change backend/database in this task.
- Do not repair the broader auth system except if a tiny navigation/test seam blocks Home verification.
- Local API/Keycloak may be down. Implement against existing repository contracts and mark runtime verification blocked when needed.
- No fake production counts, streaks, rank, plan status, due reviews, or personalized recommendations.
- Vietnamese and Japanese l10n must move together.

## Batch 1 — Data/Provider Foundation

Working files:

- `apps/mobile/lib/features/home/domain/home_dashboard_data.dart`
- `apps/mobile/lib/features/home/presentation/home_dashboard_controller.dart`
- `apps/mobile/test/features/home/home_page_test.dart`

Implementation:

- Expand `HomeDashboardData` into a partial-safe snapshot:
  - flashcard deck count and card count from `flashcardRepositoryProvider`
  - optional offline sync pending count from `offlineReviewQueueProvider`
  - optional progress summary from `studySummaryProvider`
  - optional daily lesson from `dailyLessonProvider`
  - optional section failure flags for partial data
- Keep API-backed feature content as route entries unless the provider fetch is already stable and low-cost.
- Keep all unavailable values absent, not zero.
- Add explicit partial-data behavior so Home can still render core actions when one provider fails.

Verification after Batch 1:

- `cd apps/mobile && flutter analyze`
- `cd apps/mobile && flutter test`

Do not continue if red.

## Batch 2 — Production Home UI

Working files:

- `apps/mobile/lib/features/home/presentation/home_page.dart`
- `apps/mobile/lib/l10n/app_vi.arb`
- `apps/mobile/lib/l10n/app_ja.arb`
- generated localization files if Flutter does not regenerate during tests
- `apps/mobile/test/features/home/home_page_test.dart`

Home sections to implement:

- Mobile hero with greeting, honest primary CTA, and secondary CTA:
  - review flashcards when decks/cards exist
  - otherwise start with Learn/Exam entry, not fake due counts
- Today's learning:
  - daily lesson from existing preview repository, clearly badged/worded as preview if needed
  - Learn route fallback when daily lesson unavailable
- Continue/review:
  - flashcard deck/card metrics and sync state
  - progress summary from device-local study log when present
- BJT practice/exam:
  - route to `Routes.exam`
  - keep current local practice route reachable through Learn/lesson detail
- Learning library:
  - dictionary, search, kanji, grammar, saved
- Real content shortcuts:
  - scenarios, news, magazine, career, rewards, subscription
- Honest empty/error/partial states:
  - no raw exceptions
  - retry invalidates Home provider

UI requirements:

- Mobile-native, not web grid clone.
- Calm, serious BJT dashboard.
- Light/dark via `AppPalette`.
- Safe at 360 dp, capped at tablet widths.
- No bottom navigation conflicts.
- Touch targets at least 48 dp.

Verification after Batch 2:

- `cd apps/mobile && flutter analyze`
- `cd apps/mobile && flutter test`

## Batch 3 — Navigation and Entry Points

Visible Home shortcuts and expected routes:

- Review/Flashcards -> `Routes.flashcards`
- Learn -> `Routes.learn`
- BJT exam -> `Routes.exam`
- Progress -> `Routes.progress`
- Dictionary -> `Routes.dictionary`
- Search -> `Routes.search`
- Kanji -> `Routes.kanji`
- Grammar -> `Routes.grammar`
- Saved -> `Routes.saved`
- Scenarios -> `Routes.scenarios`
- News -> `Routes.news`
- Magazine -> `Routes.magazine`
- Career -> `Routes.career`
- Rewards -> `Routes.rewards`
- Subscription -> `Routes.subscription`
- Profile/settings -> existing app bar/profile action

Excluded from Home for this task:

- Battle: no mobile route.
- Daily standup: no mobile route.
- Personalized web feed: no mobile repository.
- Weekly report/heatmap server widgets: no mobile analytics repository.
- Ads/push prompt/focus timer/ambient mode: platform/product-specific and not core Home.

Verification after Batch 3:

- Route smoke widget tests for visible shortcuts.
- `cd apps/mobile && flutter analyze`
- `cd apps/mobile && flutter test`

## Batch 4 — Polish Pass

Audit and fix:

- section order and CTA hierarchy
- spacing rhythm
- card density
- icon consistency
- contrast in light/dark
- Japanese/Vietnamese wrapping
- skeleton shape quality
- empty/error tone
- tablet content width cap

Verification:

- Home renders at 360 dp.
- Home renders in dark mode.
- Long Japanese/Vietnamese sample text does not overflow in Home tests where feasible.

## Batch 5 — Retest Package

Create:

- `docs/mobile/MOBILE_HOME_RETEST_CHECKLIST.md`
- `docs/mobile/MOBILE_HOME_RETEST_PROMPT_FOR_CODEX.md`

Update:

- `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
- `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`
- `docs/mobile/WEB_MOBILE_FEATURE_PARITY_MATRIX.md`

Final verification:

- `cd apps/mobile && flutter analyze`
- `cd apps/mobile && flutter test`
- `git diff --check`
- Try `cd apps/mobile && flutter build apk --debug` if the local SDK supports it.

## Runtime Verification Blocker

Live API-backed Home sections cannot be fully runtime-verified until local Keycloak/API are running and the app can log in at runtime. The implementation should still target the real contracts and avoid storing credentials or claiming runtime data passed.
