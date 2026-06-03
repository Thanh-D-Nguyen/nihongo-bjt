# Mobile ↔ Web API Parity Audit (Batch 0 rediscovery)

Corrected classification of the 13 features that earlier docs wrongly marked as
"Missing API". Proof of API existence is in `MOBILE_API_FEATURE_INVENTORY.md`.

**Classification legend** (per the rediscovery mandate — "Missing API" is
forbidden unless proven by repo search, and none qualify):

- **Ready** — Ready to implement now (public/content API, no extra wiring).
- **Adapter** — API exists, needs a mobile client adapter (DTO/repo/provider).
- **Auth-wiring** — API exists, needs auth/session/`userId` wiring on mobile.
- **Product-UX** — API exists, needs a product decision for mobile UX shape.
- **N/A** — Not applicable to the mobile learner surface.

Every row's data dependency is **"API exists (proven)"** — the only variable is
mobile client work.

---

## Per-feature audit

### Dictionary — **Ready**
- Web: `/[locale]/dictionary`, `search-client.tsx`, `saved-page-client.tsx`
  (`/dictionary/words/:id`).
- API: `/dictionary/search`, `/dictionary/words/:id`, `/examples/by-word/:id`,
  `/vija/search`. Public, no auth.
- Request/response: `Lexeme` + `senses[]` + example links (see inventory).
- Mobile need: `DictionaryRepository` + `ContentApiClient` adapter, search
  provider (debounced), list + detail pages.
- Existing mobile status: none (reading-assist `JapaneseText` exists, no browser).
- Caching/offline: cache last query results + opened detail (drift) for offline
  re-read; search itself is online.
- UI screens: search entry, results list, word detail.
- Priority: **P1**. Risk: low. Test: DTO mapping, repo guard, search provider.

### Kanji — **Ready**
- Web: `/[locale]/kanji`.
- API: `/kanji`, `/kanji/search`, `/kanji/:id`, `/kanji/:id/stroke` (SVG). Public.
- Mobile need: `KanjiRepository` adapter, list/detail pages, SVG stroke via
  network image (`flutter_svg` if available, else server-rendered PNG fallback —
  verify pubspec).
- Caching/offline: cache list + detail; stroke SVG cached by HTTP layer.
- UI: kanji grid/list, detail (readings on/kun, stroke count, components, examples).
- Priority: **P1**. Risk: low–medium (SVG rendering dependency). Test: DTO + repo.

### Grammar — **Ready**
- Web: `/[locale]/grammar`.
- API: `/grammar`, `/grammar/:id`. Public.
- Mobile need: `GrammarRepository` adapter, list/detail pages.
- Caching/offline: cache list + opened detail.
- UI: grammar list (pattern + JLPT chip), detail (pattern, meaning, details[]).
- Priority: **P1**. Risk: low. Test: DTO + repo.

### Search — **Adapter**
- Web: `/[locale]/search` (Meilisearch projection).
- API: `/search`, `/search/suggest`, `/vija/search`. Public.
- Mobile need: `SearchRepository` adapter, debounced query provider, results
  routed into dictionary/kanji/grammar detail by `kind`.
- Caching/offline: recent searches local; results online.
- UI: search field, suggestions, typed result rows.
- Priority: **P1** (pairs with dictionary). Risk: low. Test: DTO + debounce.

### Saved items / Bookmarks — **Auth-wiring**
- Web: `saved-page-client.tsx`, `content-actions.tsx`.
- API: `/bookmarks/*`. Token required; `userId` query needed.
- Mobile need: resolve current `userId` from auth session, `BookmarksRepository`,
  toggle action wired into dictionary/kanji/grammar detail + saved list page.
- Caching/offline: optimistic toggle with reconcile; saved list cached.
- UI: saved list (tabs: words/kanji/grammar), bookmark toggle on details.
- Priority: **P1**. Risk: low–medium (auth userId resolution). Test: repo + toggle.

### BJT exam mode — **Auth-wiring** (+ Product-UX for full timed exam)
- Web: `/[locale]/quiz`.
- API: `/quiz/templates` (public), `/quiz/start`, `/quiz/session/:id/*` (token).
- Mobile need: `QuizRepository`, exam template list, session flow (full-screen
  focus, timer, server scoring), result/review. Reuse existing full-screen
  practice pattern (outside the shell, no bottom-nav overlap).
- Caching/offline: exam is online (server scoring). Templates cacheable.
- UI: exam list, exam intro, question player, timer, result + breakdown.
- Priority: **P1** (high BJT value). Risk: medium (session/timer correctness).
  Test: session state machine, answer submission mapping.

### Scenarios — **Auth-wiring**
- Web: `scenario-list-client.tsx`, `scenario-play-client.tsx`.
- API: `/scenarios`, `/scenarios/:id`, step answer, complete. Token.
- Mobile need: `ScenarioRepository`, list + play flow (step → choice → feedback
  → complete summary).
- UI: scenario list (category filter), play (dialog steps), result.
- Priority: **P2**. Risk: medium. Test: repo + play state.

### News (NHK) — **Ready** (read) / **Auth-wiring** (bookmark/progress)
- Web: `nhk-news-list-client.tsx`, `nhk-article-detail-client.tsx`.
- API: `/nhk-news`, `/nhk-news/:id` (public); bookmark/progress (token).
- Mobile need: `NewsRepository`, list (pagination via limit/offset) + reader.
- Caching/offline: cache list page + opened article for offline reading.
- UI: news list, article reader (JA body, VI summary, reading-assist).
- Priority: **P2**. Risk: low. Test: pagination + DTO.

### Magazine — **Ready** (read) / **Auth-wiring** (read-mark)
- Web: `magazine/page.tsx`, `magazine/[slug]/page.tsx`.
- API: `/magazine` (public list), `/magazine/:slug` (detail). bodyHtml.
- Mobile need: `MagazineRepository`, list + article (render sanitized HTML).
- Caching/offline: cache list + opened article.
- UI: magazine feed, article reader.
- Priority: **P2**. Risk: medium (HTML rendering). Test: pagination + DTO.

### Career — **Auth-wiring** (optional auth)
- Web: `features/career-rpg/api.ts`.
- API: `/career/*`, `/story/*`. Optional auth.
- Mobile need: `CareerRepository`, profile/rank screen, story arcs/chapters.
- UI: career dashboard, story arc list, chapter detail.
- Priority: **P3** (narrative). Risk: medium. Test: repo + DTO.

### Gamification — **Auth-wiring** (+ Product-UX for widget selection)
- Web: `achievements-page-client.tsx`, multiple widgets.
- API: `/gamification/*`. Token.
- Mobile need: `GamificationRepository`, dashboard surfacing **real** streaks,
  achievements, leaderboard, study goal. No fabricated XP/badges.
- UI: gamification/achievements page; streak + badge + leaderboard cards.
- Priority: **P2**. Risk: low–medium. Test: repo + DTO. Product to confirm which
  widgets belong on mobile (login-bonus, mystery-box, pet are candidates).

### Battle — **Product-UX** (REST supporting endpoints) / Socket.IO deferred
- Web: `battle-lobby-leaderboard.tsx`, `battle-runtime-provider.tsx`.
- API REST: `/battle/leaderboard`, `/battle/player-stats`, `/battle/bots`,
  `/battle/sessions/recent`, `/battle/configs/available`. Live match: Socket.IO.
- Mobile need: safe **entry + leaderboard + recent-sessions + stats** screens
  now; real-time match needs a Socket.IO client + product decision.
- UI: battle lobby (leaderboard, my stats, recent), match deferred.
- Priority: **P3**. Risk: high for live match (realtime). Test: repo + DTO.
  Open question: is real-time PvP in mobile scope? Document, don't fake matches.

### Billing/subscription — **Auth-wiring** (+ native billing open question)
- API: `/learner/monetization/summary` (token), `/plans` (public),
  `/checkout` (token, Stripe/local).
- Mobile need: `MonetizationRepository`, subscription status + plan list +
  premium-locked states driven by **server entitlements only**. Checkout opens
  the provider URL in a browser; **no in-app fake payment**.
- UI: subscription status card, plans, premium-locked overlays.
- Priority: **P2**. Risk: medium (App Store/Play billing policy). Test: repo + DTO.
  **Open native question:** iOS/Android store policy may require StoreKit/Play
  Billing for digital goods. Web Stripe checkout link may be rejected on iOS.
  Document; do not ship a non-compliant flow.

---

## Summary matrix

| Feature | Classification | Priority | Auth | Batch |
| --- | --- | --- | --- | --- |
| Dictionary | Ready | P1 | public | 2 |
| Kanji | Ready | P1 | public | 2 |
| Grammar | Ready | P1 | public | 2 |
| Search | Adapter | P1 | public | 5 |
| Saved/Bookmarks | Auth-wiring | P1 | token | 5 |
| BJT exam mode | Auth-wiring/Product-UX | P1 | token | 3 |
| Scenarios | Auth-wiring | P2 | token | 3 |
| News | Ready/Auth-wiring | P2 | mixed | 4 |
| Magazine | Ready/Auth-wiring | P2 | mixed | 4 |
| Career | Auth-wiring | P3 | optional | 4 |
| Gamification | Auth-wiring/Product-UX | P2 | token | 6 |
| Battle | Product-UX | P3 | token | 6 |
| Billing | Auth-wiring/native-open | P2 | token | 7 |

No row is "Missing API". The remaining work is mobile client implementation,
sequenced in `MOBILE_IMPLEMENTATION_SEQUENCE.md`.
