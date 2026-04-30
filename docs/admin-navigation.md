# Admin navigation (sidebar IA)

Source: `apps/admin/lib/admin-nav-data.ts` (canonical groups and items), resolved in `apps/admin/lib/resolve-admin-nav.ts`, rendered by `packages/ui/src/admin-shell.tsx`.

Spec crosswalk: `docs/spec/nihongo_bjt_cursor_master_spec_final_completed_v2.md` — section **10** (API registry / §10.1), content/learning/monetization/IAM/Battle modules as referenced in that document.

## Groups and items (v15-aligned)

| # | Group id | i18n group key | Notes |
|---|----------|------------------|-------|
| 1 | `overview` | `shell.navGroups.overview` | Home, system/ops, release |
| 2 | `content` | `shell.navGroups.content` | CMS, media, versions, enrichment, i18n center |
| 3 | `learning` | `shell.navGroups.learning` | Daily, life-in-Japan contexts, decks, templates, paths, competencies, reading assist |
| 4 | `assessment` | `shell.navGroups.assessment` | BJT, quiz, bank, sessions, mocks, remediation |
| 5 | `battle` | `shell.navGroups.battle` | Feature flag `adminNav.battle` on all battle items |
| 6 | `users` | `shell.navGroups.users` | Users, 360, support, privacy/export |
| 7 | `analytics` | `shell.navGroups.analytics` | Executive + domain analytics |
| 8 | `monetization` | `shell.navGroups.monetization` | Plans, billing, ads, webhooks |
| 9 | `growth` | `shell.navGroups.growth` | OAuth, referrals, postcards, campaigns |
| 10 | `operations` | `shell.navGroups.operations` | Flags, DLQ, import, notifications, audit, security, settings |
| 11 | `legal` | `shell.navGroups.legal` | Legal, consent, tokushoho, retention |
| 12 | `iam` | `shell.navGroups.iam` | Overview + roles, permissions, admins, role audit |

Labels: `apps/admin/messages/vi.json`, `ja.json` under `shell.navGroups` / `shell.navItems`. English strings can be mirrored in `apps/admin/messages/en.json` when the admin app adds an `en` locale.

## RBAC

- Each item may set `permissions` (OR list). If the client has not loaded permissions yet (`null`), items are shown; after `/api/admin/me`, items without a matching code are removed.
- Scaffold pages list the same permission hint in `apps/admin/lib/admin-scaffold-spec.ts` (non-user-facing technical line).

## Feature flags

- Env: `NEXT_PUBLIC_ADMIN_FEATURE_FLAGS` (JSON), e.g. `{"adminNav.battle":false}`.
- Most keys omitted from the JSON are treated as enabled.
- Default-off keys are defined in `apps/admin/lib/admin-feature-flags.ts` for launch cutline honesty. Current default-off families include battle, Phase-11 extended modules, prodGate items, user-ops drill routes, analytics drilldowns, and settings.
- **Battle** (`adminNav.battle`): all battle nav items share this flag; default OFF unless explicitly enabled.
- Hidden/default-off route families are not production-ready by default. They are explicit deferrals until implemented or approved as launch exclusions.

## Route shells

Scaffold routes use `apps/admin/lib/render-admin-scaffold.tsx` + `AdminModuleScaffold`. Technical API hints live in `apps/admin/lib/admin-scaffold-spec.ts` (registry / spec §10.1 wording, not product copy).

Route shells are allowed only as honest interim states. They must not be counted as final production completion.

Admin 100% completion is tracked by:

- `company/ADMIN_COMPLETION_PROGRAM.md`
- `company/admin-module-inventory.md`
- `company/gates/admin-100-completion-gate.md`
- `.github/prompts/49_admin_100_completion_audit.prompt.md`
- `.github/prompts/50_admin_100_completion_phase.prompt.md`

Final production readiness is blocked while any enabled nav item remains `status: "scaffold"` or any enabled route still renders `renderAdminScaffoldForId(...)`.

When the human asks for full admin production readiness rather than launch cutline readiness, use `company/ADMIN_PRODUCTION_ORCHESTRATION.md`. In that mode, hidden/default-off admin modules remain backlog until they become real backend-backed workflows or receive explicit deferral approval.

## Content quality review

- Content review queue now has a dedicated route at `/[locale]/content/quality-review`.
- Access remains admin-only through the app shell and backend RBAC (`admin.content.read` for queue visibility, `admin.content.write` for audited status transitions).
- The route stays outside protected working dictionary/kanji/grammar pages and reuses real admin CMS contracts: `GET /api/admin/content?...&status=needs_review` plus audited `PATCH /api/admin/content/:type/:id/status` transitions.
- Editors can switch between lexeme, kanji, and grammar review queues from one entry point without introducing fake queue data.

## Tests

- `apps/admin/lib/resolve-admin-nav.test.ts` — permission filtering, battle feature flag.
- `packages/ui/src/admin-shell.is-active.test.ts` — `exact` vs `prefix` active path matching.
