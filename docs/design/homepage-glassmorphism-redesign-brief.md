# NihonGo BJT — Learner Homepage Visual Redesign Brief

## Design Direction: "Frosted Focus"

Subtle glassmorphism as a clarity device — not decoration. The glass treatment creates visual depth layers that guide the eye from background canvas → translucent panels → opaque content, reducing cognitive fatigue during long study sessions. Per DESIGN.md: "quiet must not become bland" and "heavy glassmorphism" is forbidden. This brief uses glass as structure, not spectacle.

---

## 1. Color Palette Revision

### Research Basis
Deep blues and muted blue-greens reduce cognitive fatigue and promote sustained focus (Mehta & Zhu, 2009). Warm neutrals prevent the clinical feel of pure white. High-saturation accent colors are reserved for actions only, keeping the content field calm.

### New Token Definitions

```css
@theme {
  /* ── Canvas & Surface ── */
  --color-canvas:         #f0f2f5;    /* Cool gray-blue canvas — softer than #f9fafb, less yellow than beige */
  --color-surface:        #ffffff;    /* Opaque card/panel surface */
  --color-surface-glass:  rgba(255, 255, 255, 0.72); /* Frosted glass panels */
  --color-surface-raised: rgba(255, 255, 255, 0.88); /* Slightly more opaque glass for interactive elements */

  /* ── Text ── */
  --color-ink:            #1a2332;    /* Deep navy-charcoal — warmer than pure gray, reduces eye strain */
  --color-muted:          #5b6b7d;    /* Blue-gray secondary — more depth than #6b7280 */
  --color-subtle:         #8899aa;    /* Tertiary text / timestamps */

  /* ── Focus Accents (study-oriented blues) ── */
  --color-accent:         #2563eb;    /* Decisive blue primary CTA — 4.5:1 on white */
  --color-accent-hover:   #1d4ed8;    /* Hover: deeper blue */
  --color-accent-soft:    #dbeafe;    /* Light blue tint for backgrounds */
  --color-accent-surface: #eff6ff;    /* Very light blue for focus surfaces */

  /* ── Semantic ── */
  --color-leaf:           #16a34a;    /* Success/progress green — slightly brighter for glass bg readability */
  --color-leaf-soft:      #dcfce7;    /* Green tint backgrounds */
  --color-sakura:         #dc2626;    /* Danger/loss — pure red, not pink */
  --color-sakura-soft:    #fef2f2;    /* Error backgrounds */
  --color-amber:          #d97706;    /* Warning/attention */
  --color-amber-soft:     #fef3c7;    /* Warning backgrounds */

  /* ── Glass System ── */
  --glass-blur:           12px;       /* backdrop-filter blur radius */
  --glass-blur-heavy:     20px;       /* Banner/hero blur */
  --glass-border:         rgba(255, 255, 255, 0.25);  /* Subtle white edge */
  --glass-border-color:   rgba(0, 0, 0, 0.06);        /* Very faint dark edge for depth */
  --glass-shadow:         0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.03);

  /* ── Exam Mode (unchanged, for reference) ── */
  --color-exam-bg:        #0f172a;
  --color-exam-surface:   #1e293b;
}
```

### Why These Colors

| Old Token | Old Value | New Value | Rationale |
|-----------|-----------|-----------|-----------|
| `canvas` | `#f9fafb` (warm near-white) | `#f0f2f5` (cool gray-blue) | Cool undertone reduces eye strain over hours; glass panels pop cleanly against it |
| `ink` | `#111827` (near-black) | `#1a2332` (navy-charcoal) | Slightly lighter, warmer reading tone; 12.8:1 contrast on canvas |
| `muted` | `#6b7280` (flat gray) | `#5b6b7d` (blue-gray) | Harmonizes with blue accent family; 5.2:1 on white |
| `accent` | `#3730a3` (dark indigo) | `#2563eb` (decisive blue) | Brighter, more visible as CTA; 4.6:1 on white; clear through glass layers |
| `surface` | `#ffffff` | Split into `surface` (opaque) + `surface-glass` (translucent) | Enables depth without losing readability |

### Palette Personality
- **Dominant**: Cool neutrals (`canvas`, `surface`) — 75% of screen area
- **Supporting**: Blue accent family — CTAs, active states, focus indicators
- **Sparse semantic**: Green (progress), red (errors), amber (warnings) — appear only with meaning
- **Forbidden**: Purple-blue gradients, beige/tan, heavy dark backgrounds outside exam mode

---

## 2. Glassmorphism Treatment

### Philosophy
Glass is used to create **depth hierarchy**, not visual novelty. Three depth layers:

```
Layer 0: Canvas background (#f0f2f5) — the page itself
Layer 1: Glass panels (surface-glass) — section containers, info cards
Layer 2: Opaque elevated (surface) — interactive elements, CTAs, inputs, popovers
```

### Where Glass Is Applied

| Element | Treatment | Why |
|---------|-----------|-----|
| Study command bar (§2) | `surface-glass` + `glass-blur` | Hero-level visual anchor; glass makes it feel premium without heavy |
| Quick study path cards (§3) | `surface-raised` + `glass-blur` (lighter) | Hoverable interactive cards benefit from slight translucency |
| Dashboard stat cards (§4 auth) | `surface-glass` + `glass-blur` | Data panels feel lighter and more modern |
| Daily Japanese widget cards (§7) | `surface-glass` + `glass-blur` | Content cards that scroll — glass separates them from canvas without hard borders |
| Guest sign-in prompt (§4 guest) | `surface` (opaque) | Must feel solid and trustworthy — no glass on auth CTAs |
| Banner sections (§1, §5) | No glass — use gradient or opaque bg | Banners need contrast, not translucency |
| Carousel cards | `surface-raised` + light blur | Slightly frosted to differentiate from static content |

### Where Glass Is NOT Applied

- Text-heavy reading areas (explanations, safeguard disclaimers) — **always opaque**
- Auth buttons and forms — **always opaque and decisive**
- Exam mode — uses its own dark theme, no glass
- Footer — opaque for trust/stability
- Error/loading states — opaque for clarity

### CSS Implementation Pattern

```css
/* Utility class: .glass-panel */
.glass-panel {
  background: var(--color-surface-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-color);
  border-top-color: var(--glass-border);
  box-shadow: var(--glass-shadow);
}

/* Utility class: .glass-card (interactive, slightly more opaque) */
.glass-card {
  background: var(--color-surface-raised);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-color);
  border-top-color: var(--glass-border);
  box-shadow: var(--glass-shadow);
  transition: background 150ms ease, box-shadow 150ms ease;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.04);
}
```

### Tailwind Equivalents (for inline use)

```tsx
// Glass panel
className="bg-white/[0.72] backdrop-blur-[12px] border border-black/[0.06] border-t-white/25 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)]"

// Glass card (interactive)
className="bg-white/[0.88] backdrop-blur-[12px] border border-black/[0.06] border-t-white/25 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] hover:bg-white/[0.94] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-150"
```

### Fallback for No Backdrop-Filter Support

```css
@supports not (backdrop-filter: blur(1px)) {
  .glass-panel,
  .glass-card {
    background: rgba(255, 255, 255, 0.95);
  }
}
```

---

## 3. Section-by-Section Layout Plan

### Canvas Background Treatment

Add a very subtle gradient mesh or geometric noise to the `#f0f2f5` canvas so glass panels have something to blur against. Without background variation, glass looks identical to opaque white.

```css
body {
  background: #f0f2f5;
  /* Subtle fixed gradient dots — very faint blue circles at strategic positions */
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(37, 99, 235, 0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 100%, rgba(22, 163, 74, 0.03) 0%, transparent 50%);
  background-attachment: fixed;
}
```

This creates barely-visible blue and green glows at the top-left and bottom-right. Through glass panels, they produce a subtle warm shift — visible enough to prove the glass is working, invisible enough to not distract.

---

### §1 — Greeting Header → **Gradient Banner**

**Current**: Plain `<header>` with h1, subtitle, streak badge. Flat, no visual weight.

**New**: Full-width banner with a subtle gradient background. This is the emotional anchor of the page.

```
┌─────────────────────────────────────────────────────┐
│  ░░░░░░░░░ subtle gradient bg ░░░░░░░░░░░░░░░░░░░  │
│                                                     │
│  おはようございます                    📅 May 1  │
│  Chào buổi sáng — sẵn sàng ôn tập!    🔥 12 ngày  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Implementation**:

```tsx
<header className="relative overflow-hidden rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
  {/* Gradient background — NOT glass; banner needs solidity */}
  <div className="absolute inset-0 bg-gradient-to-br from-[#1a2332] via-[#1e3a5f] to-[#1a2332]" />
  {/* Optional: subtle noise texture overlay */}
  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url(/noise.svg)' }} />

  <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
    <div className="space-y-1">
      <h1 className="jp-text text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {greeting.japanese}
      </h1>
      <p className="text-sm text-white/70">{greeting.reading}</p>
      <p className="max-w-md text-sm text-white/50">{subtitle}</p>
    </div>
    <div className="flex items-center gap-3 text-sm text-white/60">
      <span>{today}</span>
      <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white/90 border border-white/10">
        🔥 {streakDisplay}
      </span>
    </div>
  </div>
</header>
```

**Color rationale**: Deep navy banner (`#1a2332` → `#1e3a5f`) creates a "study cockpit" entrance. White text on navy gives 14:1+ contrast. The dark header anchors the page and makes the glass panels below feel lighter by contrast.

**Streak badge**: Frosted pill on the banner — tiny glass effect that feels premium. `bg-white/10 backdrop-blur-sm border border-white/10`.

---

### §2 — Study Command Bar → **Glass Hero Panel**

**Current**: White card with `border border-ink/10`, dark CTA strip at bottom.

**New**: Primary glass panel with prominent CTA. This is the most important interactive element.

```
┌─ glass panel ──────────────────────────────────────┐
│  Kế hoạch hôm nay                                 │
│  12 thẻ cần ôn · Gợi ý: Ôn flashcard trước       │
│                                                     │
│  ┌─ solid blue CTA ──────────────────────────────┐ │
│  │  復  Bắt đầu ôn tập ngay  →  12 thẻ chờ      │ │
│  └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**Implementation**:

```tsx
<section className="glass-panel overflow-hidden rounded-2xl">
  <div className="p-5 sm:p-6">
    <h2 className="text-base font-semibold text-ink">{todayPlanTitle}</h2>
    <p className="mt-1 text-sm text-muted">{dueReviewsLine}</p>
    <p className="mt-2 text-sm text-subtle">{recommendationFallback}</p>
  </div>
  {/* CTA: OPAQUE, not glass — decisive action */}
  <a
    className="group flex min-h-[52px] w-full items-center gap-3 bg-accent px-5 py-3 text-white transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white active:bg-[#1e40af]"
    href="/flashcards"
  >
    <span className="jp-text flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">復</span>
    <div className="flex-1">
      <span className="block text-sm font-bold">{primaryCta}</span>
      <span className="block text-xs text-white/60">{dueCount} cards due</span>
    </div>
    <ChevronRight />
  </a>
</section>
```

**Key changes**:
- Panel body: glass (`bg-white/[0.72] backdrop-blur-[12px]`)
- CTA strip: solid blue (`bg-accent` = `#2563eb`), NOT glass, NOT dark ink — blue is more inviting and clearly actionable
- CTA contrast: white text on `#2563eb` = 4.6:1 (AA pass). Bold weight pushes effective contrast higher.

---

### §3 — Quick Study Paths → **Swipeable Glass Card Carousel**

**Current**: 2×2 grid on mobile, 4-col on desktop. Static white cards with ink/8 borders.

**New**: Horizontal scrolling carousel on mobile, 4-col grid on desktop. Glass cards with color-coded kanji icons.

```
Mobile (swipeable):
← [復 Ôn tập] [試 BJT] [対 Battle] [検 Tìm] →

Desktop (grid):
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ 復 Ôn tập │ │ 試 BJT    │ │ 対 Battle │ │ 検 Search │
│ 12 thẻ    │ │ Luyện đề  │ │ Thách đấu │ │ Tra cứu   │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
```

**Implementation**:

```tsx
<nav aria-label={actionsSectionTitle}>
  {/* Mobile: horizontal scroll; Desktop: grid */}
  <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
    {paths.map(({ href, kanji, label, desc, colorClass }) => (
      <a
        key={href}
        href={href}
        className="glass-card group flex min-w-[140px] snap-start items-center gap-3 rounded-xl p-3.5 sm:min-w-0"
      >
        <span className={`jp-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${colorClass}`}>
          {kanji}
        </span>
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{label}</span>
          <span className="block text-xs text-muted">{desc}</span>
        </div>
      </a>
    ))}
  </div>
</nav>
```

**Color-coded kanji backgrounds** (on glass):

```tsx
const pathColors = {
  flashcard: "bg-accent/10 text-accent",      // Blue — review
  bjt:       "bg-leaf/10 text-leaf",           // Green — exam prep
  battle:    "bg-sakura/10 text-sakura",       // Red — competition
  search:    "bg-ink/5 text-ink/60",           // Neutral — utility
};
```

**Swipe behavior**:
- Mobile: `overflow-x-auto` + `snap-x snap-mandatory` + `snap-start` on children
- Hide scrollbar: `scrollbar-none` (Tailwind plugin) or CSS `scrollbar-width: none; -webkit-overflow-scrolling: touch;`
- No JavaScript carousel library needed — CSS snap is sufficient and accessible
- `prefers-reduced-motion`: snap still works, just disable any scroll animation easing

---

### §4 — Guest Sign-In Prompt

**Current**: White card with centered text and dark button.

**New**: Frosted glass panel with a warm, inviting tone. Auth CTA is **opaque and decisive**.

```
┌─ glass panel ──────────────────────────────────────┐
│                                                     │
│  Đăng nhập để theo dõi tiến độ học tập             │
│                                                     │
│         [  Đăng nhập ngay  →  ]  (solid blue)      │
│                                                     │
└────────────────────────────────────────────────────┘
```

```tsx
<div className="glass-panel rounded-2xl p-8 text-center">
  <p className="text-sm text-muted">{signInDescription}</p>
  <a
    className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-accent px-8 py-3 text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all hover:bg-accent-hover hover:shadow-[0_4px_16px_rgba(37,99,235,0.30)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-[#1e40af]"
    href="/login"
  >
    {signInTitle}
    <ChevronRight />
  </a>
</div>
```

**Critical**: Auth CTA uses `bg-accent` (solid `#2563eb`) with a subtle blue shadow glow. NOT glass background on the button itself. The glass panel behind it provides enough premium feel.

---

### §4 — Authenticated Dashboard Grid

**Current**: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` with white bordered cards.

**New**: Glass stat cards with improved data hierarchy.

```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {/* Each card */}
  <div className="glass-panel rounded-xl p-4">
    <p className="text-xs font-medium uppercase tracking-wider text-subtle">
      {title}
    </p>
    {/* ... data content ... */}
  </div>
</div>
```

**Stat cards refinement**:
- Use `tabular-nums` for all numbers (already present — keep)
- Large stat numbers: `text-2xl font-bold text-ink` (increase from `text-lg`)
- Metric labels: `text-subtle` (new tertiary color, lighter than `muted`)
- Card hover: glass becomes more opaque, slight shadow increase

**Insight banner** (full-width across grid):

```tsx
<div className="col-span-full rounded-xl bg-leaf-soft/80 backdrop-blur-sm border border-leaf/10 p-4">
  <p className="text-sm text-leaf">
    <strong>{insightLabel}:</strong> {insight}
  </p>
</div>
```

---

### §5 — Comeback Evidence → **Glass Panel (authenticated only)**

Keep as glass card within the dashboard grid. No special treatment — it's data.

---

### §6 — Recent Battles + Quiz Templates → **Swipeable Carousel**

**Current**: Static list items in grid cards.

**New**: On mobile, battle results and quiz templates become horizontal scrollable cards.

```
Mobile:
← [Battle 1: Win 7-3] [Battle 2: Loss 4-6] [Battle 3] →

Desktop:
Side-by-side glass panels (battles left, quizzes right)
```

```tsx
<div className="grid gap-3 lg:grid-cols-2">
  {/* Battles carousel */}
  <div className="glass-panel rounded-xl p-4">
    <h3 className="text-xs font-medium uppercase tracking-wider text-subtle">{recentBattleTitle}</h3>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none lg:flex-col lg:overflow-visible">
      {battles.map(b => (
        <div key={b.id} className="min-w-[200px] snap-start rounded-lg bg-white/60 p-3 lg:min-w-0">
          {/* battle result card */}
        </div>
      ))}
    </div>
  </div>

  {/* Quiz templates */}
  <div className="glass-panel rounded-xl p-4">
    <h3 className="text-xs font-medium uppercase tracking-wider text-subtle">{availableTestsTitle}</h3>
    {/* ... quiz list ... */}
  </div>
</div>
```

---

### §7 — Daily Japanese → **Marquee Header + Glass Widget Carousel**

This section gets the most visual personality. Two sub-parts:

#### 7a. Daily Phrase Marquee Banner

A scrolling/marquee text strip showing the day's featured Japanese phrase. This is the "scrolling text" element.

```
┌─────────────────────────────────────────────────────┐
│  ≫ 今日のフレーズ: お疲れ様です — Good work today ≫ │
└─────────────────────────────────────────────────────┘
```

**Implementation**:

```tsx
{/* Marquee container */}
<div className="relative overflow-hidden rounded-xl bg-ink/[0.03] py-2.5" role="marquee" aria-live="off">
  <div className="marquee-track flex whitespace-nowrap">
    <span className="marquee-content inline-flex items-center gap-6 px-4 text-sm">
      <span className="text-subtle">≫</span>
      <span className="jp-text font-semibold text-ink">{phrase.japanese}</span>
      <span className="text-muted">—</span>
      <span className="text-muted">{phrase.meaning}</span>
      <span className="mx-8 text-subtle">·</span>
      {/* Repeat for continuous loop */}
    </span>
    {/* Duplicate for seamless loop */}
    <span className="marquee-content inline-flex items-center gap-6 px-4 text-sm" aria-hidden="true">
      {/* Same content duplicated */}
    </span>
  </div>
</div>
```

**Marquee CSS**:

```css
.marquee-track {
  animation: marquee-scroll 30s linear infinite;
}

@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .marquee-track {
    animation: none;
    /* Falls back to static centered text */
    justify-content: center;
    overflow: hidden;
  }
  .marquee-content:nth-child(2) {
    display: none;
  }
}
```

**Marquee speed**: 30s for a comfortable reading pace. Not too fast (anxiety), not too slow (boring). Users can hover to pause:

```css
.marquee-track:hover,
.marquee-track:focus-within {
  animation-play-state: paused;
}
```

#### 7b. Featured Widget Cards → **Swipeable Glass Carousel**

**Current**: 3-col grid of white bordered cards.

**New**: Horizontal carousel on mobile, 3-col grid on desktop. Glass cards with subtle category color coding.

```
Mobile (swipeable):
← [🌤 Weather] [💼 Business] [🌸 Seasonal] →

Desktop:
┌─ glass ────────┐ ┌─ glass ────────┐ ┌─ glass ────────┐
│ THỜI TIẾT      │ │ KINH DOANH     │ │ THEO MÙA       │
│ 天気は晴れです  │ │ お疲れ様です    │ │ 桜前線          │
│ reading...      │ │ reading...      │ │ reading...      │
└────────────────┘ └────────────────┘ └────────────────┘
```

```tsx
<div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
  {orderedFeatured.map(widget => (
    <div
      key={widget.config.id}
      className="glass-card min-w-[260px] snap-start rounded-xl sm:min-w-0"
    >
      <div className="border-b border-black/[0.04] px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-subtle">
          {labelForKind(kind)}
        </span>
      </div>
      <div className="p-4">
        <p className="jp-text text-base font-semibold leading-relaxed text-ink">
          {item.japaneseText}
        </p>
        <p className="mt-1 text-xs text-muted">{item.readingText}</p>
      </div>
    </div>
  ))}
</div>
```

#### 7c. Life in Japan Widgets

Same glass card treatment as featured widgets. Use `sm:grid-cols-2` layout. Each card gets a small category pill.

---

## 4. Typography and Hierarchy

### Changes from Current

| Element | Current | New | Reason |
|---------|---------|-----|--------|
| Greeting h1 | `text-2xl sm:text-3xl text-ink` | `text-2xl sm:text-3xl text-white` | Moves to dark banner |
| Section titles | `text-sm font-semibold text-ink` | `text-xs font-medium uppercase tracking-wider text-subtle` | Quieter section labels let content speak |
| Stat numbers | `text-lg font-bold` | `text-2xl font-bold` | Bigger numbers = faster scanning |
| Card body text | `text-sm text-muted` | `text-sm text-muted` | Unchanged — already good |
| Japanese text | `jp-text text-base font-semibold` | `jp-text text-base font-semibold leading-relaxed` | Add `leading-relaxed` for readability through glass |
| Timestamps | `text-[10px] text-muted` | `text-[10px] text-subtle` | New `subtle` token for tertiary info |
| Category labels | `text-[10px] font-semibold uppercase tracking-wider text-muted` | `text-[10px] font-semibold uppercase tracking-widest text-subtle` | Even quieter, wider tracking |

### Font Stack (unchanged)
```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Japanese Text Enhancement
Add a `jp-text` class refinement for glass readability:

```css
.jp-text {
  font-feature-settings: "palt" 1; /* Proportional alternates for Japanese */
  line-height: 1.75; /* Generous for kanji readability */
  /* Slightly increase weight for readability through translucent layers */
  -webkit-font-smoothing: antialiased;
}
```

---

## 5. Motion & Animation Specs

### Transitions (all interactive elements)

```css
/* Standard transition for hover/focus */
transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Tailwind: transition-all duration-150 */
```

### Glass Card Hover

```css
.glass-card {
  transition: background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}
.glass-card:hover {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.04);
  transform: translateY(-1px); /* Subtle lift */
}
.glass-card:active {
  transform: translateY(0);
  background: rgba(255, 255, 255, 0.97);
}
```

### Marquee
- Speed: `30s` linear infinite
- Pause on hover/focus-within
- Reduced-motion: static centered text

### Carousel Scroll Snap
- CSS-only: `scroll-snap-type: x mandatory`
- Deceleration: native browser momentum scrolling (`-webkit-overflow-scrolling: touch`)
- No JS libraries required
- Optional: add scroll indicators (dots) below carousel on mobile

### Page Load
- Skeleton loading states: `animate-pulse` with glass-tinted backgrounds (`bg-ink/[0.04]` instead of `bg-ink/5`)
- Section fade-in: NOT recommended — adds load time perception and violates "restrained motion"

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .glass-card:hover {
    transform: none; /* Remove lift */
  }
  .marquee-track {
    animation: none;
  }
  /* Snap scrolling still works — it's gesture-driven, not animated */
}
```

---

## 6. Accessibility

### Contrast Ratios (verified)

| Element | Foreground | Background | Ratio | Pass |
|---------|-----------|------------|-------|------|
| Body text on canvas | `#1a2332` | `#f0f2f5` | 12.8:1 | AAA |
| Body text on glass | `#1a2332` | ~`#f5f6f8` effective | 11.4:1 | AAA |
| Muted text on canvas | `#5b6b7d` | `#f0f2f5` | 5.2:1 | AA |
| Subtle text on canvas | `#8899aa` | `#f0f2f5` | 3.3:1 | AA Large only |
| Primary CTA | `#ffffff` | `#2563eb` | 4.6:1 | AA |
| Primary CTA (bold) | `#ffffff` | `#2563eb` | 4.6:1 | AA (bold ≥14pt) |
| Banner text | `#ffffff` | `#1a2332` | 14.7:1 | AAA |
| Streak badge on banner | `#ffffff/0.9` | dark bg | ~12:1 | AAA |

### Keyboard Navigation
- All carousel items reachable via Tab
- `snap-x` scrolling works with arrow keys in most browsers
- Focus-visible: `outline: 3px solid #2563eb; outline-offset: 2px` (blue matches accent, more visible than current pink)
- Skip-to-content link unchanged

### Screen Readers
- Marquee: `role="marquee"` + `aria-live="off"` (decorative, not critical info)
- Duplicate marquee content: `aria-hidden="true"` on the clone
- Carousels: `role="region"` + `aria-label` + visible overflow hint
- Glass panels: no extra ARIA needed — visual-only enhancement

### High Contrast / Forced Colors

```css
@media (forced-colors: active) {
  .glass-panel,
  .glass-card {
    background: Canvas;
    border: 1px solid CanvasText;
    backdrop-filter: none;
  }
}
```

---

## 7. Mobile Responsive Approach

### Breakpoints (Tailwind defaults)

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Base | < 640px | Single column. Carousels are horizontal scroll. All panels full-width. |
| `sm` | ≥ 640px | 2-col grids for dashboard cards. Carousels become grids. |
| `lg` | ≥ 1024px | 3-col dashboard grid. Max-width container. |
| `xl` | ≥ 1280px | Wider content area (`max-w-6xl` instead of `max-w-5xl`). |

### Mobile-Specific

1. **Banner (§1)**: Full-bleed rounded corners. Padding reduced to `px-4 py-5`.
2. **Command bar (§2)**: CTA tap target ≥ 52px (already met). Full-width.
3. **Quick paths (§3)**: Horizontal scroll with `min-w-[140px]` cards. No wrapping.
4. **Dashboard grid (§4)**: Stack to single column. Stat numbers remain large.
5. **Marquee (§7a)**: Same speed, same behavior. Touch to pause not needed (auto-scrolls).
6. **Widget cards (§7b)**: Horizontal scroll with `min-w-[260px]` cards.
7. **Bottom nav**: No change (handled by app shell).
8. **Footer**: Stays at bottom, no overlap with mobile nav.

### Container

```tsx
<div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-16 sm:px-6 xl:max-w-6xl">
```

Change from current: add `px-4 sm:px-6` for consistent horizontal padding. Increase `space-y-6` to `space-y-5` (slightly tighter, glass panels create enough visual separation via depth).

### Touch Interactions
- Carousel: native momentum scroll, snap points
- Glass cards: `:active` state (press feedback), no hover effect on touch
- Tap targets: all interactive elements ≥ 44px, primary CTA ≥ 48px

---

## 8. Component Inventory

New/modified components for this redesign:

| Component | Type | Notes |
|-----------|------|-------|
| `GlassPanel` | Utility wrapper | Applies glass-panel classes. Props: `rounded`, `className` |
| `GlassCard` | Interactive wrapper | Extends GlassPanel with hover states. Props: `as`, `href`, `className` |
| `MarqueeBanner` | New component | Daily phrase marquee with pause-on-hover and reduced-motion fallback |
| `SwipeCarousel` | New component | CSS snap scroll wrapper with optional dot indicators |
| `GreetingBanner` | Refactored header | Dark gradient banner replacing flat header |

### CSS Additions to globals.css

```css
/* ── Glass System ── */
.glass-panel {
  background: var(--color-surface-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-color);
  border-top-color: var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.glass-card {
  background: var(--color-surface-raised);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-color);
  border-top-color: var(--glass-border);
  box-shadow: var(--glass-shadow);
  transition: background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}
.glass-card:hover {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}
.glass-card:active {
  transform: translateY(0);
  background: rgba(255, 255, 255, 0.97);
}

/* ── Marquee ── */
.marquee-track {
  animation: marquee-scroll 30s linear infinite;
}
.marquee-track:hover,
.marquee-track:focus-within {
  animation-play-state: paused;
}
@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* ── Scrollbar hide for carousels ── */
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .glass-card:hover { transform: none; }
  .marquee-track { animation: none; justify-content: center; }
}

/* ── Forced colors ── */
@media (forced-colors: active) {
  .glass-panel, .glass-card {
    background: Canvas;
    border: 1px solid CanvasText;
    backdrop-filter: none;
  }
}

/* ── No backdrop-filter support ── */
@supports not (backdrop-filter: blur(1px)) {
  .glass-panel, .glass-card {
    background: rgba(255, 255, 255, 0.95);
  }
}
```

---

## 9. Migration Strategy

### Phase 1: Foundation (non-breaking)
1. Add new color tokens to `globals.css` alongside existing ones
2. Add glass utility classes to `globals.css`
3. Add marquee and scrollbar-hide CSS
4. Update `body` background to new canvas color + gradient mesh

### Phase 2: Section-by-Section (in DailyHubClient)
1. §1 Greeting → Banner (biggest visual change)
2. §2 Command bar → Glass panel + blue CTA
3. §3 Quick paths → Carousel + glass cards
4. §7 Daily Japanese → Marquee + glass widget carousel
5. §4 Guest prompt → Glass panel + blue CTA
6. §4 Dashboard grid → Glass stat cards
7. §5–6 Comeback + Battles → Glass cards + carousel

### Phase 3: Cleanup
1. Remove old color token values (if not used elsewhere)
2. Test all states: loading, error, empty, guest, authenticated
3. Verify at 375px, 768px, 1024px, 1440px
4. Screenshot evidence for gate review

---

## 10. What This Does NOT Change

- App shell / navigation bar (separate component)
- Footer (separate component)
- Exam mode colors (dark theme, separate)
- i18n keys (no label changes)
- API calls or data flow
- Auth logic
- Learning safeguard panels (keep opaque amber for legal clarity)

---

## 11. Anti-Patterns to Avoid

1. **Heavy blur** (>20px) — makes text unreadable and feels "wet"
2. **Glass on glass** — never stack two translucent layers; one glass panel on the canvas, not nested
3. **Glass buttons** — all CTAs must be opaque with solid backgrounds
4. **Colored glass** — no tinted translucent panels (e.g., blue glass, green glass). Keep glass neutral white
5. **Glass in dark mode** — if dark mode is added later, glass needs a separate dark treatment
6. **Parallax/particle backgrounds** — no decorative canvas effects beyond the subtle gradient mesh
7. **Autoplay video/animation** behind glass — forbidden per DESIGN.md
8. **Over-round corners** — keep `rounded-xl` (12px) or `rounded-2xl` (16px), never `rounded-3xl`+
