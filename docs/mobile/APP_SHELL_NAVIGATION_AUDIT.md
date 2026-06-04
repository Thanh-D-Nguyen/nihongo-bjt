# App Shell & Navigation Audit (Mobile)

> Batch 0 audit for the mobile app shell / navigation redesign. Evidence-based
> snapshot of the **current** state. No code changed in this batch.

## Scope inspected

| Area | File |
| --- | --- |
| Router | [apps/mobile/lib/app/router.dart](../../apps/mobile/lib/app/router.dart) |
| App shell | [apps/mobile/lib/app/shell/app_shell.dart](../../apps/mobile/lib/app/shell/app_shell.dart) |
| Nav labels (l10n) | [apps/mobile/lib/l10n/app_vi.arb](../../apps/mobile/lib/l10n/app_vi.arb), [apps/mobile/lib/l10n/app_ja.arb](../../apps/mobile/lib/l10n/app_ja.arb) |
| Nav tests | [apps/mobile/test/app/app_shell_test.dart](../../apps/mobile/test/app/app_shell_test.dart), [apps/mobile/test/app/navigation_test.dart](../../apps/mobile/test/app/navigation_test.dart) |
| Feature pages | `apps/mobile/lib/features/**` (home, learn, review, search, progress, settings) |

## Current bottom navigation (5 destinations)

The shell is a `StatefulShellRoute.indexedStack` with 5 branches. Bottom
`NavigationBar` destinations (in order):

| Index | Tab | Label key | VI / JA | Branch root |
| --- | --- | --- | --- | --- |
| 0 | Home | `navHome` | Trang chủ / ホーム | `/` |
| 1 | Learn | `navLearn` | Học / 学習 | `/learn` |
| 2 | Review | `navReview` | Ôn tập / 復習 | `/review` |
| 3 | Progress | `navProgress` | Tiến độ / 進捗 | `/progress` |
| 4 | Settings | `navSettings` | Cài đặt / 設定 | `/settings` (renders `ProfilePage`) |

## Current route ownership

### Branch 0 — Home (`/`)
- `/` → `HomePage` (dashboard; opens Profile via app-bar action `pushNamed(profile)`)
- `/profile` → `ProfilePage`
- `/profile/subscription` → `SubscriptionPage`

### Branch 1 — Learn (`/learn`) — **overloaded**
Owns far more than "structured learning":
- `lesson/:id`, `dictionary` (+ `:id`), `kanji` (+ `:id`), `grammar` (+ `:id`),
  `scenarios`, `exam`, `news` (+ `:id`), `magazine` (+ `:slug`),
  `career` (+ `arcs/:slug`), **`search`**, `saved`, `rewards`.

### Branch 2 — Review (`/review`)
- `/review` → `ReviewHubPage` (Flashcards card + Practice card; counts from live providers)
- `flashcards` → `FlashcardDeckListPage` (+ `new`, `:deckId` detail, edit, card create/edit)

### Branch 3 — Progress (`/progress`)
- `/progress` → `ProgressPage` (standalone tab)

### Branch 4 — Settings (`/settings`)
- `/settings` → `ProfilePage` (the **same** screen as `/profile`)

### Fullscreen flows (outside the shell — correct today)
These already live above the `StatefulShellRoute` so no bottom nav competes:
- `/practice/:id` → `PracticePage`
- `/flashcards/:deckId/review` → `FlashcardReviewPage`
- `/scenarios/:id` → `ScenarioPlayerPage`
- `/exam/:id` → `ExamPlayerPage`
- `/career/chapters/:id` → `CareerChapterPage`

## Problems identified

1. **Tab set diverges from product target.** Current = Home / Learn / Review /
   Progress / Settings. Target = Home / Learn / Review / **Search** / **Me**.
   - `Search` is a primary daily destination but is buried at `/learn/search`.
   - `Progress` and `Settings` are not daily-primary destinations and consume
     two of five precious slots.

2. **`Learn` branch is a catch-all.** Dictionary, Kanji, Grammar, Search, Saved,
   News, Magazine, Career, Exam, Scenarios all hang off `/learn`. This breaks
   active-tab semantics (looking up a kanji highlights "Learn") and makes the
   information architecture unscalable.

3. **No `Me` hub.** Profile is reachable two ways (`/profile` under Home and
   `/settings` under its own tab) rendering the **same** `ProfilePage`.
   Billing (`subscription`) is nested under `/profile`. There is no single
   account hub that aggregates Profile + Progress detail + Billing + Settings +
   About + Logout.

4. **Duplicate screen across two routes.** `ProfilePage` is mounted at both
   `/profile` and `/settings` — redundant and confusing for back behavior.

5. **Search lookup tools split from Search.** Dictionary / Kanji / Grammar are
   sibling routes under Learn, not grouped under a Search hub, so there is no
   single "lookup" surface.

6. **Visual shell is functional but not premium.** `NavigationBar` uses palette
   colors but no elevation/scrim tuning, no adaptive `NavigationRail` for
   tablet/large width, and labels are always-shown defaults. No medium/expanded
   breakpoint handling.

## What is already correct (preserve)

- Fullscreen focus flows (Practice, Flashcard Review, Scenario, Exam, Career
  chapter) are already outside the shell — **do not regress**.
- Review owns flashcards (deck list highlights Review) — keep this ownership.
- `ReviewHubPage` counts come from live providers (no fabricated data).
- Theme-aware colors via `AppPalette` / `context.palette`.
- l10n keys exist for all current nav labels in both `vi` and `ja`.

## Existing test coverage (must keep green)

- `app_shell_test.dart`: shell shows 5 destinations on Home; tab switching swaps
  branch screens (asserts labels `Học`, `Ôn tập`, `Tiến độ`, `Trang chủ`).
- `navigation_test.dart`: Review → Flashcards keeps Review active; Home →
  Flashcards does not highlight Home; sign-out from Settings shows signing-out
  state then lands on Login.

> These tests reference the **old** tab set (notably `Tiến độ`/Progress and the
> Settings sign-out path). They will need updating in Batch 6 once the tab set
> changes to Home / Learn / Review / Search / Me.
