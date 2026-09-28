# M2 Identity/Auth Persistence + Keycloak Credential Gate Report

## Identification
- **Starting HEAD**: `13a54b4f59734243282ac06856863755116a5a5a`
- **Initial M2 commit**: `37e0b68c49712fe3665a0e847cc6ce6221b4ed9a` (REVISE after independent review)
- **Accepted persistence checkpoint**: `9c98bad90628d1ca24f71c3034aa3d4a63bf8851` (credential gate pending)
- **Branch**: `main`
- **Wave**: M2 — Identity/auth persistence + Keycloak credential investigation HARD GATE
- **Date**: 2026-09-28
- **Accepted M1 checkpoint**: `0cb530224b8f4cedaea37b442254c2835bc03d08`

## Scope
Additive auth/session persistence schema for first-party Go auth. Keycloak credential format HARD GATE investigation. No verifier/login endpoint implementation. No data migration execution. No destructive schema changes.

## Repair Summary (REVISE of 37e0b68c)

Independent review identified six blocking findings. All addressed:

1. **Removed hardcoded Argon2 defaults**: Migration SQL and Prisma models no longer carry default values for algorithm, iterations, memory, parallelism, or hash_length. These columns are now NOT NULL without defaults; M3+ insert must supply explicit values. Added `algorithm_version VARCHAR(16)` nullable column for self-describing hash metadata. Added CHECK constraints (`chk_password_credential_params`, `chk_admin_password_credential_params`) enforcing positive parameter values, non-empty salt/hash, and non-empty algorithm string.

2. **Rollback guidance corrected**: Removed `DROP TABLE ... CASCADE` recommendation. Rollback is now code-level only (leave additive tables intact). Optional DROP documented only for empty disposable/test databases after data verification and without CASCADE. Post-adoption table deletion requires a separately validated data-preserving migration.

3. **Postgres 17 integration verification**: Full Prisma migration chain attempted on disposable `postgres:17-alpine` container. Failed at migration `20260425020754_phase_00_data_import` (PRE_EXISTING: references `content_import_error` relation that doesn't exist yet in chain order). Classified as PRE_EXISTING historical issue unrelated to M2. M2 migration separately verified on fresh Postgres 17 with prerequisite schemas and stub parent tables: all 4 tables created, CHECK constraints active, no redundant indexes, no defaults on algo params, `algorithm_version` column present, security negative check clean.

4. **Redundant indexes removed**: Dropped secondary B-tree indexes on `password_credential.user_id`, `admin_password_credential.actor_id`, `session.token_digest`, and `admin_session.token_digest`. These columns already have UNIQUE constraints which create implicit unique indexes. Retained composite expiry indexes (`idx_session_user_expires`, `idx_admin_session_actor_expires`).

5. **Checkpoint metadata**: Initial M2 commit `37e0b68c` was revised in `9c98bad9`; credential gate remains pending.

6. **Credential metadata accuracy**: Removed inference "salt is embedded in stored hash per Argon2 spec" — this was inferred from Admin REST API omission, not observed from DB storage format. Rephrased to state only what was directly observed: Admin REST API credential response does not expose a separate salt field; the internal DB storage format was not directly inspected.

## Keycloak Credential HARD GATE Investigation

### Evidence Source
- **Keycloak version**: 26.2.4 (confirmed via local dev container)
- **Realm**: `nihongo-bjt`
- **Investigation method**: Local dev Keycloak instance; synthetic users created via Admin REST API; credential metadata inspected via `/admin/realms/{realm}/users/{id}/credentials` endpoint
- **Production evidence**: NOT AVAILABLE — realm export (`docker/keycloak/realm-export.json`) contains only dev fixture users with temporary credentials. Production Keycloak DB not accessible from local environment.

### Credential Metadata Observed (Dev Instance Only)
Both synthetic users in the dev realm exhibited identical credential structure:
```
type: password
credentialData (inner JSON):
  algorithm: argon2
  hashIterations: 5
  additionalParameters:
    type: id (Argon2id variant indicator)
    version: 1.3
    memory: 7168 (KiB)
    parallelism: 1
    hashLength: 32 (bytes)
```
- Admin REST API credential response does not expose a separate salt field
- Internal DB storage format was NOT directly inspected; the above reflects only the Admin REST API metadata representation
- Realm password policy: empty string (Keycloak 26 defaults to Argon2id when no explicit policy set)
- **This is LOCAL DEV metadata only, not production proof**

### Credential Gate Classification
**GATED_UNKNOWN_PRODUCTION**

Rationale:
- Dev instance confirms Keycloak 26.2.4 default hashing uses Argon2id v1.3 with specific parameters
- Production may have a custom password policy configured (different algorithm, different parameters, or PBKDF2-SHA256 from older Keycloak versions)
- The realm export does NOT contain password policy configuration
- **M3 credential verifier implementation is BLOCKED until production credential format is confirmed**

### Next Action for Gate Resolution
1. Obtain read access to production Keycloak DB (`keycloak-db` service in GCP compose) or Admin REST API
2. Query `credential` table for `nihongo-bjt` realm users: inspect `credential_data` column metadata (algorithm/parameters only; NEVER extract or log hash/salt values)
3. Compare with dev defaults; if match, gate PASS → Approach B; if differ, adjust accordingly
4. Document findings in M3 pre-work; do not proceed with verifier until resolved

## Persistence Schema Design (Revised)

### Tables Added (all in `auth` schema, additive only)
| Table | Purpose | FK Target | Unique Constraints |
|---|---|---|---|
| `auth.password_credential` | Learner password hashes | `profile.user_profile(id)` ON DELETE CASCADE | `(user_id)` — one credential per user |
| `auth.admin_password_credential` | Admin password hashes | `authz.admin_actor(id)` ON DELETE CASCADE | `(actor_id)` — one credential per admin |
| `auth.session` | Learner opaque session tokens (digest-only) | `profile.user_profile(id)` ON DELETE CASCADE | `(token_digest)` |
| `auth.admin_session` | Admin opaque session tokens (digest-only) | `authz.admin_actor(id)` ON DELETE CASCADE | `(token_digest)` |

### Column Design Decisions
- **No algorithm/parameter defaults**: The algorithm and numeric hash parameter columns are NOT NULL without defaults; `algorithm_version` is nullable without a default. M3+ code must supply explicit values at insert time. This prevents silent conflation of source (Keycloak) and target (Go) parameters.
- **`algorithm_version`**: Nullable VARCHAR(16) for hash format versioning (e.g., "1.3" for Argon2 v1.3). Enables future algorithm agility without schema changes.
- **CHECK constraints**: `chk_password_credential_params` and `chk_admin_password_credential_params` enforce `hash_iterations > 0`, `memory_kib > 0`, `parallelism > 0`, `hash_length > 0`, `octet_length(salt) > 0`, `octet_length(hashed_value) > 0`, and `algorithm <> ''`.
- **Binary fields**: `salt` and `hashed_value` are BYTEA (not text) to prevent accidental logging.
- **Session tokens**: Only SHA-256 digest stored (VARCHAR 64); no raw tokens.

### Indexes (Revised)
| Index | Table | Columns | Rationale |
|---|---|---|---|
| `idx_session_user_expires` | `auth.session` | `(user_id, expires_at)` | Composite lookup for user's active sessions |
| `idx_admin_session_actor_expires` | `auth.admin_session` | `(actor_id, expires_at)` | Composite lookup for admin's active sessions |
| PK + UNIQUE constraint indexes | all 4 tables | implicit | Created automatically by PostgreSQL |

Removed: `idx_password_credential_user`, `idx_admin_password_credential_actor`, `idx_session_token_digest`, `idx_admin_session_token_digest` — redundant with UNIQUE constraint implicit indexes.

### Security Invariants Verified
- ✅ No plaintext password columns (negative check: 0 rows matching password/secret/token patterns except token_digest)
- ✅ No raw session token storage (only SHA-256 digest)
- ✅ Salt and hashed_value are BYTEA (binary)
- ✅ CHECK constraints enforce positive parameters and non-empty binary fields
- ✅ All FK constraints use ON DELETE CASCADE
- ✅ Unique constraints prevent duplicate credentials per user and token digest collisions
- ✅ No algorithm/parameter defaults that could silently produce weak hashes

### Prisma Models (Revised)
- `PasswordCredential` → `auth.password_credential` (no defaults on algo params, `algorithmVersion` added, no redundant index)
- `AdminPasswordCredential` → `auth.admin_password_credential` (same changes)
- `Session` → `auth.session` (no redundant token_digest index)
- `AdminSession` → `auth.admin_session` (no redundant token_digest index)
- Reverse relations on `UserProfile` (`passwordCredentials`, `sessions`) and `AdminActor` (`adminPasswordCredentials`, `adminSessions`)

### Migration File
- Path: `packages/database/prisma/migrations/20260928120000_m2_auth_session_persistence/migration.sql`
- Pure DDL (CREATE TABLE/INDEX); no data manipulation

## Integration Verification (Revised)

### Prisma Schema Validation
```
$ pnpm exec prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

### Full Migration Chain on Postgres 17
- **Container**: `postgres:17-alpine` (disposable, port 15499)
- **Result**: FAILED at migration `20260425020754_phase_00_data_import`
- **Error**: `relation "content_import_error" does not exist` (SQLSTATE 42P01)
- **Classification**: **PRE_EXISTING** — historical migration ordering issue unrelated to M2
- **Action**: M2 migration verified separately below

### Isolated M2 Migration on Postgres 17
- **Container**: `postgres:17-alpine` (disposable, port 15498)
- **Prerequisite schemas**: `profile`, `authz`, `auth` created with stub parent tables
- **Migration applied**: All 4 tables + 2 composite indexes + CHECK constraints created successfully
- **Table verification**: `\dt auth.*` confirmed 4 new tables
- **CHECK constraint verification**: Both `chk_password_credential_params` and `chk_admin_password_credential_params` present with correct definitions
- **Index verification**: 10 indexes total (4 PK + 4 UNIQUE + 2 composite expiry); no redundant secondary indexes
- **Column defaults verification**: `algorithm`, `hash_iterations`, `memory_kib`, `parallelism`, `hash_length` all have NO defaults (empty column_default)
- **algorithm_version column**: Present as VARCHAR(16), nullable
- **Security negative check**: 0 columns matching plaintext/token patterns
- **Cleanup**: Container stopped and removed

### Go Compatibility
- UUID PKs (`gen_random_uuid()`) → pgx/v5 compatible
- TIMESTAMPTZ(6) → Go `time.Time` compatible
- BYTEA → Go `[]byte` compatible
- VARCHAR → Go
