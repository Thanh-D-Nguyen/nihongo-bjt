# Home — Web ↔ Mobile Parity Audit

Scope: learner-facing **Home / dashboard** only.

- Web source: `apps/web/app/[locale]/_components/homepage/*`
  (entry: `homepage-client.tsx`, `homepage-sections-tabs.tsx`, `quick-actions-strip.tsx`, `hero-section.tsx`).
- Mobile source: `apps/mobile/lib/features/home/*` (`home_page.dart`,
  `home_dashboard_controller.dart`, `home_dashboard_data.dart`).
- Mobile router: `apps/mobile/lib/app/router.dart`.

**Parity rule:** functional parity, not layout parity. The mobile Home must
expose every web Home function that a corresponding mobile feature/route
actually supports, through mobile-native hierarchy. Web-only widgets whose
feature has **no mobile route and no mobile API client** are omitted (never
rendered as dead cards) and the blocker is documented below.

## Web Home inventory

| # | Web component | Web route / API | Purpose |
|---|---|---|---|
| 1 | `HeroSection` | `/api/daily/home` (`greeting`, `dueReviews`) | Greeting + due-review count + primary entry |
| 2 | `QuickActionsStrip` | `/flashcards`, `/quiz`, `/battle`, `/search`, `/daily-standup`, `/review-inbox-preview` | Bento quick-action grid |
| 3 | `SeasonalEventBanner` | events config | Seasonal promo banner |
| 4 | `AdBanner` | ad provider | Monetization placement |
| 5 | `XpRankWidget` | xp/rank API | XP & rank (sidebar) |
| 6 | `CompanionPetWidget` | companion API | Pet companion (sidebar) |
| 7 | `StudyGoalWidget` | study-goal API | Daily study goal (sidebar) |
| 8 | `LoginBonusWidget` | login-bonus API | Daily login reward (sidebar) |
| 9 | `SidebarGuestCta` | — | Guest sign-in prompt |
| 10 | `OnboardingFlow` | `/api/recommendation/onboarding/status` | First-run onboarding |
| 11 | `PushPromptBanner` | web push | Notification opt-in |
| 12 | Tab **Today**: `ForYouFeedWidget` | recommendation API | Personalized feed |
| 13 | Tab **Today**: `LotoTeaserWidget` | loto API | Lottery teaser |
| 14 | Tab **Today**: `DailyRadarSection` | `/api/daily-radar` | Daily life modules |
| 15 | Tab **Today**: `FeaturedNewsSection` | `/api/nhk-news` | NHK news |
| 16 | Tab **Progress**: `LearningHeatmap` | analytics | Activity heatmap |
| 17 | Tab **Progress**: `BjtLevelsSection` | bjt levels | BJT level map |
| 18 | Tab **Progress**: `ProgressSection` | `/api/analytics/learner` | Analytics summary |
| 19 | Tab **Progress**: `WeeklyReportCard` | analytics | Weekly report |
| 20 | Tab **Rewards**: `MysteryBoxWidget` | rewards API | Mystery box |
| 21 | Tab **Rewards**: `RevengeModeWidget` | mistakes API | Revenge (mistake) mode |
| 22 | Tab **Focus**: `FocusTimerWidget` | local | Focus timer |
| 23 | Tab **Focus**: `AmbientModeWidget` | local | Ambient audio mode |

## Parity matrix (per web function → mobile decision)

Status legend: **Done** (real mobile equivalent wired) · **Partial** (mobile
covers a real subset) · **Missing** (no mobile feature/route — blocker
documented) · **N/A-Home** (not appropriate for a mobile Home).

| Web function | API/client/model checked | Mobile equivalent | Status | Mobile UX decision | Priority | Blocker (if not Done) |
|---|---|---|---|---|---|---|
| Hero greeting | `/api/daily/home` greeting; mobile has no daily-home client | Hero card — **time-of-day greeting** derived from device clock (real, not fabricated) | Done | Primary (Hero) | P0 | — |
| Hero due-review count | `/api/daily/home` `dueReviews`; mobile flashcard repo exposes deck/card totals + offline-queue, **no SRS "due-today" count source** | Hero shows real *cards ready* total; due-today count omitted | Partial | Hero | P0 | No mobile SRS due-today provider/endpoint client; would need `/flashcards/due` wiring + auth runtime |
| Continue / next learning | local lesson repo (`dailyLessonProvider`) | Hero primary CTA → Learn/Flashcards + daily lesson card | Done | Primary CTA | P0 | — |
| Daily lesson | `LocalPreviewLessonRepository` (real preview content) | `_TodaySection` daily lesson card | Done | Secondary card | P0 | — |
| BJT practice / exam | `/quiz` web; mobile `Routes.exam` (`ExamBrowserPage`) | Hero secondary CTA + Core shortcut | Done | Primary CTA + shortcut | P0 | — |
| Flashcards / SRS | mobile `flashcardRepositoryProvider` | Review/progress metrics card + Core shortcut | Done | Secondary card + shortcut | P0 | — |
| Review inbox | `/review-inbox-preview` web; mobile `ReviewHubPage` | Core shortcut → Review hub | Done (equivalent) | Section item / shortcut | P1 | — |
| Progress / analytics | `/api/analytics/learner` web; mobile `studySummaryProvider` (device-local) | Progress mini card (real local) + Progress shortcut/page | Partial | Secondary card + shortcut | P1 | Server analytics client not in mobile; local summary used honestly |
| Sync status *(mobile-only)* | `offlineReviewQueueProvider` | Sync status card | Done (mobile-native) | Section item | P1 | — |
| Dictionary | mobile `Routes.dictionary` | Library shortcut | Done | Shortcut | P1 | — |
| Search | mobile `Routes.search` | Library shortcut | Done | Shortcut | P1 | — |
| Kanji | mobile `Routes.kanji` | Library shortcut | Done | Shortcut | P2 | — |
| Grammar | mobile `Routes.grammar` | Library shortcut | Done | Shortcut | P2 | — |
| Saved items | mobile `Routes.saved` | Library shortcut | Done | Shortcut | P2 | — |
| News (NHK) | `/api/nhk-news` web; mobile `Routes.news` | Content shortcut | Done (equivalent) | Shortcut | P2 | — |
| Magazine | mobile `Routes.magazine` | Content shortcut | Done | Shortcut | P2 | — |
| Scenarios | mobile `Routes.scenarios` | Content shortcut | Done | Shortcut | P2 | — |
| Career | mobile `Routes.career` | Content shortcut | Done | Shortcut | P2 | — |
| Rewards / gamification | mobile `Routes.rewards` (`RewardsPage`) | Content shortcut | Done | Shortcut | P2 | — |
| Subscription / billing | mobile `Routes.subscription` | Library shortcut | Done | Shortcut | P2 | — |
| For-you feed | recommendation API; no mobile client | Daily lesson card (lite equivalent) | Partial | Section item | P3 | No recommendation client in mobile |
| Daily radar | `/api/daily-radar`; no mobile client/route | — | Missing | N/A-Home | P3 | No mobile daily-radar feature/route/client |
| BJT levels | bjt levels; mobile has exam browser | Exam shortcut (lite) | Partial | Shortcut | P3 | No mobile level-map screen |
| Learning heatmap | analytics; mobile Progress page | Progress shortcut (lite) | Partial | Section item | P3 | No mobile heatmap widget |
| Weekly report | analytics; no mobile client | — | Missing | Hidden | P3 | No mobile analytics client |
| Battle | `/battle`; no mobile route/feature | — | Missing | N/A-Home | P3 | No mobile battle feature, route, or API client |
| Daily standup | `/daily-standup`; no mobile route | — | Missing | N/A-Home | P3 | No mobile standup feature/route |
| XP / Rank | xp API; no mobile client | — | Missing | N/A-Home | P3 | No mobile xp/rank client |
| Companion pet | companion API; no mobile client | — | Missing | N/A-Home | P3 | No mobile companion feature |
| Study goal | study-goal API; no mobile client | — | Missing | N/A-Home | P3 | No mobile study-goal client |
| Login bonus | login-bonus API; no mobile client | — | Missing | Hidden | P3 | No mobile login-bonus client |
| Loto teaser | loto API; no mobile client | — | Missing | N/A-Home | P3 | No mobile loto feature |
| Mystery box / Revenge / Focus timer / Ambient | various; no mobile route | — | Missing | N/A-Home | P3 | No mobile feature/route |
| Seasonal event banner | events config; no mobile client | — | Missing | Hidden | P3 | No mobile events client |
| Ad banner | ad provider | — | N/A-Home | N/A-Home | — | Ads not placed on mobile Home by product decision |
| Push prompt | web push | — | N/A-Home | N/A-Home | — | Mobile push handled via native settings, not Home |
| Onboarding flow | onboarding API | — | Missing | N/A-Home | P3 | No mobile onboarding flow; not a Home concern |

## Verdict

The mobile Home already achieves **functional parity for every learner feature
that exists as a mobile route/feature**: learning entry, daily lesson, exam,
flashcards/SRS, progress, dictionary, search, kanji, grammar, saved, news,
magazine, scenarios, career, rewards, subscription — each wired to a real route
with honest loading/empty/error/partial states and no dead cards.

Web-only engagement/gamification widgets (battle, standup, companion, xp/rank,
study-goal, login-bonus, daily-radar, loto, mystery-box, revenge, focus-timer,
ambient, heatmap, weekly-report, seasonal banner) have **no mobile feature,
route, or API client**. Per the skill's hard rule, they are omitted from Home
rather than shown as fake/dead cards; each blocker is recorded above.

The only real, non-fabricated parity uplift available without new backend
wiring is the **time-of-day greeting** in the hero (web shows a greeting; mobile
showed a static "ようこそ"). That is the implementation target for this pass.
