# Home — Retest Prompt for Codex

Paste this prompt to Codex (or any runtime QA agent) to validate the mobile Home
dashboard on a real device/emulator. **Runtime verification only — do not modify
code unless explicitly asked.**

---

## Mission

Validate the NihonGo BJT **mobile Home dashboard** (`apps/mobile`) at runtime and
confirm it has learner-facing functional parity with the web Home, using a
mobile-native UI. Report findings; do not change code unless the requester
explicitly asks for a fix.

## Setup

1. Start backend services (Postgres/Meilisearch/etc. run in WSL; app servers on
   Windows). Ensure the API is reachable at the configured base URL.
2. Launch the mobile app on an Android emulator (e.g. Pixel, 390 dp) and an
   iOS simulator if available:
   ```bash
   cd apps/mobile
   flutter devices
   flutter run
   ```
3. **Log in with a local/test account at runtime only.** Do not hardcode or
   commit any credentials. If no account exists, register one through the app UI.

## What to test

### Home — visual & functional

1. Hero: greeting matches the device clock time bucket; primary CTA and exam CTA
   both navigate. Switch the device locale vi↔ja and confirm the greeting and all
   labels localize.
2. Today: daily lesson card renders real content and opens the lesson detail.
3. Review & progress: flashcard metrics, progress mini, and sync card show only
   real values. Confirm no fabricated streak/xp/due counts.
4. Every shortcut (Core / Library / Content) navigates to its real screen:
   Learn, Exam, Review, Progress, Dictionary, Search, Kanji, Grammar, Saved,
   Subscription, Scenarios, News, Magazine, Career, Rewards.
5. States: trigger loading (cold start), empty (account with no decks), and
   backend-unreachable (stop API) — confirm skeleton, honest empty state, and
   unavailable cards with retry. Home must not look broken when one source fails.
6. Pull-to-refresh reloads the dashboard.

### Layout

7. Verify at 360–390 dp and on a tablet width: no horizontal overflow, body
   width capped, touch targets ≥ 44 dp.
8. Toggle dark mode: confirm contrast and no rendering exceptions.
9. Enter long Japanese/Vietnamese text scenarios: confirm wrapping/ellipsis.

### Compare with web Home

10. Open the web Home (`apps/web`) side by side. Confirm each web learner
    function either exists on mobile (as CTA/card/shortcut) or is intentionally
    absent per `docs/mobile/HOME_WEB_PARITY_AUDIT.md` (web-only engagement
    widgets such as battle, companion, xp, standup, daily-radar, loto,
    mystery-box, focus-timer have no mobile route and are expected to be absent).
    Flag any *unexpected* missing learner function.

## Deliverables

- Capture screenshots: Home populated (light + dark), 360 dp, tablet, empty
  state, backend-unreachable state, vi and ja locales.
- Update the QA report at `artifacts/mobile-home-retest/` (or the project's QA
  report location) with pass/fail per checklist item and screenshot references.
- List any dead card, fake count, overflow, or navigation gap with steps to
  reproduce.

## Rules

- Do not modify application code unless explicitly asked.
- Do not commit credentials or runtime tokens.
- Use `docs/mobile/HOME_RETEST_CHECKLIST.md` as the pass/fail matrix.
