# Admin Management Workflow Standard

## Purpose

An admin route is production-ready only when it lets an operator manage the domain, not merely look at a table.

Source/API wiring, a generic data table, and typecheck passing are necessary but not sufficient. A route that only renders read-only data is an observability screen unless the inventory documents why the domain is intentionally immutable.

## Core Rule

Every enabled admin route must answer:

- What decision does an admin make here?
- What action can the admin take here?
- What evidence proves the action is real, persisted, RBAC-enforced, and audited where required?

If the route cannot answer these questions, classify it as `missing_workflow`, `read_only_when_management_required`, or `connected_but_incomplete`.

## Baseline Workflow Expectations

Most management routes need:

- search, filters, sort, pagination, record count, page size, and useful empty state;
- detail view or drawer with related records, history, and operational context;
- route-specific primary actions, not generic JSON/table rendering;
- loading, error, degraded, permission-denied, and success states;
- RBAC-aware action visibility and backend authorization;
- confirmation for sensitive/destructive actions;
- audit reason/log for admin mutations where required;
- i18n copy for all user-facing labels and messages;
- browser QA evidence that interactions work, not screenshots alone.

## Domain Action Patterns

Use the domain's lifecycle to decide actions:

- Config domains such as Battle Configs, ad rules, feature flags, provider settings: create, edit, validate, enable/disable, publish, rollback/version history, audit.
- Profile/configured actor domains such as Battle Bots or Admin Users: create/edit profile, activate/deactivate, assign roles/settings, test/simulate when relevant, view history, audit.
- Content/assessment domains such as quiz templates, question bank, learning paths, decks, flashcards: create/edit, preview, validate, publish/unpublish, archive/restore, version/history, related content links.
- Queue/review domains such as abuse, privacy requests, import errors, support notes: triage, assign, approve/reject/resolve, retry/cancel, add note, export, audit.
- Analytics/observability domains: filters, time range, segments, drilldowns, export, freshness, anomaly/error state, link to next operational action.
- Immutable ledger/audit domains: read-only is acceptable only when the UI clearly communicates immutability and still provides search/filter/detail/export and audit context.

## Read-Only Exception

Read-only admin pages can pass only when all are true:

- the inventory records the domain reason, such as immutable audit log, payment ledger, historical battle match result, or compliance archive;
- the page still has search/filter/sort/pagination/detail/export or equivalent operational tools;
- no expected management operation is silently missing;
- the Release Director/admin inventory accepts the exception with evidence.

## Generic Table Rule

`AdminResourceTableClient` or any generic read-only table does not pass admin production readiness by itself.

It may be used only as a temporary implementation or as a subcomponent inside a route-specific workflow. A route using a generic table must be upgraded or explicitly justified as immutable/read-only with the exception criteria above.

## Examples

- `battle/configs`: must support config create/edit, matchmaking/reward/bot-rule changes, enable/disable, publish/rollback, validation, and audit.
- `battle/bots`: must support bot profile create/edit, difficulty/strategy tuning, activate/deactivate, simulation/test entry point, match history, and audit.
- `assessment/quiz-templates`: must support create/edit, preview, validation, publish/archive, filters by type/level/status, and history.
- `growth/campaigns`: must support campaign create/edit, schedule, pause/resume, targeting/quota, analytics, and audit.
- `iam/roles`: must support role detail, permission assignment, admin assignment impact, confirmation/audit reason, and denial-state verification.
- `users/360`: must not duplicate `/users`; it needs access reason, user profile context, entitlements, learning/activity/support/privacy/audit panels, and safe admin actions.

## Closeout Test

Before marking a route complete, record:

- intended workflow;
- required actions and intentionally omitted actions with reasons;
- backend endpoints/mutations used;
- RBAC and audit evidence;
- browser interaction evidence;
- remaining risks or explicit read-only exception.
