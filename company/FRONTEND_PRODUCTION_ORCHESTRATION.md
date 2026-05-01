# Frontend Production Orchestration

## Mission

Build the NihonGo BJT learner web app as a production-grade, world-class BJT learning experience.

This document overrides generic UI execution when the human asks for frontend, learner app, BJT web, immersive learning, or "world-class" product work.

It does not override hard safety rules:

- no fake production data;
- PostgreSQL is source of truth;
- i18n for user-facing text;
- privacy/security/billing/legal hard stops;
- no final production launch without real human approval.

## Operating Principle

Do not design screen-by-screen in isolation.

Every learner UI slice must pass through:

1. product outcome;
2. learning-science review;
3. relevant domain expert review;
4. production frontend implementation;
5. browser/visual/runtime verification;
6. release-quality sign-off for the slice.

For social, battle, and postcard work, also apply `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md`.

## Human Proxy Routing

When the human asks for learner frontend production work, `bjt-human-proxy` should classify the state as:

```yaml
frontend_track:
  status: active
  priority: learner_world_class_bjt
  default_next_prompt: .github/prompts/52_learner_frontend_production_loop.prompt.md
  approval_required: no
```

This track may run before admin 100 completion when the human explicitly shifts the active request to learner frontend/product experience. Admin 100 remains a final-launch blocker, but it should not prevent scoped learner frontend work.

## Required Reading for Every Learner Frontend Slice

1. `DESIGN.md`
2. `docs/design/bjt-ui-ux-production-standard.md`
3. `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
4. `company/gates/open-design-bjt-ui-gate.md`
5. `company/gates/bjt-ui-ux-production-gate.md`
6. `company/gates/learner-page-production-gate.md`
7. `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md` when battle/share/postcard/social work is in scope
8. `company/learner-ui-screen-contract.md`
9. relevant `.github/agents/*.agent.md`
10. relevant route/component/API client files

## Specialist Routing

Use the smallest expert set that covers the risk.

| Surface                                  | Required agents                                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Learner shell, navigation, dashboard     | `bjt-learner-ui`, `bjt-learning-science`, `bjt-qa`                                                                                       |
| Daily focus, habits, comeback, progress  | `bjt-learning-science`, `bjt-learner-ui`, `bjt-qa`                                                                                       |
| BJT quiz, mock exam, scoring, results    | `bjt-assessment-psychometrics`, `bjt-learning-science`, `bjt-learner-ui`, `bjt-qa`                                                       |
| Reading assist and Japanese text         | `bjt-learning-science`, `bjt-localization-japan-vietnam`, `bjt-learner-ui`, `bjt-qa`                                                     |
| Audio and listening                      | `bjt-media-experience`, `bjt-learner-ui`, `bjt-qa`                                                                                       |
| Share postcards and rendered images      | `bjt-postcard-visual-designer`, `bjt-media-experience`, `bjt-social-experience`, `bjt-security`, `bjt-learner-ui`, `bjt-qa`              |
| Battle, competition, share, referral     | `bjt-social-experience`, `bjt-learning-science`, `bjt-media-experience`, `bjt-growth-social`, `bjt-security`, `bjt-learner-ui`, `bjt-qa` |
| Privacy, public share, entitlements, ads | `bjt-security`, `bjt-social-experience` or `bjt-backend`, `bjt-learner-ui`, `bjt-qa`                                                     |

## Slice Workflow

For exactly one route or flow:

1. Select the next route from `company/FRONTEND_ROUTE_PRIORITY.md`.
2. Fill or update a screen contract using `company/learner-ui-screen-contract.md`.
3. State:
   - design direction;
   - learner outcome;
   - primary action;
   - data/API dependencies;
   - specialist agents used.
4. Inspect current frontend and API code.
5. If required backend/API/provider support is missing, route to `bjt-backend` before or inside the slice instead of faking persistent state in the frontend.
6. Implement the vertical slice with real data states.
7. Add or update i18n keys.
8. Verify:
   - typecheck or targeted compile;
   - tests where relevant;
   - browser/visual check when UI changed.
9. Record review evidence under `company/reviews/bjt-ui-ux/`.

## Production Bar

A learner frontend slice is not done unless:

- it uses real APIs or an explicit provider abstraction;
- loading, empty, error, degraded, and permission states are honest;
- all user-facing text is localized;
- mobile and desktop are usable;
- Japanese text remains readable;
- reading assist behavior is correct for the mode;
- exam mode does not reveal prohibited help;
- progress/score/rank values are not fake;
- motion/media are purposeful and accessible;
- battle/share/postcard flows are opt-in, privacy-safe, and backed by real APIs/provider contracts;
- Open Design BJT critique has no score below `3/5`;
- remaining risks have owner and next action.

## Anti-Patterns

Do not:

- start with a marketing homepage when the product app is needed;
- add a generic dashboard card grid;
- create decorative UI that competes with Japanese text;
- hard-code “premium” or paywall logic in the frontend;
- show fake chart data;
- use fake ranks/opponents;
- fake SNS share state or fake postcard renders;
- bury the next study action below content;
- build a complete-looking screen without workflow completion;
- treat screenshots alone as production proof.

## Recommended Build Order

Follow `company/FRONTEND_ROUTE_PRIORITY.md`.

Default first production slice:

```yaml
route: apps/web/app/[locale]/dashboard
slice: learner_shell_today_focus
reason: establishes product rhythm and reusable layout before deeper BJT flows
```
