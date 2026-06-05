---
name: bjt-mobile-app-shell-navigation
description: Design, implement, audit, or polish the Nihongo BJT Flutter mobile app shell — bottom navigation, adaptive rails, the 5 primary tabs (Home/Learn/Review/Search/Me), full-screen focus routes, and active-tab mapping for nested routes. Use when working on the global mobile navigation structure, tab shell, or routing behavior in apps/mobile.
---

# BJT Mobile App Shell & Navigation Skill

Use this skill when designing, implementing, auditing, or polishing the global mobile app shell, navigation structure, tabs, rails, focused routes, and cross-screen navigation behavior for the Nihongo BJT app.

## Goal

Create a production-grade app shell that is:
- mobile-native
- visually premium
- consistent with the web brand
- scalable for many BJT features
- safe for focused learning flows
- adaptive for phone/tablet
- clear and not cluttered

## Core principle

The app has many features, but the bottom navigation must not contain every feature.

Use:
- Home as dashboard/hub
- Learn for structured learning
- Review for SRS/review/flashcards
- Search for dictionary/kanji/grammar lookup
- Me/Profile for account/settings/progress/billing

## Recommended compact phone navigation

Preferred bottom destinations:
1. Home
2. Learn
3. Review
4. Search
5. Me

Avoid putting Progress and Settings as top-level bottom tabs unless product research proves they are daily primary destinations.

## Adaptive navigation

For compact width:
- use bottom NavigationBar

For medium/large width:
- use NavigationRail or side navigation
- keep content width capped
- avoid stretching dashboard cards edge-to-edge

For focused flows:
- hide bottom navigation
- use fullscreen route
- provide clear back/close behavior

Focused flows include:
- Practice / Question Player
- Exam mode
- Flashcard Review
- Battle session
- Long create/edit forms if bottom nav causes keyboard/CTA issues

## Hard rules

- Do not create more than 5 bottom destinations.
- Do not put action buttons in bottom navigation.
- Do not create dead tabs.
- Do not break active tab highlighting.
- Do not show Home highlighted for Review-owned routes.
- Do not reintroduce bottom nav into Practice/Flashcard Review if it causes CTA/tap conflicts.
- Do not clone desktop web navigation.
- Keep web feature parity through Home/Search/More hubs, not through too many tabs.
- Keep Vietnamese and Japanese labels short and localized.
- Add/update route tests.
- Add/update narrow-width and tablet tests.
- Do not claim device QA unless actually tested.

## Required audit before coding

Inspect:
- current mobile router
- AppShell
- all routes
- web navigation/sidebar/header
- web home/dashboard
- mobile feature list
- bottom nav labels
- deep links if any
- tests that assert navigation behavior

Create/update:
- docs/mobile/APP_SHELL_NAVIGATION_AUDIT.md
- docs/mobile/APP_SHELL_NAVIGATION_DECISION.md
- docs/mobile/APP_SHELL_MIGRATION_PLAN.md

## Required implementation

Implement or polish:
- bottom NavigationBar with correct primary destinations
- adaptive NavigationRail for larger width if feasible
- Home hub for broad web feature access
- Search hub for dictionary/kanji/grammar/search
- Me/Profile hub for progress/settings/billing/account
- fullscreen routes for focused flows
- correct active tab mapping for nested routes
- consistent top app bar behavior
- correct back behavior
- route smoke tests
- dark mode
- 360–390 dp safe
- tablet layout safe

## Tests required

Add/update tests for:
- each bottom destination renders
- each nested route highlights correct tab
- Practice route has no bottom nav
- Exam route has no bottom nav
- Flashcard Review route has no bottom nav
- Review → Flashcards keeps Review active
- Search routes keep Search active
- Profile/Settings/Billing keep Me active
- logout redirect remains clean
- 360 dp layout does not overflow
- tablet layout uses appropriate adaptive shell if implemented

## Verification

After each batch:
- cd mobile && flutter analyze
- cd mobile && flutter test
- git diff --check

If available:
- cd mobile && flutter build apk --debug