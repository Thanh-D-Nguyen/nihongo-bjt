# FE-17 Login — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/login`
**Files**: `apps/web/app/[locale]/login/page.tsx`, `apps/web/app/[locale]/login/_components/login-form-client.tsx`

## Product Context

- **Target user**: Learner (guest accessing login page)
- **Primary learner outcome**: Authenticate with Keycloak to access learning features
- **Primary action**: Submit username/password form
- **Secondary actions**: Navigate to register, return home
- **Non-goals**: Social login (future), password reset (delegated to Keycloak)

## Data Contract

- **Backend APIs**: `POST /api/auth/keycloak/login` (via form action)
- **Auth state**: Cookies `kc_access_token`, `kc_refresh_token` set on success
- **Return-to**: `searchParams.returnTo` with open-redirect prevention (`startsWith("/")` && `!startsWith("//")`)

## Implementation Quality

- Brand header: `nav.brand` + `t.brandTagline` ✅
- Eyebrow + title + subtitle ✅
- Card container: `rounded-2xl border border-ink/10 bg-surface p-6 shadow-*` ✅
- Auth error mapping: `userFacingAuthError()` → localized error messages ✅
- Auth-not-configured state: graceful hint instead of broken form ✅
- Registration link: conditional on `NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED` ✅
- Back-to-home link ✅
- `robots: { index: false }` ✅
- Responsive: `max-w-[420px]`, centered with `min-h-[80vh]` ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default (guest) | Login form with brand header | ✅ |
| Auth error | Red alert banner from `userFacingAuthError` | ✅ |
| Auth not configured | `authDisabledHint` shown | ✅ |
| Submitting | Loading state in LoginFormClient | ✅ |
| Wrong credentials | Mapped error message | ✅ |
| Mobile 375px | max-w-[420px] centering, responsive padding | ✅ |

## Localization

- **i18n namespace**: `auth.login`, `auth.errors`, `nav`
- **VI/JA**: Both fully localized
- **Copy keys**: metaTitle, eyebrow, title, subtitle, brandTagline, usernameLabel, passwordLabel, primaryCta, submitting, registerLead, registerCta, backHome, hint, error variants

## Acceptance

- [x] No Keycloak/HttpOnly/technical text visible
- [x] Brand signal present
- [x] Auth error recovery clear
- [x] Mobile responsive
- [x] i18n complete
- [x] `robots: noindex`
- [x] Open-redirect prevention
