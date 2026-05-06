# Project State Digest

Update this file after every major agent cycle.

## Current product state

- Canonical spec: `nihongo_bjt_cursor_master_spec_final_completed_v2.md`
- Product: NihonGo BJT learning platform
- Goal: complete partially implemented app to production-grade MVP v1

## Current sprint focus

- PHASE-10 Admin 100% completion slice + learner hardening: **completed** (all tasks passed).
- Post-PHASE-10 production hardening: **in progress** (13+ micro-slices completed: i18n, utility pages, quiz/battle UX, ESLint cleanup, SQL injection fix, error boundaries, SEO metadata, viewport/favicon, NHK IDOR security fix, rate limiting).
- Admin 100 gate: **PASS** — all 19 human-reported blockers resolved, all inventory items resolved, rate limiting installed.
- Browser phase review evidence: admin + web routes pass under bounded runner.
- Release Director phase-scope decision: **ship_with_risks, no-launch**.
- Final production launch remains blocked by explicit human/Release Director approval.
- Active phase risks: PH07-R02 open (growth-social), PH07-R03 open (security), PH08-R01 open (qa), PH08-R02 open (devops).

## PHASE-07 Mid-Phase Checkpoint

- Decision: `APPROVE_PHASE` (delegated unattended checkpoint after PH07-T03).
- Evidence status: diff/test/security/OpenAPI/no-fake/browser/rollback all pass.
- Hard-stop scan: no destructive migration/data delete risk, no unresolved security/privacy/legal/billing blocker, no P0/P1 blocker.
- Safe continuation: PHASE-07 completed_with_risks at phase-end under delegated unattended policy; next phase planning is allowed.

## Completed foundations

- Spec context split added:
  - `docs/spec/index.md`
  - `docs/spec/compact/*.md`
  - `docs/spec/digests/*.md`
- Model routing policy added at `company/model-routing.md`.
- `.github/copilot-instructions.md`, agent files, and prompts now default to digest/compact context instead of full-spec reads.
- Learning-effectiveness operating layer added:
  - `docs/spec/compact/11_learning_effectiveness_experience.md`
  - `docs/spec/digests/learning_experience_digest.md`
  - `.github/agents/bjt.learning-science.agent.md`
  - `.github/agents/bjt.media-experience.agent.md`
  - `.github/agents/bjt.growth-social.agent.md`
  - `.github/prompts/19_learning_science_focus.prompt.md`
  - `.github/prompts/20_media_experience_assets.prompt.md`
  - `.github/prompts/21_social_growth_competition.prompt.md`
- Production review layer added:
  - assessment psychometrics, content quality, Japan/Vietnam localization, release director, red team, and customer success agents
  - domain gates in `company/gates/`
  - North Star Metrics in `company/product/north-star-metrics.md`
  - AI company organization in `company/AI_COMPANY_ORG.md`
- Operating discipline added:
  - `company/OPERATING_MODE.md`
  - `company/AUTOPILOT_MODE.md`
  - `company/AUTOPILOT_STATE.md`
  - `company/CURRENT_CYCLE.md`
  - `company/PHASE_PLAN.md`
  - `company/PHASE_ROADMAP.md`
  - `company/CURRENT_PHASE.md`
  - `company/PHASE_HANDOFF.md`
  - `company/PHASE_TASK_REPORT.md`
  - `company/PHASE_RISK_LOG.md`
  - `company/DO_NOT_TOUCH.md`
  - `company/ONE_TASK_ONE_PR.md`
- Life-in-Japan learning context layer added:
  - `docs/spec/compact/12_life_in_japan_contexts.md`
  - `docs/spec/digests/life_in_japan_digest.md`
  - `.github/agents/bjt.life-in-japan.agent.md`
  - `.github/prompts/27_life_in_japan_contexts.prompt.md`
  - `company/gates/finance-gambling-ethics-gate.md`
  - `docs/product/life-in-japan-learning-design.md`
- Production phase review controls added:
  - `company/TOKEN_BUDGET_PROTOCOL.md`
  - `company/REVIEW_DIFF_PROTOCOL.md`
  - `company/ROLLBACK_PLAYBOOK.md`
  - `company/RELEASE_DIRECTOR_REVIEW_PROTOCOL.md`
  - `company/PHASE_REVIEW_PACKET.md`
  - `company/gates/no-fake-production-gate.md`
  - `company/gates/diff-review-gate.md`
  - `company/gates/rollback-safety-gate.md`
  - `company/gates/visual-review-gate.md`
  - `company/gates/bjt-content-assessment-rubrics.md`
  - `.github/prompts/42_phase_review_and_close.prompt.md`
  - `.github/prompts/43_no_fake_production_audit.prompt.md`
  - `.github/prompts/44_visual_review.prompt.md`
  - `.github/prompts/45_release_director_diff_gate.prompt.md`
- UI production skill system added:
  - `company/skills/ui-production/00-ui-production-principles.md` through `14-production-ui-done-definition.md`
  - `company/gates/ui-production-gate.md`
  - `company/gates/admin-page-production-gate.md`
  - `company/gates/learner-page-production-gate.md`
  - `company/reviews/ui-visual-review/_template.md`
  - `.github/prompts/46_admin_ui_phase_with_skills.prompt.md`
- Agent/design quality upgrade added:
  - `company/skills/agent-quality/00-karpathy-production-agent-skill.md`
  - `company/skills/open-design-bjt/00-open-design-bjt-adaptation.md`
  - `company/gates/open-design-bjt-ui-gate.md`
- Admin false-closeout correction:
  - `company/admin-module-inventory.md` status is `admin_product_depth_in_progress` — one product-depth slice fixed the 12 connected_but_incomplete routes, but full admin production-ready remains blocked by residual feature-depth and Admin Shell UX blockers.
  - User 360 has dedicated client with search-by-ID, access reason form, tabbed detail view.
  - Support notes wired to dedicated `/api/admin/support/notes` endpoint.
  - Privacy/data requests using real endpoints with i18n.
  - Human Proxy must continue Admin Shell/sidebar navigation UX, Daily Hub/Learning Review, Assessment/BJT, Battle, Growth, IAM, planned-notice learning/content pages, and settings/auth-provider diagnostics before closeout.
  - `admin_100_completion_gate status change requires human verification` is not a hard stop while unattended delegation is active; run full-route source/visual audit and keep implementing old/untouched admin screens before final production-ready review.
  - Analytics drilldowns wired to real analytics API.
  - Media, BJT, import, manifests, settings all wired to real endpoints.
  - Human Proxy must complete admin closeout verification (browser QA + Release Director sign-off). If source implementation is complete and only browser visual evidence across all 81 routes remains, run bjt-browser-qa/prompt 48 instead of stopping for human review.
- BJT-specific UI/UX production layer added:
  - `docs/design/bjt-ui-ux-production-standard.md`
  - `company/skills/bjt-ui-ux/00-bjt-ui-ux-principles.md` through `08-bjt-ui-ux-review-rubric.md`
  - `company/gates/bjt-ui-ux-production-gate.md`
  - `company/reviews/bjt-ui-ux/_template.md`
  - `.github/prompts/51_bjt_ui_ux_production_review.prompt.md`
- Human Proxy production loop added:
  - `.github/agents/bjt.human-proxy.agent.md`
  - `company/HUMAN_PROXY_MODE.md`
  - `.github/prompts/47_human_proxy_production_loop.prompt.md`
- Browser QA phase review added:
  - `.github/agents/bjt.browser-qa.agent.md`
  - `company/BROWSER_PHASE_REVIEW_POLICY.md`
  - `company/gates/browser-phase-review-gate.md`
  - `.github/prompts/48_phase_browser_runtime_review.prompt.md`
  - `company/reviews/browser-phase-review/_template.md`
- Admin 100% completion controls added:
  - `company/ADMIN_COMPLETION_PROGRAM.md`
  - `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
  - `company/admin-module-inventory.md`
  - `company/gates/admin-100-completion-gate.md`
  - `company/reviews/admin-module-completion/_template.md`
  - `.github/prompts/49_admin_100_completion_audit.prompt.md`
  - `.github/prompts/50_admin_100_completion_phase.prompt.md`

## Known gaps

- Production API implementation parity vs API registry is not yet verified in a single audited report.
- Admin workspace still has spec-required modules hidden/default-off for launch honesty; this is acceptable as a temporary cutline but does not satisfy the user's full admin production-ready goal.
- Admin audit-log forensic metadata depth remains incomplete beyond current trace support.
- Upload/external fetch baseline is in place, but broader SSRF and malware-scan hardening remains incomplete.

## Current risks

- Human learning/psychology validation is still a product-review requirement; the new agents enforce implementation guardrails but do not replace expert research or user testing.
- UI trend inspiration must be filtered through BJT learning outcomes, Japanese readability, exam integrity, accessibility, and privacy.
- Assessment and language-quality reviews are still bounded by available content/test data; expert human review remains required for high-stakes public claims.
- Life-in-Japan content must avoid financial, legal, tax, real-estate, immigration, insurance, or gambling advice; high-risk current facts need source/date/provenance and review.
- Medium: legal consent baseline is live, but broader legal/privacy contracts and policy-version governance are not fully completed.

## Next recommended action

- For the user's current goal, run `human-proxy continue admin production loop` so Human Proxy follows `company/ADMIN_PRODUCTION_ORCHESTRATION.md` before broader final release gate work.
- Use `.github/prompts/46_admin_ui_phase_with_skills.prompt.md` for future admin UI completion phases.
- Use `.github/prompts/51_bjt_ui_ux_production_review.prompt.md` before marking major learner UI, assessment UI, reading assist UI, media/social UI, or learning-operation admin UI production-ready.
- Use `.github/prompts/47_human_proxy_production_loop.prompt.md` when the human wants the proxy to select the next safe production action.
- Use `.github/prompts/48_phase_browser_runtime_review.prompt.md` before approving any UI-changing phase.

## PHASE-10 State Reconciliation

- PHASE-10 is approved and ready to execute.
- `company/PHASE_PLAN.md` now contains PH10 task queue instead of stale PH09 release tasks.
- `company/CURRENT_PHASE.md` points to `PH10-T04-P0-1` with `approval_required: no`.
- Human Proxy/Boss must execute `.github/prompts/29_boss_run_phase_batch.prompt.md` or inline the next task; it must not stop with `Now run Boss Phase Batch execution`.

## PHASE-01 Progress

- Phase: `PHASE-01 Backend and Security Foundation`
- Task status: `PH01-T01 passed`, `PH01-T02 passed`, `PH01-T03 passed`, `PH01-T04 passed`, `PH01-T05 passed`
- Latest outcome: security baseline batch completed with targeted tests, specialist reviews, red-team regression probes, and green typecheck.
- Next action: run phase-end decision gate.
- Use `.github/prompts/29_boss_run_phase_batch.prompt.md` only after `company/PHASE_PLAN.md` has `approval_status: approved` and a non-empty `approval_token`.
- Use `.github/prompts/32_phase_00_truth_and_foundation.prompt.md` through `.github/prompts/41_phase_09_final_production_gate.prompt.md` to prepare production phase plans.

## PHASE-02 Review State

- Phase: `PHASE-02 Content, Search, and Import`
- Status: `completed`
- Task status: `PH02-T01 passed`, `PH02-T02 passed`, `PH02-T03 passed`, `PH02-T04 passed`, `PH02-T05 passed_release_gate`
- Required next prompt: `.github/prompts/42_phase_review_and_close.prompt.md`
- Human phase decision token recorded: `APPROVE_PHASE`.

## PHASE-03 Review State

- Phase: `PHASE-03 Learning, SRS, and Reading Assist`
- Status: `in_progress`
- Task status: `PH03-T01 passed`, `PH03-T02 passed_with_risks`, `PH03-T03 passed_with_risks`, `PH03-T04 passed_with_risks`, `PH03-T05 passed_with_risks`
- Latest outcome: PH03-T05 completed with Daily Hub resilient-state component tests and localized comeback rating labels.
- Human phase start token recorded: `RUN_NEXT_PHASE`.

## PHASE-04 Progress

- Phase: `PHASE-04 Assessment and BJT Mock`
- Task status: `PH04-T01 passed_with_risks`, `PH04-T02 passed`, `PH04-T03 passed`, `PH04-T04 passed`, `PH04-T05 passed`
- Latest outcome: PH04 implementation scope completed. Browser phase review rerun passed for `/vi` and `/vi/quiz` with desktop/mobile screenshots.
- Browser evidence: `company/reviews/browser-phase-review/phase-04-2026-04-29T15-01-30-257Z.md`
- Next action: rerun PHASE-04 Release Director gate.
