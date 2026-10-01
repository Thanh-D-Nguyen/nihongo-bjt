// Package onboarding provides access to learner onboarding preference data.
package onboarding

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when no onboarding preferences exist for the user.
var ErrNotFound = errors.New("onboarding: preferences not found")

// Preferences represents the learner's onboarding questionnaire answers.
type Preferences struct {
	UserID       string    `json:"userId"`
	CurrentLevel int       `json:"currentLevel"`
	Goal         string    `json:"goal"`
	Topics       []string  `json:"topics"`
	DailyMinutes int       `json:"dailyMinutes"`
	Style        string    `json:"style"`
	Completed    bool      `json:"completed"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// SaveInput contains validated fields for saving onboarding preferences.
type SaveInput struct {
	CurrentLevel int
	Goal         string
	Topics       []string
	DailyMinutes int
	Style        string
}

// Store provides read/write access to profile.learner_onboarding.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates an onboarding store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetPreferences loads onboarding preferences for a user.
// Returns ErrNotFound if no row exists.
func (s *Store) GetPreferences(ctx context.Context, userID string) (*Preferences, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT user_id, current_level, goal, topics, daily_minutes, style, completed, created_at, updated_at
		FROM profile.learner_onboarding WHERE user_id = $1`

	var p Preferences
	err := s.db.QueryRow(ctx, q, userID).Scan(
		&p.UserID, &p.CurrentLevel, &p.Goal, &p.Topics,
		&p.DailyMinutes, &p.Style, &p.Completed, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("onboarding: get preferences: %w", err)
	}
	if p.Topics == nil {
		p.Topics = []string{}
	}
	return &p, nil
}

// HasCompleted checks whether the user has completed onboarding.
// Returns false (no error) if no row exists.
func (s *Store) HasCompleted(ctx context.Context, userID string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT (onboarded_at IS NOT NULL) AS completed FROM profile.learner_onboarding WHERE user_id = $1`

	var completed bool
	err := s.db.QueryRow(ctx, q, userID).Scan(&completed)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("onboarding: has completed: %w", err)
	}
	return completed, nil
}

// MarkSkipped sets completed=true without requiring preference data.
// Upserts so that status check returns true even if preferences were never saved.
func (s *Store) MarkSkipped(ctx context.Context, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO profile.learner_onboarding (user_id, completed)
		VALUES ($1, true)
		ON CONFLICT (user_id) DO UPDATE SET completed = true, updated_at = NOW()`

	_, err := s.db.Exec(ctx, q, userID)
	if err != nil {
		return fmt.Errorf("onboarding: mark skipped: %w", err)
	}
	return nil
}

// SavePreferences inserts or updates onboarding preferences and marks completed=true.
func (s *Store) SavePreferences(ctx context.Context, userID string, input SaveInput) (*Preferences, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO profile.learner_onboarding
		(user_id, current_level, goal, topics, daily_minutes, style, completed)
		VALUES ($1, $2, $3, $4, $5, $6, true)
		ON CONFLICT (user_id) DO UPDATE SET
			current_level = EXCLUDED.current_level,
			goal = EXCLUDED.goal,
			topics = EXCLUDED.topics,
			daily_minutes = EXCLUDED.daily_minutes,
			style = EXCLUDED.style,
			completed = true,
			updated_at = NOW()
		RETURNING user_id, current_level, goal, topics, daily_minutes, style, completed, created_at, updated_at`

	var p Preferences
	err := s.db.QueryRow(ctx, q,
		userID, input.CurrentLevel, input.Goal, input.Topics,
		input.DailyMinutes, input.Style,
	).Scan(
		&p.UserID, &p.CurrentLevel, &p.Goal, &p.Topics,
		&p.DailyMinutes, &p.Style, &p.Completed, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("onboarding: save preferences: %w", err)
	}
	if p.Topics == nil {
		p.Topics = []string{}
	}
	return &p, nil
}