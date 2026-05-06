# FE-12 through FE-15 Settings Sub-Pages — Screen Contracts

## FE-12 Account Settings

**Status**: `verified`
**Route**: `/[locale]/settings/accounts`
**Files**: `apps/web/app/[locale]/settings/accounts/page.tsx` (34 lines)

- **Target user**: Authenticated learner managing account
- **Content**: Account info, Google SSO link
- **Auth**: `RequireKeycloakAuth` wrapper
- **i18n**: `settings.accounts` namespace
- **Key fix**: Clean Vietnamese, Google SSO link visible

## FE-13 Notification Settings

**Status**: `verified`
**Route**: `/[locale]/settings/notifications`
**Files**: `apps/web/app/[locale]/settings/notifications/page.tsx` (21 lines)

- **Target user**: Authenticated learner managing notifications
- **Content**: Notification preferences
- **Auth**: `RequireKeycloakAuth` wrapper
- **i18n**: `settings.notifications` namespace
- **Key fix**: "nhắc nhở" not "nudge"

## FE-14 Privacy Settings

**Status**: `verified`
**Route**: `/[locale]/settings/privacy`
**Files**: `apps/web/app/[locale]/settings/privacy/page.tsx` (21 lines)

- **Target user**: Authenticated learner managing privacy
- **Content**: Privacy preferences, data control
- **Auth**: `RequireKeycloakAuth` wrapper
- **i18n**: `settings.privacy` namespace
- **Key fix**: No "(skeleton)/(hàng đợi)" technical text

## FE-15 Reading Assist Settings

**Status**: `verified`
**Route**: `/[locale]/settings/reading`
**Files**: `apps/web/app/[locale]/settings/reading/page.tsx` (21 lines)

- **Target user**: Authenticated learner configuring reading assist
- **Content**: Furigana/meaning display mode, BJT timed-mode behavior
- **Auth**: `RequireKeycloakAuth` wrapper
- **i18n**: `settings.reading` namespace
- **Key fix**: No "Hover/demo" text, uses "Chạm / rê chuột"

## Common Properties

All settings sub-pages:
- Auth-gated via `RequireKeycloakAuth`
- Server components with i18n from messages
- Consistent with settings hub design pattern
- No technical/developer text visible
- Both VI and JA localized
