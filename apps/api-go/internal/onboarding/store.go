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

// Store provides read/write access to canonical profile onboarding data.
type Store struct{ db *pgxpool.Pool }

// NewStore creates an onboarding store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// GetPreferences loads saved answers from the learner profile and completion from onboarding state.
func (s *Store) GetPreferences(ctx context.Context, userID string) (*Preferences, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT up.onboarding_current_level, up.learning_purpose, up.onboarding_topics,
		up.daily_study_minutes, up.learning_personality, lo.onboarded_at IS NOT NULL,
		lo.created_at, lo.updated_at
		FROM profile.learner_onboarding lo
		JOIN profile.user_profile up ON up.id = lo.user_id
		WHERE lo.user_id = $1`
	var level, dailyMinutes *int
	var goal, style *string
	var topics []string
	var p Preferences
	err := s.db.QueryRow(ctx, q, userID).Scan(&level, &goal, &topics, &dailyMinutes, &style, &p.Completed, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("onboarding: get preferences: %w", err)
	}
	if level == nil && goal == nil && len(topics) == 0 && dailyMinutes == nil && style == nil {
		return nil, ErrNotFound
	}
	p.UserID = userID
	if level != nil {
		p.CurrentLevel = *level
	}
	if goal != nil {
		p.Goal = *goal
	}
	if dailyMinutes != nil {
		p.DailyMinutes = *dailyMinutes
	}
	if style != nil {
		p.Style = *style
	}
	if topics == nil {
		p.Topics = []string{}
	} else {
		p.Topics = topics
	}
	return &p, nil
}

// HasCompleted checks whether the user has completed onboarding.
func (s *Store) HasCompleted(ctx context.Context, userID string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT onboarded_at IS NOT NULL FROM profile.learner_onboarding WHERE user_id = $1`
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

// MarkSkipped persists completion without inventing questionnaire answers.
func (s *Store) MarkSkipped(ctx context.Context, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO profile.learner_onboarding (user_id, current_step, onboarded_at, updated_at)
		VALUES ($1, 'completed', NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET current_step = 'completed',
			 onboarded_at = COALESCE(profile.learner_onboarding.onboarded_at, NOW()),
			 updated_at = CASE WHEN profile.learner_onboarding.onboarded_at IS NULL THEN NOW() ELSE profile.learner_onboarding.updated_at END`
	if _, err := s.db.Exec(ctx, q, userID); err != nil {
		return fmt.Errorf("onboarding: mark skipped: %w", err)
	}
	return nil
}

// SavePreferences atomically persists answers to the profile and completion state.
func (s *Store) SavePreferences(ctx context.Context, userID string, input SaveInput) (*Preferences, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("onboarding: begin save: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	topics := input.Topics
	if topics == nil {
		topics = []string{}
	}
	const profileQ = `UPDATE profile.user_profile SET onboarding_current_level = $2,
		onboarding_topics = $3, learning_purpose = $4, daily_study_minutes = $5,
		learning_personality = $6, updated_at = NOW() WHERE id = $1 AND status = 'active'`
	tag, err := tx.Exec(ctx, profileQ, userID, input.CurrentLevel, topics, input.Goal, input.DailyMinutes, input.Style)
	if err != nil {
		return nil, fmt.Errorf("onboarding: save profile preferences: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return nil, fmt.Errorf("onboarding: save preferences: learner profile not found")
	}
	const stateQ = `INSERT INTO profile.learner_onboarding (user_id, current_step, onboarded_at, updated_at)
		VALUES ($1, 'completed', NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET current_step = 'completed', onboarded_at = NOW(), updated_at = NOW()
		RETURNING created_at, updated_at`
	var p Preferences
	p.UserID = userID
	p.CurrentLevel, p.Goal, p.Topics = input.CurrentLevel, input.Goal, topics
	p.DailyMinutes, p.Style, p.Completed = input.DailyMinutes, input.Style, true
	if err := tx.QueryRow(ctx, stateQ, userID).Scan(&p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, fmt.Errorf("onboarding: save completion: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("onboarding: commit preferences: %w", err)
	}
	return &p, nil
}
