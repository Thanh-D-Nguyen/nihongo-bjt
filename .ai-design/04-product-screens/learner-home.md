# Screen — Learner Home (Production Spec v2)

> **Based on current implementation** — see `apps/web/app/[locale]/_components/homepage/`
> **Visual upgrade**: Approach C — "Layered Depth" with seasonal accents, daily-life illustrations, glassmorphism, and subtle parallax.

## Target Audience
Vietnamese people living in Japan who study Japanese daily. Also includes those in Vietnam preparing to move to Japan. The visual language must evoke **daily life in Japan** — konbini runs, morning trains, sakura-lined streets, izakaya evenings, office culture — creating emotional resonance and belonging.

## Goal
Daily landing screen that answers: "What should I study today?" — motivates without pressuring, surfaces fresh Japanese content (NHK news, daily phrases), and provides fast access to all learning features. The visual experience must feel **warm, lived-in, and culturally authentic** — like opening a window into your life in Japan.

## Design Principles
- **Content-rich**: Real Japanese content (news, daily phrases) keeps users engaged
- **Action-oriented**: Clear next step within 2 seconds of landing
- **Calm motivation**: Streak and progress feel encouraging, never punishing
- **Fast navigation**: All major features reachable in 1 tap
- **Discovery**: Recommended quizzes/decks and fresh news give users something new every visit
- **Progressive disclosure**: Logged-in users see stats sidebar; guests see sign-in prompt
- **Visually alive**: Seasonal accents, contextual illustrations, glassmorphism depth — the page breathes
- **Culturally resonant**: Every decorative element connects to real Japanese daily life

## Seasonal System

The homepage adapts its accent colors and micro-illustrations to the current Japanese season. This is purely cosmetic CSS — no additional API calls.

### Season Detection (client-side)
```
Spring (春): Mar 1 – May 31   → sakura pink accents
Summer (夏): Jun 1 – Aug 31   → ocean blue/green accents
Autumn (秋): Sep 1 – Nov 30   → momiji red/gold accents
Winter (冬): Dec 1 – Feb 28   → snow white/ice blue accents
```

### Season Tokens

| Season | Accent Gradient | Decorative Element | Hero Overlay Tint |
|--------|----------------|-------------------|-------------------|
| Spring | `#F9A8D4 → #FBCFE8` | SVG sakura petals (3-4, scattered, opacity 0.06-0.12) | warm pink `rgba(249,168,212,0.04)` |
| Summer | `#06B6D4 → #22D3EE` | SVG wave pattern (bottom edge, opacity 0.06) | cool cyan `rgba(6,182,212,0.03)` |
| Autumn | `#F59E0B → #EF4444` | SVG momiji leaves (2-3, scattered, opacity 0.08) | warm amber `rgba(245,158,11,0.04)` |
| Winter | `#E2E8F0 → #F8FAFC` | SVG snowflakes (3-5, scattered, opacity 0.06) | cool silver `rgba(226,232,240,0.05)` |

- Seasonal elements are **SVG inlined** — no extra HTTP requests
- Opacity always < 0.15 — decorative, never distracting
- `prefers-reduced-motion`: hide all floating/drifting seasonal elements

## Illustration Assets (SVG)

All illustrations are inline SVG or small imported components. Style: flat vector, 2px stroke, brand color palette only, max 5-6 elements per scene. No external image dependencies.

### Required Illustrations

| ID | Scene | Usage | Size | Style |
|----|-------|-------|------|-------|
| `hero-city` | Tokyo/Osaka street scene — torii gate silhouette, buildings, train, cherry tree | Hero section background (right side, opacity 0.08-0.12) | 400×300 viewBox | Monochrome silhouette, white on dark |
| `qa-flashcard` | Hand holding flashcard with Japanese character | Quick Action: Flashcards | 48×48 | Flat vector, `brand-blue` accent |
| `qa-bjt` | Document with BJT stamp/seal | Quick Action: BJT Quiz | 48×48 | Flat vector, `brand-gold` accent |
| `qa-battle` | Two crossed katana/lightning bolt | Quick Action: Battle | 48×48 | Flat vector, `brand-sakura` accent |
| `qa-search` | Magnifying glass over kanji character | Quick Action: Search | 48×48 | Flat vector, `brand-teal` accent |
| `progress-daruma` | Daruma doll with one eye filled | Progress sidebar — reacts to streak | 64×64 | Flat vector, warm colors |
| `empty-news` | Newspaper with "休" character | News section empty state | 120×90 | Line art, `text-tertiary` |
| `signin-gate` | Torii gate with path leading through | Sign-in prompt illustration | 80×80 | Line art, `brand-blue` accent |

### Daruma Mascot States (Progress Section)

| Condition | Daruma Visual | Meaning |
|-----------|--------------|---------|
| Streak ≥ 7 | Both eyes painted, small flame aura | On fire — great consistency |
| Streak 3-6 | One eye painted, slight smile | Making progress |
| Streak 1-2 | One eye painted, neutral | Just started |
| Streak 0 | No eyes, "waiting" pose | Ready to begin |
| All reviews done today | Both eyes + golden glow | Today's goal achieved |

## Visual Depth System

### Glassmorphism (used sparingly per design system rules)

Applied ONLY to these elements:
- Hero section stats card (right side)
- Progress sidebar card (when over gradient)
- Quick action cards on hover

```css
.glass-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
}

/* On dark backgrounds (hero) */
.glass-card-dark {
  background: rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
```

**Important**: Glassmorphism is an accent technique. Most cards remain solid `--color-bg-surface` with standard `--shadow-card`. Only 2-3 elements per viewport use glass effect.

### Shadow Depth Layers

| Layer | Elements | Shadow |
|-------|----------|--------|
| Ground | Page background | none |
| Surface | Standard cards, sections | `--shadow-sm` → `--shadow-md` on hover |
| Elevated | Quick Action cards, news cards | `--shadow-md` → `--shadow-lg` on hover + `translateY(-2px)` |
| Floating | Hero stats card, progress sidebar | `--shadow-lg` + glassmorphism |
| Overlay | Modals, dropdowns | `--shadow-xl` |

### Subtle Parallax

- Hero section: background illustration moves at 0.3× scroll speed (CSS `transform: translateY(calc(var(--scroll) * 0.3))`)
- Seasonal decorative elements: drift at 0.15× scroll speed
- **Implementation**: CSS custom property `--scroll` set via `IntersectionObserver` or lightweight scroll listener (throttled to rAF)
- **`prefers-reduced-motion`**: disable all parallax, render static

## Layout — Desktop (≥ 1024px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (sticky, 56px height)                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [Logo]  [🔍 Search Japanese, Vietnamese, English...      ]              │ │
│ │          ↑ 400px width, always visible                                  │ │
│ │                                                                         │ │
│ │             [📚 Study] [🎮 Battle] [📝 Test]     [🔔 2] [👤 Avatar ▼] │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ HERO SECTION ───────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  おはようございます、Thanh さん！                  2026年5月7日 (水)   │   │
│  │                                                                       │   │
│  │  ┌─ Primary CTA ─────────┐  ┌─ Secondary CTA ──────────┐            │   │
│  │  │ [▶ Review Now (15)]   │  │ [📝 Take a Quiz]         │            │   │
│  │  │  15 cards due today    │  │  Practice your skills     │            │   │
│  │  └───────────────────────┘  └────────────────────────────┘            │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ MAIN CONTENT (2-col grid) ──────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  ┌─ LEFT COLUMN (flex-1) ─────────────────────────────────────────┐  │   │
│  │  │                                                                 │  │   │
│  │  │  ┌─ QUICK ACTIONS STRIP ────────────────────────────────────┐  │  │   │
│  │  │  │  [📖 Flashcards]  [📝 BJT]   [🎮 Battle]  [🔍 Search]  │  │  │   │
│  │  │  │   "15 due"         "N2 Prep"  "Join!"      "Dictionary" │  │  │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                                 │  │   │
│  │  │  ┌─ FEATURED NEWS (Tabs: Easy | Normal) ───────────────────┐  │  │   │
│  │  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │  │  │   │
│  │  │  │  │ [img]  │  │ [img]  │  │ [img]  │  │ [img]  │       │  │  │   │
│  │  │  │  │ Easy   │  │ Easy   │  │ Normal │  │ Normal │       │  │  │   │
│  │  │  │  │ Title… │  │ Title… │  │ Title… │  │ Title… │       │  │  │   │
│  │  │  │  │ 2m ago │  │ 1h ago │  │ 5h ago │  │ 1d ago │       │  │  │   │
│  │  │  │  │[Read][+Card]│     …│  │        │  │        │       │  │  │   │
│  │  │  │  └────────┘  └────────┘  └────────┘  └────────┘       │  │  │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                                 │  │   │
│  │  │  ┌─ DAILY JAPANESE (horizontal scroll) ────────────────────┐  │  │   │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │  │   │
│  │  │  │  │ 🌤 Weather│  │ 💼 Biz   │  │ 🌸 Season│  →          │  │  │   │
│  │  │  │  │ 今日は暑い│  │ お疲れ様 │  │ 花見     │              │  │  │   │
│  │  │  │  │ きょうは… │  │ おつかれ…│  │ はなみ   │              │  │  │   │
│  │  │  │  │ Hôm nay…  │  │ Anh/chị…│  │ Ngắm hoa│              │  │  │   │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘              │  │  │   │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │   │
│  │  │                                                                 │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  ┌─ RIGHT SIDEBAR (w-80, sticky top-20) ──────────────────────────┐  │   │
│  │  │                                                                 │  │   │
│  │  │  ┌─ PROGRESS STATS ────────────────────┐                       │  │   │
│  │  │  │  🔥 Streak     📖 Reviews           │                       │  │   │
│  │  │  │    14 days       15 today            │                       │  │   │
│  │  │  │                                     │                       │  │   │
│  │  │  │  🎯 Accuracy    📚 Sessions          │                       │  │   │
│  │  │  │    87%           4 this week         │                       │  │   │
│  │  │  │                                     │                       │  │   │
│  │  │  │  [View full analytics →]            │                       │  │   │
│  │  │  └─────────────────────────────────────┘                       │  │   │
│  │  │                                                                 │  │   │
│  │  │  (if not logged in:)                                            │  │   │
│  │  │  ┌─ SIGN IN PROMPT ────────────────────┐                       │  │   │
│  │  │  │  Track your progress                 │                       │  │   │
│  │  │  │  Sign in to save your learning data  │                       │  │   │
│  │  │  │  [Sign In]  [Create Account]         │                       │  │   │
│  │  │  └─────────────────────────────────────┘                       │  │   │
│  │  │                                                                 │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─ RECOMMENDED (full width, below grid) ───────────────────────────────┐   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────┐   │   │
│  │  │ Quiz     │  │ Quiz     │  │ Quiz     │  │ Deck     │  │Deck │   │   │
│  │  │ 📝 N2   │  │ 📝 N3   │  │ 📝 Read  │  │ 📖 Biz  │  │📖…  │   │   │
│  │  │ "BJT…"  │  │ "JLPT…" │  │ "Comp…"  │  │ "500…"  │  │     │   │   │
│  │  │ ████░ 60%│ │ ██░░ 30%│  │ ░░░░ 0% │  │ ███░ 45%│  │     │   │   │
│  │  │ 4 sections│ │ 3 secs  │  │ 5 secs  │  │ 120 cards│ │     │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────┘   │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layout — Mobile (< 768px)

```
┌─────────────────────────┐
│ [Logo] [🔍] [🔔] [👤]  │  ← Compact: search opens as full-width overlay
├─────────────────────────┤
│                         │
│ おはよう、Thanh さん！   │
│ 2026年5月7日 (水)       │
│                         │
│ ┌─────────────────────┐ │
│ │ [▶ Review Now (15)] │ │  ← Primary CTA, large, full-width
│ └─────────────────────┘ │
│ [📝 Take a Quiz →]     │  ← Secondary CTA link
│                         │
├─────────────────────────┤
│ ━━ Quick Actions (2×2 grid)  │
│ [📖 Flashcards] [📝 BJT]    │
│ [🎮 Battle]    [🔍 Search]  │
├─────────────────────────┤
│ ━━ Featured News        │
│ [Easy] [Normal]  ← tabs │
│ ┌──────┐ ┌──────┐ →    │  ← Horizontal scroll cards
│ │[img] │ │[img] │      │
│ │Title │ │Title │      │
│ │ 2m   │ │ 1h   │      │
│ └──────┘ └──────┘      │
├─────────────────────────┤
│ ━━ Daily Japanese       │
│ Scroll → [🌤 Weather][💼 Biz][🌸 Season]  ← Horizontal strip
├─────────────────────────┤
│ ━━ Your Progress        │
│ 🔥14d  📖15  🎯87%  📚4│  ← Compact stat row
│ [View analytics →]      │
├─────────────────────────┤
│ ━━ Recommended          │
│ ┌──────┐ ┌──────┐ →    │  ← Horizontal scroll
│ │Quiz  │ │Deck  │      │
│ │N2 BJT│ │Biz500│      │
│ └──────┘ └──────┘      │
├─────────────────────────┤
│                         │
│ [🏠] [🔍] [📚] [🎮] [👤] │  ← Bottom navigation
└─────────────────────────┘
```

## Visual Specifications

### Top Bar (Global — Quizlet-style with integrated search)
- Height: 56px (fixed, sticky top)
- Background: `--color-bg-surface`
- Shadow: `--shadow-sticky` (appears on scroll only)
- Padding: 0 24px (desktop), 0 16px (mobile)
- Z-index: 50

**Logo area (left)**
- Logo: 28px height, clickable → home
- Left margin: 0

**Inline Search Bar (center, desktop)**
- Width: 400px min, flex-grows to max 560px
- Height: 40px
- Background: `--color-bg-sunken`
- Border: `1px solid --color-border-default` → `--color-border-focus` on focus
- Radius: `--radius-full` (pill shape, like Quizlet)
- Icon: `search`, 18px, `--color-text-tertiary`, left-positioned inside
- Placeholder: "Search Japanese, Vietnamese, English..." `--color-text-tertiary`
- Focus: expand slightly (420px → 560px), `--shadow-sm`, border `--color-brand-blue`
- Transition: width `--duration-normal` `--ease-out`
- **On type**: dropdown with instant results (max 6 items)
- **On Enter or click result**: navigate to full dictionary page with query
- **Keyboard shortcut**: `/` or `Ctrl+K` to focus search

**Search Dropdown (desktop, appears on focus + typing)**
```
┌───────────────────────────────────────┐
│ 🕐 Recent: 経済, 会議, ビジネス        │  ← Recent searches
├───────────────────────────────────────┤
│ 📖 経済 (けいざい) — Economy          │  ← Instant results
│ 📖 経済的 (けいざいてき) — Economical │
│ 📖 経験 (けいけん) — Experience       │
├───────────────────────────────────────┤
│ [🔍 See all results for "けいざ..."]  │  ← Full search CTA
└───────────────────────────────────────┘
```
- Background: `--color-bg-surface`
- Shadow: `--shadow-dropdown`
- Radius: `--radius-lg`
- Max height: 360px
- Item height: 44px
- Hover: `--color-bg-surface-hover`
- Keyboard: ↑↓ to navigate, Enter to select, Esc to close

**Mobile Search (tap 🔍 icon → full overlay)**
```
┌─────────────────────────┐
│ [←] [🔍 Search...     ] │  ← Full-width input, auto-focus
├─────────────────────────┤
│ Recent: 経済, 会議       │
├─────────────────────────┤
│ Results appear here...   │
└─────────────────────────┘
```
- Overlay: full screen, `--color-bg-page` bg
- Input: auto-focus with keyboard open
- Back button (←) closes overlay
- Results inline below input

**Navigation links (right of search, desktop)**
- Items: Study, Battle, Test
- Style: `text-body`, weight 500, `--color-text-secondary`
- Hover: `--color-text-primary`
- Active page: `--color-brand-blue`, weight 600, underline (2px, 4px below text)
- Gap: 24px between items

**Right actions**
- Notification bell: `--icon-md`, `--color-text-secondary`, badge if unread (red dot, 8px)
- Avatar: `--avatar-sm` (32px), border `--color-border-default`, clickable → dropdown menu
- Avatar dropdown: name, email, [Profile], [Settings], [Logout]
- Gap: 16px between items

### Hero Section (Greeting + CTA) — UPGRADED

The hero is the emotional anchor. It must feel like stepping outside your apartment in Japan on a beautiful morning.

- Container: Full width, rounded-[14px], overflow hidden
- Background: Gradient `from-[#1B2A4A] via-[#1E3A5F] to-[#2563EB]` (keep existing)
- **NEW — Seasonal overlay**: thin gradient tint from seasonal token (see Seasonal System)
- **NEW — City silhouette**: `hero-city` SVG illustration, positioned right, bottom-aligned, opacity 0.08-0.12, parallax at 0.3× scroll
- **NEW — Seasonal decorative SVGs**: 3-4 elements scattered, opacity per season table
- **NEW — Soft radial glow**: `radial-gradient(circle at 30% 40%, rgba(59,130,246,0.15), transparent 60%)` behind greeting text for depth
- Gap: `--space-4` between greeting and CTAs

**Greeting line**
- Text: 24px (sm:30px), weight 700, white, `text-shadow: 0 2px 12px rgba(0,0,0,0.15)` for depth
- Time-based greeting (unchanged logic)
- Date: `text-sm`, `text-blue-100/70`, displayed below greeting

**CTA buttons**
- Primary: `bg-white text-[#1B2A4A]`, radius-[10px], height 48px, `shadow-lg` (deeper than before)
  - **NEW**: subtle glow `shadow-[0_4px_20px_rgba(255,255,255,0.2)]` for pop
- Secondary: `border-white/20 bg-white/10`, glassmorphism-lite, `backdrop-blur-sm`

**Stats card (right side) — UPGRADED**
- **NEW — Glassmorphism**: `bg-white/10 backdrop-blur-xl border-white/15`
- **NEW — Inner glow**: `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]` for frosted edge
- Content unchanged (BJT stats, progress bar)

**Responsive**: On mobile, stats card moves below CTAs, full width, glassmorphism maintained

### Quick Actions Strip — UPGRADED
- Layout: 4-column grid (desktop), 2×2 grid (mobile, gap 12px)
- **NEW — Card depth**: each card has distinct colored gradient top-border (3px)
- **NEW — Illustration icons**: replace simple icons with `qa-*` SVG illustrations (48×48)
- **NEW — Hover parallax**: icon shifts up 2px, card lifts 3px with `shadow-lg`
- **NEW — Glassmorphism on hover**: `bg-white/90 backdrop-blur-sm` effect

**Each action card:**

| # | Illustration | Label | Gradient Top Border | Route |
|---|-------------|-------|-------------------|-------|
| 1 | `qa-flashcard` | Flashcards | `brand-blue → brand-sky` | `/flashcards` |
| 2 | `qa-bjt` | BJT Quiz | `brand-gold → amber-300` | `/quiz` |
| 3 | `qa-battle` | Battle | `brand-sakura → pink-300` | `/battle` |
| 4 | `qa-search` | Search | `teal-500 → cyan-400` | `/search` |

- Card: `bg-surface`, `border border-ink/8`, `radius-xl` (20px), padding 20px
- **Subtitle**: contextual ("15 due" / "N2 Prep" / "Join!" / "Dictionary"), `text-caption`, `text-tertiary`
- **Hover transition**: 200ms ease-out, `translateY(-3px)`, shadow `--shadow-card-hover → --shadow-lg`
- **Active**: `scale(0.97)` for 100ms

### Featured News Section (NHK Articles)
- Container: Full width, `--color-bg-surface` bg, `--radius-xl`, padding 20px
- Border: `1px solid --color-border-default`

**Tab bar**
- Tabs: "Easy" | "Normal"
- Active tab: `--color-brand-blue` text, weight 600, underline 2px
- Inactive: `--color-text-secondary`, weight 400
- Gap: 24px between tabs
- Margin bottom: 16px

**Article grid**
- Layout: Responsive grid, 4 columns (xl), 3 columns (lg), 2 columns (md), horizontal scroll (mobile)
- Card min-width: 220px (mobile scroll), full in grid
- Gap: 16px

**Article card**
- Background: `--color-bg-page`
- Border: `1px solid --color-border-subtle`
- Radius: `--radius-lg`
- Overflow: hidden (for image)
- Hover: `--shadow-md`, translateY(-2px)
- Transition: `--duration-normal` `--ease-out`

Card anatomy (top to bottom):
```
┌─────────────────────┐
│ [Article image]     │  ← 16:9 aspect ratio, object-fit: cover
│ 200px height        │  ← Progressive loading (skeleton → blur → sharp)
├─────────────────────┤
│ [Easy] badge        │  ← Difficulty badge, top-left over image
│                     │     Easy: `--color-success/10` bg, `--color-success` text
│                     │     Normal: `--color-warning/10` bg, `--color-warning` text
├─────────────────────┤
│ Article Title Goes  │  ← `text-body`, weight 600, 2-line clamp
│ Here Nicely...      │
├─────────────────────┤
│ 2 minutes ago       │  ← `text-caption`, `--color-text-tertiary`, relative time
├─────────────────────┤
│ [Read More] [+ Card]│  ← Action row
│                     │     "Read More": text button, `--color-brand-blue`
│                     │     "+ Card": ghost icon button, `bookmark-plus`, tooltip
└─────────────────────┘
```

**"Create Flashcard" dialog** (triggered by + Card button):
- Modal/sheet: `--color-bg-surface`, `--radius-xl`, `--shadow-overlay`
- Pre-filled: article title as front, URL as source
- Fields: Front (Japanese), Back (meaning), Tags
- Actions: [Cancel] [Create]

**Error state**: Soft message "Could not load news" + retry button, no aggressive error UI
**Loading state**: 4 skeleton cards with image placeholder + 2 text bars + button row

### Daily Japanese Section (Widget Strip)
- Container: Full width
- Section title: `text-h4`, weight 600, "Daily Japanese" / "今日の日本語"
- Layout: Horizontal scroll (overflow-x: auto, snap to card)
- Scrollbar: Hidden (`scrollbar-width: none`)
- Gap: 12px between cards
- Padding-right: 24px (peek effect for "more" affordance)

**Widget card**
- Width: 200px (fixed, mobile: 180px)
- Height: Auto (content-driven), min 140px
- Background: `--color-bg-surface`
- Border: `1px solid --color-border-default`
- Radius: `--radius-lg`
- Padding: 16px
- Hover: `--shadow-sm`
- Clickable → navigates to `/daily/{widget.id}`

Card anatomy:
```
┌──────────────────┐
│ 🌤 [Weather]     │  ← Emoji icon (based on kind) + Kind badge
│                  │     Badge colors by kind:
│                  │     weather: `--color-info/10` bg
│                  │     business_phrase: `--color-brand-gold/10` bg
│                  │     seasonal_word: `--color-brand-sakura/10` bg
│                  │     time_expression: `--color-brand-teal/10` bg
├──────────────────┤
│ 今日は暑いですね │  ← Japanese title: `font-japanese`, 16px, weight 600
├──────────────────┤
│ きょうはあついで…│  ← Reading: `text-body-sm`, `--color-text-secondary`
├──────────────────┤
│ Hôm nay nóng quá │  ← Explanation: `text-caption`, 2-line clamp, `--color-text-tertiary`
└──────────────────┘
```

**Scroll indicators (desktop)**:
- Left/right fade gradient (16px) when content overflows
- Optional: Arrow buttons on hover (left/right chevron, `--color-bg-surface` circle, `--shadow-sm`)

### Progress Section (Right Sidebar) — UPGRADED
- Position: sticky, `top: 80px`
- Width: `20rem` (320px) on lg+
- Mobile: becomes full-width section between Daily Japanese and Recommended
- **NEW — Glassmorphism card**: `bg-white/80 backdrop-blur-xl border-white/40 shadow-lg`
- **NEW — Daruma mascot**: positioned top-right of card, 48px, state-reactive (see Daruma Mascot States)

**Logged-in state — Stats grid**
- Layout: 2×2 grid, gap 12px
- Radius: `--radius-xl`
- Padding: 20px
- **NEW — Stat value animation**: count-up from 0 on first render (400ms, ease-out)
- **NEW — Colored stat icons**: each stat has its own brand color with subtle bg circle

| Stat | Icon | Color | Bg Circle |
|------|------|-------|-----------|
| Streak | `flame` | `--color-brand-gold` | `gold/10` |
| Reviews | `book-open` | `--color-brand-blue` | `blue/10` |
| Accuracy | `target` | `--color-success` | `success/10` |
| Sessions | `calendar` | `brand-teal` | `teal/10` |

- Stat value: 20px, weight 700, `--color-text-primary`
- Stat label: `text-caption`, `--color-text-tertiary`
- Footer link: "View full analytics →", `text-body-sm`, `--color-brand-blue`

**Not-logged-in state — Sign-in prompt**
- **NEW — Torii gate illustration**: `signin-gate` SVG, 80×80, centered above heading
- Heading: "Track your progress", weight 600
- Body: "Sign in to save your learning data", `text-body-sm`, `--color-text-secondary`
- CTA: [Sign In] primary + [Create Account] text link
- Heading: "Track your progress", `text-body`, weight 600
- Body: "Sign in to save your learning data", `text-body-sm`, `--color-text-secondary`
- CTA: [Sign In] primary button + [Create Account] text link below

### Recommended Section (Quizzes + Decks)
- Container: Full width, below the 2-column grid
- Section title: `text-h4`, weight 600, "Recommended for you" / "おすすめ"
- Layout: 6-column grid (xl), 3-column (lg), 2-column (md), horizontal scroll (mobile)
- Gap: 16px
- Data: Up to 3 quiz templates + up to 3 public decks (6 total max)

**Recommended card**
- Background: `--color-bg-surface`
- Border: `1px solid --color-border-default`
- Radius: `--radius-lg`
- Padding: 16px
- Hover: `--shadow-md`, translateY(-2px)
- Height: Equal within row (stretch)

Card anatomy:
```
┌─────────────────────┐
│ [📝] Quiz           │  ← Type icon + kind label
│ or [📖] Deck        │     Quiz: `file-text` icon, `--color-brand-gold`
│                     │     Deck: `layers` icon, `--color-brand-blue`
├─────────────────────┤
│ [N2] [BJT]          │  ← Level/kind badges, pill shape, small
├─────────────────────┤
│ BJT N2 Reading      │  ← Title: `text-body`, weight 600, 2-line clamp
│ Comprehension       │
├─────────────────────┤
│ "For BJT N2 prep"   │  ← Reason: `text-caption`, `--color-text-secondary`, italic
├─────────────────────┤
│ ████████░░░ 60%     │  ← Progress bar: 4px height, `--radius-full`
│                     │     Fill: `--color-brand-blue`, Track: `--color-bg-sunken`
├─────────────────────┤
│ 4 sections          │  ← Meta: `text-caption`, `--color-text-tertiary`
│ or "120 cards"      │     Quiz: section count, Deck: card count
└─────────────────────┘
```

## Animations — UPGRADED

| Event | Visual | Sound | Duration |
|-------|--------|-------|----------|
| Page load | Sections fade-in + slide-up staggered (60ms between) | — | 400ms total |
| Hero parallax | Background illustration + seasonal elements drift on scroll | — | Continuous (rAF) |
| Seasonal elements | Gentle float/drift (sakura petals fall, snowflakes drift) | — | 8-12s loop |
| Stat numbers | Count-up from 0 with ease-out | — | 400ms |
| Daruma mascot | Subtle idle bounce (2px, 3s loop) | — | 3s loop |
| News tab switch | Crossfade card grid | — | 200ms |
| Daily widget scroll | Snap scroll with momentum | — | — |
| Card hover (desktop) | `translateY(-3px)` + shadow escalate + icon shift | — | 200ms |
| Quick action hover | Gradient top-border glow intensifies | — | 200ms |
| CTA tap | `scale(0.97)` → navigate | — | 100ms |
| News image load | Blur → sharp (progressive) | — | 300ms |
| Badge pulse (new due) | Scale 1→1.1→1, once | — | 300ms |
| Progress bar | Width 0→value% with ease-out | — | 600ms |
| Glass card appear | Fade-in + scale(0.95→1) | — | 300ms |
| `prefers-reduced-motion` | All animations instant, parallax disabled, seasonal elements static | — | 0ms |

## Data Requirements

| Section | API Source | Refresh |
|---------|-----------|---------|
| Greeting | User profile + server time | On page load |
| Primary CTA | `/api/daily/home` → `dueReviewCount` | On page load |
| Quick Actions | `/api/daily/home` → widget configs | On page load |
| Featured News | `/api/nhk-news?type=easy\|normal&limit=8` | On page load, cache 5min |
| Daily Japanese | `/api/daily/home` → `widgets[]` | On page load, cache per day |
| Progress Stats | `/api/analytics/learner?days=7` (auth required) | On page load |
| Recommended | `/api/quiz/templates?status=published&limit=6` + `/api/flashcards/decks?visibility=public&limit=6` | On page load, cache 15min |

**Parallel loading strategy** (implemented in `homepage-client.tsx`):
- All API calls fire in parallel via `Promise.allSettled`
- Each section renders independently with its own loading/error state
- No waterfall — user sees content progressively

## States

| State | Visual |
|-------|--------|
| Loading | Each section shows own skeleton: greeting bar + CTA skeleton + 4 action card skeletons + 4 news card skeletons + 3 widget skeletons |
| New user (no data) | Greeting (generic), Quick Actions visible, News visible, Stats → sign-in prompt, Recommended still shows |
| Returning (has data) | Full personalized: name, due counts, stats, progress bars |
| All reviews done | Primary CTA switches to "Take a Quiz" instead of "Review Now" |
| No news available | Featured News section shows "No articles yet" + illustration |
| API error (per section) | Soft "Could not load" message + [Retry] button, other sections unaffected |
| Offline | Cached data + "Offline — some data may be outdated" banner below top bar |
| Not logged in | Stats section becomes sign-in prompt; CTA still works (redirect to auth) |

## Personalization Rules

| Condition | Home Adaptation |
|-----------|----------------|
| Has due reviews | Primary CTA = "Review Now (N)" |
| No due reviews | Primary CTA = "Take a Quiz" |
| Logged in | Stats sidebar shows 4 stat cards |
| Not logged in | Stats sidebar shows sign-in prompt |
| Has analytics | Stat numbers populated |
| No analytics yet | Stats show "—" or "Start learning!" |
| News API fails | Section shows retry state, rest of page unaffected |
| Daily widgets empty | Section hidden entirely |

## Component File Map

| Section | File | Key Props |
|---------|------|-----------|
| Page shell | `apps/web/app/[locale]/page.tsx` | locale, messages |
| Client orchestrator | `…/_components/homepage/homepage-client.tsx` | labels (i18n) |
| Hero | `…/homepage/hero-section.tsx` | greeting, date, CTAs |
| Quick Actions | `…/homepage/quick-actions-strip.tsx` | items (icon, label, count, href) |
| Featured News | `…/homepage/featured-news-section.tsx` | articles[], activeTab |
| Daily Japanese | `…/homepage/daily-japanese-section.tsx` | widgets[] |
| Progress | `…/homepage/progress-section.tsx` | stats or null (guest) |
| Recommended | `…/homepage/recommended-section.tsx` | quizzes[], decks[] |
| Types | `…/homepage/types.ts` | HomepageLabels, NhkArticle, DailyWidget, LearnerAnalytics |

## Bottom Navigation (Mobile)

| Icon | Label | Active indicator |
|------|-------|-----------------|
| `layout-dashboard` | Home | `--color-brand-blue` fill + dot below |
| `search` | Search | — |
| `book-open` | Study | — |
| `swords` | Battle | Green dot if active rooms |
| `user` | Profile | — |

- Height: 56px + safe area
- Background: `--color-bg-surface`
- Shadow: `--shadow-sticky` (top)
- Active: icon + label colored `--color-brand-blue`
- Inactive: `--color-text-tertiary`
- Badge (notifications): red dot on Profile icon

## Accessibility
- Greeting: `role="banner"`, uses user's preferred name
- Study plan: `role="region"`, `aria-label="Today's study plan"`
- Progress chart: `aria-label` with text summary ("Studied 4 of 7 days this week")
- Quick actions: Standard button/link semantics
- Bottom nav: `role="navigation"`, active item has `aria-current="page"`
- Reduced motion: No staggered fade-in, instant render

## Rules
1. **Home loads fast** — target < 1s FCP; parallel API calls, no waterfall.
2. **Never empty** — even guests see Quick Actions, News, Daily Japanese, Recommended.
3. **Sections are independent** — one failing API doesn't break the whole page.
4. **No guilt** — missed days are never highlighted negatively.
5. **Real data only** — every number is backed by API, never fake/hardcoded.
6. **One primary CTA** — "Review Now" or "Take a Quiz" is always the most prominent.
7. **News is fresh** — NHK articles update regularly, show relative timestamps.
8. **Daily widgets are curated** — server-driven, culturally relevant, different every day.
9. **Stats require auth** — progress section gracefully degrades to sign-in prompt.
10. **No ads on home** — home screen is sacred, never interrupted by promotional content.
11. **Recommended shows real progress** — progress bar reflects actual user completion.
12. **Mobile is scroll-friendly** — horizontal scroll for news/daily/recommended on small screens.
13. **Seasonal is subtle** — accents enhance mood, never distract from content.
14. **Illustrations are inline SVG** — zero extra HTTP requests, instant render.
15. **Glassmorphism is an accent** — max 2-3 glass elements per viewport; most surfaces stay solid.
16. **Parallax respects `prefers-reduced-motion`** — disabled entirely when user prefers reduced motion.
17. **Daruma is delightful, not required** — functional information is never locked behind the mascot.

## Implementation Plan

### Phase 1: Seasonal System + SVG Illustrations
1. Create `apps/web/app/[locale]/_components/homepage/seasonal.ts` — season detection utility
2. Create `apps/web/app/[locale]/_components/homepage/illustrations/` — all SVG illustration components
3. Create seasonal decorative SVG elements (sakura petals, waves, momiji, snowflakes)

### Phase 2: Hero Section Visual Upgrade
1. Add city silhouette SVG to hero background
2. Add seasonal overlay tint and decorative elements
3. Upgrade stats card to glassmorphism
4. Add parallax scroll effect (with reduced-motion guard)
5. Improve text shadows and CTA glow

### Phase 3: Quick Actions Visual Upgrade
1. Replace simple icons with illustration SVG components
2. Add gradient top-border to each card
3. Add hover depth effect (translateY + shadow escalation)

### Phase 4: Progress Section + Daruma Mascot
1. Create Daruma SVG component with 5 states
2. Add glassmorphism to progress card
3. Add stat count-up animation
4. Add torii gate illustration to sign-in prompt

### Phase 5: Section Polish + Micro-interactions
1. Add staggered fade-in on page load
2. Polish news cards with depth shadows
3. Polish recommended section with hover effects
4. Add daily section scroll indicators

### Files Affected
```
apps/web/app/[locale]/_components/homepage/
  ├── seasonal.ts                    (NEW — season detection)
  ├── illustrations/                 (NEW — directory)
  │   ├── hero-city.tsx             (NEW — city silhouette)
  │   ├── qa-flashcard.tsx          (NEW — flashcard illustration)
  │   ├── qa-bjt.tsx                (NEW — BJT document illustration)
  │   ├── qa-battle.tsx             (NEW — battle illustration)
  │   ├── qa-search.tsx             (NEW — search illustration)
  │   ├── daruma.tsx                (NEW — daruma mascot, 5 states)
  │   ├── signin-gate.tsx           (NEW — torii gate illustration)
  │   ├── seasonal-elements.tsx     (NEW — sakura/wave/momiji/snow SVGs)
  │   └── empty-news.tsx            (NEW — newspaper illustration)
  ├── hero-section.tsx              (MODIFIED — visual upgrade)
  ├── quick-actions-strip.tsx       (MODIFIED — illustrations + depth)
  ├── progress-section.tsx          (MODIFIED — daruma + glassmorphism)
  ├── featured-news-section.tsx     (MODIFIED — hover depth polish)
  ├── recommended-section.tsx       (MODIFIED — hover depth polish)
  └── homepage-client.tsx           (MODIFIED — staggered fade-in wrapper)
```

### Performance Budget
- All SVG illustrations: < 5KB each (inline, no HTTP)
- Parallax JS: < 500 bytes (CSS custom property + rAF listener)
- Total added weight: < 40KB (all SVGs + animation CSS combined)
- No new API calls — seasonal detection is client-side date math
- No layout shift — illustrations are positioned absolute/decorative
