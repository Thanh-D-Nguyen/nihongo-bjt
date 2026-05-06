# BJT UI Pro Max Craft Gate

## Purpose

Use this gate before a learner UI slice can be marked world-class, visually rescued, or production-ready after human screenshot criticism.

This gate turns subjective quality feedback into evidence: a design-system brief, CTA state matrix, contrast ratios, responsive screenshots, guest/auth checks, specialist participation, and human-rejection handling.

## Required Inputs

1. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
2. `company/gates/world-class-learner-experience-gate.md`
3. `DESIGN.md`
4. changed route/component/token/i18n files
5. design-system brief from the implementer
6. external source access evidence for `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
7. `bjt-visual-experience` review
8. `bjt-behavioral-psychology` review
9. `bjt-learning-science` review when study, habit, progress, battle, result, or comeback behavior changes
10. `bjt-media-experience` review when sound, motion, image, video, or sensory feedback changes
11. `bjt-learner-ui` implementation evidence
12. `bjt-qa` or `bjt-browser-qa` verification evidence
13. guest and authenticated screenshots for auth-aware routes
14. responsive screenshot evidence at `375`, `768`, `1024`, and `1440` widths when practical
15. measured contrast evidence for primary CTA, auth CTA, and active nav
16. actual rendered browser/computed CSS evidence for primary CTA and auth CTA

## Hard Blockers

Block the slice when any item is true:

- the human says a button is hard to see, hard to read, "cui", bland, cheap, or unacceptable;
- a previous self-scored pass contradicts the latest human screenshot review;
- status is `pending_human_review` while the latest human message already rejects the screenshot;
- `agent_activity.board_status` is `completed` while unresolved human blockers remain;
- external source access evidence is missing during a repeated Pro Max rejection loop;
- design-system brief is missing;
- primary CTA, auth CTA, or active nav lacks measured contrast evidence;
- contrast evidence is based on intended token names but browser rendered CSS or screenshot perception contradicts it;
- button foreground/background contrast is below WCAG AA;
- the screenshot makes button text appear dark, muted, blurry, or lower contrast than claimed;
- default, hover, focus-visible, active, loading, or disabled states are missing for critical CTAs;
- focus-visible state is absent or relies only on subtle color;
- footer/trust/help surface is missing from learner app shell screens;
- guest and authenticated states are not both reviewed for auth-aware learner routes;
- logged-in state is just the guest state with login removed;
- screenshots only cover one desktop width while mobile/tablet/large desktop are assumed;
- screen looks like a generic AI dashboard, beige/gray card wall, or prototype floating in empty space;
- specialist activity board does not show which agents were used and whether each pass was `subagent`, `inline`, `planned`, or `skipped`;
- `bjt-behavioral-psychology` was skipped for habit, battle, progress, login, CTA, comeback, share, or result flows without a recorded reason.
- a second or later button rescue only changes hue, shadow, radius, or font weight without a materially different CTA system.

## Pass Criteria

All items must pass:

- a concrete route-specific design-system brief exists before implementation;
- external source access evidence exists, or the gate status is `block` with `blocked_network`;
- repeated button rejection includes at least 3 materially different CTA variants and a selected variant;
- primary action remains obvious in the 3-second scan and 75% screenshot review;
- actual rendered browser/computed CSS matches the reported CTA colors and typography;
- primary/auth CTAs have high-contrast default states and visible hover/focus/active/loading/disabled states;
- mobile tap targets are at least `44px`, with dominant mobile CTA preferably `48px`;
- active navigation is readable and not just a faint tinted chip;
- footer/trust surface is localized and does not overlap mobile bottom nav;
- desktop space is intentionally composed at `1024` and `1440`;
- mobile `375` feels designed, not merely stacked;
- behavioral review confirms low anxiety, low decision fatigue, and no shame/dark patterns;
- world-class learner experience gate also passes.

## Output

```yaml
bjt_ui_pro_max_craft_gate:
  status: pass | block
  route_or_flow:
  design_system_brief:
    status: present | missing
    external_source_access:
      status: pass | blocked_network
      source_url:
      sections_read:
        - none
    product_pattern:
    style_mix:
    signature_element:
    anti_patterns_rejected:
      - none
  cta_state_matrix:
    primary_cta: pass | block
    auth_cta: pass | block
    active_nav: pass | block
    states_checked:
      - default
      - hover
      - focus_visible
      - active
      - loading
      - disabled
  cta_variant_review:
    required: yes | no
    status: pass | block | not_required
    variants_considered:
      - name:
        result:
    selected_variant:
  contrast_evidence:
    primary_cta:
    auth_cta:
    active_nav:
  rendered_css_evidence:
    primary_cta:
      color:
      background_color:
      font_weight:
      dimensions:
      box_shadow:
    auth_cta:
      color:
      background_color:
      font_weight:
      dimensions:
      box_shadow:
  responsive_evidence:
    mobile_375:
    tablet_768:
    desktop_1024:
    desktop_1440:
    screenshot_75_percent_review:
  footer_trust:
    present: yes | no
    localized: yes | no
    mobile_overlap_checked: yes | no
  authenticated_state:
    guest_checked: yes | no
    logged_in_checked: yes | no
    credential_source: runtime_provided_by_human | env | blocked_environment
  behavioral_review:
    agent: bjt-behavioral-psychology
    status: pass | block | skipped_with_reason
    findings:
      - none
  human_rejection:
    latest_feedback:
    overrides_self_score: yes | no
    unresolved: yes | no
  agent_activity_evidence:
    board_status: planned | running | completed | blocked
    active_now_count:
    next_queue_count:
  blockers:
    - none
```
