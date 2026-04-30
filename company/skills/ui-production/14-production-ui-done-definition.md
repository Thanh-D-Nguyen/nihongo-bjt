# Production UI Done Definition

## When to Use

Use before Boss, Admin UI, Learner UI, QA, or Release Director marks a UI task production-ready.

## Required Checks

- Real API/provider contract or honest incomplete/feature-flag state.
- Loading, empty, error, degraded, permission, and feature-disabled states.
- i18n labels and natural localized copy.
- Responsive layout for desktop/tablet/mobile.
- Keyboard, focus, aria labels, form labels, contrast, and reduced motion.
- No fake success, fake metrics, or raw technical labels.
- Permission-aware actions.
- Dangerous actions confirmed and audited where required.
- Tests or visual/manual QA checklist recorded.
- BJT-specific UI/UX gate passes for learner, assessment, reading, media, social, or learning-operation UI.

## Anti-Patterns

- Page looks complete but workflow is fake.
- Only happy path implemented.
- Raw IDs/keys are main content.
- UI-only permission, premium, quota, or security enforcement.
- No owner for remaining visual/accessibility/test gaps.

## Output Checklist

- `company/gates/ui-production-gate.md`: pass
- admin page: `company/gates/admin-page-production-gate.md`: pass
- learner page: `company/gates/learner-page-production-gate.md`: pass
- visual QA evidence path or manual checklist
- BJT UI/UX review evidence when applicable
