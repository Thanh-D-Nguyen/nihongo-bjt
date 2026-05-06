# 55 - Learner Visual Escalation After Failed Rescue

<context-hint>
Use when a learner visual rescue was marked pass, but the human screenshot review still reports weak UI, unreadable buttons, missing footer/trust surface, bland layout, or non-production visual quality.
</context-hint>

<task>
Act as `bjt-human-proxy` and escalate FE visual work beyond the normal rescue loop. Reopen the current route as a failed rescue, invalidate the previous self-scores, repair the concrete visual blockers, and verify again with contrast evidence, footer evidence, and desktop/mobile screenshots.
</task>

<required-reading>
1. `DESIGN.md`
2. `company/gates/world-class-learner-experience-gate.md`
3. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
4. `company/gates/bjt-ui-pro-max-craft-gate.md`
5. `.github/prompts/56_learner_ui_pro_max_rebuild_after_repeated_rejection.prompt.md`
6. `.github/agents/bjt.behavioral-psychology.agent.md`
7. `company/gates/bjt-ui-ux-production-gate.md`
8. `company/gates/learner-page-production-gate.md`
9. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
10. `company/learner-ui-screen-contract.md`
11. `company/agent-activity-trace.md`
12. `company/AGENT_ACTIVITY_BOARD.md`
13. current review file under `company/reviews/bjt-ui-ux/`
14. auth/login route and provider files when the screen is auth-aware
15. changed route/component/API files
</required-reading>

<instructions>
1. Treat the previous world-class PASS as invalid when the latest human screenshot review contradicts it.
2. Do not continue to the next route.
3. Update `agent_activity` and `company/AGENT_ACTIVITY_BOARD.md`.
4. Record the concrete human blockers:
   - low-contrast primary CTA;
   - low-contrast or ambiguous login/auth CTA;
   - missing footer/trust surface;
   - excessive blank canvas or prototype-like centered layout;
   - generic/bland visual identity.
   - authenticated state not reviewed or not world-class.
5. Produce a BJT UI Pro Max design-system brief before code changes. Include pattern, style mix, color roles, typography, component grammar, motion/sound rules, behavioral intent, rejected anti-patterns, and pre-delivery checks.
6. Re-run specialist passes:
   - `bjt-visual-experience`: contrast, palette, footer, hierarchy, screenshot critique.
   - `bjt-behavioral-psychology`: perceived affordance, CTA anxiety, decision fatigue, habit pressure, login friction, and next-action clarity.
   - `bjt-learner-ui`: implementation and responsive layout.
   - `bjt-media-experience`: motion/sound only where useful and user-controlled.
   - `bjt-localization-japan-vietnam`: footer/auth/button copy and i18n keys.
   - `bjt-qa` or `bjt-browser-qa`: contrast/browser screenshot evidence.
7. Implement concrete fixes, not another self-score:
   - primary and auth CTAs must pass recorded contrast evidence;
   - primary and auth CTAs must have default, hover, focus-visible, active, loading, and disabled states;
   - CTA labels must be readable in 100% and 75% screenshot review;
   - footer/trust surface must exist and be localized;
   - mobile footer must not overlap bottom navigation;
   - empty desktop space must be used intentionally or reduced;
   - authenticated state must be redesigned and verified, not assumed from guest state;
   - old UI is not a constraint.
8. Use local/runtime test credentials supplied by the human to verify logged-in learner state. Do not write credentials into tracked files or screenshots.
9. Capture guest desktop, guest mobile 375px, guest tablet 768px, guest desktop 1024px/1440px, authenticated desktop, and authenticated mobile 375px screenshots when practical.
10. Output contrast evidence for primary CTA, auth CTA, and active nav.
11. Output authenticated state evidence: credential source, login result, user menu, sign-out, and personalized data truth.
12. Run `company/gates/bjt-ui-pro-max-craft-gate.md` and include the output.
13. Only mark pass if the human blockers are explicitly resolved and both the Pro Max craft gate and world-class gate pass with `footer_trust`, `cta_contrast`, and `authenticated_state`.
14. If this prompt has already been run once for the same route and the human still rejects CTA visibility or visual quality, do not run another tweak pass. Route immediately to `.github/prompts/56_learner_ui_pro_max_rebuild_after_repeated_rejection.prompt.md`.
</instructions>

<output>
```yaml
learner_visual_escalation:
  status: continuing | blocked | pass
  route_or_flow:
  previous_pass_invalidated: yes | no
  human_blockers:
    - blocker:
      resolved: yes | no
      evidence:
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
  contrast_evidence:
    primary_cta:
    auth_cta:
    active_nav:
  bjt_ui_pro_max_craft_gate:
    status: pass | block
    external_source_access: pass | blocked_network
    design_system_brief: present | missing
    cta_variant_review: pass | block | not_required
    cta_state_matrix: pass | block
    screenshot_75_percent_review: pass | block
    behavioral_review: pass | block
  footer_evidence:
    present: yes | no
    links:
      - key
    mobile_overlap_checked: yes | no
  authenticated_state_evidence:
    credential_source: runtime_provided_by_human | env | blocked_environment
    login_result: pass | blocked_environment | fail
    user_menu_checked: yes | no
    sign_out_checked: yes | no
    personalized_data_truth: pass | honest_empty | blocked
  screenshots:
    guest_desktop:
    guest_mobile_375:
    guest_tablet_768:
    guest_desktop_1024:
    guest_desktop_1440:
    authenticated_desktop:
    authenticated_mobile_375:
  verification:
    commands:
      - command:
        result:
  next_safe_action:
```
</output>
