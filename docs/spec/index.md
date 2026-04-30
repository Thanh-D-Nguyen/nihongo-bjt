# NihonGo BJT Spec Index

## Canonical source

`docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` is the canonical full specification. Do not delete, rename, or weaken it.

This index and the compact/digest files are token-efficient navigation layers. If a compact file conflicts with the canonical full spec, the full spec wins.

## Context loading rule

Default context loading:
1. Read this index.
2. Read the relevant digest in `docs/spec/digests/`.
3. Read only the compact spec files required for the current task.
4. Read the full canonical spec only when compact files are ambiguous, requirements conflict, architecture/security/release-gate work needs full verification, or Boss Agent explicitly requests full-spec verification.

Never paste large spec sections into chat when a file reference is enough. Prefer paths, short status, exact next actions, patches, and checklists.

## Compact files

| File | Use for | Canonical sections |
|---|---|---|
| `compact/00_product_mvp_cutline.md` | product goal, requirement language, MVP, fake-success guardrails | 0.1, 0.2, 1, 20, 21, 21.14, 25 |
| `compact/01_architecture_stack.md` | stack, monorepo, bounded contexts, architecture rules | 2, 3, 4, 5, 9, 11, 15, 16 |
| `compact/02_database_prisma.md` | PostgreSQL, Prisma, schemas, table registry, migrations | 6, 7, 8, 26.5, 28.7, 29.4 |
| `compact/03_backend_api_registry.md` | API surface, registry rules, DTO/auth/RBAC/OpenAPI | 10, 10.1, 21.5 APIs, 21.7 APIs, 27.12, 28.8, 29.9 |
| `compact/04_admin_rbac.md` | admin permissions, audit, support privacy, RBAC matrix | 14.1, 14.10.4, 17.7, 26.10, 26.11 |
| `compact/05_admin_ui_modules.md` | admin navigation, dashboards, module pages, analytics | 14, 21.10 admin, 26.10, 27.11, 28.12, 29.11 |
| `compact/06_learner_ui_modules.md` | learner routes, UX, reading support, learning paths | 13, 21.5, 21.7, 21.8, 21.12, 27.5-27.8, 28, 29.10 |
| `compact/07_security_privacy.md` | security, upload, SSRF, legal, consent, privacy | 17, 21.10, 21.11, 26.9, 27.9, 31 |
| `compact/08_monetization.md` | plans, entitlements, quotas, ads, billing, webhooks | 26, 31.3-31.8 |
| `compact/09_operations_ci_cd.md` | flags, health, observability, CI/CD, backup, resilience | 16, 21.13, 30 |
| `compact/10_testing_acceptance.md` | tests, acceptance, release gate, done criteria | 18, 20, 21.4, 21.14, 23, 25.2 |
| `compact/11_learning_effectiveness_experience.md` | focus, learning psychology, sensory media, postcards, sharing, competition | 13, 21.5, 21.7, 21.12, 21.14, 27, 28, 29 |
| `compact/12_life_in_japan_contexts.md` | practical Japan-life contexts, housing, tax, banking, lottery/probability, investment risk literacy | 13, 21.5, 21.10, 21.11, 25, 27, 31 |

## Digests

| Agent | Digest | Default tier |
|---|---|---|
| bjt.boss | `digests/boss_digest.md` | deep-reasoning |
| bjt.backend | `digests/backend_digest.md` | code-heavy |
| bjt.admin-ui | `digests/admin_ui_digest.md` | balanced |
| bjt.learner-ui | `digests/learner_ui_digest.md` | balanced |
| bjt.learning-science | `digests/learning_science_digest.md` | balanced |
| bjt.media-experience | `digests/media_experience_digest.md` | balanced |
| bjt.growth-social | `digests/growth_social_digest.md` | balanced |
| bjt.assessment-psychometrics | `digests/assessment_psychometrics_digest.md` | deep-reasoning |
| bjt.content-quality | `digests/content_quality_digest.md` | balanced |
| bjt.localization-japan-vietnam | `digests/localization_japan_vietnam_digest.md` | balanced |
| bjt.release-director | `digests/release_director_digest.md` | deep-reasoning |
| bjt.red-team | `digests/red_team_digest.md` | review-security |
| bjt.customer-success | `digests/customer_success_digest.md` | balanced |
| bjt.life-in-japan | `digests/life_in_japan_digest.md` | balanced |
| bjt.qa | `digests/qa_digest.md` | code-heavy |
| bjt.devops | `digests/devops_digest.md` | code-heavy |

For model tier policy, read `company/model-routing.md`.
