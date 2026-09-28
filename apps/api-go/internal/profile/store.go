// Package profile provides read-only access to learner public profile data.
package profile

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrProfileNotFound is returned when no active user profile matches the given ID.
var ErrProfileNotFound = errors.New("profile: not found or inactive")

// LearnerPublicProfile contains only the public fields exposed by GET /api/auth/me.
// This mirrors the NestJS KeycloakUserService.getLearnerPublicProfile select shape.
// Nullable fields use pointer types WITHOUT omitempty so that JSON serialization
// includes them as null when the DB value is NULL, matching Prisma's behavior.
type LearnerPublicProfile struct {
	ID                 string  `json:"id"`
	DisplayName        string  `json:"displayName"`
	Email              *string `json:"email"`
	Status             string  `json:"status"`
	KeycloakSubject    *string `json:"keycloakSubject"`
	AvatarAssetID      *string `json:"avatarAssetId"`
	CoverAssetID       *string `json:"coverAssetId"`
	ThemeMode          *string `json:"themeMode"`
	UILocale           *string `json:"uiLocale"`
	ExplanationLocale  *string `json:"explanationLocale"`
	DensityPreference  *string `json:"densityPreference"`
	FontSizePreference *string `json:"fontSizePreference"`
	SharePostcardOptIn bool    `json:"sharePostcardOptIn"`
}

// Store provides read-only profile access against PostgreSQL.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a profile store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetLearnerPublicProfile loads the public learner profile for an active user.
// Returns ErrProfileNotFound if the user does not exist or has status != 'active'.
func (s *Store) GetLearnerPublicProfile(ctx context.Context, userID string) (*LearnerPublicProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, display_name, email, status, keycloak_subject,
		avatar_asset_id, cover_asset_id, theme_mode, ui_locale, explanation_locale,
		density_preference, font_size_preference, share_postcard_opt_in
	FROM profile.user_profile
	WHERE id = $1 AND status = 'active'`

	row := s.db.QueryRow(ctx, q, userID)
	var p LearnerPublicProfile
	if err := row.Scan(
		&p.ID, &p.DisplayName, &p.Email, &p.Status, &p.KeycloakSubject,
		&p.AvatarAssetID, &p.CoverAssetID, &p.ThemeMode, &p.UILocale, &p.ExplanationLocale,
		&p.DensityPreference, &p.FontSizePreference, &p.SharePostcardOptIn,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("profile: get learner: %w", err)
	}
	return &p, nil
}
