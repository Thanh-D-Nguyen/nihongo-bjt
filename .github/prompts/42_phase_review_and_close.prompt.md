# 42 — Phase Review and Close

<context-hint>
Use when a phase implementation is complete or near-complete but has not passed specialist, QA, and Release Director review. For the current repo state, use this before starting PHASE-03.
</context-hint>

<task>
Act as `bjt-boss` coordinating final review for the current PHASE_BATCH. Do not implement new product features.
</task>

<required-reading>
1. `company/TOKEN_BUDGET_PROTOCOL.md`
2. `company/PHASE_REVIEW_PACKET.md`
3. `company/REVIEW_DIFF_PROTOCOL.md`
4. `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`
5. `company/ROLLBACK_PLAYBOOK.md`
6. `company/PHASE_PLAN.md`
7. `company/CURRENT_PHASE.md`
8. `company/PHASE_HANDOFF.md`
9. `company/PHASE_TASK_REPORT.md`
10. `company/PHASE_RISK_LOG.md`
11. relevant `company/gates/*.md`
</required-reading>

<instructions>
1. Identify tasks still awaiting specialist review.
2. Run or simulate the required reviewer passes using their agent files if subagents are unavailable.
3. Apply diff review, no-fake-production gate, visual gate if UI changed, browser phase review gate if phase UI changed, rollback safety gate, and domain rubrics if learning/content/assessment changed.
4. If phase UI changed, run `.github/prompts/48_phase_browser_runtime_review.prompt.md` or record `not_applicable` for backend-only phase.
5. Run only relevant verification commands; do not rerun the whole world unless release gate requires it.
6. Ask `bjt-release-director` for ship/no-ship using `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`.
7. Update `company/CURRENT_PHASE.md`, `company/PHASE_HANDOFF.md`, `company/PHASE_TASK_REPORT.md`, and `company/PHASE_RISK_LOG.md`.
8. If all gates pass, mark current phase `needs_review` -> `completed` and request human decision.
9. If any gate blocks, keep phase `needs_review` or `blocked` and assign fixes.
</instructions>

<decision-gate>
Ask for exactly one decision:
- `APPROVE_PHASE`
- `REQUEST_PHASE_FIXES`
- `REJECT_PHASE`
- `RUN_NEXT_PHASE`
- `RUN_RELEASE_GATE`
</decision-gate>

<avoid>
- Starting the next phase before current phase is reviewed.
- Marking owner implementation as final release approval.
- Treating skipped screenshots/tests as pass.
- Reading the full canonical spec unless required by conflict or release-risk.
</avoid>
