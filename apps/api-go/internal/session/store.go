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

// RotateLearnerSession atomically revokes the current session and creates a new one
// within a single transaction. The old raw token is validated and resolved to confirm
// ownership before rotation. Returns the new raw token exactly once.
// Rejects malformed, expired, revoked, or disabled-account sessions.
func (s *Store) RotateLearnerSession(ctx context.Context, oldRawToken, userAgent, ipAddress string, newExpiry time.Time) (newRawToken string, err error) {
	if err := ValidateRawToken(oldRawToken); err != nil {
		return "", ErrInvalidToken
	}
	if !newExpiry.After(time.Now()) {
		return "", ErrInvalidExpiry
	}

	oldDigest := HashToken(oldRawToken)
	newRaw, newDigest, err := GenerateToken()
	if err != nil {
		return "", err
	}

	txCtx, txCancel := context.WithTimeout(ctx, 5*time.Second)
	defer txCancel()

	tx, err := s.db.BeginTx(txCtx, pgx.TxOptions{})
	if err != nil {
		return "", fmt.Errorf("session: rotate learner begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(txCtx)
		}
	}()

	// Resolve old session with owner/status check inside the transaction.
	var sessID, userID string
	const lookupQ = `SELECT s.id, s.user_id FROM auth.session s
		JOIN profile.user_profile u ON u.id = s.user_id
		WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'
		FOR UPDATE`
	row := tx.QueryRow(txCtx, lookupQ, oldDigest)
	if scanErr := row.Scan(&sessID, &userID); scanErr != nil {
		if errors.Is(scanErr, pgx.ErrNoRows) {
			return "", ErrSessionNotFound
		}
		return "", fmt.Errorf("session: rotate learner lookup: %w", scanErr)
	}

	// Revoke old session.
	const revokeQ = `UPDATE auth.session SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`
	tag, err := tx.Exec(txCtx, revokeQ, sessID, userID)
	if err != nil {
		return "", fmt.Errorf("session: rotate learner revoke: %w", err)
	}
	if tag.RowsAffected() == 0 {
		// Concurrent rotation already revoked this session.
		return "", ErrSessionNotFound
	}

	// Insert new session preserving owner and metadata.
	const insertQ = `INSERT INTO auth.session (user_id, token_digest, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5)`
	_, err = tx.Exec(txCtx, insertQ, userID, newDigest, newExpiry, nullString(userAgent), nullString(ipAddress))
	if err != nil {
		return "", fmt.Errorf("session: rotate learner insert: %w", err)
	}

	if err := tx.Commit(txCtx); err != nil {
		return "", fmt.Errorf("session: rotate learner commit: %w", err)
	}
	return newRaw, nil
}

// RotateAdminSession atomically revokes the current admin session and creates a new one
// within a single transaction. The old raw token is validated and resolved to confirm
// ownership before rotation. Returns the new raw token exactly once.
// Rejects malformed, expired, revoked, or disabled-actor sessions.
func (s *Store) RotateAdminSession(ctx context.Context, oldRawToken, userAgent, ipAddress string, newExpiry time.Time) (newRawToken string, err error) {
	if err := ValidateRawToken(oldRawToken); err != nil {
		return "", ErrInvalidToken
	}
	if !newExpiry.After(time.Now()) {
		return "", ErrInvalidExpiry
	}

	oldDigest := HashToken(oldRawToken)
	newRaw, newDigest, err := GenerateToken()
	if err != nil {
		return "", err
	}

	txCtx, txCancel := context.WithTimeout(ctx, 5*time.Second)
	defer txCancel()

	tx, err := s.db.BeginTx(txCtx, pgx.TxOptions{})
	if err != nil {
		return "", fmt.Errorf("session: rotate admin begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(txCtx)
		}
	}()

	// Resolve old session with owner/status check inside the transaction.
	var sessID, actorID string
	const lookupQ = `SELECT s.id, s.actor_id FROM auth.admin_session s
		JOIN authz.admin_actor a ON a.id = s.actor_id
		WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND a.status = 'active'
		FOR UPDATE`
	row := tx.QueryRow(txCtx, lookupQ, oldDigest)
	if scanErr := row.Scan(&sessID, &actorID); scanErr != nil {
		if errors.Is(scanErr, pgx.ErrNoRows) {
			return "", ErrSessionNotFound
		}
		return "", fmt.Errorf("session: rotate admin lookup: %w", scanErr)
	}

	// Revoke old session.
	const revokeQ = `UPDATE auth.admin_session SET revoked_at = now() WHERE id = $1 AND actor_id = $2 AND revoked_at IS NULL`
	tag, err := tx.Exec(txCtx, revokeQ, sessID, actorID)
	if err != nil {
		return "", fmt.Errorf("session: rotate admin revoke: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return "", ErrSessionNotFound
	}

	// Insert new session preserving owner and metadata.
	const insertQ = `INSERT INTO auth.admin_session (actor_id, token_digest, expires_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5)`
	_, err = tx.Exec(txCtx, insertQ, actorID, newDigest, newExpiry, nullString(userAgent), nullString(ipAddress))
	if err != nil {
		return "", fmt.Errorf("session: rotate admin insert: %w", err)
	}

	if err := tx.Commit(txCtx); err != nil {
		return "", fmt.Errorf("session: rotate admin commit: %w", err)
	}
	return newRaw, nil
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
