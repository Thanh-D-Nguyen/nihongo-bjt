# 35 — Phase 03 Learning, SRS, and Reading Assist

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-03 Learning, SRS, and Reading Assist. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/digests/learner_ui_digest.md`, `docs/spec/digests/learning_science_digest.md`, `docs/spec/compact/06_learner_ui_modules.md`, `docs/spec/compact/10_testing_acceptance.md`, `docs/spec/compact/11_learning_effectiveness_experience.md`, and `company/gates/learning-quality-gate.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-03`
   - Phase Title: `Learning, SRS, and Reading Assist`
   - `approval_status: pending`
3. Include tasks for:
   - deck/card/review canonical completion
   - SRS scheduler tests and leech/remediation handling
   - Reading Assist reusable component/API/cache/preferences slice
   - learner progress and comeback mode evidence
   - learner UI loading/error/empty/offline states
4. Required agents:
   - owners: `bjt-backend`, `bjt-learner-ui`
   - reviewers: `bjt-learning-science`, `bjt-content-quality`, `bjt-qa`
5. Stop on fake progress, local-only persistence, or exam-mode reading assist leak.
</instructions>

<definition-of-done>
- Reviews and progress are persisted.
- SRS behavior has tests.
- Reading Assist is reusable and exam-safe.
- Mistakes lead to remediation.
- Learner copy uses i18n and avoids shame.
</definition-of-done>
