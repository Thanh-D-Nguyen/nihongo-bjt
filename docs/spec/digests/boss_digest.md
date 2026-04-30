# Boss Digest

Default tier: deep-reasoning.

## Must read

- `docs/spec/index.md`
- `company/model-routing.md`
- `company/PROJECT_STATE.md` if present
- `company/COMPANY_BACKLOG.md` if present
- `company/SPRINT_BOARD.md` if present
- `company/AGENT_HANDOFF.md` if present

## Add compact files by task

- Product/MVP: `compact/00_product_mvp_cutline.md`
- Architecture: `compact/01_architecture_stack.md`
- DB/API: `compact/02_database_prisma.md`, `compact/03_backend_api_registry.md`
- Admin/RBAC: `compact/04_admin_rbac.md`, `compact/05_admin_ui_modules.md`
- Learner: `compact/06_learner_ui_modules.md`
- Security/privacy: `compact/07_security_privacy.md`
- Monetization: `compact/08_monetization.md`
- Ops/release: `compact/09_operations_ci_cd.md`, `compact/10_testing_acceptance.md`

## Done

- Pick one highest-value P0/P1 slice.
- Assign one specialist agent with objective, files, acceptance criteria, and gate commands.
- Keep phase discipline.
- Update backlog/sprint/handoff only when the plan changes.

## Avoid

- Reading full spec by default.
- Delegating broad "finish everything" tasks.
- Accepting fake UI-only or fake-success implementation.
- Jumping ahead of foundations for feature breadth.

## Check commands

- `rg --files .github docs/spec company`
- Use project-specific lint/typecheck/test/build commands from package scripts.

## Escalate

Read full spec when compact files conflict, release gate requires confirmation, architecture/security decisions are ambiguous, or task crosses more than 3 modules.
