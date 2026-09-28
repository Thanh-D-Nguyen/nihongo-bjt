# Go Auth Implementation Notes

## Random session token

Generate with `crypto/rand`.

Do not use UUIDv4 alone as the only bearer session secret unless entropy and implementation are explicitly acceptable.

## Token storage

Recommended:

```text
raw token → client cookie
SHA-256(raw token) → DB lookup key
```

SHA-256 is appropriate here for hashing a uniformly random high-entropy session token; it is **not** appropriate for hashing passwords.

## Passwords

Use Argon2id.

Keep implementation isolated so parameters can be upgraded.

## Constant-time behavior

Use library verification functions.

Avoid custom string comparisons for secrets.

## Request auth context

Middleware should attach a typed principal/user to `context.Context`.

Do not parse cookie independently in every handler.

## Authorization

Authentication answers:

> Who is this?

Authorization answers:

> May this user perform this action on this resource?

Do not conflate them.
