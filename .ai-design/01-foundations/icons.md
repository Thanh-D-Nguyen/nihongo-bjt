# Icons — Production Specification

## Icon Library
**Primary**: Lucide Icons (MIT license, consistent 24px grid, 1.5px stroke)
**Fallback**: Heroicons (for any missing Lucide equivalents)

## Size Tokens

```css
:root {
  --icon-xs: 14px;    /* Inline with caption text */
  --icon-sm: 16px;    /* Inline with body text, table actions */
  --icon-md: 20px;    /* Buttons, nav items, form labels */
  --icon-lg: 24px;    /* Section headers, primary actions */
  --icon-xl: 32px;    /* Empty states, feature highlights */
  --icon-2xl: 48px;   /* Hero icons, onboarding */
}
```

## Stroke & Color

- Stroke width: 1.5px (default), 2px (bold/emphasis)
- Default color: `currentColor` (inherits from parent text)
- Interactive icon: `--color-text-secondary` → `--color-brand-blue` on hover
- Disabled icon: `--color-text-tertiary`, `opacity: 0.5`
- Destructive icon: `--color-error`
- Success icon: `--color-success`

## Icon Map — Learning Domain

| Concept | Icon Name | Notes |
|---------|-----------|-------|
| Dictionary/Search | `search` | Magnifying glass |
| Flashcard | `layers` | Stacked cards |
| Quiz/Test | `clipboard-check` | Paper with checkmark |
| Battle | `swords` | Crossed swords |
| Grammar | `book-open` | Open book |
| Kanji | `type` | Typography symbol |
| Vocabulary | `book-text` | Book with text |
| Reading | `file-text` | Document |
| Listening | `headphones` | Headphones |
| Speaking | `mic` | Microphone |
| Streak | `flame` | Fire/flame |
| Achievement | `trophy` | Trophy cup |
| Level/Rank | `shield` | Shield badge |
| Progress | `trending-up` | Upward trend |
| Bookmark/Save | `star` | Star (outline/filled) |
| Add to deck | `plus-circle` | Plus in circle |
| Audio/Play | `volume-2` / `play` | Speaker / play triangle |
| Timer | `clock` | Clock face |
| Flag (review) | `flag` | Flag |

## Icon Map — Navigation

| Concept | Icon Name |
|---------|-----------|
| Home/Dashboard | `layout-dashboard` |
| Back | `arrow-left` |
| Menu | `menu` |
| Close | `x` |
| Settings | `settings` |
| Profile | `user` |
| Notifications | `bell` |
| Help | `circle-help` |
| Logout | `log-out` |
| External link | `external-link` |

## Icon Map — Admin

| Concept | Icon Name |
|---------|-----------|
| Users | `users` |
| Content | `file-stack` |
| Analytics | `bar-chart-3` |
| Monetization | `credit-card` |
| Reports | `file-bar-chart` |
| Permissions | `shield-check` |
| Audit log | `scroll-text` |
| Import | `upload` |
| Export | `download` |
| Edit | `pencil` |
| Delete | `trash-2` |
| Filter | `filter` |
| Sort | `arrow-up-down` |

## Usage Rules

1. **Icons support labels** — never replace a label with icon-only for critical actions (except universally understood: ✕ close, ← back).
2. **Consistent size per context** — all nav icons same size, all button icons same size.
3. **Never mix icon families** — if Lucide doesn't have it, draw custom in same style.
4. **Icon + text alignment** — icon vertically centered with text, `gap: 8px`.
5. **Touch target** — icon buttons have min 40px tap target regardless of visual icon size.
6. **No decorative icon spam** — every icon must aid comprehension or navigation.
7. **Animated icons** — only for loading spinner, toggle states, and major achievements.
8. **Color meaning** — icon color matches semantic meaning (green=success, red=error, blue=interactive).
