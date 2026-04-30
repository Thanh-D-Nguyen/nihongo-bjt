# 40 — Phase 08 Quality, Observability, and Release Readiness

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-08 Quality, Observability, and Release Readiness. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/digests/qa_digest.md`, `docs/spec/digests/devops_digest.md`, `docs/spec/digests/red_team_digest.md`, `docs/spec/compact/09_operations_ci_cd.md`, `docs/spec/compact/10_testing_acceptance.md`, and `company/gates/*.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-08`
   - Phase Title: `Quality, Observability, and Release Readiness`
   - `approval_status: pending`
3. Include tasks for:
   - critical controller/integration tests
   - e2e expansion for learner/admin paths
   - CI gate truth and OpenAPI generation
   - health/readiness and env validation
   - observability, backup/restore, dead-letter recovery evidence
   - red-team abuse review
4. Required agents:
   - owners: `bjt-qa`, `bjt-devops`
   - reviewers: `bjt-red-team`, `bjt-release-director`
5. Stop on failing core gates, fake health checks, unverified migrations, or unresolved critical red-team findings.
</instructions>

<definition-of-done>
- CI-equivalent gates are documented and run where feasible.
- Health checks are honest.
- Backup/restore and env validation evidence exists.
- Critical tests cover auth/RBAC/quota/flag/admin audit paths.
- Red-team blockers are resolved or release-blocked.
</definition-of-done>
