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
var ErrInvalidAnswer = errors.New("placement: invalid answer")

// Session represents a placement test session.
type Session struct {
	ID               string     `json:"id"`
	UserID           string     `json:"userId"`
	FairnessSeed     string     `json:"fairnessSeed"`
	Status           string     `json:"status"`
	QuestionIDs      []string   `json:"questionIds"`
	CorrectCount     *int       `json:"correctCount,omitempty"`
	EstimatedBjtBand *string    `json:"estimatedBjtBand,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	CompletedAt      *time.Time `json:"completedAt,omitempty"`
}

// StartResponse is returned by POST /api/learner/placement/start.
type StartResponse struct {
	SessionID   string     `json:"sessionId"`
	QuestionIDs []string   `json:"questionIds"`
	Status      string     `json:"status"`
	Questions   []Question `json:"questions"`
}

type Question struct {
	ID       string           `json:"id"`
	Prompt   string           `json:"prompt"`
	SkillTag string           `json:"skillTag"`
	Options  []QuestionOption `json:"options"`
}

type QuestionOption struct {
	OptionKey string `json:"optionKey"`
	Text      string `json:"text"`
}

type OnboardingState struct {
	CurrentStep      string     `json:"currentStep"`
	SessionID        string     `json:"sessionId,omitempty"`
	Status           string     `json:"status,omitempty"`
	Questions        []Question `json:"questions,omitempty"`
	CorrectCount     *int       `json:"correctCount,omitempty"`
	EstimatedBjtBand *string    `json:"estimatedBjtBand,omitempty"`
}

// SubmitInput contains validated fields for submitting placement answers.
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

func (s *Store) GetOnboardingState(ctx context.Context, userID string) (*OnboardingState, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT COALESCE(o.current_step, 'not_started'), p.id::text, p.status,
		p.question_ids, p.correct_count, p.estimated_bjt_band
	FROM (SELECT $1::uuid AS user_id) learner
	LEFT JOIN profile.learner_onboarding o ON o.user_id = learner.user_id
	LEFT JOIN assessment.placement_test_session p ON p.id = o.placement_test_session_id`
	state := &OnboardingState{}
	var sessionID, status *string
	var questionIDs []byte
	if err := s.db.QueryRow(ctx, q, userID).Scan(
		&state.CurrentStep, &sessionID, &status, &questionIDs, &state.CorrectCount, &state.EstimatedBjtBand,
	); err != nil {
		return nil, fmt.Errorf("placement: get onboarding state: %w", err)
	}
	if sessionID == nil {
		return state, nil
	}
	state.SessionID = *sessionID
	state.Status = *status
	var ids []string
	if err := json.Unmarshal(questionIDs, &ids); err != nil {
		return nil, fmt.Errorf("placement: decode onboarding question IDs: %w", err)
	}
	if state.Status == "in_progress" {
		questions, err := s.LoadQuestions(ctx, ids)
		if err != nil {
			return nil, err
		}
		state.Questions = questions
	}
	return state, nil
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
	const upsertOnboarding = `INSERT INTO profile.learner_onboarding (user_id, current_step, updated_at)
VALUES ($1, 'placement_active', NOW())
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

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("placement: begin completion: %w", err)
	}
	defer tx.Rollback(ctx)

	const q = `UPDATE assessment.placement_test_session
SET status = 'completed', correct_count = $3, estimated_bjt_band = $4, completed_at = NOW()
WHERE id = $1 AND user_id = $2 AND status = 'in_progress'
RETURNING correct_count, estimated_bjt_band`

	var cc int
	var b string
	err = tx.QueryRow(ctx, q, sessionID, userID, correctCount, band).Scan(&cc, &b)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("placement: complete session: %w", err)
	}

	const updateStep = `UPDATE profile.learner_onboarding
	SET current_step = 'placement_complete', onboarded_at = NOW(), updated_at = NOW()
	WHERE user_id = $1 AND placement_test_session_id = $2`
	if _, err := tx.Exec(ctx, updateStep, userID, sessionID); err != nil {
		return nil, fmt.Errorf("placement: complete onboarding: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("placement: commit completion: %w", err)
	}

	return &SubmitResponse{
		CorrectCount:     &cc,
		EstimatedBjtBand: &b,
	}, nil
}

func (s *Store) ScoreAnswers(ctx context.Context, sessionID, userID string, answers map[string]string) (int, error) {
	session, err := s.GetSession(ctx, sessionID, userID)
	if err != nil {
		return 0, err
	}
	if session.Status == "completed" && session.CorrectCount != nil {
		return *session.CorrectCount, nil
	}
	if len(answers) != len(session.QuestionIDs) {
		return 0, ErrInvalidAnswer
	}
	correctCount := 0
	for _, questionID := range session.QuestionIDs {
		optionKey, ok := answers[questionID]
		if !ok || optionKey == "" {
			return 0, ErrInvalidAnswer
		}
		var correct bool
		err := s.db.QueryRow(ctx, `SELECT is_correct FROM assessment.bjt_question_option
			WHERE question_id = $1 AND option_key = $2`, questionID, optionKey).Scan(&correct)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrInvalidAnswer
		}
		if err != nil {
			return 0, fmt.Errorf("placement: score answer: %w", err)
		}
		if correct {
			correctCount++
		}
	}
	return correctCount, nil
}

// LoadQuestionPool returns published BJT question IDs for placement selection.
// Returns empty slice if no questions are available (caller should handle).
func (s *Store) LoadQuestionPool(ctx context.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT q.id::text
	FROM assessment.bjt_question q
	JOIN LATERAL (
		SELECT count(*) AS option_count, count(*) FILTER (WHERE is_correct) AS correct_count
		FROM assessment.bjt_question_option WHERE question_id = q.id
	) options ON options.option_count >= 2 AND options.correct_count = 1
	WHERE q.status = 'published'
	ORDER BY RANDOM() LIMIT 20`
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

func (s *Store) LoadQuestions(ctx context.Context, questionIDs []string) ([]Question, error) {
	if len(questionIDs) == 0 {
		return []Question{}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	idsJSON, err := json.Marshal(questionIDs)
	if err != nil {
		return nil, fmt.Errorf("placement: marshal question IDs: %w", err)
	}
	const q = `SELECT q.id::text, q.prompt, q.skill_tag, o.option_key, o.text
	FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY selected(id, ord)
	JOIN assessment.bjt_question q ON q.id = selected.id::uuid AND q.status = 'published'
	JOIN assessment.bjt_question_option o ON o.question_id = q.id
	ORDER BY selected.ord, o.option_key`
	rows, err := s.db.Query(ctx, q, idsJSON)
	if err != nil {
		return nil, fmt.Errorf("placement: load questions: %w", err)
	}
	defer rows.Close()
	questions := make([]Question, 0, len(questionIDs))
	byID := make(map[string]int, len(questionIDs))
	for rows.Next() {
		var id, prompt, skillTag, optionKey, optionText string
		if err := rows.Scan(&id, &prompt, &skillTag, &optionKey, &optionText); err != nil {
			return nil, fmt.Errorf("placement: scan question: %w", err)
		}
		index, ok := byID[id]
		if !ok {
			index = len(questions)
			byID[id] = index
			questions = append(questions, Question{ID: id, Prompt: prompt, SkillTag: skillTag, Options: []QuestionOption{}})
		}
		questions[index].Options = append(questions[index].Options, QuestionOption{OptionKey: optionKey, Text: optionText})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("placement: iterate questions: %w", err)
	}
	if len(questions) != len(questionIDs) {
		return nil, fmt.Errorf("placement: question set changed during active session")
	}
	return questions, nil
}
