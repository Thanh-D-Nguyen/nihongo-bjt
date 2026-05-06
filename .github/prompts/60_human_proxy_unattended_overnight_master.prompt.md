# 60 — Human Proxy: Unattended Overnight Master Run

<context-hint>
Use this as the strongest Human Proxy prompt when the human wants the AI company to work overnight without stopping midway. It combines admin completion, full-menu audit, learner frontend all-screens UI/UX, production data/image requirements, and no-demo production rules.
</context-hint>

<task>
Act as `bjt-human-proxy`.

This is an explicit overnight continuation directive from the real human owner. Your mission is to coordinate Boss and the specialist agents continuously until morning or until a true hard stop occurs. Do not stop at routine checkpoints, handoffs, scoped failures, browser QA batching, route failures, missing screen contracts, or task-size concerns.

Human intent:

> Chạy xuyên đêm. Admin/backend/frontend learner đều phải được audit và cải thiện theo chuẩn production BJT số 1 thế giới. Tất cả menu phải được duyệt. Frontend phải có UI/UX guidance cho mọi màn hình dù nhỏ nhất. Admin học tập & ôn luyện phải quản lý đầy đủ và dùng dữ liệu thật chuẩn product, có ảnh thật/provenance cho flashcards, Daily Hub, và mọi module cần ảnh. Không được dừng giữa chừng; sáng mai human check.

Local runtime credentials for browser QA only:

- Admin: `localadmin` / `Admin123456!` at `http://localhost:3001/vi`
- Frontend learner: `testuser` / `testuser` at `http://localhost:3000/vi`

Do not write credentials into tracked runtime config, env files, screenshots, logs, or production docs. Mention them only as runtime-provided local QA credentials inside this prompt/report context.
</task>

<required-reading>
Read these first, in order:

1. `.github/agents/bjt.human-proxy.agent.md`
2. `.github/prompts/47_human_proxy_production_loop.prompt.md`
3. `.github/prompts/57_admin_learning_practice_full_product.prompt.md`
4. `.github/prompts/58_human_proxy_full_menu_world_class_bjt_audit.prompt.md`
5. `.github/prompts/59_frontend_all_screens_uiux_unattended_contract.prompt.md`
6. `.github/prompts/50_admin_100_completion_phase.prompt.md`
7. `.github/prompts/52_learner_frontend_production_loop.prompt.md`
8. `.github/prompts/48_phase_browser_runtime_review.prompt.md`
9. `.github/prompts/53_agent_quality_audit.prompt.md`
10. `company/HUMAN_PROXY_MODE.md`
11. `company/HUMAN_DELEGATION_POLICY.md`
12. `company/UNATTENDED_RUN_POLICY.md`
13. `company/AUTOPILOT_STATE.md`
14. `company/CURRENT_PHASE.md`
15. `company/PHASE_PLAN.md`
16. `company/PHASE_HANDOFF.md`
17. `company/PHASE_TASK_REPORT.md`
18. `company/PHASE_RISK_LOG.md`
19. `company/ADMIN_PRODUCTION_ORCHESTRATION.md`
20. `company/ADMIN_MANAGEMENT_WORKFLOW_STANDARD.md`
21. `company/admin-module-inventory.md`
22. `company/gates/admin-100-completion-gate.md`
23. `company/BJT_ASSESSMENT_FORMAT_STANDARD.md`
24. `DESIGN.md`
25. `company/FRONTEND_PRODUCTION_ORCHESTRATION.md`
26. `company/FRONTEND_ROUTE_PRIORITY.md`
27. `company/learner-ui-screen-contract.md`
28. `company/gates/world-class-learner-experience-gate.md`
29. `company/gates/bjt-ui-pro-max-craft-gate.md`
30. `company/gates/agent-quality-gate.md`
31. `docs/spec/compact/02_database_prisma.md`
32. `docs/spec/compact/03_backend_api_registry.md`
33. `docs/spec/compact/04_admin_rbac.md`
34. `docs/spec/compact/05_admin_ui_modules.md`
35. `docs/spec/compact/06_learner_ui_modules.md`
36. `docs/spec/compact/10_testing_acceptance.md`
37. `docs/spec/compact/11_learning_effectiveness_experience.md`
38. Read and follow all active Cursor rules in `.cursor/rules/*.mdc`.
</required-reading>

<standing-delegation>
Treat this prompt as the human's scoped standing delegation to continue unattended for:

- admin production-depth audit and implementation;
- full admin menu browser/source audit;
- learner frontend all-screen UI/UX contracts and micro-slices;
- admin learning/practice product data, image, media provenance, BJT, SRS, remediation, reading assist, and Daily Hub work;
- login/admin/frontend visual-language updates;
- QA/report/inventory/risk updates needed to keep the loop moving.

This delegation does not authorize final public launch/go-live, destructive migrations, security/privacy/legal/billing risk acceptance, provider-secret decisions, or ignoring Release Director `no_ship`.
</standing-delegation>

<absolute-no-stop-rules>
Do not stop for any of these reasons:

- "run prompt X next"
- "handoff ready"
- "needs specialist agent"
- "needs Boss"
- "needs browser QA"
- "needs frontend screen contract"
- "needs human review" for a routine non-release slice
- "pass_with_risks"
- "pending human review"
- "scope is too large"
- "too many routes"
- "browser full-run timed out"
- "one route failed"
- "one API returned 500"
- "one route stuck loading"
- "backend support is missing but scoped"
- "admin 100 remains a final-launch blocker"
- "frontend route needs UI/UX review"
- "all source work complete, needs screenshots"
- "selected next action is slice N"
- "awaiting owner selection"

Required replacement behavior:

1. Pick the next smallest safe slice.
2. Execute or inline the owner/specialist pass.
3. If browser QA hangs, split to a smaller batch or one route.
4. If one route fails, record route-level blocker and continue another independent slice.
5. If backend/API support is missing, implement the smallest safe backend support or record exact blocker and continue another independent slice.
6. If typecheck/test fails, attempt two targeted fixes for the same concrete failure. If still failing, record command/error/owner and continue a safe independent documentation, contract, or browser-evidence slice.
7. If a route fails visual gate, run the matching rescue prompt or record route-specific blocker; do not mark that route verified, but keep working on independent routes.
8. After every completed slice, immediately select the next incomplete slice unless a true hard stop occurs.
</absolute-no-stop-rules>

<true-hard-stops>
Stop only for:

- destructive migration or data deletion risk;
- security/privacy/legal/billing risk requiring real human acceptance;
- external provider secret/payment decision;
- Release Director returns `no_ship`;
- final public production launch/go-live approval;
- unrecoverable environment failure that prevents source inspection, file edits, documentation updates, and browser/source evidence work;
- repeated targeted fixes cannot restore typecheck/tests and no independent safe slice remains.
</true-hard-stops>

<execution-loop>
Repeat this loop until true hard stop:

1. Read/update current state.
2. Run or inline agent-quality preflight before using old agents or multiple specialists.
3. Select one micro-slice from the priority queues below.
4. Assign owner agents and mark each as `subagent`, `inline`, `planned`, or `skipped`.
5. Execute or inline the slice. Do not output only an instruction packet.
6. Verify with the smallest meaningful checks: typecheck/test/API/browser/source evidence as appropriate.
7. Update evidence files:
   - `company/admin-module-inventory.md`
   - `company/PHASE_TASK_REPORT.md`
   - `company/PHASE_RISK_LOG.md`
   - `company/AGENT_ACTIVITY_BOARD.md`
   - `company/reviews/bjt-ui-ux/` artifacts
   - any new browser audit report file needed for route evidence
8. Record blockers with owner, route/file/API, exact next action, and whether work can continue elsewhere.
9. Choose the next safe micro-slice immediately.
</execution-loop>

<priority-queues>
Work in this order unless current state shows a higher-severity blocker:

1. Browser QA stabilization:
   - create or update deterministic admin/learner route audit scripts or reports;
   - run authenticated browser QA in small menu batches;
   - record screenshots/network/console/auth-loop/i18n/image evidence.
2. Frontend all-screens contract foundation:
   - create/update `company/reviews/bjt-ui-ux/FE-ALL-screen-inventory-and-status.md`;
   - ensure every `FE-*` item from prompt 59 has status and owner.
3. Auth/public frontend foundation:
   - learner login, register, onboarding;
   - admin/backend login visual language;
   - help/privacy/terms/feedback/error/session-expired routes or corrected footer links.
4. Admin Learning & Practice product data:
   - Daily Hub real image/provenance model and admin controls;
   - flashcard/deck image/media asset attach/replace/remove/review;
   - data-import/staging/validation/provenance.
5. BJT assessment admin:
   - question bank loading fix;
   - quiz templates/mock exams/session/remediation BJT metadata and workflows;
   - psychometric/scoring/remediation analytics.
6. Learning paths and SRS:
   - path units/lessons/prerequisites/linked content;
   - flashcard/SRS remediation and leech/comeback flows.
7. Reading assist:
   - admin term/reading/furigana/meaning quality controls;
   - reusable learner reading layer and timed exam restrictions.
8. Learner core routes:
   - home/daily detail;
   - quiz/practice/session/results;
   - flashcards;
   - battle;
   - search;
   - analytics;
   - settings subroutes.
9. Remaining admin menus:
   - content, media, users/support, analytics, monetization, growth, operations, legal, IAM.
10. Release-quality evidence:
   - run final route batches;
   - run Release Director sign-off only after source/browser/test evidence exists;
   - stop only at final go-live approval or true hard stop.
</priority-queues>

<micro-slice-definition>
A valid slice is small enough to finish and verify without getting stuck:

- one route;
- one route group browser QA batch;
- one backend API cluster;
- one admin management workflow;
- one frontend screen contract;
- one shared UI/auth/error component;
- one data-import/media provenance pipeline step.

Do not select broad tasks like "finish frontend", "complete admin", "fix all UI", or "audit everything" as a single execution slice.
</micro-slice-definition>

<production-bars>
All implementation must satisfy:

- PostgreSQL is source of truth; Prisma for app DB access unless raw SQL migration is justified.
- No MongoDB/Mongoose.
- No fake production data.
- Search is projection, not source of truth.
- User-facing text through i18n keys.
- Admin writes require backend RBAC and audit logs.
- Media/external/generated images require provenance/license/alt/review metadata.
- Analytics use real events/rollups or honest empty/degraded states.
- Monetization uses centralized entitlements/quotas/plans/provider abstractions.
- Ads are placement/config/provider-driven and must not interrupt core learning.
- Reading assist is reusable and must not reveal meanings during active timed BJT exam mode except practice/help or post-answer review.
- Learner UI must pass world-class visual gate with desktop/mobile/authenticated evidence.
- Small frontend routes are not exempt from UI/UX quality.
</production-bars>

<output-contract>
Every response must include executable evidence, not just a plan:

```yaml
human_proxy_overnight:
  status: continuing | blocked | stopped_for_approval
  unattended_directive: active
  selected_micro_slice:
  why_this_slice:
  boss_action_executed: yes | no
  agent_quality_preflight:
    status: pass | patched | blocked | not_needed
  agent_activity:
    active_now:
      - agent:
        responsibility:
        execution_mode: subagent | inline | planned | skipped
        status:
    completed:
      - agent:
        output_summary:
        evidence:
    blocked:
      - agent:
        blocker:
        unblock_action:
  work_completed:
    files_changed:
      - path
    routes_audited:
      - route:
        result:
    APIs_checked:
      - path:
        result:
    data_or_media_changes:
      - item:
        provenance_status:
  verification:
    commands:
      - command:
        result:
    browser_evidence:
      - route:
        viewport:
        result:
        screenshot:
  state_updates:
    - path
  blockers:
    - blocker:
      owner:
      route_or_file:
      next_action:
      can_continue_elsewhere: yes | no
  hard_stop_trigger:
    - none
  next_safe_micro_slice:
```

Invalid final output:

- only naming the next prompt;
- only saying "handoff to Boss";
- only asking whether to continue;
- stopping after one slice when more independent work remains;
- claiming production readiness without browser/source/test evidence;
- saying human review is needed for routine non-release frontend/admin slices.
</output-contract>
