# Monetization web parity audit

## Scope

This audit covers the managed-ad runtime used by the learner web app and the
contract mobile clients should reuse. PostgreSQL placement/campaign data and
server-side entitlement decisions remain the source of truth.

## Current parity

- Public web surfaces can request `POST /api/ads/decision` without a session.
- Anonymous viewers are evaluated as the `free` audience and are never trusted
  to supply a user id or plan.
- Authenticated viewers keep server-resolved `ads.remove` and `ads.reduced`
  suppression.
- Impression and click events accept optional authentication; anonymous rows
  persist with `userId = null`.
- Personalized placements still require an authenticated profile with explicit
  personalization opt-in.
- Active quiz, timed BJT, and flashcard-review contexts remain ad-free.

## Mobile gap

The mobile app should not add ad placements until it consumes the same decision,
impression, and click contract and passes the learning-context safety value.
There is intentionally no mobile-only entitlement or client-side plan override.
