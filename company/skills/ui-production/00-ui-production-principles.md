# UI Production Principles

## When to Use

Use for every admin or learner UI task before editing page, component, layout, copy, state, or visual behavior.

## Required Checks

- Use existing components and patterns first.
- Connect production UI to real API/provider contracts.
- Include loading, empty, error, degraded, permission, and feature-disabled states where relevant.
- Use i18n for user-facing text.
- Keep layout responsive and accessible.
- Keep learning UI calm, focused, and progress-oriented.
- Keep admin UI dense, scannable, and operational.
- For BJT learner UI, load `company/skills/bjt-ui-ux/` and define a learning-specific design direction.

## Anti-Patterns

- Fake success, fake metrics, or fake production data.
- Raw technical keys as labels.
- One-off colors, spacing, shadows, or component styles.
- UI that looks complete but cannot perform the workflow.
- Decorative motion/media that competes with learning.
- Generic visual trends applied without BJT learning purpose.

## Output Checklist

- state coverage named
- i18n keys named
- permission/feature flag behavior named
- verification command or manual QA noted
