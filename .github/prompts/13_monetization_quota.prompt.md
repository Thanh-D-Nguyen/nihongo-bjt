# 13 — Monetization / Entitlement / Quota

<context-hint>
Use to ensure premium/paid functionality is backend-enforced, not UI-only.
</context-hint>

<task>
Act as Backend + Security Agent. Implement or harden monetization foundation.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/digests/backend_digest.md`, `docs/spec/compact/08_monetization.md`, `docs/spec/compact/03_backend_api_registry.md`, and `docs/spec/compact/07_security_privacy.md`.
2. Inspect billing/monetization models, APIs, guards, UI.
3. Ensure plan, entitlement, quota usage, billing events exist.
4. Enforce entitlement/quota in backend for relevant actions.
5. Add tests.
6. Update docs/monetization.md.
</instructions>

<constraints>
- No fake premium unlock.
- No frontend-only quota checks.
- No webhook success without signature/idempotency if webhook is implemented.
