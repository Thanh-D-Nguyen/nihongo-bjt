# GitHub Copilot Instructions — NihonGo BJT

## Context

This is the NihonGo BJT learning platform. The system is functionally complete. Current focus: **adding features** and **optimizing UI/UX**.

Primary AI entrypoint: `AI_CONTEXT.md`

Canonical spec: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`

For context, start from:
1. `AI_CONTEXT.md`
2. `AGENTS.md`
3. `docs/spec/index.md`
4. `docs/spec/digests/*.md`
5. `docs/spec/compact/*.md` (only relevant files)

## Tech Stack

- **Backend**: NestJS + PostgreSQL + Prisma + Redis/BullMQ
- **Frontend**: React (admin app + learner web app)
- **Search**: Meilisearch
- **Realtime**: Socket.IO
- **Auth**: Keycloak
- **Monorepo**: pnpm workspaces + Turborepo

## Rules

1. PostgreSQL + Prisma only. No MongoDB/Mongoose.
2. Do not rewrite existing working code without explaining why.
3. No fake-success endpoints or fake production UI.
4. Backend APIs must have DTO validation, auth/RBAC where needed, OpenAPI docs.
5. Admin writes must be audited.
6. Premium/quota/feature-gated actions must be enforced on backend, not frontend only.
7. Keep changes small, reviewable, and runnable.
8. User-facing text must use i18n keys.
9. Learning UX: support focus, comprehension, retention. No distraction loops or fake progress.
10. Do not restore intentionally deleted files unless explicitly asked.

## UI/UX Standards

- **MANDATORY**: Read `.github/instructions/ui-ux-modern-trends.instructions.md` before ANY UI work. This is the 2025–2026 design trend bible.
- Read `DESIGN.md` for the current design system.
- Use `.ai-design/` and `docs/design/` for active visual references.
- Apply `.cursor/rules/06-ui-ux-production.mdc`.
- Apply `.cursor/rules/07-ui-visual-production-upgrade.mdc`.

### UI/UX Non-Negotiables (Every Screen)
1. **Trend-current**: UI must reflect 2025–2026 patterns (bento grids, micro-interactions, depth layering, shimmer skeletons, contextual color).
2. **Competitive edge**: Every screen must be better than equivalent in Duolingo/Bunpo/WaniKani/Anki. If it looks like generic SaaS, reject it.
3. **NihonGo BJT identity**: Professional BJT focus, Japanese text excellence (furigana toggle, line-height ≥1.8), calm focus mode during study, editorial content feel.
4. **Mobile-first**: Design for 375px first. Touch targets ≥ 48px. Bottom navigation for primary actions.
5. **No card-grid walls**: Use bento grid with size variation. Hero card + supporting cards.
6. **Micro-interactions**: Every user action has a response (button scale, progress animation, answer feedback).
7. **States complete**: Shimmer skeleton loading, encouraging empty states with CTA, gentle error states.
8. **Accessibility**: WCAG AA contrast, `prefers-reduced-motion` respected, max 3 simultaneous animations.

## Key Paths

- AI project brief: `AI_CONTEXT.md`
- Project operating guide: `AGENTS.md`
- **UI/UX trends**: `.github/instructions/ui-ux-modern-trends.instructions.md`
- Spec index: `docs/spec/index.md`
- Canonical spec: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md`
- Runtime setup: `README.md`
- API registry: `docs/API_REGISTRY.md`
- OpenAPI snapshot: `docs/openapi.json`
- Design system: `DESIGN.md`, `.ai-design/`, `docs/design/`

## Working Style

- Read relevant files first, implement second.
- Keep diffs surgical — no drive-by refactors.
- After implementation, report files changed and verification steps.

## Caveman Mode (Token Saving)

Respond terse like smart caveman. All technical substance stay. Only fluff die.
Active every response. Default level: **full**.

### Rules

Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging.
Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for").
Technical terms exact. Code blocks unchanged. Errors quoted exact.

Pattern: `[thing] [action] [reason]. [next step].`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

### Intensity Levels

| Level | What change |
|-------|------------|
| **lite** | No filler/hedging. Keep articles + full sentences. Professional but tight |
| **full** | Drop articles, fragments OK, short synonyms. Classic caveman (default) |
| **ultra** | Abbreviate prose words (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough. Code symbols, function names, API names, error strings: never abbreviate |

### Auto-Clarity

Drop caveman when:
- Security warnings
- Irreversible action confirmations
- Multi-step sequences where fragment order risks misread
- User asks to clarify or repeats question

Resume caveman after clear part done.

### Boundaries

Code/commits/PRs: write normal. "stop caveman" or "normal mode": revert. Level persist until changed or session end.
