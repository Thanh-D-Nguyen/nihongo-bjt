# 04 — Data Migration Strategy (Rebaselined)

## Principle: additive first

Initial migrations must be additive.

Avoid early:

- dropping Keycloak-linked columns;
- renaming critical columns without compatibility layer;
- changing primary keys;
- rewriting all foreign keys.

## Identity model

Current application identity is linked to Keycloak via nullable unique columns:

```text
UserProfile.keycloakSubject  (auth schema)
AdminActor.keycloakSubject   (authz schema)
UserInvitation.keycloakUserId (profile schema)
```

The Go auth system introduces new identity/session tables alongside existing ones.

Recommended transition schema (exact names derived during M2):

```text
auth.users
  id                 internal stable UUID
  email              unique
  status             active/disabled/deleted
  created_at
  updated_at

auth.credentials
  user_id            FK → auth.users
  password_hash      Argon2id encoded
  password_scheme    argon2id / legacy_keycloak
  updated_at

auth.sessions
  id
  user_id
  token_hash         SHA-256 of opaque session token
  created_at
  expires_at
  last_seen_at
  revoked_at
  ip_metadata        optional, privacy-aware
  user_agent         optional

auth.email_tokens
  id
  user_id
  type               verification/reset
  token_hash
  expires_at
  used_at
  created_at

auth.oauth_accounts
  id
  user_id
  provider           google/apple/etc
  provider_subject
  email
  raw_profile        JSON
  created_at
  updated_at
```

Legacy `keycloakSubject` columns remain populated during transition for rollback.

## Identity reset decision

`LEGACY_CREDENTIAL_MIGRATION = NOT_REQUIRED`; `IDENTITY_RESET_APPROVED = TRUE` (2026-09-29). Fresh Go identity and Argon2id credentials replace legacy accounts. No legacy password verifier or credential export is required.

Do not delete identity data before the replacement auth path and Web/Admin/mobile clients are verified. Before reset, inventory foreign keys and account dependencies, create and test a restorable backup, preserve Keycloak configuration/export if safe, capture row counts, and review an exact reset manifest. Delete only identity/account-scoped rows in that manifest. Preserve authored content, media, curriculum, search source content, product configuration, and non-user reference data. Keep rollback artifacts through the stability window.

See `docs/03_auth_replacement_spec.md`.

## Migration rules

Every migration should answer:

- Is it backward compatible with NestJS?
- Can old production continue running after migration?
- Is rollback possible?
- Is data copied or moved?
- What validates row counts/invariants?
- What happens if execution is interrupted?

## Dual-read / dual-write

Use only when needed.

Prefer short migration windows over permanent dual-write complexity.

If dual-write is used:

- define authoritative source;
- define conflict policy;
- record metrics for divergence;
- include removal date.

## Database migrations in Go

Do not rewrite historical Prisma migrations just to use Go.

Transition strategy:

```text
existing Prisma migration history stays authoritative
              +
new Go migration tool begins from documented handoff point
```

Record the handoff migration/version.

Never allow Prisma and a Go migration tool to independently create conflicting migration histories.

## Verification queries

For each identity migration verify:

- total user count;
- unique email constraints;
- null/invalid IDs;
- duplicate external identities;
- credential coverage;
- role coverage;
- disabled/deleted account behavior;
- sessions referencing valid users.

Create SQL evidence scripts where useful.

## Backups

Before identity cutover:

- DB backup;
- restore test;
- migration dry-run on copy;
- post-migration validation.

A backup that has never been restored is not sufficient rollback evidence.

## Media metadata migration

Media object keys stored in PostgreSQL (`media_asset.objectKey`) remain stable across storage backend change.

Migration affects binary location only, not DB references.

See `docs/13_storage_architecture.md` and `docs/18_media_delivery_architecture.md`.
