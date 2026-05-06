# Visual QA

Review **touched learner UI** (`apps/web`) as a product designer and frontend engineer. Scope to files changed in the current task or PR unless the user names specific routes.

## Load

- `.cursor/rules/04-ui-ux-polish.mdc`
- `.cursor/rules/06-product-ux-benchmark.mdc`
- `.cursor/rules/07-design-system-quality.mdc`
- `.cursor/agents/core/visual-experience.md`
- `.cursor/agents/core/learner-ui.md`

## Benchmark (judgment only)

- **Feature completeness** can be inspired by **Mazii** (search/detail depth, dictionary-like usefulness when data exists).
- **UX clarity and visual calm** should feel closer to **Quizlet** (simple first impression, obvious study actions, mobile-first).
- **Do not** copy external product assets, branding, icons, or exact layouts — use references only for expectations and patterns.

## Review checklist

### 1. Main learner intent

- Is it obvious what the learner should do next?

### 2. Visual hierarchy

- Is the most important content visually dominant?
- Are secondary details quiet enough?

### 3. Layout

- Is desktop balanced?
- Is mobile natural?
- Is spacing consistent?
- Is content too dense?

### 4. Interaction

- Are primary and secondary actions clear?
- Are hover, focus, loading, and disabled states present?
- Are audio, bookmark, and practice affordances easy to understand (labels, icons, i18n)?

### 5. Learning UX

- Does the UI help study flow?
- Does it avoid overwhelming the learner (progressive disclosure)?
- Are examples, kanji, audio, bookmark, and practice affordances placed logically?

### 6. States

- Loading
- Empty
- Error
- No data
- Reduced motion (`prefers-reduced-motion`)

### 7. Accessibility

- Keyboard and visible focus basics
- ARIA labels where needed (especially icon-only controls)
- Touch target size
- Contrast

### 8. Code quality

- Reuses existing design system components where possible
- No random one-off colors or spacing
- No hard-coded user-visible strings
- No unrelated refactor mixed into the UI change

## Output (use exactly this structure when reporting)

## Visual QA decision

- **PASS**
- **PASS WITH MINOR CHANGES**
- **REQUEST CHANGES**

(Pick one.)

## Top issues

List only important UI/UX issues.

## Required fixes

Concrete changes, not vague advice.

## Optional polish

Small improvements only.

## Risk

Any remaining UX/code risk.
