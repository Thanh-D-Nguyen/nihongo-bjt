# iOS API Contract Guide

Use [the canonical OpenAPI document](../openapi.json) as the sole
machine-readable contract for Go endpoints verified for mobile. It is maintained
against apps/api-go/internal/httpserver; it is deliberately a verified subset,
not a promise that every repository route is ready for iOS.

Never infer a request field, response field, route alias, status code, or
authentication behavior from an endpoint name. Generate or hand-write client
types from the OpenAPI schemas, and do not consume a route omitted from that
file without first verifying its Go handler and adding it to the contract.

## Authentication

POST /api/auth/login accepts JSON { "email", "password" } and returns
{ "ok": true, "token": "<opaque session token>" }; it also sets the
bjt_web_session HttpOnly cookie. Store the opaque token securely and send
Authorization: Bearer <token> for authenticated mobile reads and writes. It
is not a JWT and there is no refresh-token endpoint. Sessions expire after
24 hours, and a missing, expired, revoked, malformed, or disabled-account
session returns 401 { "error": "unauthorized" }.

The Go CSRF middleware currently requires an allowlisted HTTP(S) Origin or
Referer on every unsafe request, including login and logout. A native client
that sends neither header configured in CORSOrigins receives 403; the
repository's current Flutter auth client sends neither. This is a
backend/mobile integration blocker, not a cue to bypass CSRF or invent a
native exception.

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

## Verified endpoints

- Auth/profile: POST /api/auth/login, GET /api/auth/me,
  POST /api/auth/logout.
- Content search: GET /api/search; canonical lexeme routes are
  GET /api/content/lexemes and GET /api/content/lexemes/{id}.
- BJT learning: GET /api/levels, GET /api/levels/{code}, and
  GET /api/levels/{code}/lessons.
- Flashcards: verified deck list/create/read/update/archive and due/review
  submission routes listed in the OpenAPI file.

UUIDs are JSON strings in every documented identifier field; preserve them
exactly and do not coerce them to integers.

## Known gaps and legacy mismatches

/api/dictionary/*, /api/grammar/*, /api/decks/*, and the old Keycloak
Bearer-token descriptions are not registered by the Go router and are not
part of this contract. The current Go due-review route ignores deckId;
clients must not treat it as a server-side per-deck filter. Exam/practice,
bookmarks, kanji, grammar, and every omitted endpoint remain undocumented or
unverified for iOS consumption.

The older *_API_CONTRACT.md files are retained only as legacy records and
are explicitly superseded; they must not be used to implement a client.

## Validation when changing a contract

1. Change the Go handler and its integration test first, when behavior changes.
2. Update docs/openapi.json with only observed method, path, schemas, status
   codes, security, and headers.
3. Run jq empty docs/openapi.json and cd apps/api-go && go test
   ./internal/httpserver -run 'TestIOSOpenAPIContract|TestLearnerLogin|TestAudit159Wave6LearnerAuthSessionLifecycle' -count=1.
4. Run the repository lifecycle gates before committing.
