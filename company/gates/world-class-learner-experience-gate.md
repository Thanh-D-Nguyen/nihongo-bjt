# World-Class Learner Experience Gate

## Purpose

Use this gate for every learner-facing screen before it can be marked `verified` or production-ready.

This gate exists because a screen can be technically wired, translated, and type-safe while still looking generic, weak, or unworthy of a world-class learning product.

## Required Inputs

1. `DESIGN.md`
2. `company/learner-ui-screen-contract.md`
3. `company/skills/bjt-ui-ux/09-bjt-ui-pro-max-craft-skill.md`
4. `company/gates/bjt-ui-pro-max-craft-gate.md`
5. the changed route/component files
6. desktop screenshot evidence
7. mobile 375px screenshot evidence
8. tablet 768px, desktop 1024px, and desktop 1440px evidence when practical
9. specialist notes from `bjt-visual-experience`, `bjt-behavioral-psychology`, `bjt-learner-ui`, `bjt-learning-science`, and `bjt-qa`
10. `bjt-media-experience` notes when color, sound, motion, image, video, or sensory feedback is in scope
11. computed or manually recorded contrast evidence for primary CTA, auth CTA, active nav, and key text
12. CTA state matrix for default, hover, focus-visible, active, loading, and disabled states
13. footer evidence for app shell/public learner pages
14. unauthenticated screenshot evidence
15. authenticated learner screenshot evidence using local/runtime test credentials supplied by the human

## Non-Negotiable Standard

World-class does not mean more decoration. It means the screen has a clear product identity, a strong learning purpose, and a polished interaction system that a serious adult learner would trust and want to return to.

Human screenshot rejection overrides self-scoring. If the human says the UI still looks weak, "cui", hard to read, hard to click, missing product basics, or below production quality, the gate status is `block` even when an agent previously reported `pass`.

Block the slice when the screenshot looks like:

- a generic SaaS/admin dashboard;
- a beige or gray card wall with weak hierarchy;
- a wireframe with production copy;
- a page that could belong to any LMS or dashboard app;
- a design that only fixed text keys but did not improve the experience.
- a page with tiny centered content floating in a huge empty canvas;
- a learner app shell without a footer or equivalent legal/help/trust surface.
- only the guest state was reviewed while the logged-in state has different nav, user menu, dashboard data, recommendations, or CTAs.
- the route has no BJT UI Pro Max design-system brief or craft-gate output.
- the route skipped behavioral psychology review for CTA, login, habit, progress, battle, share, comeback, or result behavior.
- the latest human feedback already rejects the screenshot while reports still say `pending_human_review` or `completed`.
- repeated Pro Max rejection lacks direct source access evidence for `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`.

## Visual Pass Criteria

All items must pass:

- The primary learning action is unmistakable within 3 seconds.
- Primary buttons have measured contrast, decisive color, adequate size, state, and affordance.
- Primary buttons pass a 100% and 75% screenshot readability test.
- The visual hierarchy has one dominant focus, not many equal cards.
- The page has a memorable NihonGo BJT signature element that supports learning.
- The palette has meaningful contrast and is not dominated by beige, gray, purple-blue, or any one-note hue family.
- Card usage is intentional. Repeated card grids are replaced with a focused panel, timeline, lesson strip, cockpit, board, or other route-specific structure when that communicates better.
- Empty states are useful and action-oriented. Placeholder dashes, raw keys, and "sample content" badges cannot be the main production experience.
- Japanese text is visually important, readable, and supported by reading-assist rules where applicable.
- Mobile 375px layout feels designed, not merely stacked.
- Desktop layout uses space intentionally; large blank zones or small content floating in a huge canvas block the gate.
- Motion/sound strategy is explicit: either a useful opt-in interaction exists, or the screen documents why silence/static behavior is better for focus.
- Reduced-motion, mute/quiet mode, and no-autoplay rules are respected.
- Learner shell includes a production footer or bottom trust/help surface with localized links such as help, privacy, terms, contact/support, locale, and copyright/version where appropriate.
- Authenticated and unauthenticated states both pass visual quality, content truth, CTA contrast, footer, nav, and mobile checks.
- BJT UI Pro Max craft gate passes with design-system brief, CTA state matrix, responsive evidence, and behavioral review.
- Repeated CTA rejection uses a materially different CTA system, not another token-only tweak.

## Authenticated State Matrix

Block the slice when any required state is not checked:

| State                         | Required Evidence                                                    |
| ----------------------------- | -------------------------------------------------------------------- |
| Guest desktop                 | screenshot, CTA contrast, footer                                     |
| Guest mobile 375px            | screenshot, mobile nav/footer overlap check                          |
| Logged-in desktop             | screenshot using local/runtime test credential supplied by the human |
| Logged-in mobile 375px        | screenshot using local/runtime test credential supplied by the human |
| Auth loading/session checking | screenshot or source-level state proof                               |
| Auth error/session failed     | screenshot or source-level state proof                               |

Rules:

- Do not store real credentials in tracked files. Use local/runtime test credentials supplied by the human for the run.
- If login fails because the auth provider is unavailable, record `blocked_environment` and verify source-level authenticated UI branches; do not mark the route fully verified.
- Logged-in dashboard must not look like the guest dashboard with only the login banner removed. It must show useful personalized structure from real APIs or honest empty states.
- User menu/sign-out/profile affordances must be accessible, localized, and visually clear.
- Authenticated primary action must be distinct from auth CTAs. Login should never remain the dominant action after login.

## Button And Control Bar

Block the slice when:

- a primary CTA is low contrast, muted, or visually similar to secondary actions;
- text inside a button feels cramped, clipped, or hard to read;
- hover/focus/active states are absent for key actions;
- mobile tap targets are too small or too close;
- destructive, exam, social, and practice actions are not visually differentiated by risk and intent.
- the button foreground/background contrast is below WCAG AA (`4.5:1` for normal text, `3:1` for large bold text/icons) or no contrast evidence is recorded;
- the auth/login CTA or sticky primary CTA looks disabled, washed out, or visually blends into the surrounding panel;
- focus-visible outline is missing or only color is used to show focus;
- disabled and enabled buttons are hard to distinguish.
- the CTA fails the 75% screenshot readability test;
- the CTA fails the human screenshot perception test even if computed contrast passes;
- loading state is missing for actions that trigger navigation, login, save, start session, share render, or answer submission.

Minimum CTA requirements:

- primary action: filled or high-contrast treatment with text readable at a glance;
- secondary action: visibly secondary but still readable;
- auth action: obvious entry point, not a pale chip;
- active navigation: clear active state with icon/text contrast and not just a faint tinted background.

## Footer And Trust Surface

Block learner app shell/screens when:

- there is no footer, bottom utility area, or equivalent trust/help surface;
- footer links are hard-coded instead of i18n keys;
- legal/help/privacy/support links are missing from authenticated and unauthenticated learner surfaces where relevant;
- the footer visually looks like an afterthought or disappears on normal desktop/mobile viewport paths;
- footer creates overlap with mobile bottom nav.

Footer can be compact, but production pages must make trust and support discoverable.

## World-Class UI Checklist

Block the slice when:

- there is no clear product identity beyond text labels;
- typography scale is too small for a premium study product;
- content density is too sparse on desktop or too cramped on mobile;
- visual rhythm does not guide the learner from context to action to feedback;
- panels rely on shadow/border only without purposeful layout structure;
- key Japanese content lacks reading affordance planning;
- state transitions are absent for critical actions such as start session, login, save, complete review, or open battle;
- empty states are passive instead of offering the next safe action;
- errors do not preserve trust with recovery guidance;
- visual QA does not include both Vietnamese and Japanese locales when the screen has user-facing copy.

## Sensory Experience

Sound and motion can improve immersion, but only when controlled by the learner.

Required checks:

- No autoplay audio or looping attention effects in study, quiz, or exam flows.
- Sound effects are opt-in or triggered only by direct user action.
- Audio has visible controls and quiet-mode behavior.
- Motion communicates state: start, saved, correct/incorrect, streak-start, battle-ready, postcard-rendered, or review-complete.
- Motion never delays reading, answering, or moving to the next study step.

## Screenshot Review Rules

Before passing:

1. Capture desktop and mobile screenshots.
2. Capture both guest and logged-in learner states when the route is auth-aware.
3. Capture `375`, `768`, `1024`, and `1440` widths when practical; otherwise record the environment blocker.
4. Review primary/auth CTAs at 100% and 75% screenshot scale.
5. Score the screenshot against:
   - visual identity;
   - hierarchy;
   - button clarity;
   - learning focus;
   - Japanese readability;
   - interaction/sensory quality;
   - production content truth.
6. Any score below `4/5` blocks a world-class claim.
7. If the human says the screen is "cui", "generic", "nhat", "kho nhan nut", "looks cheap", or equivalent, reopen the slice as `block` even if automated checks pass.
8. If a prior rescue pass claimed `button_clarity: 5/5` and the human reports button contrast/readability failure, record the previous score as invalid and rerun rescue.
9. If footer/trust surface is missing, `visual_identity`, `functionality`, and `production_content_truth` cannot score above `3/5`.
10. If authenticated state is missing for an auth-aware learner route, `production_content_truth` and `learning_focus` cannot score above `3/5`.
11. If BJT UI Pro Max craft gate is missing or blocked, `visual_identity`, `button_clarity`, and `learning_focus` cannot score above `3/5`.
12. If the human rejects primary CTA visibility after a Pro Max pass, `button_clarity` is `block` regardless of contrast ratios.

## Output

```yaml
world_class_learner_experience_gate:
  status: pass | block
  route_or_flow:
  screenshot_evidence:
    guest_desktop:
    guest_mobile_375:
    authenticated_desktop:
    authenticated_mobile_375:
    auth_loading:
    auth_error:
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
    pro_max_craft:
    behavioral_psychology:
  bjt_ui_pro_max_craft_gate:
    status: pass | block
    external_source_access: pass | blocked_network
    design_system_brief: present | missing
    cta_variant_review: pass | block | not_required
    cta_state_matrix: pass | block
    screenshot_75_percent_review: pass | block
  contrast_evidence:
    primary_cta:
    auth_cta:
    active_nav:
  responsive_evidence:
    mobile_375:
    tablet_768:
    desktop_1024:
    desktop_1440:
  footer_evidence:
    present: yes | no
    links:
      - key
    mobile_overlap_checked: yes | no
  human_review:
    latest_feedback:
    overrides_self_score: yes | no
  authenticated_state_evidence:
    credential_source: runtime_provided_by_human | env | blocked_environment
    login_result: pass | blocked_environment | fail
    user_menu_checked: yes | no
    sign_out_checked: yes | no
    personalized_data_truth: pass | honest_empty | blocked
  blockers:
    - none
  rescue_required: yes | no
```
