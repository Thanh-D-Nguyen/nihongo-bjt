# Plan: Bổ sung tính năng học BJT còn thiếu

> Ngày lập: 2026-05-11
> Spec gốc: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` (sections 13.2–13.10, 21.5, 21.7)

---

## Tổng quan hiện trạng

| Tính năng | DB Schema | API List | API Detail | Web Route | Seed Data | % |
|-----------|:---------:|:--------:|:----------:|:---------:|:---------:|:-:|
| **BJT Levels** `/levels` | ❌ | ❌ | ❌ | ❌ | ❌ | 0% |
| **Dictionary** `/dictionary` | ✅ Lexeme + Sense + Example | ✅ `GET /content/lexemes` | ❌ | ❌ | ✅ | 30% |
| **Kanji** `/kanji` | ✅ Kanji + Example + Component | ✅ `GET /content/kanji` | ❌ | ❌ | ✅ | 30% |
| **Grammar** `/grammar` | ✅ GrammarPoint + Detail + Example | ✅ `GET /content/grammar` | ❌ | ❌ | ✅ | 30% |
| **Home Levels Grid** | ❌ | N/A | N/A | ❌ | N/A | 0% |
| **Quiz → Flashcard** | ✅ | ✅ | ✅ | ✅ | ✅ | **100%** ✅ |

---

## Phase 1 — Backend: Detail APIs + Levels (ước tính: 1 sprint)

### 1.1 Dictionary Detail API
**File:** `apps/api/src/content/content.controller.ts` + `content.repository.ts`

| Task | Chi tiết | Verify |
|------|---------|--------|
| Thêm `GET /content/lexemes/:id` | Trả Lexeme + tất cả LexemeSense + LexemeSenseExample (join ExampleSentence) + reverse candidates | `curl /api/content/lexemes/<id>` → JSON đầy đủ |
| Thêm bookmark CTA data | Response include `bookmarked: boolean` nếu user đã login (optional) | Kiểm tra với/không userId |
| OpenAPI decorator | `@ApiParam`, `@ApiOperation` | Swagger UI hiển thị |

**Schema có sẵn:**
```
Lexeme → LexemeSense[] → LexemeSenseExample[] → ExampleSentence
Lexeme → LexemeReverseProjection → LexemeReverseCandidate[]
```

### 1.2 Kanji Detail API
**File:** `apps/api/src/content/content.controller.ts` + `content.repository.ts`

| Task | Chi tiết | Verify |
|------|---------|--------|
| Thêm `GET /content/kanji/:id` | Trả Kanji + KanjiExample[] + KanjiComponent[] + strokeSvgPath | `curl /api/content/kanji/<id>` → JSON |
| Trường đặc biệt | `strokeSvgPath`, `frequency`, `onyomi`, `kunyomi`, `meaningVi`, `hanViet` | Kiểm tra fields |

**Schema có sẵn:**
```
Kanji → KanjiExample[]
Kanji → KanjiComponent[]
```

### 1.3 Grammar Detail API
**File:** `apps/api/src/content/content.controller.ts` + `content.repository.ts`

| Task | Chi tiết | Verify |
|------|---------|--------|
| Thêm `GET /content/grammar/:id` | Trả GrammarPoint + GrammarPointDetail[] + examples (join ExampleSentence) | `curl /api/content/grammar/<id>` → JSON |
| Fields | `pattern`, `meaningVi`, `jlptLevel`, `category`, details[].explanation, details[].note | Kiểm tra |

**Schema có sẵn:**
```
GrammarPoint → GrammarPointDetail[] → GrammarPointDetailExample[] → ExampleSentence
```

### 1.4 BJT Levels API (mới hoàn toàn)
**File mới:** `apps/api/src/levels/` (module + controller + service)

| Task | Chi tiết | Verify |
|------|---------|--------|
| Tạo level taxonomy | 6 levels: J5, J4, J3, J2, J1, J1+ với metadata (score range, mô tả, JLPT tương đương) | Hardcode hoặc seed |
| `GET /api/levels` | List tất cả levels + aggregate counts (vocab, kanji, grammar per level) | `curl /api/levels` → 6 items |
| `GET /api/levels/:level` | Detail 1 level + stats + description | `curl /api/levels/J3` |
| `GET /api/levels/:level/vocabulary?page&limit` | Lexemes filtered by level | Pagination works |
| `GET /api/levels/:level/kanji?page&limit` | Kanji filtered by level | Pagination works |
| `GET /api/levels/:level/grammar?page&limit` | GrammarPoints filtered by level | Pagination works |

**Mapping strategy:**
- `Lexeme.jlptLevel` → map JLPT N5→N1 to BJT J5→J1 (roughly aligned)
- `Kanji.level` (1-4) → map to BJT levels
- `GrammarPoint.jlptLevel` → map tương tự
- J1+ = content vượt N1

**Cần thêm:**
- Level metadata (description, score range 0-800, skills focus) — có thể hardcode trong service hoặc seed table `BjtLevelDefinition`

### 1.5 Seed Script cho Level Metadata
**File mới:** `database/scripts/seed-bjt-levels.ts`

| Level | Score Range | JLPT ≈ | Description |
|-------|-----------|--------|-------------|
| J5 | 0–199 | N5 | Giao tiếp cơ bản, chào hỏi, tự giới thiệu |
| J4 | 200–319 | N4 | Hội thoại đơn giản, hiểu chỉ thị cơ bản |
| J3 | 320–419 | N3 | Đọc email, hiểu hội thoại business thông thường |
| J2 | 420–529 | N2 | Xử lý tình huống business, đọc báo cáo |
| J1 | 530–599 | N1 | Thương lượng, thuyết trình, viết báo cáo phức tạp |
| J1+ | 600–800 | >N1 | Lãnh đạo meeting, xử lý xung đột, viết tài liệu chính thức |

---

## Phase 2 — Frontend: Learning Pages (ước tính: 1 sprint)

### 2.1 Dictionary Page `/[locale]/dictionary`
**Files mới:** `apps/web/app/[locale]/dictionary/page.tsx`, `_components/dictionary-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Search bar** | Debounce 300ms, hỗ trợ kanji/hiragana/katakana/romaji/Vietnamese |
| **Results list** | Card mỗi từ: headword, reading, top 3 meanings, JLPT badge |
| **Pagination** | Infinite scroll hoặc page buttons |
| **Bookmark toggle** | Heart icon, call `/bookmarks/words/:id` |
| **Empty/error states** | Theo UI pattern sẵn có |
| **i18n labels** | Thêm `dictionary` section vào `vi.json`, `ja.json` |

### 2.2 Dictionary Detail `/[locale]/dictionary/[id]`
**Files mới:** `apps/web/app/[locale]/dictionary/[id]/page.tsx`, `_components/lexeme-detail-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Header** | Headword (大), reading (おおきい), pronunciation, JLPT badge |
| **Senses** | Grouped by POS (名詞, 動詞, etc.), mỗi sense có meaningVi + examples |
| **Examples** | Japanese + reading + Vietnamese translation |
| **Related** | Related kanji, grammar points (nếu có link) |
| **Actions** | Bookmark, Add to Flashcard, TTS play |
| **Reading Assist** | Integrate `<AnnotatedJapaneseText>` cho examples |

### 2.3 Kanji Page `/[locale]/kanji`
**Files mới:** `apps/web/app/[locale]/kanji/page.tsx`, `_components/kanji-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Grid layout** | Card per kanji: character lớn, meaning, onyomi/kunyomi, level badge |
| **Filter** | By level (J5→J1+), by stroke count |
| **Search** | By meaning, reading, character |
| **Pagination** | Grid-based |

### 2.4 Kanji Detail `/[locale]/kanji/[id]`
**Files mới:** `apps/web/app/[locale]/kanji/[id]/page.tsx`, `_components/kanji-detail-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Character display** | Large character + stroke SVG animation (if available) |
| **Readings** | Onyomi (音読み), Kunyomi (訓読み), Hán Việt |
| **Info** | Stroke count, frequency rank, JLPT level |
| **Components** | Bộ thủ / radical breakdown |
| **Examples** | KanjiExample[] — word, reading, meaning, Hán Việt |
| **Actions** | Bookmark, Add to Flashcard |

### 2.5 Grammar Page `/[locale]/grammar`
**Files mới:** `apps/web/app/[locale]/grammar/page.tsx`, `_components/grammar-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **List layout** | Card per grammar: pattern (bold), meaning, level badge, category tag |
| **Filter** | By level (J5→J1+), by category |
| **Search** | By pattern or meaning |

### 2.6 Grammar Detail `/[locale]/grammar/[id]`
**Files mới:** `apps/web/app/[locale]/grammar/[id]/page.tsx`, `_components/grammar-detail-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Pattern** | Pattern lớn + meaningVi |
| **Details** | Multiple detail entries (position variations), mỗi entry có explanation + note + synopsis |
| **Examples** | Japanese + reading + Vietnamese, Reading Assist enabled |
| **Actions** | Bookmark, Add to Flashcard |

### 2.7 BJT Levels Grid `/[locale]/levels`
**Files mới:** `apps/web/app/[locale]/levels/page.tsx`, `_components/levels-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Grid 6 cards** | J5→J1+, mỗi card: level name, score range, mô tả ngắn, stats (N vocab / N kanji / N grammar) |
| **Visual** | Gradient colors per level (xanh nhạt → đỏ đậm), badge style |
| **Click** | Navigate to `/levels/[level]` |

### 2.8 BJT Level Detail `/[locale]/levels/[level]`
**Files mới:** `apps/web/app/[locale]/levels/[level]/page.tsx`, `_components/level-detail-client.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Header** | Level name, score range, mô tả chi tiết, skills focus |
| **Tabs** | Vocabulary / Kanji / Grammar (3 tabs) |
| **Vocabulary tab** | Paginated list from `/levels/:level/vocabulary`, link to dictionary detail |
| **Kanji tab** | Grid from `/levels/:level/kanji`, link to kanji detail |
| **Grammar tab** | List from `/levels/:level/grammar`, link to grammar detail |
| **CTA** | "Clone Preset Deck" → tạo flashcard deck từ content level này |
| **Quiz link** | "Luyện thi level này" → navigate to `/quiz` with level filter |

### 2.9 Homepage — BJT Levels Section
**File sửa:** `apps/web/app/[locale]/_components/homepage/homepage-client.tsx`
**File mới:** `apps/web/app/[locale]/_components/homepage/bjt-levels-section.tsx`

| Thành phần | Chi tiết |
|-----------|---------|
| **Position** | Sau Quick Actions Strip, trước Daily Radar |
| **Layout** | Horizontal scroll row hoặc 2×3 grid |
| **Cards** | Compact: level badge + name + "N vocab · N kanji" |
| **Link** | Each card → `/levels/[level]` |

---

## Phase 3 — Navigation + i18n + Polish (ước tính: 0.5 sprint)

### 3.1 Update Learner Navigation
**File sửa:** `apps/web/app/_components/learner-app-frame.tsx`

Thêm vào sidebar:
```
📖 Dictionary    → /dictionary
漢 Kanji         → /kanji
📝 Grammar       → /grammar
📊 BJT Levels    → /levels
```

Group thành "Learning Tools" section trong sidebar.

### 3.2 i18n Labels
**Files sửa:** `apps/web/messages/vi.json`, `ja.json`

Thêm sections:
- `dictionary` — title, searchPlaceholder, noResults, senses, examples, addToFlashcard, bookmark
- `kanji` — title, strokeCount, onyomi, kunyomi, hanViet, examples, components
- `grammar` — title, pattern, meaning, explanation, examples, level
- `levels` — title, subtitle, scoreRange, vocabCount, kanjiCount, grammarCount, cloneDeck, practiceQuiz
- `homepage.levelsSection` — sectionTitle, viewAll

### 3.3 Reading Assist Integration
- Dictionary detail: `<AnnotatedJapaneseText>` cho example sentences
- Kanji detail: Annotated examples
- Grammar detail: Annotated example sentences
- Level detail tabs: Annotated content

### 3.4 Bookmark Integration
- Dictionary detail: bookmark toggle (đã có API)
- Kanji detail: bookmark toggle
- Grammar detail: bookmark toggle
- `/saved` page: hiện bookmarks grouped by type (words / kanji / grammar)

---

## Phase 4 — Quality + Edge Cases (ước tính: 0.5 sprint)

### 4.1 SEO / Meta
- Mỗi detail page có `generateMetadata()` với title + description
- Open Graph tags cho share

### 4.2 Empty States
- Dictionary: "Không tìm thấy từ nào" + gợi ý
- Kanji: "Chưa có kanji cho level này"
- Grammar: "Chưa có grammar point nào"
- Levels: skeleton loading

### 4.3 Mobile Responsiveness
- Dictionary: full-width cards
- Kanji: 3-col grid → 2-col → 1-col
- Grammar: full-width expandable cards
- Levels: horizontal scroll on mobile

### 4.4 Cross-linking
- Dictionary → Kanji (nếu headword chứa kanji đã seed)
- Kanji → Dictionary (từ vựng chứa kanji này)
- Grammar → Dictionary (từ liên quan)
- Level → Quiz (filter by level)
- Quiz wrong answer → Dictionary/Grammar detail (remediation link)

---

## Thứ tự triển khai đề xuất

```
Sprint 1 (Phase 1):
  1.1 Dictionary Detail API        → verify: curl OK
  1.2 Kanji Detail API             → verify: curl OK
  1.3 Grammar Detail API           → verify: curl OK
  1.4 BJT Levels API               → verify: curl /api/levels → 6 items
  1.5 Seed BJT level metadata      → verify: seed script runs clean

Sprint 2 (Phase 2a):
  2.1 Dictionary browse page       → verify: search works
  2.2 Dictionary detail page       → verify: navigate from search
  2.3 Kanji browse page            → verify: grid renders
  2.4 Kanji detail page            → verify: stroke SVG shows
  2.5 Grammar browse + detail      → verify: examples render
  3.2 i18n labels (dictionary, kanji, grammar)

Sprint 3 (Phase 2b + 3):
  2.7 BJT Levels grid page         → verify: 6 cards render
  2.8 BJT Level detail (3 tabs)    → verify: tabs switch, data loads
  2.9 Homepage levels section       → verify: shows on home
  3.1 Navigation update             → verify: sidebar links work
  3.3 Reading Assist integration    → verify: hover/tap works
  3.4 Bookmark integration          → verify: toggle saves

Sprint 4 (Phase 4):
  4.1–4.4 Polish + QA              → verify: mobile, empty states, cross-links
```

---

## Files sẽ tạo mới

### Backend (6 files)
```
apps/api/src/levels/levels.module.ts
apps/api/src/levels/levels.controller.ts
apps/api/src/levels/levels.service.ts
database/scripts/seed-bjt-levels.ts
```

### Frontend (~24 files)
```
apps/web/app/[locale]/dictionary/page.tsx
apps/web/app/[locale]/dictionary/_components/dictionary-client.tsx
apps/web/app/[locale]/dictionary/[id]/page.tsx
apps/web/app/[locale]/dictionary/[id]/_components/lexeme-detail-client.tsx

apps/web/app/[locale]/kanji/page.tsx
apps/web/app/[locale]/kanji/_components/kanji-client.tsx
apps/web/app/[locale]/kanji/[id]/page.tsx
apps/web/app/[locale]/kanji/[id]/_components/kanji-detail-client.tsx

apps/web/app/[locale]/grammar/page.tsx
apps/web/app/[locale]/grammar/_components/grammar-client.tsx
apps/web/app/[locale]/grammar/[id]/page.tsx
apps/web/app/[locale]/grammar/[id]/_components/grammar-detail-client.tsx

apps/web/app/[locale]/levels/page.tsx
apps/web/app/[locale]/levels/_components/levels-client.tsx
apps/web/app/[locale]/levels/[level]/page.tsx
apps/web/app/[locale]/levels/[level]/_components/level-detail-client.tsx

apps/web/app/[locale]/_components/homepage/bjt-levels-section.tsx
```

### Files sẽ sửa (~6 files)
```
apps/api/src/content/content.controller.ts     ← thêm 3 detail endpoints
apps/api/src/content/content.repository.ts      ← thêm 3 detail queries
apps/api/src/app.module.ts                      ← register LevelsModule
apps/web/app/_components/learner-app-frame.tsx  ← thêm nav items
apps/web/app/[locale]/_components/homepage/homepage-client.tsx ← thêm levels section
apps/web/messages/vi.json + ja.json             ← thêm i18n sections
```

---

## Risk & Dependencies

| Risk | Mitigation |
|------|-----------|
| Content data chưa đủ (vocab/kanji/grammar) | Kiểm tra seed data counts trước; bổ sung seed nếu cần |
| JLPT→BJT level mapping không chính xác | Document rõ là "estimated mapping", cho phép admin override |
| Stroke SVG chưa có cho tất cả kanji | Graceful fallback: hiện character lớn nếu không có SVG |
| Performance pagination với dataset lớn | Dùng cursor-based pagination, limit 50, Meilisearch cho search |
| Reading Assist load time | Lazy load reading annotations, cache |
