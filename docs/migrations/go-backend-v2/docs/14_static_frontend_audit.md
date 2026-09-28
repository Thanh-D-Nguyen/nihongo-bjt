# 14 — Static Frontend Audit (Rebaselined)

## Canonical classifications

### Learner Web: KEEP_NEXT_RUNTIME

Repository evidence requires retaining the Next.js runtime:

- `force-dynamic` export in `apps/web/app/[locale]/layout.tsx`
- server-side `cookies()` reads for session evaluation
- `KeycloakAuthShell` server component gates rendering based on auth state
- runtime auth behavior embedded in layout tree
- server-loaded i18n messages (`en.json`, `ja.json`, `vi.json`) imported directly in layout
- Socket.IO client integration in battle, flashcards, quiz, scenarios, lessons
- `[locale]` dynamic segment with `generateStaticParams` but runtime locale resolution in layout
- No standalone `middleware.ts`; locale routing is embedded in server components

**Decision:** Do NOT attempt static export during this migration.

### Admin: NEEDS_INVESTIGATION_POST_M6

Repository evidence shows current server-side dependencies:

- `force-dynamic` export in `apps/admin/app/[locale]/layout.tsx`
- `AdminKeycloakSessionGate` server component gates rendering
- `isAccessTokenUsable` server-side check from `@nihongo-bjt/keycloak-oidc`
- server-side cookie reads via `cookies()`
- `AdminShellClient` wraps client-side SPA shell

However, Admin is architecturally closer to a static SPA with a server-side auth gate. After M6 replaces Keycloak session gating with Go cookie sessions, the server-side dependency may be removable or movable to Caddy/client-side.

**Decision:** Evaluate static export viability ONLY after M6 (admin auth cutover) proves Go cookie sessions work correctly. Admin static export is an optimization, not a prerequisite. If viable, implement. If not, retain Next.js runtime.

## Auth impact on static export

When moving to Go opaque sessions, browser clients authenticate via secure cookie against the same site/API. A static SPA does not imply insecure client-side token storage.

Do not move sessions to localStorage merely because the frontend becomes static.

For Admin post-M6 evaluation, determine whether:

- Go session validation can happen entirely client-side (fetch `/api/auth/me` on load);
- Caddy can enforce auth at the edge for admin routes;
- or a minimal Next.js runtime is still required for initial auth gating.

## Caddy routing target

```text
/                 → learner Next.js runtime (:3000)
/admin/*          → admin static files OR Next.js runtime (decided post-M6)
/api/*            → Go API (:4000→new port)
/media/public/*   → Caddy file_server → /srv/kotobawork/data/media/public
```

Exact routes must match the repo/product.

## Locale routing consideration

Both apps use `[locale]` dynamic segments with `generateStaticParams` returning `{vi}`, `{ja}`, `{en}`. Locale resolution happens in server layouts, not middleware.

If Admin becomes static, locale routing must be handled by:

- pre-generated locale directories (`/admin/vi/`, `/admin/ja/`, `/admin/en/`);
- Caddy rewrite rules;
- or client-side locale detection with redirect.

This is solvable but must be explicitly designed during M6.5 evaluation.

## Exit artifact format

For each app record:

```text
app:                    web | admin
current Next mode:      force-dynamic SSR
runtime-only features:  [list]
static blockers:        [list]
changes required:       [list or "none"]
risk:                   HIGH | MEDIUM | LOW
decision:               KEEP_NEXT_RUNTIME | STATIC_EXPORT | NEEDS_INVESTIGATION_POST_M6
```

Do not mix this optimization with product redesign.