# Radius & Shadow — Production Token Reference

## Border Radius Tokens

```css
:root {
  --radius-none: 0px;
  --radius-sm: 6px;        /* Small controls: chips, badges, inline tags */
  --radius-md: 10px;       /* Buttons, inputs, dropdowns */
  --radius-lg: 14px;       /* Cards, panels, toast */
  --radius-xl: 20px;       /* Large cards, modals */
  --radius-2xl: 24px;      /* Bottom sheets, floating panels */
  --radius-full: 9999px;   /* Pills, avatars, circular buttons */
}
```

### Usage Map

| Element | Radius | Example |
|---------|--------|---------|
| Badge/chip | `--radius-full` | SRS status pill, tag |
| Button | `--radius-md` | All button variants |
| Input field | `--radius-md` | Text input, select, textarea |
| Card | `--radius-lg` | Content card, flashcard |
| Modal | `--radius-xl` | Dialog, confirmation modal |
| Bottom sheet (mobile) | `--radius-2xl` (top only) | Action sheet, detail sheet |
| Avatar | `--radius-full` | User avatar, all sizes |
| Toast notification | `--radius-lg` | Success/error/info toast |
| Tooltip | `--radius-sm` | Helper tooltip, popover |
| Sidebar nav item | `--radius-sm` | Active item highlight |
| Progress bar | `--radius-full` | Track and fill |
| Image container | `--radius-md` | Thumbnail, illustration frame |

## Box Shadow Tokens

```css
:root {
  /* Elevation levels */
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -1px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03);
  --shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.10), 0 10px 10px -5px rgba(15, 23, 42, 0.04);
  --shadow-2xl: 0 25px 50px -12px rgba(15, 23, 42, 0.20);

  /* Semantic shadows */
  --shadow-card: var(--shadow-sm);
  --shadow-card-hover: var(--shadow-md);
  --shadow-dropdown: var(--shadow-lg);
  --shadow-modal: var(--shadow-xl);
  --shadow-toast: var(--shadow-lg);
  --shadow-sticky: 0 2px 8px rgba(15, 23, 42, 0.08);
  --shadow-inner: inset 0 2px 4px rgba(15, 23, 42, 0.05);

  /* Colored shadows (used sparingly) */
  --shadow-brand: 0 4px 12px rgba(59, 130, 246, 0.15);
  --shadow-success: 0 4px 12px rgba(5, 150, 105, 0.15);
  --shadow-error: 0 4px 12px rgba(220, 38, 38, 0.15);
  --shadow-gold: 0 4px 12px rgba(245, 158, 11, 0.20);

  /* Focus ring (not box-shadow, but ring utility) */
  --ring-focus: 0 0 0 3px rgba(59, 130, 246, 0.3);
  --ring-error: 0 0 0 3px rgba(220, 38, 38, 0.2);
}
```

### Elevation Hierarchy

| Level | Shadow | Use Case |
|-------|--------|----------|
| 0 (flat) | none | Inline elements, table rows, text |
| 1 (resting) | `--shadow-xs` | Input fields, subtle dividers |
| 2 (card) | `--shadow-sm` | Cards at rest, list items |
| 3 (raised) | `--shadow-md` | Hovered cards, active panels |
| 4 (floating) | `--shadow-lg` | Dropdowns, tooltips, popovers |
| 5 (overlay) | `--shadow-xl` | Modals, dialogs, command palette |
| 6 (dramatic) | `--shadow-2xl` | Full-screen sheets, image lightbox |

### Dark Mode Shadows

```css
[data-theme="dark"] {
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
  /* Dark mode relies more on border than shadow */
}
```

## Rules

1. **One elevation step between nested layers** — never jump from flat to shadow-xl.
2. **No double shadows** — don't nest shadowed cards inside shadowed panels.
3. **Border before shadow** — use `1px solid var(--color-border-default)` for subtle separation; only add shadow for true elevation.
4. **Colored shadows only for interactive feedback** — brand shadow on focused CTA, success shadow on completed state.
5. **Sticky elements always have shadow** — sticky headers/bars use `--shadow-sticky`.
6. **Dark mode: rely on borders** — shadows are less visible; increase border contrast instead.
7. **No inset shadow on buttons** — it creates an outdated "pressed" look. Use `scale(0.97)` for press state.
8. **Consistent radius within a card** — inner elements use smaller radius than parent (parent `--radius-lg` → child `--radius-md`).
