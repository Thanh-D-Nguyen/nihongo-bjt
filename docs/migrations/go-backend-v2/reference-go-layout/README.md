# Reference Go Layout

This folder is architectural guidance, not a ready-to-copy application.

GhostCLI must adapt package boundaries to the real KotobaWork domains.

Suggested layout:

```text
cmd/api/main.go

internal/app/
internal/config/
internal/httpserver/
internal/httpserver/middleware/
internal/auth/
internal/users/
internal/bjt/
internal/practice/
internal/exams/
internal/progress/
internal/admin/
internal/search/
internal/storage/
internal/postgres/
internal/redisx/
internal/observability/

migrations/
sql/
```

## Composition

`main.go` should:

1. parse/validate config;
2. configure logger;
3. open PostgreSQL;
4. open Redis if required;
5. initialize repositories;
6. initialize domain services;
7. initialize handlers/router;
8. start HTTP server;
9. handle SIGTERM/SIGINT;
10. graceful shutdown.

Avoid global singleton service locators.

## Handler rule

Handlers:

- parse input;
- authenticate/authorize via middleware/context;
- call service;
- map result/error to HTTP.

Business rules should not live primarily in handlers.

## Data access

Prefer `pgx` and explicit SQL.

Use `sqlc` where it improves correctness/productivity.

Do not auto-generate an ORM abstraction just to imitate Prisma.
