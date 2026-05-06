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
14. `company/gates/world-class-learner-experience-gate.md`
15. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
16. `company/gates/bjt-ui-pro-max-craft-gate.md`
17. `company/gates/agent-quality-gate.md`
18. `company/agent-activity-trace.md`
19. `company/AGENT_ACTIVITY_BOARD.md`
20. relevant route/component/API files
</required-reading>

<instructions>
1. If the human names a route/flow, select that route. Otherwise select the first incomplete item from `company/FRONTEND_ROUTE_PRIORITY.md`.
2. State the selected route, learner outcome, design direction, primary action, data dependencies, and required specialist agents.
3. Run the agent-quality preflight for the selected specialist set using `company/gates/agent-quality-gate.md`. If any selected old agent is missing required structure, patch the agent doc first when safe or return a blocker.
4. Initialize `agent_activity` using `company/agent-activity-trace.md` and update `company/AGENT_ACTIVITY_BOARD.md` for the selected slice. For every selected specialist, record responsibility, execution mode (`subagent`, `inline`, `planned`, or `skipped`), status, reason selected, and evidence.
5. Fill a concise screen contract using `company/learner-ui-screen-contract.md`.
6. Produce a BJT UI Pro Max design-system brief before implementation. Include route pattern, style mix, color roles, typography, component grammar, CTA states, motion/sound rules, behavioral intent, and rejected anti-patterns.
7. Inline or delegate the relevant specialist review:
   - visual direction/color/buttons/screenshot critique: `bjt-visual-experience`;
   - perceived affordance/CTA anxiety/decision fatigue/habit pressure: `bjt-behavioral-psychology`;
   - learning behavior/focus: `bjt-learning-science`;
   - quiz/mock/scoring: `bjt-assessment-psychometrics`;
   - audio/image/motion: `bjt-media-experience`;
   - Japanese/Vietnamese copy: `bjt-localization-japan-vietnam`;
   - social action/SNS/public share: `bjt-social-experience`;
   - battle modes/bot pacing/fairness: `bjt-battle-experience`;
   - postcard templates/rendered share image: `bjt-postcard-visual-designer`;
   - battle/share/privacy: `bjt-growth-social` and `bjt-security`;
   - missing API/provider/schema/runtime support: `bjt-backend`.
8. For battle/share/postcard work, apply `company/SOCIAL_BATTLE_POSTCARD_PRODUCT_LAYER.md`.
9. Implement only one vertical slice.
10. Use real APIs or explicit provider abstractions. Do not use fake persistent state.
11. If the frontend requires missing backend support, route to `bjt-backend` and implement that support before marking the frontend slice done.
12. Add/update i18n keys for user-facing copy.
13. Run the Open Design BJT five-dimension critique and fix any score below `3/5`.
14. Run the BJT UI Pro Max craft gate and fix any blocker.
15. Run the world-class learner experience gate and fix any score below `4/5`.
16. If the latest human screenshot critique says the UI is weak/generic/bland/hard to use, stop route advancement and run `.github/prompts/54_learner_visual_quality_rescue.prompt.md`.
17. For auth-aware learner routes, verify guest and authenticated states. Authenticated checks must use runtime/local test credentials supplied by the human and must not write credentials into tracked files.
18. If a previous rescue pass is contradicted by human screenshot feedback, invalidate the pass and run `.github/prompts/55_learner_visual_escalation_after_failed_rescue.prompt.md`.
19. Add/update review evidence in `company/reviews/bjt-ui-ux/`, including the final `agent_activity` board.
20. Run relevant tests/typecheck and browser visual review when practical.
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
  agent_quality_preflight:
    status: pass | patched | block
    agents_checked:
      - agent:
        action:
  agent_activity:
    board_status: planned | running | completed | blocked
    active_now:
      - agent:
        responsibility:
        execution_mode: subagent | inline | planned | skipped
        status:
        evidence:
    completed:
      - agent:
        responsibility:
        execution_mode:
        output_summary:
        evidence:
    blocked:
      - agent:
        reason:
        unblock_action:
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
  world_class_learner_scores:
    visual_identity:
    hierarchy:
    button_clarity:
    learning_focus:
    japanese_readability:
    sensory_interaction:
    production_content_truth:
    footer_trust:
    cta_contrast:
    authenticated_state:
  bjt_ui_pro_max_craft_gate:
    status:
    design_system_brief:
    cta_state_matrix:
    responsive_evidence:
    behavioral_review:
  contrast_evidence:
    primary_cta:
    auth_cta:
    active_nav:
  footer_evidence:
    present:
    links:
      - key
    mobile_overlap_checked:
  authenticated_state_evidence:
    credential_source:
    login_result:
    user_menu_checked:
    sign_out_checked:
    personalized_data_truth:
  approval_required: yes | no
  hard_stop_trigger:
    - none
```
</output>
