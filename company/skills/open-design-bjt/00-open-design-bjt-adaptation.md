# Open Design BJT Adaptation

## Source

Curated for NihonGo BJT from `nexu-io/open-design`:

- https://github.com/nexu-io/open-design

Use the workflow ideas only. Do not copy Open Design runtime architecture, daemon, artifact format, or generic brand systems into this product unless a task explicitly calls for it.

## Purpose

Raise UI work from "screen implemented" to product-grade experience:

- design system first;
- pre-flight before layout edits;
- stateful, workflow-complete UI;
- evidence-backed visual review;
- no generic AI-generated design habits.

## Principles We Adopt

### 1. Design System As Source

Before changing UI, identify the active local design language:

- existing components and CSS/Tailwind tokens;
- `company/skills/ui-production/*`;
- `company/skills/bjt-ui-ux/*` when learner or learning-operation UI is affected;
- current page patterns in the same app.

Do not invent one-off colors, shadows, radii, chart styles, or table patterns. If a genuinely new pattern is required, document it in the relevant skill or navigation doc.

### 2. Pre-Flight Before UI Work

For any UI slice, read the route/component and the relevant skills/gates before editing.

For admin UI, classify the page first:

- operations dashboard;
- CRUD management table;
- detail/review workflow;
- import/reconciliation workflow;
- support/privacy/billing/security workflow;
- analytics drilldown.

Then choose the layout and state model. Do not start by styling isolated cards.

### 3. Admin Is Systems Design

Admin screens are operational tools. Information density is a feature when it is structured.

Expected admin posture:

- fixed navigation and clear active state;
- compact page header with one primary action;
- KPI/summary row only when it helps decisions;
- filters/search/sort before tables where relevant;
- tables with status, freshness, ownership, and next action;
- permission-denied, feature-disabled, loading, empty, error, and degraded states;
- audit or provenance visibility for sensitive operations.

Avoid landing-page composition, giant hero typography, decorative gradients, and repeated cards that do not advance a workflow.

### 4. Learner UI Is Learning Experience Design

Learner-facing work must answer:

- what should I do next;
- am I improving;
- can I continue without overload.

Use Japanese reading support, remediation, progress, and focus modes as product layers. Do not add media, motion, competition, streaks, or social pressure unless they improve learning and pass the BJT UI/UX gate.

### 5. Anti AI-Slop Review

Before marking UI done, remove:

- decorative purple/blue gradients used as a default style;
- generic emoji/icon-per-heading patterns;
- fake metrics or invented "10x" claims;
- "Feature One" filler copy;
- cards that only restate labels;
- inconsistent type scale or oversized headings inside tool surfaces;
- stock-like decorative media where real product/state evidence is needed;
- UI that looks complete but cannot execute the workflow.

Honest placeholders are acceptable only when clearly non-production, feature-flagged, and backed by a real contract or blocker. Fake success is not acceptable.

### 6. Evidence-Backed Critique

Run a short five-dimension critique before handoff:

1. Philosophy: does the page match BJT/admin purpose and local design direction?
2. Hierarchy: can a user tell what to read and do first?
3. Execution: are spacing, alignment, responsive behavior, labels, and states polished?
4. Functionality: can the workflow complete against real APIs/contracts?
5. Specificity and restraint: is the content specific to this module without unnecessary flourish?

Any dimension below `3/5` is not production-ready. Fix the weakest issue or record a blocker.

## BJT Visual Direction

For admin completion, prefer a restrained product-operations direction inspired by Open Design's product/dashboard guidance:

- neutral/light surfaces for long work sessions;
- deep navy/indigo text and sparse accent usage;
- 8px spacing rhythm;
- 4px to 8px radius for dense admin controls unless existing components require otherwise;
- tabular numerics and compact labels for data-heavy screens;
- status colors only for semantic state;
- no single-hue decorative theme.

For learner-facing UI, follow `docs/design/bjt-ui-ux-production-standard.md` and `company/skills/bjt-ui-ux/`.

## Output Expectations

Every UI owner pass should state:

- design direction used;
- components/tokens reused;
- states implemented;
- five-dimension critique result;
- browser/visual QA evidence or blocker;
- remaining visual/product risks.
