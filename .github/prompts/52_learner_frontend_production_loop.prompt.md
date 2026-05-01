# 52 - Learner Frontend Production Loop

<context-hint>
Use when the human asks to build the learner frontend, world-class BJT learning web app, immersive study experience, battle/social/postcard/SNS learner surfaces, or frontend production track.
</context-hint>

<task>
Act as `bjt-human-proxy` coordinating `bjt-boss`, `bjt-learner-ui`, and relevant specialists. Select exactly one learner frontend route/flow, prepare the screen contract, consult the needed specialists, implement the slice, and verify it.
</task>

<required-reading>
1. `.github/agents/bjt.human-proxy.agent.md`
2. `.github/agents/bjt.boss.agent.md`
3. `.github/agents/bjt.learner-ui.agent.md`
4. `DESIGN.md`
5. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
6. `company/FRONTEND_ROUTE_PRIORITY.md`
7. `company/learner-ui-screen-contract.md`
8. `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md` when battle/share/postcard/social work is in scope
9. `docs/design/bjt-ui-ux-production-standard.md`
10. `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
11. `company/gates/open-design-bjt-ui-gate.md`
12. `company/gates/bjt-ui-ux-production-gate.md`
13. `company/gates/learner-page-production-gate.md`
14. relevant route/component/API files
</required-reading>

<instructions>
1. If the human names a route/flow, select that route. Otherwise select the first incomplete item from `company/FRONTEND_ROUTE_PRIORITY.md`.
2. State the selected route, learner outcome, design direction, primary action, data dependencies, and required specialist agents.
3. Fill a concise screen contract using `company/learner-ui-screen-contract.md`.
4. Inline the relevant specialist review:
   - learning behavior/focus: `bjt-learning-science`;
   - quiz/mock/scoring: `bjt-assessment-psychometrics`;
   - audio/image/motion: `bjt-media-experience`;
   - Japanese/Vietnamese copy: `bjt-localization-japan-vietnam`;
   - social action/SNS/public share: `bjt-social-experience`;
   - postcard templates/rendered share image: `bjt-postcard-visual-designer`;
   - battle/share/privacy: `bjt-growth-social` and `bjt-security`;
   - missing API/provider/schema/runtime support: `bjt-backend`.
5. For battle/share/postcard work, apply `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md`.
6. Implement only one vertical slice.
7. Use real APIs or explicit provider abstractions. Do not use fake persistent state.
8. If the frontend requires missing backend support, route to `bjt-backend` and implement that support before marking the frontend slice done.
9. Add/update i18n keys for user-facing copy.
10. Run the Open Design BJT five-dimension critique and fix any score below `3/5`.
11. Add/update review evidence in `company/reviews/bjt-ui-ux/`.
12. Run relevant tests/typecheck and browser visual review when practical.
</instructions>

<hard-stop>
Stop for real human approval only when:
- destructive migration/data deletion is required;
- security/privacy/legal/billing risk needs acceptance;
- external provider/secret decision is required;
- Release Director returns `no_ship`;
- final public launch/go-live is requested.
</hard-stop>

<not-a-hard-stop>
These are not hard stops:
- route needs specialist review;
- route needs browser QA;
- backend has a small scoped missing API that can be implemented safely;
- current admin 100 loop remains a final-launch blocker, when the human explicitly asked for learner frontend work.
</not-a-hard-stop>

<output>
```yaml
learner_frontend_loop:
  status: continuing | stopped_for_approval | blocked
  selected_route:
  selected_slice:
  design_direction: Quiet Mastery for Business Japanese
  screen_contract_status:
  specialists_consulted:
    - agent:
      finding:
  implementation_done: yes | no
  verification:
    commands:
      - command:
        result:
    browser_review:
  backend_escalation:
    needed: yes | no
    reason:
  open_design_bjt_scores:
    philosophy:
    hierarchy:
    execution:
    functionality:
    specificity_restraint:
  approval_required: yes | no
  hard_stop_trigger:
    - none
```
</output>
