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

  layout:
    desktop:
    mobile_375:
    tablet:
    keyboard_access:
    focus_management:
    contrast_notes:

  specialist_review:
    required_agents:
      - bjt-learner-ui
    optional_agents:
    consulted_agents:
    findings:

  acceptance_gates:
    - open_design_bjt_ui_gate
    - bjt_ui_ux_production_gate
    - learner_page_production_gate

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
- mobile behavior;
- relevant specialist agents;
- acceptance gates.
