# DESIGN.md — NihonGo BJT

> AI agents read this file to generate consistent, distinctive UI for NihonGo BJT.
> Format follows the [awesome-design-md-jp](https://github.com/kzhrknt/awesome-design-md-jp) 9-section standard, extended for bilingual (Japanese + Vietnamese) learning product needs.
> Section headers in English for AI readability. Values and guidelines in English with Japanese typography specifics.

---

## 1. Visual Theme & Atmosphere

- **Design direction**: Quiet Mastery for Business Japanese — a calm exam cockpit crossed with a high-trust learning coach
- **Density**: Study surfaces are spacious with generous Japanese line-height; admin/reference surfaces are moderately dense for scan speed
- **Keywords**: Calm, Premium, Precise, Supportive, Japanese-editorial

**Product North Star**: NihonGo BJT is a serious BJT learning product for Vietnamese adults preparing for work, exams, and life in Japan. The interface must feel clear, protective during focus, coaching after mistakes, and backed by real data.

**Identity differentiators** (what makes NihonGo BJT visually distinct):
- Deep navy (`#1B2A4A`) as the authoritative anchor — not the typical blue SaaS accent
- Off-white canvas (`#F8FAFC`) for eye comfort during long study sessions
- Sakura pink (`#F9A8D4`) and gold (`#F59E0B`) used sparingly for achievement moments — not as brand color
- Japanese editorial restraint: generous whitespace around kanji, no decorative noise
- Bilingual hierarchy: Japanese headwords are visually dominant, Vietnamese explanations recede gracefully

**"Quiet" must not become bland.** A calm screen must have:
- Strong visual hierarchy with a clear focal point
- Decisive, high-contrast buttons
- A memorable NihonGo BJT identity distinct from generic LMS products

**Inspiration synthesis** (do not copy any brand directly):
- Linear-like precision for workflow clarity
- Notion-like reading comfort for study surfaces
- Apple-like typographic restraint
- Nikkei/MUJI editorial elegance for Japanese text presentation
- SmartHR-like operational clarity for admin surfaces

---

## 2. Color Palette & Roles

### Primary (Brand)

- **Navy** (`#1B2A4A`): Primary CTA, headers, authoritative actions. Deep and distinctive
- **Navy Hover** (`#243560`): Hover state for navy buttons/elements
- **Navy Pressed** (`#141F38`): Active/pressed state

### Interactive (Accent)

- **Blue** (`#3B82F6`): Interactive accent, links, secondary CTA, focus rings
- **Blue Hover** (`#2563EB`): Hover for blue elements
- **Blue Light** (`#DBEAFE`): Tag backgrounds, selected rows, active breadcrumbs
- **Sky** (`#EFF6FF`): Soft highlight backgrounds, active nav items

### Semantic

- **Success / Correct** (`#059669`): Correct answers, progress, completion
- **Success BG** (`#ECFDF5`): Toast/banner background for success
- **Warning** (`#D97706`): Attention, caution, SRS learning state
- **Warning BG** (`#FFFBEB`): Warning background
- **Danger / Incorrect** (`#DC2626`): Errors, wrong answers, destructive actions
- **Danger BG** (`#FEF2F2`): Error background

### Reward (Sparse use only)

- **Sakura** (`#F9A8D4`): Achievement glow, streak celebration, badges
- **Gold** (`#F59E0B`): Premium badge, star, milestone — never as primary CTA

### Neutral

- **Ink** (`#111827`): Primary body text — warm black, not pure `#000`
- **Secondary** (`#4B5563`): Descriptions, metadata labels
- **Tertiary** (`#9CA3AF`): Placeholder text, disabled labels
- **Canvas** (`#F8FAFC`): Page background — off-white for long study sessions
- **Surface** (`#FFFFFF`): Cards, panels, modals
- **Surface Hover** (`#F1F5F9`): Card/row hover
- **Border** (`#E2E8F0`): Default borders, dividers
- **Border Hover** (`#CBD5E1`): Input hover state

### Learning-Specific

- **SRS New** (`#8B5CF6`): New flashcard
- **SRS Learning** (`#F59E0B`): Currently learning
- **SRS Review** (`#3B82F6`): Review due
- **SRS Mastered** (`#059669`): Mastered

### Battle Mode

- **Player** (`#3B82F6`): Player team
- **Opponent** (`#EF4444`): Opponent team
- **Timer** (`#F59E0B`): Countdown
- **Timer Urgent** (`#DC2626`): Last 5 seconds

### Admin

- **Sidebar BG** (`#1E293B`): Admin sidebar
- **Sidebar Text** (`#E2E8F0`): Admin sidebar text
- **Sidebar Active** (`#3B82F6`): Active nav item

**Color rules**:
- Do not let one hue dominate the whole app
- Status colors must carry meaning (never decorative)
- Do not use pure `#000000` for text — use Ink (`#111827`)
- Sakura/Gold are reward accents only — never for navigation, borders, or body elements

---

## 3. Typography Rules

### 3.1 和文フォント (Japanese font)

- **ゴシック体**: Noto Sans JP — clean, modern, excellent kanji readability at all sizes
- Weight range: 400 (body), 500 (emphasis), 600 (sub-headings), 700 (headwords, headings)

### 3.2 欧文フォント (Latin font)

- **Sans-serif**: Inter — clean, professional, excellent Vietnamese diacritics support
- **Monospace**: JetBrains Mono, Fira Code, Consolas — for code examples, technical content

### 3.3 font-family 指定

```css
/* Primary — UI text (Vietnamese body, mixed content) */
font-family: 'Inter', 'Noto Sans JP', ui-sans-serif, system-ui,
  -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

/* Japanese display — headwords, kanji passages, example sentences */
font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;

/* Monospace — code, technical */
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

**Fallback strategy**:
- Inter first for Latin/Vietnamese readability, Noto Sans JP for Japanese glyphs
- For Japanese-dominant content (headwords, passages), Noto Sans JP first
- Always end with generic `sans-serif`

### 3.4 文字サイズ・ウェイト階層

| Role | Font | Desktop | Mobile | Weight | Line Height | Letter Spacing | Use |
|------|------|---------|--------|--------|-------------|----------------|-----|
| Display | Inter | 36px | 28px | 700 | 1.2 | 0 | Landing hero only |
| H1 | Inter/Noto | 30px | 24px | 700 | 1.3 | 0 | Page titles |
| H2 | Inter/Noto | 24px | 20px | 600 | 1.35 | 0 | Section headings |
| H3 | Inter/Noto | 20px | 18px | 600 | 1.4 | 0 | Card titles, panel headers |
| H4 | Inter/Noto | 16px | 16px | 600 | 1.4 | 0 | Sub-sections |
| Body | Inter/Noto | 15px | 14px | 400 | 1.6 | 0 | Body text, descriptions |
| Body Small | Inter/Noto | 13px | 13px | 400 | 1.5 | 0 | Dense lists, table cells |
| Caption | Inter/Noto | 12px | 11px | 400 | 1.4 | 0 | Metadata, timestamps |
| Overline | Inter | 11px | 11px | 600 | 1.2 | 0.05em | Labels, category tags |
| JP Headword | Noto Sans JP | 28px | 24px | 700 | 1.4 | 0.02em | Dictionary headword |
| JP Example | Noto Sans JP | 16px | 15px | 400 | 1.8 | 0.01em | Example sentences |
| JP Furigana | Noto Sans JP | 0.5em | 0.5em | 400 | 1.2 | 0 | Ruby text above kanji |
| Flashcard Front | Noto Sans JP | 32px | 28px | 700 | 1.5 | 0 | Flashcard main text |

**Tabular numerics**: Use `font-variant-numeric: tabular-nums` for timers, scores, quotas, streak counts, and analytics displays.

### 3.5 行間・字間

- **Japanese body line-height**: `1.6`–`1.8` (generous for kanji + furigana readability)
- **Japanese example sentences**: `1.8` (extra breathing room for mixed kanji/furigana)
- **Vietnamese/Latin body**: `1.6`
- **Headings**: `1.2`–`1.4`
- **Japanese letter-spacing (body)**: `0.01em`–`0.02em`
- **Vietnamese letter-spacing**: `0` (default)
- **Heading letter-spacing**: `0` (no negative letter-spacing)

**Guidelines**:
- Japanese body text must never go below `line-height: 1.5`
- Japanese passages with furigana need `1.8` for the ruby annotation space
- Minimum Japanese text size: `14px` on any screen

### 3.6 禁則処理・改行ルール

```css
/* Japanese text areas */
word-break: keep-all;          /* Do not break in the middle of Japanese words */
overflow-wrap: break-word;     /* Handle long URLs and romaji */
line-break: strict;            /* Strict kinsoku shori */
```

**Kinsoku rules**:
- Line-start forbidden: `）」』】〕〉》」】、。，．・：；？！`
- Line-end forbidden: `（「『【〔〈《「【`

### 3.7 OpenType 機能

```css
/* Headings and navigation — proportional Japanese spacing */
font-feature-settings: "palt" 1;

/* Body text — keep default spacing for readability */
font-feature-settings: "kern" 1;
```

- Apply `palt` to headings and nav labels only, not body text
- Apply `kern` for mixed Japanese/Latin text

### 3.8 縦書き (Vertical writing)

- Not applicable. NihonGo BJT uses horizontal writing (横書き) only.

---

## 4. Component Stylings

### Buttons

**Primary (Navy)**
- Background: `#1B2A4A`
- Text: `#FFFFFF`
- Border Radius: 10px
- Font Size: 15px
- Font Weight: 600
- Padding: 12px 24px
- Min Height: 44px (48px for dominant mobile actions)
- Hover: `#243560`
- Active: `#141F38`
- Focus: 3px solid `#3B82F6` outline, 2px offset

**Secondary (Blue outline)**
- Background: `transparent`
- Text: `#3B82F6`
- Border: 1.5px solid `#3B82F6`
- Border Radius: 10px
- Hover BG: `#EFF6FF`

**Danger**
- Background: `#DC2626`
- Text: `#FFFFFF`
- Border Radius: 10px
- Hover: `#B91C1C`

**Button rules**:
- Every button must have: default, hover, focus-visible, active, loading, disabled states
- Minimum tap target: 44px × 44px
- Primary CTA text must be readable at 75% screenshot scale
- One primary CTA per viewport — no competing actions
- Clear visual distinction between: study action, auth action, social action, exam action, destructive action

### Inputs

- Background: `#FFFFFF`
- Border: 1px solid `#E2E8F0`
- Border (hover): 1px solid `#CBD5E1`
- Border (focus): 2px solid `#3B82F6`
- Border Radius: 10px
- Padding: 10px 14px
- Font Size: 15px
- Min Height: 44px

### Cards

- Background: `#FFFFFF`
- Border: 1px solid `#E2E8F0`
- Border Radius: 14px (lg) or 20px (xl for feature cards)
- Padding: 16px–24px
- Shadow: `0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)`
- Hover shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -1px rgba(15, 23, 42, 0.04)`

### Badges / Pills

- Border Radius: 9999px (full)
- Padding: 4px 10px
- Font Size: 12px
- Font Weight: 500

---

## 5. Layout Principles

### Spacing Scale (4px base)

| Token | Value |
|-------|-------|
| XS | 4px |
| S | 8px |
| M | 16px |
| L | 24px |
| XL | 32px |
| XXL | 48px |

### Container

- Learner app: max-width `1280px`, centered, padding `16px` (mobile) to `32px` (desktop)
- Admin app: full-width with sidebar, main content max-width `1440px`

### Learner Layout

- Compact top context strip (navigation, search, user)
- Primary work area first
- Supporting panels second
- Remediation/progress panels only when they help the current task
- Mobile: single-column flow with sticky core actions
- Footer/trust surface: help, privacy, terms, support, locale

### Screen contract — every learner screen must answer:

1. What am I doing now?
2. What is the next best action?
3. What evidence shows my progress?
4. Where do I go when I am stuck?

### Layout anti-patterns

- No generic card walls or nested cards
- No marketing hero sections inside logged-in app
- No multiple competing CTAs
- No wide desktop canvases with small cards floating in empty space
- No app screens without footer/trust surface

---

## 6. Depth & Elevation

| Level | Token | Shadow | Use |
|-------|-------|--------|-----|
| 0 | — | none | Flat elements, inline content |
| 1 | `shadow-xs` | `0 1px 2px rgba(15,23,42,0.04)` | Subtle lift |
| 2 | `shadow-sm` | `0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)` | Cards, dropdowns |
| 3 | `shadow-md` | `0 4px 6px -1px rgba(15,23,42,0.07), 0 2px 4px -1px rgba(15,23,42,0.04)` | Hover cards, popovers |
| 4 | `shadow-lg` | `0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -2px rgba(15,23,42,0.03)` | Modals, floating panels |
| 5 | `shadow-xl` | `0 20px 25px -5px rgba(15,23,42,0.10), 0 10px 10px -5px rgba(15,23,42,0.04)` | Dialogs, command palettes |

### Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `radius-sm` | 6px | Small badges, tags |
| `radius-md` | 10px | Buttons, inputs — modern but not childish |
| `radius-lg` | 14px | Cards — friendly containers |
| `radius-xl` | 20px | Feature cards, hero panels |
| `radius-full` | 9999px | Pills, badges, avatars |

**No sharp corners** — every element has at least 6px radius.

---

## 7. Do's and Don'ts

### Do (推奨)

- Use the font fallback chain: Inter → Noto Sans JP → system fallbacks → sans-serif
- Keep Japanese body `line-height` at `1.6` or higher (1.8 for passages with furigana)
- Use Navy (`#1B2A4A`) for primary CTAs — it is the brand's visual anchor
- Use Blue (`#3B82F6`) for interactive elements, links, and focus rings
- Keep Sakura/Gold for genuine achievement moments only
- Use `font-variant-numeric: tabular-nums` for timers, scores, and counters
- Maintain WCAG AA contrast for all interactive text
- Design mobile-first at 375px, then enhance for desktop
- Show loading skeletons during data fetch, not blank screens
- Show actionable error messages, not generic "Something went wrong"
- Use i18n keys for all user-facing text (Vietnamese + Japanese)
- Apply `palt` OpenType feature to Japanese headings for proportional spacing

### Don't (禁止)

- Do not use pure `#000000` for text — use Ink (`#111827`)
- Do not use `line-height` below `1.5` for Japanese body text
- Do not use negative letter-spacing anywhere
- Do not let one hue dominate the whole app
- Do not use Sakura/Gold as primary action colors
- Do not add autoplay media, looping animations, or distracting particles
- Do not use heavy glassmorphism or neon/cyberpunk aesthetics
- Do not create generic card-grid walls — each screen needs a clear focal point
- Do not add sound without user opt-in and mute controls
- Do not show fake data, fake progress, fake analytics, or fake badges
- Do not use shame-based copy for mistakes — coach instead
- Do not reveal meanings during active timed BJT exam mode
- Do not expose private learning data in share URLs or OG metadata
- Do not confetti for weak performance
- Do not present estimated BJT scores as official results

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile | < 640px (`sm`) | Single column, bottom nav, sheets |
| Tablet | 640–1023px (`md`) | Condensed two-column where possible |
| Desktop | 1024–1279px (`lg`) | Full two-column, sidebar |
| Wide | ≥ 1280px (`xl`) | Wide panels, spacious cards |

### Touch Targets

- Minimum: 44px × 44px (WCAG)
- Dominant mobile CTA: 48px height preferred

### Font Size Adjustment

- Mobile body: 14px minimum
- Mobile headings: ~70–80% of desktop size
- Japanese minimum: 14px on any screen, any viewport

### Screen Density Spectrum

```
← Spacious                                    Dense →
  Flashcard   Dictionary   Admin   Battle(mobile)
  MockTest    SearchResult  Table   ChatList
```

- **Learning screens**: More whitespace, focus on one element
- **Reference screens**: Balanced density for scan speed
- **Admin screens**: Compact but not cramped

---

## 9. Agent Prompt Guide

### Quick Reference

```
Primary CTA: #1B2A4A (navy) on white → text #FFFFFF
Secondary CTA: #3B82F6 (blue) outline
Interactive Accent: #3B82F6
Text Primary: #111827
Text Secondary: #4B5563
Background: #F8FAFC
Surface: #FFFFFF
Border: #E2E8F0
Success: #059669
Warning: #D97706
Danger: #DC2626
Font: 'Inter', 'Noto Sans JP', system-ui, sans-serif
JP Font: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif
Body Size: 15px (desktop), 14px (mobile)
JP Body Line Height: 1.6–1.8
Button Radius: 10px
Card Radius: 14px
Min Tap Target: 44px
```

### Prompt Example

```
NihonGo BJT のデザインシステムに従って、BJT practice quiz 画面を作成してください。
- フォント: 'Inter', 'Noto Sans JP', system-ui, sans-serif
- テキスト色: #111827
- 背景: #F8FAFC
- カード: 白 (#FFFFFF), 角丸 14px, shadow-sm
- プライマリボタン: 背景 #1B2A4A, テキスト #FFFFFF, 角丸 10px, 最小高さ 44px
- 正解色: #059669, 不正解色: #DC2626
- 日本語テキスト: Noto Sans JP, line-height 1.8, 最小 14px
- mobile-first: 375px での single-column レイアウト
```

### Design Token File

Actual CSS custom properties are defined in `apps/web/app/globals.css`.
Full token reference with dark mode: `.ai-design/01-foundations/colors.md`.
Typography specification: `.ai-design/01-foundations/typography.md`.
All component patterns: `.ai-design/02-components/*.md`.
Layout patterns: `.ai-design/03-patterns/*.md`.

### Screen Contract Template

Use `company/learner-ui-screen-contract.md` before major learner UI implementation.

---

## Appendix: Core Learner Surface Guidelines

### Dashboard / Today Focus
- Show one calm daily study path with real data
- Next recommended action, due reviews, weak-skill remediation
- No fake charts, no many equal-weight cards, no anxiety-inducing streak pressure

### BJT Practice
- Clarify practice vs timed exam, level, reading assist availability
- Estimated scores labeled as "estimated"

### Timed Mock Exam
- Quiet timer, stable controls, no meaning reveal, accessible keyboard behavior
- Exam mode: no animation, pure focus

### Result and Coaching
- Estimated score/band, section breakdown, remediation links
- No shame copy, no fake precision, no confetti for weak performance

### Reading Assist
- Furigana/meaning/add-to-flashcard as a reusable layer
- Disabled in timed exam mode, compact interaction

### Battle
- Real BJT questions, bot fairness transparency, respectful results, no pay-to-win

### Social Sharing
- Explicit opt-in, privacy-safe tokens, postcard preview before publishing
