# 54 - Learner Visual Quality Rescue

<context-hint>
Use when a learner screen technically passes but the screenshot looks generic, weak, unclear, too beige, too card-heavy, hard to use, or below a world-class production standard.
</context-hint>

<task>
Act as `bjt-human-proxy` coordinating `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-learner-ui`, `bjt-learning-science`, `bjt-media-experience`, `bjt-localization-japan-vietnam`, and `bjt-qa`. Reopen the selected learner slice, redesign it from product principles, implement the rescue, and verify with screenshots.
</task>

<required-reading>
1. `DESIGN.md`
2. `company/gates/world-class-learner-experience-gate.md`
3. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
4. `company/gates/bjt-ui-pro-max-craft-gate.md`
5. `company/gates/bjt-ui-ux-production-gate.md`
6. `company/gates/open-design-bjt-ui-gate.md`
7. `company/gates/learner-page-production-gate.md`
8. `company/gates/media-quality-gate.md`
9. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
10. `company/FRONTEND_ROUTE_PRIORITY.md`
11. `company/learner-ui-screen-contract.md`
12. `company/agent-activity-trace.md`
13. `company/AGENT_ACTIVITY_BOARD.md`
14. current review file under `company/reviews/bjt-ui-ux/`
15. changed route/component/API files
</required-reading>

<instructions>
1. Do not continue to the next route while the current screenshot fails the world-class learner experience gate.
2. Treat human feedback like "cui", "generic", "nhat", "button kho nhin", or "khong can giao dien cu" as a hard quality signal.
3. Ignore the old UI as a constraint. Existing UI is reference only, not the source of truth.
4. Re-state the route outcome and the one primary action.
5. Initialize `agent_activity` using `company/agent-activity-trace.md` and update `company/AGENT_ACTIVITY_BOARD.md`. Show all selected specialists, whether each is a real `subagent` or `inline` pass, and current status/evidence.
6. Produce a BJT UI Pro Max design-system brief before code changes. If it is missing, do not implement yet.
7. Run the specialist pass:
   - `bjt-visual-experience`: visual identity, palette, hierarchy, buttons, screenshot critique.
   - `bjt-behavioral-psychology`: perceived affordance, CTA anxiety, decision fatigue, habit pressure, login friction, and next-action clarity.
   - `bjt-learning-science`: focus, cognitive load, pressure, next best action.
   - `bjt-learner-ui`: production implementation and responsive layout.
   - `bjt-media-experience`: motion, sound, feedback, quiet mode, reduced motion.
   - `bjt-localization-japan-vietnam`: natural copy and no raw keys.
   - `bjt-qa`: browser visual/runtime verification.
   - `bjt-backend` if production content truth requires API/provider/data support.
8. Remove or redesign generic equal-weight card grids.
9. Make primary buttons visually decisive and accessible.
10. Add CTA default, hover, focus-visible, active, loading, and disabled states for critical actions.
11. Replace placeholder/sample-heavy content with real data, useful empty states, or a backend gap.
12. Define a controlled motion/sound plan. No autoplay. Sound must be opt-in/user-triggered and mutable.
13. Add or verify a localized footer/trust surface for app-shell learner screens.
14. Record contrast evidence for primary CTA, auth CTA, and active nav. If contrast evidence is missing, `button_clarity` cannot pass.
15. Run `company/gates/bjt-ui-pro-max-craft-gate.md`.
16. For auth-aware routes, verify both guest and authenticated learner states using runtime/local test credentials supplied by the human. Do not write credentials into tracked files.
17. Capture guest desktop, guest mobile 375px, guest tablet 768px, guest desktop 1024px/1440px, authenticated desktop, and authenticated mobile 375px screenshots when practical/auth is in scope.
18. Score every world-class dimension at `4/5` or higher before marking the slice verified.
19. If the human rejects the screenshot after this rescue, immediately route to `.github/prompts/55_learner_visual_escalation_after_failed_rescue.prompt.md`.
20. Record final `agent_activity` in the review artifact.
</instructions>

<output>
```yaml
learner_visual_quality_rescue:
  status: continuing | blocked | pass
  route_or_flow:
  reason_for_reopen:
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
  world_class_gate:
    status: pass | block
    scores:
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
    contrast_evidence:
      primary_cta:
      auth_cta:
      active_nav:
    footer_evidence:
      present: yes | no
      links:
        - key
      mobile_overlap_checked: yes | no
    authenticated_state_evidence:
      credential_source:
      login_result:
      user_menu_checked:
      sign_out_checked:
      personalized_data_truth:
  bjt_ui_pro_max_craft_gate:
    status: pass | block
    design_system_brief: present | missing
    cta_state_matrix: pass | block
    screenshot_75_percent_review: pass | block
    behavioral_review: pass | block
  implementation_done: yes | no
  screenshots:
    desktop:
    mobile_375:
    tablet_768:
    desktop_1024:
    desktop_1440:
  verification:
    commands:
      - command:
        result:
  backend_escalation:
    needed: yes | no
    reason:
  next_safe_action:
```
</output>
