# 07 — Security / Privacy / Legal Hardening

<context-hint>
Use after core APIs exist or before production release gate.
</context-hint>

<task>
Act as `bjt-security`. Harden security, privacy, upload, SSRF, malware scan, and consent flows.
</task>

<instructions>
1. Read `docs/spec/index.md`, `docs/spec/compact/07_security_privacy.md`, `docs/spec/compact/04_admin_rbac.md`, `docs/spec/compact/08_monetization.md` if billing/ad privacy is in scope, and `docs/spec/compact/10_testing_acceptance.md`.
2. Inspect auth/RBAC, upload, external fetch, billing webhook, legal/consent code.
3. Pick one risk area only.
4. Implement minimal production-safe hardening.
5. Add tests.
6. Update security docs.
</instructions>

<risk-areas>
- Auth/RBAC backend enforcement
- Admin audit logging
- Upload validation
- MalwareScanProvider
- SSRF protection
- Secrets/env validation
- Legal/consent recording
- Privacy export/delete scaffold
- Billing webhook signature/idempotency
</risk-areas>
