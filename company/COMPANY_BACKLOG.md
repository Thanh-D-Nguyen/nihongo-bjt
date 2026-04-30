# Company Backlog

Priority definitions:

- P0: blocks safe continuation
- P1: required for MVP v1
- P2: scaffold or production hardening soon
- P3: future enhancement

## Operational Mirror

- Latest completed production task: PH08-T06 Red-team abuse review and release-readiness decision packet
- Recommended next production task: BJT-111 Admin 100% workspace completion audit and execution
- Operational source of truth: company/backlog.md

## Phase Batch Execution Tracker

- phase_id: ADMIN-100
- status: admin_completion_needed
- approved_at: 2026-04-30
- approval_token: DELEGATED_APPROVE_PHASE_2026_04_30
- latest_completed_task: PH10-T06 passed (phase-scope review packet + browser evidence)
- release_director: ship_with_risks (phase scope only), final launch remains blocked
- next_phase: Reopen admin product-depth completion; Admin 100 scaffold-count PASS is superseded by human manual review blockers
- updated_at: 2026-04-30

| ID | Priority | Area | Task | Agent | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| BJT-001 | P0 | Bootstrap | Run company bootstrap and operations doc takeover | bjt-boss | done | Completed in BJT-CYCLE-TAKEOVER-001 |
| BJT-002 | P0 | Backend Foundation | API registry to implementation gap audit and first closure slice | bjt-backend | todo | Include DTO validation, RBAC, OpenAPI, test gap notes |
| BJT-003 | P1 | Admin Governance | Admin write audit coverage hardening for high-risk modules | bjt-backend | todo | Audit logs required for all admin mutations |
| BJT-004 | P1 | Monetization Safety | Centralized entitlement/quota enforcement audit and fixes | bjt-backend | todo | Backend enforcement only, no frontend-only gate |
| BJT-111 | P0 | Admin | Admin 100% workspace completion | bjt-boss | todo | Inventory all admin nav items, remove enabled scaffolds, fix product-depth blockers, pass admin-100-completion-gate before final launch |
| BJT-112 | P1 | UI/UX | BJT UI/UX production standard review | bjt-learner-ui | todo | Review major learner/study/assessment/reading/media/social UI against BJT-specific UI/UX gate |
