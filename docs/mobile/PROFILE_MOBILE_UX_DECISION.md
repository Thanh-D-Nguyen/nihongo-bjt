# Profile / Me Hub — Mobile UX Decision

Decides how the mobile Profile becomes a production-grade **Me Hub** that is
mobile-native (not a web clone), premium-but-calm, and free of fake data or
dead rows.

## Design principles

- **Mobile-native, not desktop account page.** Grouped cards + section headers,
  not a flat settings dump and not the web bento grid copied 1:1.
- **Honest data only.** Plan badge appears only with a real entitlement;
  learning snapshot uses the device-local `studySummaryProvider` and shows an
  honest empty state when nothing is recorded. No `/api/analytics/learner`
  mock.
- **No dead rows.** Every row navigates somewhere real or launches a real
  external page. Deferred features are simply absent, not stubbed.
- **Calm premium.** Tokens only (`AppColors`/`AppPalette`, `AppSpacing`,
  `AppRadius`, `AppShadows`, `AppMotion`). Light + dark. 360–390 dp safe, tablet
  width-capped (`maxWidth: 720`). VI/JA long text wraps/ellipsizes.

## Final Me Hub structure (top → bottom)

1. **Profile hero** — avatar (initials), display name, secondary label
   (email/username), and a **real plan badge** (Free / plan name) sourced from
   `subscriptionProvider`. Badge is omitted while loading and on error.
2. **Account identity card** — display name, username, email, privacy notice
   (existing, retained).
3. **Learning snapshot** — streak, reviewed-today, last-7-days, total reviews
   from `studySummaryProvider`. Honest empty state when `isEmpty`. Tapping the
   card opens Progress.
4. **Quick actions** — Continue/Progress, Saved, Review due, Subscription. Each
   routes to a real destination.
5. **Settings group** — Language, Theme (new), Furigana, Haptics.
6. **Subscription / account group** — Manage subscription (real plan summary +
   `Routes.subscription`).
7. **Support / About group** — Help, Terms, Privacy Policy (external launch),
   App version/build (real).
8. **Sign-out section** — dedicated, with signing-out state.

## Decisions on ambiguous web features

| Feature | Decision | Rationale |
|---|---|---|
| Avatar/cover **image** upload | **Defer.** Keep initials avatar. | No mobile asset-upload pipeline; adding one is out of scope and would risk a half-built flow. Documented as a limitation. |
| Edit profile (band/name) | **Defer.** | Same as above; no mobile mutation surface for `/api/auth/profile` yet. |
| Server learning analytics (`/api/analytics/learner`) | **Defer.** Use device-local summary. | Honest local data already exists; server adapter is additive and can be wired later without restructuring the hub. |
| Notifications settings | **Omit row.** | No mobile notification preference store; a row would be dead. |
| Privacy controls page | **Omit dedicated row;** link Privacy Policy under About. | No mobile privacy-pref API; the public policy link is honest and useful. |
| Linked accounts | **Omit.** | Federated link management not exposed to mobile. |

## Theme setting decision

- Add `AppThemeOption { system, light, dark }` mirroring `AppLocaleOption`.
- Persist via `UserSettingsRepository` under a stable key (`theme_mode`).
- Expose `themeModeProvider`; wire into `MaterialApp.router(themeMode: …)`.
- Default `system`.

## Support/About external links

- Use a single source of brand URLs (terms, privacy, help) from app config /
  environment. Launch via the platform default browser. If a URL is not
  configured, the row is omitted rather than dead.
- No `url_launcher` dependency currently in `apps/mobile/pubspec.yaml`; it will
  be added (stable, well-maintained, justified) for external links. If product
  prefers zero new dependency, the Support/About group ships with App
  version/build only and links are deferred — decision recorded at
  implementation time.

## Out of scope (explicitly)

- Backend/API changes.
- Avatar/cover upload.
- Server analytics wiring.
- Notification/privacy preference stores.
