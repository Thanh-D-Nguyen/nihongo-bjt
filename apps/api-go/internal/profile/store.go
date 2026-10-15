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

// PublicProfile is the allowlisted contract for a learner's public profile.
// It deliberately excludes email and authentication identifiers.
type PublicProfile struct {
	ID              string              `json:"id"`
	DisplayName     string              `json:"displayName"`
	AvatarURL       *string             `json:"avatarUrl"`
	CoverURL        *string             `json:"coverUrl"`
	TargetBJTBand   *string             `json:"targetBjtBand"`
	LearningPurpose *string             `json:"learningPurpose"`
	PrivacyLevel    string              `json:"privacyLevel"`
	MemberSince     time.Time           `json:"memberSince"`
	Stats           *PublicProfileStats `json:"stats"`
	Achievements    []PublicAchievement `json:"achievements"`
	Relationship    *string             `json:"relationship"`
	Online          bool                `json:"online"`
	LastSeenAt      *string             `json:"lastSeenAt"`
}

type PublicProfileStats struct {
	CurrentStreak    int      `json:"currentStreak"`
	LongestStreak    int      `json:"longestStreak"`
	TotalStudyDays   int      `json:"totalStudyDays"`
	AchievementCount int      `json:"achievementCount"`
	BattleWins       int      `json:"battleWins"`
	BattleTotal      int      `json:"battleTotal"`
	BattleWinRate    *float64 `json:"battleWinRate"`
}

type PublicAchievement struct {
	ID         string    `json:"id"`
	Slug       string    `json:"slug"`
	Name       string    `json:"name"`
	IconURL    *string   `json:"iconUrl"`
	UnlockedAt time.Time `json:"unlockedAt"`
}

// Store provides read-only profile access against PostgreSQL.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a profile store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetPublicProfile returns a privacy-filtered profile for an optional viewer.
func (s *Store) GetPublicProfile(ctx context.Context, userID string, viewerID *string) (*PublicProfile, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	p := &PublicProfile{}
	var avatarID, coverID *string
	var status string
	err := s.db.QueryRow(ctx, `SELECT id, display_name, avatar_asset_id::text, cover_asset_id::text,
		target_bjt_band, learning_purpose, COALESCE(privacy_level, 'standard'), created_at, status
		FROM profile.user_profile WHERE id=$1 AND status='active'`, userID).Scan(
		&p.ID, &p.DisplayName, &avatarID, &coverID, &p.TargetBJTBand, &p.LearningPurpose,
		&p.PrivacyLevel, &p.MemberSince, &status,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, fmt.Errorf("profile: get public profile: %w", err)
	}
	if avatarID != nil {
		url := "/api/media/" + *avatarID + "/stream"
		p.AvatarURL = &url
	}
	if coverID != nil {
		url := "/api/media/" + *coverID + "/stream"
		p.CoverURL = &url
	}

	if viewerID != nil {
		relationship := "stranger"
		if *viewerID == userID {
			relationship = "self"
		} else {
			err = s.db.QueryRow(ctx, `SELECT status FROM gamification.user_social_connection
				WHERE (requester_user_id=$1 AND addressee_user_id=$2)
				   OR (requester_user_id=$2 AND addressee_user_id=$1)
				LIMIT 1`, *viewerID, userID).Scan(&relationship)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("profile: get public relationship: %w", err)
			}
			switch relationship {
			case "accepted":
				relationship = "friend"
			case "blocked":
			default:
				relationship = "stranger"
			}
		}
		p.Relationship = &relationship
	}

	canView := p.Relationship != nil && *p.Relationship == "self" ||
		p.Relationship == nil && p.PrivacyLevel != "private" ||
		p.Relationship != nil && *p.Relationship != "blocked" &&
			(p.PrivacyLevel == "public" || p.PrivacyLevel == "standard" || *p.Relationship == "friend")
	if !canView {
		p.TargetBJTBand, p.LearningPurpose = nil, nil
		return p, nil
	}

	p.Stats = &PublicProfileStats{}
	err = s.db.QueryRow(ctx, `SELECT
		COALESCE((SELECT current_streak FROM gamification.user_streak WHERE user_id=$1 ORDER BY current_streak DESC LIMIT 1), 0),
		COALESCE((SELECT longest_streak FROM gamification.user_streak WHERE user_id=$1 ORDER BY current_streak DESC LIMIT 1), 0),
		(SELECT count(DISTINCT reviewed_at::date)::int FROM learning.review_event WHERE user_id=$1),
		(SELECT count(*)::int FROM gamification.user_achievement WHERE user_id=$1 AND earned_at IS NOT NULL),
		(SELECT count(*) FILTER (WHERE (user_id=$1 AND user_score>opponent_score) OR (opponent_user_id=$1 AND opponent_score>user_score))::int FROM learning.battle_session WHERE status='completed' AND (user_id=$1 OR opponent_user_id=$1)),
		(SELECT count(*)::int FROM learning.battle_session WHERE status='completed' AND (user_id=$1 OR opponent_user_id=$1))`, userID).Scan(
		&p.Stats.CurrentStreak, &p.Stats.LongestStreak, &p.Stats.TotalStudyDays,
		&p.Stats.AchievementCount, &p.Stats.BattleWins, &p.Stats.BattleTotal,
	)
	if err != nil {
		return nil, fmt.Errorf("profile: get public profile stats: %w", err)
	}
	if p.Stats.BattleTotal > 0 {
		rate := float64((p.Stats.BattleWins*100 + p.Stats.BattleTotal/2) / p.Stats.BattleTotal)
		p.Stats.BattleWinRate = &rate
	}
	p.Achievements = make([]PublicAchievement, 0, 5)
	rows, err := s.db.Query(ctx, `SELECT ad.id, ad.slug, COALESCE(at.name_key, ad.name_key),
		COALESCE(at.icon_url, ad.icon_url), ua.earned_at
		FROM gamification.user_achievement ua
		JOIN gamification.achievement_tier at ON at.id=ua.tier_id
		JOIN gamification.achievement_definition ad ON ad.id=at.achievement_id
		WHERE ua.user_id=$1 AND ua.earned_at IS NOT NULL
		ORDER BY ua.earned_at DESC LIMIT 5`, userID)
	if err != nil {
		return nil, fmt.Errorf("profile: get public achievements: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var achievement PublicAchievement
		if err := rows.Scan(&achievement.ID, &achievement.Slug, &achievement.Name, &achievement.IconURL, &achievement.UnlockedAt); err != nil {
			return nil, fmt.Errorf("profile: scan public achievement: %w", err)
		}
		p.Achievements = append(p.Achievements, achievement)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("profile: iterate public achievements: %w", err)
	}
	return p, nil
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
	AvatarAssetID           *string
	ClearAvatarAssetID      bool
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
	if params.ClearAvatarAssetID {
		setClauses = append(setClauses, "avatar_asset_id = NULL")
	} else if params.AvatarAssetID != nil {
		setClauses = append(setClauses, fmt.Sprintf("avatar_asset_id = $%d", argIdx))
		args = append(args, *params.AvatarAssetID)
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
