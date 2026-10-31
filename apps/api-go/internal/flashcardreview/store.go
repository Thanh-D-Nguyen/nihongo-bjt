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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

// ErrNotFound is returned when a user flashcard does not exist.
var ErrNotFound = errors.New("flashcardreview: not found")

// DueFlashcard represents a flashcard due for review with its SRS metadata.
type DueFlashcard struct {
	ID           string                       `json:"id"`
	CardID       string                       `json:"cardId"`
	State        string                       `json:"state"`
	DueAt        time.Time                    `json:"dueAt"`
	IntervalDays int                          `json:"intervalDays"`
	EaseFactor   float64                      `json:"easeFactor"`
	Repetitions  int                          `json:"repetitions"`
	Lapses       int                          `json:"lapses"`
	Leeched      bool                         `json:"leeched"`
	ComebackMode bool                         `json:"comebackMode"`
	Card         DueCardContent               `json:"card"`
	PrimaryImage *flashcarddeck.DeckCardImage `json:"primaryImage"`
}

type DueCardContent struct {
	ID        string `json:"id"`
	FrontText string `json:"frontText"`
	BackText  string `json:"backText"`
	Reading   string `json:"reading"`
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
	ClientMutationID string     `json:"clientMutationId"`
	UserFlashcardID  string     `json:"userFlashcardId"`
	Rating           string     `json:"rating"`
	ElapsedMs        *int       `json:"elapsedMs,omitempty"`
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
	const q = `SELECT uf.id, uf.card_id, uf.state, uf.due_at, uf.interval_days, uf.ease_factor, uf.repetitions, uf.lapses, uf.leeched, uf.comeback_mode,
	fv.front_text, fv.back_text, COALESCE(fv.reading, ''), img.id::text, img.mime_type, img.status, img.provider, img.provenance, img.rights_status
FROM learning.user_flashcard uf
JOIN learning.flashcard_variant fv ON fv.id = uf.card_id
LEFT JOIN LATERAL (SELECT a.id,a.mime_type,a.status,a.provider,a.provenance,a.rights_status FROM learning.card_media_link ml JOIN media.asset a ON a.id=ml.asset_id WHERE ml.card_id=fv.id AND ml.role='primary_image' AND ((a.status='active' AND a.rights_status='cleared') OR (a.status IN ('active','pending_review') AND a.rights_status='pending_review' AND a.owner_user_id=$1)) ORDER BY ml.created_at,ml.id LIMIT 1) img ON true
WHERE uf.user_id = $1 AND uf.due_at <= NOW() AND fv.status='active'
	AND EXISTS (
		SELECT 1 FROM learning.deck_card dc JOIN learning.deck d ON d.id=dc.deck_id
		WHERE dc.card_id=uf.card_id AND d.status='active'
		AND (d.owner_user_id=$1 OR d.visibility='public')
	)
ORDER BY uf.due_at ASC
LIMIT $2`
	rows, err := s.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcardreview: get due flashcards: %w", err)
	}
	defer rows.Close()
	var cards []DueFlashcard
	for rows.Next() {
		var c DueFlashcard
		var imageID, mimeType, status, provider, rightsStatus *string
		var provenance []byte
		if err := rows.Scan(&c.ID, &c.CardID, &c.State, &c.DueAt, &c.IntervalDays, &c.EaseFactor, &c.Repetitions, &c.Lapses, &c.Leeched, &c.ComebackMode, &c.Card.FrontText, &c.Card.BackText, &c.Card.Reading, &imageID, &mimeType, &status, &provider, &provenance, &rightsStatus); err != nil {
			return nil, fmt.Errorf("flashcardreview: scan due flashcard: %w", err)
		}
		if imageID != nil {
			c.PrimaryImage = &flashcarddeck.DeckCardImage{AssetID: *imageID, MimeType: *mimeType}
			if *status == "active" && *rightsStatus == "cleared" {
				url := "/api/media/" + *imageID + "/stream"
				c.PrimaryImage.ReadURL = &url
			}
			flashcarddeck.PopulateSelectedImage(c.PrimaryImage, *provider, provenance)
			if *rightsStatus == "pending_review" && *provider != "unsplash" && (*provider == "local" || c.PrimaryImage.Provider != "") {
				url := "/api/media/" + *imageID + "/private-preview"
				c.PrimaryImage.ReadURL = &url
			}
		}
		c.Card.ID = c.CardID
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
	const loadQ = `SELECT uf.state, uf.ease_factor, uf.interval_days, uf.repetitions, uf.lapses, uf.due_at
FROM learning.user_flashcard uf JOIN learning.flashcard_variant fv ON fv.id=uf.card_id AND fv.status='active'
WHERE uf.id = $1 AND uf.user_id = $2 AND EXISTS (
	SELECT 1 FROM learning.deck_card dc JOIN learning.deck d ON d.id=dc.deck_id
	WHERE dc.card_id=uf.card_id AND d.status='active' AND (d.owner_user_id=$2 OR d.visibility='public')
) FOR UPDATE OF uf`
	var currentState string
	var easeFactor float64
	var intervalDays, repetitions, lapses int
	var previousDue time.Time
	err = tx.QueryRow(ctx, loadQ, input.UserFlashcardID, userID).Scan(&currentState, &easeFactor, &intervalDays, &repetitions, &lapses, &previousDue)
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
	const insertEvent = `INSERT INTO learning.review_event (user_id, user_flashcard_id, rating, elapsed_ms, previous_due_at, next_due_at, reviewed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	if _, err := tx.Exec(ctx, insertEvent, userID, input.UserFlashcardID, input.Rating, input.ElapsedMs, previousDue, nextDue, input.ReviewedAt); err != nil {
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
	// Use canonical flashcard variants; custom cards are limited to their visible deck.
	const q = `SELECT candidate.id, candidate.back_text, candidate.source_type
		FROM learning.flashcard_variant current
		JOIN learning.flashcard_variant candidate
		  ON candidate.status = 'active'
		 AND candidate.source_type = current.source_type
		 AND candidate.id <> current.id
		 AND (
			(current.source_type = 'custom' AND candidate.source_id = current.source_id
			 AND EXISTS (SELECT 1 FROM learning.deck d JOIN learning.deck_card dc ON dc.deck_id = d.id
				WHERE d.id = current.source_id AND dc.card_id = candidate.id AND d.status = 'active'
				AND (d.owner_user_id = $3 OR d.visibility = 'public')))
			OR (current.source_type <> 'custom' AND candidate.source_id <> current.source_id)
		 )
		WHERE current.id = $1
		ORDER BY RANDOM() LIMIT $2`
	rows, err := s.db.Query(ctx, q, cardID, limit, userID)
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
