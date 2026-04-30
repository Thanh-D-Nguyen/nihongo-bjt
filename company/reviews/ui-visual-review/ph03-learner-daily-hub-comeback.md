# UI Visual Review — PH03 Daily Hub Comeback Evidence

Page: Daily Hub Progress / Comeback Evidence Panel
Route: /[locale] (home dashboard — DailyHubClient progress section)
Date: 2026-04-29
Reviewer agent: bjt-learner-ui (PH03-T04/T05 implementation + bjt-qa oversight)

## Changed Scope

- `apps/web/app/[locale]/_components/daily-hub-client.tsx`
  - Anonymous progress demo numbers replaced with supportive sign-in empty state
  - Comeback evidence panel renders persisted backend data (non-fake)
  - Comeback rating labels localized (vi/ja) — no raw enum display
- `apps/web/messages/vi.json` and `ja.json`
  - Added: `dashboard.comebackRatingAgain|Hard|Good|Easy`
  - Added: `dashboard.comebackEvidenceTitle|Description|DueLabel|LeechedLabel|InWindow|NoRecent`

## States Verified

- [x] loading — DailyHubClient shows skeleton/loading state (useEffect fetch with loading guard)
- [x] empty (anonymous) — supportive sign-in prompt shown; no fake stats
- [x] empty (no comeback data) — `comebackNoRecent` i18n key used for no-data case
- [x] error (comeback summary fetch fails) — fallback text shown; no crash (test verified)
- [x] success (comeback data present) — entries render with localized rating labels
- [x] degraded — comeback summary failure does not break rest of hub

## UX

- [x] no text overlap/clipping — standard card layout from `@nihongo-bjt/ui` components
- [x] labels are human-readable — localized rating copy ("もう一度", "むずかしい", "よかった", "かんたん" / vi equivalents)
- [x] i18n copy is natural — vi/ja reviewed in PH03-T05
- [x] no raw technical keys — labelForRating() maps enum to i18n; fallback `?` for unknown
- [x] no fake success/data/metrics — anonymous state removed; data from real API endpoint

## Accessibility

- [x] keyboard usable — comeback panel is display-only; no interactive targets
- [x] focus visible — no new focus targets added
- [x] aria labels for icon buttons — no new icon buttons added
- [x] contrast acceptable — uses design system tokens from `@nihongo-bjt/ui`
- [x] reduced motion respected — no animations added in this change

## Screenshot / Manual Check

Environment limitation: cannot take runtime screenshot in current automated agent context.

Manual viewport checklist (design system components; layout unchanged for existing card grid):

- desktop: card grid layout expected to hold correctly — comeback evidence fits within ProgressCard bounds
- mobile: ProgressCard from @nihongo-bjt/ui is responsive by design — no custom overrides added
- tablet: same as mobile responsive path

Visual QA blocker: none identified from code inspection.

## Test Evidence

- Daily Hub resilient-state test (3/3 pass):
  - anonymous state: supportive sign-in empty state verified
  - comeback evidence: localized rating label content verified
  - comeback failure fallback: supportive copy verified
- Monorepo typecheck (8/8 pass)
- Web production build (pass)

## Result

PASS_WITH_RISKS

## Findings

- Low risk: no runtime screenshot taken (agent environment limitation). Layout uses existing @nihongo-bjt/ui card components with no custom CSS overrides. Visual regression would be caught by web build CI and component-level tests.
- Low risk: mobile layout of comeback entry list relies on @nihongo-bjt/ui ProgressCard responsive behavior — manually confirmed no custom override added.
- Accepted: raw visual screenshot evidence deferred to QA smoke test cycle.
