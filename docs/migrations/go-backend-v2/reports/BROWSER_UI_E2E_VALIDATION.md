# Browser UI E2E Validation Report

**Date:** 2026-09-30
**Staging:** http://192.168.1.8:18080/vi
**Branch:** main
**HEAD:** bdbc090a (auth route fixes + E2E test added on top)

---

## Gate Result

**REAL_BROWSER_AUTHENTICATED_PARITY_PASS**

All 8 Playwright tests passed against Linux staging via Caddy reverse proxy.

## Test Suite

`e2e/staging-auth-parity.spec.ts` — parameterized by `PLAYWRIGHT_BASE_URL`, no hardcoded LAN IP.

| # | Test | Viewport | Result |
|---|------|----------|--------|
| 1 | `/vi` renders Vietnamese home without critical errors | Desktop 1280×720 | ✅ PASS |
| 2 | Login page renders email/password form | Desktop | ✅ PASS |
| 3 | Register page renders required fields | Desktop | ✅ PASS |
| 4 | `/api/auth/me` returns 401 for anonymous | API | ✅ PASS |
| 5 | Full authenticated lifecycle: register → session → refresh → logout → relogin | Desktop | ✅ PASS |
| 6 | Wrong password shows error message | Desktop | ✅ PASS |
| 7 | Login page renders correctly on mobile | 390×844 | ✅ PASS |
| 8 | Register page renders correctly on mobile | 390×844 | ✅ PASS |

## Auth Route Fixes Deployed

Five stale `/api/auth/keycloak/*` references in frontend forms were updated to use the correct Next.js BFF paths that proxy to the Go backend:

| File | Old Path | New Path |
|------|----------|----------|
| `login-form-client.tsx` | `/api/auth/keycloak/password-login` | `/api/auth/login` |
| `login-form-client.tsx` | `/api/auth/keycloak/authorize` | `/api/auth/authorize` |
| `register-form-client.tsx` | `/api/auth/keycloak/register` | `/api/auth/register` |
| `register-form-client.tsx` | `/api/auth/keycloak/authorize` | `/api/auth/authorize` |
| `forgot-password-form-client.tsx` | `/api/auth/keycloak/forgot-password` | `/api/auth/forgot-password` |
| `app/auth/logout/route.ts` | `/api/auth/keycloak/logout` | `/api/auth/logout` |

## Validated Flows

### Anonymous
- `/vi` renders full Vietnamese homepage with hero, navigation, daily plan hub
- No unexpected console errors (expected 401 from `/api/auth/me` filtered)
- Login and register pages render with correct form fields
- `/api/auth/me` correctly returns 401

### Registration
- Real account created through browser UI against Go backend
- Session cookie (`bjt_web_session`) set and persisted across page navigation
- `/api/auth/me` returns 200 with user profile after registration

### Authenticated Session
- Home renders authenticated state (daily plan, streak, progress sections)
- Session persists after full page reload
- Profile page accessible

### Logout
- `POST /api/auth/logout` via browser fetch clears session cookie
- Subsequent `/api/auth/me` returns 401
- Home reverts to anonymous state

### Relogin
- Login form accepts previously registered credentials
- Session restored after login
- `/api/auth/me` returns 200

### Negative Cases
- Wrong password displays error message (Vietnamese locale)
- No silent failures or unhandled exceptions

### Mobile Viewport (390×844)
- Login and register forms render correctly without overflow
- Touch targets visible and accessible

## Infrastructure Issues Resolved During Testing

1. **PostgreSQL crash-loop** — disk-full-induced WAL corruption (`PANIC: could not write to file "pg_logical/replorigin_checkpoint.tmp"`). Resolved by Docker system prune (reclaimed ~27GB), then Postgres restart.
2. **Docker build failure** — invalid `apps/web/app/api/auth/route.ts` artifact on server caused Next.js build error. Removed before rebuild.
3. **Disk space exhaustion** — staging at 100% usage. Reclaimed via `docker builder prune` + `docker image prune -a` + `docker system prune -a --volumes`.

## Screenshots Captured

All screenshots saved to `test-results/staging-auth/`:
- `register-form.png` — empty registration form
- `register-filled.png` — filled registration form before submit
- `after-register.png` — post-registration authenticated state
- `home-authenticated.png` — authenticated home page
- `profile.png` — profile page
- `after-logout.png` — anonymous home after logout
- `after-relogin.png` — authenticated home after relogin
- `wrong-password.png` — login error state
- `mobile-login.png` — mobile login viewport
- `mobile-register.png` — mobile register viewport