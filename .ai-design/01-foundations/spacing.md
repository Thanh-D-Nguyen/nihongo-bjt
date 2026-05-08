# Spacing — Production Token Reference

## Base Unit
**4px** — all spacing values are multiples of 4.

## Token Scale

```css
:root {
  --space-0: 0px;
  --space-0.5: 2px;    /* Micro: icon optical adjustments */
  --space-1: 4px;      /* Hairline: border spacing, tight inline gaps */
  --space-1.5: 6px;    /* Dense: compact tag/badge padding */
  --space-2: 8px;      /* Tight: inline elements, icon-to-text gap */
  --space-3: 12px;     /* Compact: form element spacing, small card padding */
  --space-4: 16px;     /* Default: card padding (mobile), list item padding */
  --space-5: 20px;     /* Comfortable: card padding (desktop), section gap */
  --space-6: 24px;     /* Relaxed: card padding (large), group spacing */
  --space-8: 32px;     /* Section: between content sections */
  --space-10: 40px;    /* Large section: page section dividers */
  --space-12: 48px;    /* Page: top/bottom page margins */
  --space-16: 64px;    /* Hero: hero section spacing, large empty states */
  --space-20: 80px;    /* Dramatic: landing page section gaps */
}
```

## Component Spacing Patterns

### Cards
| Context | Padding | Gap between cards |
|---------|---------|-------------------|
| Admin list card | `--space-4` (16px) | `--space-3` (12px) |
| Content card | `--space-5` (20px) | `--space-4` (16px) |
| Flashcard | `--space-6` to `--space-10` | N/A (single) |
| Dashboard KPI card | `--space-5` (20px) | `--space-4` (16px) |
| Dictionary result item | `--space-3` vert, `--space-4` horiz | 0 (border divider) |

### Forms
| Element | Spacing |
|---------|---------|
| Label to input | `--space-1.5` (6px) |
| Between form fields | `--space-4` (16px) |
| Between form groups | `--space-6` (24px) |
| Input internal padding | `--space-3` vert, `--space-4` horiz |
| Button group gap | `--space-2` (8px) |
| Form to submit button | `--space-8` (32px) |

### Page Layout
| Element | Spacing |
|---------|---------|
| Page top padding | `--space-6` (24px) desktop, `--space-4` (16px) mobile |
| Page horizontal padding | `--space-6` (24px) desktop, `--space-4` (16px) mobile |
| Section title to content | `--space-4` (16px) |
| Between sections | `--space-8` (32px) desktop, `--space-6` (24px) mobile |
| Breadcrumb to page title | `--space-2` (8px) |
| Page title to content | `--space-6` (24px) |

### Navigation
| Element | Spacing |
|---------|---------|
| Nav item padding | `--space-2` vert (8px), `--space-3` horiz (12px) |
| Nav item gap | `--space-1` (4px) |
| Sidebar section gap | `--space-6` (24px) |
| Tab bar item gap | `--space-1` (4px) |
| Bottom nav icon to label | `--space-0.5` (2px) |

### Content
| Element | Spacing |
|---------|---------|
| Paragraph gap | `--space-4` (16px) |
| List item gap | `--space-2` (8px) |
| Heading to paragraph | `--space-3` (12px) |
| Between heading levels | `--space-8` (32px) top, `--space-4` (16px) bottom |
| Inline tag/badge gap | `--space-1.5` (6px) |
| Icon to text | `--space-2` (8px) |

## Density Modes

| Mode | Multiplier | Use Case |
|------|-----------|----------|
| Compact | 0.75× | Admin tables, dense lists, search results |
| Default | 1× | General UI, cards, forms |
| Comfortable | 1.25× | Learning screens, flashcards, reading |

```css
[data-density="compact"] {
  --space-multiplier: 0.75;
}
[data-density="comfortable"] {
  --space-multiplier: 1.25;
}
```

## Container Max Widths

| Context | Max Width | Centering |
|---------|-----------|-----------|
| Reading content | 680px | Centered |
| Form content | 560px | Left-aligned or centered |
| Dashboard content | 1280px | Centered |
| Admin table | 100% (within panel) | N/A |
| Flashcard | 600px | Centered |
| Dictionary detail | 720px | N/A (within panel) |

## Rules

1. **Always use tokens** — no arbitrary `margin: 13px` or `padding: 7px`.
2. **Consistent vertical rhythm** — elements stack with predictable spacing.
3. **More space around learning content** — flashcards, reading, examples need breathing room.
4. **Less space in admin/reference** — tables, lists, search can be denser.
5. **Mobile reduces spacing** — drop one level (e.g., `--space-6` → `--space-4`) below 768px.
6. **No horizontal overflow** — always test that spacing doesn't cause side scroll on mobile.
7. **Group related items tightly** — related elements (label+input, icon+text) have smaller gap than between groups.
8. **Whitespace is content** — generous spacing around focused learning areas improves comprehension.
