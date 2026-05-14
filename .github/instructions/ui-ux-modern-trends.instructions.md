---
applyTo: "apps/web/**,apps/admin/**,packages/ui/**"
---

# UI/UX Modern Design Trends — NihonGo BJT (2025–2026)

This file is the **mandatory design checklist** for every screen, component, or layout change. Before implementing ANY UI work, read this file and apply the relevant patterns.

## Mission

NihonGo BJT must look and feel like a **2025–2026 world-class learning product** — not a generic LMS, not a clone of Duolingo, and not a dated Bootstrap dashboard. Every screen should make users think: "This is better than anything else I've used for Japanese study."

---

## 1. Core Design Philosophy

### 1.1 "Quiet Confidence" — Not Bland, Not Loud
- Calm ≠ boring. Every screen needs ONE clear focal point and ONE decisive CTA.
- White space is intentional — it guides the eye, it doesn't fill emptiness.
- Restraint with personality: subtle signature elements (sakura accent on achievements, navy depth on focus surfaces) make NihonGo BJT recognizable.

### 1.2 Mobile-First, Thumb-Friendly
- Design for 375px first, enhance for tablet (768px) and desktop (1280px+).
- Bottom navigation or floating action for primary learning actions on mobile.
- Touch targets ≥ 48px (not 44px — 48px is the 2025 standard per Material 3 and Apple HIG updates).
- Swipe gestures for flashcards, quiz navigation, and daily content browsing.

### 1.3 Content-First, Chrome-Last
- Minimize UI chrome (toolbars, borders, containers). Let content breathe.
- Cards should have purpose, not just be containers. If a card just wraps text, remove the card.
- Progressive disclosure: show what matters now, reveal details on demand.

---

## 2. 2025–2026 Trend Patterns to Apply

### 2.1 Bento Grid Layouts
- Use asymmetric grid layouts for dashboards and hub pages (homepage, daily study, analytics).
- Mix card sizes: one hero card + supporting smaller cards. NOT uniform card grids.
- Each bento cell has a single purpose: stat, action, content preview, or progress.
- Example: Homepage = hero "Continue studying" card (2×1) + streak (1×1) + daily phrase (1×1) + quick actions (1×2).

### 2.2 Glassmorphism (Subtle, Not Gimmicky)
- Use frosted glass ONLY for overlay surfaces: modals, sheet panels, floating toolbars, reading assist popover.
- `backdrop-filter: blur(16px); background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.2);`
- Never apply glassmorphism to primary content cards — it hurts readability.
- Glassmorphism must degrade gracefully on unsupported browsers (solid fallback).

### 2.3 Micro-Interactions & Motion
- Every user action should have a micro-response: button press scale, card tap ripple, progress bar fill animation.
- Use CSS `transition` and `@keyframes` — not heavy JS animation libraries.
- Motion timing: `150ms ease-out` for interactions, `300ms ease-in-out` for layout transitions.
- Celebrate learning moments: correct answer → subtle confetti or check animation. Streak milestone → brief glow.
- **Motion budget**: max 3 simultaneous animations on screen. No animation storms.
- Respect `prefers-reduced-motion`: disable decorative motion, keep functional transitions.

### 2.4 Depth & Layering (Elevated UI)
- Use shadow hierarchy to communicate depth: cards float slightly, modals float more, tooltips float most.
- Active/selected states use elevation change + subtle color shift, not just border change.
- Sticky headers should have a shadow that appears on scroll (not always visible).

### 2.5 Dynamic Color Contexts
- Screens can have contextual color moods without breaking brand consistency:
  - Study mode → calm navy/white palette (existing)
  - Battle mode → energetic with player/opponent color accents
  - Achievement unlock → warm sakura/gold accents
  - Error/retry → gentle warning palette, never aggressive red
- Color transitions between contexts should be smooth (CSS custom properties + `transition`).

### 2.6 Typography as UI
- Use font weight and size as primary hierarchy tool, not color alone.
- Japanese headwords: `font-size: 1.5rem+`, `font-weight: 700`, generous `line-height: 1.8`.
- Vietnamese/English explanations: smaller, lighter, receding but readable.
- Numbers and stats: use tabular figures (`font-variant-numeric: tabular-nums`).
- Progress percentages, scores, timers: oversized display font for instant readability.

### 2.7 Skeleton Loading & Optimistic UI
- Every data-dependent section must show a skeleton loader that matches the final layout shape.
- Use shimmer animation on skeletons (subtle gradient sweep, not pulsing opacity).
- For user actions (flashcard flip, answer submit): update UI immediately, reconcile with server async.

### 2.8 Empty States as Onboarding
- Empty states are not error messages. They are invitations.
- Each empty state: illustration/icon + encouraging message + single CTA to get started.
- Example: No flashcards → "Start building your deck! Add words from any lesson." + [Browse Lessons] button.

### 2.9 Contextual Navigation
- Bottom tab bar on mobile for primary sections (Home, Study, Dictionary, Progress, Profile).
- Breadcrumbs on desktop for deep navigation.
- Floating action button (FAB) for the #1 action on each screen (start quiz, add flashcard, begin review).
- Navigation should communicate "where am I" and "what can I do next" at all times.

### 2.10 AI-Assisted UI Patterns (2026 Trend)
- AI suggestions surface as inline chips or cards, not modal interruptions.
- "Suggested next action" based on learning state appears as a gentle card, dismissible.
- AI-generated content (explanations, example sentences) marked with subtle indicator.
- Never block the user's chosen path with AI suggestions.

---

## 3. NihonGo BJT Differentiators (What Makes Us Better)

### 3.1 Japanese Text Excellence
- Kanji always has furigana option (toggle-able, not forced).
- Generous line-height for Japanese text: `1.8` minimum in reading contexts.
- Word-level tap/hover reveals meaning without leaving the page.
- Reading assist is a product layer, not a tooltip hack.

### 3.2 Dual-Language Hierarchy
- Japanese is always visually primary (larger, bolder, higher).
- Vietnamese explanations are always present but visually secondary.
- Never stack languages at equal visual weight — it creates confusion.
- Language toggle should be accessible but not dominate the UI.

### 3.3 Calm Focus Mode
- Study/exam screens strip away navigation, notifications, ads.
- Timer is visible but not anxiety-inducing (use progress bar, not countdown clock, for practice).
- "Exit study" requires confirmation to prevent accidental loss.
- After completing a study session: clear summary → next suggested action → rest option.

### 3.4 Progress That Feels Real
- Progress bars show actual learning data, not inflated numbers.
- Streaks and badges earned through real study actions, not logins.
- BJT score estimation clearly labeled as "estimated" with confidence range.
- Spaced repetition state visible: "12 cards due today" is more actionable than "your retention is 87%".

### 3.5 Battle Mode With Personality
- Player vs opponent layout is clear and sports-like.
- Timer creates urgency without panic (color shift in last 5 seconds, not aggressive flashing).
- Results screen: celebratory for wins, encouraging for losses, never shaming.
- Shareable result postcards with attractive, branded layouts.

### 3.6 Editorial Content Feel
- News reader, grammar explanations, and lesson content should feel like reading a well-designed magazine.
- Use pull quotes, highlighted vocabulary, inline illustrations.
- Content sections have clear start/end with breathing room between them.

---

## 4. Anti-Patterns (Never Do These)

| Anti-Pattern | Why It's Bad | Do This Instead |
|---|---|---|
| Uniform card grid wall | No hierarchy, no focal point | Bento grid with size variation |
| Pure white background everywhere | Flat, clinical, tiring | Off-white canvas (#F8FAFC) + surface cards |
| Tiny ghost buttons as primary CTA | Low contrast, invisible on mobile | Solid navy/blue button, 48px+ height |
| Modal for everything | Interrupts flow, annoying | Sheet panel or inline expansion |
| Red text for all errors | Aggressive, anxiety-inducing | Warm semantic colors with gentle messaging |
| Decorative animations with no purpose | Distracting, wastes battery | Functional micro-interactions only |
| Info-dumping all stats at once | Cognitive overload | Progressive disclosure, summary → detail |
| Generic "No data" empty state | Feels broken | Encouraging empty state with onboarding CTA |
| Autoplaying audio/video | Disruptive, accessibility issue | User-initiated media with clear play button |
| Pagination for <20 items | Unnecessary friction | Show all or virtual scroll |
| Toast notifications for every action | Notification fatigue | Toast only for async results, inline feedback for sync |

---

## 5. Component Standards (2025–2026)

### Buttons
- Primary CTA: `bg-[#1B2A4A] text-white rounded-xl px-6 py-3 font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150`
- Secondary: `border-2 border-[#1B2A4A] text-[#1B2A4A] bg-transparent hover:bg-[#1B2A4A]/5`
- Min height: 48px on mobile, 44px on desktop.
- Button labels: verb-first ("Start Quiz", "Add to Deck", "Continue Studying").
- Icon + text preferred over icon-only (except in compact toolbar contexts).

### Cards
- Default: `bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-5`
- Interactive: add `hover:shadow-md hover:border-[#CBD5E1] cursor-pointer transition-all duration-200`
- Active/selected: `ring-2 ring-[#3B82F6] shadow-md`
- No nested card borders — if a card contains sub-sections, use spacing/dividers, not inner cards.

### Inputs
- Height: 48px
- Border: `border-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20`
- Label always visible (no placeholder-only inputs for important fields).
- Error state: red border + inline error message below, not toast.

### Progress Indicators
- Bar: rounded, animated fill, color reflects context (blue=active, green=complete, amber=due).
- Circular: for single stat display (e.g., daily progress ring).
- Steps: for multi-step flows (onboarding, quiz setup).

### Bottom Sheet (Mobile)
- Use for secondary actions, filters, options.
- Drag-to-dismiss with handle indicator.
- Max 60% viewport height default, expandable to 90%.
- Backdrop: semi-transparent with blur.

---

## 6. Mandatory Checklist Before Shipping Any Screen

- [ ] Primary action is immediately obvious within 2 seconds
- [ ] Mobile layout (375px) tested — nothing overflows, all CTAs are thumb-reachable
- [ ] Japanese text has comfortable line-height (≥1.8) and optional furigana
- [ ] Loading skeleton matches final layout shape
- [ ] Empty state has illustration + message + CTA
- [ ] Error state is gentle, not alarming
- [ ] No more than 3 competing CTAs visible at once
- [ ] Color contrast passes WCAG AA (4.5:1 for text, 3:1 for UI elements)
- [ ] Animations respect `prefers-reduced-motion`
- [ ] i18n keys used for all user-facing text
- [ ] Screen answers: "What am I doing? What's next? Where's my progress?"
- [ ] No generic card-grid wall — hierarchy exists through size/position/weight
- [ ] Touch targets ≥ 48px on mobile
- [ ] Feels like NihonGo BJT, not generic SaaS

---

## 7. Competitive Benchmark (What We Beat and How)

| Competitor | Their Weakness | Our Advantage |
|---|---|---|
| Duolingo | Gamification over substance, childish for adults | Professional BJT focus + real exam prep + adult-appropriate design |
| Bunpo | Dry grammar-only, no engagement | Rich daily content + battle mode + career RPG + news reader |
| WaniKani | Kanji-only, no business Japanese | Full BJT coverage: listening, reading, grammar, vocabulary, business context |
| Generic LMS (Moodle, etc.) | Ugly, complex, institutional feel | Modern consumer-grade UI, mobile-first, joyful daily study |
| Anki | Powerful but ugly, steep learning curve | Beautiful SRS with same spaced-repetition science, zero setup friction |

---

## 8. Reference Inspirations (Synthesize, Don't Copy)

- **Linear**: Precision navigation, clean hierarchy, keyboard shortcuts
- **Notion**: Reading comfort, content-first, flexible layouts
- **Apple Education**: Typography restraint, confident use of white space
- **Nikkei/MUJI**: Japanese editorial elegance, respectful information density
- **Headspace/Calm**: Study mode atmosphere — focused, serene, no distractions
- **Stripe Docs**: Information architecture clarity, progressive disclosure
- **Arc Browser**: Bold use of color contexts, spatial navigation
- **SmartHR**: Japanese SaaS admin clarity (for admin surfaces)
