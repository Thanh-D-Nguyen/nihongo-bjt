# M2 Identity/Auth Persistence + Keycloak Credential Gate Report

## Identification
- **Starting HEAD**: `13a54b4f59734243282ac06856863755116a5a5a`
- **Final HEAD**: (pending commit)
- **Branch**: `main`
- **Wave**: M2 — Identity/auth persistence + Keycloak credential investigation HARD GATE
- **Date**: 2026-09-28
- **Accepted M1 checkpoint**: `0cb530224b8f4cedaea37b442254c2835bc03d08`

## Scope
Additive auth/session persistence schema for first-party Go auth. Keycloak credential format HARD GATE investigation. No verifier/login endpoint implementation. No data migration execution. No destructive schema changes.

## Keycloak Credential HARD GATE Investigation

### Evidence Source
- **Keycloak version**: 26.2.4 (confirmed via `java -jar quarkus-run.jar --version` in local dev container)
- **Realm**: `nihongo-bjt`
- **Investigation method**: Disposable local Keycloak instance started on port 18081 with `start-dev --import-realm`; synthetic users created via Admin REST API; credential metadata inspected via `/admin/realms/{realm}/users/{id}/credentials` endpoint
- **Production evidence**: NOT AVAILABLE — realm export (`docker/keycloak/realm-export.json`) contains only dev fixture users with plaintext/temporary credentials (no algorithm/hash parameters). Production Keycloak DB not accessible from local environment. No production credential samples available.

### Credential Metadata Observed (Dev Instance, REDACTED)
Both synthetic users in the dev realm exhibited identical credential structure:
```
type: password
credentialData (inner JSON):
  algorithm: argon2
  hashIterations: 5
  additionalParameters:
    type: id          (Argon2id variant)
    version: 1.3      (Argon2 v1.3)
    memory: 7168      (KiB)
    parallelism: 1
    hashLength: 32    (bytes)
```
- **No salt field exposed** in Admin REST API credential response (salt is embedded in the stored hash per Argon2 spec)
- **No hashedSaltedValue field** in API response (Keycloak 26 uses `credentialData` JSON blob instead of legacy flat fields)
- **Realm password policy**: empty string (Keycloak 26 defaults to Argon2id when no explicit policy set)

### Credential Gate Classification
**GATED_UNKNOWN_PRODUCTION**

Rationale:
- Dev instance confirms Keycloak 26.2.4 default hashing is Argon2id v1.3 with specific parameters (memory=7168 KiB, parallelism=1, hashLength=32, iterations=5)
- This is sufficient to implement a compatible verifier IF production uses the same defaults
- However, production may have a custom password policy configured (different algorithm, different parameters, or even PBKDF2-SHA256 from older Keycloak versions)
- The realm export does NOT contain password policy configuration (field absent), so we cannot determine from repo artifacts alone whether production overrides defaults
- **M3 credential verifier implementation is BLOCKED until production credential format is confirmed**

### Migration Approach Recommendation (Conditional)
IF production uses Argon2id with the observed parameters: **Approach B — Legacy Verifier + Opportunistic Rehash**
- Implement Argon2id verifier matching Keycloak 26 defaults (argon2id, v1.3, m=7168, t=5, p=1, len=32)
- On successful legacy login, rehash with Go-native Argon2id (same or updated parameters) and store in `auth.password_credential`
- Allows zero-downtime migration without forced password reset

IF production uses different parameters or algorithm: **Approach A or C TBD after gate resolution**
- Must inspect actual production Keycloak DB or obtain admin export with credential metadata
- Do NOT guess parameters

### Next Action for Gate Resolution
1. Obtain read access to production Keycloak DB (`keycloak-db` service in GCP compose) or Admin REST API
2. Query `credential` table for `nihongo-bjt` realm users: `SELECT credential_data FROM credential WHERE type='password' LIMIT 5`
3. Parse `credentialData` JSON to extract algorithm/parameters
4. Compare with dev defaults; if match, gate PASS → Approach B; if differ, adjust verifier parameters accordingly
5. Document findings in M3 pre-work; do not proceed with verifier until resolved

## Persistence Schema Design

### Tables Added (all in `auth` schema, additive only)
| Table | Purpose | FK Target | Unique Constraints |
|---|---|---|---|
| `auth.password_credential` | Learner password hashes (Argon2id) | `profile.user_profile(id)` ON DELETE CASCADE | `(user_id)` — one credential per user |
| `auth.admin_password_credential` | Admin password hashes (Argon2id) | `authz.admin_actor(id)` ON DELETE CASCADE | `(actor_id)` — one credential per admin |
| `auth.session` | Learner opaque session tokens (digest-only) | `profile.user_profile(id)` ON DELETE CASCADE | `(token_digest)` — prevents token reuse |
| `auth.admin_session` | Admin opaque session tokens (digest-only) | `authz.admin_actor(id)` ON DELETE CASCADE | `(token_digest)` — prevents token reuse |

### Security Invariants Verified
- ✅ No plaintext password columns (negative check: 0 rows matching `password`/`secret`/`token` except `token_digest`)
- ✅ No raw session token storage (only SHA-256 digest stored)
- ✅ Salt and hashed_value are `BYTEA` (binary), not text (prevents accidental logging)
- ✅ All FK constraints use ON DELETE CASCADE (credential/session cleanup on user deletion)
- ✅ Unique constraints prevent duplicate credentials per user and token digest collisions
- ✅ Indexes on lookup paths: `user_id`, `actor_id`, `token_digest`, `(user_id, expires_at)`, `(actor_id, expires_at)`

### Prisma Models Added
- `PasswordCredential` → `auth.password_credential`
- `AdminPasswordCredential` → `auth.admin_password_credential`
- `Session` → `auth.session`
- `AdminSession` → `auth.admin_session`
- Reverse relations added to `UserProfile` (`passwordCredentials`, `sessions`) and `AdminActor` (`adminPasswordCredentials`, `adminSessions`)

### Migration File
- Path: `packages/database/prisma/migrations/20260928120000_m2_auth_session_persistence/migration.sql`
- Naming convention: follows existing `YYYYMMDDHHMMSS_description` pattern
- SQL is pure DDL (CREATE TABLE/INDEX); no data manipulation

## Integration Verification

### Prisma Schema Validation
```
$ pnpm exec prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

### Disposable Postgres Integration Test
- **Database**: `m2_auth_test` on `enterprise-postgres-dev` (pgvector/pgvector:pg16, port 5433)
- **Role**: `enterprise_migrator` (non-default superuser)
- **Prerequisite schemas created**: `profile`, `authz`, `auth` (with stub parent tables for FK references)
- **Migration applied**: All 4 tables + indexes + constraints created successfully
- **Table verification**: `\dt auth.*` confirmed 5 relations (4 new + `_prisma_migrations`)
- **Structure verification**: `\d auth.password_credential`, `\d auth.session`, etc. matched expected schema exactly
- **Constraint verification**: PK, FK, UNIQUE constraints all present and correctly defined
- **Security negative check**: 0 columns matching plaintext/token patterns
- **Cleanup**: `DROP DATABASE m2_auth_test` executed successfully

### Go Compatibility
- All tables use UUID PKs (`gen_random_uuid()`) compatible with pgx/v5
- Timestamps are `TIMESTAMPTZ(6)` compatible with Go `time.Time`
- Binary fields (`BYTEA`) map to Go `[]byte`
- VARCHAR fields map to Go `string`
- No enum types used (algorithm stored as VARCHAR for flexibility)
- Index names follow `idx_<table>_<columns>` convention for easy reference in Go queries

## Artifact List
| Artifact | Path | Status |
|---|---|---|
| Migration SQL | `packages/database/prisma/migrations/20260928120000_m2_auth_session_persistence/migration.sql` | CREATED |
| Prisma schema | `packages/database/prisma/schema.prisma` | MODIFIED (4 models + 2 reverse relations appended) |
| M2 report | `docs/migrations/go-backend-v2/reports/M2_AUTH_PERSISTENCE_REPORT.md` | CREATED |
| Orchestration state | `docs/migrations/go-backend-v2/ORCHESTRATION_STATE.md` | UPDATED |
| Migration status | `docs/migrations/go-backend-v2/templates/migration-status.md` | UPDATED |

## What Was NOT Done (By Design)
- ❌ No credential verifier implementation (blocked by GATED_UNKNOWN_PRODUCTION)
- ❌ No login/auth endpoint handlers (M3+ scope)
- ❌ No data migration from Keycloak to new tables (requires gate resolution first)
- ❌ No production Keycloak DB access (not safely accessible from local env)
- ❌ No forced password reset decision (insufficient evidence)
- ❌ No Google OAuth investigation (M4 scope)
- ❌ No MinIO/media changes (M7 scope)
- ❌ No NestJS/Keycloak retirement (M13+ scope)

## Gate Recommendation
**M2_PERSISTENCE_PASS_CREDENTIAL_GATE_PENDING**

Persistence work complete and verified:
- ✅ Additive schema designed and implemented
- ✅ Prisma validation PASS
- ✅ Disposable Postgres integration PASS (tables, constraints, security invariants)
- ✅ Go pgx compatibility documented
- ✅ No destructive changes, no secrets, no unrelated modifications

Credential gate pending:
- ⏳ Dev Keycloak 26.2.4 defaults confirmed (Argon2id v1.3, m=7168, t=5, p=1, len=32)
- ⏳ Production credential format UNVERIFIED (realm export lacks password policy; production DB not accessible)
- ⏳ M3 credential verifier BLOCKED until production format confirmed
- ⏳ Recommended approach conditional: B (legacy verifier + rehash) IF production matches dev defaults

## Rollback State
- Migration is additive only; dropping the 4 new tables restores prior state
- No existing tables modified or dropped
- No data migrated; UserProfile/AdminActor unchanged
- Keycloak integration untouched
- Rollback = `DROP TABLE auth.session, auth.admin_session, auth.password_credential, auth.admin_password_credential CASCADE`

## Next Wave (M3) Restrictions
M3 may proceed with:
- Go HTTP handler scaffolding (non-auth endpoints)
- Session middleware skeleton (without verifier)
- Token generation/storage utilities

M3 MUST NOT proceed with:
- Password verifier implementation (until credential gate resolved)
- Login endpoint accepting passwords
- Credential migration logic
- Any code that assumes specific hash algorithm/parameters

Gate resolution action: Inspect production Keycloak DB `credential` table or obtain admin API access to confirm algorithm/parameters before implementing verifier.