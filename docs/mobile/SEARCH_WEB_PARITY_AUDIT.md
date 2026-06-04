# Search / Reference Hub — Web ↔ Mobile Parity Audit

Status: **Batch 0 — Audit** (no code changed in this doc).
Scope: Global Search, Dictionary, Kanji, Grammar, Saved/Bookmarks, Recent searches.

This audit is evidence-based. Every endpoint and gap below was verified against
the repo. Nothing is marked "missing" unless repo search proved it absent.

---

## 1. Summary

The mobile Search / Reference Hub is **already ~80% implemented and
production-grade**. It is not a stub. The existing mobile code:

- Has a real global Search screen backed by `/api/search`
  ([search_page.dart](../../apps/mobile/lib/features/search/presentation/search_page.dart)).
- Has real Dictionary / Kanji / Grammar browse + detail screens backed by the
  canonical content API.
- Has a real Saved (bookmarks) screen backed by `/api/bookmarks/*`.
- Has a shared, debounced search field (300 ms) and full
  idle / loading / empty / error states.
- Has VI + JA localization and widget tests for the main flows.

Therefore the mission is **gap-filling + polish + tests + docs**, not a rewrite.
Per the skill rule, existing working screens are not redone unless required.

---

## 2. Endpoint reality (verified in `apps/api`)

Both the `/dictionary|/kanji|/grammar` family (used by mobile) **and** the
`/content/*` family (used by web) exist. Mobile's choice is valid.

| Capability | Endpoint (verified) | Source |
| --- | --- | --- |
| Global search | `GET /api/search?q=&limit=&scope=&level=` | [search.controller.ts](../../apps/api/src/search/search.controller.ts) |
| Search suggest | `GET /api/search/suggest?q=&limit=` | same |
| Dictionary search | `GET /api/dictionary/search?q=&limit=` | [canonical-content.controller.ts](../../apps/api/src/content/canonical-content.controller.ts) |
| Dictionary detail | `GET /api/dictionary/words/:id` | same |
| Kanji list/search | `GET /api/kanji?q=&limit=&offset=` | same |
| Kanji detail | `GET /api/kanji/:id` | same |
| Kanji stroke SVG | `GET /api/kanji/:id/stroke` | same |
| Grammar list | `GET /api/grammar?q=&limit=&offset=` | same |
| Grammar detail | `GET /api/grammar/:id` | same |
| Bookmarks list | `GET /api/bookmarks/{words|kanji|grammar}?limit=` | [bookmarks.controller.ts](../../apps/api/src/bookmarks/bookmarks.controller.ts) |
| Bookmark toggle | `POST /api/bookmarks/{word|kanji|grammar}/:id` | same |

`/api/search` returns either a bare list or `{ results: [...] }`; mobile's
repository already tolerates both
([content_repository.dart](../../apps/mobile/lib/core/content/data/content_repository.dart)).

---

## 3. Feature-by-feature parity

Legend: ✅ at parity · ⚠️ partial · ❌ missing on mobile.

### 3.1 Global Search

| Capability | Web | Mobile | Status |
| --- | --- | --- | --- |
| Query input + debounce | 350 ms | 300 ms (`ContentSearchField`) | ✅ |
| Backed by `/api/search` | Yes | Yes (`contentSearchProvider`) | ✅ |
| Idle / loading / empty / error | Yes | Yes | ✅ |
| Result → detail navigation | Yes | Yes (lexeme/kanji/grammar) | ✅ |
| Result kind filter (all/word/kanji/grammar/example) | Yes (client tabs) | No | ⚠️ |
| Recent searches | localStorage, max 8 | None | ❌ |
| Suggest autocomplete (`/search/suggest`) | Yes (dropdown) | None | ❌ |
| `scope` / `level` query params | Yes | Not sent | ⚠️ |
| Lookup-tools hub (idle) | Implicit | Yes (`_SearchToolsHub`) | ✅ (mobile ahead) |

### 3.2 Dictionary

| Capability | Web | Mobile | Status |
| --- | --- | --- | --- |
| Search list | `/api/content/lexemes` | `/api/dictionary/search` | ✅ (equivalent) |
| Detail | Yes | Yes (`DictionaryWordPage`) | ✅ |
| Headword/reading/JLPT/gloss/senses/examples | Yes | Yes | ✅ |
| Bookmark toggle on detail | Yes | No | ❌ |

### 3.3 Kanji

| Capability | Web | Mobile | Status |
| --- | --- | --- | --- |
| Browse/search | Yes | Yes (`KanjiBrowserPage`) | ✅ |
| Detail (readings, components, examples) | Yes | Yes | ✅ |
| Stroke-order SVG | Yes | Yes (live `/stroke`) | ✅ |
| Bookmark toggle on detail | Yes | No | ❌ |

### 3.4 Grammar

| Capability | Web | Mobile | Status |
| --- | --- | --- | --- |
| Browse/search | Yes | Yes (`GrammarBrowserPage`) | ✅ |
| Detail (pattern, meaning, explanations, examples) | Yes | Yes | ✅ |
| Bookmark toggle on detail | Yes | No | ❌ |

### 3.5 Saved / Bookmarks

| Capability | Web | Mobile | Status |
| --- | --- | --- | --- |
| List by kind (word/kanji/grammar) | Yes | Yes (`SavedPage` tabs) | ✅ |
| Title resolution from content API | Yes | Yes (per-row resolve) | ✅ |
| Sign-in required state | Yes | Yes (unauthorized → CTA) | ✅ |
| Remove bookmark | Yes | No (only `list`; `toggle` exists but unused) | ⚠️ |
| Tap → detail | Yes | Yes | ✅ |

### 3.6 Recent searches / history

- Web: **localStorage only**, key `nihongo-bjt:recent-searches`, max 8, plus a
  `/search/history` page. No server endpoint.
- Mobile: **none**. The app already ships a local Drift DB
  ([app_database.dart](../../apps/mobile/lib/core/database/app_database.dart)),
  so recent searches can be persisted locally to match web. ❌ → implement.

---

## 4. Confirmed mobile gaps to close (priority order)

1. **Recent searches** (local Drift persistence) — Batch 1/2/5. High value.
2. **Bookmark toggle on Dictionary/Kanji/Grammar detail** — Batch 4. High value.
   (`SavedRepository.toggle` already exists; only UI + provider wiring missing.)
3. **Remove bookmark from Saved list** — Batch 5.
4. **Result kind filter (segmented)** on Search results — Batch 3. Medium.
5. **Saved + recent shortcuts surfaced on Search idle hub** — Batch 2.

Explicitly **not** doing (no real backing / out of scope):
- Fake trending/popular keywords (no API).
- Cross-feature lesson/scenario results in `/api/search` (endpoint is
  content-only: lexeme/kanji/grammar/example). Will not fake it.

---

## 5. Non-goals (already handled elsewhere)

Home, AppShell, Profile, Deck/Flashcard are out of scope per mission. Only the
Search branch routes are touched (`/search` + subroutes), which already exist in
[router.dart](../../apps/mobile/lib/app/router.dart).
