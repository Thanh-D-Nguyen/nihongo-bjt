---
name: bjt-mobile-home-dashboard
description: Implement, audit, or polish the Nihongo BJT Flutter mobile Home dashboard with functional (not layout) parity to the web Home. Use when building the mobile Home hub — greeting, primary learning CTA, practice/exam/review entries, progress summary, reference shortcuts, and engagement sections — with real data and honest empty states.
---

# BJT Mobile Home Dashboard Skill

Use this skill when implementing, auditing, or polishing the mobile Home dashboard for the Nihongo BJT app.

## Goal

Build a production-grade mobile Home dashboard that has functional parity with the web Home/dashboard where appropriate, while using a mobile-native UI/UX.

The mobile Home must:

* expose the same important learner-facing functions as web
* preserve web brand identity and product tone
* avoid cloning desktop layout
* prioritize mobile usability
* guide the user clearly into the next best learning action
* be beautiful, calm, modern, and production-ready
* support Japanese and Vietnamese content beautifully

## Core principle

Web parity means functional parity, not layout parity.

Do:

* keep the same product meaning, feature access, naming, and hierarchy
* adapt cards, sections, navigation, and density for mobile
* use strong primary CTA and progressive disclosure
* group secondary features logically

Do not:

* copy web grid layout directly
* put every web card at the same visual priority
* overload Home with too many competing CTAs
* show fake statistics
* show fake progress/streaks/billing/battle data
* create dead buttons
* make the dashboard look like a demo

## Hard rules

* Do not fake data.
* Do not invent API responses.
* Do not mark a feature as deferred unless API/client/model was searched and blocker was documented.
* If web has API and mobile can call it, wire it.
* If API exists but runtime backend is down, implement against the real contract and document runtime verification as blocked.
* If a Home card links to a feature, the route must exist or the unavailable state must be honest.
* No dead cards.
* No fake counts.
* No fake streaks.
* No fake premium status.
* No fake battle ranking.
* No fake “recent activity”.
* Keep Vietnamese and Japanese localization in sync.
* Support light mode and dark mode.
* Support 360–390 dp width.
* Support tablet width cap.
* Avoid horizontal overflow.
* Add/update tests.

## Required audit before coding

Before changing code, inspect:

### Web

* web Home/dashboard route
* web dashboard components
* web dashboard cards/widgets
* web navigation/menu
* web feature entry points
* API hooks/services used by web Home
* data models/types
* loading/empty/error behavior
* web visual hierarchy
* web copy and labels

### Mobile

* mobile Home page
* mobile router/AppShell
* mobile shared widgets
* mobile theme/tokens
* mobile l10n
* mobile Home provider/repository
* mobile tests
* existing feature routes

Create or update:

* `docs/mobile/HOME_WEB_PARITY_AUDIT.md`
* `docs/mobile/HOME_MOBILE_UX_DECISION.md`
* `docs/mobile/HOME_IMPLEMENTATION_PLAN.md`

## Web parity matrix

For every web Home/dashboard function, document:

* Web component/file
* Web route/action
* API/client/model
* Mobile equivalent
* Mobile status:

  * Done
  * Partial
  * Missing
  * Not suitable for Home
  * Requires backend runtime verification
* Mobile UX decision:

  * Primary CTA
  * Secondary card
  * Shortcut
  * Section item
  * Hidden behind “More”
  * Not applicable
* Priority:

  * P0: essential next-learning action
  * P1: important learner dashboard function
  * P2: useful shortcut
  * P3: optional/polish
* Test plan

## Required Home sections

Implement only if supported by real data/API or honest state:

1. Hero / Greeting

* user greeting
* clear learning context
* no fake personalization

2. Primary Learning CTA

* daily lesson
* continue learning
* next recommended action
* should be the clearest action on Home

3. Practice / Exam Entry

* BJT practice
* exam mode if web/API supports it
* focused entry, not cluttered

4. Review / SRS

* mistakes
* saved review
* flashcards
* SRS due items if real data exists

5. Progress Summary

* real/local/API-backed progress only
* no fake streaks or fake analytics
* honest empty state

6. Reference Shortcuts

* Dictionary
* Kanji
* Grammar
* Search
* Saved items

7. Content / Reading

* News
* Magazine
* Scenarios
* Career
* only if web Home exposes or product needs it

8. Engagement

* Gamification
* Battle
* Badges
* only if real API data exists

9. Account / Billing

* subscription/premium status only if entitlement API exists
* do not fake premium access

10. Announcements

* notification/news/announcement if web/API supports it

## Mobile UX rules

Home must be mobile-native:

* one clear primary action above the fold
* secondary actions grouped by purpose
* avoid dashboard overload
* use cards sparingly
* use horizontal sections only if they are scroll-safe and not hiding critical actions
* keep bottom navigation stable
* use full-screen routes only for focused flows like practice/exam
* support pull-to-refresh if useful and already consistent with app patterns
* show backend-unreachable state clearly
* allow partial dashboard rendering when some sections fail
* avoid making Home feel broken if one API fails

## Visual direction

* modern 2026
* premium but calm
* serious Japanese business learning tone
* visually consistent with web brand
* not black-white unfinished
* not a desktop clone
* clear hierarchy
* excellent Japanese/Vietnamese typography
* good spacing rhythm
* dark mode polished
* 360–390 dp safe
* tablet width capped

Avoid:

* noisy gradients
* unreadable glass/blur
* excessive animation
* too many badges/chips
* fake charts
* dense desktop-like grids

## Required tests

Add/update tests for:

* Home loading state
* Home populated state
* Home empty state
* Home partial-data state
* Home backend error state
* Home dark mode
* Home 360 dp width
* Home tablet width cap
* long Japanese/Vietnamese text
* every Home shortcut route
* no dead card actions
* no fake count rendering when data is absent

## Verification

After each batch run:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
git diff --check
```

If available:

```bash
cd mobile && flutter build apk --debug
```

Stop if verification is red.

## Final docs

Create/update:

* `docs/mobile/HOME_WEB_PARITY_AUDIT.md`
* `docs/mobile/HOME_MOBILE_UX_DECISION.md`
* `docs/mobile/HOME_IMPLEMENTATION_PLAN.md`
* `docs/mobile/HOME_RETEST_CHECKLIST.md`
* `docs/mobile/HOME_RETEST_PROMPT_FOR_CODEX.md`
* `docs/mobile/MOBILE_KNOWN_LIMITATIONS.md`
* `docs/mobile/MOBILE_MANUAL_QA_CHECKLIST.md`