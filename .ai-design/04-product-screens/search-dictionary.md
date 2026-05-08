# Screen — Search / Dictionary (Production Spec)

## Goal
Fastest Japanese dictionary lookup with premium learning integration. Must feel faster and cleaner than Mazii/Jisho.

## Layout — Desktop (≥ 1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│ STICKY SEARCH BAR                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 [Search: kanji, hiragana, romaji, Vietnamese, English]   │ │
│ │     [JP ▼] [All levels ▼] [JLPT ▼] [Type ▼]  [Clear]      │ │
│ └─────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────┬──────────────────────────────┤
│ RESULT LIST (360px width)        │ DETAIL PANEL (flex-1)        │
│                                  │                              │
│ ┌──────────────────────────────┐ │ ┌──────────────────────────┐ │
│ │ 経済 (けいざい)              │ │ │ 経済                      │ │
│ │ Economy · N2 · Noun        │◀│ │ けいざい                  │ │
│ └──────────────────────────────┘ │ │ [🔊 Play] [⭐ Save]      │ │
│ ┌──────────────────────────────┐ │ │                          │ │
│ │ 経済的 (けいざいてき)        │ │ │ ━━ Meanings ━━            │ │
│ │ Economical · N2 · Na-adj   │ │ │ 🇻🇳 Kinh tế               │ │
│ └──────────────────────────────┘ │ │ 🇬🇧 Economy, economics    │ │
│ ┌──────────────────────────────┐ │ │                          │ │
│ │ 経済学 (けいざいがく)        │ │ │ ━━ Details ━━             │ │
│ │ Economics · N1 · Noun      │ │ │ Part of speech: 名詞      │ │
│ └──────────────────────────────┘ │ │ JLPT: N2                 │ │
│                                  │ │ Frequency: ★★★★☆         │ │
│ [Load more...]                   │ │                          │ │
│                                  │ │ ━━ Examples ━━            │ │
│                                  │ │ 1. 日本の経済は回復...    │ │
│                                  │ │    Kinh tế Nhật Bản...    │ │
│                                  │ │                          │ │
│                                  │ │ 2. 経済的な問題が...      │ │
│                                  │ │    Vấn đề kinh tế...     │ │
│                                  │ │                          │ │
│                                  │ │ ━━ Related Words ━━       │ │
│                                  │ │ [経済的] [経済学] [景気]   │ │
│                                  │ │                          │ │
│                                  │ │ ━━ Kanji Breakdown ━━     │ │
│                                  │ │ 経 (manage) + 済 (settle)│ │
│                                  │ │                          │ │
│                                  │ │ [+ Add to Flashcard ▼]   │ │
│                                  │ └──────────────────────────┘ │
└──────────────────────────────────┴──────────────────────────────┘
```

## Layout — Mobile (< 768px)

```
┌─────────────────────────┐
│ 🔍 [Search input]       │  ← Sticky, auto-focus on page load
│ [Filters row - scrollable chips]
├─────────────────────────┤
│                         │
│ ┌─────────────────────┐ │  ← Result cards (full width)
│ │ 経済 (けいざい)     │ │
│ │ Economy · N2 · 名詞  │ │
│ │ 🇻🇳 Kinh tế         │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 経済的 ...          │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 経済学 ...          │ │
│ └─────────────────────┘ │
│                         │
│ [Load more]             │
└─────────────────────────┘

    ↓ Tap result → Bottom sheet / full page detail

┌─────────────────────────┐
│ ← Back | 経済           │
├─────────────────────────┤
│                         │
│   経済                  │
│   けいざい              │
│   [🔊] [⭐] [+ Card]  │
│                         │
│   ━━ Meanings           │
│   🇻🇳 Kinh tế           │
│   🇬🇧 Economy           │
│                         │
│   ━━ Examples           │
│   ...                   │
│                         │
│   ━━ Kanji Breakdown    │
│   ...                   │
│                         │
└─────────────────────────┘
```

## Visual Specifications

### Search Bar
- Height: 52px (desktop), 48px (mobile)
- Background: `--color-bg-surface`
- Border: `2px solid --color-border-default` → `--color-border-focus` on focus
- Radius: `--radius-lg`
- Shadow: `--shadow-sm` (resting), `--shadow-md` (focused)
- Icon: 20px, `--color-text-tertiary`
- Placeholder: `--color-text-tertiary`, italic
- Clear button: appears when input has value, ghost style

### Filter Chips
- Height: 32px
- Radius: `--radius-full`
- Background: `--color-bg-sunken` (inactive), `--color-brand-blue-light` (active)
- Border: `--color-border-default` (inactive), `--color-brand-blue` (active)
- Text: `text-body-sm`, `--color-text-secondary` (inactive), `--color-brand-blue` (active)
- Gap: 8px
- Scrollable horizontally on mobile (no wrap)

### Result List Item
- Padding: 12px 16px
- Border-bottom: `1px solid --color-border-default`
- Selected: `--color-brand-sky` bg + left border `3px solid --color-brand-blue`
- Hover: `--color-bg-surface-hover`
- Headword: `font-japanese`, 18px, weight 600
- Reading: 13px, `--color-text-secondary`
- Meaning preview: 13px, `--color-text-secondary`, truncate 1 line
- Tags: `text-overline`, `--color-text-tertiary`
- Transition: `--duration-instant` for hover/select

### Detail Panel
- Background: `--color-bg-surface`
- Padding: 32px (desktop), 20px (mobile)
- Border-left: `1px solid --color-border-default` (desktop)
- Headword: `font-japanese`, 36px, weight 700
- Reading: 18px, `--color-text-secondary`
- Section headers: `text-h4`, `--color-text-primary`, 24px margin-top
- Section divider: none (use spacing only)
- Example sentences: `jp-example` style with highlighted target word (`--color-brand-blue` underline)

### Action Buttons (Detail)
- Play audio: Icon button, 40px, `--color-brand-blue`
- Save/bookmark: Icon button, toggle between outline/filled star
- Add to flashcard: Ghost button → opens deck selector dropdown
- All with `title` tooltip on hover

### Kanji Breakdown
- Each kanji in a bordered box: 48px square, `--radius-md`, `--color-bg-sunken`
- Meaning below: `text-caption`
- Clickable → navigates to kanji detail

### Related Words
- Chip style: `--radius-full`, `--color-bg-sunken`, clickable
- Hover: `--color-brand-sky`

## Loading & Empty States

| State | Visual |
|-------|--------|
| Initial (no search) | Recent searches + trending words |
| Searching | Skeleton list (3 items shimmer) |
| Results found | List populated, first item auto-selected (desktop) |
| No results | Illustration + "No results for '...' " + suggestions |
| Detail loading | Skeleton card with placeholder blocks |
| Network error | Error state with retry button |

### Skeleton (Result Item)
```
┌────────────────────────────┐
│ ████████ (████)            │  ← Shimmer
│ ████████████ · ██ · ███    │
└────────────────────────────┘
```

## Interactions

| Action | Behavior |
|--------|----------|
| Type in search | Debounce 300ms → trigger search |
| Press Enter | Immediate search |
| Click result (desktop) | Load detail in side panel |
| Click result (mobile) | Navigate to detail page/sheet |
| Press ↑/↓ | Navigate result list |
| Press Esc | Clear search & focus input |
| Click 🔊 | Play pronunciation audio |
| Click ⭐ | Toggle bookmark (instant, optimistic UI) |
| Click [+ Card] | Open deck picker dropdown |
| Long-press word in example | Show reading assist tooltip |

## Sounds

| Event | Sound |
|-------|-------|
| Search submit | — (silent) |
| Result selected | — (silent) |
| Pronunciation play | Audio file plays |
| Bookmark toggle | `sfx-tap` (subtle) |
| Added to flashcard | `sfx-success` |

## Accessibility
- Search input: `aria-label="Search Japanese dictionary"`
- Results: `role="listbox"`, items as `role="option"`
- Keyboard: full navigation without mouse
- Screen reader: announces result count, selected word details
- Japanese text: proper `lang="ja"` attribute for screen readers

## Rules
1. Search must feel instant (< 200ms perceived for cached results).
2. Never show empty state while typing (show skeleton immediately).
3. Dictionary is the most data-dense screen — optimize for scan speed.
4. Furigana is always shown for kanji in search results.
5. Mobile detail uses native back gesture, not custom back button only.
6. Bookmark/save action must work offline (queue sync).
7. Related words are clickable and navigate within dictionary.
8. Audio loading shows spinner on play button (never blocks UI).
