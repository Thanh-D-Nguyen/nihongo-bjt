// Package media provides media asset storage and retrieval.
package media

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Asset represents a stored media asset's metadata.
type Asset struct {
	ID               string    `json:"id"`
	ContentType      string    `json:"contentType"`
	SizeBytes        int64     `json:"sizeBytes"`
	StorageKey       string    `json:"-"`
	OriginalFilename string    `json:"-"`
	UploadedBy       *string   `json:"-"`
	CreatedAt        time.Time `json:"createdAt"`
}

// Store manages media asset metadata in PostgreSQL.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a new media Store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// CreateAsset inserts a new media.asset row and returns its UUID.
func (s *Store) CreateAsset(ctx context.Context, contentType string, sizeBytes int64, storageKey string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx,
		`INSERT INTO media.asset (object_key, mime_type, byte_size, updated_at)
		 VALUES ($1, $2, $3, now())
		 RETURNING id`,
		storageKey, contentType, sizeBytes,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("media: insert asset: %w", err)
	}
	return id, nil
}

// CreateAssetWithMetadata inserts a new media.asset row with full metadata and returns its UUID.
func (s *Store) CreateAssetWithMetadata(ctx context.Context, contentType string, sizeBytes int64, originalFilename string, uploadedBy string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var id string
	var uploadedByVal *string
	if uploadedBy != "" {
		uploadedByVal = &uploadedBy
	}
	// Insert with a placeholder object_key; after getting the DB-generated id,
	// update object_key to match id so blob storage key == asset id.
	err := s.db.QueryRow(ctx,
		`INSERT INTO media.asset (object_key, mime_type, byte_size, owner_user_id, updated_at)
		 VALUES (gen_random_uuid()::text, $1, $2, $3, now())
		 RETURNING id`,
		contentType, sizeBytes, uploadedByVal,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("media: insert asset with metadata: %w", err)
	}
	// Set object_key = id so the blob writer key matches GetAsset lookup.
	_, err = s.db.Exec(ctx, `UPDATE media.asset SET object_key = $1 WHERE id = $1`, id)
	if err != nil {
		return "", fmt.Errorf("media: set object_key to id: %w", err)
	}
	if err != nil {
		return "", fmt.Errorf("media: insert asset with metadata: %w", err)
	}
	return id, nil
}

// GetAsset retrieves a media asset by ID. Returns nil, nil if not found.
func (s *Store) GetAsset(ctx context.Context, id string) (*Asset, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	a := &Asset{}
	err := s.db.QueryRow(ctx,
		`SELECT id, mime_type, byte_size, object_key, owner_user_id, created_at
		 FROM media.asset
		 WHERE id = $1`,
		id,
	).Scan(&a.ID, &a.ContentType, &a.SizeBytes, &a.StorageKey, &a.UploadedBy, &a.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("media: get asset: %w", err)
	}
	return a, nil
}

// UpdateAssetSize updates the size_bytes column for an asset.
func (s *Store) UpdateAssetSize(ctx context.Context, id string, sizeBytes int64) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := s.db.Exec(ctx, `UPDATE media.asset SET byte_size = $1, updated_at = now() WHERE id = $2`, sizeBytes, id)
	if err != nil {
		return fmt.Errorf("media: update asset size: %w", err)
	}
	return nil
}

// DeleteAsset removes a media asset row by ID. Used for cleanup on upload failure.
func (s *Store) DeleteAsset(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := s.db.Exec(ctx, `DELETE FROM media.asset WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("media: delete asset: %w", err)
	}
	return nil
}
