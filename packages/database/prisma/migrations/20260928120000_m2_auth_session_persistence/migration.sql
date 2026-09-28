-- M2: Additive auth/session persistence tables for first-party Go auth.
-- Compatible with existing UserProfile (profile.user_profile) and AdminActor (authz.admin_actor).
-- No destructive changes. No plaintext passwords or session tokens stored.

-- Password credentials for learner users (linked to profile.user_profile)
CREATE TABLE auth.password_credential (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL,
    algorithm       VARCHAR(32) NOT NULL DEFAULT 'argon2id',
    hash_iterations INT         NOT NULL DEFAULT 5,
    memory_kib      INT         NOT NULL DEFAULT 7168,
    parallelism     INT         NOT NULL DEFAULT 1,
    hash_length     INT         NOT NULL DEFAULT 32,
    salt            BYTEA       NOT NULL,
    hashed_value    BYTEA       NOT NULL,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT pk_password_credential PRIMARY KEY (id),
    CONSTRAINT fk_password_credential_user FOREIGN KEY (user_id) REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    CONSTRAINT uq_password_credential_user UNIQUE (user_id)
);

CREATE INDEX idx_password_credential_user ON auth.password_credential(user_id);

-- Password credentials for admin actors (linked to authz.admin_actor)
CREATE TABLE auth.admin_password_credential (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    actor_id        UUID        NOT NULL,
    algorithm       VARCHAR(32) NOT NULL DEFAULT 'argon2id',
    hash_iterations INT         NOT NULL DEFAULT 5,
    memory_kib      INT         NOT NULL DEFAULT 7168,
    parallelism     INT         NOT NULL DEFAULT 1,
    hash_length     INT         NOT NULL DEFAULT 32,
    salt            BYTEA       NOT NULL,
    hashed_value    BYTEA       NOT NULL,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT pk_admin_password_credential PRIMARY KEY (id),
    CONSTRAINT fk_admin_password_credential_actor FOREIGN KEY (actor_id) REFERENCES authz.admin_actor(id) ON DELETE CASCADE,
    CONSTRAINT uq_admin_password_credential_actor UNIQUE (actor_id)
);

CREATE INDEX idx_admin_password_credential_actor ON auth.admin_password_credential(actor_id);

-- Opaque session tokens (digest-only; no plaintext token stored)
CREATE TABLE auth.session (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL,
    token_digest    VARCHAR(64) NOT NULL,
    expires_at      TIMESTAMPTZ(6) NOT NULL,
    revoked_at      TIMESTAMPTZ(6),
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    user_agent      VARCHAR(512),
    ip_address      VARCHAR(45),
    CONSTRAINT pk_session PRIMARY KEY (id),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    CONSTRAINT uq_session_token_digest UNIQUE (token_digest)
);

CREATE INDEX idx_session_user_expires ON auth.session(user_id, expires_at);
CREATE INDEX idx_session_token_digest ON auth.session(token_digest);

-- Admin sessions (separate from learner sessions)
CREATE TABLE auth.admin_session (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    actor_id        UUID        NOT NULL,
    token_digest    VARCHAR(64) NOT NULL,
    expires_at      TIMESTAMPTZ(6) NOT NULL,
    revoked_at      TIMESTAMPTZ(6),
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    user_agent      VARCHAR(512),
    ip_address      VARCHAR(45),
    CONSTRAINT pk_admin_session PRIMARY KEY (id),
    CONSTRAINT fk_admin_session_actor FOREIGN KEY (actor_id) REFERENCES authz.admin_actor(id) ON DELETE CASCADE,
    CONSTRAINT uq_admin_session_token_digest UNIQUE (token_digest)
);

CREATE INDEX idx_admin_session_actor_expires ON auth.admin_session(actor_id, expires_at);
CREATE INDEX idx_admin_session_token_digest ON auth.admin_session(token_digest);