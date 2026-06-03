# Mobile Implementation Sequence (Batch 0 → 9)

Build order for web-feature parity on mobile. Each batch ends with
`flutter analyze` + `flutter test`. No batch starts before its data foundation
is clean. Status updated as batches land.

## Batch 0 — API rediscovery audit ✅ done
- `MOBILE_API_FEATURE_INVENTORY.md`, `MOBILE_WEB_API_PARITY_AUDIT.md`, this file.
- Outcome: all 13 features proven to have real APIs; "Missing API" retired.

## Batch 1 — Mobile data/API foundation ✅ done
- `core/api/api_client_provider.dart` — shared `apiClientProvider`
  (auth-token-aware), reused by every feature instead of per-feature clients.
- `core/api/paginated.dart` — pagination cursor helper (limit/offset).
- `core/api/repository_result.dart` — shared repository exception + JA/VI
  message mapping for 401/403/network/HTTP.
- `core/api/debouncer.dart` — search debounce.
- `core/content/*` — shared content models (Lexeme/Kanji/Grammar) + DTOs +
  `ContentRepository` (dictionary/kanji/grammar/search) on the existing
  public content API.
- Tests: DTO mapping, repository error mapping, debouncer, pagination.

## Batch 2 — Dictionary + Kanji + Grammar ✅ done
- `features/dictionary` — search + word detail.
- `features/kanji` — list/search + kanji detail (readings, strokes).
- `features/grammar` — list + grammar detail.
- Router: `/learn/dictionary`, `/learn/kanji`, `/learn/grammar` under Learn.
- Localized JA/VI strings; loading/empty/error/offline states.
- Tests for repos/providers + widget smoke.

## Batch 3 — BJT exam mode + Scenarios ⏳ next
- `features/exam` — `QuizRepository`, template list, full-screen session
  (timer, server scoring), result + breakdown. Reuse full-screen route pattern
  (outside shell). No bottom-nav/CTA overlap; clear timer states; no fake score.
- `features/scenarios` — list (category filter), play (step→choice→feedback),
  result summary, save/review.
- Open product question: full timed multi-section exam UX vs. single-template
  practice — start with template-driven session, document section UX.

## Batch 4 — News + Magazine + Career
- `features/news` — list (limit/offset pagination) + reader; bookmark/progress
  when auth wired.
- `features/magazine` — feed + article (sanitized HTML render).
- `features/career` — profile/rank + story arcs/chapters (optional auth).
- Premium reading typography; offline cache of opened articles.

## Batch 5 — Search + Saved items
- `features/search` — debounced global search over `/search` (+ suggest);
  route results into dictionary/kanji/grammar detail by `kind`.
- `features/saved` — bookmarks list (words/kanji/grammar tabs); toggle wired
  into content detail screens; optimistic with reconcile.
- Respect single-feature vs cross-feature search capability; no fabricated scope.

## Batch 6 — Gamification + Battle
- `features/gamification` — real streaks/achievements/leaderboard/study-goal.
  No fabricated points/badges; empty states when no data.
- `features/battle` — safe lobby: leaderboard, my stats, recent sessions, bots
  list. Real-time match deferred (Socket.IO) — documented open question.

## Batch 7 — Billing/subscription
- `features/billing` — subscription status + plans + premium-locked states from
  server entitlements only. Checkout via provider URL in browser; no in-app fake
  payment; no stored card data. Document native store-billing compliance gap.

## Batch 8 — Web/mobile UI/UX consistency polish
- Audit implemented features vs web: brand, icons, cards, chips, buttons, nav
  labels, states, typography, spacing, dark mode, small-screen, tablet width,
  long JA/VI text, touch targets. Fix without desktop-cloning.

## Batch 9 — Final docs + retest package
- Update parity matrix, completion audit, contract gap, known limitations, QA
  checklists; author `MOBILE_FULL_FEATURE_RETEST_PROMPT_FOR_CODEX.md`.
- Final verification: analyze, test, `git diff --check`, optional debug APK.

## Cross-cutting rules
- One shared `ApiClient` (auth-aware) — no per-feature HTTP clients going forward.
- Every repository maps 401/403/network/HTTP to localized learner messages.
- Every dynamic screen has loading (shimmer), empty (CTA), error (retry),
  offline (banner) states.
- No fabricated data; no fake scores/points/entitlements.
- JA line-height ≥ 1.8; VI line-height ≥ 1.5; furigana via reading-assist policy.
