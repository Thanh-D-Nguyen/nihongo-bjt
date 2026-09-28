// Package session provides opaque session persistence against auth.session and auth.admin_session.
package session

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSessionNotFound is returned when no active session matches the provided token.
var ErrSessionNotFound = errors.New("session: not found or inactive")

// ErrInvalidToken is returned when a raw token fails format validation.
var ErrInvalidToken = errors.New("session: invalid token format")

// ErrInvalidExpiry is returned when a requested expiry is not in the future.
var ErrInvalidExpiry = errors.New("session: expiry must be in the future")

// LearnerSession represents an active learner session row.
type LearnerSession struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
	CreatedAt time.Time
	UserAgent string
	IPAddress string
}

// AdminSession represents an active admin session row.
type AdminSession struct {
	ID        string
	ActorID   string
	ExpiresAt time.Time
	CreatedAt time.Time
	UserAgent string
	IPAddress string
}

// Store provides session CRUD against PostgreSQL. All methods use bounded contexts.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a session store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// CreateLearnerSession generates a new opaque token, persists its digest, and returns
// the raw token exactly once. The caller supplies user ID, optional metadata, and expiry.
// Returns ErrInvalidExpiry if expiresAt is not in the future.
func (s *Store) CreateLearnerSession(ctx context.Context, userID, userAgent, ipAddress string, expiresAt time.Time) (rawToken string, err error) {
	if !expiresAt.After(time.Now()) {
		return "", ErrInvalidExpiry
	}
	raw, digest, err := GenerateToken()
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO auth.session (user_id, token_digest, expires_at, user_agent, ip_address)
VALUES ($1, $2, $3, $4, $5)`
	_, err = s.db.Exec(ctx, q, userID, digest, expiresAt, nullString(userAgent), nullString(ipAddress))
	if err != nil {
		return "", fmt.Errorf("session: create learner: %w", err)
	}
	return raw, nil
}

// CreateAdminSession generates a new opaque token, persists its digest, and returns
// the raw token exactly once. The caller supplies actor ID, optional metadata, and expiry.
// Returns ErrInvalidExpiry if expiresAt is not in the future.
func (s *Store) CreateAdminSession(ctx context.Context, actorID, userAgent, ipAddress string, expiresAt time.Time) (rawToken string, err error) {
	if !expiresAt.After(time.Now()) {
		return "", ErrInvalidExpiry
	}
	raw, digest, err := GenerateToken()
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO auth.admin_session (actor_id, token_digest, expires_at, user_agent, ip_address)
VALUES ($1, $2, $3, $4, $5)`
	_, err = s.db.Exec(ctx, q, actorID, digest, expiresAt, nullString(userAgent), nullString(ipAddress))
	if err != nil {
		return "", fmt.Errorf("session: create admin: %w", err)
	}
	return raw, nil
}

// LookupLearnerSession finds an active (non-revoked, non-expired) learner session by raw token.
// The parent user_profile must have status='active'; disabled accounts return ErrSessionNotFound.
// Invalid or malformed tokens return ErrSessionNotFound to avoid leaking format details.
func (s *Store) LookupLearnerSession(ctx context.Context, rawToken string) (*LearnerSession, error) {
	if err := ValidateRawToken(rawToken); err != nil {
		return nil, ErrSessionNotFound
	}
	digest := HashToken(rawToken)
	return s.lookupLearnerByDigest(ctx, digest)
}

func (s *Store) lookupLearnerByDigest(ctx context.Context, digest string) (*LearnerSession, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT s.id, s.user_id, s.expires_at, s.created_at, COALESCE(s.user_agent,''), COALESCE(s.ip_address,'')
FROM auth.session s
JOIN profile.user_profile u ON u.id = s.user_id
WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'`
	row := s.db.QueryRow(ctx, q, digest)
	var sess LearnerSession
	if err := row.Scan(&sess.ID, &sess.UserID, &sess.ExpiresAt, &sess.CreatedAt, &sess.UserAgent, &sess.IPAddress); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("session: lookup learner: %w", err)
	}
	return &sess, nil
}

// LookupAdminSession finds an active admin session by raw token.
// The parent admin_actor must have status='active'; disabled actors return ErrSessionNotFound.
// Invalid or malformed tokens return ErrSessionNotFound to avoid leaking format details.
func (s *Store) LookupAdminSession(ctx context.Context, rawToken string) (*AdminSession, error) {
	if err := ValidateRawToken(rawToken); err != nil {
		return nil, ErrSessionNotFound
	}
	digest := HashToken(rawToken)
	return s.lookupAdminByDigest(ctx, digest)
}

func (s *Store) lookupAdminByDigest(ctx context.Context, digest string) (*AdminSession, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT s.id, s.actor_id, s.expires_at, s.created_at, COALESCE(s.user_agent,''), COALESCE(s.ip_address,'')
FROM auth.admin_session s
JOIN authz.admin_actor a ON a.id = s.actor_id
WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND a.status = 'active'`
	row := s.db.QueryRow(ctx, q, digest)
	var sess AdminSession
	if err := row.Scan(&sess.ID, &sess.ActorID, &sess.ExpiresAt, &sess.CreatedAt, &sess.UserAgent, &sess.IPAddress); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("session: lookup admin: %w", err)
	}
	return &sess, nil
}

// RevokeLearnerSession marks a learner session as revoked. Requires both session ID and
// owning user ID to prevent cross-user revocation. Returns nil if no matching row found.
func (s *Store) RevokeLearnerSession(ctx context.Context, sessionID, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.session SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`
	_, err := s.db.Exec(ctx, q, sessionID, userID)
	if err != nil {
		return fmt.Errorf("session: revoke learner: %w", err)
	}
	return nil
}

// RevokeAdminSession marks an admin session as revoked. Requires both session ID and
// owning actor ID to prevent cross-actor revocation. Returns nil if no matching row found.
func (s *Store) RevokeAdminSession(ctx context.Context, sessionID, actorID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.admin_session SET revoked_at = now() WHERE id = $1 AND actor_id = $2 AND revoked_at IS NULL`
	_, err := s.db.Exec(ctx, q, sessionID, actorID)
	if err != nil {
		return fmt.Errorf("session: revoke admin: %w", err)
	}
	return nil
}

// RevokeAllLearnerSessions revokes all active sessions for a user (e.g., password change).
// This is a trusted administrative operation; caller must verify authorization.
func (s *Store) RevokeAllLearnerSessions(ctx context.Context, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := s.db.Exec(ctx, q, userID)
	if err != nil {
		return fmt.Errorf("session: revoke all learner: %w", err)
	}
	return nil
}

// RevokeAllAdminSessions revokes all active sessions for an admin actor (e.g., account disable).
// This is a trusted administrative operation; caller must verify authorization.
func (s *Store) RevokeAllAdminSessions(ctx context.Context, actorID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.admin_session SET revoked_at = now() WHERE actor_id = $1 AND revoked_at IS NULL`
	_, err := s.db.Exec(ctx, q, actorID)
	if err != nil {
		return fmt.Errorf("session: revoke all admin: %w", err)
	}
	return nil
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
