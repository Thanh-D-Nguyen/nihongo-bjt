# 08 — Rollout and Rollback (Rebaselined)

## Core strategy

Keep the existing production path intact until the Go path is proven.

Avoid DNS cutover as the first production test.

## Rollout stages

### 1. Local/dev

Go runs beside Nest.

### 2. CI

Both stacks build/test.

### 3. Oracle staging/prod-like

Deploy:

- Go;
- existing dependencies;
- controlled copy/test data.

### 4. Shadow/parallel validation

Where safe, compare read endpoints.

Never duplicate unsafe writes blindly.

### 5. Controlled caller cutover

Switch web/admin/mobile by domain or feature flag where practical.

### 6. Stability window

Monitor before retiring old path.

### 7. Disable old service

Stop routing traffic to Keycloak/Nest/MinIO but keep rollback artifacts.

### 8. Delete later

Remove images/config/data only after rollback window closes.

## Rollback must exist at each wave

Examples:

```text
frontend auth toggle back to Keycloak
route proxy back to Nest
DB additive schema retained
old containers restartable
legacy user mapping retained
MinIO data retained
Keycloak realm export retained
```

## Database rollback philosophy

Application rollback is often safer than destructive down-migration.

If a migration only adds tables/columns, older app can usually ignore them.

Prefer that over dropping production data to "rollback schema".

## Password migration rollback

Never design a migration that leaves users unable to authenticate if Go is rolled back.

If new hashes are created, preserve enough mapping/state for rollback during transition.

The password migration approach remains UNDECIDED until M2 credential investigation completes. Whatever approach is chosen must include explicit rollback semantics.

## Keycloak deletion

Keycloak must first enter:

```text
unused but recoverable
```

before:

```text
deleted
```

All clients (web, admin, mobile, realtime) must be migrated before disable.

## MinIO deletion

MinIO must first enter:

```text
unused but recoverable
```

Media reconciliation must PASS before disable.

## NestJS deletion

NestJS must first enter:

```text
unused but recoverable
```

All HTTP APIs, background jobs, webhooks, image processing, and realtime must be migrated before disable.

## Production cutover checklist

- DB backup complete;
- restore tested;
- Go release immutable/tagged;
- old release restartable;
- health checks green;
- auth tests green (web, admin, mobile);
- critical learner tests green;
- media upload/download tests green;
- background job execution verified;
- realtime connectivity verified;
- no unexplained error-rate increase;
- rollback command documented;
- operator knows how to execute rollback.