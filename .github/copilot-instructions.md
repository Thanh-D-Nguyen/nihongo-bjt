# GitHub Copilot Instructions — NihonGo BJT AI Company Mode

<context>
This repository is the NihonGo BJT learning platform. It may already contain partial implementation from older specifications. The canonical specification is:

`docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`

If this file exists, it is the single source of truth. If it is missing, stop and ask the user to add it before making architectural changes.

For normal work, do not read the full canonical spec by default. Start from:

1. `docs/spec/index.md`
2. the relevant `docs/spec/digests/*.md`
3. only the required `docs/spec/compact/*.md` files
</context>

<mission>
Operate like a small production software company receiving a partially built product. Preserve useful existing work, identify gaps against the latest v15 spec, and complete the system incrementally to production quality.
</mission>

<non-negotiable-rules>
1. Do not introduce MongoDB/Mongoose.
2. PostgreSQL + Prisma is canonical.
3. Do not rewrite the entire app unless explicitly requested.
4. Do not delete working code without explaining why.
5. Do not create fake-success endpoints or fake production UI.
6. Every placeholder must have a real interface, schema/contract, feature flag, and clear non-production status.
7. Every backend API must have DTO validation, auth/RBAC where needed, OpenAPI docs, tests or documented test gap.
8. Every admin write must be audited.
9. Every premium/quota action must be enforced on backend, not frontend only.
10. Every feature-gated action must be enforced on backend, not frontend only.
11. Keep each change small, reviewable, and runnable.
12. Prefer fixing the foundation before adding feature breadth.
13. Learning experience must support focus, comprehension, retention, or visible progress; avoid distraction loops, fake progress, shame, and manipulative streak/social pressure.
14. Audio, image, video, color, motion, postcards, sharing, and competition must be user-controlled, accessible, privacy-safe, and backed by real data/provider contracts where persistent.
15. Assessment, content, localization, security, and release review must be separated from implementation for high-risk work.
16. Use the fewest agents necessary: default to one implement agent, one specialist reviewer, and one QA/release reviewer.
17. Every work cycle must behave like one production PR: one task, one owner, limited files, verification, risks, and handoff.
18. Respect `company/DO_NOT_TOUCH.md`; protected working areas require explicit scope justification before editing.
19. Life-in-Japan topics such as housing, tax, insurance, pension, lottery, stocks, crypto, and banking must be framed as Japanese/risk-literacy learning, not advice, gambling promotion, or financial product UX.
20. When the human says `approve, tiếp đi`, `boss tiếp tục`, or `run next cycle`, use Boss autopilot mode: execute one full cycle end-to-end, then stop for approval.
21. When running PHASE_BATCH, use `.github/prompts/29_boss_run_phase_batch.prompt.md`; phase prompts numbered 05/06/07 are reserved for database/test/security workflows.
22. Before moving to the next phase, run `.github/prompts/42_phase_review_and_close.prompt.md` and require Release Director evidence for diff/test/security/OpenAPI/no-fake checks.
23. Any large phase must have rollback safety, exact diff review, and no-fake-production audit evidence before approval.
24. Any UI task must load relevant `company/skills/ui-production/` files and pass the relevant UI production gate before being marked production-ready.
25. When the human asks for 24/7 coordination or a proxy to continue toward production, use `bjt-human-proxy` with `.github/prompts/47_human_proxy_production_loop.prompt.md`; never self-approve hard approval boundaries, and do not stop at handoff-only output when `approval_required: no`.
26. If the human explicitly says `DELEGATE_PHASE_APPROVAL_UNTIL_PRODUCTION_READY`, Human Proxy may auto-approve non-release phase boundaries only under `company/HUMAN_DELEGATION_POLICY.md`.
27. If the human explicitly says `DELEGATE_UNATTENDED_UNTIL_PRODUCTION_READY`, Human Proxy may auto-continue safe task/phase checkpoints only under `company/UNATTENDED_RUN_POLICY.md`, still stopping for hard production/high-risk boundaries.
28. In unattended mode, do not ask routine "continue or hold?" checkpoint questions when `approval_required: no`; execute the next safe task/prompt.
29. In unattended mode, do not stop at "agent handoff" for routine owner selection; execute or inline the required owner agent unless a hard stop exists.
30. Any phase that changes user-visible UI must run Browser Phase Review before phase approval, using `bjt-browser-qa` or prompt 48. Browser Phase Review is executable verification, not a human approval boundary; Human Proxy must run or inline it in unattended mode when it is the next safe task.
31. Final production readiness must pass Admin 100% completion: no enabled admin nav item may remain `status: "scaffold"` and no enabled admin route may render `renderAdminScaffoldForId(...)`. If the only remaining Admin 100 blocker is missing browser visual evidence, run `bjt-browser-qa`/prompt 48 instead of stopping for human review.
32. If PHASE-09 is complete but admin scaffolds remain, run `.github/prompts/49_admin_100_completion_audit.prompt.md` and then `.github/prompts/50_admin_100_completion_phase.prompt.md` before any launch decision.
33. Learner-facing UI must pass BJT-specific UI/UX review: focused learning intent, Japanese readability, cognitive-load control, remediation, mobile usability, accessibility, and no distracting media/social pressure.
34. Coding agents must apply Karpathy-style production behavior: surface material assumptions, prefer simple vertical slices, make surgical diffs, and define verifiable success criteria before changing files.
35. UI agents must apply the Open Design BJT adaptation: design-system first, pre-flight skill/gate loading, anti AI-slop review, and five-dimension critique before marking admin or learner UI production-ready.
</non-negotiable-rules>

<canonical-paths>
- CANONICAL_SPEC_PATH: `nihongo_bjt_cursor_master_spec_final_completed_v2.md`
- SPEC_INDEX: `docs/spec/index.md`
- SPEC_COMPACT: `docs/spec/compact/`
- SPEC_DIGESTS: `docs/spec/digests/`
- MODEL_ROUTING: `company/model-routing.md`
- OPERATING_MODE: `company/OPERATING_MODE.md`
- AUTOPILOT_MODE: `company/AUTOPILOT_MODE.md`
- AUTOPILOT_STATE: `company/AUTOPILOT_STATE.md`
- HUMAN_PROXY_MODE: `company/HUMAN_PROXY_MODE.md`
- HUMAN_DELEGATION_POLICY: `company/HUMAN_DELEGATION_POLICY.md`
- UNATTENDED_RUN_POLICY: `company/UNATTENDED_RUN_POLICY.md`
- BROWSER_PHASE_REVIEW_POLICY: `company/BROWSER_PHASE_REVIEW_POLICY.md`
- ADMIN_COMPLETION_PROGRAM: `company/ADMIN_COMPLETION_PROGRAM.md`
- ADMIN_MODULE_INVENTORY: `company/admin-module-inventory.md`
- ADMIN_100_COMPLETION_GATE: `company/gates/admin-100-completion-gate.md`
- CURRENT_CYCLE: `company/CURRENT_CYCLE.md`
- CURRENT_PHASE: `company/CURRENT_PHASE.md`
- PHASE_PLAN: `company/PHASE_PLAN.md`
- PHASE_ROADMAP: `company/PHASE_ROADMAP.md`
- PHASE_TASK_REPORT: `company/PHASE_TASK_REPORT.md`
- PHASE_REVIEW_PACKET: `company/PHASE_REVIEW_PACKET.md`
- TOKEN_BUDGET_PROTOCOL: `company/TOKEN_BUDGET_PROTOCOL.md`
- REVIEW_DIFF_PROTOCOL: `company/REVIEW_DIFF_PROTOCOL.md`
- ROLLBACK_PLAYBOOK: `company/ROLLBACK_PLAYBOOK.md`
- RELEASE_DIRECTOR_REVIEW_PROTOCOL: `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`
- UI_PRODUCTION_SKILLS: `company/skills/ui-production/`
- BJT_UI_UX_SKILLS: `company/skills/bjt-ui-ux/`
- AGENT_QUALITY_SKILLS: `company/skills/agent-quality/`
- OPEN_DESIGN_BJT_SKILLS: `company/skills/open-design-bjt/`
- OPEN_DESIGN_BJT_UI_GATE: `company/gates/open-design-bjt-ui-gate.md`
- BJT_UI_UX_DESIGN_STANDARD: `docs/design/bjt-ui-ux-production-standard.md`
- UI_PRODUCTION_GATE: `company/gates/ui-production-gate.md`
- BJT_UI_UX_PRODUCTION_GATE: `company/gates/bjt-ui-ux-production-gate.md`
- ADMIN_PAGE_PRODUCTION_GATE: `company/gates/admin-page-production-gate.md`
- LEARNER_PAGE_PRODUCTION_GATE: `company/gates/learner-page-production-gate.md`
- BROWSER_PHASE_REVIEW_GATE: `company/gates/browser-phase-review-gate.md`
- ADMIN_100_COMPLETION_AUDIT_PROMPT: `.github/prompts/49_admin_100_completion_audit.prompt.md`
- ADMIN_100_COMPLETION_PHASE_PROMPT: `.github/prompts/50_admin_100_completion_phase.prompt.md`
- BJT_UI_UX_REVIEW_PROMPT: `.github/prompts/51_bjt_ui_ux_production_review.prompt.md`
- DO_NOT_TOUCH: `company/DO_NOT_TOUCH.md`
- ONE_TASK_ONE_PR: `company/ONE_TASK_ONE_PR.md`
- COMPANY_STATE: `company/PROJECT_STATE.md`
- BACKLOG: `company/COMPANY_BACKLOG.md`
- SPRINT_BOARD: `company/SPRINT_BOARD.md`
- DECISION_LOG: `company/DECISION_LOG.md`
- HANDOFF: `company/AGENT_HANDOFF.md`
- COMPILED_PROTOCOLS: `protocols/compiled-protocols.md`
</canonical-paths>

<execution-style>
- Start by reading relevant files only.
- Use progressive context digest instead of re-reading huge docs repeatedly.
- Pick exactly one task per cycle.
- Treat each cycle as one production PR.
- Update `company/CURRENT_CYCLE.md` when Boss selects a task.
- Stop after one completed task and write handoff when files, migrations, tests, API contracts, security, or RBAC changed.
- In autopilot mode, do not stop at delegation; run owner/reviewer/QA passes and then stop at human approval checkpoint.
- In Human Proxy mode, select the next safe Boss prompt/action and stop at hard approval boundaries.
- In PHASE_BATCH mode, continue task-by-task only within approved phase scope and budget; update `PHASE_TASK_REPORT.md` after each task.
- Do not mark a phase completed until specialist reviews, diff review, no-fake audit, rollback-safety review, and Release Director review are recorded.
- Do not mark final production-ready until Admin 100 completion gate passes or Release Director explicitly returns no_ship with admin blockers.
- Do not mark learner UI production-ready until the BJT UI/UX production gate passes or blockers are recorded.
- For large work, first create/update plan docs, then implement.
- For every code change, update related docs/tests when applicable.
- Before editing code, name the working assumption, acceptance criteria, and verification path for the current slice.
- Keep diffs surgical: no drive-by refactors, no adjacent cleanup, no speculative abstraction.
- For UI work, record the design direction, reused tokens/components, state coverage, and five-dimension critique result.
- After implementation, report exact files changed and commands run.
</execution-style>

<token-budget-guidelines>
- Do not paste huge files in chat.
- Summarize large documents into 10–20 line digests.
- Keep final reports compact but evidence-based.
- Prefer tables only when they reduce ambiguity.
- Avoid repeating common protocol boilerplate; reference `protocols/compiled-protocols.md`.
- Use `company/TOKEN_BUDGET_PROTOCOL.md` for large phases and review runs.
</token-budget-guidelines>

<context-budget-rules>
Do not read the full canonical spec by default.

Default context loading:
1. Read `docs/spec/index.md`.
2. Read the relevant digest from `docs/spec/digests/`.
3. Read only the compact spec files required for the current task.
4. Read the full canonical spec only when:
   - compact spec is ambiguous
   - requirements conflict
   - doing architecture/security/release gate
   - Boss Agent explicitly asks for full-spec verification

Never paste large spec sections into chat when a file reference is enough.

Prefer producing:
- file paths
- short status
- exact next actions
- diffs/patches
- checklists

Avoid producing:
- long repeated summaries
- duplicated spec text
- verbose logs
</context-budget-rules>

<model-aliases>
- cheap-fast: fastest/cheapest available model for low-risk repetitive edits.
- balanced: default high-quality model for normal UI/service/doc work.
- code-heavy: best available coding/agentic model for implementation and tests.
- deep-reasoning: strongest reasoning model for planning, architecture, gap analysis, and release gates.
- review-security: best reasoning model with a security-focused prompt.

Read `company/model-routing.md` for routing rules and escalation criteria.
</model-aliases>

<required-output-contract>
Every agent response that changes or plans work must include:

```yaml
status: completed | partial | blocked | needs-review
scope: short description
files_changed:
  - path
commands_run:
  - command: result
risks:
  - risk or none
next_agent: recommended next agent
next_action: concrete next step
```
</required-output-contract>
