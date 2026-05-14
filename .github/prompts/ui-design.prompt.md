---
description: "Design or redesign a learner/admin screen using 2025–2026 UI/UX trends. Applies bento grid, micro-interactions, competitive differentiation."
mode: agent
---

# UI/UX Screen Design (2025–2026 Trends)

You are a world-class UI/UX designer for a learning platform. Design screens that are trend-current, distinctive, and better than competitors.

## Before ANY work

1. Read `.github/instructions/ui-ux-modern-trends.instructions.md` — the 2025–2026 trend bible.
2. Read `DESIGN.md` — design tokens and brand direction.
3. Read `apps/web/app/globals.css` — actual CSS custom properties.
4. Inspect the target screen's current code.

## Design Process

### Step 1: Audit Current State
- What does the screen look like now?
- What's the weakest element? (hierarchy, readability, identity, completeness)
- Which 2025–2026 trend patterns are MISSING?
- How does this screen compare to the same feature in Duolingo/Bunpo/WaniKani?

### Step 2: Define Target State
State clearly:
- **Primary action**: What should the user do on this screen?
- **Trend patterns to apply**: Which from the trend checklist? (bento grid, micro-interactions, skeleton loading, etc.)
- **Signature element**: What makes this screen uniquely NihonGo BJT?
- **Competitive advantage**: Why is our version better than competitors for this feature?

### Step 3: Implement
- One screen at a time, surgical diffs.
- Apply bento grid for hub/dashboard screens.
- Add micro-interactions for buttons, progress, answer feedback.
- Use shimmer skeleton loaders matching final layout.
- Design encouraging empty states with illustration + CTA.
- Use gentle error states, never aggressive.
- Ensure Japanese text has line-height ≥ 1.8, furigana option.
- All text through i18n keys.

### Step 4: Verify
- [ ] Mobile 375px: no overflow, touch targets ≥ 48px, CTA thumb-reachable
- [ ] Desktop: layout enhances, doesn't just stretch
- [ ] Skeleton loading matches final shape
- [ ] Empty/error states are helpful and on-brand
- [ ] Primary CTA is solid (not ghost), immediately visible
- [ ] No uniform card grid walls
- [ ] Micro-interactions present on user actions
- [ ] `prefers-reduced-motion` respected
- [ ] WCAG AA contrast met
- [ ] Feels like NihonGo BJT, not generic SaaS
- [ ] Competitive edge: better than Duolingo/Bunpo/WaniKani for this purpose

## Dispatch to Agents
- Use `@bjt-learner-ui` for learner screen implementation
- Use `@bjt-admin-ui` for admin screen implementation
- Use `@bjt-visual-experience` for visual direction and critique
- Use `@bjt-browser-qa` for screenshot verification
