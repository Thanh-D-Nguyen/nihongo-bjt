# NihonGo BJT — Web ↔ Mobile Feature Parity Matrix

Status: living document. Owner: mobile production track. Created during the
web/mobile parity audit (Batch 0). It maps every learner-facing **web** route to
its **mobile** equivalent, the mobile status, the data/API dependency, a mobile
priority, and the recommended implementation approach.

Companion docs: `WEB_MOBILE_UIUX_PARITY_AUDIT.md` (visual parity),
`MOBILE_PRODUCTION_COMPLETION_PLAN.md` (batch plan),
`MOBILE_KNOWN_LIMITATIONS.md` (honest caveats).

## How to read this

- **Mobile status**
  - **Done** — implemented to the mobile quality bar (real or clearly-labeled
    preview data, all states, light/dark, localized).
  - **Partial** — exists but narrower than web; gap is documented.
  - **Missing** — no mobile equivalent yet.
  - **N/A (mobile)** — desktop/admin-only or not appropriate for the mobile
    learner surface.
  - **Needs product decision** — value/shape on mobile is unresolved.
- **Priority** — mobile learner value: **P0** core daily loop, **P1** high-value
  learning content, **P2** nice-to-have, **P3** marginal on mobile.
- **Data dependency** — what the feature needs to be real. "Local preview"
  means a labeled on-device content set behind a repository interface; "Backend
  API" means a server contract the mobile app does not yet call.

---

## A. Core learner loop (P0)

| Web route | Web feature | Mobile equivalent | Status | Data dependency | Priority | Approach / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]` | Home dashboard: greeting, due reviews, continue, daily lessons, news, gamification | `features/home` (`HomePage`) | **Partial** | Real: flashcard decks/cards + sync (local drift). Backend: streak, news, gamification, daily-lesson progress. | P0 | Mobile shows real review-ready + deck counts + continue CTA + sync. Web extras (news strip, login bonus, XP/rank, companion) depend on backend APIs not wired to mobile — keep out until contracts land; do not fake. Tablet width cap fixed (was raw Scaffold). |
| `/[locale]/login` `/register` `/forgot-password` | Auth: password + social (PKCE), register, reset | `features/auth` (`LoginPage`) | **Done** | Keycloak OIDC (real). | P0 | Email/password + browser PKCE for social/register/reset, locale switch, safe error states. Login header overflow at ≤390px fixed in Batch 1. |
| `/[locale]/onboarding` | First-run diagnostic + goal setup | — | **Missing / Needs product decision** | Backend: `/api/recommendation/onboarding/*`. | P2 | Mobile defers a guided first-run until the onboarding contract is consumed; today the learner lands on Home. Document as a future batch, do not stub a fake diagnostic. |

## B. Learning content & practice

| Web route | Web feature | Mobile equivalent | Status | Data dependency | Priority | Approach / notes |
| --- | --- | --- | --- | --- | --- | --- |
| (web learn hubs: `explore`, `levels`, `modules`) | Structured lesson hub | `features/learn` (`LearnPage`, `LessonDetailPage`) | **Done (preview)** | Local preview (`LocalPreviewLessonRepository`) behind `LessonRepository`; swap to backend later. | P0 | Daily-lesson card, categories, lesson list/detail. Preview content is badged. When a real lessons API lands, only the repo swaps. |
| `/[locale]/quiz` (also `exercises`) | BJT mock exam / drill question player | `features/practice` (`PracticePage`) | **Partial** | Local preview (`LocalPreviewQuestionRepository`). Backend: real BJT templates, timed exam, server scoring, attempt history. | P0 (player) / P1 (exam mode) | Full-screen question player + result review is done (fixed CTA/advance + bottom-nav crowding). True timed BJT exam mode (sections, server scoring, history) needs the quiz API — separate batch, honest preview meanwhile. |
| `/[locale]/dictionary` | Vocabulary lookup + reading assist | reading-assist layer exists (`JapaneseText`); no browser | **Missing** | Backend: `/api/dictionary/*`. | P1 | High learner value. Build a mobile dictionary browser when the dictionary API is consumed; until then show honest "coming soon / preview" entry, do not fake entries. |
| `/[locale]/kanji` | Kanji browser (stroke, readings) | — | **Missing** | Backend: `/api/kanji/*`. | P1 | Same pattern as dictionary; needs backend. |
| `/[locale]/grammar` | Grammar reference | — | **Missing** | Backend: `/api/grammar/*`. | P1 | Same pattern; needs backend. |
| `/[locale]/news` | NHK Easy News reader | — | **Missing** | Backend: `/api/nhk-news`. | P2 | Content/reading feature; defer to a content batch with the news API. |
| `/[locale]/magazine` | Curated phrase/scenario feed | — | **Missing** | Backend: `/api/magazine`. | P2 | Defer to content batch. |
| `/[locale]/scenarios` | Business dialog trainer | — | **Missing** | Backend: `/api/scenarios/*`. | P2 | High BJT relevance but needs backend + progress store. |
| `/[locale]/cardgen` | AI flashcard generator | — | **Missing** | Backend: `/api/cardgen/*`. | P2 | Companion to flashcards; needs AI backend. |

## C. Review & spaced repetition (P0/P1)

| Web route | Web feature | Mobile equivalent | Status | Data dependency | Priority | Approach / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/flashcards` | SRS engine: decks, review queue, levels | `features/flashcards` + `features/review` | **Done** | Real: drift store + sync queue; deck/review APIs where configured. | P0 | Deck list under Review branch, full-screen SRS review (fixed reveal hit-area + active-tab). Offline grades queue + sync (unit-tested). |
| (web review hub / `review-inbox-preview`) | Review hub / due surfacing | `ReviewHubPage` | **Done** | Real flashcard decks + practice-enabled lessons. | P0 | Unified hub routes to flashcards + practice. Counts from live providers; nothing fabricated. |
| `/[locale]/saved` | Bookmarks & collections | — | **Missing** | Backend: `/api/bookmarks`. | P2 | Needs bookmarks API + add-to-saved actions across content. Defer. |

## D. Progress & profile (P0)

| Web route | Web feature | Mobile equivalent | Status | Data dependency | Priority | Approach / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/me` (Progress tab), `analytics` | Progress: streak, heatmap, weekly report, mastery | `features/progress` (`ProgressPage`) | **Partial** | Real: device-local study log (drift): today/streak/week/total/activity/rating. Backend: server analytics, heatmap, weekly report, cross-device sync. | P0 | Honest device-local analytics with empty state. Web's server analytics (heatmap, weekly report, cross-device) need the analytics API — document the contract, keep mobile honest. |
| `/[locale]/me` (Profile/Settings tabs), `account`, `settings`, `profile` | Identity, language, theme, preferences, sign-out | `features/settings` (`ProfilePage`) | **Done** | Real: ID-token claims + device-local prefs (locale, furigana). | P0 | Account card, language, furigana, sign-out (explicit signing-out view). Theme follows system; an explicit theme toggle is a candidate enhancement (Batch 5). |
| `/[locale]/achievements`, gamification | Badges, streaks, milestones | partial in Progress | **Missing / Needs product decision** | Backend: `/api/gamification/*`. | P2 | Avoid fake badges/XP. Add only when gamification API is wired; product to confirm mobile shape. |

## E. Social / competitive / narrative

| Web route | Web feature | Mobile equivalent | Status | Data dependency | Priority | Approach / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/battle` | Real-time multiplayer quiz | — | **Missing / Needs product decision** | Backend + Socket.IO. | P3 (mobile) | Realtime battle is a large surface; defer until core content parity is done. Product to confirm mobile priority. |
| `/[locale]/career` | Career RPG / story arcs | — | **Missing / Needs product decision** | Backend: `/api/career/*`, `/api/story/*`. | P3 (mobile) | Narrative layer; defer. |
| `/[locale]/share/:token` | Public share cards | — | **N/A (mobile-first) / P3** | Backend: `/api/share/*`. | P3 | Sharing can be a system-share action later; viewing share pages is a web/public concern. |
| `/[locale]/feedback`, `help` | Help / feedback | — | **Missing** | Static + feedback API. | P3 | Add a lightweight Help/About entry in Settings (Batch 5). |
| `/[locale]/pricing` | Premium plans | — | **Missing** | Backend: billing. | P2 | Upgrade UX needs entitlements; defer; never frontend-only paywall. |
| `/[locale]/search` | Global Meilisearch search | — | **Missing** | Backend: `/api/vija/search`. | P2 | Defer to a search batch with the search API. |

## F. Admin / desktop-only — N/A (mobile)

The web app also exposes authoring, dashboards, and management surfaces (under
the admin app and desktop-oriented routes). These are **N/A (mobile)** for the
learner app and intentionally excluded from mobile parity.

---

## Summary

- **Mobile already has production parity on the core daily learner loop:** Home
  (real review/deck/sync), Learn→Lesson→Practice (preview content behind real
  interfaces), Review + Flashcard SRS (real, offline-capable), Progress
  (device-local real analytics), Settings/Profile (real identity + prefs),
  Auth (real Keycloak).
- **The main web breadth gaps are content/data features** (dictionary, kanji,
  grammar, news, magazine, scenarios, quiz exam mode, search, saved,
  gamification, billing, battle, career). Each needs a backend contract the
  mobile app does not yet call. Per production-first rules these are tracked as
  future batches with documented data contracts and honest preview/empty states
  — **not faked**.
- **Immediate, safe, code-verifiable parity/quality work** (this session): login
  narrow-width overflow fix, home tablet width cap, and UI/UX polish — see
  `MOBILE_PRODUCTION_COMPLETION_PLAN.md`.
