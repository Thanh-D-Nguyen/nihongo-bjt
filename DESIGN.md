# NihonGo BJT DESIGN.md

## Product North Star

NihonGo BJT is a serious Japanese/BJT learning product for Vietnamese adults preparing for work, exams, and life in Japan.

The interface must make learners feel:

- clear about what to study next;
- protected from distraction during focused learning;
- coached after mistakes instead of judged;
- confident that progress, scores, and recommendations are backed by real data;
- immersed in business Japanese without decorative noise.

## Design Direction

**Quiet Mastery for Business Japanese**

The product should feel like a calm exam cockpit plus a high-trust learning coach. It is not a children's game, not a generic LMS, and not a marketing landing page.

Important: "quiet" must not become bland. A calm screen can still have a strong point of view, decisive hierarchy, clear buttons, and a memorable NihonGo BJT identity.

Core qualities:

- calm, premium, precise;
- warm and supportive, never shame-based;
- Japanese-readable and Vietnamese-readable;
- task-first and study-first;
- restrained motion and media;
- socially alive without social pressure;
- specific to BJT, business Japanese, and life/work in Japan.
- visibly production-grade: controls must be readable at a glance, the app shell must include trust/help affordances, and no screen should feel like a centered prototype floating in empty space.
- state-complete: guest, logged-in, loading, error, empty, and mobile states must all feel intentionally designed.

## Inspirations

Use `https://github.com/VoltAgent/awesome-design-md` only as a format and design-language reference. Do not copy a brand style directly.

Use `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` only as a design-system-generation reference: require an explicit pattern, style mix, color roles, typography, effects, anti-patterns, and pre-delivery checklist before code. Do not copy its style catalog directly; translate the discipline into NihonGo BJT via `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`.

Acceptable inspiration synthesis:

- Linear-like precision for workflow clarity;
- Mintlify/Notion-like reading comfort for study surfaces;
- Apple-like restraint for typography and whitespace;
- exam cockpit/data-product clarity for timed practice and score interpretation;
- subtle Japanese editorial restraint without cliche decoration.

Avoid:

- dominant purple/blue gradients;
- neon/cyberpunk/crypto aesthetics;
- childish mascot-first learning UI;
- heavy glassmorphism;
- decorative hero sections inside app workflows;
- fake gamification or fake analytics.
- beige/gray card walls that make the app feel like an internal dashboard;
- low-contrast primary buttons or actions that look disabled;
- generic SaaS layouts that could belong to any LMS.
- self-scored "pass" reports that contradict human screenshot review.
- vague "premium" claims without a route-specific design-system brief, CTA state matrix, responsive evidence, and behavioral psychology review.

## Visual System

### Color

Use a restrained neutral base with sparse semantic accents.

Preferred roles:

- `canvas`: off-white or very light neutral for long study sessions;
- `surface`: white or subtly tinted panels;
- `ink`: deep neutral/navy for primary text;
- `muted`: gray-blue for secondary copy;
- `focus`: controlled indigo/blue for primary learning action;
- `success`: green for correct/progress;
- `warning`: amber for attention;
- `danger`: red only for destructive/error state;
- `exam`: quiet dark/navy accents for timed exam mode.

Do not let one hue dominate the whole app. Status colors must carry meaning.

### Typography

Typography must serve bilingual learning.

- Japanese passages need generous line-height and stable measure.
- Vietnamese explanations need plain, precise language.
- Use compact headings in app surfaces; reserve hero-scale type for real marketing/public pages only.
- Avoid negative letter spacing.
- Use tabular numerics for timers, scores, quotas, streak counts, and analytics.

### Layout

Each screen must answer:

1. What am I doing now?
2. What is the next best action?
3. What evidence shows my progress?
4. Where do I go when I am stuck?

Default learner layout:

- compact top context strip;
- primary work area first;
- supporting panels second;
- remediation/progress panels only when they help the current task;
- mobile-first single-column flow with sticky core actions only when useful.
- a compact learner footer/trust surface for help, privacy, terms, support/contact, locale, and product/version context where appropriate.
- distinct logged-in information architecture: after login, the page must prioritize the learner's real next action and personal learning state rather than preserving a guest CTA layout.

Avoid:

- generic card walls;
- nested cards;
- marketing-like split hero sections inside logged-in app;
- multiple competing CTAs;
- decorative panels that do not advance learning.
- wide desktop canvases where small cards float in the middle with no strong focal structure.
- app screens that omit basic footer/trust/support access.
- auth-aware screens that only polish the guest state while leaving logged-in state generic or unreviewed.
- learner screens marked "world-class" without `company/gates/bjt-ui-pro-max-craft-gate.md`.

### Buttons And Controls

Buttons must look clickable before the learner reads the label.

Primary/auth CTAs require:

- measured contrast evidence;
- decisive default treatment;
- visible hover, focus-visible, active, loading, and disabled states;
- at least `44px` tap height, preferably `48px` for dominant mobile actions;
- icon/text spacing that stays readable at 100% and 75% screenshot scale;
- a clear distinction between study action, auth action, social action, exam action, and destructive action.

Block any learner screen when the human says the button is hard to see, the text blends into the button, or the CTA looks disabled. That human perception overrides self-scored gate results.

### Motion

Motion must orient, confirm, or reduce anxiety.

Allowed:

- subtle state transitions;
- answer feedback;
- progress confirmation;
- drawer/popover transitions;
- reduced-motion alternatives.

Forbidden:

- autoplay media;
- looping attention-grabbing effects in study/exam;
- distracting particles/parallax/orbs;
- motion that delays answering, reading, or review.

Sound and microinteractions:

- Sound is allowed only when user-triggered, mutable, and useful for learning feedback.
- Good sound moments: answer saved, review complete, battle ready, listening replay, postcard rendered.
- Quiet mode and reduced-motion behavior must be available before sound/motion can be considered production-ready.

### Media

Media must have a learning purpose.

- Audio needs visible controls, transcript/caption when available, and no autoplay.
- Images need provenance/license metadata when external or generated.
- Share/postcard media must not expose private learning data.
- Battle/media feedback must remain opt-in and respectful.

## Core Learner Surfaces

### Dashboard / Today Focus

Intent: show one calm daily study path.

Must include:

- next recommended action from real data;
- due review or BJT practice entry;
- weak-skill remediation when available;
- honest empty/loading/error states.

Avoid:

- fake productivity charts;
- many equal-weight cards;
- anxiety-inducing streak pressure.
- placeholder-heavy Daily Japanese sections;
- sample badges as the main production experience;
- CTA buttons that blend into the background;
- "verified" status without desktop and 375px screenshot evidence passing the world-class learner gate.
- missing footer/trust surface;
- "PASS" button scores without contrast evidence.
- authenticated state that simply removes the login banner without improving recommendations, progress truth, and user controls.

### BJT Practice Entry

Intent: help learners choose mode and difficulty correctly.

Must clarify:

- practice vs timed exam;
- BJT level and section;
- reading assist availability;
- estimated-score caveats.

### Timed Mock Exam

Intent: preserve exam integrity and focus.

Must include:

- quiet timer;
- section context;
- stable answer controls;
- no meaning reveal during active timed exam;
- accessible keyboard/focus behavior;
- clear pause/exit consequences.

### Result and Coaching

Intent: convert performance into next learning action.

Must include:

- estimated score/band label;
- section/skill breakdown from real answers;
- missed-question review;
- remediation links/decks when backed by data.

Avoid:

- shame copy;
- fake precision;
- confetti for weak performance;
- unsupported official-score claims.

### Reading Assist

Intent: reduce Japanese friction without replacing effort.

Must provide:

- furigana/meaning/add-to-flashcard controls where allowed;
- clear disabled behavior in timed exam mode;
- compact interaction that does not clutter long text.

### Battle

Intent: opt-in motivation and retrieval practice.

Must provide:

- real BJT question pool;
- bot fairness transparency;
- respectful result copy;
- no pay-to-win;
- abandonment/fairness signals where relevant.

### Social Sharing and Postcards

Intent: turn real learning progress into a beautiful, privacy-safe moment that can be shared or saved.

Must provide:

- explicit opt-in before creating a public share;
- template selection and preview before publishing;
- privacy-safe public token and OG metadata;
- postcard templates for achievements, BJT results, daily phrases, battle results, comeback milestones, and weak-skill improvement;
- a post-share next study action.

Avoid:

- forced share prompts;
- fake ranks/share counts;
- exposing private answer history or raw session identifiers;
- decorative cards that are not readable on mobile/SNS previews;
- celebration that shames low scores or weak performance.

## Screen Contract

Every learner screen must have a contract before major implementation:

- route;
- primary learner outcome;
- primary action;
- backend APIs and persistent data;
- i18n namespaces;
- reading assist behavior;
- exam integrity rules;
- loading/error/empty/degraded states;
- mobile behavior;
- accessibility requirements;
- relevant specialist agents;
- social/share/postcard privacy behavior when applicable;
- acceptance gates;
- browser/visual QA evidence.

Use `company/learner-ui-screen-contract.md`.

## Agent Rules

Before implementing learner UI:

1. Read this `DESIGN.md`.
2. Read `docs/design/bjt-ui-ux-production-standard.md`.
3. Read `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`.
4. Read the relevant BJT UI/UX skill.
5. State design direction, learning outcome, and acceptance criteria before editing.
6. Run the Open Design BJT five-dimension critique before handoff.
7. Run `company/gates/world-class-learner-experience-gate.md` with desktop and 375px screenshot evidence before marking learner UI verified.
8. For auth-aware routes, verify guest and logged-in states separately. Use local/runtime test credentials supplied by the human and never store credentials in tracked files.

Any score below `3/5` is not production-ready.
Any score below `4/5` in the world-class learner experience gate blocks a "world-class" claim.
Human screenshot rejection overrides automated/self-scored gate output.
