# FE-ALL — Learner Screen Inventory & Status

Last updated: 2026-05-02 (all contracts created)

## Route Mapping (matches prompt 59 FE-IDs)

| ID | Route | Title | Files | Status | Review Artifact |
|----|-------|-------|-------|--------|----------------|
| FE-00 | Shell/Nav/Auth | App shell, nav, auth frame, footer/trust | learner-app-frame.tsx, layout.tsx | ✅ verified | FE-00-learner-shell-design-system.md |
| FE-01 | `/[locale]` | Today Focus Dashboard | page.tsx, daily-hub-client.tsx | ✅ verified | FE-01-today-focus-dashboard.md |
| FE-02 | `/[locale]/quiz` | BJT Practice Entry | quiz/page.tsx, quiz-client.tsx | ✅ verified | FE-02-quiz-entry.md |
| FE-03 | quiz active session | Quiz in progress | quiz-client.tsx (session state) | ✅ verified | FE-03-quiz-session.md |
| FE-04 | quiz result/coaching | Quiz results | quiz-results-breakdown.tsx | ✅ verified | FE-04-quiz-results.md |
| FE-05 | Reading assist layer | Reusable reading assist | components/reading-assist/*.tsx | ✅ verified | FE-05-reading-assist.md |
| FE-06 | `/[locale]/flashcards` | Flashcards/SRS/Review | flashcards/page.tsx, flashcards-client.tsx | ✅ verified | FE-06-flashcards.md |
| FE-07 | `/[locale]/battle` | Bot Battle | battle/page.tsx, battle-client.tsx | ✅ verified | FE-07-battle.md |
| FE-08 | `/[locale]/share/[token]` | Public Share Page | share/[token]/page.tsx | ✅ verified | FE-08-share.md |
| FE-09 | `/[locale]/search` | Dictionary Search | search/page.tsx, search-client.tsx | ✅ verified | FE-09-search.md |
| FE-10 | `/[locale]/analytics` | Learning Progress | analytics/page.tsx, analytics-client.tsx | ✅ verified | FE-10-analytics.md |
| FE-11 | `/[locale]/settings` | Settings Hub | settings/page.tsx | ✅ verified | FE-11-settings-hub.md |
| FE-12 | `/[locale]/settings/accounts` | Account Settings | settings/accounts/page.tsx | ✅ verified | FE-12-to-15-settings-sub.md |
| FE-13 | `/[locale]/settings/notifications` | Notification Settings | settings/notifications/page.tsx | ✅ verified | FE-12-to-15-settings-sub.md |
| FE-14 | `/[locale]/settings/privacy` | Privacy Settings | settings/privacy/page.tsx | ✅ verified | FE-12-to-15-settings-sub.md |
| FE-15 | `/[locale]/settings/reading` | Reading Assist Settings | settings/reading/page.tsx | ✅ verified | FE-12-to-15-settings-sub.md |
| FE-16 | `/[locale]/daily/[id]` | Daily Item Detail | daily/[id]/page.tsx, daily-detail-client.tsx | ✅ verified | FE-16-daily-detail.md |
| FE-17 | `/[locale]/login` | Login | login/page.tsx, login-form-client.tsx | ✅ verified | FE-17-login.md |
| FE-18 | `/[locale]/register` | Register | register/page.tsx | ✅ verified | FE-18-register.md |
| FE-19 | `/[locale]/onboarding` | Onboarding | onboarding/page.tsx | ✅ verified | FE-19-onboarding.md |
| FE-20 | `/[locale]/help` | Help/FAQ | help/page.tsx | ✅ verified | FE-20-help.md |
| FE-21 | `/[locale]/privacy` | Privacy Policy | privacy/page.tsx | ✅ verified | FE-21-privacy.md |
| FE-22 | `/[locale]/terms` | Terms of Service | terms/page.tsx | ✅ verified | FE-22-terms.md |
| FE-23 | `/[locale]/feedback` | Feedback Form | feedback/page.tsx | ✅ verified | FE-23-feedback.md |
| FE-24 | Error/not-found states | Error recovery | error.tsx, not-found.tsx, global-error.tsx, loading.tsx | ✅ verified | FE-24-error-states.md |

## Cross-Cutting States Coverage

| State | Implementation | Status |
|-------|---------------|--------|
| Loading | `loading.tsx` skeleton spinner | ✅ |
| Error boundary | `error.tsx` with retry button | ✅ |
| Not-found | `not-found.tsx` with home link | ✅ |
| Global error | `global-error.tsx` (inline styles) | ✅ |
| Auth loading | Keycloak session check in learner-app-frame | ✅ |
| Auth error | Login page handles authError query param | ✅ |
| Empty states | Per-component (daily hub, search, analytics) | ✅ |
| i18n VI/JA | All routes use vi.json + ja.json | ✅ |
| Footer/trust | Help/Privacy/Terms/Feedback links + copyright | ✅ |
| SEO metadata | `generateMetadata` on all pages + robots.txt | ✅ |
| Viewport/mobile | width=device-width, initialScale=1 | ✅ |
| Favicon | metadata.icons → /pwa-icon.svg | ✅ |
| Security headers | X-Frame-Options, Referrer-Policy, Permissions-Policy | ✅ |

## Summary

- Total routes: 25 (FE-00 through FE-24)
- ✅ Verified/Created: 25/25
- Review artifacts: 25/25 (all contracts created)
- Cross-cutting states: all implemented
- Error page i18n: fixed (error.tsx uses locale, not-found.tsx bilingual)

## i18n Quality

- 50+ i18n strings fixed across vi.json and ja.json
- No technical developer text visible to learners
- No English leaks (API, backend, Keycloak, PostgreSQL, etc.)
- BJT-appropriate terminology throughout
- All utility pages (help, privacy, terms, feedback) fully localized

## Security & Production Hardening

- Rate limiting: 3-tier @nestjs/throttler
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- CORS: env-restricted
- CSP: helmet in API
- SQL injection: zero $queryRawUnsafe
- XSS: zero dangerouslySetInnerHTML
- Auth: all non-public endpoints guarded
- IDOR: resolveLearnerUserId prevents horizontal escalation
