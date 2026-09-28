# 01 — Repository Audit

The first migration artifact is a fact-based map of the existing application.

## Required inventory

Identify:

- monorepo/workspaces;
- learner web;
- admin web;
- NestJS API;
- Prisma/database layer;
- Keycloak integration;
- Redis usage;
- Meilisearch usage;
- MinIO usage;
- websocket/realtime implementation;
- background jobs / cron / queue workers;
- email provider;
- uploads;
- auth-related frontend middleware;
- reverse proxy;
- Docker topology;
- deployment pipelines;
- test topology.

## Commands

Use project-native package manager.

Useful non-destructive discovery:

```bash
find . -maxdepth 3 -name 'package.json' -o -name 'go.mod' -o -name 'Dockerfile*' -o -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml'
find . -maxdepth 4 \( -iname '*keycloak*' -o -iname '*auth*' -o -iname '*oidc*' \) | head -300
git grep -n -E 'Keycloak|keycloak|openid|OIDC|oauth|Authorization|Bearer|roles?|permissions?'
git grep -n -E 'redis|meilisearch|minio|socket\.io|websocket|cron|queue'
```

Do not rely on grep alone. Read matched source and tests.

## Route inventory

For every production-relevant endpoint record:

- method;
- public path;
- controller/handler;
- auth requirement;
- role/permission requirement;
- input schema;
- output schema;
- DB writes;
- external dependencies;
- frontend callers;
- tests;
- migration status.

Use `templates/api-compatibility-matrix.csv`.

## Auth inventory

Determine exactly:

- how users are created;
- where user ID originates;
- whether application tables store Keycloak `sub`;
- whether password hashes exist only in Keycloak;
- whether social login exists;
- whether refresh tokens are used;
- whether cookies or bearer tokens are used;
- session lifetime;
- role source;
- how admin is identified;
- account disable/delete behavior;
- email verification;
- reset password;
- logout;
- websocket auth.

Use `templates/auth-behavior-matrix.csv`.

## Data ownership map

Classify tables into:

```text
identity-owned
business-owned
shared/reference
generated/derived
temporary/cache
```

Do not introduce a second source of truth without an explicit transition plan.

## Baseline evidence

Capture before migration:

```text
git HEAD
test results
typecheck results
build result
current Docker images
current route count
current DB migration head
current auth flows
```

If a local/prod-like stack can run, capture:

```text
docker stats --no-stream
```

This is baseline only; do not optimize yet.
