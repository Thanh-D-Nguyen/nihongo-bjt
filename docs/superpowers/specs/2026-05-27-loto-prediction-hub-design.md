# Loto Prediction Hub — Design Spec

## Overview

Dedicated Loto prediction page at `/[locale]/magazine/loto` that combines entertainment-style lottery predictions with Japanese learning content. Full auth gate required. Supports Loto6 and Loto7 via tab toggle.

## Decisions

| Decision | Choice |
|----------|--------|
| Purpose | Hybrid: prediction for next draw + scrollable history timeline |
| Auth | Full gate — login required to access entire page |
| Game modes | Toggle/Tab between Loto6 and Loto7 |
| History layout | Card timeline (vertical, rich content per draw) |
| Admin scope | Full control: manage results, review/approve, analytics |
| URL (learner) | `/[locale]/magazine/loto` |
| URL (admin) | `/[locale]/magazine/loto-lab` (expand existing) |

## Architecture

### Data Layer (reuses existing)

- `MagazineArticle` — Loto predictions stored as `widgetKind: "magazine_loto6" | "magazine_loto7"`
- `LotoDraw` — Actual draw results (already has `game`, `drawNumber`, `drawDate`, `mainNumbers`, `bonusNumbers`)
- No new tables needed. Add fields as needed via migration.

### New API Endpoints

```
# Learner (auth required)
GET  /api/magazine/loto/feed?game=loto6&page=1&limit=10
     → Returns predictions with matched results, JP sentences, vocab
GET  /api/magazine/loto/next-draw?game=loto6
     → Returns latest prediction for upcoming draw (hero section)
GET  /api/magazine/loto/stats?game=loto6
     → Hit rate summary, streak info

# Admin (RBAC)
GET    /admin/magazine/loto/predictions?game=loto6&status=pending
PUT    /admin/magazine/loto/predictions/:id/approve
PUT    /admin/magazine/loto/predictions/:id/reject
POST   /admin/magazine/loto/results          → Input actual draw result
GET    /admin/magazine/loto/analytics        → Hit rates, engagement
```

### Frontend Routes

```
# Learner
apps/web/app/[locale]/magazine/loto/
├── page.tsx                    → Server component, auth check, data fetch
├── _components/
│   ├── loto-hub-client.tsx     → Main client component (tab state, scroll)
│   ├── loto-hero-prediction.tsx → Next draw prediction card
│   ├── loto-history-card.tsx   → Individual history entry
│   ├── loto-game-toggle.tsx    → Loto6/Loto7 tab switcher
│   ├── loto-result-dots.tsx    → Visual hit/miss indicator
│   └── loto-jp-sentence.tsx    → Japanese sentence with furigana + vocab

# Admin
apps/admin/app/[locale]/magazine/loto-lab/
├── page.tsx                    → Existing loto-lab expanded
├── _components/
│   ├── loto-predictions-tab.tsx  → Review/approve predictions
│   ├── loto-results-tab.tsx      → Input actual results
│   ├── loto-analytics-tab.tsx    → Charts: hit rate, engagement
│   └── loto-generation-tab.tsx   → Existing generate + context tuning
```

## Learner Page Design

### Layout Structure

```
┌───────────────────────────────────────────────┐
│ Header: 🎰 Loto Lab    [Loto6 | Loto7] sticky│
├───────────────────────────────────────────────┤
│                                               │
│ HERO: Next Draw Prediction                    │
│ ┌───────────────────────────────────────────┐ │
│ │ ⚡ Dự đoán kỳ #1985                       │ │
│ │ 🗓 Thứ 5, 29/05/2026  (còn 2 ngày)       │ │
│ │                                           │ │
│ │ Set 1: ⑦ ⑭ ㉓ ㉛ ㊷ ⑥  +bonus [⑮]    │ │
│ │ Set 2: ③ ⑪ ㉒ ㉝ ㊵ ⑤  +bonus [⑫]    │ │
│ │ Score: ★★★★☆ (0.87)                      │ │
│ │                                           │ │
│ │ 📝 今日は天気のヒントから数字を選びます   │ │
│ │    (きょうはてんきのヒントから…)          │ │
│ │    → Hôm nay chọn số từ gợi ý thời tiết  │ │
│ │                                           │ │
│ │ 📚 数字(すうじ) 天気(てんき) 選ぶ(えらぶ)│ │
│ └───────────────────────────────────────────┘ │
│                                               │
├───────────────────────────────────────────────┤
│ SECTION: Lịch sử dự đoán                     │
│                                               │
│ ┌─ Kỳ #1984 — 26/05/2026 ────────────────┐  │
│ │ Dự đoán: 7  14  23  31  42  6           │  │
│ │ Kết quả: 7  14  __  31  __  __          │  │
│ │ 🟢🟢⚪🟢⚪⚪ → Trúng 3/6               │  │
│ │                                          │  │
│ │ 「数字は人生の友達です」                  │  │
│ │ (すうじはじんせいのともだちです)          │  │
│ │ → Số là bạn đồng hành của cuộc đời      │  │
│ │ 📚 数字・人生・友達                      │  │
│ │                                          │  │
│ │ [Xem chi tiết ↓] (expand quiz/vocab)     │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ ┌─ Kỳ #1983 — 22/05/2026 ────────────────┐  │
│ │ Chưa có kết quả (pending)                │  │
│ │ Dự đoán: 3  11  22  33  40  5           │  │
│ │ 「幸運は準備された心に来る」              │  │
│ │ ...                                      │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ [Tải thêm ↓] (paginate)                      │
└───────────────────────────────────────────────┘
```

### Component Details

#### Loto Game Toggle
- Pill-style tabs, sticky below header
- Active tab: solid primary bg. Inactive: ghost/outline
- Smooth content transition on switch (no full page reload)

#### Hero Prediction Card
- Glassmorphic card with gradient bg (emerald for loto6, cyan for loto7)
- Number pills: large (size-14 mobile, size-16 desktop), bold, gradient bg
- Bonus numbers: smaller, outlined style
- Confidence score: star rating or progress bar
- Countdown badge: "còn X ngày" (if within 3 days of draw)
- Japanese sentence: proper line-height 1.8, furigana toggle
- Vocab tags: tappable, links to flashcard add

#### History Card
- Date header with draw number badge
- Two rows: "Dự đoán" and "Kết quả" (if available)
- Result dots: 🟢 (hit) / ⚪ (miss) — animated on first view
- Hit count badge: "Trúng 3/6" with color coding (green ≥4, yellow 2-3, gray 0-1)
- Japanese sentence section: collapsible by default for older cards
- Expand button: reveals full quiz, vocab list, explanation
- Pending state: "Chờ kết quả" with subtle pulse animation

#### Infinite Scroll
- Load 10 cards initially
- Load more on scroll (IntersectionObserver)
- Shimmer skeleton matching card shape while loading

### Auth Gate
- Server-side: check session/token in `page.tsx`
- No token → `redirect('/login?next=/magazine/loto')`
- API endpoints: `@UseGuards(AuthGuard)` on all loto feed endpoints

### Mobile Considerations (375px)
- Number pills: 2 rows if needed (wrap)
- Tab toggle: full width, equal split
- Cards: full bleed (no side padding waste)
- Hero card: slightly smaller numbers, sentence wraps naturally
- Touch: all interactive elements ≥ 48px

## Admin Page Design

### Tab Structure (expand existing Loto Lab)

#### Tab 1: Predictions (NEW)
```
┌─────────────────────────────────────────┐
│ Filter: [All | Pending | Approved | Rejected]
│ Game: [Loto6 | Loto7]
├─────────────────────────────────────────┤
│ ┌─ Kỳ #1985 — 29/05/2026 ───── PENDING │
│ │ Sets: 7 14 23 31 42 6 | 3 11 22...   │
│ │ JP: 「今日は天気の…」                  │
│ │ Generated: 27/05 14:00                 │
│ │ [✓ Approve] [✗ Reject] [✏️ Edit]      │
│ └───────────────────────────────────────┘│
└─────────────────────────────────────────┘
```
- List of generated predictions awaiting review
- Inline edit: modify numbers, JP sentence, vocab
- Approve → publishes to learner feed
- Reject → regenerate or discard

#### Tab 2: Results (NEW)
```
┌─────────────────────────────────────────┐
│ 🎯 Nhập kết quả kỳ mới                 │
│ Game: [Loto6 ▾]  Kỳ số: [1984]         │
│ Ngày quay: [2026-05-26]                 │
│ Main: [_][_][_][_][_][_]                │
│ Bonus: [_]                              │
│ [💾 Lưu kết quả]                        │
├─────────────────────────────────────────┤
│ Lịch sử kết quả gần đây                │
│ #1984: 7 14 20 31 38 41 +[15]  ✓ Đã nhập│
│ #1983: 3 11 22 33 40 5  +[12]  ✓ Đã nhập│
│ #1982: ...                    ⚠️ Thiếu   │
└─────────────────────────────────────────┘
```
- Manual input form for actual results
- Auto-match with prediction → compute hit count
- Highlight missing results (draws without entered results)

#### Tab 3: Analytics (NEW)
```
┌─────────────────────────────────────────┐
│ 📊 Tổng quan                            │
│ Tổng kỳ dự đoán: 45                     │
│ Tỷ lệ trúng trung bình: 2.3/6          │
│ Kỳ trúng cao nhất: #1980 (5/6!)        │
│ User views (7d): 234                     │
├─────────────────────────────────────────┤
│ [Chart: Hit rate over time]             │
│ [Chart: Views per draw]                 │
│ [Chart: Most common predicted numbers]  │
└─────────────────────────────────────────┘
```

#### Tab 4: Data Import (existing)
- CSV upload (already built)
- Manual add single draw
- Data health indicator

#### Tab 5: Generation (existing, enhanced)
- Generate sets with context (weather, dream, lucky text)
- Schedule next auto-generation
- Algorithm weight tuning

## Integration with Magazine

- Loto filter in `/magazine` shows banner: "🎰 Xem trang Loto Lab đầy đủ →" linking to `/magazine/loto`
- Loto article cards in magazine list still visible but clicking → redirect to `/magazine/loto` (not article detail)
- Homepage widget ("Hôm nay") still shows loto teaser if available

## Database Changes

### New fields needed on `MagazineArticle`
```
approval_status  VARCHAR(32) DEFAULT 'auto_approved'  -- pending | approved | rejected | auto_approved
approved_by      UUID REFERENCES auth.user(id)
approved_at      TIMESTAMPTZ
```

### Matching prediction ↔ result
- Join `MagazineArticle` (prediction, by content_date + game) with `LotoDraw` (result, by drawDate + game)
- Compute hit count at query time (array intersection)
- Match logic: `MagazineArticle.widgetKind = 'magazine_loto6'` + `MagazineArticle.contentDate` = `LotoDraw.drawDate` where `LotoDraw.game = 'loto6'`
- Hit calculation: `prediction.mainNumbers ∩ result.mainNumbers` → count
- Bonus hit: separate indicator (not counted in main score)

## i18n Keys (new)

```json
{
  "lotoHub": {
    "title": "Loto Lab",
    "nextDraw": "Dự đoán kỳ tiếp theo",
    "drawNumber": "Kỳ #{number}",
    "countdown": "còn {days} ngày",
    "history": "Lịch sử dự đoán",
    "prediction": "Dự đoán",
    "result": "Kết quả",
    "hitCount": "Trúng {hit}/{total}",
    "pending": "Chờ kết quả",
    "loadMore": "Tải thêm",
    "jpSentence": "Câu tiếng Nhật",
    "vocab": "Từ vựng",
    "viewDetail": "Xem chi tiết",
    "confidence": "Độ tin cậy",
    "loginRequired": "Đăng nhập để xem dự đoán Loto",
    "set": "Bộ {n}",
    "bonus": "Bonus",
    "loto6": "Loto 6",
    "loto7": "Loto 7",
    "tabLoto6": "Loto6 (6/43)",
    "tabLoto7": "Loto7 (7/37)"
  }
}
```

## Success Criteria

1. Auth gate works — unauthenticated users redirected to login
2. Tab toggle switches between Loto6/Loto7 without page reload
3. Hero card displays latest prediction with countdown, JP sentence, vocab
4. History timeline loads correctly with hit/miss indicators
5. Admin can approve/reject predictions before publish
6. Admin can input actual results → auto-computes hit counts
7. Analytics show real data (hit rate, views)
8. Mobile (375px): all elements ≥ 48px touch, numbers wrap properly
9. Japanese text: line-height ≥ 1.8, furigana available
10. Redirect from magazine loto cards → dedicated page
