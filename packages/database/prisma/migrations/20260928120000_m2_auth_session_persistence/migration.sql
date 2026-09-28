-- M2: Additive auth/session persistence tables for first-party Go auth.
-- Compatible with existing UserProfile (profile.user_profile) and AdminActor (authz.admin_actor).
-- No destructive changes. No plaintext passwords or session tokens stored.
-- Algorithm/parameter columns have NO DEFAULTS; M3+ insert must supply explicit values.
-- CHECK constraints enforce positive parameters and non-empty salt/hash.

-- Password credentials for learner users (linked to profile.user_profile)
CREATE TABLE auth.password_credential (
    id                UUID           NOT NULL DEFAULT gen_random_uuid(),
    user_id           UUID           NOT NULL,
    algorithm         VARCHAR(32)    NOT NULL,
    algorithm_version VARCHAR(16),
    hash_iterations   INT            NOT NULL,
    memory_kib        INT            NOT NULL,
    parallelism       INT            NOT NULL,
    hash_length       INT            NOT NULL,
    salt              BYTEA          NOT NULL,
    hashed_value      BYTEA          NOT NULL,
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT pk_password_credential PRIMARY KEY (id),
    CONSTRAINT fk_password_credential_user FOREIGN KEY (user_id) REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    CONSTRAINT uq_password_credential_user UNIQUE (user_id),
    CONSTRAINT chk_password_credential_params CHECK (
        hash_iterations > 0 AND memory_kib > 0 AND parallelism > 0 AND hash_length > 0
        AND octet_length(salt) > 0 AND octet_length(hashed_value) > 0
        AND algorithm <> ''
    )
);

-- Password credentials for admin actors (linked to authz.admin_actor)
CREATE TABLE auth.admin_password_credential (
    id                UUID           NOT NULL DEFAULT gen_random_uuid(),
    actor_id          UUID           NOT NULL,
    algorithm         VARCHAR(32)    NOT NULL,
    algorithm_version VARCHAR(16),
    hash_iterations   INT            NOT NULL,
    memory_kib        INT            NOT NULL,
    parallelism       INT            NOT NULL,
    hash_length       INT            NOT NULL,
    salt              BYTEA          NOT NULL,
    hashed_value      BYTEA          NOT NULL,
    created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT pk_admin_password_credential PRIMARY KEY (id),
    CONSTRAINT fk_admin_password_credential_actor FOREIGN KEY (actor_id) REFERENCES authz.admin_actor(id) ON DELETE CASCADE,
    CONSTRAINT uq_admin_password_credential_actor UNIQUE (actor_id),
    CONSTRAINT chk_admin_password_credential_params CHECK (
        hash_iterations > 0 AND memory_kib > 0 AND parallelism > 0 AND hash_length > 0
        AND octet_length(salt) > 0 AND octet_length(hashed_value) > 0
        AND algorithm <> ''
    )
);

-- Opaque session tokens (digest-only; no plaintext token stored)
CREATE TABLE auth.session (
    id           UUID           NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID           NOT NULL,
    token_digest VARCHAR(64)    NOT NULL,
    expires_at   TIMESTAMPTZ(6) NOT NULL,
    revoked_at   TIMESTAMPTZ(6),
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    user_agent   VARCHAR(512),
    ip_address   VARCHAR(45),
    CONSTRAINT pk_session PRIMARY KEY (id),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    CONSTRAINT uq_session_token_digest UNIQUE (token_digest)
);

CREATE INDEX idx_session_user_expires ON auth.session(user_id, expires_at);

-- Admin sessions (separate from learner sessions)
CREATE TABLE auth.admin_session (
    id           UUID           NOT NULL DEFAULT gen_random_uuid(),
    actor_id     UUID           NOT NULL,
    token_digest VARCHAR(64)    NOT NULL,
    expires_at   TIMESTAMPTZ(6) NOT NULL,
    revoked_at   TIMESTAMPTZ(6),
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    user_agent   VARCHAR(512),
    ip_address   VARCHAR(45),
    CONSTRAINT pk_admin_session PRIMARY KEY (id),
    CONSTRAINT fk_admin_session_actor FOREIGN KEY (actor_id) REFERENCES authz.admin_actor(id) ON DELETE CASCADE,
    CONSTRAINT uq_admin_session_token_digest UNIQUE (token_digest)
);

CREATE INDEX idx_admin_session_actor_expires ON auth.admin_session(actor_id, expires_at);