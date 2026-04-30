# Compact Spec 08: Monetization

## Canonical references

Full spec sections: 26, 31.3-31.8.

## Product decision

Build monetization-ready architecture early, but do not over-integrate external providers before the core product is stable.

## Required models

Support:
- plans
- entitlements
- quotas
- subscriptions
- usage records/counters
- ad placements/config/provider config
- billing events
- webhook events/dead letters
- provider abstractions
- admin analytics/rollups

## Enforcement

- Premium/feature-gated actions must be enforced server-side.
- Quotas must be checked and recorded server-side.
- Frontend upgrade UX is presentation only.
- No scattered `isPremium` logic.
- No frontend-only paywall enforcement.

## Providers

- Local/dev billing provider is allowed behind interface.
- External providers must use provider abstractions and idempotent event handling.
- Webhooks require signature verification, replay protection/idempotency, dead-letter handling, and audit/observability.

## Ads

- Ads are placement/config/provider-driven.
- Ads must not interrupt core learning flows.
- Consent and privacy rules apply.
- Ad display depends on plan/entitlement.

## Admin

Admin must manage:
- plans
- entitlements
- quotas
- subscriptions
- usage
- ad placements
- billing/webhook events
- monetization analytics

Admin writes require RBAC and audit.

## Commerce/legal

Commerce surfaces need refund/cancellation policy, invoices/receipts, Japanese commerce law requirements where applicable, and payment failure/grace-period handling.

## Entitlement checklist

For each gated feature:
- define entitlement key
- define plan mapping
- define quota if limited
- enforce server-side
- return clear denial reason
- expose respectful UI state from backend response
- record usage when action succeeds

## Quota checklist

Quota logic should define:
- unit
- reset window
- hard/soft limit
- grace behavior
- idempotency behavior
- admin override behavior
- analytics event/rollup

## Billing event checklist

Billing event handling needs:
- provider name
- provider event ID
- signature verification result
- idempotency key
- mapped internal action
- success/failure state
- dead-letter path
- audit/observability

## Ad placement checklist

Each placement should define:
- placement key
- provider config
- eligible routes/surfaces
- plan suppression rules
- consent requirements
- frequency/capping rules where applicable
- no interruption of core learning flows

## Review questions

- Can the user bypass the gate by editing frontend state?
- Is the free/paid state derived from backend entitlements?
- Are failed webhooks retryable and inspectable?
- Are finance/admin permissions separated from normal admin roles?
