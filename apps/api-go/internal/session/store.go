// Package session provides opaque session persistence against auth.session and auth.admin_session.
package session

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSessionNotFound is returned when no active session matches the provided digest.
var ErrSessionNotFound = errors.New("session: not found or inactive")

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

// CreateLearnerSession persists a new learner session. The caller supplies the pre-hashed token digest.
func (s *Store) CreateLearnerSession(ctx context.Context, userID, tokenDigest, userAgent, ipAddress string, expiresAt time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO auth.session (user_id, token_digest, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5)`
	_, err := s.db.Exec(ctx, q, userID, tokenDigest, expiresAt, nullString(userAgent), nullString(ipAddress))
	if err != nil {
		return fmt.Errorf("session: create learner: %w", err)
	}
	return nil
}

// CreateAdminSession persists a new admin session. The caller supplies the pre-hashed token digest.
func (s *Store) CreateAdminSession(ctx context.Context, actorID, tokenDigest, userAgent, ipAddress string, expiresAt time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO auth.admin_session (actor_id, token_digest, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5)`
	_, err := s.db.Exec(ctx, q, actorID, tokenDigest, expiresAt, nullString(userAgent), nullString(ipAddress))
	if err != nil {
		return fmt.Errorf("session: create admin: %w", err)
	}
	return nil
}

// LookupLearnerSession finds an active (non-revoked, non-expired) learner session by raw token.
// Comparison is constant-time via SHA-256 digest match.
func (s *Store) LookupLearnerSession(ctx context.Context, rawToken string) (*LearnerSession, error) {
	digest := HashToken(rawToken)
	return s.lookupLearnerByDigest(ctx, digest)
}

func (s *Store) lookupLearnerByDigest(ctx context.Context, digest string) (*LearnerSession, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, user_id, expires_at, created_at, COALESCE(user_agent,''), COALESCE(ip_address,'')
		FROM auth.session
		WHERE token_digest = $1 AND revoked_at IS NULL AND expires_at > now()`
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
func (s *Store) LookupAdminSession(ctx context.Context, rawToken string) (*AdminSession, error) {
	digest := HashToken(rawToken)
	return s.lookupAdminByDigest(ctx, digest)
}

func (s *Store) lookupAdminByDigest(ctx context.Context, digest string) (*AdminSession, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, actor_id, expires_at, created_at, COALESCE(user_agent,''), COALESCE(ip_address,'')
		FROM auth.admin_session
		WHERE token_digest = $1 AND revoked_at IS NULL AND expires_at > now()`
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

// RevokeLearnerSession marks a learner session as revoked by ID.
func (s *Store) RevokeLearnerSession(ctx context.Context, sessionID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.session SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`
	_, err := s.db.Exec(ctx, q, sessionID)
	if err != nil {
		return fmt.Errorf("session: revoke learner: %w", err)
	}
	return nil
}

// RevokeAdminSession marks an admin session as revoked by ID.
func (s *Store) RevokeAdminSession(ctx context.Context, sessionID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.admin_session SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`
	_, err := s.db.Exec(ctx, q, sessionID)
	if err != nil {
		return fmt.Errorf("session: revoke admin: %w", err)
	}
	return nil
}

// RevokeAllLearnerSessions revokes all active sessions for a user (e.g., password change).
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

// ConstantTimeDigestEqual compares two hex-encoded SHA-256 digests in constant time.
func ConstantTimeDigestEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
