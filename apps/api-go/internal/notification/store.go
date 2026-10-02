// Package notification provides access to learner notification preference data.
package notification

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when no notification preferences exist for the user.
var ErrNotFound = errors.New("notification: preferences not found")

// Preferences represents the learner's notification channel settings.
type Preferences struct {
	UserID                string    `json:"userId"`
	StudyRemindersEnabled bool      `json:"studyRemindersEnabled"`
	ProductNewsEnabled    bool      `json:"productNewsEnabled"`
	EmailEnabled          bool      `json:"emailEnabled"`
	InAppEnabled          bool      `json:"inAppEnabled"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}

// UpdateInput contains validated fields for updating notification preferences.
type UpdateInput struct {
	StudyRemindersEnabled *bool
	ProductNewsEnabled    *bool
	EmailEnabled          *bool
	InAppEnabled          *bool
}

// Store provides read/write access to profile.notification_preference.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a notification store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetPreferences loads notification preferences for a user.
// Returns default preferences if no row exists (matching NestJS behavior).
func (s *Store) GetPreferences(ctx context.Context, userID string) (*Preferences, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT user_id, study_reminders_enabled, product_news_enabled, email_enabled, in_app_enabled, created_at, updated_at
		FROM profile.notification_preference WHERE user_id = $1`

	var p Preferences
	err := s.db.QueryRow(ctx, q, userID).Scan(
		&p.UserID, &p.StudyRemindersEnabled, &p.ProductNewsEnabled,
		&p.EmailEnabled, &p.InAppEnabled, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return defaults matching NestJS/Prisma schema defaults
			return &Preferences{
				UserID:                userID,
				StudyRemindersEnabled: true,
				ProductNewsEnabled:    false,
				EmailEnabled:          true,
				InAppEnabled:          true,
			}, nil
		}
		return nil, fmt.Errorf("notification: get preferences: %w", err)
	}
	return &p, nil
}

// UpdatePreferences applies a partial update to notification preferences.
// Upserts so that first save creates the row with defaults for unset fields.
func (s *Store) UpdatePreferences(ctx context.Context, userID string, input UpdateInput) (*Preferences, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Build dynamic update based on provided fields
	// Default values match Prisma schema defaults
	studyReminders := true
	productNews := false
	emailEnabled := true
	inAppEnabled := true

	// Load existing to merge partial updates
	existing, err := s.GetPreferences(ctx, userID)
	if err == nil && existing.UserID == userID && !existing.CreatedAt.IsZero() {
		studyReminders = existing.StudyRemindersEnabled
		productNews = existing.ProductNewsEnabled
		emailEnabled = existing.EmailEnabled
		inAppEnabled = existing.InAppEnabled
	}

	if input.StudyRemindersEnabled != nil {
		studyReminders = *input.StudyRemindersEnabled
	}
	if input.ProductNewsEnabled != nil {
		productNews = *input.ProductNewsEnabled
	}
	if input.EmailEnabled != nil {
		emailEnabled = *input.EmailEnabled
	}
	if input.InAppEnabled != nil {
		inAppEnabled = *input.InAppEnabled
	}

	const q = `INSERT INTO profile.notification_preference
		(user_id, study_reminders_enabled, product_news_enabled, email_enabled, in_app_enabled)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id) DO UPDATE SET
			study_reminders_enabled = EXCLUDED.study_reminders_enabled,
			product_news_enabled = EXCLUDED.product_news_enabled,
			email_enabled = EXCLUDED.email_enabled,
			in_app_enabled = EXCLUDED.in_app_enabled,
			updated_at = NOW()
		RETURNING user_id, study_reminders_enabled, product_news_enabled, email_enabled, in_app_enabled, created_at, updated_at`

	var p Preferences
	err = s.db.QueryRow(ctx, q, userID, studyReminders, productNews, emailEnabled, inAppEnabled).Scan(
		&p.UserID, &p.StudyRemindersEnabled, &p.ProductNewsEnabled,
		&p.EmailEnabled, &p.InAppEnabled, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("notification: update preferences: %w", err)
	}
	return &p, nil
}
