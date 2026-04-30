# Model Routing Policy

## Goal

Optimize token usage while preserving production quality for NihonGo BJT.

Use tier names instead of hard-coded provider/model names. The best available model for each tier can change by environment, plan, or GitHub/Copilot availability.

## Model tiers

### cheap-fast

Use for:
- i18n label updates
- simple documentation edits
- small CSS/layout tweaks
- renaming
- checklist formatting
- low-risk repetitive edits

Do not use for:
- architecture decisions
- security, auth, RBAC, privacy, billing, migrations
- production release gates

### balanced

Use for:
- admin UI pages
- learner UI pages
- standard service implementation
- DTO/OpenAPI cleanup
- normal bug fixes
- medium refactors

### code-heavy

Use for:
- NestJS controllers/services
- Prisma schema/migrations
- integration tests
- queue/worker logic
- CI/CD config
- OpenAPI generation
- upload/media pipelines

### deep-reasoning

Use for:
- Boss planning
- gap analysis
- architecture decisions
- cross-module refactors
- RBAC/security/privacy
- monetization entitlement/quota
- production readiness review
- release gate

### review-security

Use for:
- SSRF
- upload validation
- malware scan providers
- auth/session/cookie
- admin permission leaks
- billing webhook verification
- privacy/export/delete flows

## Default routing

| Agent | Default tier | Escalate to |
|---|---|---|
| bjt.human-proxy | deep-reasoning | deep-reasoning |
| bjt.boss | deep-reasoning | deep-reasoning |
| bjt.pm | balanced | deep-reasoning |
| bjt.architect | deep-reasoning | deep-reasoning |
| bjt.backend | code-heavy | deep-reasoning |
| bjt.admin-ui | balanced | code-heavy |
| bjt.learner-ui | balanced | code-heavy |
| bjt.learning-science | balanced | deep-reasoning |
| bjt.media-experience | balanced | code-heavy or review-security |
| bjt.growth-social | balanced | deep-reasoning or review-security |
| bjt.assessment-psychometrics | deep-reasoning | deep-reasoning |
| bjt.content-quality | balanced | deep-reasoning |
| bjt.localization-japan-vietnam | balanced | review-security or deep-reasoning |
| bjt.release-director | deep-reasoning | deep-reasoning |
| bjt.red-team | review-security | deep-reasoning |
| bjt.customer-success | balanced | code-heavy or review-security |
| bjt.life-in-japan | balanced | deep-reasoning or review-security |
| bjt.data-import | code-heavy | deep-reasoning |
| bjt.security | review-security | deep-reasoning |
| bjt.qa | code-heavy | deep-reasoning |
| bjt.browser-qa | code-heavy | deep-reasoning |
| bjt.devops | code-heavy | deep-reasoning |
| bjt.docs | cheap-fast | balanced |

## Task routing examples

| Task | Tier | Reason |
|---|---|---|
| Boss planning, task splitting, architecture decision | deep-reasoning | Multi-context trade-offs |
| Human proxy production loop orchestration | deep-reasoning | Needs state classification and approval-boundary judgment |
| Spec gap analysis | deep-reasoning | Easy to miss requirements |
| Backend API production, Prisma, auth, RBAC | code-heavy or deep-reasoning | Code precision plus architecture |
| Swagger/OpenAPI DTO coverage | balanced or code-heavy | Repetitive but exact |
| Admin UI production page | balanced | Components, state, i18n, permissions |
| Learner UI/UX polish | balanced | Product quality without full release reasoning |
| Learning psychology, focus, motivation loops | balanced or deep-reasoning | Learner wellbeing and retention trade-offs |
| Audio/image/video/color learning assets | balanced or code-heavy | UX plus media/provider correctness |
| Postcards, sharing, referrals, leaderboards, battle motivation | balanced or deep-reasoning | Privacy, fairness, and social pressure |
| BJT scoring, mock exam blueprint, item calibration | deep-reasoning | Assessment credibility |
| Japanese content quality, keigo, grammar, examples | balanced or deep-reasoning | Language correctness |
| Japan/Vietnam localization and tone | balanced | Natural learner/admin experience |
| Red team abuse review | review-security | Bypass/leak/injection risk |
| Customer success/support readiness | balanced | Learner recovery and support privacy |
| Life in Japan context: housing, tax, banking, lottery/probability, investing vocabulary | balanced or deep-reasoning | Sensitive practical-life topics need advice/gambling guardrails |
| Test generation | code-heavy | Code and edge-case reasoning |
| Browser/runtime visual QA after UI phase | code-heavy | Needs app runtime, Playwright, screenshot evidence |
| Security review | review-security or deep-reasoning | Subtle failure modes |
| DevOps/CI/CD/Docker | code-heavy | Commands and config precision |
| Docs, handoff, checklist | cheap-fast or balanced | Low-risk text work |
| Small refactor, label, i18n mapping | cheap-fast | Simple and bounded |
| Final release gate | deep-reasoning | Cross-system verification |

## Escalation rules

Escalate to deep-reasoning when:
- task touches more than 3 modules
- database migration affects existing tables
- auth/RBAC changes
- billing/quota/entitlement changes
- production security is involved
- learner wellbeing, competition, streaks, or social pressure are materially changed
- media upload/external asset provenance or public sharing is changed
- assessment scoring, item calibration, or estimated BJT band changes
- canonical language/content taxonomy changes
- finance, lottery, housing, tax, insurance, pension, immigration, or investment-risk content changes
- tests fail after 2 targeted fixes
- requirements conflict with existing implementation
- spec interpretation is unclear

Downgrade to cheap-fast when:
- task only changes labels
- task only updates docs/checklists
- task only maps i18n keys
- task only creates a route shell without business logic

## Agent selection rule

Use the fewest agents necessary. Default max agents per task: 3.

Use:
- 1 agent for docs, labels, or small UI
- 2 agents for low-risk code
- 3 agents for normal production work
- 4 agents for backend+frontend or DB/API/admin changes
- 5 agents only for release, security, billing, migration, or assessment-scoring gates

More than 5 agents in one cycle is not allowed unless the user explicitly asks for a multi-agent audit or release program.

Separate implementation from review for high-risk work.

## One Task One PR rule

Each cycle must behave like one production PR:
- one task
- one owner agent
- limited files
- tests or documented test gap
- summary
- risks
- next task

Do not mix unrelated modules in one cycle.
