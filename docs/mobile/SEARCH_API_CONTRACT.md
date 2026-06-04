# Search / Reference Hub — API Contract (Mobile)

Verified against `apps/api` controllers + the mobile `ContentRepository` /
`SavedRepository`. All endpoints are real. The mobile client never fabricates
content; failures normalize to `RepositoryException`.

Base URL: `appEnvironmentProvider.apiBaseUrl` (e.g. `http://10.0.2.2:4000` on
the Android emulator). All paths below are prefixed with that base.

---

## 1. Global search

### `GET /api/search`
Query params:
- `q` (required) — search text.
- `limit` (optional, mobile sends `20`).
- `scope` (optional) — `lexeme | kanji | grammar | example`.
- `level` (optional) — `N1..N5`.

Response: bare array **or** `{ "results": [ ... ] }`. Each hit:
```jsonc
{
  "id": "uuid",
  "kind": "lexeme" | "kanji" | "grammar" | "example",
  "title": "会議",
  "reading": "かいぎ",        // nullable
  "description": "Cuộc họp",  // nullable
  "jlptLevel": "N3"           // nullable
}
```
Mobile model: `SearchHit` / `SearchHitKind`
([content_models.dart](../../apps/mobile/lib/core/content/domain/content_models.dart)).

### `GET /api/search/suggest`
Query params: `q` (required), `limit` (optional, web uses `6`).
Response: array of `{ id, kind, title, reading }`.
Mobile status: **not yet consumed** (optional autocomplete, see plan).

---

## 2. Dictionary

### `GET /api/dictionary/search?q=&limit=`
Array of lexeme summaries:
```jsonc
{
  "id": "uuid",
  "headword": "会議",
  "reading": "かいぎ",            // nullable
  "jlptLevel": "N3",             // nullable
  "shortMeaningVi": "Cuộc họp",  // nullable
  "senses": [ { "id": "uuid", "meaningVi": "…", "partOfSpeech": "…", "position": 0 } ]
}
```

### `GET /api/dictionary/words/:id`
Single lexeme with full `senses[]`, each sense carrying `examples[]`
(`{ id, japaneseText, reading, translationVi }`). Mobile model: `Lexeme`,
`LexemeSense`, `ContentExample`.

---

## 3. Kanji

### `GET /api/kanji?q=&limit=&offset=`
(`q` falls back to `level` server-side.) Array of kanji summaries
`{ id, character, meaningVi, onyomi, kunyomi, level, strokeCount }`.

### `GET /api/kanji/:id`
Full kanji: adds `frequency`, `detail`, `tip`, `components[]`
(`{ id, character, hanViet, position }`), `examples[]`
(`{ id, word, reading, meaningVi, hanViet }`), and a stroke-diagram flag.
Mobile model: `KanjiEntry`, `KanjiComponent`, `KanjiExample`.

### `GET /api/kanji/:id/stroke`
Returns `image/svg+xml`. Rendered live via `flutter_svg` in `KanjiDetailPage`.

---

## 4. Grammar

### `GET /api/grammar?q=&limit=&offset=`
Array `{ id, pattern, meaningVi, jlptLevel, category, details[] }`.

### `GET /api/grammar/:id`
Full grammar with `details[]`
(`{ id, position, meaningVi, explanation, note, synopsis, examples[] }`).
Mobile model: `GrammarEntry`, `GrammarDetail`.

---

## 5. Bookmarks (auth required — bearer token)

### `GET /api/bookmarks/{words|kanji|grammar}?limit=`
`{ items: [ { id, targetId, targetType, createdAt, userId } ], limit, type }`.
Mobile model: `BookmarkItem`, segment from `BookmarkKind.listSegment`.

### `POST /api/bookmarks/{word|kanji|grammar}/:id`
Toggles. Response: `{ bookmarked: bool, bookmarkId, targetId, type }`.
Mobile: `SavedRepository.toggle` (exists; UI wiring added in Batch 4/5).

Unauthorized (`401`) → mobile shows a sign-in CTA, never an error toast.

---

## 6. Local persistence (no backend)

Recent searches are **device-local** (matching web's localStorage model). They
will be stored in the existing Drift DB
([app_database.dart](../../apps/mobile/lib/core/database/app_database.dart)) via a
new `recent_searches` table — no server endpoint exists or is needed.
