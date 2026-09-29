// Package profile provides read-only access to learner public profile data.
package profile

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

// GetLearnerByEmail looks up an active learner by normalized email address.
// Returns nil, nil when no matching active user exists (caller must treat as unknown).
func (s *Store) GetLearnerByEmail(ctx context.Context, email string) (*LearnerPublicProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, display_name, email, status, keycloak_subject,
		cover_asset_id, theme_mode, density_preference, font_size_preference, share_postcard_opt_in
		FROM profile.user_profile
		WHERE lower(email) = $1 AND status = 'active'`
	row := s.db.QueryRow(ctx, q, email)
	var p LearnerPublicProfile
	if err := row.Scan(
		&p.ID, &p.DisplayName, &p.Email, &p.Status, &p.KeycloakSubject,
		&p.CoverAssetID, &p.ThemeMode, &p.DensityPreference, &p.FontSizePreference, &p.SharePostcardOptIn,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("profile: get learner by email: %w", err)
	}
	return &p, nil
}

// GetLearnerPublicProfile loads the public learner profile for an active user.
// Returns ErrProfileNotFound if the user does not exist or has status != 'active'.
func (s *Store) GetLearnerPublicProfile(ctx context.Context, userID string) (*LearnerPublicProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, display_name, email, status, keycloak_subject,
		cover_asset_id, theme_mode, density_preference, font_size_preference, share_postcard_opt_in
	FROM profile.user_profile
	WHERE id = $1 AND status = 'active'`

	row := s.db.QueryRow(ctx, q, userID)
	var p LearnerPublicProfile
	if err := row.Scan(
		&p.ID, &p.DisplayName, &p.Email, &p.Status, &p.KeycloakSubject,
		&p.CoverAssetID, &p.ThemeMode, &p.DensityPreference, &p.FontSizePreference, &p.SharePostcardOptIn,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("profile: get learner: %w", err)
	}
	return &p, nil
}

// LearnerFullProfile contains all fields returned by GET /api/auth/me (M5).
type LearnerFullProfile struct {
	ID                      string    `json:"id"`
	Email                   string    `json:"email"`
	DisplayName             string    `json:"displayName"`
	Status                  string    `json:"status"`
	ThemeMode               string    `json:"themeMode"`
	FontSizePreference      string    `json:"fontSizePreference"`
	DensityPreference       string    `json:"densityPreference"`
	FlashcardStyleSlug      *string   `json:"flashcardStyleSlug"`
	CoverAssetID            *string   `json:"coverAssetId"`
	AdsPersonalizationOptIn bool      `json:"adsPersonalizationOptIn"`
	SharePostcardOptIn      bool      `json:"sharePostcardOptIn"`
	CreatedAt               time.Time `json:"createdAt"`
	UpdatedAt               time.Time `json:"updatedAt"`
}

// GetLearnerFullProfile loads the complete learner profile for GET /api/auth/me.
// Returns ErrProfileNotFound if the user does not exist or has status != 'active'.
func (s *Store) GetLearnerFullProfile(ctx context.Context, userID string) (*LearnerFullProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, email, display_name, status, theme_mode,
		font_size_preference, density_preference, flashcard_style_slug,
		cover_asset_id, ads_personalization_opt_in, share_postcard_opt_in,
		created_at, updated_at
	FROM profile.user_profile
	WHERE id = $1 AND status = 'active'`

	row := s.db.QueryRow(ctx, q, userID)
	var p LearnerFullProfile
	if err := row.Scan(
		&p.ID, &p.Email, &p.DisplayName, &p.Status, &p.ThemeMode,
		&p.FontSizePreference, &p.DensityPreference, &p.FlashcardStyleSlug,
		&p.CoverAssetID, &p.AdsPersonalizationOptIn, &p.SharePostcardOptIn,
		&p.CreatedAt, &p.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("profile: get full profile: %w", err)
	}
	return &p, nil
}

// UpdateProfileParams holds optional fields for updating a learner profile.
// Nil pointers mean "not provided"; non-nil means "update this field".
type UpdateProfileParams struct {
	DisplayName             *string
	ThemeMode               *string
	FontSizePreference      *string
	DensityPreference       *string
	FlashcardStyleSlug      *string
	CoverAssetID            *string
	ClearCoverAssetID       bool
	AdsPersonalizationOptIn *bool
	SharePostcardOptIn      *bool
}

// UpdateLearnerProfile applies a partial update to the learner's profile and
// returns the updated full profile. Uses dynamic SQL to update only provided fields.
// Returns ErrProfileNotFound if the user does not exist or is inactive.
func (s *Store) UpdateLearnerProfile(ctx context.Context, userID string, params UpdateProfileParams) (*LearnerFullProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Build dynamic UPDATE with only provided fields.
	setClauses := []string{}
	args := []any{}
	argIdx := 1

	if params.DisplayName != nil {
		setClauses = append(setClauses, fmt.Sprintf("display_name = $%d", argIdx))
		args = append(args, *params.DisplayName)
		argIdx++
	}
	if params.ThemeMode != nil {
		setClauses = append(setClauses, fmt.Sprintf("theme_mode = $%d", argIdx))
		args = append(args, *params.ThemeMode)
		argIdx++
	}
	if params.FontSizePreference != nil {
		setClauses = append(setClauses, fmt.Sprintf("font_size_preference = $%d", argIdx))
		args = append(args, *params.FontSizePreference)
		argIdx++
	}
	if params.DensityPreference != nil {
		setClauses = append(setClauses, fmt.Sprintf("density_preference = $%d", argIdx))
		args = append(args, *params.DensityPreference)
		argIdx++
	}
	if params.FlashcardStyleSlug != nil {
		setClauses = append(setClauses, fmt.Sprintf("flashcard_style_slug = $%d", argIdx))
		args = append(args, *params.FlashcardStyleSlug)
		argIdx++
	}
	if params.ClearCoverAssetID {
		setClauses = append(setClauses, "cover_asset_id = NULL")
	} else if params.CoverAssetID != nil {
		setClauses = append(setClauses, fmt.Sprintf("cover_asset_id = $%d", argIdx))
		args = append(args, *params.CoverAssetID)
		argIdx++
	}
	if params.AdsPersonalizationOptIn != nil {
		setClauses = append(setClauses, fmt.Sprintf("ads_personalization_opt_in = $%d", argIdx))
		args = append(args, *params.AdsPersonalizationOptIn)
		argIdx++
	}
	if params.SharePostcardOptIn != nil {
		setClauses = append(setClauses, fmt.Sprintf("share_postcard_opt_in = $%d", argIdx))
		args = append(args, *params.SharePostcardOptIn)
		argIdx++
	}

	// Always update updated_at.
	setClauses = append(setClauses, "updated_at = now()")

	q := fmt.Sprintf(`UPDATE profile.user_profile SET %s WHERE id = $%d AND status = 'active'`,
		strings.Join(setClauses, ", "), argIdx)
	args = append(args, userID)

	tag, err := s.db.Exec(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("profile: update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrProfileNotFound
	}

	// Return the updated profile.
	return s.GetLearnerFullProfile(ctx, userID)
}
