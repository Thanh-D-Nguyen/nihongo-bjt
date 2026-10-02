// Package scenario provides access to business scenarios, steps, choices, and user attempts.
package scenario

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested entity does not exist.
var ErrNotFound = errors.New("scenario: not found")

// ScenarioSummary is a list entry for GET /api/scenarios.
type ScenarioSummary struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	Difficulty  string  `json:"difficulty"`
	Category    string  `json:"category"`
	StepCount   int     `json:"stepCount"`
	Status      string  `json:"status"`
}

// ScenarioDetail is the full scenario with steps and choices for playback.
type ScenarioDetail struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Description *string        `json:"description,omitempty"`
	Difficulty  string         `json:"difficulty"`
	Category    string         `json:"category"`
	Status      string         `json:"status"`
	Steps       []ScenarioStep `json:"steps"`
}

// ScenarioStep is one step in a scenario with its choices.
type ScenarioStep struct {
	ID          string           `json:"id"`
	StepOrder   int              `json:"stepOrder"`
	SituationVi string           `json:"situationVi"`
	SituationJa *string          `json:"situationJa,omitempty"`
	SpeakerName *string          `json:"speakerName,omitempty"`
	SpeakerRole *string          `json:"speakerRole,omitempty"`
	Choices     []ScenarioChoice `json:"choices"`
}

// ScenarioChoice is one answer option within a step.
type ScenarioChoice struct {
	ID            string  `json:"id"`
	ChoiceKey     string  `json:"choiceKey"`
	TextVi        string  `json:"textVi"`
	TextJa        *string `json:"textJa,omitempty"`
	IsOptimal     bool    `json:"isOptimal"`
	FeedbackVi    *string `json:"feedbackVi,omitempty"`
	PointsAwarded int     `json:"pointsAwarded"`
}

// StepAnswerRequest is the JSON body for POST /api/scenarios/steps/{stepId}/answer.
type StepAnswerRequest struct {
	ChoiceID string `json:"choiceId"`
}

// StepAnswerResult is the response for a step answer submission.
type StepAnswerResult struct {
	Correct       bool    `json:"correct"`
	PointsAwarded int     `json:"pointsAwarded"`
	FeedbackVi    *string `json:"feedbackVi,omitempty"`
}

// CompleteRequest is the JSON body for POST /api/scenarios/{scenarioId}/complete.
type CompleteRequest struct {
	Choices []ChoiceRecord `json:"choices"`
}

// ChoiceRecord is one recorded choice in a completed scenario.
type ChoiceRecord struct {
	StepID   string `json:"stepId"`
	ChoiceID string `json:"choiceId"`
}

// UserAttempt is a past scenario attempt for GET /api/scenarios/{scenarioId}/attempts.
type UserAttempt struct {
	ID          string    `json:"id"`
	TotalPoints int       `json:"totalPoints"`
	MaxPoints   int       `json:"maxPoints"`
	Choices     []byte    `json:"choices"` // raw JSON
	CompletedAt time.Time `json:"completedAt"`
}

// Store provides read/write access to content.business_scenario and related tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a scenario store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ListScenarios returns all published scenarios.
func (s *Store) ListScenarios(ctx context.Context) ([]ScenarioSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT bs.id, bs.title, bs.description, bs.difficulty, bs.category, bs.status,
		(SELECT COUNT(*) FROM content.scenario_step ss WHERE ss.scenario_id = bs.id) as step_count
	FROM content.business_scenario bs
	WHERE bs.status = 'published'
	ORDER BY bs.created_at DESC`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("scenario: list: %w", err)
	}
	defer rows.Close()

	var scenarios []ScenarioSummary
	for rows.Next() {
		var sc ScenarioSummary
		if err := rows.Scan(&sc.ID, &sc.Title, &sc.Description, &sc.Difficulty, &sc.Category, &sc.Status, &sc.StepCount); err != nil {
			return nil, fmt.Errorf("scenario: scan: %w", err)
		}
		scenarios = append(scenarios, sc)
	}
	if scenarios == nil {
		scenarios = []ScenarioSummary{}
	}
	return scenarios, nil
}

// GetScenario returns a full scenario with steps and choices.
func (s *Store) GetScenario(ctx context.Context, scenarioID string) (*ScenarioDetail, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const metaQ = `SELECT id, title, description, difficulty, category, status
	FROM content.business_scenario WHERE id = $1 AND status = 'published'`

	var sd ScenarioDetail
	if err := s.db.QueryRow(ctx, metaQ, scenarioID).Scan(&sd.ID, &sd.Title, &sd.Description, &sd.Difficulty, &sd.Category, &sd.Status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scenario: get meta: %w", err)
	}

	const stepQ = `SELECT id, step_order, situation_vi, situation_ja, speaker_name, speaker_role
	FROM content.scenario_step WHERE scenario_id = $1 ORDER BY step_order ASC`

	rows, err := s.db.Query(ctx, stepQ, scenarioID)
	if err != nil {
		return nil, fmt.Errorf("scenario: get steps: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var step ScenarioStep
		if err := rows.Scan(&step.ID, &step.StepOrder, &step.SituationVi, &step.SituationJa, &step.SpeakerName, &step.SpeakerRole); err != nil {
			return nil, fmt.Errorf("scenario: scan step: %w", err)
		}

		const choiceQ = `SELECT id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded
		FROM content.scenario_choice WHERE step_id = $1 ORDER BY choice_key ASC`

		cRows, err := s.db.Query(ctx, choiceQ, step.ID)
		if err != nil {
			return nil, fmt.Errorf("scenario: get choices: %w", err)
		}
		for cRows.Next() {
			var c ScenarioChoice
			if err := cRows.Scan(&c.ID, &c.ChoiceKey, &c.TextVi, &c.TextJa, &c.IsOptimal, &c.FeedbackVi, &c.PointsAwarded); err != nil {
				cRows.Close()
				return nil, fmt.Errorf("scenario: scan choice: %w", err)
			}
			step.Choices = append(step.Choices, c)
		}
		cRows.Close()
		if step.Choices == nil {
			step.Choices = []ScenarioChoice{}
		}
		sd.Steps = append(sd.Steps, step)
	}
	if sd.Steps == nil {
		sd.Steps = []ScenarioStep{}
	}
	return &sd, nil
}

// SubmitStepAnswer validates a single step choice and returns feedback.
func (s *Store) SubmitStepAnswer(ctx context.Context, stepID, choiceID string) (*StepAnswerResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT is_optimal, feedback_vi, points_awarded
	FROM content.scenario_choice WHERE id = $1 AND step_id = $2`

	var result StepAnswerResult
	if err := s.db.QueryRow(ctx, q, choiceID, stepID).Scan(&result.Correct, &result.FeedbackVi, &result.PointsAwarded); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scenario: submit answer: %w", err)
	}
	return &result, nil
}

// CompleteScenario records a finished scenario attempt.
func (s *Store) CompleteScenario(ctx context.Context, userID, scenarioID string, choices []ChoiceRecord) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Calculate total/max points
	var totalPoints, maxPoints int
	for _, cr := range choices {
		const pq = `SELECT points_awarded FROM content.scenario_choice WHERE id = $1`
		var pts int
		if err := s.db.QueryRow(ctx, pq, cr.ChoiceID).Scan(&pts); err == nil {
			totalPoints += pts
		}
	}
	const maxQ = `SELECT COALESCE(SUM(points_awarded), 0) FROM content.scenario_choice sc
	JOIN content.scenario_step ss ON ss.id = sc.step_id
	WHERE ss.scenario_id = $1 AND sc.is_optimal = true`
	if err := s.db.QueryRow(ctx, maxQ, scenarioID).Scan(&maxPoints); err != nil {
		maxPoints = 0
	}

	choicesJSON, _ := json.Marshal(choices)
	const insertQ = `INSERT INTO content.user_scenario_attempt (user_id, scenario_id, total_points, max_points, choices, completed_at)
	VALUES ($1, $2, $3, $4, $5, NOW())`
	if _, err := s.db.Exec(ctx, insertQ, userID, scenarioID, totalPoints, maxPoints, choicesJSON); err != nil {
		return fmt.Errorf("scenario: complete: %w", err)
	}
	return nil
}

// GetAttempts returns all attempts for a user on a scenario.
func (s *Store) GetAttempts(ctx context.Context, userID, scenarioID string) ([]UserAttempt, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, total_points, max_points, choices, completed_at
	FROM content.user_scenario_attempt
	WHERE user_id = $1 AND scenario_id = $2
	ORDER BY completed_at DESC`

	rows, err := s.db.Query(ctx, q, userID, scenarioID)
	if err != nil {
		return nil, fmt.Errorf("scenario: get attempts: %w", err)
	}
	defer rows.Close()

	var attempts []UserAttempt
	for rows.Next() {
		var a UserAttempt
		if err := rows.Scan(&a.ID, &a.TotalPoints, &a.MaxPoints, &a.Choices, &a.CompletedAt); err != nil {
			return nil, fmt.Errorf("scenario: scan attempt: %w", err)
		}
		attempts = append(attempts, a)
	}
	if attempts == nil {
		attempts = []UserAttempt{}
	}
	return attempts, nil
}
