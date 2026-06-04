# App Shell Migration Plan (Mobile)

> Batch 0 execution plan for migrating the mobile app shell from
> Home / Learn / Review / Progress / Settings to
> **Home / Learn / Review / Search / Me**. Sequenced, verifiable batches.
> Run `flutter analyze` + `flutter test` after every batch; stop on red.

## Guiding constraints

- ≤ 5 bottom destinations. No dead tabs/cards. No fabricated data.
- Do not regress fullscreen focus flows (Practice, Exam, Flashcard Review,
  Scenario, Career chapter).
- l10n keys added to **both** `app_vi.arb` and `app_ja.arb`, then regenerate.
- Reuse shared widgets (`AppScaffold`, `AppCard`, state views). Files ≤ ~600 lines.
- No device-QA claims without real testing.

## Batch 1 — New AppShell visual design

Goal: premium, calm Material 3 shell; light/dark; 360–390 dp safe; tablet rail.

- Rework [app_shell.dart](../../apps/mobile/lib/app/shell/app_shell.dart):
  - Material 3 `NavigationBar`, tuned indicator/elevation/scrim via `AppPalette`.
  - Consistent outline/filled icon pairs and labels for 5 destinations.
  - Compact → `NavigationBar`; ≥ 600 dp → `NavigationRail` (adaptive), content
    width capped, same `navigationShell`.
  - `SafeArea`, `MediaQuery.textScaler` respected, 48 dp touch targets.
- No route changes yet (still 5 old branches) — purely visual + adaptive scaffold.
- Verify: analyze + existing tests green (labels unchanged this batch).

## Batch 2 — Migrate top-level destinations

Goal: switch the 5 branches to Home / Learn / Review / Search / Me.

- Add branches **Search** (`/search`) and **Me** (`/me`); remove standalone
  Progress and Settings branches from the bottom set.
- Add l10n: `navSearch` (Tra cứu / 検索), `navMe` (Cá nhân / マイ).
- Update `app_shell.dart` destinations to the new 5 (icons/labels).
- Keep old route paths temporarily redirecting where needed to avoid dead links.
- Verify: analyze; update minimal smoke tests so suite stays green (full test
  rewrite happens in Batch 6).

## Batch 3 — Search hub

Goal: `/search` becomes the lookup hub.

- `SearchPage` (global search) becomes the Search branch root, plus hub entries
  to Dictionary / Kanji / Grammar / Saved (if supported).
- Move route definitions for `dictionary`(+`:id`), `kanji`(+`:id`),
  `grammar`(+`:id`), `saved` from the Learn branch into the Search branch.
- Update all `goNamed/pushNamed` call sites and any deep paths (`/learn/dictionary`
  → `/search/dictionary`, etc.).
- No dead actions: only surface entries that have real backing data.
- Verify: analyze + tests.

## Batch 4 — Me / Profile hub

Goal: `/me` aggregates account surfaces.

- `MeHubPage` (new) as Me branch root: Profile summary, Progress detail entry,
  Billing/subscription entry, Settings entry, About, Logout.
- Re-home routes: `progress` → `/me/progress`; `subscription` → `/me/subscription`;
  `settings` → `/me/settings`; profile content merged into Me hub.
- Remove the duplicate `ProfilePage` mount (was both `/profile` and `/settings`).
- Move Home app-bar profile action to navigate into Me hub (`goNamed(me)`).
- Add Home "Progress" summary card linking to `/me/progress`.
- Verify: analyze + tests; sign-out path now flows from Me hub.

## Batch 5 — Route ownership & active-tab mapping

Goal: nested routes highlight the correct tab.

- Review-owned flashcards → Review active.
- Search-owned dictionary/kanji/grammar/saved → Search active.
- Me-owned progress/billing/settings/about → Me active.
- Learn-owned news/magazine/career/exam/scenarios → Learn active.
- Confirm fullscreen routes (`/practice`, `/exam`, `/flashcards/:id/review`,
  `/scenarios/:id`, `/career/chapters/:id`) render **no** bottom nav.
- Verify: analyze + tests.

## Batch 6 — Tests

Add/update in `apps/mobile/test/app/`:

- Route smoke: each of 5 destinations renders.
- Active tab: nested route → correct tab highlighted (Review/Search/Me/Learn).
- Fullscreen: Practice / Exam / Flashcard Review have no `NavigationBar`.
- Narrow width: 360 dp layout does not overflow.
- Dark mode: shell renders in dark theme without exceptions.
- Adaptive: ≥ 600 dp uses `NavigationRail` (if implemented).
- Update legacy `app_shell_test.dart` / `navigation_test.dart` for the new tab set.
- Optional: widget preview + integration test per requested Flutter skills.
- Verify: analyze + full test suite green.

## Batch 7 — Docs

- Update [MOBILE_KNOWN_LIMITATIONS.md](MOBILE_KNOWN_LIMITATIONS.md).
- Update [MOBILE_MANUAL_QA_CHECKLIST.md](MOBILE_MANUAL_QA_CHECKLIST.md).
- Create `APP_SHELL_RETEST_CHECKLIST.md`.
- Create `APP_SHELL_RETEST_PROMPT_FOR_CODEX.md`.

## Final verification

```
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
git diff --check
cd apps/mobile && flutter build apk --debug   # if Android toolchain available
```

## Risk register

| Risk | Mitigation |
| --- | --- |
| Deep-link/path changes break saved links | Keep redirects for moved paths during transition |
| Active-tab regressions | Dedicated Batch 5 + Batch 6 active-tab tests |
| Duplicate ProfilePage removal breaks sign-out test | Update navigation_test for Me hub path |
| Tablet rail scope creep | Implement only if low-risk; gate behind width check |
| l10n drift (missing JA/VI) | Add keys to both ARBs before regenerating |
