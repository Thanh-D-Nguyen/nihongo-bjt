# Mobile ↔ Web Parity & Skill Roadmap

Status as of 2026-06-05. Tracks the work to bring `apps/mobile` (Flutter) to full
learner-feature parity with the web app, at production quality, using the
`.agents/skills/bjt-*` skills and `.github/prompts/*` prompts.

Scope: **learner-facing features only**. Admin stays web.

## How to use this roadmap

- For each domain, run `audit-mobile-parity.prompt.md` to produce
  `docs/mobile/<DOMAIN>_WEB_PARITY_AUDIT.md`.
- Then run `add-mobile-feature.prompt.md` (driven by the domain skill) to build
  the vertical slice.
- Gate every result with `mobile-qa-gate.prompt.md`.

## Skill inventory

Foundation (cross-cutting baseline referenced by all others):
- `bjt-mobile-foundation-quality-gate`

Existing domain skills (now registered with frontmatter):
- `bjt-mobile-app-shell-navigation`
- `bjt-mobile-home-dashboard`
- `bjt-mobile-profile-me-hub`
- `bjt-mobile-search-reference-hub`
- `bjt-mobile-sensory-design`
- `bjt-exam-practice-flow`
- `bjt-deck-flashcard-management`

New domain skills:
- P0: `bjt-mobile-reading-assist-layer`, `bjt-mobile-monetization-paywall`
  (entitlements/quotas/ads), `bjt-mobile-review-srs-hub`,
  `bjt-mobile-learn-lesson-flow`, `bjt-mobile-auth-account`
- P1: `bjt-mobile-onboarding-placement`, `bjt-mobile-battle-realtime`,
  `bjt-mobile-sharing-referral-postcard`,
  `bjt-mobile-progress-analytics-coaching`, `bjt-mobile-content-reading`,
  `bjt-mobile-daily-hub`
- P2: `bjt-mobile-gamification-streaks`, `bjt-mobile-offline-sync-strategy`,
  `bjt-mobile-notifications-push`

## Prompts

- `audit-mobile-parity.prompt.md` — web→mobile gap report per domain.
- `add-mobile-feature.prompt.md` — production vertical slice per feature.
- `mobile-qa-gate.prompt.md` — checklist + analyze/test gate.
- (existing) `implement-mobile-screen`, `polish-mobile-screen`,
  `review-mobile-screen`.

## Domain parity matrix (domain-level)

Legend: ✅ done · 🟡 partial · 🔴 missing · ⛔ not mobile-appropriate.

| Domain | Mobile route | Governing skill | Status |
|---|---|---|---|
| Home / daily hub | `/` | home-dashboard | ✅ |
| Lessons / study | `/learn`, `/learn/lesson/:id` | learn-lesson-flow | 🟡 |
| Learning paths (adaptive) | `/learn` | learn-lesson-flow | 🟡 |
| Practice | `/practice/:id` | exam-practice-flow | ✅ |
| Quiz / mock exam | `/learn/exam` | exam-practice-flow | ✅ |
| Review / SRS | `/review` | review-srs-hub | 🟡 |
| Flashcards | `/review/flashcards/*` | deck-flashcard-management | ✅ |
| Dictionary | `/search/dictionary` | search-reference-hub | ✅ |
| Kanji | `/search/kanji` | search-reference-hub | ✅ |
| Grammar | `/search/grammar` | search-reference-hub | ✅ |
| Global search | `/search` | search-reference-hub | ✅ |
| Saved / bookmarks | `/search/saved` | search-reference-hub | 🟡 |
| Scenarios | `/learn/scenarios` | content-reading | 🟡 |
| News | `/learn/news` | content-reading | 🟡 |
| Magazine | `/learn/magazine` | content-reading | 🟡 |
| Career | `/learn/career` | content-reading | 🟡 |
| Progress / analytics / coaching | `/me/progress` | progress-analytics-coaching | 🟡 |
| Gamification / streaks | `/learn/rewards` | gamification-streaks | 🟡 |
| Billing / subscription | `/me`, `/subscription` | monetization-paywall | 🟡 |
| Profile / settings | `/me`, `/settings/*` | profile-me-hub | ✅ |
| Auth (login/register/social/reset/linked) | login/register/`/settings/accounts` | auth-account | 🟡 |
| Daily hub (phrase/standup/daily-life) | `/daily`, `/daily-standup` | daily-hub | 🔴 |
| Reading Assist layer | `JapaneseText` | reading-assist-layer | � lookup sheet + add-to-flashcard wired (dictionary); inline content source pending |
| ViJa | — | content-reading / search | 🔴 |
| Battle (realtime) | — | battle-realtime | 🔴 |
| Onboarding / placement | `/onboarding` | onboarding-placement | 🔴 |
| Sharing / referral / postcard / public profile | `/share`, `/u/[id]`, `/cardgen` | sharing-referral-postcard | 🔴 |
| Ads | (config-driven placements) | monetization-paywall | 🔴 |
| Notifications / push | `/settings/notifications` | notifications-push | 🔴 |
| Offline / sync | core (drift) | offline-sync-strategy | 🔴 |

## Phased execution

Each phase: audit → implement (vertical slice) → QA gate. Verify with
`flutter analyze` + `flutter test`, 320 dp + large width, light/dark, vi/ja.

- **P0-A — Skill hygiene (DONE):** fixed `SKILL.md` filename bug; added
  frontmatter to 7 existing skills; created foundation + 12 new skills; added 3
  prompts.
- **P0-B — Core learner depth:** reading-assist layer, monetization/paywall,
  review/SRS hub, learn/lesson flow. Audit each domain first.
  - Reading-assist interactive lookup layer **delivered** (tap → reading +
    meaning sheet + add-to-flashcard hook, exam-gated via `allowsLookup`;
    `ReadingDetailSheet`; vi/ja i18n; 15/15 tests, analyze clean). See
    `READING_ASSIST_WEB_PARITY_AUDIT.md`.
  - Add-to-flashcard **wired** to the real deck API: `AddTermToDeck` use-case
    (append card, preserve existing + metadata, server-side user) +
    `addTermToDeckProvider` + `showAddTermToFlashcardSheet` deck picker,
    surfaced on the dictionary word page. 6 use-case tests, analyze clean.
    Next: a dictionary meaning source for inline content terms.
  - Review/SRS: **typed-recall review mode delivered** — odd-indexed cards use a
    typing field auto-graded (katakana→hiragana fold + edit-distance) mapped to
    SRS ratings (correct→good, almost→hard, wrong→again), matching the web
    review session's flip/type modes. `typed_answer_grading.dart`,
    `review_mode.dart`, `reviewType*` vi/ja i18n, 11 unit + 2 widget tests,
    analyze clean. (Web "match" mode stays web-only: needs server distractors.)
  - Review/SRS: **exam-mistake remediation delivered** — exam review screen
    offers "create a review deck" from wrong answers with explanations
    (`AddMistakesToDeck` → real `createDeck` + `saveDeckCards`). 4 use-case + 2
    widget tests, analyze clean.
  - Learn/lesson: **prev/next lesson navigation delivered** — `_LessonNav` at the
    bottom of lesson detail surfaces sibling lessons in the same category
    (`lessonNeighborsProvider`), `pushReplacement` to keep the back stack clean,
    `lessonNav*` vi/ja i18n, 3 widget tests, analyze clean.
  - Saved / bookmarks: **saved-date display delivered** — each saved tile now
    shows the locale-aware bookmark date (`BookmarkItem.createdAt`,
    `savedSavedOn` `yMMMd` placeholder; hidden when null), matching the web
    saved list. 1 widget test, analyze clean.
  - Progress / analytics: **coaching "next step" card delivered** — Progress tab
    fetches real learner analytics (`GET /api/analytics/learner?days=7`) and
    renders one recommended action (review due / short BJT) + an encouraging
    nudge, reproducing the web `pickPrimaryAction`/`pickNudgeMessage` logic 1:1
    (`coaching_snapshot.dart`, `coachingSnapshotProvider`, `progressCoaching*`
    vi/ja i18n). Hidden in mock/dev and when there's no signal — no fabricated
    metrics. 16 unit + 2 widget tests, analyze clean.
  - News / reading: **published-date on article detail delivered** — the article
    metadata row now shows the `publishedAt` date (schedule-icon `ContentTag`,
    local `YYYY-MM-DD`, hidden when null), matching the web reader and the
    mobile list tile. Data already in the DTO; no backend change. 1 widget test,
    analyze clean.
  - Magazine / reading: **published-date on article reader delivered** — the
    detail metadata `Wrap` now shows the `publishDate` (schedule-icon
    `ContentTag`, local `YYYY-MM-DD`, hidden when null) alongside the JLPT tag,
    matching the web `magazine-article-view` `<time>` element. Data already in
    the DTO; no backend change. 1 widget test, analyze clean.
  - Scenarios / reading: **play-attempt count on browser cards delivered** — each
    scenario card now shows the `attemptCount` (`sports_esports` `ContentTag`,
    `scenarioAttemptCount` vi/ja i18n) next to duration/steps, mirroring the web
    list's `🎮 X lượt chơi` metadata. Data already in the DTO; no backend change.
    First scenarios widget test added, analyze clean.
  - Career / reading: **required-rank eyebrow on arc cards delivered** — each
    mission-arc card now shows the entry rank (`rankCodeEntry`) as an uppercase
    eyebrow above the title (`careerArcRankRequired` vi/ja i18n), mirroring the
    web `mission-arc-card` "Yêu cầu rank" label so the entry rank is visible for
    unlocked arcs too (previously only shown in the locked hint). Data already in
    the DTO; no backend change. 1 widget test added, analyze clean.
  - Magazine / reading: **published-date on list cards delivered** — each magazine
    list card now shows the `publishDate` (schedule-icon `ContentTag`, local
    `YYYY-MM-DD`, hidden when null) in the metadata `Wrap`, matching the web
    `magazine-page-client` card `<time>` and the mobile detail reader. Data
    already in the DTO; no backend change. 1 widget test added, analyze clean.
  - Learn / daily lesson: **reading + question-count on the daily card delivered**
    — the home daily-lesson card now shows the kana `titleReading` under the
    Japanese title (hidden when empty) and a `learnQuestionCount`
    (`quiz_outlined` `_MetaChip`) when the lesson has questions, matching the
    lesson detail page which already surfaces both. Data already in the `Lesson`
    domain; no backend change, no new i18n. 1 widget test added, analyze clean.
  - Gamification / streaks: **activity calendar heatmap on streak cards
    delivered** — each streak card now renders a 12-week (84-day) GitHub-style
    heatmap reconstructed from the server-authoritative `lastActivityDate` +
    `currentStreak` (active = the streak run ending at last activity), mirroring
    the web `StreakCalendar` (`rewardsStreakCalendar` vi/ja i18n). Hidden when
    there's no `lastActivityDate`; no fabricated data, no backend change. 2
    widget tests added, analyze clean.
  - Gamification / achievements: **tier + category caption on achievement cards
    delivered** — each achievement card now shows a `tier • category` caption
    under the name (e.g. "Vàng • Học tập"), localized via select-based
    `rewardsAchievementTierLabel` / `rewardsAchievementCategoryLabel` vi/ja
    i18n, mirroring the web achievements card subtitle. Data
    (`activeTier.tier`, `category`) already in the DTO; no backend change. 1
    widget test added, analyze clean.
  - Gamification / leaderboards: **avatar initial on ranking rows delivered** —
    each leaderboard rank row now shows a circular avatar with the first letter
    of the entrant's `displayName` (accent-soft circle, `?` fallback for
    anonymous), mirroring the web ranking row's initial avatar. Data already in
    the DTO; no backend change, no new i18n. Existing leaderboard test extended.
    analyze clean.
  - Progress / coaching: **server-derived coaching insight delivered** — the
    Progress "next step" card now renders the localised `insight` string from
    `GET /api/analytics/learner` (already fetched, previously dropped) in an
    accent-soft block under the nudge. The provider now passes `locale=vi|ja`
    so the insight matches the displayed language; the line hides when empty.
    No backend change, no fabricated text. 2 tests extended (parse + render),
    analyze clean.
  - Search / reference (kanji): **kanji frequency-rank badge delivered** — the
    kanji detail header now shows a `Tần suất #N` / `頻度 #N` `ContentTag`
    (next to strokes + JLPT level) when `KanjiEntry.frequency` is non-null,
    matching the web kanji detail's frequency stat. Field already parsed in the
    mobile DTO; no backend change. New `kanji_detail_page_test.dart` with 2
    tests (shows when present / hides when null), analyze clean.
  - Search / reference (dictionary): **short-meaning gloss delivered** — the
    dictionary word detail now renders `Lexeme.shortMeaningVi` as a bold
    one-line gloss under the reading (when non-null), matching the web lexeme
    detail. Field already parsed in the mobile DTO; no backend change, no new
    i18n (value-only, like web). New `dictionary_word_page_test.dart` with 2
    tests (shows / hides), analyze clean.
  - Search / reference (grammar): **grammar category delivered** — the grammar
    detail now renders `GrammarEntry.category` as a tertiary caption under the
    meaning (when non-null), matching the web grammar detail's secondary tag.
    Field already parsed in the mobile DTO; no backend change, no new i18n
    (value-only). New `grammar_detail_page_test.dart` with 2 tests, analyze
    clean.
  - Search / reference (kanji): **example Han-Viet reading delivered** — each
    kanji example word now shows its `hanViet` (Hán-Việt) reading next to the
    kana reading (when non-null), matching the web kanji detail's example
    `hanViet` span. Field already parsed in the mobile DTO; no backend change,
    no new i18n (value-only). `kanji_detail_page_test.dart` extended with a
    third test, analyze clean.
  - Gamification (leaderboard): **short user-id fallback delivered** — a
    leaderboard entry with no `displayName` now shows `Người dùng {id}` /
    `ユーザー {id}` (first 6 chars of `userId`) plus an avatar initial from that
    id, matching the web achievements leaderboard fallback. `userId` already
    parsed in the mobile DTO; no backend change. New i18n key
    `rewardsLeaderboardUserFallback` (vi + ja); leaderboard test extended,
    analyze clean.
- **P1-A — Missing features:** onboarding/placement, battle (realtime),
  sharing/referral/postcard, progress/analytics/coaching, content reading.
- **P1-B — Wire entries:** surface battle / share / onboarding entry points in
  Home and Me; verify active-tab mapping and no dead cards.
- **P2 — Platform foundation:** offline/sync strategy, notifications/push,
  gamification/streaks.
- **P3 — Whole-app QA gate:** run `mobile-qa-gate.prompt.md` across the app.

## Cross-cutting risks

- **Exam integrity:** reading-assist must hide meanings during active timed exam
  (except practice/help/post-answer). Enforced centrally in the reading-assist
  layer.
- **Entitlement:** paywall reads server contract only; no hardcoded `isPremium`.
- **Offline sync:** drift is a cache; PostgreSQL is canonical. Replay must not
  corrupt SRS/progress.
- **Share privacy:** no private learning data in share URLs/OG metadata.
- **Battle:** confirm the Socket.IO event contract before building; document
  runtime verification as blocked-with-proof if backend is unreachable.

## Open questions for product/backend

- Do Battle / ViJa / onboarding-placement have ready web APIs? If a backend is
  down at runtime, build against the real contract and mark runtime verification
  blocked.
- Are FCM/APNs configured for push, or is notifications scope local-only for now?
