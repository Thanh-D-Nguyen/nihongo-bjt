# Profile / Me Hub — Auth & Logout Audit

Audit of the mobile auth/session/logout behavior against the Me Hub skill's
hard rules: no raw AppAuth/Keycloak prompt on logout, clear signing-out state,
clean redirect to Login, no fallback-profile flash, no auth loop.

## Current flow (evidence)

| Concern | Status | Evidence |
|---|---|---|
| Raw Keycloak/AppAuth browser on logout | **Avoided** | `KeycloakAuthRepository.signOut` is intentionally local-only; it does **not** call `appAuth.endSession`. See `apps/mobile/lib/features/auth/data/keycloak_auth_repository.dart` (`signOut` doc comment). |
| Tokens destroyed on device | **Yes** | `AuthController.signOut` calls `_store.clear()` after best-effort remote logout. `apps/mobile/lib/features/auth/presentation/auth_controller.dart`. |
| Clear signing-out state | **Yes** | `ProfilePage` shows `_SigningOutView` while `auth.isLoading && claims.isEmpty`; sign-out button shows spinner + disables. `profile_page.dart`. |
| No fallback-profile flash | **Yes** | During sign-out the profile renders the signing-out view, not the authenticated identity. |
| Clean redirect to Login | **Yes** | `authRedirect` sends `unauthenticated` users to `/login`. `apps/mobile/lib/core/auth/auth_redirect.dart`; router `refreshListenable` reacts to auth state. |
| No login flash during restore | **Yes** | `authRedirect` returns `null` while `AuthStatus.unknown`. |
| No auth loop | **Yes** | Authenticated users are bounced away from `/login` and `/register` back to `/`. |
| Best-effort remote logout never blocks local clear | **Yes** | `signOut` wraps remote call in try/catch and always clears the store. |

## Conclusion

The auth/logout UX already satisfies every Me Hub hard rule. **No behavioral
change required in Batch 4.** The remaining work is purely presentational
verification + test coverage:

- Confirm the signing-out state renders for the new Me Hub layout (the new
  sections must not render an authenticated snapshot mid-logout).
- Ensure `studySummaryProvider` / `subscriptionProvider` widgets do not surface
  a stale authenticated snapshot during the signing-out state (guarded by the
  early `_SigningOutView` return).
- Add/confirm tests: signing-out state, redirect to login, no fallback flash.

## Minor hardening considered (and decided)

| Idea | Decision |
|---|---|
| Call `appAuth.endSession` for full IdP logout | **Rejected** — would open the off-brand Keycloak browser page; violates the skill rule. Local clear is correct for a native app; federated IdP cookie expires on its own schedule. |
| Confirmation dialog before sign-out | **Optional, deferred** — current single-tap with clear state is acceptable; a confirm sheet can be added later without auth changes. |
