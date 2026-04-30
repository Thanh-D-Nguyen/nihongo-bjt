# 38 — Phase 06 Monetization, Legal, and Privacy

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-06 Monetization, Legal, and Privacy. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/compact/07_security_privacy.md`, `docs/spec/compact/08_monetization.md`, `docs/spec/compact/10_testing_acceptance.md`, `docs/spec/digests/red_team_digest.md`, and `company/gates/growth-ethics-gate.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-06`
   - Phase Title: `Monetization, Legal, and Privacy`
   - `approval_status: pending`
3. Include tasks for:
   - entitlement/quota route-by-route enforcement
   - local billing/ad providers and admin management
   - legal policy versions and consent records
   - privacy export/delete baseline
   - billing/webhook safety if provider endpoints exist
   - red-team review for premium bypass and privacy leaks
4. Required agents:
   - owner: `bjt-backend`
   - reviewers: `bjt-security`, `bjt-red-team`, `bjt-release-director`
5. Stop on frontend-only paywall, fake premium unlock, missing consent persistence, or unsafe webhook behavior.
</instructions>

<definition-of-done>
- Entitlements and quotas are backend-enforced.
- Legal/consent records are persisted.
- Ads are placement/config-driven and learning-safe.
- Privacy export/delete has a real contract.
- Red-team bypass risks are addressed or tracked.
</definition-of-done>
