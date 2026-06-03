# NihonGo BJT — Mobile Home Web Parity Audit

Date: 2026-06-03  
Scope: Flutter Home dashboard in `apps/mobile` compared with learner web Home in `apps/web/app/[locale]/_components/homepage`.

## Source Files Audited

- Web Home shell: `apps/web/app/[locale]/_components/homepage/homepage-client.tsx`
- Web Home sections: `hero-section.tsx`, `quick-actions-strip.tsx`, `homepage-sections-tabs.tsx`, `progress-section.tsx`, `featured-news-section.tsx`, `bjt-levels-section.tsx`
- Web Home widgets: `for-you-feed-widget.tsx`, `learning-heatmap.tsx`, `weekly-report-card.tsx`, `study-goal-widget.tsx`, `xp-rank-widget.tsx`, `companion-pet-widget.tsx`, `login-bonus-widget.tsx`, `mystery-box-widget.tsx`, `revenge-mode-widget.tsx`, `seasonal-event-banner.tsx`, `ad-banner.tsx`, `push-prompt-banner.tsx`, `focus-timer-widget.tsx`, `ambient-mode-widget.tsx`, `loto-teaser-widget.tsx`
- Web API/client source: `apps/web/lib/learner-api.ts`, feature API calls inside the components above
- Mobile Home source: `apps/mobile/lib/features/home/**`
- Mobile route map: `apps/mobile/lib/app/router.dart`
- Mobile API repositories: `apps/mobile/lib/core/content/data/content_repository.dart`, `features/news`, `magazine`, `scenarios`, `saved`, `billing`, `career`, `exam`, `gamification`, `flashcards`
- Requested doc not found: `docs/mobile/MOBILE_FINAL_COMPLETION_AUDIT.md`

## Status Legend

- **Done**: mobile already has a production route or Home section backed by real data/provider state.
- **Partial**: mobile has part of the behavior, but not Home parity.
- **Missing**: no mobile Home equivalent yet.
- **Not suitable for Home**: useful elsewhere, but should not crowd the mobile Home dashboard.
- **Requires backend/runtime verification**: contract exists in code, but local backend/API was not running during this audit.

## Web Home Section Matrix

| Web section | Web component/file | Route/link/action | API/client/model used | Mobile equivalent status | Mobile decision | Priority | UI/UX notes | Test plan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Greeting and primary cockpit CTA | `hero-section.tsx`, `homepage-client.tsx` | Primary: `/flashcards` when due reviews exist, otherwise `/quiz`; secondary flips to the other route | `/api/daily/home?locale=...`, `DailyHubPayload.dueReviews`, Keycloak display name | **Partial** | Replace current static welcome with a mobile-native hero that uses real flashcard deck/card data for review CTA and routes exam CTA to mobile `Routes.exam`. Do not fake web `dueReviews` if daily API is unavailable. | P0 | Strong primary CTA, compact enough for 360 dp, no noisy web gradient clone. | Widget tests for populated, empty, loading, error, dark, 360 dp. |
| Quick actions | `quick-actions-strip.tsx` | `/flashcards`, `/quiz`, `/battle`, `/search`, `/daily-standup`, `/review-inbox-preview` | `dueCount` from daily hub | **Partial** | Add Home shortcut grid for real mobile routes: flashcards/review, exam, search, dictionary, kanji, grammar, scenarios, saved, news, magazine, career, rewards, subscription. Exclude battle and daily standup because mobile routes do not exist. | P0/P1/P2 | Mobile-native cards, no dead buttons. Group essentials first. | Route smoke tests with a shell router where feasible; widget tests verify tappable labels exist. |
| Today feed | `homepage-sections-tabs.tsx`, `for-you-feed-widget.tsx` | Item-specific links to flashcards, exercises, levels, news, quiz, grammar | `/api/recommendation/study-feed?limit=8` | **Missing** | Do not implement a full feed in Home until a mobile repository exists. Surface equivalent entry points: Learn, Review, News, Exam, Grammar. Mark runtime verification blocked. | P1 | Avoid pretending to personalize. | Audit doc plus no fake feed assertions. |
| Loto teaser | `loto-teaser-widget.tsx` | `/magazine/loto` | `/api/magazine/loto/next-draw?game=loto6` | **Not suitable for Home** | Omit from Home. Magazine route exists, but loto-specific mobile route does not and is not core BJT Home. | P3 | Keeps Home serious and uncluttered. | N/A. |
| Daily Radar | `DailyRadarSection` via `daily-radar/api.ts` | Daily recommendation cards | `/api/daily-radar/home?locale=...` | **Missing** | Do not add fake radar. Use honest "today's learning" from existing `dailyLessonProvider` preview if surfaced, labeled as preview, and link to lesson detail. | P1 | Make preview status explicit if shown. | Provider/widget tests with fake daily lesson when added. |
| Featured NHK news | `featured-news-section.tsx` | `/news`, `/news/:id`, create flashcard action | `/api/nhk-news`, `/api/nhk-news/:id/flashcards` | **Partial** | Add Home content entry card to `Routes.news`. Avoid showing article counts unless `NewsRepository` is queried by a dedicated provider. | P2 | Useful reading shortcut, not above core BJT actions. | Navigation smoke; no fake count test. |
| Progress summary | `progress-section.tsx` | `/analytics` | `/api/analytics/learner?days=7`, `LearnerAnalytics` | **Partial** | Use real mobile `studySummaryProvider` device-local metrics only when present; otherwise honest empty state. Link to `Routes.progress`. | P0 | Label device-local metrics clearly in copy; no cross-device/streak fabrication. | Populated/empty/error tests; dark mode. |
| Learning heatmap | `learning-heatmap.tsx` | Inline chart | `/api/analytics/heatmap?days=365` | **Partial** | Do not duplicate heatmap on Home. Link to Progress; mobile Progress owns local activity visualization. | P2 | Home stays scannable. | Existing progress tests. |
| BJT levels | `bjt-levels-section.tsx` | `/levels`, `/levels/:code` | `/api/levels` | **Requires backend/runtime verification** | Mobile has no levels route; route to existing Learn, Dictionary/Kanji/Grammar/Exam cards instead. | P1 | Represent underlying study areas without dead level cards. | Shortcut smoke. |
| Weekly report | `weekly-report-card.tsx` | Inline latest report | `/api/analytics/weekly-report/latest` | **Missing** | Omit until mobile analytics repository consumes the server report. | P2 | Avoid fake coaching summaries. | N/A. |
| Rewards tab: mystery box | `mystery-box-widget.tsx` | Inline open reward | `/api/gamification/mystery-box/status`, `/open` | **Missing** | Route to `Routes.rewards`; do not inline open/claim mechanics on Home. | P2 | Reduces engagement clutter. | Navigation smoke. |
| Rewards tab: revenge mode | `revenge-mode-widget.tsx` | Inline quiz | `/api/quiz/revenge/queue`, `/answer` | **Missing** | Omit from Home until mobile route/provider exists. | P2 | Inline quiz would be too much for Home. | N/A. |
| Sidebar XP/rank | `xp-rank-widget.tsx` | `/career` | `/api/career/me` | **Partial** | Route to `Routes.career`; do not show XP/rank on Home unless queried by a partial-safe provider. | P2 | Avoid fake XP. | Navigation smoke. |
| Companion pet | `companion-pet-widget.tsx` | Inline rename/share | `/api/gamification/pet`, `/rename`, `/api/learner/shares/pet-evolution` | **Missing** | Omit from Home. No mobile pet repository/route. | P3 | Not essential to BJT Home. | N/A. |
| Study goal | `study-goal-widget.tsx` | Task links to flashcards, quiz, daily, battle | `/api/gamification/study-goal`, `/study-plan/today` | **Missing** | Omit until mobile consumes server study-goal contract. | P2 | Do not fake daily plan. | N/A. |
| Login bonus | `login-bonus-widget.tsx` | Claim action/share | `/api/gamification/login-bonus`, `/claim` | **Missing** | Route to Rewards only; do not inline claim. | P2 | Avoid accidental gamification pressure. | Navigation smoke. |
| Seasonal event | `seasonal-event-banner.tsx` | Join event | `/api/gamification/events`, `/events/:id/join` | **Missing** | Omit until mobile rewards/events surface exists. | P3 | Not essential. | N/A. |
| Focus timer / ambient mode | `focus-timer-widget.tsx`, `ambient-mode-widget.tsx` | Inline local focus tools | Local React state, browser UI | **Not suitable for Home** | Omit from mobile Home for this task. A mobile focus mode needs a separate product design, persistence decision, and notification/background behavior. | P3 | Keeps Home from becoming a tool drawer. | N/A. |
| Push prompt | `push-prompt-banner.tsx` | Notification permission prompt | Browser notification API; starts hidden | **Not suitable for this task** | Omit. Mobile push permission flow is platform-specific and outside Home parity scope. | P3 | Avoids auth/system prompt churn. | N/A. |
| Ads | `ad-banner.tsx` | Placement destination | `/api/learner/monetization/ad?placementCode=home_feed_banner` | **Missing / Not suitable for core Home** | Omit in this task. Mobile ad placements require product/platform review and should not interrupt learning flows. | P3 | Aligns with non-interruptive ads rule. | N/A. |
| Onboarding prompt | `onboarding-flow.tsx`, `onboarding-diagnostic.tsx` | Inline modal flow | `/api/recommendation/onboarding/status` | **Missing** | Do not build full onboarding. Home can route to Learn and keep auth blockers out of scope. | P2 | Avoid scope creep into auth/onboarding. | N/A. |
| Billing/subscription | Web settings/pricing, Home ad/premium context | `/pricing`, `/settings/subscription` | `/api/learner/monetization/*` via mobile `BillingRepository` | **Partial** | Add account/premium shortcut only as a route to `Routes.subscription`. Do not show plan status unless fetched by the subscription screen. | P2 | Respectful, no frontend-only paywall. | Navigation smoke. |

## Mobile Home Implementation Decisions

1. Build Home around three real, high-confidence pillars: review/flashcards, daily learning/learn, and BJT exam/practice entry.
2. Surface web breadth as mobile-native shortcut sections only when the target mobile route exists and its screen handles loading/empty/error with real repositories.
3. Do not inline high-risk server metrics (streaks, XP, rank, weekly report, study plan, personalized feed, ads) in Home unless a partial-safe Home provider is implemented.
4. Use device-local progress only as explicitly labeled progress, and keep server analytics marked as unavailable until a mobile repository consumes `/api/analytics/*`.
5. Keep battle and daily standup out of Home because mobile routes do not exist.
6. Treat local backend runtime verification as blocked until Keycloak/API are running. Code will target the real contracts already present in mobile repositories.

## Batch 0 Findings

- Existing Home is production-honest but too narrow for web parity: welcome, flashcard deck/card metrics, review CTA, and offline sync only.
- Mobile already has route and repository coverage for many web Home destinations: dictionary, kanji, grammar, search, saved, news, magazine, scenarios, exam, career, rewards, subscription.
- The web has an aggregated Home experience; mobile currently lacks an aggregated Home data model for partial content availability.
- Several web widgets are intentionally not mobile Home candidates because they are browser-local, too gamified for a serious mobile Home, or require unimplemented platform behavior.

## Audit Test Plan

- `cd apps/mobile && flutter analyze`
- `cd apps/mobile && flutter test`
- Home widget tests for loading, populated, empty, error, partial data, dark mode, and 360 dp layout.
- Home navigation smoke tests for every visible shortcut.
- Runtime verification on emulator/device after local Keycloak/API are running; do not claim live Home API data passed until then.
