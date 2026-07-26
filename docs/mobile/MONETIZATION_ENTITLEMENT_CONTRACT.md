# Monetization entitlement contract

## Server authority

Clients may provide placement, locale, device, and learning-context metadata.
They must not decide plan eligibility, ad suppression, campaign eligibility, or
personalization locally.

## Anonymous audience

- Omit `userId` and the Authorization header when no session exists.
- The API resolves the viewer as plan `free`.
- A supplied anonymous `userId` is rejected.
- Anonymous personalized ads are ineligible.
- Impression/click calls require the short-lived signed `decisionToken` returned
  by the decision endpoint. Tokens bind the campaign, placement, and anonymous
  or authenticated subject.

## Authenticated audience

- Identity comes from the verified Bearer token.
- Any body `userId` must match that identity.
- `ads.remove` blocks all managed ads.
- `ads.reduced` blocks placements under the current reduced-ad policy.
- Client-provided plan hints are ignored.

## Learning safety

Clients must send the active session kind. `flashcard_review`, `bjt_timed`, and
`quiz_active` are protected learning contexts and must not render ads even if a
campaign is otherwise eligible.

Production API deployments must set a unique 32+ character
`ADS_DECISION_SIGNING_SECRET`. Rotate it as a server secret; never expose it to
web/mobile clients.
