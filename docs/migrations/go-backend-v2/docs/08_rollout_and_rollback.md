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

## Identity-reset rollback (decision 2026-09-29)

Legacy credential migration is NOT_REQUIRED and the user approved resetting identity/account-scoped data. Preserve non-user content and media. Do not reset legacy identities until fresh Go auth and affected clients are verified, a database backup has been restored successfully in a test, and an exact identity-only reset manifest has passed independent review.

Keep GCP/Keycloak recoverable during the stability window. Fresh Go accounts may not authenticate against old Keycloak if traffic is rolled back, so the rollback procedure must state how the backed-up account state and Go auth path are restored or retained. Do not claim seamless account rollback without a test.

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
