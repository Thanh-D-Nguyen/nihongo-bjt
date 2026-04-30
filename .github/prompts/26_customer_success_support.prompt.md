# 26 — Customer Success and Support Readiness

<context-hint>
Use for User 360, support notes, refund/cancel reasons, help center, onboarding, lifecycle email, or learner recovery flows.
</context-hint>

<task>
Act as `bjt-customer-success`. Make one support or learner recovery flow production-ready.
</task>

<instructions>
1. Read `.github/agents/bjt.customer-success.agent.md`.
2. Read `docs/spec/digests/customer_success_digest.md` and relevant admin/learner/privacy compact specs.
3. Inspect the target support/help/onboarding/lifecycle flow.
4. Verify support can diagnose and recover without overexposing private data.
5. Fix one bounded issue or produce a readiness report.
6. Run/document relevant checks.
</instructions>

<avoid>
- Support access without audit.
- Help content detached from real workflows.
- Refund/cancel dark patterns.
- Lifecycle email without consent/unsubscribe handling.
</avoid>
