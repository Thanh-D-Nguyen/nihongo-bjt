# Compact Spec 00: Product and MVP Cutline

## Canonical references

Full spec sections: 0.1, 0.2, 1, 20, 21, 21.14, 25.

## Requirement language

- MUST and REQUIRED are non-negotiable for production slices.
- SHOULD is expected unless there is an explicit trade-off recorded in `company/DECISION_LOG.md`.
- MAY is optional and must not block MVP.
- If implementation and compact spec disagree, verify against the full canonical spec.

## Product goal

NihonGo BJT is a production Japanese/BJT learning web app. It must combine serious BJT preparation with practical daily-life Japanese learning.

## MVP v1 cutline

Prioritize:
- PostgreSQL/Prisma foundation and real domain models.
- Auth, user profile, RBAC boundaries, and audit logging.
- Dictionary/content browsing, search projection, bookmarks.
- Flashcards/decks/SRS with persisted progress.
- BJT levels, quizzes, mock exam basics, result history.
- Admin CMS/import/RBAC/audit modules needed to operate content.
- Reading Assist as reusable layer for Japanese text.
- Privacy, consent, export/delete basics.
- Monetization-ready server-side plans, entitlements, quotas, and local providers.
- CI, tests, health checks, env validation, and release gate.

Defer unless required by a current vertical slice:
- Full external billing provider launch.
- Native mobile apps.
- Large gamification/social breadth.
- Advanced personalization beyond MVP data contracts.
- Complex data science dashboards without real events/rollups.

## Fake-success rules

Forbidden:
- UI that looks complete but cannot perform the workflow.
- Persistent domain data stored only in React state/localStorage.
- Fake analytics charts not backed by event/rollup schema.
- Frontend-only paywall, RBAC, or quota enforcement.
- Fake search arrays instead of Meilisearch projection or compatible local provider.
- Raw JSON import into canonical tables without staging/validation.
- Silent error swallowing.

Allowed temporary implementations:
- Local/mock provider behind a real provider interface when external API keys are unavailable.
- Seed/dev data clearly marked and stored through real schema.
- Minimal UI connected to real APIs and persistence.

## Definition of done

A production slice needs:
- typed domain model and API contract
- database persistence or explicit provider abstraction
- validation and error handling
- auth/RBAC boundary when relevant
- i18n keys for user-facing copy
- audit logs for admin mutations
- tests for core business logic
- documented verification commands and residual risks

## Phase discipline

Implement one phase at a time. Do not jump ahead except for lightweight scaffolding needed to keep the repo compiling.

## Priority classes

P0:
- App cannot run, build, or validate core contracts.
- PostgreSQL/Prisma schema blocks real persistence.
- Auth/RBAC/audit is missing for admin writes.
- Fake-success behavior would mislead product status.
- Security/privacy risk affects production data.

P1:
- Core learner/admin vertical slice is partial but structurally correct.
- API exists but lacks tests, OpenAPI, or hardening.
- UI is real but lacks degraded/empty/error states.
- Monetization/entitlement foundation is missing for a gated feature.

P2:
- UX polish, workflow efficiency, and non-blocking admin improvements.
- Additional analytics dimensions after real events exist.
- Provider integrations after local provider contracts are stable.

P3:
- Nice-to-have experiments, cosmetic changes, and future growth ideas.

## Agent behavior

- Start with the smallest vertical slice that proves the domain model, API, persistence, and UI contract.
- Prefer additive changes when the repo is partially implemented.
- Record architectural decisions in `company/DECISION_LOG.md`.
- Update handoff docs after major implementation cycles, not after every tiny edit.
- If a task is only docs/checklists, use the model-routing `cheap-fast` tier.
- If a task changes architecture, release gates, security, or billing, use `deep-reasoning`.

## Acceptance wording

Good acceptance criteria:
- names exact routes/endpoints/files
- states required auth/RBAC/entitlement behavior
- identifies data persistence and audit expectations
- lists gate commands
- names residual risks

Weak acceptance criteria:
- "make it production ready"
- "improve UI"
- "finish backend"
- "looks good"
- "match spec" without domain slice
