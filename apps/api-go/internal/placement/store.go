// Package placement provides access to BJT placement test sessions and learner onboarding state.
package placement

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSessionNotFound is returned when no placement session matches the given ID and user.
var ErrSessionNotFound = errors.New("placement: session not found")

// Session represents a placement test session.
type Session struct {
	ID               string    `json:"id"`
	UserID           string    `json:"userId"`
	FairnessSeed     string    `json:"fairnessSeed"`
	Status           string    `json:"status"`
	QuestionIDs      []string  `json:"questionIds"`
	CorrectCount     *int      `json:"correctCount,omitempty"`
	EstimatedBjtBand *string   `json:"estimatedBjtBand,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	CompletedAt      *time.Time `json:"completedAt,omitempty"`
}

// StartResponse is returned by POST /api/learner/placement/start.
type StartResponse struct {
	SessionID   string   `json:"sessionId"`
	QuestionIDs []string `json:"questionIds"`
	Status      string   `json:"status"`
}

// SubmitInput contains validated fields for submitting placement answers.
type SubmitInput struct {
	SessionID string
	Answers   map[string]string // questionId -> selectedOptionId
}

// SubmitResponse is returned by POST /api/learner/placement/submit.
type SubmitResponse struct {
	AlreadyCompleted bool    `json:"alreadyCompleted,omitempty"`
	CorrectCount     *int    `json:"correctCount,omitempty"`
	EstimatedBjtBand *string `json:"estimatedBjtBand,omitempty"`
}

// Store provides read/write access to assessment.placement_test_session and profile.learner_onboarding.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a placement store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// FindActiveSession returns an in-progress placement session for the user, if any.
func (s *Store) FindActiveSession(ctx context.Context, userID string) (*Session, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, user_id, fairness_seed, status, question_ids, correct_count, estimated_bjt_band, created_at, completed_at
FROM assessment.placement_test_session
WHERE user_id = $1 AND status = 'in_progress'
ORDER BY created_at DESC LIMIT 1`

	var sess Session
	var qidsJSON []byte
	err := s.db.QueryRow(ctx, q, userID).Scan(
		&sess.ID, &sess.UserID, &sess.FairnessSeed, &sess.Status,
		&qidsJSON, &sess.CorrectCount, &sess.EstimatedBjtBand,
		&sess.CreatedAt, &sess.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("placement: find active session: %w", err)
	}
	if err := json.Unmarshal(qidsJSON, &sess.QuestionIDs); err != nil {
		sess.QuestionIDs = []string{}
	}
	return &sess, nil
}

// CreateSession inserts a new placement session and links it to learner onboarding.
func (s *Store) CreateSession(ctx context.Context, userID string, questionIDs []string, seed string) (*StartResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	qidsJSON, err := json.Marshal(questionIDs)
	if err != nil {
		return nil, fmt.Errorf("placement: marshal question ids: %w", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("placement: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Upsert onboarding entry
	const upsertOnboarding = `INSERT INTO profile.learner_onboarding (user_id, current_step)
VALUES ($1, 'placement_active')
ON CONFLICT (user_id) DO UPDATE SET current_step = 'placement_active', updated_at = NOW()`
	if _, err := tx.Exec(ctx, upsertOnboarding, userID); err != nil {
		return nil, fmt.Errorf("placement: upsert onboarding: %w", err)
	}

	// Create session
	const insertSession = `INSERT INTO assessment.placement_test_session (user_id, fairness_seed, status, question_ids)
VALUES ($1, $2, 'in_progress', $3)
RETURNING id, created_at`
	var sessionID string
	var createdAt time.Time
	if err := tx.QueryRow(ctx, insertSession, userID, seed, qidsJSON).Scan(&sessionID, &createdAt); err != nil {
		return nil, fmt.Errorf("placement: create session: %w", err)
	}

	// Link onboarding to placement session
	const linkOnboarding = `UPDATE profile.learner_onboarding SET placement_test_session_id = $1 WHERE user_id = $2`
	if _, err := tx.Exec(ctx, linkOnboarding, sessionID, userID); err != nil {
		return nil, fmt.Errorf("placement: link onboarding: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("placement: commit: %w", err)
	}

	return &StartResponse{
		SessionID:   sessionID,
		QuestionIDs: questionIDs,
		Status:      "in_progress",
	}, nil
}

// GetSession loads a placement session by ID and user. Returns ErrSessionNotFound if missing or wrong user.
func (s *Store) GetSession(ctx context.Context, sessionID, userID string) (*Session, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, user_id, fairness_seed, status, question_ids, correct_count, estimated_bjt_band, created_at, completed_at
FROM assessment.placement_test_session WHERE id = $1 AND user_id = $2`

	var sess Session
	var qidsJSON []byte
	err := s.db.QueryRow(ctx, q, sessionID, userID).Scan(
		&sess.ID, &sess.UserID, &sess.FairnessSeed, &sess.Status,
		&qidsJSON, &sess.CorrectCount, &sess.EstimatedBjtBand,
		&sess.CreatedAt, &sess.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("placement: get session: %w", err)
	}
	if err := json.Unmarshal(qidsJSON, &sess.QuestionIDs); err != nil {
		sess.QuestionIDs = []string{}
	}
	return &sess, nil
}

// CompleteSession marks a placement session as completed with scoring results.
func (s *Store) CompleteSession(ctx context.Context, sessionID, userID string, correctCount int, band string) (*SubmitResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE assessment.placement_test_session
SET status = 'completed', correct_count = $3, estimated_bjt_band = $4, completed_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING correct_count, estimated_bjt_band`

	var cc int
	var b string
	err := s.db.QueryRow(ctx, q, sessionID, userID, correctCount, band).Scan(&cc, &b)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("placement: complete session: %w", err)
	}

	// Update onboarding step
	const updateStep = `UPDATE profile.learner_onboarding SET current_step = 'placement_complete', updated_at = NOW() WHERE user_id = $1`
	if _, err := s.db.Exec(ctx, updateStep, userID); err != nil {
		// Non-fatal: log but don't fail the response
		fmt.Printf("placement: update onboarding step failed: %v\n", err)
	}

	return &SubmitResponse{
		CorrectCount:     &cc,
		EstimatedBjtBand: &b,
	}, nil
}

// LoadQuestionPool returns published BJT question IDs for placement selection.
// Returns empty slice if no questions are available (caller should handle).
func (s *Store) LoadQuestionPool(ctx context.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id FROM assessment.bjt_question WHERE status = 'published' ORDER BY RANDOM() LIMIT 20`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("placement: load question pool: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("placement: scan question id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}