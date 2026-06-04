# Mobile UI/UX Final Retest Checklist (device / emulator)

> Use this after the skills-driven UI/UX production polish pass. It verifies the
> polished Flutter mobile app (`apps/mobile`) on a real device or emulator.
> Automated `flutter analyze` / `flutter test` are already green in CI; this
> checklist covers what only a human-in-the-loop visual pass can confirm.

## Environment

- Device/emulator: __________ (model, OS version)
- Screen widths to test: **360 dp**, **390 dp**, and a tablet/foldable if available.
- Themes: **light** and **dark** (toggle the OS theme).
- Locale: **vi** (default) and **ja**.
- Backend: start local API + Keycloak if available; otherwise note API-down behavior.

## Guardrails

- Login with the local test account **at runtime only**. Never store credentials
  in code, docs, screenshots, or terminal history.
- Do not modify code unless explicitly asked.
- Do not file web-only surfaces (e.g. **Battle**) as mobile bugs — they are
  intentionally out of scope on mobile.
- Do not claim live data passed if local API/Keycloak were not running.

## Pre-flight (host)

- [ ] `cd apps/mobile && flutter analyze` → No issues found.
- [ ] `cd apps/mobile && flutter test` → all green (305+).
- [ ] `cd apps/mobile && flutter test integration_test` on a connected device → green.
- [ ] `cd apps/mobile && flutter build apk --debug` succeeds (if toolchain allows).

## Per-screen visual pass

For every row: check light + dark, 360/390 dp, vi + ja, and that loading /
empty / error states render (where reachable).

| Area | Screen(s) | Light | Dark | 360 | 390 | vi | ja | States | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | Login, Register | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | live field validation; keyboard never clips fields |
| Auth | Sign-out | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | spinner shown; lands on Login; **no raw Keycloak page** |
| Home | Dashboard + shortcuts | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | shortcut grid: no overflow with long ja labels |
| Learn | Learn hub | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | lesson cards + reference tools |
| Learn | Lesson detail | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | furigana / reading; long sections wrap |
| Practice | Question player | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | full-screen (no bottom nav); option tiles ≥48 dp |
| Practice | Result / explanation | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | verdict tags + explanations readable |
| Review | Review hub | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | flashcards + practice cards |
| Flashcards | Deck list | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| Flashcards | Review (reveal + grade) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 4 rating buttons fit at 320–360 dp |
| Reference | Dictionary, Kanji, Grammar | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | hero kanji glyph sizing intentional |
| Reference | Search, Saved | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | keyboard safety on search |
| Content | News, Magazine, Scenarios | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | scenario player full-screen |
| Career | Chapter run, NPC, skill bars | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | NPC tint + skill progress |
| Exam | Browser, player, result | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | score ring; full-screen player |
| Gamification | Rewards (streaks/achievements/leaderboards) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | real figures only |
| Billing | Subscription / plan cards | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | current plan + recommended badge |
| Settings | Profile | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | version info; sign-out |

## Cross-cutting checks

- [ ] No `RenderFlex overflowed` banners anywhere (watch the debug console).
- [ ] Touch targets ≥ 48 dp on all interactive controls.
- [ ] Safe-area respected on notched devices (status bar + home indicator).
- [ ] `prefers-reduced-motion` / OS "reduce motion" honored (no jarring animation).
- [ ] Bottom nav never overlaps a sticky CTA (practice/flashcard/scenario/exam/
      career run full-screen outside the shell — confirm).
- [ ] Dark mode: no dark-on-dark or low-contrast text (WCAG AA).
- [ ] Large text scale (OS font size max) does not clip critical labels.

## Report

After testing, record:

- Environment (device, OS, widths, themes, locales, backend state).
- Login result (runtime only).
- Screenshots per area.
- Pass/fail table with severity + repro steps for any issue.
- Whether runtime API/Keycloak verification was blocked.
