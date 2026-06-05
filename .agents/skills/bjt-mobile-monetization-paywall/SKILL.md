---
name: bjt-mobile-monetization-paywall
description: Implement, audit, or polish monetization in the Nihongo BJT Flutter mobile app \u2014 server-enforced entitlements, quotas, plan/upgrade screens, gated-feature messaging, quota state, and config-driven ads \u2014 with no frontend-only paywall logic, no dark patterns, and no ads that interrupt core learning. Use whenever a feature is premium/quota-gated, when building subscription/upgrade surfaces, or when placing ads.
---

# BJT Mobile Monetization & Paywall Skill

Use this skill when implementing, auditing, or polishing monetization, paywalls,
entitlements, quotas, ads, and upgrade UX in the mobile app. Follow the
`bjt-mobile-foundation-quality-gate` baseline; this skill adds monetization
specifics.

## Goal

Gate premium/quota features correctly and respectfully, with the **backend as
the only source of enforcement**, while keeping upgrade UX honest and calm.

## Core principle

The server decides entitlement and quota. The client only **reflects** server
state and routes the user to upgrade. Never gate on the client alone.

## Hard rules

- No hardcoded `isPremium` / role checks scattered in widgets. Read entitlement
  and quota from the centralized server contract via a single provider.
- No frontend-only paywall: a gated action must be enforced server-side; the
  client shows the gate, never grants access locally.
- No fake premium badge, fake plan, fake quota numbers, or fake "unlocked".
- No dark patterns: no fake scarcity, no trick buttons, no hidden cancel, no
  guilt copy. Upgrade is opt-in and clearly explained.
- Quota state shown only from the server contract (used/limit/reset).
- Do not store payment data or credentials. Use the billing provider
  abstraction; restore-purchase only if native billing actually supports it.
- Respect exam/learning focus: do not interrupt active study/exam with upgrade
  prompts.
- Keep VI/JA localization in sync. Support light/dark, 360–390 dp. Add/update
  tests.

## Ads rules (if ads are in scope)

- Ads are **placement/config/provider-driven** from the server, not hardcoded.
- Ads must **never interrupt core learning flows** (active study, practice,
  exam, review, battle). No ads on focused session screens.
- Entitled/premium users see no ads when their entitlement says so (server-driven).
- Use the ad provider behind an abstraction; a local/dev provider is acceptable
  when no real ad key is configured — never a fake ad styled as content.
- Respect consent/privacy settings before serving personalized ads.

## Required audit before coding

Inspect:
- web entitlement/quota/plan/subscription/billing APIs, hooks, models, and where
  the web enforces gating
- the monetization enforcement matrix docs (`docs/MONETIZATION_*`)
- mobile billing/subscription providers, entitlement provider (if any), router
  guards, l10n, tokens, tests

Create/update:
- `docs/mobile/MONETIZATION_WEB_PARITY_AUDIT.md`
- `docs/mobile/MONETIZATION_ENTITLEMENT_CONTRACT.md`
- `docs/mobile/MONETIZATION_IMPLEMENTATION_PLAN.md`

## Required surfaces

1. Centralized entitlement/quota provider (single read point).
2. Gate component: respectful upgrade message + clear CTA when a feature is
   locked or quota is exhausted; honest quota-remaining display.
3. Plans/subscription screen: real plans, current plan, manage/upgrade entry,
   loading/empty/error states.
4. Quota-aware affordances on gated features (disabled with reason, not silent).
5. Post-purchase / entitlement-refresh handling that re-reads server state.

## Required tests

- locked feature shows gate, not content
- quota-exhausted state from server contract
- entitled user sees content (server-confirmed)
- no `isPremium` literal drives access in widget tests
- plans screen loading/populated/error
- upgrade CTA navigates; no dead button
- dark mode, 360 dp, long VI/JA copy

## Verification

`cd apps/mobile && flutter analyze` · `flutter test` · `git diff --check`.
Stop if red. Report files changed and how server-side enforcement was verified
(or documented as runtime-blocked with proof).
