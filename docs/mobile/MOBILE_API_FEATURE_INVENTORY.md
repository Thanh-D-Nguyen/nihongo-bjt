# Mobile API Feature Inventory

> **Correction notice.** Earlier mobile parity docs (and
> `WEB_MOBILE_FEATURE_PARITY_MATRIX.md`) marked Dictionary, Kanji, Grammar, BJT
> exam mode, News, Magazine, Scenarios, Search, Saved items, Gamification,
> Billing/subscription, Battle and Career as **"Missing API / Backend not
> wired"**. That classification was **wrong**. Every one of those features has a
> real, learner-facing backend controller already shipped in `apps/api/src` and
> already consumed by the web app. This document is the corrected, proof-backed
> inventory produced during the API rediscovery audit (Batch 0).

Owner: mobile production track. Companion docs:
`MOBILE_WEB_API_PARITY_AUDIT.md` (per-feature audit + classification),
`MOBILE_IMPLEMENTATION_SEQUENCE.md` (build order).

## How the contracts were proven

- Backend controllers enumerated via `@Controller("…")` decorators in
  `apps/api/src/**/*.controller.ts`.
- Response shapes read from the controllers' services/repositories
  (e.g. `apps/api/src/content/content.repository.ts`).
- Web usage confirmed in `apps/web` (`lib/learner-api.ts` +
  feature components/hooks).
- Shared request schemas read from `packages/shared/src/index.ts`.

## Auth model (shared by all learner endpoints)

- Backend guard: `@UseGuards(KeycloakAuthGuard)` resolves the learner from the
  verified bearer token; `@CurrentUser()` injects identity.
- Public/content endpoints (Dictionary, Kanji, Grammar, Search, News, Magazine)
  have **no guard** — readable without a token. User-scoped actions on them
  (bookmark, reading progress, flashcard creation) require a token.
- Mobile already attaches the bearer token through
  `ApiClient(accessTokenProvider: …)` (see
  `features/flashcards/presentation/flashcard_providers.dart`). The mobile
  `ApiClient.getJson/postJson` surface is sufficient for every endpoint below.
- Dev override: some controllers accept a `userId` query/body when Keycloak is
  disabled. **Mobile must never send a `userId` it forged** — it relies on the
  bearer token; `userId` is only used where the server requires it as a query
  param for an otherwise-public endpoint.

---

## Feature → endpoint inventory

Base path prefix: `/api`. All paths below are appended to `apiBaseUrl`.

### 1. Dictionary — `content/canonical-content.controller.ts`

| Endpoint | Method | Auth | Request | Response (key fields) |
| --- | --- | --- | --- | --- |
| `/dictionary/search` | GET | public | `q` (req), `limit≤20` | `Lexeme[]`: `id, headword, reading, jlptLevel, shortMeaningVi, senses[]{id, position, glossVi, partOfSpeech}` |
| `/dictionary/words/:id` | GET | public | `id` | `Lexeme` + `senses[]{ exampleLinks[]{ exampleSentence{ japaneseText, reading, translationVi } } }` |
| `/vija/search` | GET | public | `q` (VI), `limit≤20` | `LexemeReverseProjection[]`: `vietnameseHeadword, candidates[]{ japaneseText, … }` |
| `/examples/by-word/:wordId` | GET | public | `wordId`, `limit` | `ExampleSentence[]`: `japaneseText, reading, translationVi` |

### 2. Kanji — `content/canonical-content.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/kanji` | GET | public | `q`/`level`, `limit` | `Kanji[]`: `id, character, meaningVi, onyomi, kunyomi, strokeCount, level, frequency, components[]{position,…}, examples[]{position,…}` |
| `/kanji/search` | GET | public | `q`, `limit` | `Kanji[]` |
| `/kanji/:id` | GET | public | `id` | `Kanji` (+ full `components[]`, `examples[]`) |
| `/kanji/:id/stroke` | GET | public | `id` | `image/svg+xml` stream (stroke order) |

### 3. Grammar — `content/canonical-content.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/grammar` | GET | public | `q`/`level`, `limit` | `GrammarPoint[]`: `id, pattern, meaningVi, jlptLevel, details[]{position, explanationVi, …}` |
| `/grammar/:id` | GET | public | `id` | `GrammarPoint` + full `details[]` |

### 4. BJT exam mode — `quiz/quiz.controller.ts` (+ assessment admin)

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/quiz/templates` | GET | public | — | `{ id, name, sections, questions }[]` |
| `/quiz/templates/:id` | GET | public | `id` | template detail |
| `/quiz/official-simulation/status` | GET | token | `userId` | `{ allowed, reason? }` |
| `/quiz/start` | POST | token | `{ testId, userId }` | `{ id, testId, userId, startedAt, status }` |
| `/quiz/session/active` | GET | token | `userId` | active session or null |
| `/quiz/session/history` | GET | token | `userId, limit` | session list |
| `/quiz/session/:id/question` | GET | token | `id, userId` | `{ id, text, options[]{key,label}, section, number, timeLimit }` |
| `/quiz/session/:id/answer` | POST | token | `{ questionId, optionKey, userId }` | `{ correct, explanation, nextQuestion? }` |
| `/quiz/session/:id/results` | GET | token | `id, userId` | `{ score, percentage, passed, sections[] }` |
| `/quiz/session/:id/results/breakdown` | GET | token | `id, userId` | detailed breakdown |

### 5. Scenarios — `content/business-scenario.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/scenarios` | GET | token | `category?` | `{ id, title, category, description, steps }[]` |
| `/scenarios/:scenarioId` | GET | token | `scenarioId` | `{ id, title, steps[]{id,text,choices}, metadata }` |
| `/scenarios/steps/:stepId/answer` | POST | token | `{ choiceKey }` | `{ correct, feedback, points }` |
| `/scenarios/:scenarioId/complete` | POST | token | `{ choices[] }` | `{ completed, score, rewards }` |
| `/scenarios/:scenarioId/attempts` | GET | token | `scenarioId` | `{ attempts[], userStats }` |

### 6. News (NHK) — `nhk-news/nhk-news.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/nhk-news` | GET | public | `limit, offset, type, locale` | `{ articles[]{ id, title, url, summary, imageUrl, difficulty, readingTime }, total }` |
| `/nhk-news/:id` | GET | public | `id, locale?` | `{ id, title, fullText, imageUrl, readingLevel, publishedAt }` |
| `/nhk-news/:id/bookmark` | POST/GET | token | `id` | `{ bookmarked }` |
| `/nhk-news/:id/reading` | POST | token | progress | `{ ok }` |
| `/nhk-news/reading/progress` | GET | token | `articleIds` | `{ progress }` |

### 7. Magazine — `magazine/magazine.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/magazine` | GET | public | `kind, locale, page, limit` | `{ articles[], total, pageCount }` |
| `/magazine/:slug` | GET | public | `slug` | `{ id, slug, title, bodyHtml, publishedAt, readTime }` |
| `/magazine/:slug/read` | POST | token | `{ quizResults? }` | `{ ok, reason? }` |

### 8. Gamification — `gamification/gamification.controller.ts`

Learner subset (more exist): `/gamification/streaks`,
`/gamification/achievements/browse`, `/gamification/achievements/me/pending`,
`/gamification/leaderboards`, `/gamification/leaderboards/:id`,
`/gamification/study-goal`, `/gamification/study-plan/today`,
`/gamification/login-bonus`. All `token`. Shapes in the audit doc.

### 9. Billing/subscription — `monetization/learner-monetization.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/learner/monetization/summary` | GET | token | `userId` | `{ enforcementEnabled, entitlements[], flashcardDay, planSlug }` |
| `/learner/monetization/plans` | GET | public | — | `{ plans[]{ id, slug, nameKey, config, entitlements[], quotas[] } }` |
| `/learner/monetization/checkout` | POST | token | `{ planSlug, userId }` | `{ sessionId, provider, checkoutUrl?, sessionSecret? }` |

### 10. Battle — `battle/battle.controller.ts`

`/battle/leaderboard`, `/battle/player-stats`, `/battle/stats`, `/battle/bots`,
`/battle/sessions/recent`, `/battle/configs/available`. Live match is Socket.IO,
not REST. Shapes in the audit doc.

### 11. Career — `career-rpg/career-rpg.controller.ts`

`/career/me`, `/career/clock-in`, `/career/ranks`, `/career/inbox` and
`/story/arcs`, `/story/arcs/:slug`, `/story/chapters/:id`,
`/story/chapters/:id/attempts`. Optional auth (`@KeycloakAuthOptional`).

### 12. Search — `search/search.controller.ts` (+ `vija`)

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/search` | GET | public | `q, limit≤20, scope?, level?` | `{ results[]{ id, kind, title, reading, description?, jlptLevel? } }` |
| `/search/suggest` | GET | public | `q, limit≤10` | `{ suggestions[] }` |
| `/vija/search` | GET | public | `q, limit` | reverse VI→JP results |

### 13. Saved items / Bookmarks — `bookmarks/bookmarks.controller.ts`

| Endpoint | Method | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `/bookmarks/check/:type/:id` | GET | token | `type, id, userId` | `{ bookmarked }` |
| `/bookmarks/:type/:id` | POST | token | `type, id, userId` | `{ bookmarked }` (toggle) |
| `/bookmarks/words` | GET | token | `userId, limit≤50` | `{ bookmarks[], total }` |
| `/bookmarks/kanji` | GET | token | `userId, limit≤50` | `{ bookmarks[], total }` |
| `/bookmarks/grammar` | GET | token | `userId, limit≤50` | `{ bookmarks[], total }` |

`type ∈ { word, lexeme, kanji, grammar }`.

---

## Shared request schemas (`packages/shared/src/index.ts`)

`searchQuerySchema {q,limit,scope?,level?}`,
`searchSuggestQuerySchema {q,limit}`,
`paginationQuerySchema {limit,offset,q}`,
`userScopedQuerySchema {userId,limit}`,
`bookmarkParamsSchema {type,id}`,
`startQuizSchema {testId,userId}`,
`submitQuizAnswerSchema {questionId,optionKey,userId}`,
`monetizationUserQuerySchema {userId}`,
`monetizationCheckoutSchema {planSlug,userId}`,
`battleLearnerLeaderboardQuerySchema {window?,page,pageSize}`.

---

## Bottom line

**No feature in scope is "Missing API".** All have real backends already used by
web. The mobile work is purely **client-side**: build typed DTOs, repositories,
providers, and screens that call these existing contracts — with honest
loading/empty/error/offline states and localized JA/VI copy. The corrected
per-feature classification is in `MOBILE_WEB_API_PARITY_AUDIT.md`.
