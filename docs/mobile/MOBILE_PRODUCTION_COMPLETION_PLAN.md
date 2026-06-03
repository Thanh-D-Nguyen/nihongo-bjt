# NihonGo BJT — Mobile Production Completion Plan

Status: living document. Owner: mobile production track. Created during Batch 0.
Sequences the work to bring `apps/mobile` to production-grade learner parity
with the web product, with exit criteria and verification per batch.

Companion docs: `WEB_MOBILE_FEATURE_PARITY_MATRIX.md`,
`WEB_MOBILE_UIUX_PARITY_AUDIT.md`, `MOBILE_KNOWN_LIMITATIONS.md`,
`MOBILE_WEB_PARITY_RETEST_CHECKLIST.md`.

## Guiding constraints

- Production-first: real or clearly-labeled-preview data only. No fake
  analytics/progress, no fake backend integration, no frontend-only paywalls.
- Reviewable per batch. `flutter analyze` + `flutter test` must be green after
  every batch; `flutter build apk --debug` when an Android SDK with
  platforms/build-tools is available (the Windows host SDK currently lacks
  them — see `MOBILE_KNOWN_LIMITATIONS.md`).
- Web breadth features that need an unwired backend contract are deferred to
  explicit, contract-first batches with honest preview/empty states — not
  stubbed with fake data.

## Verification commands (every batch)

```
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
cd apps/mobile && flutter build apk --debug   # when Android SDK is complete
git diff --check
```

---

## Batch 0 — Parity audit (this batch)

- **Scope:** Produce `WEB_MOBILE_FEATURE_PARITY_MATRIX.md`,
  `WEB_MOBILE_UIUX_PARITY_AUDIT.md`, this plan.
- **Exit criteria:** Three docs committed; parity status, data dependencies and
  priorities recorded; safe vs backend-blocked work separated.
- **Risk:** Low (docs only).

## Batch 1 — Fix known mobile quality limitations (code-verifiable)

- **Scope:**
  - Fix `LoginPage` horizontal overflow at ≤390 dp (logo row shrink/wrap).
  - Audit login for keyboard behavior, SafeArea, scrollability, long
    vi/ja labels, dark mode.
  - Cap `HomePage` width on tablets (was raw `Scaffold`; adopt the shared
    width-capped scaffold pattern) — known limitation §5.
  - Add narrow-width + tablet rendering tests.
- **Out of scope:** auth security, credential storage (unchanged); device-only
  limitations that cannot be verified here.
- **Exit criteria:** No render-overflow at 360/375/390 dp on login & home;
  analyze + test green; new tests cover narrow login + home width cap.
- **Manual QA impact:** Re-test login on a 360–390 dp device; confirm tablet
  home width cap.
- **Risk:** Low.

## Batch 2 — Core learning flow parity (preview-backed)

- **Scope:** Polish Learn → Lesson → Practice → Result to full mobile quality;
  confirm continue/retry/review actions; ensure honest
  empty/loading/error/offline states and vi/ja localization; preserve
  full-screen Practice (no bottom nav). No new backend.
- **Backend-blocked (deferred, documented):** real BJT timed exam mode, server
  scoring, attempt history, lesson-progress persistence.
- **Exit criteria:** Flow verified end-to-end on preview data; tests for key
  transitions; analyze + test green.
- **Risk:** Low–Medium.

## Batch 3 — Review & flashcard/SRS parity

- **Scope:** Polish Review hub + deck list + SRS review; honest empty states;
  correct active-tab behavior; dark mode + long-text polish; tests.
- **Backend-blocked (deferred):** server-side due counts, cross-device SRS sync,
  saved/bookmarks.
- **Exit criteria:** Review surfaces verified; no fabricated counts; analyze +
  test green.
- **Risk:** Low.

## Batch 4 — Progress / analytics parity

- **Scope:** Polish Progress (device-local real stats) visuals to the web
  language; keep empty state useful; tests.
- **Backend-blocked (deferred):** server analytics, heatmap, weekly report,
  cross-device study log. Document the data contract; show honest
  empty/preview.
- **Exit criteria:** No fake streaks/analytics; analyze + test green.
- **Risk:** Low.

## Batch 5 — Settings / profile / account parity

- **Scope:** Confirm account info, language setting, furigana, clean logout,
  app version/build info, and a lightweight Help/About/legal entry (static or
  linking out). Consider an explicit theme toggle if feasible.
- **Out of scope:** anything leaking credentials or breaking the auth redirect.
- **Exit criteria:** Settings verified; logout clean; analyze + test green.
- **Risk:** Low.

## Batch 6 — Mobile UI/UX production polish

- **Scope:** Whole-app polish per `MOBILE_SCREEN_CHECKLIST.md` and the UI/UX
  audit: visual hierarchy, card density, spacing rhythm, button hierarchy, CTA
  placement, ja/vi typography, long-text readability, state quality, dark mode,
  small-screen layout, touch targets, navigation clarity. No noisy gradients,
  no unreadable glass, no over-animation.
- **Exit criteria:** Narrow-width + dark-mode + route smoke tests added/updated;
  analyze + test green.
- **Risk:** Medium (broad surface) — keep diffs surgical and per-screen.

## Batch 7 — Final parity & QA docs

- **Scope:** Refresh the matrix, UI/UX audit, this plan, known limitations,
  manual + emulator checklists; create `MOBILE_WEB_PARITY_RETEST_CHECKLIST.md`.
- **Exit criteria:** Docs current; final verification run; ready-for-retest
  statement (no false "device QA passed" claim).
- **Risk:** Low.

---

## Deferred (backend-contract-first) features

These are real web features with high learner value that are **intentionally
not implemented yet** on mobile because they require a backend contract the app
does not call. Each becomes its own contract-first batch:

| Feature | Needed contract | Mobile priority |
| --- | --- | --- |
| Dictionary browser | `/api/dictionary/*` | P1 |
| Kanji browser | `/api/kanji/*` | P1 |
| Grammar reference | `/api/grammar/*` | P1 |
| BJT exam mode (timed, scored, history) | `/api/quiz/*` | P1 |
| NHK news reader | `/api/nhk-news` | P2 |
| Magazine feed | `/api/magazine` | P2 |
| Scenarios trainer | `/api/scenarios/*` | P2 |
| Global search | `/api/vija/search` | P2 |
| Saved / bookmarks | `/api/bookmarks` | P2 |
| Server analytics (heatmap/weekly) | `/api/analytics/*` | P2 |
| Gamification (badges/XP/streak) | `/api/gamification/*` | P2 |
| Onboarding diagnostic | `/api/recommendation/onboarding/*` | P2 |
| Pricing / entitlements | billing APIs | P2 |
| Battle / Career | realtime + `/api/career`,`/api/story` | P3 |

Until consumed, the matrix marks these **Missing** with an honest
preview/empty/"coming soon" entry where a learner might look for them — never
fake data.

---

## Completion log (production-readiness pass)

Honest record of what this pass actually changed and verified. No device QA is
claimed — APK/emulator run is blocked on this Windows host (Android SDK at
`C:\Android\sdk` lacks platforms/build-tools, see known-limitations §6).

| Batch | Outcome | Verification |
| --- | --- | --- |
| 0 — Parity audit | Created feature-parity matrix, UI/UX audit, this plan. | Docs reviewed. |
| 1 — Login/Home layout | Fixed login wordmark overflow at ≤390 dp (FittedBox + space-between); capped Home body width at 640 on tablets. | `flutter analyze` clean; added `login_page_test.dart` (320/360/375/390 dp + dark + ja) and Home wide-tablet test. |
| 2 — Core learning flow | Reviewed Learn → Lesson → Practice → Result: already production-quality (all states, honest preview badging, tokens, ja readability, full-screen practice). Fixed a stale doc comment that under-claimed the shipped per-question review. | Full suite green. |
| 3 / 4 — Review/SRS + Progress | Audited Review hub, flashcard deck list, flashcard SRS review, and Progress: production-quality — real data only (no fabricated analytics), full state coverage, dark-mode safe, i18n complete. No code changes warranted. | Subagent audit + existing tests green. |
| 5 — Profile/About | Added an **About** section showing the **real** platform app version + build number via `package_info_plus` (no hardcoded version). New i18n keys (vi/ja). | Added About test; full suite green. |
| 6 — UI/UX polish | Verified whole-app state/dark-mode/narrow-width coverage via existing QA tests (`long_text_overflow_test`, navigation, login). No new defects found. | `flutter analyze` clean; `flutter test` green. |
| 7 — Docs | This log; created `MOBILE_WEB_PARITY_RETEST_CHECKLIST.md`; whitespace gate fixed. | `git diff --check` clean. |

**What was intentionally NOT done:** breadth web features needing backend
contracts the mobile app does not call (dictionary, kanji, grammar, BJT exam
mode, news, magazine, scenarios, search, saved, gamification, billing, battle,
career). These remain honestly marked Missing/Deferred — never faked.
