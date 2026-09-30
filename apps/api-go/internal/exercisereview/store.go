// Package exercisereview provides access to SRS exercise review state and due exercises.
package exercisereview

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when no review state exists for the given user+exercise.
var ErrNotFound = errors.New("exercisereview: not found")

// DueExercise represents an exercise scheduled for SRS review with its metadata.
type DueExercise struct {
	ExerciseID   string    `json:"exerciseId"`
	ExerciseType string    `json:"exerciseType"`
	Level        string    `json:"level"`
	Difficulty   string    `json:"difficulty"`
	DueAt        time.Time `json:"dueAt"`
	State        string    `json:"state"`
	EaseFactor   float64   `json:"easeFactor"`
	IntervalDays int       `json:"intervalDays"`
	Repetitions  int       `json:"repetitions"`
	Lapses       int       `json:"lapses"`
}

// ReviewState represents the current SRS state for a user+exercise pair.
type ReviewState struct {
	UserID       string    `json:"userId"`
	ExerciseID   string    `json:"exerciseId"`
	State        string    `json:"state"`
	EaseFactor   float64   `json:"easeFactor"`
	IntervalDays int       `json:"intervalDays"`
	Repetitions  int       `json:"repetitions"`
	Lapses       int       `json:"lapses"`
	DueAt        time.Time `json:"dueAt"`
}

// Store provides read/write access to learning.exercise_review_state.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates an exercise review store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetDueExercises returns exercises due for SRS review, ordered by due date ascending.
// Joins with exercise definitions to return full metadata needed by the frontend.
func (s *Store) GetDueExercises(ctx context.Context, userID string, limit int) ([]DueExercise, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	const q = `SELECT
		ers.exercise_id,
		COALESCE(e.exercise_type, 'unknown'),
		COALESCE(e.level, 'all'),
		COALESCE(e.difficulty, 'medium'),
		ers.due_at,
		ers.state,
		ers.ease_factor,
		ers.interval_days,
		ers.repetitions,
		ers.lapses
	FROM learning.exercise_review_state ers
	LEFT JOIN learning.exercise e ON e.id = ers.exercise_id
	WHERE ers.user_id = $1 AND ers.due_at <= NOW()
	ORDER BY ers.due_at ASC
	LIMIT $2`

	rows, err := s.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("exercisereview: get due exercises: %w", err)
	}
	defer rows.Close()

	var exercises []DueExercise
	for rows.Next() {
		var de DueExercise
		if err := rows.Scan(
			&de.ExerciseID, &de.ExerciseType, &de.Level, &de.Difficulty,
			&de.DueAt, &de.State, &de.EaseFactor, &de.IntervalDays,
			&de.Repetitions, &de.Lapses,
		); err != nil {
			return nil, fmt.Errorf("exercisereview: scan due exercise: %w", err)
		}
		exercises = append(exercises, de)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("exercisereview: iterate due exercises: %w", err)
	}
	if exercises == nil {
		exercises = []DueExercise{}
	}
	return exercises, nil
}

// GetReviewState loads the SRS state for a specific user+exercise pair.
// Returns ErrNotFound if no state exists yet.
func (s *Store) GetReviewState(ctx context.Context, userID, exerciseID string) (*ReviewState, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT user_id, exercise_id, state, ease_factor, interval_days, repetitions, lapses, due_at
	FROM learning.exercise_review_state WHERE user_id = $1 AND exercise_id = $2`

	var rs ReviewState
	err := s.db.QueryRow(ctx, q, userID, exerciseID).Scan(
		&rs.UserID, &rs.ExerciseID, &rs.State, &rs.EaseFactor,
		&rs.IntervalDays, &rs.Repetitions, &rs.Lapses, &rs.DueAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("exercisereview: get review state: %w", err)
	}
	return &rs, nil
}

// UpsertReviewState creates or updates the SRS state for a user+exercise pair.
func (s *Store) UpsertReviewState(ctx context.Context, rs ReviewState) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO learning.exercise_review_state
		(user_id, exercise_id, state, ease_factor, interval_days, repetitions, lapses, due_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	ON CONFLICT (user_id, exercise_id) DO UPDATE SET
		state = EXCLUDED.state,
		ease_factor = EXCLUDED.ease_factor,
		interval_days = EXCLUDED.interval_days,
		repetitions = EXCLUDED.repetitions,
		lapses = EXCLUDED.lapses,
		due_at = EXCLUDED.due_at,
		updated_at = NOW()`

	_, err := s.db.Exec(ctx, q,
		rs.UserID, rs.ExerciseID, rs.State, rs.EaseFactor,
		rs.IntervalDays, rs.Repetitions, rs.Lapses, rs.DueAt,
	)
	if err != nil {
		return fmt.Errorf("exercisereview: upsert review state: %w", err)
	}
	return nil
}