# Home — Implementation Plan

Current state: `apps/mobile/lib/features/home/*` is already a production-grade
Learning Dashboard with hero CTA, daily lesson, flashcard/progress/sync
sections, three shortcut groups, and full loading/empty/error/partial states
plus a comprehensive widget-test suite
(`apps/mobile/test/features/home/home_page_test.dart`).

Per the parity audit, all mobile-available web functions are already wired with
no dead cards. This plan therefore applies **surgical** improvements only — it
does not rebuild a working screen.

## Batch 1 — Data foundation (verify, don't rewrite)

- `homeDashboardProvider` already loads each section independently with
  `AsyncValue.guard`, real repositories, and partial-failure tolerance.
- Action: confirm no fabricated values; keep as-is. Add the greeting input
  (pure, device-clock derived) — no new data source required.

## Batch 2 — Mobile-native layout (targeted change)

- Add a **time-of-day greeting** to `_HeroCard`:
  - New l10n keys `homeGreetingMorning/Afternoon/Evening/Night` (vi + ja).
  - Pure helper `homeGreetingForHour(int hour, AppLocalizations)` selecting the
    bucket (05–10 morning, 11–16 afternoon, 17–21 evening, else night).
  - Replace the static `homeWelcome` label with the greeting; keep the existing
    hero title/body/CTAs unchanged.
- Everything else (sections, shortcuts, states) already meets the required
  layout; no structural change.

## Batch 3 — Navigation parity (verify)

- Every shortcut already uses a real `Routes.*` name and the test
  `shortcut cards navigate to real named routes` proves wiring. No dead cards.
- Action: re-confirm after the hero edit; no new routes needed.

## Batch 4 — UI/UX polish (verify + greeting integration)

- Greeting must not overflow at 320–390 dp or in ja; reuse existing wrap/ellipsis
  patterns. Verify dark mode + tablet cap unaffected.

## Batch 5 — Retest docs

- Author `HOME_RETEST_CHECKLIST.md`, `HOME_RETEST_PROMPT_FOR_CODEX.md`,
  `MOBILE_KNOWN_LIMITATIONS.md`, `MOBILE_MANUAL_QA_CHECKLIST.md`.

## Tests to add/update

- New: hero renders a time-of-day greeting (inject a fixed clock / assert one of
  the four localized greetings is present, static "ようこそ" gone).
- Keep all existing Home tests green.

## Verification

```bash
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
git diff --check
cd apps/mobile && flutter build apk --debug   # if toolchain available
```

## Explicitly NOT in scope (documented blockers)

Battle, daily-standup, companion, xp/rank, study-goal, login-bonus, daily-radar,
loto, mystery-box, revenge-mode, focus-timer, ambient-mode, learning heatmap,
weekly-report, seasonal banner — no mobile feature/route/API client exists. See
`HOME_WEB_PARITY_AUDIT.md` and `MOBILE_KNOWN_LIMITATIONS.md`.
