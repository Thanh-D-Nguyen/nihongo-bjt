// Package authlink provides access to one-time auth link codes for OAuth account linking.
package authlink

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrInvalidOrExpired is returned when a link code is not found, expired, or already used.
var ErrInvalidOrExpired = errors.New("authlink: invalid or expired code")

// ExchangeResult contains the user info returned after a successful code exchange.
type ExchangeResult struct {
	UserID      string  `json:"userId"`
	DisplayName string  `json:"displayName"`
	EmailMasked *string `json:"emailMasked"`
}

// Store provides access to auth.auth_link_code for OAuth linking flows.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates an auth link store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ExchangeCode validates a one-time link code, marks it used, and returns the associated user info.
// Returns ErrInvalidOrExpired if the code hash doesn't match any unused, unexpired row.
func (s *Store) ExchangeCode(ctx context.Context, rawCode string) (*ExchangeResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	hash := sha256.Sum256([]byte(rawCode))
	codeHash := hex.EncodeToString(hash[:])

	const q = `UPDATE auth.auth_link_code SET used_at = NOW()
WHERE id = (
	SELECT id FROM auth.auth_link_code
	WHERE code_hash = $1 AND expires_at > NOW() AND used_at IS NULL
	LIMIT 1
	FOR UPDATE SKIP LOCKED
)
RETURNING user_id`

	var userID string
	err := s.db.QueryRow(ctx, q, codeHash).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidOrExpired
		}
		return nil, fmt.Errorf("authlink: exchange code: %w", err)
	}

	// Fetch user profile for response
	const userQ = `SELECT display_name, email FROM profile.user_profile WHERE id = $1 AND status = 'active'`
	var displayName string
	var email *string
	if err := s.db.QueryRow(ctx, userQ, userID).Scan(&displayName, &email); err != nil {
		return nil, fmt.Errorf("authlink: fetch user after exchange: %w", err)
	}

	var masked *string
	if email != nil && *email != "" {
		m := maskEmail(*email)
		masked = &m
	}

	return &ExchangeResult{
		UserID:      userID,
		DisplayName: displayName,
		EmailMasked: masked,
	}, nil
}

// maskEmail returns a masked version of an email (e.g., "u***@example.com").
func maskEmail(email string) string {
	at := 0
	for i, c := range email {
		if c == '@' {
			at = i
			break
		}
	}
	if at <= 1 {
		return email
	}
	return string(email[0]) + "***" + email[at:]
}