# NihonGo BJT — Mobile Home Retest Checklist

Date: 2026-06-03  
Scope: Flutter Home dashboard in `apps/mobile`

## Environment Setup

- [ ] Local API is running at the configured mobile API base URL.
- [ ] Local Keycloak is running and reachable.
- [ ] Mobile app launches from `apps/mobile`.
- [ ] Login at runtime with the local account only; do not store credentials.
- [ ] Run `cd apps/mobile && flutter analyze`.
- [ ] Run `cd apps/mobile && flutter test`.
- [ ] Install/run on emulator or device with `flutter run -d <device-id>`.

## Login Prerequisite

- [ ] App opens authenticated Home after login.
- [ ] If login is blocked by Keycloak/API, document Home runtime API verification as blocked and continue visual checks with any already-authenticated session only if available.
- [ ] Do not retest full auth scope here except as needed to reach Home.

## Home Normal State

- [ ] Hero shows `NihonGo BJT` app bar, Home title, and primary CTA.
- [ ] If flashcard decks exist, primary CTA is `Ôn Flashcard` / `フラッシュカード復習`.
- [ ] If no flashcard decks exist, Home shows an honest empty state and Learn CTA.
- [ ] Today's lesson card shows a real repository lesson and preview badge when sourced from local preview content.
- [ ] Review/progress section shows only real flashcard and device-local progress values.
- [ ] No fake streak, XP, plan, rank, ad, recommendation, or due-review count is shown.

## Loading / Error / Empty

- [ ] Loading shows content-shaped skeleton blocks.
- [ ] Backend/API down shows a clear unavailable state with retry.
- [ ] Partial data still renders other Home sections.
- [ ] Empty flashcard state does not show zero values as progress.
- [ ] Pull-to-refresh retries Home data.

## Responsive / Theme

- [ ] 360-390 dp phone width: no horizontal overflow, text wraps cleanly.
- [ ] Tablet width: content is centered and capped, not stretched edge-to-edge.
- [ ] Light mode: all cards and buttons have adequate contrast.
- [ ] Dark mode: all cards, badges, skeletons, and shortcuts remain legible.
- [ ] Vietnamese text with diacritics is not clipped.
- [ ] Japanese lesson title/reading uses comfortable line height.

## Home Shortcuts

Verify every visible card has a real route and no dead button:

| Shortcut | Expected route/behavior |
| --- | --- |
| `Ôn Flashcard` hero CTA | Opens flashcard deck list under Review branch |
| `Vào BJT` | Opens BJT mock exam browser |
| Daily lesson card / `Mở bài học` | Opens lesson detail for the displayed lesson |
| `Bài học` | Opens Learn |
| `BJT mô phỏng` / exam card | Opens BJT mock exam browser |
| `Flashcards` | Opens Review hub or flashcard review entry |
| `Tiến độ` | Opens Progress |
| `Từ điển` | Opens Dictionary |
| `Tìm kiếm` | Opens Search |
| `Kanji` | Opens Kanji browser |
| `Ngữ pháp` | Opens Grammar browser |
| `Đã lưu` | Opens Saved |
| `Gói đăng ký` | Opens Subscription |
| `Business scenarios` / scenarios | Opens Scenario browser |
| `NHKニュース` / News | Opens News list |
| `Magazine` | Opens Magazine list |
| `Career` | Opens Career hub |
| `Thành tựu & Phần thưởng` | Opens Rewards hub |
| Profile icon | Opens Profile |

## Backend/API Down Behavior

- [ ] Home renders a localized unavailable state for flashcards if the API-backed flashcard source cannot load.
- [ ] Other route-backed shortcuts remain tappable.
- [ ] No raw exception, stack trace, or backend URL appears in UI.
- [ ] Retry and pull-to-refresh do not crash.

## Screenshots To Capture

- [ ] Home populated state, light mode, 360-390 dp.
- [ ] Home populated state, dark mode, 360-390 dp.
- [ ] Home tablet/foldable width.
- [ ] Home empty flashcard state if testable.
- [ ] Home backend/API unavailable state.
- [ ] Each shortcut destination first screen.

## Severity Guide

- **P0**: Home cannot load, login cannot reach Home, visible crash, data fabricated as real, or core CTA dead.
- **P1**: Shortcut navigates wrong route, backend-down state is misleading, horizontal overflow, dark mode unreadable.
- **P2**: Visual hierarchy, spacing, copy, or touch target issue that slows use but does not block.
- **P3**: Polish issue, minor animation/spacing inconsistency, screenshot-only refinement.
