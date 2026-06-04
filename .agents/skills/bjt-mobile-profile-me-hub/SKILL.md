# BJT Mobile Profile / Me Hub Skill

Use this skill when implementing, auditing, or polishing the Profile / Me area of the Nihongo BJT mobile app.

## Goal

Transform Profile from a basic account page into a production-grade mobile Me Hub.

The Me Hub should be:
- useful every day
- visually premium
- consistent with the web brand
- mobile-native
- not a raw settings dump
- not a desktop account page clone
- safe for auth/session/logout behavior
- clear for Japanese/Vietnamese users

## Core principle

Profile is not only “account info”.

Profile / Me should combine:
- account identity
- learning identity
- progress summary
- subscription/billing
- settings
- language/theme
- support/help
- app information
- logout/session control

But it must remain clean and not overloaded.

## Recommended Me Hub structure

### 1. Profile Hero

Show:
- avatar or initials
- display name
- email or account identifier
- learner level if real data exists
- premium/subscription badge only if real entitlement exists
- edit profile action if web/API supports it

Do not:
- fake premium badge
- fake learner level
- show raw token/auth information
- expose sensitive account data

### 2. Learning Snapshot

Show only real data:
- current streak
- completed lessons
- review due
- weak points
- study time
- BJT progress
- exam score summary

If data is unavailable:
- show honest empty state
- do not invent progress

### 3. Quick Actions

Useful actions:
- Continue learning
- Review due cards
- Saved items
- Flashcard decks
- Exam history if available
- Download/offline content if supported
- Manage subscription
- Edit profile

Each action must:
- navigate somewhere real, or
- show honest unavailable state

No dead buttons.

### 4. Settings Group

Include:
- language
- theme
- haptic feedback
- sound/audio setting if implemented
- notification setting if supported
- content/audio autoplay if supported
- data/cache/offline if supported

Do not show fake toggles that do nothing.

### 5. Account & Subscription

Include:
- subscription status if entitlement API exists
- plan name if real
- manage billing if supported
- restore purchase only if native billing supports it
- login provider if useful
- account security if web/API supports it

Do not:
- fake payment
- bypass entitlement
- store payment data
- show premium access unless API confirms it

### 6. Support / About

Include:
- Help
- Contact support if web supports it
- FAQ if web supports it
- Terms
- Privacy policy
- App version/build
- Licenses

### 7. Logout

Logout must:
- show clear signing-out state
- not flash fallback profile
- not open raw AppAuth/Keycloak prompt unless absolutely required by the real auth flow
- redirect cleanly to Login
- not create auth loop
- not leave stale session UI

## Hard rules

- Do not fake user profile data.
- Do not fake progress.
- Do not fake subscription.
- Do not create dead settings toggles.
- Do not store credentials.
- Do not expose tokens.
- Do not bypass auth.
- Do not break logout.
- Do not show raw Keycloak/AppAuth UX unless unavoidable and documented.
- Keep VI/JA localization updated together.
- Support light/dark mode.
- Support 360–390 dp width.
- Support tablet width cap.
- Avoid horizontal overflow.
- Add/update tests.

## Required audit before coding

Inspect:

### Web

- web profile/account page
- web settings page
- web subscription/billing page
- web progress/account widgets
- web logout behavior
- web API clients/hooks/models
- web copy and labels

### Mobile

- profile_page.dart
- auth_controller
- auth_repository
- keycloak_auth_repository
- router/auth guard
- settings/profile routes
- progress providers
- billing/subscription providers
- l10n files
- theme/tokens
- tests

Create/update:

- `docs/mobile/PROFILE_WEB_PARITY_AUDIT.md`
- `docs/mobile/PROFILE_MOBILE_UX_DECISION.md`
- `docs/mobile/PROFILE_IMPLEMENTATION_PLAN.md`
- `docs/mobile/PROFILE_AUTH_LOGOUT_AUDIT.md`

## Web parity matrix

For each web Profile/Account/Settings/Billing feature, document:

- web file/route
- API/client/model
- mobile current status
- mobile implementation decision
- priority
- risk
- required tests

Classify as:

- Implement now
- API exists but needs mobile adapter
- Needs product/mobile UX decision
- Not applicable to mobile
- Blocked with proof

Do not mark as blocked unless the repo was searched and proof is documented.

## UI/UX rules

Profile should feel like a premium mobile Me Hub.

Use:
- grouped cards/lists
- clear section headers
- calm icons
- compact but readable rows
- strong account identity
- useful learning snapshot
- clean settings hierarchy

Avoid:
- giant plain black-white settings list
- too many unrelated actions at top level
- fake dashboard metrics
- cluttered badges
- desktop account layout
- raw backend/auth wording
- long technical error text

## Required screens/components

Implement or polish:

1. Me/Profile main screen
2. Edit profile screen if web/API supports it
3. Language/theme settings if mobile supports it
4. Subscription/billing entry if API exists
5. App info/about section
6. Help/legal links if web supports them
7. Logout/signing-out state
8. Empty/error states for profile data

## Required tests

Add/update tests for:

- profile renders with user data
- profile empty/session-loading state
- profile error state
- learning snapshot with real/fake test repository data
- no fake progress when data missing
- subscription status only when entitlement exists
- settings rows route correctly
- language/theme rows render
- app version/build row
- logout signing-out state
- logout redirects to Login
- no fallback profile flash
- 360 dp layout
- dark mode
- long Japanese/Vietnamese text

## Verification

After each batch:

```bash
cd mobile && flutter analyze
cd mobile && flutter test
git diff --check