-- Migration: 002_account_lifecycle
-- Adds password reset token table for forgot-password / reset-password flow.
-- Tokens are single-use, time-limited, and stored as SHA-256 hashes to prevent
-- leakage if the database is compromised.

CREATE TABLE IF NOT EXISTS auth.password_reset_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profile.user_profile(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ(6) NOT NULL,
    used_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Index for fast lookup by token hash during reset-password validation.
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash
    ON auth.password_reset_token(token_hash);

-- Index for cleanup of expired tokens per user.
CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_expires
    ON auth.password_reset_token(user_id, expires_at);