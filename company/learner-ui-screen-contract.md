# Learner UI Screen Contract

Use this template before major learner frontend implementation.

Copy it into the relevant review artifact under `company/reviews/bjt-ui-ux/` or reference it from the task report.

```yaml
screen_contract:
  id:
  route:
  status: draft | ready_for_implementation | implemented | verified | blocked

  product_context:
    design_direction: Quiet Mastery for Business Japanese
    target_user:
    primary_learner_outcome:
    primary_action:
    secondary_actions:
    non_goals:

  data_contract:
    backend_apis:
      - method:
        path:
        purpose:
    persistent_models:
      - model:
    provider_abstractions:
      - provider:
    analytics_events:
      - event_name:
    fake_data_allowed: no
    missing_backend_behavior:
      route_to_bjt_backend: yes | no
      notes:

  learning_rules:
    cognitive_load_risks:
      - risk:
    motivation_rules:
      - rule:
    remediation_behavior:
    progress_truth_source:
    shame_or_pressure_risk:

  bjt_rules:
    bjt_level_or_section:
    practice_mode_behavior:
    timed_exam_behavior:
    estimated_score_labeling:
    reading_assist_allowed:
    reading_assist_blocked:

  localization:
    i18n_namespaces:
      - namespace:
    vietnamese_tone:
    japanese_text_rules:

  media_and_motion:
    audio:
    image:
    motion:
    reduced_motion:
    quiet_mode:
    sound_effects:
      allowed:
      trigger:
      mute_control:
    provenance_required:

  social_battle_postcard:
    applies: yes | no
    bot_persona:
    bot_transparency:
    battle_mode:
    fairness_metrics:
    share_kind:
    sns_targets:
    postcard_template_selection:
    postcard_preview_before_share:
    public_share_privacy:
    public_token_behavior:
    og_metadata_safety:
    moderation_or_hide_behavior:
    post_share_next_action:

  states:
    loading:
    empty:
    error:
    degraded:
    permission_denied:
    feature_disabled:
    offline_or_network_failure:
    unauthenticated:
    authenticated:
    auth_loading:
    auth_error:

  layout:
    desktop:
    mobile_375:
    tablet:
    keyboard_access:
    focus_management:
    contrast_notes:

  world_class_visual:
    signature_element:
    color_strategy:
    primary_button_rule:
    cta_contrast_evidence:
      primary_cta:
      auth_cta:
      active_nav:
    footer_trust_surface:
      present:
      links:
      mobile_overlap_checked:
    card_grid_risk:
    screenshot_desktop:
    screenshot_mobile_375:
    authenticated_screenshot_desktop:
    authenticated_screenshot_mobile_375:
    auth_state_evidence:
      credential_source:
      login_result:
      user_menu_checked:
      sign_out_checked:
      personalized_data_truth:
    human_screenshot_feedback:
      latest:
      overrides_self_score:
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

  specialist_review:
    required_agents:
      - bjt-learner-ui
    optional_agents:
    consulted_agents:
      - agent:
        responsibility:
        execution_mode: subagent | inline | planned | skipped
        status: planned | running | completed | blocked | skipped
        evidence:
    findings:

  acceptance_gates:
    - open_design_bjt_ui_gate
    - bjt_ui_ux_production_gate
    - learner_page_production_gate
    - world_class_learner_experience_gate

  verification:
    commands:
      - command:
        result:
    browser_routes:
      - route:
        viewport:
        result:
    screenshots:
      - path:
    known_risks:
      - risk:
        owner:
        next_action:
```

## Minimum Done Criteria

The contract is not implementation-ready until these are filled:

- route;
- primary learner outcome;
- primary action;
- backend APIs or explicit provider abstraction;
- i18n namespaces;
- reading assist behavior;
- loading/error/empty states;
- unauthenticated and authenticated state behavior;
- mobile behavior;
- world-class visual strategy and screenshot evidence;
- relevant specialist agents;
- acceptance gates.
