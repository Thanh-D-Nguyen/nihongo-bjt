# Profile / Me Hub — Web Parity Audit

Audit of the web Profile / Account / Settings / Billing surfaces vs. the current
Flutter mobile Profile screen, to drive the mobile **Me Hub** rebuild.

> Scope: read-only audit. No code changed by this document. Evidence is cited by
> repo path. "Blocked" is only used where the repo was searched and proof is
> recorded.

## 1. Web surfaces inventory

| Web surface | Route / file | Backing API | What it shows |
|---|---|---|---|
| Profile page | `apps/web/app/[locale]/profile/_components/profile-page-client.tsx` | `GET /api/auth/me`, `PUT /api/auth/profile`, `GET /api/media/assets/:id/read-url` | Avatar + cover upload, display name, email, target BJT band, profile completion %, learning stats, achievements, share profile |
| Account info | `apps/web/app/[locale]/account/account-info-client.tsx` | `GET /api/analytics/learner?days=7`, `GET /api/daily/home` | Identity (name/email), account status, locale, learning summary (streak / reviews / accuracy / due), recent-activity insight |
| Settings hub | `apps/web/app/[locale]/settings/_components/settings-hub-client.tsx` | (nav only) + `useKeycloakAuth` | Profile quick link, nav grid → linked-accounts, notifications, appearance, reading, privacy, subscription; sign-out |
| Appearance | `apps/web/app/[locale]/settings/appearance/` | local pref | Theme (light/dark/system) |
| Reading assist | `apps/web/app/[locale]/settings/reading/` | local pref | Furigana / reading-help policy |
| Notifications | `apps/web/app/[locale]/settings/notifications/` | API | Notification preferences |
| Privacy | `apps/web/app/[locale]/settings/privacy/` | API | Privacy controls |
| Linked accounts | `apps/web/app/[locale]/settings/linked-accounts/` | API | Federated identity providers (Google etc.) |
| Subscription | `apps/web/app/[locale]/settings/subscription/_components/subscription-settings-client.tsx` | `/api/learner/monetization/*` | Plan, entitlements, quotas, manage billing |

## 2. Web learning-summary data contract

`account-info-client.tsx` reads:

- `GET /api/analytics/learner?days=7&userId=…&locale=…` →
  `{ insight, dueFlashcards, totals: { streakDays, reviewCount, bjtAccuracyPct } }`
- `GET /api/daily/home?locale=…&userId=…` → `{ dueReviews }`

`profile-page-client.tsx` reads:

- `GET /api/auth/me` → `{ profile: { id, displayName, email, status, avatarAssetId, coverAssetId, targetBjtBand } }`
- `PUT /api/auth/profile` (body: `avatarAssetId` / `coverAssetId`) → updated profile

## 3. Mobile current state

`apps/mobile/lib/features/settings/presentation/profile_page.dart`:

- Profile hero (ID-token claims: name + secondary label) — no avatar image, no plan badge, no learner level.
- Identity details card (display name, username, email, privacy notice).
- Action grid → Progress, Saved, Subscription.
- Preferences: language, furigana, haptics.
- About: real app version/build (`package_info_plus`).
- Sign-out button + signing-out state.

Existing real mobile providers available for wiring:

- `billingRepositoryProvider` / `subscriptionProvider` →
  `apps/mobile/lib/features/billing/presentation/billing_providers.dart`
  (`GET /api/learner/monetization/subscription`).
- `studySummaryProvider` →
  `apps/mobile/lib/features/progress/presentation/progress_providers.dart`
  (device-local study log; honest, never fabricated).
- `appPackageInfoProvider` → real version/build.
- `profileClaimsProvider` → ID-token claims.

## 4. Parity matrix

For each web feature: mobile status + decision + priority + risk + tests.

| # | Web feature | Mobile status | Decision | Priority | Risk | Tests |
|---|---|---|---|---|---|---|
| 1 | Identity (name / email / username) | Implemented (claims) | Keep, surface in hero + identity card | P0 | Low | renders identity |
| 2 | Avatar image | Missing (initials only) | **Needs mobile UX decision** — keep initials avatar; image upload deferred (no asset-upload flow on mobile yet) | P2 | Med | initials avatar renders |
| 3 | Learning summary (streak / reviews / accuracy / due) | API not wired on mobile (`/api/analytics/learner` unused). Device-local `studySummaryProvider` exists | **API exists but needs mobile adapter** — Phase 1 uses honest device-local `studySummaryProvider` (streak / reviewed today / 7-day / total). Server analytics adapter deferred | P0 | Low | snapshot real + empty state |
| 4 | Subscription / plan badge | `subscriptionProvider` exists, not shown on profile | Implement now — hero plan badge + subscription group, real entitlement only | P0 | Low | badge only when real |
| 5 | Manage billing | Subscription route exists | Keep — quick action + subscription group → `Routes.subscription` | P0 | Low | routes correctly |
| 6 | Appearance / theme | App is `ThemeMode.system` only; no toggle | Implement now — add theme option (system/light/dark) persisted device-local, wired into `MaterialApp.themeMode` | P1 | Low | theme row renders + persists |
| 7 | Reading assist (furigana) | Implemented (toggle) | Keep, group under Settings | P0 | Low | toggle persists |
| 8 | Haptics | Implemented (toggle) | Keep, group under Settings | P1 | Low | toggle persists |
| 9 | Language | Implemented | Keep, group under Settings | P0 | Low | selection persists |
| 10 | Notifications settings | Not on mobile | **Needs product decision** — no mobile notification pref store yet; omit row (no dead row) | P3 | Low | n/a |
| 11 | Privacy settings | Not on mobile | **Needs product decision** — omit dedicated row; link Privacy Policy under About | P3 | Low | n/a |
| 12 | Linked accounts | Not on mobile | **Not applicable now** — federated link management not exposed on mobile | P3 | Low | n/a |
| 13 | Help / Terms / Privacy / Contact | Not on mobile | Implement now — Support/About group linking to public web pages via external launch | P1 | Low | rows render + route honestly |
| 14 | App version / build | Implemented (real) | Keep under About | P0 | Low | shows real version |
| 15 | Edit profile (avatar/cover/band) | Not on mobile | **Needs mobile UX decision** — image upload deferred; document as limitation | P2 | Med | n/a |
| 16 | Sign out | Implemented (local-only, calm) | Keep, dedicated section | P0 | Low | logout → login |
| 17 | Saved items | Implemented (action) | Keep, quick action | P1 | Low | routes correctly |
| 18 | Progress detail | Implemented (route) | Keep, quick action | P0 | Low | routes correctly |

## 5. Classification summary

- **Implement now:** plan badge (#4), theme setting (#6), learning snapshot via device-local summary (#3), support/about links (#13), Me Hub grouping (#1, #5, #7–9, #14, #16–18).
- **API exists but needs mobile adapter (deferred):** server learning analytics (#3 server path).
- **Needs mobile/product UX decision (deferred, documented):** avatar/cover upload + edit profile (#2, #15), notifications (#10), privacy controls (#11).
- **Not applicable to mobile now:** linked-accounts management (#12).

No item marked "Blocked" — all gaps are decisions or deferrals with cited evidence.
