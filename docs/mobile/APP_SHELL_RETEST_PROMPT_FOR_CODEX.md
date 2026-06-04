# App Shell Retest Prompt (for Codex / on-device agent)

Paste this to a coding agent that **has a running Android/iOS emulator or a
physical device** to retest the 2026 app shell + navigation redesign. The work
is code-complete and passes `flutter analyze` + `flutter test`, but was **not**
visually verified on a device here.

---

## Context

The mobile app shell (`apps/mobile`) was rebuilt to **5 compact destinations**:

| Index | Tab (vi / ja)        | Branch root        | Owns                                            |
|-------|----------------------|--------------------|-------------------------------------------------|
| 0     | Trang chủ / ホーム    | `/`                | Home                                            |
| 1     | Học / 学習            | `/learn`           | Lessons, scenarios, exam, news, magazine, career, rewards |
| 2     | Ôn tập / 復習         | `/review`          | Review hub, flashcards                          |
| 3     | Tra cứu / 検索        | `/search`          | Global search + Dictionary, Kanji, Grammar, Saved |
| 4     | Cá nhân / マイ        | `/me`              | Profile, progress, subscription, settings, about |

Adaptive: phones (<600 dp) use a Material 3 `NavigationBar`; tablets (≥600 dp)
use a `NavigationRail` (extended ≥900 dp). Fullscreen flows (Practice, Flashcard
review, Scenario, Exam, Career chapter) render **outside** the shell — no bottom
nav. Legacy paths redirect via `_legacyPathRedirect` in
[apps/mobile/lib/app/router.dart](apps/mobile/lib/app/router.dart).

Key files:
- [apps/mobile/lib/app/shell/app_shell.dart](apps/mobile/lib/app/shell/app_shell.dart)
- [apps/mobile/lib/app/shell/app_destination.dart](apps/mobile/lib/app/shell/app_destination.dart)
- [apps/mobile/lib/app/router.dart](apps/mobile/lib/app/router.dart)
- [apps/mobile/lib/features/search/presentation/search_page.dart](apps/mobile/lib/features/search/presentation/search_page.dart)
- [apps/mobile/lib/features/settings/presentation/profile_page.dart](apps/mobile/lib/features/settings/presentation/profile_page.dart)

## Your task

1. Launch the app on a device/emulator in both **light and dark** and both
   **Vietnamese and Japanese**.
2. Work through every item in
   [docs/mobile/APP_SHELL_RETEST_CHECKLIST.md](docs/mobile/APP_SHELL_RETEST_CHECKLIST.md).
   Capture a screenshot for each tab, the Search hub, the Me hub, one fullscreen
   flow (Practice or Flashcard review), and the tablet rail.
3. For every legacy redirect in the checklist, deep-link the old path and confirm
   the correct destination + active tab.
4. Verify fullscreen flows have **no** bottom navigation and that system back
   returns to the launching tab with that tab still highlighted.
5. Report results as PASS/FAIL per checklist item with screenshot evidence. For
   any FAIL, give the exact screen, repro steps, expected vs actual, and a
   minimal proposed fix. **Do not** claim a pass without observing it.

## Verification commands (run before reporting)

```bash
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
cd apps/mobile && flutter test integration_test   # needs a connected device
cd apps/mobile && flutter build apk --debug        # if a full Android SDK exists
```

Update [docs/mobile/MOBILE_KNOWN_LIMITATIONS.md](docs/mobile/MOBILE_KNOWN_LIMITATIONS.md)
(§6b) with anything you confirm or newly discover. Keep limitations honest — no
faked passes.
