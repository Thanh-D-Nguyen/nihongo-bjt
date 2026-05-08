# Screen — Kanji Detail (Production Spec)

## Goal
Make individual kanji deeply understandable. Beautiful display + learning utility.

## Layout — Desktop

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to results | 漢字: 経                                    │
├────────────────────────────────┬────────────────────────────────┤
│ KANJI DISPLAY (left, 400px)   │ DETAIL PANEL (right, flex-1)   │
│                                │                                │
│ ┌────────────────────────────┐ │ ━━ Readings ━━                 │
│ │                            │ │ 音読み: ケイ、キョウ            │
│ │         経                 │ │ 訓読み: へ(る)、た(つ)          │
│ │                            │ │                                │
│ │  (large display, 120px)    │ │ ━━ Meanings ━━                 │
│ │                            │ │ 🇬🇧 pass through, manage        │
│ └────────────────────────────┘ │ 🇻🇳 trải qua, kinh (kinh tế)   │
│                                │                                │
│ ┌─ Stroke Order ────────────┐  │ ━━ Info ━━                     │
│ │ [▶ Animate] [Step mode]   │  │ JLPT: N2 | Strokes: 11        │
│ │                            │ │ Frequency: #150                │
│ │  ① → ② → ③ → ...         │ │ Grade: 中学                    │
│ │                            │ │                                │
│ │ [Speed: ▼] [Repeat]       │  │ ━━ Compounds (熟語) ━━         │
│ └────────────────────────────┘ │ • 経済 (けいざい) - economy    │
│                                │ • 経験 (けいけん) - experience  │
│ ┌─ Practice Pad ────────────┐  │ • 経営 (けいえい) - management │
│ │ [Draw here to practice]   │  │ • 経由 (けいゆ) - via          │
│ │                            │ │ [Show all 12 →]               │
│ │  (optional canvas)         │ │                                │
│ └────────────────────────────┘ │ ━━ Examples ━━                  │
│                                │ 1. 経済が回復する              │
│ [⭐ Save] [+ Flashcard]       │    Kinh tế hồi phục            │
│                                │ 2. 良い経験になった            │
│                                │    Đã trở thành kinh nghiệm tốt│
│                                │                                │
│                                │ ━━ Related Kanji ━━             │
│                                │ [済] [営] [験] [由]            │
└────────────────────────────────┴────────────────────────────────┘
```

## Layout — Mobile

```
┌─────────────────────────┐
│ ← | 漢字 経             │
├─────────────────────────┤
│                         │
│        経               │  ← 80px display
│                         │
│  ケイ・キョウ           │  ← Readings inline
│  へ(る)・た(つ)          │
│                         │
│  [▶ Strokes] [✏️ Draw]  │  ← Action buttons
│  [🔊 Audio] [⭐ Save]  │
│                         │
├─────────────────────────┤
│ ━━ Meanings             │
│ 🇻🇳 trải qua, kinh      │
│ 🇬🇧 pass through        │
├─────────────────────────┤
│ ━━ Compounds            │
│ [経済] [経験] [経営]    │  ← Tap to navigate
├─────────────────────────┤
│ ━━ Examples             │
│ ...                     │
├─────────────────────────┤
│ [+ Add to Flashcard]    │  ← Sticky bottom
└─────────────────────────┘
```

## Visual Specifications

### Kanji Display
- Character size: 120px (desktop), 80px (mobile)
- Font: `--font-japanese`, weight 300 (elegant thin stroke for display)
- Color: `--color-text-primary`
- Background: `--color-bg-sunken` with subtle border
- Container: Square, `--radius-xl`, centered
- Padding: 32px

### Stroke Order Viewer
- Background: White (always, even in dark mode for visibility)
- Border: `1px solid --color-border-default`
- Radius: `--radius-lg`
- Stroke color: `--color-brand-navy` (drawn) → `--color-border-default` (remaining)
- Current stroke: Animated with red tip marker
- Animation speed: Slow (2s per stroke), Normal (1s), Fast (0.5s)
- Controls: Play/pause, step forward/back, speed selector, repeat
- Fallback (no SVG data): Static image of completed kanji + "Stroke data unavailable"

### Practice Pad (Optional Canvas)
- Background: White with subtle grid lines (like Japanese writing paper 原稿用紙)
- Grid: 4×4 guide lines, `--color-border-default` at 20% opacity
- Stroke input: Black, 3px width, smooth bezier interpolation
- Clear button: Top-right corner
- Size: Square, matches kanji display width
- Touch support: Full pressure/tilt sensitivity where available

### Readings Section
- On'yomi (音読み): katakana, `text-body`, `--color-text-primary`, badge bg `--color-bg-sunken`
- Kun'yomi (訓読み): hiragana with okurigana in brackets, same styling
- Active reading (used in selected compound): `--color-brand-blue` highlight

### Compounds (熟語)
- List style: Each compound is a clickable chip/card
- Chip: `--radius-md`, `--color-bg-surface`, border `--color-border-default`
- Hover: `--color-bg-surface-hover`
- Content: Compound + reading + brief meaning
- Max visible: 5 + "Show all X" expand
- Highlighted kanji within compound: `--color-brand-blue` underline

### Related Kanji
- Display as square chips: 48px, `--radius-md`, clickable
- Background: `--color-bg-sunken`
- Hover: `--color-brand-sky`
- Show meaning on hover (tooltip)

## Animations

| Event | Visual | Duration |
|-------|--------|----------|
| Stroke animate | Progressive stroke reveal | 1-2s per stroke |
| Stroke step | Highlight next stroke, dim previous | 300ms |
| Compound tap | Scale(1.02) + navigate | 150ms |
| Save bookmark | Star fill animation (outline → filled, gold) | 300ms |
| Practice stroke | Ink trail follows touch/mouse | Realtime |

## States

| State | Visual |
|-------|--------|
| Loading | Skeleton: large square + text blocks |
| Full data | Complete kanji detail view |
| No stroke data | Static character + "Stroke data unavailable" message |
| No compounds | "No compound data" + "Search for words with 経" CTA |
| Offline | Cached data available, practice pad works offline |

## Accessibility
- Kanji character: `aria-label` with all readings and meaning
- Stroke viewer: `role="img"` with description
- Practice pad: Optional — not required for learning
- All compounds navigable by keyboard
- High contrast: Thicker strokes (4px) in high-contrast mode

## Rules
1. Kanji must be beautiful — large, elegant, high-quality rendering.
2. Stroke order animation must have manual step mode (not only auto-play).
3. Practice pad is enhancement — never required, never blocking.
4. Compounds are the primary learning value — always prominently shown.
5. Related kanji enables exploration — each links to its own detail page.
6. "Add to flashcard" creates card with readings, meanings, and one example sentence.
