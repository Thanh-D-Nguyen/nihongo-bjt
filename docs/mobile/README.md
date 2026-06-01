# NihonGo BJT — Mobile Architecture (Flutter)

> Production-grade Flutter mobile app for NihonGo BJT.
> State management: **Riverpod 2.x** (code-gen). Architecture: **feature-first + Clean-lite**.
> The mobile app is a **client** of the existing NestJS backend (REST + Socket.IO + Keycloak).
> Backend contract is the source of truth: `docs/openapi.json`.

---

## Documentation index

| # | Doc | Content |
|---|-----|---------|
| 01 | [Architecture overview](01-architecture-overview.md) | Goals, principles, tech stack, layer model, data flow |
| 02 | [Project structure & conventions](02-project-structure.md) | Folder layout, naming, feature anatomy, when to add `domain` |
| 03 | [State management — Riverpod](03-state-management-riverpod.md) | Provider types, AsyncNotifier, codegen, patterns, anti-patterns |
| 04 | [Networking & API client](04-networking-api-client.md) | Dio, interceptors, OpenAPI codegen, error mapping, retries |
| 05 | [Auth — Keycloak OIDC](05-auth-keycloak.md) | PKCE native flow, token storage, refresh, route guards |
| 06 | [Offline sync & storage](06-offline-sync-storage.md) | drift cache, sync queue, server-authoritative rules, conflict policy |
| 07 | [Design system & UI](07-design-system-ui.md) | Theme tokens from `DESIGN.md`, Japanese text, Reading Assist layer |
| 08 | [Testing, CI/CD & roadmap](08-testing-ci-cd.md) | Test pyramid, flavors, pipelines, phased delivery plan |

---

## TL;DR for engineers

```
Riverpod (codegen) + go_router + Dio + freezed + drift + flutter_secure_storage
+ flutter_appauth (Keycloak PKCE) + socket_io_client + slang (i18n)
```

- **Feature-first**: each feature is a self-contained module under `lib/features/<name>/`.
- **Clean-lite**: 3 layers (`data` / `domain` / `presentation`) — but `domain` is **optional** for simple CRUD features. Add it only when business logic is non-trivial (SRS scheduling, battle state machine).
- **Server-authoritative**: user progress, settings, skip-state live on the backend. Local DB is a **cache + sync queue**, never the source of truth for persistent domain data.
- **No demo shortcuts**: no business data stored only in local storage; quota/entitlement enforced by backend, app only renders UI by entitlement.

---

## Non-negotiables (inherited from project standards)

These map directly to `.github/instructions/production-first.instructions.md`:

1. **Server-authoritative state** — local persistence is cache only; sync queue reconciles with backend.
2. **i18n keys for all user-facing text** — no hardcoded strings (use `slang`).
3. **Reading Assist Layer** — a reusable `JapaneseText` widget (furigana / hover / meaning / add-to-flashcard), not per-screen tooltips.
4. **Exam mode protection** — do not reveal meanings during timed BJT exam mode (only practice/help/after-answer).
5. **Feature gating** — entitlements/quotas enforced by backend; the app never implements paywall logic locally.
6. **World-class UI** — design tokens come from `DESIGN.md` (Navy `#1B2A4A`, Blue `#3B82F6`, Noto Sans JP for 和文, Inter for Latin/Vietnamese).
7. **Accessibility** — WCAG AA contrast, `prefers-reduced-motion` equivalent (`MediaQuery.disableAnimations`), touch targets ≥ 48dp.

---

## Backend coordinates (from infra notes)

| Service | Local | Notes |
|---------|-------|-------|
| API (NestJS) | `http://localhost:4000` | REST, OpenAPI at `docs/openapi.json` |
| Realtime | Socket.IO (same host) | Battle flow |
| Keycloak | `http://localhost:9080` | Realm `nihongo-bjt` |
| Search | Meilisearch `:7700` | Projection only — query via backend API, not directly |

> The mobile app must talk to backend endpoints, **not** directly to Meilisearch/Postgres.

---

## Decision record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State mgmt | **Riverpod 2.x (codegen)** | Type-safe, low boilerplate, built-in DI + auto-dispose. Chosen over BLoC for delivery speed across mostly-CRUD surfaces. |
| Architecture | **Feature-first + Clean-lite** | Module isolation without over-engineering; `domain` layer optional per feature. |
| Routing | **go_router** | Declarative, deep-link, typed routes, auth guards. |
| HTTP | **Dio** | Interceptors for auth refresh, retry, logging, cancellation. |
| API models | **Generated from OpenAPI** | Single source of truth with backend; no hand-written DTO drift. |
| Local DB | **drift (SQLite)** | Reactive queries, migrations, type-safe; offline cache + sync queue. |
| Auth | **flutter_appauth + Keycloak PKCE** | Native OAuth2/OIDC; public client with PKCE (no client secret on device). |
| Monorepo | **`apps/mobile/` inside existing repo** (recommended) | Co-locate with backend contract; Melos optional for internal packages. |
