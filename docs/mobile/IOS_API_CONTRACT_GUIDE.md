# iOS API Contract Guide

Use [the canonical OpenAPI document](../openapi.json) as the sole
machine-readable contract for the Go `/api` endpoints. Its direct source-route inventory
is [api-route-inventory.json](../api-route-inventory.json). The inventory is a
static view of `NewRouter` `/api` registrations. It excludes `/health/live`,
`/health/ready`, `/ws/battle`, and `/ws/presence`; it is not a complete router
inventory. A conditional registration is not proof that an endpoint is available
in a particular deployment. Schemas and runtime availability remain separately
unverified for most endpoints.

Never infer a request field, response field, route alias, status code, or
authentication behavior from an endpoint name. Generate or hand-write client
types from the OpenAPI schemas. First locate the path/method and inspect its
`x-contract-verification.status`: `test-evidenced` means a named handler test
exercises the operation, but does not establish full request/response schema or
validation conformance. No operation currently has full schema verification.
Treat both `test-evidenced` and `unverified` as requiring independent contract
validation before relying on generated client types. The latter has no listed
handler test evidence.

## Authentication

POST /api/auth/login accepts JSON { "email", "password" } and returns
{ "ok": true, "token": "<opaque session token>" }; it also sets the
bjt_web_session HttpOnly cookie. Store the opaque token securely and send
Authorization: Bearer <token> for authenticated mobile reads and writes. It
is not a JWT and there is no refresh-token endpoint. Sessions expire after
24 hours, and a missing, expired, revoked, malformed, or disabled-account
session returns 401 { "error": "unauthorized" }.

The Go CSRF middleware currently requires an allowlisted HTTP(S) Origin or
Referer on unsafe routes with CSRFGuard, including password login and logout. A native client
that sends neither header configured in CORSOrigins receives 403; the
repository's current Flutter auth client sends neither. This is a
backend/mobile integration blocker, not a cue to bypass CSRF or invent a
native exception.

POST /api/auth/google is a separate native-compatible JSON sign-in endpoint.
It accepts `{ "idToken": "<Google ID token>" }`, requires
`Content-Type: application/json`, and verifies the Google signature,
audience, issuer, expiration, and verified email. The mobile Google SDK must
request an ID token using the **Web OAuth client ID** configured on the Go
server as `GOOGLE_OAUTH_CLIENT_ID` (and on web as
`NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`). The native app can send the request
without an Origin header. Success returns the same `{ "ok": true,
"token": "<opaque session token>" }` and `bjt_web_session` cookie as
password login, with the same 24-hour session lifetime. Responses include
400 (malformed request), 401 (invalid Google credential), 409 (email belongs
to another existing account; no automatic link), 429 (rate limited),
500 (server error), and 503 (Google login is not configured).

The iOS/Android app must store only the returned opaque application session
token in its secure credential store and use `Authorization: Bearer <token>`
for API requests. Do not treat the Google ID token as an app session. The
existing logout CSRF limitation above still applies to native clients;
clear the locally stored token on logout and report rejected server-side
revocation rather than claiming it succeeded.

POST /api/auth/logout revokes only the current server-side session, clears
the browser cookie, and returns { "ok": true }. Clear the locally stored
token before waiting for its response, cancel or discard in-flight authenticated
work, and do not retry it with the old token.

Login is rate-limited per client IP and normalized account email (default:
10 attempts per key per minute); 429 has { "error": "too many requests" }
and no Retry-After header. Back off with client-controlled delay. Invalid
credentials return 401 without distinguishing user status. Treat network
errors as unknown outcome: retain the token only after a parsed 200 response,
then call /api/auth/me to establish state. Serialize interactive login
attempts in the client; the API creates a new session for every successful
request and does not provide a login idempotency key.

GET /api/auth/me returns a flat `LearnerFullProfile` JSON object, not a
`profile` envelope. Its exact fields are defined in the canonical OpenAPI
schema.

## Endpoints with named handler test evidence (schemas not fully verified)

- Auth/profile: POST /api/auth/login, POST /api/auth/google, GET /api/auth/me,
  POST /api/auth/logout.
- Content search: GET /api/search. GET /api/content/lexemes and
  GET /api/content/lexemes/{id} have documented schemas but lack test evidence;
  both are marked `unverified` until corresponding handler contract tests exist.
- BJT learning: GET /api/levels, GET /api/levels/{code}, and
  GET /api/levels/{code}/lessons.
- Flashcards/decks/reviews, profile updates, card images/media, learning
  progress, exercises, examinations, bookmarks, grammar, kanji,
  gamification, notifications, subscriptions, and admin APIs are discovered
  in the inventory but their schemas remain unverified unless their individual
  OpenAPI operation says otherwise.

UUIDs are JSON strings in every documented identifier field; preserve them
exactly and do not coerce them to integers.

## Known gaps and legacy mismatches

/api/dictionary/*, /api/grammar/*, /api/decks/*, and the old Keycloak
Bearer-token descriptions are not registered by the Go router and are not
part of this contract. The current Go due-review route ignores deckId;
clients must not treat it as a server-side per-deck filter. All
source-discovered `/api` operations now appear in the canonical OpenAPI, but
an operation marked `unverified` remains unverified for iOS consumption.

The older *_API_CONTRACT.md files are retained only as legacy records and
are explicitly superseded; they must not be used to implement a client.

## Validation when changing a contract

1. Change the Go handler and its integration test first, when behavior changes.
2. Update docs/openapi.json with only observed method, path, schemas, status
   codes, security, and headers.
3. Run `cd apps/api-go && go run ./cmd/route-contract -root ../.. -check`,
   `jq empty docs/openapi.json`, and `go test ./internal/httpserver -run
   'TestOpenAPIHasEverySourceRegisteredAPIRoute|TestIOSOpenAPIContract' -count=1`.
4. Run the repository lifecycle gates before committing.
