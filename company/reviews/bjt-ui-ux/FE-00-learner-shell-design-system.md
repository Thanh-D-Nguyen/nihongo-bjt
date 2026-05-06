# FE-00 Learner Shell and Design System Alignment

## Screen Contract

```yaml
screen_contract:
  id: FE-00
  route: app shell / navigation / auth-aware learner frame
  status: verified

  product_context:
    design_direction: Quiet Mastery for Business Japanese
    target_user: Vietnamese adult BJT learner
    primary_learner_outcome: stable, calm, clear navigation product environment
    primary_action: navigate to any core learning surface
    secondary_actions:
      - sign in/out
      - access secondary routes via More sheet (mobile)
    non_goals:
      - marketing landing page
      - complex sidebar with nested menus

  data_contract:
    backend_apis: []
    persistent_models: []
    provider_abstractions: []
    analytics_events: []
    fake_data_allowed: no
    missing_backend_behavior:
      route_to_bjt_backend: no
      notes: Shell is purely navigational, no data dependencies

  learning_rules:
    cognitive_load_risks:
      - risk: too many nav items overwhelming on mobile → solved with 4+More bottom bar
    motivation_rules:
      - rule: no streak/score pressure in navigation chrome
    remediation_behavior: n/a for shell
    progress_truth_source: n/a for shell
    shame_or_pressure_risk: none

  localization:
    i18n_namespaces:
      - nav
    vietnamese_tone: neutral, professional
    japanese_text_rules: standard nav labels

  media_and_motion:
    audio: none
    image: none
    motion: color transition on nav active state only
    reduced_motion: respects prefers-reduced-motion via globals.css
    provenance_required: no

  states:
    loading: session-checking text shown while auth resolves
    empty: n/a
    error: n/a (shell does not fetch data)
    degraded: shows sign-in button when session fails
    permission_denied: n/a
    feature_disabled: n/a
    offline_or_network_failure: shell renders normally (static)

  layout:
    desktop: top bar (brand + user) + horizontal icon nav
    mobile_375: top bar (brand + compact user) + bottom tab bar (4 routes + More)
    tablet: same as desktop
    keyboard_access: all nav links and buttons are focusable
    focus_management: skip-to-content link preserved
    contrast_notes: accent on paper/surface meets WCAG AA

  specialist_review:
    required_agents:
      - bjt-learner-ui
      - bjt-learning-science
      - bjt-qa
    consulted_agents:
      - bjt-learner-ui (inline)
      - bjt-learning-science (inline)
      - bjt-qa (inline)
    findings:
      - mobile bottom nav with 4+More is clean cognitive pattern
      - no fake data or persistent state in shell
      - all labels use i18n keys

  acceptance_gates:
    - open_design_bjt_ui_gate: pass (calm, icon+label nav, no decoration)
    - bjt_ui_ux_production_gate: pass (responsive, bilingual, accessible)
    - learner_page_production_gate: pass (no fake data, i18n, honest states)

  verification:
    commands:
      - command: pnpm -w exec tsc --noEmit -p apps/web/tsconfig.json
        result: pass (no errors)
      - command: pnpm -w exec tsc --noEmit -p packages/ui/tsconfig.json
        result: pass (no errors)
      - command: pnpm -w exec tsc --noEmit -p apps/admin/tsconfig.json
        result: pass (no errors)
      - command: npx eslint apps/web/app/_components/learner-app-frame.tsx apps/web/app/_components/nav-icons.tsx
        result: pass (no errors)
    browser_routes:
      - route: /vi
        viewport: mobile (~375px embedded browser)
        result: pass — top bar (brand + Đăng nhập), bottom tab bar (4 + More), content renders
      - route: /vi (More button tap)
        viewport: mobile
        result: pass — slide-up sheet with 3 items (Tra cứu, Tiến độ, Cài đặt), icons + labels, backdrop overlay
      - route: /vi/login
        viewport: mobile
        result: pass — chrome hidden, clean login form
      - route: /ja
        viewport: mobile
        result: pass — all nav labels in Japanese (ホーム, BJT, 復習, バトル, その他), skip-to-content localized
    browser_evidence:
      - active_state: accent-mid indicator bar at top of active tab + brighter indigo color
      - more_sheet: opens/closes correctly with backdrop, keyboard dismiss (Escape), outside-click close
      - auth_states: sign-in button visible when unauthenticated, session-checking state handled
      - i18n: all labels localized in both vi and ja
      - a11y: skip-to-content link, aria-label on both nav elements, aria-modal on More sheet
```

## Changes Summary

### Files Created
- `apps/web/app/_components/nav-icons.tsx` — 8 SVG icon components (Home, Quiz, Review, Battle, Search, Analytics, Settings, More)

### Files Modified
- `apps/web/app/_components/learner-app-frame.tsx` — Production-grade redesign:
  - Desktop: horizontal icon+label nav with rounded pill active state
  - Mobile: fixed bottom tab bar (Home, BJT, Review, Battle, More)
  - Mobile More sheet: slide-up overlay for Search, Analytics, Settings
  - User area refactored into separate component
  - Proper safe-area-inset-bottom for iOS
  - backdrop-blur on mobile bottom nav
  - Keyboard dismiss (Escape) and outside-click-close for More sheet
  - Username hidden on mobile to save space
- `apps/web/messages/vi.json` — Added `nav.more: "Thêm"`
- `apps/web/messages/ja.json` — Added `nav.more: "その他"`

### Design Decisions
- 4+More bottom tab bar (industry standard for 7-item nav sets)
- Icons use 1.75px stroke weight for clarity at small sizes
- Active state uses `text-accent-mid` (#4f46e5, bright indigo) + indicator bar at top of active tab
- More sheet has drag indicator + overlay backdrop (`bg-ink/30`)
- No sidebar — keeps the learning space open and focused
- Brand in top bar, not bottom bar (preserves learning focus in bottom tabs)

### Polish Fixes (browser QA)
- Changed active color from `text-accent` (#3730a3, too dark) to `text-accent-mid` (#4f46e5, visually distinct)
- Added accent-mid indicator bar at top of active bottom tab item
- Strengthened More sheet backdrop from `bg-ink/20` to `bg-ink/30`
- Active state in desktop nav and More sheet also uses `accent-mid`
