# FE-23 Feedback — Screen Contract

**Status**: `verified`
**Route**: `/[locale]/feedback`
**Files**: `apps/web/app/[locale]/feedback/page.tsx`

## Product Context

- **Target user**: Any learner wanting to report bugs or suggest features
- **Primary learner outcome**: Submit feedback to development team
- **Primary action**: Fill and submit feedback form
- **Non-goals**: Ticket tracking, real-time support

## Data Contract

- **Backend APIs**: `POST /api/feedback` — form submission
- **Fields**: name (optional), email (optional), category (select), message (required)
- **Categories**: bug, feature, content, other

## Implementation Quality

- Title + subtitle ✅
- 4-field form: name, email, category select, message textarea ✅
- Grid layout for name/email on desktop ✅
- Category selector with 4 localized options ✅
- Success state: green card with confirmation message ✅
- Error state: red error text ✅
- Disabled submit when message empty ✅
- CTA: `bg-leaf` full-width submit button ✅
- Design tokens: `rounded-lg border-ink/10`, `focus:border-leaf focus:ring-leaf` ✅
- Client component with proper state management ✅

## States

| State | Implementation | Status |
|-------|---------------|--------|
| Default | Empty form with 4 fields | ✅ |
| Submitting | Form submission in progress | ✅ |
| Success | Green confirmation card, form reset | ✅ |
| Error | Red error text below form | ✅ |
| Disabled CTA | Submit disabled when message empty | ✅ |
| Mobile 375px | Grid stacks to single column | ✅ |

## Localization

- **i18n namespace**: `feedbackPage`
- **VI/JA**: Both localized
- **Copy keys**: title, subtitle, nameLabel, namePlaceholder, emailLabel, emailPlaceholder, categoryLabel, categoryBug/Feature/Content/Other, messageLabel, messagePlaceholder, submit, success, error

## Acceptance

- [x] No technical text
- [x] Form validation (message required)
- [x] Success/error states
- [x] i18n complete
- [x] Responsive grid
- [x] Linked from footer and help page
