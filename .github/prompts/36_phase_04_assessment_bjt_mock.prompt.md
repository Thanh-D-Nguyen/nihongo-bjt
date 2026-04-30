# 36 — Phase 04 Assessment and BJT Mock

<task>
Act as `bjt-boss`. Prepare `company/PHASE_PLAN.md` for PHASE-04 Assessment and BJT Mock. Do not implement until human approval.
</task>

<instructions>
1. Read `docs/spec/digests/assessment_psychometrics_digest.md`, `docs/spec/digests/learner_ui_digest.md`, `docs/spec/compact/03_backend_api_registry.md`, `docs/spec/compact/06_learner_ui_modules.md`, and `company/gates/assessment-quality-gate.md`.
2. Create/update `company/PHASE_PLAN.md`:
   - Phase ID: `PHASE-04`
   - Phase Title: `Assessment and BJT Mock`
   - `approval_status: pending`
3. Include tasks for:
   - quiz/session/result API hardening
   - estimated BJT score/band wording
   - item metadata validation: skill, difficulty, explanation, answer, remediation
   - timed exam integrity
   - mock exam blueprint evidence
   - assessment analytics and low-quality item flags
4. Required agents:
   - owners: `bjt-backend`, `bjt-learner-ui`
   - reviewers: `bjt-assessment-psychometrics`, `bjt-learning-science`, `bjt-qa`
5. Stop on official-score wording, fake attempts, untagged production questions, or missing correct answers.
</instructions>

<definition-of-done>
- Scoring is clearly estimated.
- Questions have required metadata.
- Timed mode is protected.
- Wrong answers map to remediation.
- Assessment quality gate has evidence.
</definition-of-done>
