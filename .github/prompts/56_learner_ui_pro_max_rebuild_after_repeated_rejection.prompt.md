# 56 - Learner UI Pro Max Rebuild After Repeated Rejection

<context-hint>
Use when prompt 55 or another Pro Max rescue was reported complete/pass/pending review, but the human still rejects the screenshot, especially for primary/auth CTA visibility or "cui" visual quality.
</context-hint>

<task>
Act as `bjt-human-proxy` and run a rebuild-level Pro Max pass for the current learner route. This is not another color/shadow tweak. Invalidate previous pass results, prove direct source access to the UI/UX Pro Max reference, create multiple CTA systems, select one with specialists, implement it, and keep the route blocked until human screenshot rejection is actually resolved.
</task>

<required-reading>
1. `DESIGN.md`
2. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
3. `company/gates/bjt-ui-pro-max-craft-gate.md`
4. `company/gates/world-class-learner-experience-gate.md`
5. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
6. `company/FRONTEND_ROUTE_PRIORITY.md`
7. `company/learner-ui-screen-contract.md`
8. `company/agent-activity-trace.md`
9. `company/AGENT_ACTIVITY_BOARD.md`
10. `.github/agents/bjt.visual-experience.agent.md`
11. `.github/agents/bjt.behavioral-psychology.agent.md`
12. `.github/agents/bjt.learning-science.agent.md`
13. `.github/agents/bjt.media-experience.agent.md`
14. `.github/agents/bjt.learner-ui.agent.md`
15. `.github/agents/bjt.qa.agent.md`
16. current review file under `company/reviews/bjt-ui-ux/`
17. changed route/component/token/i18n files
</required-reading>

<external-source-required>
Open and read `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` directly before design work.

Record:

- source URL;
- access result;
- access time/date;
- sections read;
- 3-7 principles adapted to this route.

If the URL cannot be accessed, set `external_source_access.status: blocked_network`, update `company/AGENT_ACTIVITY_BOARD.md` as `blocked`, and do not mark the route pass.
</external-source-required>

<instructions>
1. Treat all previous FE-01 visual passes as invalid while the latest human screenshot review says the CTA is still unacceptable.
2. Do not output `pending_human_review` as a success state. If the human has already rejected the screenshot, the state is `blocked` or `continuing`.
3. Update `company/AGENT_ACTIVITY_BOARD.md` at the start:
   - `board_status: running` while agents are active;
   - `active_now` for the current specialist pass;
   - `next_queue` for planned specialists;
   - `blocked` for unresolved human blockers.
4. Produce external source access evidence from the GitHub URL.
5. Produce a new BJT UI Pro Max brief. It must reject the previous tweak-based CTA rescue.
6. Create at least 3 materially different CTA concepts before code. Changing only color, radius, font weight, or shadow is not enough.
7. Required CTA concepts to consider unless route context makes one impossible:
   - `command_bar`: high-contrast command row/dock with dominant action;
   - `exam_ticket`: tactile ticket/pass/action-strip style for the study session;
   - `coach_card`: integrated coach panel where the CTA is a strong action row, not a floating purple button.
8. Run specialist passes:
   - `bjt-visual-experience`: visual identity, CTA variants, palette, hierarchy, screenshot critique.
   - `bjt-behavioral-psychology`: perceived affordance, action anxiety, decision fatigue, click confidence.
   - `bjt-learning-science`: focus, next-action clarity, pressure, retention loop.
   - `bjt-media-experience`: motion/sound restraint and tactile feedback.
   - `bjt-learner-ui`: implementation.
   - `bjt-localization-japan-vietnam`: visible copy when copy changes.
   - `bjt-qa` or `bjt-browser-qa`: rendered CSS, screenshots, typecheck/lint/auth.
9. Implement the selected CTA system. Avoid reusing the failed purple button treatment unless the selected variant materially changes shape, composition, or context.
10. Verify actual rendered browser/computed CSS for primary CTA and auth CTA:
    - `color`;
    - `background-color`;
    - `font-weight`;
    - dimensions;
    - `box-shadow`;
    - focus outline.
11. Capture screenshots at `375`, `768`, `1024`, and `1440` widths when practical, plus guest/auth states for auth-aware routes.
12. Run `company/gates/bjt-ui-pro-max-craft-gate.md` and `company/gates/world-class-learner-experience-gate.md`.
13. If the human blocker is not demonstrably fixed, keep `status: blocked` and list the exact next action. Do not mark completed.
</instructions>

<output>
```yaml
learner_ui_pro_max_rebuild:
  status: running | continuing | blocked | pass
  route_or_flow:
  previous_pass_invalidated: yes | no
  external_source_access:
    status: pass | blocked_network
    source_url: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
    accessed_at:
    sections_read:
      - none
    adapted_principles:
      - none
  human_blockers:
    - blocker:
      status: unresolved | resolved
      evidence:
  agent_activity:
    board_status: planned | running | completed | blocked
    active_now:
      - agent:
        responsibility:
        execution_mode: subagent | inline | planned | skipped
        status:
        evidence:
    next_queue:
      - agent:
        responsibility:
        execution_mode: subagent | inline | planned
        reason_selected:
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
  cta_variant_review:
    previous_attempt_failed: yes | no
    variants:
      - name:
        concept:
        why_it_may_fix_human_blocker:
        risks:
    selected_variant:
    rejected_variants:
      - name:
        reason:
  rendered_css_evidence:
    primary_cta:
    auth_cta:
  screenshots:
    guest_mobile_375:
    guest_tablet_768:
    guest_desktop_1024:
    guest_desktop_1440:
    authenticated_mobile_375:
    authenticated_desktop:
  gates:
    bjt_ui_pro_max_craft_gate:
    world_class_learner_experience_gate:
  verification:
    commands:
      - command:
        result:
  next_safe_action:
```
</output>
