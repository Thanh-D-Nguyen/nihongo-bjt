# BJT UI Pro Max Craft Skill

## Purpose

Use this skill when a learner screen claims to be world-class, production-grade, premium, or visually rescued.

This skill adapts the design-system-generation discipline from `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` to NihonGo BJT. Do not copy its styles or templates. Use the same idea of producing a concrete design-system recommendation before code: pattern, style, color roles, typography, effects, anti-patterns, and a pre-delivery checklist.

## External Source Access Protocol

Before a repeated visual rescue can claim "UI Pro Max", the runner must attempt to read the source repo directly:

- URL: `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
- Required evidence: source URL, access time/date, sections read, and 3-7 design principles adapted to this route.
- If direct network/source access is unavailable, set `external_source_access.status: blocked_network` and do not claim a Pro Max pass. Use the local digest below only to continue planning, not to close the gate.

```yaml
external_source_access:
  status: pass | blocked_network
  source_url: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  accessed_at:
  sections_read:
    - Intelligent Design System Generation
    - How Design System Generation Works
    - Pre-Delivery Checklist
    - Available Styles
  adapted_principles:
    - none
  unavailable_reason:
```

## Local Source Digest

Use this only when the external URL cannot be opened. It is a summary of the repo's UI/UX discipline, not a substitute for direct source access on repeated rejection loops.

- Generate the design system before implementation.
- Search or reason across product type, style, color palette, page pattern, typography, effects, and anti-patterns.
- Output a complete recommendation: pattern, style, colors, typography, effects, what to avoid, and pre-delivery checklist.
- Treat accessibility, focus states, reduced motion, hover states, and responsive widths as delivery gates, not taste notes.
- Use industry/product fit. A BJT learning app should not inherit generic SaaS, AI purple, crypto, or landing-page patterns without a learning reason.

## Required Pre-Build Brief

Before editing UI code, write a compact design-system brief for the route:

```yaml
bjt_ui_pro_max_brief:
  route_or_flow:
  learner_state: guest | authenticated | both
  external_source_access:
    status: pass | blocked_network
    source_url:
    sections_read:
      - none
    adapted_principles:
      - none
  product_pattern:
  style_mix:
  signature_element:
  color_roles:
    canvas:
    surface:
    ink:
    muted:
    primary_cta:
    secondary_cta:
    success:
    warning:
    danger:
  typography:
    japanese:
    vietnamese:
    numbers:
  component_grammar:
    shell:
    nav:
    primary_panel:
    cta:
    cards:
    footer:
  motion_sound:
    motion:
    sound:
    reduced_motion:
    quiet_mode:
  behavioral_intent:
    desired_feeling:
    friction_removed:
    pressure_avoided:
  anti_patterns_rejected:
    - none
  pre_delivery_checks:
    - none
```

## Button And CTA Craft

Primary/auth CTAs cannot pass by taste. They need evidence.

Important: after two human button rejections, changing only hue, radius, font weight, or shadow is not a valid rescue. The next pass must explore distinct CTA systems and implement a materially different one.

Block when:

- foreground/background contrast is below WCAG AA (`4.5:1` normal text, `3:1` large bold text/icons);
- no measured contrast is recorded;
- contrast evidence comes only from intended token names rather than actual rendered browser/computed styles;
- button text is readable only when zooming in or squinting;
- the CTA color looks disabled, washed out, or too close to the surrounding panel;
- the screenshot makes the button label appear dark, muted, blurry, or lower contrast than the recorded CSS claim;
- hover, focus-visible, active, loading, and disabled states are missing for critical actions;
- mobile tap target is below `44px` high, or `48px` for the dominant mobile action;
- icon/text spacing is unstable or cramped;
- auth CTA visually competes with the primary study action after login;
- destructive, timed exam, social share, and study actions are not visually differentiated by intent.

Required CTA state matrix:

```yaml
cta_state_matrix:
  primary_cta:
    default:
    hover:
    focus_visible:
    active:
    loading:
    disabled:
    contrast_ratio:
    rendered_css:
      color:
      background_color:
      font_weight:
      box_shadow:
  auth_cta:
    default:
    hover:
    focus_visible:
    active:
    loading:
    disabled:
    contrast_ratio:
  active_nav:
    default:
    hover:
    focus_visible:
    current:
    contrast_ratio:
```

## Screenshot Perception Tests

Run these before any pass:

- 100% screenshot review: primary action and auth action are readable at a glance.
- 75% screenshot review: button label and affordance still remain clear.
- rendered-CSS check: browser evidence confirms the actual `color`, `background-color`, `font-weight`, dimensions, and shadow match the intended CTA.
- human override check: if the human says the CTA is still hard to see, status is `block`, not `pending_human_review`.
- 3-second scan: learner can name the next action without reading every card.
- squint test: one dominant action remains visually dominant.
- mobile thumb test: core actions fit without overlap or cramped tap zones.

## Repeated Button Rejection Protocol

Use when the human rejects the CTA after a normal rescue or Pro Max rescue.

1. Invalidate the previous pass.
2. Record the prior rescue as a failed tweak, even if contrast math passed.
3. Produce at least 3 materially different CTA concepts before implementation:
   - `command_bar`: full-width or docked action bar with strong ink/accent contrast;
   - `exam_ticket`: tactile ticket/pass style with a strong left icon block and action strip;
   - `coach_card`: primary panel where the CTA is integrated into a high-contrast action row;
   - or another route-specific system that is clearly not just color/radius/shadow changes.
4. Choose one concept with `bjt-visual-experience`, `bjt-behavioral-psychology`, and `bjt-learning-science`.
5. Implement the chosen concept.
6. Do not mark `pass` until screenshot evidence and human review no longer reject the button.

```yaml
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
```

## Layout Craft

Block when:

- a small centered app floats in a huge desktop canvas;
- the page is a beige/gray card wall;
- sections look like independent cards stacked without product rhythm;
- footer/help/privacy/support/trust is missing from learner shell screens;
- logged-in state is just guest state with the login banner removed;
- empty states rely on placeholder dashes, raw keys, or sample labels as the main experience;
- screen-specific polish is not reusable through tokens/components.

## Behavioral Psychology Review

Use `bjt-behavioral-psychology` with `bjt-learning-science` when the screen changes CTAs, daily habit, login prompt, streak, battle, share, progress, result, or comeback flows.

Review:

- perceived affordance: learner instantly understands what is clickable;
- action anxiety: CTA wording and hierarchy do not create fear or ambiguity;
- decision fatigue: the screen avoids competing equal-weight choices;
- motivation: streak/battle/progress copy supports agency, not shame;
- recovery: empty/error states give a safe next step;
- social pressure: share/battle/referral stays opt-in and respectful.

## Output

```yaml
bjt_ui_pro_max_craft:
  status: pass | block
  route_or_flow:
  design_system_brief: present | missing
  external_source_access: pass | blocked_network
  cta_variant_review: pass | block | not_required
  cta_state_matrix: pass | block
  contrast_evidence:
    primary_cta:
    auth_cta:
    active_nav:
  screenshot_perception:
    desktop_100:
    desktop_75:
    mobile_375:
    tablet_768:
    desktop_1024:
    desktop_1440:
  behavioral_psychology:
    status: pass | block
    notes:
  blockers:
    - none
```
