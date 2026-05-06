# FE-18 Register — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/register`
**Files**: `apps/web/app/[locale]/register/page.tsx`, `apps/web/app/[locale]/register/_components/register-form-client.tsx`

## Product Context

- **Target user**: New learner creating account
- **Primary learner outcome**: Create Keycloak account and begin learning
- **Primary action**: Submit registration form (username, email, password, confirm password)
- **Secondary actions**: Navigate to login, return home
- **Non-goals**: Social registration (future)

## Data Contract

- **Backend APIs**: Keycloak admin bootstrap for user creation
- **Auth check**: `getKcWebConfig()` + `getKcAdminBootstrap()` for readiness
- **Return-to**: Same open-redirect prevention as login

## Implementation Quality

- Brand header: `nav.brand` + `t.brandTagline` ✅
- Eyebrow + title + subtitle ✅
- Card container: same design system as login ✅
- Auth-not-ready state: `authDisabledHint` graceful fallback ✅
- Login link: always visible ✅
- Back-to-home link ✅
- `robots: { index: false }` ✅
- Responsive: `max-w-[420px]`, centered ✅
- Form validation: password mismatch, user exists, registration failed ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default (guest) | Registration form with 4 fields | ✅ |
| Auth not configured | `authDisabledHint` shown | ✅ |
| Submitting | Loading state in RegisterFormClient | ✅ |
| User exists | `userExists` error message | ✅ |
| Password mismatch | Client-side validation | ✅ |
| Registration failed | Error message | ✅ |
| Registration unavailable | `registrationUnavailable` message | ✅ |
| Mobile 375px | max-w-[420px] centering | ✅ |

## Localization

- **i18n namespace**: `auth.register`, `auth.errors`, `nav`
- **VI/JA**: Both fully localized
- **Copy keys**: metaTitle, eyebrow, title, subtitle, brandTagline, usernameLabel, emailLabel, passwordLabel, confirmPasswordLabel, primaryCta, submitting, loginLead, loginCta, backHome, hint, error variants

## Acceptance

- [x] No technical text visible
- [x] Brand signal matches login page
- [x] Form validation clear
- [x] Mobile responsive
- [x] i18n complete
- [x] `robots: noindex`
- [x] Open-redirect prevention
