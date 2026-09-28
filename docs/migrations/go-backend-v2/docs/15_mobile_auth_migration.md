# 15 — Mobile Auth Migration (`nihongo-mobile`)

## Scope

The Flutter mobile app uses a dedicated Keycloak client:

```text
clientId: nihongo-mobile
type: public client (PKCE required)
redirectUris:
  - com.nihongobjt.app://oauth2redirect
  - http://localhost:4000/*
audience mapper: nihongo-mobile
```

This client is explicitly in scope for auth migration. Keycloak cannot be retired until mobile is migrated or formally retired with evidence.

## Current behavior (from realm-export.json)

- Public client with PKCE (`S256` code challenge method)
- Direct access grants enabled (password grant available)
- Standard OIDC flow enabled
- Front-channel logout enabled
- Audience claim mapped to `nihongo-mobile`
- No service accounts

## Migration requirements

### Token endpoint compatibility

Go auth must provide equivalent OIDC/OAuth2 endpoints:

```text
POST /api/auth/token        (token exchange, password grant if retained)
POST /api/auth/token/refresh (refresh token rotation)
GET  /api/auth/authorize     (authorization endpoint for PKCE)
GET  /api/auth/userinfo      (user claims)
POST /api/auth/logout        (session/token revocation)
```

Mobile may use password grant or authorization code + PKCE. Determine which flows are actually used by inspecting the Flutter app source or API logs during M0.

### PKCE enforcement

Public clients MUST use PKCE. Go token endpoint must:

- Require `code_verifier` on token exchange
- Validate against stored `code_challenge` (S256)
- Reject requests without valid PKCE
- Bind authorization codes to the specific PKCE session

### Custom redirect URI

Support `com.nihongobjt.app://oauth2redirect` as a valid redirect target. This is a custom scheme, not HTTP. Go OAuth handler must accept and validate it without requiring TLS.

### Refresh token behavior

Determine current refresh token semantics:

- Rotation policy (one-time use vs reusable)
- Absolute lifetime
- Idle timeout
- Concurrent session limits
- Revocation on password change / account disable

Replicate or deliberately improve these behaviors in Go. Document any intentional changes.

### Claims / userinfo

Determine what claims the mobile app expects:

- `sub` (stable user ID)
- `email`
- `name` / `displayName`
- `roles` / permissions
- custom claims

Go userinfo endpoint must return compatible claims. If the internal user ID format differs from Keycloak `sub`, maintain a mapping table during transition so existing mobile sessions/tokens remain valid.

### Audience validation

If mobile validates the `aud` claim, Go tokens must include `nihongo-mobile` as audience when issued through the mobile flow.

## Migration wave: M5.5

M5.5 occurs after M5 (learner web cutover) proves Go auth works for browser clients.

Steps:

1. Inventory actual mobile API usage patterns (which endpoints, which token types)
2. Implement Go token/authorize/userinfo endpoints with PKCE
3. Test with real Flutter app against Go staging
4. Verify refresh token rotation and session lifecycle
5. Verify custom redirect URI handling
6. Verify audience and claims compatibility
7. Coordinate mobile app update if token format changes
8. Stability window before Keycloak retirement

## Retirement gate

Keycloak retirement requires ONE of:

- Mobile successfully migrated and verified in production
- Explicit documented evidence that `nihongo-mobile` is no longer an active supported client (e.g., app deprecated, zero API traffic for N days, product decision recorded)

Do NOT silently orphan mobile users.

## Rollback

During transition, both Keycloak and Go token endpoints may coexist. Mobile app should be able to fall back to Keycloak if Go auth fails. Coordinate with mobile release cycle.