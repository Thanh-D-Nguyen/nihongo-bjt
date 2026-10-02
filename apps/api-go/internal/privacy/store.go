// Package privacy provides access to learner privacy request data (GDPR-style flows).
package privacy

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when no privacy request matches the given criteria.
var ErrNotFound = errors.New("privacy: request not found")

// Request represents a learner privacy export/delete request.
type Request struct {
	ID            string     `json:"id"`
	UserID        string     `json:"userId"`
	Kind          string     `json:"kind"`
	Status        string     `json:"status"`
	ResultPayload *string    `json:"resultPayload,omitempty"`
	LastError     *string    `json:"lastError,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	CompletedAt   *time.Time `json:"completedAt,omitempty"`
}

// CreateInput contains validated fields for creating a privacy request.
type CreateInput struct {
	Kind string
}

// Store provides read/write access to profile.privacy_request.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a privacy store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ListRequests returns all privacy requests for a user, newest first.
func (s *Store) ListRequests(ctx context.Context, userID string) ([]Request, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, user_id, kind, status, result_payload::text, last_error, created_at, completed_at
FROM profile.privacy_request WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("privacy: list requests: %w", err)
	}
	defer rows.Close()

	var requests []Request
	for rows.Next() {
		var r Request
		if err := rows.Scan(&r.ID, &r.UserID, &r.Kind, &r.Status, &r.ResultPayload, &r.LastError, &r.CreatedAt, &r.CompletedAt); err != nil {
			return nil, fmt.Errorf("privacy: scan request: %w", err)
		}
		requests = append(requests, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("privacy: iterate requests: %w", err)
	}
	if requests == nil {
		requests = []Request{}
	}
	return requests, nil
}

// CreateRequest inserts a new privacy request with status=pending.
func (s *Store) CreateRequest(ctx context.Context, userID string, input CreateInput) (*Request, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO profile.privacy_request (user_id, kind, status)
VALUES ($1, $2, 'pending')
RETURNING id, user_id, kind, status, result_payload::text, last_error, created_at, completed_at`

	var r Request
	err := s.db.QueryRow(ctx, q, userID, input.Kind).Scan(
		&r.ID, &r.UserID, &r.Kind, &r.Status, &r.ResultPayload, &r.LastError, &r.CreatedAt, &r.CompletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("privacy: create request: %w", err)
	}
	return &r, nil
}
