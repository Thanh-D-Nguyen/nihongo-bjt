# 07 — Testing Strategy (Rebaselined)

Migration quality depends on behavior comparison, not only new Go unit tests.

## Test layers

### Unit

Use for:

- password/session utilities;
- authorization policy;
- domain pure logic;
- validation;
- parsers;
- deterministic transformations;
- streaming upload validation logic;
- object key sanitization;
- media path traversal prevention.

### Repository/DB integration

Run against real PostgreSQL.

Test:

- transaction boundaries;
- constraints;
- migrations;
- lock behavior where relevant;
- pagination/order semantics;
- auth session CRUD;
- RBAC permission loading;
- credential storage/retrieval.

### Auth integration

Cover:

```text
correct login
wrong password
unknown user
disabled user
expired session
revoked session
session rotation
logout
CSRF rejection
role denial
admin allow
reset token expiry
reset token replay
verification token replay
mobile PKCE flow
token refresh
concurrent session limits
```

### API contract

Compare Nest and Go responses for migrated endpoints.

Track differences explicitly.

Include media upload/download contract tests with the new streaming architecture.

### Frontend integration

Run learner/admin tests for:

- login;
- protected navigation;
- session expiry;
- logout;
- role denial;
- API errors;
- mobile auth flow (if applicable).

### E2E/browser

At least cover critical learner and admin journeys before Keycloak/Nest retirement.

### ARM64

Build/run target images for `linux/arm64`.

Do not wait until Oracle deployment to discover architecture issues.

### Performance

Measure:

- idle RSS;
- active RSS;
- p50/p95/p99 API latency;
- login password-hash latency;
- DB pool behavior;
- concurrent practice/exam endpoints;
- Meilisearch usage;
- CPU saturation;
- streaming upload throughput and memory;
- private media streaming throughput;
- WebSocket connection count and message latency.

Do not optimize from synthetic hello-world benchmarks.

## Required pre-cutover security regression

- session fixation;
- CSRF;
- authorization bypass;
- insecure direct object reference for user-scoped resources;
- admin endpoint exposure;
- reset token replay;
- user enumeration;
- brute-force limits;
- cookie flags;
- CORS/origin behavior;
- media path traversal;
- upload size/type enforcement;
- private media authorization;
- mobile PKCE validation;
- WebSocket connection authentication.

## Failure reporting

Every gate report must state:

```text
command
result
pass/fail count
environment
known skipped tests
whether failure is pre-existing
```

Never report a test suite as PASS if it was not run successfully.