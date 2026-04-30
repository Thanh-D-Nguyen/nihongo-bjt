# Known limitations and Phase 2 backlog

This is a living list of intentional gaps, skeleton flows, and follow-up work. It is not a complete roadmap.

## Known limitations (current)

- **Auth**: Many learner flows use a `userId` (UUID) in the UI for local/preview; production should use a real auth session and the same user model end-to-end.
- **Placements, onboarding, privacy (Phase 9)**: Data export and account deletion have database records and status fields; full artifact delivery, legal review, and automated deletion pipelines are not finished.
- **Notifications**: In-app feed and preferences are stored in PostgreSQL; email/push providers and nudge scheduling are not wired.
- **PWA / offline**: Service worker is minimal; flashcard review queue uses IndexedDB per device. Full offline content packs and conflict resolution are out of scope for the current slice.
- **Battle**: Bot battles are implemented; PvP matchmaking beyond the in-memory stub is not shipped.
- **Meilisearch**: Learner search falls back to PostgreSQL when the index is empty or the service is down; ops should run `search:index` in each environment.
- **Monetization**: Entitlement/billing abstractions in rules are not all implemented as productized checkout flows; treat as architecture guidance until a dedicated phase lands.

## Phase 2 backlog (prioritize with product)

- End-to-end auth (e.g. OIDC) with `user_profile` as the single learner identity; remove ad-hoc UUID text fields where possible.
- Reading assist layer: analyzer service, dictionary gaps admin report, and flashcard add-from-selection at scale.
- Entitlements, quotas, billing provider, ads placement — per `AGENTS.md` and repo rules, implemented as real tables and server enforcement.
- Admin CMS depth: import pipelines, i18n center, full media provenance review.
- E2E expansion: auth paths, BJT practice, battle bot flow — beyond smoke tests in `e2e/`.
- Performance: API pagination audit, image CDN, search index freshness SLAs.
- Mobile apps or Capacitor (only if product commits).

## How to use this document

- Before a release, scan **Known limitations** and confirm stakeholders accept them or tickets exist.
- Add backlog items with a short **owner** and **outcome** when you promote an idea from chat to work.
