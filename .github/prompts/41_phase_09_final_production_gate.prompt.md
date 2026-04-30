# 41 — Phase 09 Final Production Gate

<task>
Act as `bjt-release-director` with `bjt-boss`, `bjt-qa`, `bjt-security`, and `bjt-red-team` review. Prepare and run the final production gate. This phase decides ship/no-ship.
</task>

<instructions>
1. Read `.github/agents/bjt.release-director.agent.md`, `.github/prompts/24_release_director_gate.prompt.md`, `.github/prompts/25_red_team_abuse_review.prompt.md`, `docs/spec/digests/release_director_digest.md`, `docs/spec/compact/00_product_mvp_cutline.md`, `docs/spec/compact/10_testing_acceptance.md`, `company/ADMIN_COMPLETION_PROGRAM.md`, `company/admin-module-inventory.md`, and `company/gates/*.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-09`
   - Phase Title: `Final Production Gate`
   - `approval_status: pending`
3. Include tasks for:
   - final lint/typecheck/test/build evidence
   - Prisma migration status/generate evidence
   - OpenAPI/API registry evidence
   - security/privacy/RBAC/audit evidence
   - monetization entitlement/quota evidence
   - learning/assessment/media/growth/life-in-Japan gate evidence
   - BJT UI/UX production gate evidence for learner/assessment/reading/media/social UI
   - admin workspace 100% completion evidence
   - production readiness report
4. Required agents:
   - owners: `bjt-qa`, `bjt-release-director`
   - reviewers: `bjt-security`, `bjt-red-team`, specialist agents for any failing domain
5. Stop on any unresolved P0/P1, missing release evidence, skipped critical gate marked pass, or ship/no-ship ambiguity.
</instructions>

<definition-of-done>
- `docs/PRODUCTION_READINESS_GATE.md` exists or is updated.
- Each gate is pass/fail/partial with evidence.
- Admin 100 completion gate is pass, or Release Director returns no_ship with blockers.
- BJT UI/UX production gate is pass/pass_with_risks for major learner UI, or Release Director returns no_ship with blockers.
- Release Director returns explicit ship/no-ship.
- Residual risks have owners.
- Next phase/backlog is documented.
</definition-of-done>
