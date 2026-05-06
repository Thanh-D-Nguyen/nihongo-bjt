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
2. agent-quality preflight for old or selected specialist agents;
3. learning-science review;
4. relevant domain expert review;
5. production frontend implementation;
6. browser/visual/runtime verification;
7. release-quality sign-off for the slice.

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
7. `company/gates/world-class-learner-experience-gate.md`
8. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
9. `company/gates/bjt-ui-pro-max-craft-gate.md`
10. `company/gates/agent-quality-gate.md`
11. `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md` when battle/share/postcard/social work is in scope
12. `company/agent-activity-trace.md`
13. `company/AGENT_ACTIVITY_BOARD.md` for substantial multi-agent slices
14. `company/learner-ui-screen-contract.md`
15. relevant `.github/agents/*.agent.md`
16. relevant route/component/API client files

## Specialist Routing

Use the smallest expert set that covers the risk.

| Surface                                  | Required agents                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learner shell, navigation, dashboard     | `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-learner-ui`, `bjt-learning-science`, `bjt-qa`                                                                                                                |
| Daily focus, habits, comeback, progress  | `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-learning-science`, `bjt-learner-ui`, `bjt-media-experience`, `bjt-qa`                                                                                        |
| BJT quiz, mock exam, scoring, results    | `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-assessment-psychometrics`, `bjt-learning-science`, `bjt-learner-ui`, `bjt-qa`                                                                                |
| Reading assist and Japanese text         | `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-learning-science`, `bjt-localization-japan-vietnam`, `bjt-learner-ui`, `bjt-qa`                                                                              |
| Audio and listening                      | `bjt-visual-experience`, `bjt-media-experience`, `bjt-learner-ui`, `bjt-qa`                                                                                                                                             |
| Share postcards and rendered images      | `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-postcard-visual-designer`, `bjt-media-experience`, `bjt-social-experience`, `bjt-security`, `bjt-learner-ui`, `bjt-qa`                                       |
| Battle, competition, share, referral     | `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-battle-experience`, `bjt-social-experience`, `bjt-learning-science`, `bjt-media-experience`, `bjt-growth-social`, `bjt-security`, `bjt-learner-ui`, `bjt-qa` |
| Privacy, public share, entitlements, ads | `bjt-security`, `bjt-social-experience` or `bjt-backend`, `bjt-visual-experience`, `bjt-learner-ui`, `bjt-qa`                                                                                                           |

## Slice Workflow

For exactly one route or flow:

1. Select the next route from `company/FRONTEND_ROUTE_PRIORITY.md`.
2. Fill or update a screen contract using `company/learner-ui-screen-contract.md`.
3. Run agent-quality preflight for the selected old/specialist agents using `company/gates/agent-quality-gate.md`. If a selected agent is missing required structure, patch the agent doc first when safe or record a blocker.
4. State:
   - design direction;
   - learner outcome;
   - primary action;
   - data/API dependencies;
   - specialist agents used.
5. Create or update `agent_activity` from `company/agent-activity-trace.md`. Mark each selected specialist as `subagent`, `inline`, `planned`, or `skipped`.
6. Inspect current frontend and API code.
7. If required backend/API/provider support is missing, route to `bjt-backend` before or inside the slice instead of faking persistent state in the frontend.
8. Produce the BJT UI Pro Max design-system brief before UI code changes.
9. Run `bjt-behavioral-psychology` for CTA, login, habit, progress, battle, share, comeback, and result flows.
10. Implement the vertical slice with real data states.
11. Add or update i18n keys.
12. Verify:

- typecheck or targeted compile;
- tests where relevant;
- browser/visual check when UI changed.

13. Run `company/gates/bjt-ui-pro-max-craft-gate.md`.
14. Run `company/gates/world-class-learner-experience-gate.md` with desktop and mobile screenshots.
15. If a human screenshot critique says the UI is weak, generic, bland, or hard to use, reopen the slice and run `.github/prompts/54_learner_visual_quality_rescue.prompt.md` before advancing.
16. If a visual rescue was reported as pass but the human still reports concrete issues such as weak CTA contrast, missing footer, huge empty canvas, or bland product identity, invalidate the pass and run `.github/prompts/55_learner_visual_escalation_after_failed_rescue.prompt.md`.
17. If prompt 55 or a Pro Max escalation already ran and the human still rejects button visibility or visual quality, invalidate that pass and run `.github/prompts/56_learner_ui_pro_max_rebuild_after_repeated_rejection.prompt.md`.
18. Record review evidence and the final `agent_activity` board under `company/reviews/bjt-ui-ux/`.

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
- world-class learner experience gate has no score below `4/5` when the slice is learner-facing;
- BJT UI Pro Max craft gate passes when the slice is learner-facing or visually rescued;
- repeated Pro Max rejection includes direct source access evidence from `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` or remains blocked;
- repeated button rejection includes at least 3 materially different CTA concepts before implementation;
- CTA contrast evidence and footer/trust surface evidence pass for app-shell learner screens;
- CTA state matrix covers default, hover, focus-visible, active, loading, and disabled states for critical actions;
- responsive evidence covers `375`, `768`, `1024`, and `1440` widths when practical, or records an environment blocker;
- behavioral psychology review passes for CTA, login, habit, progress, battle, share, comeback, and result flows;
- auth-aware learner routes have guest and authenticated desktop/mobile evidence, using runtime/local test credentials supplied by the human;
- no unresolved human screenshot rejection exists;
- remaining risks have owner and next action.

## Anti-Patterns

Do not:

- start with a marketing homepage when the product app is needed;
- add a generic dashboard card grid;
- create decorative UI that competes with Japanese text;
- accept beige/gray card walls, weak primary buttons, or generic SaaS dashboard composition as verified learner UI;
- continue to the next route after the human provides a screenshot critique saying the current route looks weak;
- keep a self-scored `pass` after human screenshot review identifies concrete unresolved visual blockers;
- mark `pending_human_review` or `completed` when the latest human message already rejects the screenshot;
- self-score "world-class" without a BJT UI Pro Max design-system brief and gate output;
- claim Pro Max without source access evidence on repeated rejection loops;
- rescue a repeatedly rejected button by only changing hue, radius, shadow, or font weight;
- skip `bjt-behavioral-psychology` when CTAs, login, habit, progress, battle, share, comeback, or result behavior changes;
- omit CTA hover/focus/active/loading/disabled state evidence;
- omit the learner footer/trust surface;
- use low-contrast primary or login buttons;
- mark auth-aware learner routes verified from guest-state screenshots only;
- write test credentials into tracked docs, screenshots, or logs;
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
