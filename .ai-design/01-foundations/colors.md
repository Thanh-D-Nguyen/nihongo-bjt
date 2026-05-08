# Colors — Production Token Reference

## CSS Custom Properties (Light Mode)

```css
:root {
  /* Brand Core */
  --color-brand-navy: #1B2A4A;        /* Primary action, headers, serious CTA */
  --color-brand-navy-hover: #243560;  /* Hover state */
  --color-brand-navy-pressed: #141F38;/* Active/pressed */
  --color-brand-blue: #3B82F6;        /* Interactive accent, links, secondary CTA */
  --color-brand-blue-hover: #2563EB;
  --color-brand-blue-light: #DBEAFE; /* Tag bg, selected row, breadcrumb active */
  --color-brand-sky: #EFF6FF;         /* Soft highlight bg, active nav item */
  --color-brand-sakura: #F9A8D4;      /* Gamification accent, streak, badge glow */
  --color-brand-sakura-light: #FDF2F8;/* Reward toast bg */
  --color-brand-gold: #F59E0B;        /* Premium badge, star, achievement */
  --color-brand-gold-light: #FFFBEB; /* Premium banner bg */

  /* Text */
  --color-text-primary: #111827;      /* Main body text */
  --color-text-secondary: #4B5563;    /* Descriptions, metadata */
  --color-text-tertiary: #9CA3AF;     /* Placeholder, disabled labels */
  --color-text-inverse: #FFFFFF;      /* Text on dark backgrounds */
  --color-text-link: #2563EB;         /* Inline links */
  --color-text-link-hover: #1D4ED8;

  /* Surfaces */
  --color-bg-page: #F8FAFC;           /* App background */
  --color-bg-surface: #FFFFFF;        /* Cards, panels, modals */
  --color-bg-surface-hover: #F1F5F9; /* Card hover, row hover */
  --color-bg-elevated: #FFFFFF;       /* Floating panels, popovers */
  --color-bg-sunken: #F1F5F9;        /* Input fields, code blocks */
  --color-bg-overlay: rgba(15, 23, 42, 0.5); /* Modal overlay */

  /* Borders */
  --color-border-default: #E2E8F0;   /* Cards, inputs, dividers */
  --color-border-hover: #CBD5E1;     /* Input hover */
  --color-border-focus: #3B82F6;     /* Focus ring */
  --color-border-strong: #94A3B8;    /* Active borders */

  /* Semantic — Success */
  --color-success: #059669;           /* Text/icon */
  --color-success-bg: #ECFDF5;       /* Toast/banner bg */
  --color-success-border: #A7F3D0;
  --color-success-hover: #047857;

  /* Semantic — Warning */
  --color-warning: #D97706;
  --color-warning-bg: #FFFBEB;
  --color-warning-border: #FDE68A;

  /* Semantic — Error */
  --color-error: #DC2626;
  --color-error-bg: #FEF2F2;
  --color-error-border: #FECACA;
  --color-error-hover: #B91C1C;

  /* Semantic — Info */
  --color-info: #2563EB;
  --color-info-bg: #EFF6FF;
  --color-info-border: #BFDBFE;

  /* Learning-Specific */
  --color-correct: #059669;           /* Correct answer highlight */
  --color-correct-bg: #ECFDF5;
  --color-incorrect: #DC2626;         /* Wrong answer */
  --color-incorrect-bg: #FEF2F2;
  --color-neutral-answer: #6B7280;   /* Unselected answer */
  --color-srs-new: #8B5CF6;          /* SRS: new card */
  --color-srs-learning: #F59E0B;     /* SRS: learning */
  --color-srs-review: #3B82F6;       /* SRS: review due */
  --color-srs-mastered: #059669;     /* SRS: mastered */

  /* Battle Mode */
  --color-battle-blue: #3B82F6;      /* Player team */
  --color-battle-red: #EF4444;       /* Opponent team */
  --color-battle-timer: #F59E0B;     /* Timer countdown */
  --color-battle-timer-urgent: #DC2626; /* Last 5 seconds */
  --color-battle-score-glow: rgba(59, 130, 246, 0.3);

  /* Admin-Specific */
  --color-admin-sidebar: #1E293B;    /* Admin sidebar bg */
  --color-admin-sidebar-text: #E2E8F0;
  --color-admin-sidebar-active: #3B82F6;
  --color-admin-header: #FFFFFF;
}
```

## Dark Mode Override

```css
[data-theme="dark"] {
  --color-bg-page: #0F172A;
  --color-bg-surface: #1E293B;
  --color-bg-surface-hover: #334155;
  --color-bg-sunken: #0F172A;
  --color-bg-overlay: rgba(0, 0, 0, 0.7);
  --color-text-primary: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-text-tertiary: #64748B;
  --color-border-default: #334155;
  --color-border-hover: #475569;
  --color-brand-sky: #1E293B;
  --color-brand-blue-light: #1E3A5F;
}
```

## Tailwind Mapping (tailwind.config.ts)

```ts
colors: {
  brand: {
    navy: 'var(--color-brand-navy)',
    blue: 'var(--color-brand-blue)',
    sky: 'var(--color-brand-sky)',
    sakura: 'var(--color-brand-sakura)',
    gold: 'var(--color-brand-gold)',
  },
  surface: 'var(--color-bg-surface)',
  page: 'var(--color-bg-page)',
}
```

## Usage Rules

1. **One strong accent per screen** — navy CTA or blue CTA, never both competing.
2. **Error color = real errors only** — not decoration, not emphasis.
3. **Disabled state** = `opacity-50 cursor-not-allowed` + text using `--color-text-tertiary`.
4. **Focus ring** = `ring-2 ring-brand-blue ring-offset-2` — must be visible on all interactive elements.
5. **Contrast** — all text must meet WCAG AA (4.5:1 body, 3:1 large text).
6. **SRS colors** — always paired with icon or label, never color-only differentiation.
7. **Battle mode** — blue/red must not rely on color alone; use position/label for colorblind users.
