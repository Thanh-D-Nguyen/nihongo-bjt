// Package flashcardreview provides access to user flashcard SRS state and review events.
package flashcardreview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a user flashcard does not exist.
var ErrNotFound = errors.New("flashcardreview: not found")

// DueFlashcard represents a flashcard due for review with its SRS metadata.
type DueFlashcard struct {
	ID           string    `json:"id"`
	CardID       string    `json:"cardId"`
	State        string    `json:"state"`
	DueAt        time.Time `json:"dueAt"`
	IntervalDays int       `json:"intervalDays"`
	EaseFactor   float64   `json:"easeFactor"`
	Repetitions  int       `json:"repetitions"`
	Lapses       int       `json:"lapses"`
	Leeched      bool      `json:"leeched"`
	ComebackMode bool      `json:"comebackMode"`
}

// ReviewInput contains validated fields for submitting a single flashcard review.
type ReviewInput struct {
	UserFlashcardID string
	Rating          string // again | hard | good | easy
	ElapsedMs       *int
	ReviewedAt      time.Time
}

// BatchReviewItem is one item in a batch review submission.
type BatchReviewItem struct {
	ClientMutationID string `json:"clientMutationId"`
	UserFlashcardID  string `json:"userFlashcardId"`
	Rating           string `json:"rating"`
	ElapsedMs        *int   `json:"elapsedMs,omitempty"`
	ReviewedAt       *time.Time `json:"reviewedAt,omitempty"`
}

// BatchReviewResult is the outcome of one batch item.
type BatchReviewResult struct {
	ClientMutationID string `json:"clientMutationId"`
	OK               bool   `json:"ok"`
	Error            string `json:"error,omitempty"`
}

// Distractor represents a wrong answer option for a flashcard review.
type Distractor struct {
	ID      string `json:"id"`
	Content string `json:"content"`
	Type    string `json:"type"`
}

// ComebackSummary contains aggregated comeback mode statistics.
type ComebackSummary struct {
	TotalComebackCards int `json:"totalComebackCards"`
	DueNow             int `json:"dueNow"`
	CompletedToday     int `json:"completedToday"`
}

// Store provides read/write access to learning.user_flashcard and learning.review_event.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a flashcard review store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetDueFlashcards returns flashcards due for SRS review, ordered by due date ascending.
func (s *Store) GetDueFlashcards(ctx context.Context, userID string, limit int) ([]DueFlashcard, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	const q = `SELECT id, card_id, state, due_at, interval_days, ease_factor, repetitions, lapses, leeched, comeback_mode
FROM learning.user_flashcard
WHERE user_id = $1 AND due_at <= NOW()
ORDER BY due_at ASC
LIMIT $2`
	rows, err := s.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcardreview: get due flashcards: %w", err)
	}
	defer rows.Close()
	var cards []DueFlashcard
	for rows.Next() {
		var c DueFlashcard
		if err := rows.Scan(&c.ID, &c.CardID, &c.State, &c.DueAt, &c.IntervalDays, &c.EaseFactor, &c.Repetitions, &c.Lapses, &c.Leeched, &c.ComebackMode); err != nil {
			return nil, fmt.Errorf("flashcardreview: scan due flashcard: %w", err)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("flashcardreview: iterate due flashcards: %w", err)
	}
	if cards == nil {
		cards = []DueFlashcard{}
	}
	return cards, nil
}

// SubmitReview applies SM-2 SRS update for a single flashcard review within a transaction.
func (s *Store) SubmitReview(ctx context.Context, userID string, input ReviewInput) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("flashcardreview: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Load current state with row lock
	const loadQ = `SELECT state, ease_factor, interval_days, repetitions, lapses
FROM learning.user_flashcard WHERE id = $1 AND user_id = $2 FOR UPDATE`
	var currentState string
	var easeFactor float64
	var intervalDays, repetitions, lapses int
	err = tx.QueryRow(ctx, loadQ, input.UserFlashcardID, userID).Scan(&currentState, &easeFactor, &intervalDays, &repetitions, &lapses)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("flashcardreview: load user flashcard: %w", err)
	}

	// Compute next SRS state
	nextState, nextEase, nextInterval, nextReps, nextLapses := computeSRSNext(
		currentState, easeFactor, intervalDays, repetitions, lapses, input.Rating,
	)
	nextDue := input.ReviewedAt.Add(time.Duration(nextInterval) * 24 * time.Hour)
	if nextInterval == 0 {
		nextDue = input.ReviewedAt.Add(10 * time.Minute)
	}

	// Update user flashcard state
	const updateQ = `UPDATE learning.user_flashcard SET
		state = $3, ease_factor = $4, interval_days = $5, repetitions = $6, lapses = $7, due_at = $8, updated_at = NOW()
		WHERE id = $1 AND user_id = $2`
	if _, err := tx.Exec(ctx, updateQ, input.UserFlashcardID, userID, nextState, nextEase, nextInterval, nextReps, nextLapses, nextDue); err != nil {
		return fmt.Errorf("flashcardreview: update user flashcard: %w", err)
	}

	// Record review event
	const insertEvent = `INSERT INTO learning.review_event (user_id, user_flashcard_id, rating, elapsed_ms, reviewed_at)
		VALUES ($1, $2, $3, $4, $5)`
	if _, err := tx.Exec(ctx, insertEvent, userID, input.UserFlashcardID, input.Rating, input.ElapsedMs, input.ReviewedAt); err != nil {
		return fmt.Errorf("flashcardreview: insert review event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("flashcardreview: commit: %w", err)
	}
	return nil
}

// GetDistractors returns wrong answer options for a specific flashcard review.
func (s *Store) GetDistractors(ctx context.Context, userID, userFlashcardID string, limit int) ([]Distractor, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if limit <= 0 || limit > 20 {
		limit = 5
	}
	// Verify ownership
	const ownerQ = `SELECT card_id FROM learning.user_flashcard WHERE id = $1 AND user_id = $2`
	var cardID string
	if err := s.db.QueryRow(ctx, ownerQ, userFlashcardID, userID).Scan(&cardID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("flashcardreview: verify ownership: %w", err)
	}
	// Load distractors from variant pool excluding the correct answer
	const q = `SELECT id, content, type FROM content.flashcard_variant
		WHERE card_id IN (SELECT card_id FROM content.flashcard WHERE id = (SELECT card_id FROM content.flashcard_variant WHERE id = $1))
		AND id != $1
		ORDER BY RANDOM() LIMIT $2`
	rows, err := s.db.Query(ctx, q, cardID, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcardreview: get distractors: %w", err)
	}
	defer rows.Close()
	var distractors []Distractor
	for rows.Next() {
		var d Distractor
		if err := rows.Scan(&d.ID, &d.Content, &d.Type); err != nil {
			return nil, fmt.Errorf("flashcardreview: scan distractor: %w", err)
		}
		distractors = append(distractors, d)
	}
	if distractors == nil {
		distractors = []Distractor{}
	}
	return distractors, nil
}

// GetComebackSummary returns aggregated comeback mode statistics for the user.
func (s *Store) GetComebackSummary(ctx context.Context, userID string) (*ComebackSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `SELECT
		COUNT(*) FILTER (WHERE comeback_mode = true) as total,
		COUNT(*) FILTER (WHERE comeback_mode = true AND due_at <= NOW()) as due_now,
		COUNT(*) FILTER (WHERE comeback_mode = true AND updated_at >= CURRENT_DATE) as completed_today
	FROM learning.user_flashcard WHERE user_id = $1`
	var summary ComebackSummary
	if err := s.db.QueryRow(ctx, q, userID).Scan(&summary.TotalComebackCards, &summary.DueNow, &summary.CompletedToday); err != nil {
		return nil, fmt.Errorf("flashcardreview: comeback summary: %w", err)
	}
	return &summary, nil
}

// computeSRSNext applies SM-2 spaced repetition algorithm.
func computeSRSNext(state string, ease float64, interval, reps, lapses int, rating string) (string, float64, int, int, int) {
	switch rating {
	case "again":
		return "learning", maxFloat(1.3, ease-0.2), 0, 0, lapses + 1
	case "hard":
		newInterval := maxInt(1, int(float64(interval)*1.2))
		newReps := reps + 1
		newState := state
		if newReps >= 3 {
			newState = "review"
		}
		return newState, maxFloat(1.3, ease-0.15), newInterval, newReps, lapses
	case "good":
		newInterval := interval
		if interval == 0 {
			newInterval = 1
		} else {
			newInterval = int(float64(interval) * ease)
		}
		newReps := reps + 1
		newState := state
		if newReps >= 3 {
			newState = "review"
		}
		return newState, ease, newInterval, newReps, lapses
	case "easy":
		newInterval := interval
		if interval == 0 {
			newInterval = 4
		} else {
			newInterval = int(float64(interval) * ease * 1.3)
		}
		return "review", ease + 0.15, newInterval, reps + 1, lapses
	default:
		return state, ease, interval, reps, lapses
	}
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Ensure json import is used (for potential future config fields).
var _ = json.RawMessage{}