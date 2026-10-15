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
var ErrInvalidCompletion = errors.New("scenario: invalid completion")

// ScenarioSummary is a list entry for GET /api/scenarios.
type ScenarioSummary struct {
	ID           string         `json:"id"`
	Slug         string         `json:"slug"`
	Title        string         `json:"titleVi"`
	TitleJa      *string        `json:"titleJa,omitempty"`
	Description  *string        `json:"descriptionVi,omitempty"`
	Difficulty   string         `json:"difficulty"`
	Category     string         `json:"category"`
	IconEmoji    string         `json:"iconEmoji"`
	EstimatedMin int            `json:"estimatedMin"`
	Count        ScenarioCounts `json:"_count"`
}

type ScenarioCounts struct {
	Steps    int `json:"steps"`
	Attempts int `json:"attempts"`
}

// ScenarioDetail is the full scenario with steps and choices for playback.
type ScenarioDetail struct {
	ID           string         `json:"id"`
	Slug         string         `json:"slug"`
	Title        string         `json:"titleVi"`
	TitleJa      *string        `json:"titleJa,omitempty"`
	Description  *string        `json:"descriptionVi,omitempty"`
	Difficulty   string         `json:"difficulty"`
	Category     string         `json:"category"`
	IconEmoji    string         `json:"iconEmoji"`
	EstimatedMin int            `json:"estimatedMin"`
	Steps        []ScenarioStep `json:"steps"`
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
	ID        string  `json:"id"`
	ChoiceKey string  `json:"choiceKey"`
	TextVi    string  `json:"textVi"`
	TextJa    *string `json:"textJa,omitempty"`
}

// StepAnswerRequest is the JSON body for POST /api/scenarios/steps/{stepId}/answer.
type StepAnswerRequest struct {
	ChoiceKey string `json:"choiceKey"`
	ChoiceID  string `json:"choiceId,omitempty"`
}

// StepAnswerResult is the response for a step answer submission.
type StepAnswerResult struct {
	ChoiceKey     string  `json:"choiceKey"`
	IsOptimal     bool    `json:"isOptimal"`
	PointsAwarded int     `json:"pointsAwarded"`
	FeedbackVi    *string `json:"feedbackVi,omitempty"`
}

// CompleteRequest is the JSON body for POST /api/scenarios/{scenarioId}/complete.
type CompleteRequest struct {
	Choices []ChoiceRecord `json:"choices"`
}

// ChoiceRecord is one recorded choice in a completed scenario.
type ChoiceRecord struct {
	StepID    string `json:"stepId,omitempty"`
	ChoiceID  string `json:"choiceId,omitempty"`
	StepOrder int    `json:"stepOrder,omitempty"`
	ChoiceKey string `json:"choiceKey,omitempty"`
	Points    int    `json:"points,omitempty"`
}

type UserAttemptResult struct {
	ID          string `json:"id"`
	TotalPoints int    `json:"totalPoints"`
	MaxPoints   int    `json:"maxPoints"`
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

	const q = `SELECT bs.id, bs.slug, bs.title_vi, bs.title_ja, bs.description_vi, bs.difficulty, bs.category,
		bs.icon_emoji, bs.estimated_min,
		(SELECT COUNT(*) FROM content.scenario_step ss WHERE ss.scenario_id = bs.id) as step_count,
		(SELECT COUNT(*) FROM content.user_scenario_attempt a WHERE a.scenario_id = bs.id) as attempt_count
	FROM content.business_scenario bs
	WHERE bs.active = true
	AND EXISTS (SELECT 1 FROM content.scenario_step playable WHERE playable.scenario_id = bs.id)
	AND NOT EXISTS (
		SELECT 1 FROM content.scenario_step unplayable WHERE unplayable.scenario_id = bs.id
		AND NOT EXISTS (SELECT 1 FROM content.scenario_choice choice WHERE choice.step_id = unplayable.id)
	)
	ORDER BY bs.sort_order, bs.created_at DESC`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("scenario: list: %w", err)
	}
	defer rows.Close()

	var scenarios []ScenarioSummary
	for rows.Next() {
		var sc ScenarioSummary
		if err := rows.Scan(&sc.ID, &sc.Slug, &sc.Title, &sc.TitleJa, &sc.Description, &sc.Difficulty, &sc.Category, &sc.IconEmoji, &sc.EstimatedMin, &sc.Count.Steps, &sc.Count.Attempts); err != nil {
			return nil, fmt.Errorf("scenario: scan: %w", err)
		}
		scenarios = append(scenarios, sc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scenario: list rows: %w", err)
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

	const metaQ = `SELECT id, slug, title_vi, title_ja, description_vi, difficulty, category, icon_emoji, estimated_min
	FROM content.business_scenario WHERE id = $1 AND active = true`

	var sd ScenarioDetail
	if err := s.db.QueryRow(ctx, metaQ, scenarioID).Scan(&sd.ID, &sd.Slug, &sd.Title, &sd.TitleJa, &sd.Description, &sd.Difficulty, &sd.Category, &sd.IconEmoji, &sd.EstimatedMin); err != nil {
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

		const choiceQ = `SELECT id, choice_key, text_vi, text_ja
		FROM content.scenario_choice WHERE step_id = $1 ORDER BY choice_key ASC`

		cRows, err := s.db.Query(ctx, choiceQ, step.ID)
		if err != nil {
			return nil, fmt.Errorf("scenario: get choices: %w", err)
		}
		for cRows.Next() {
			var c ScenarioChoice
			if err := cRows.Scan(&c.ID, &c.ChoiceKey, &c.TextVi, &c.TextJa); err != nil {
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
	if len(sd.Steps) == 0 {
		return nil, ErrNotFound
	}
	for _, step := range sd.Steps {
		if len(step.Choices) == 0 {
			return nil, ErrNotFound
		}
	}
	return &sd, nil
}

// SubmitStepAnswer validates a single step choice and returns feedback.
func (s *Store) SubmitStepAnswer(ctx context.Context, stepID, choiceKey string) (*StepAnswerResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT ch.choice_key, ch.is_optimal, ch.feedback_vi, ch.points_awarded
	FROM content.scenario_choice ch JOIN content.scenario_step st ON st.id = ch.step_id
	JOIN content.business_scenario bs ON bs.id = st.scenario_id
	WHERE (ch.choice_key = $1 OR ch.id::text = $1) AND st.id = $2 AND bs.active = true`

	var result StepAnswerResult
	if err := s.db.QueryRow(ctx, q, choiceKey, stepID).Scan(&result.ChoiceKey, &result.IsOptimal, &result.FeedbackVi, &result.PointsAwarded); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scenario: submit answer: %w", err)
	}
	return &result, nil
}

// CompleteScenario records a finished scenario attempt.
func (s *Store) CompleteScenario(ctx context.Context, userID, scenarioID string, choices []ChoiceRecord) (*UserAttemptResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("scenario: begin completion: %w", err)
	}
	defer tx.Rollback(ctx)
	var stepCount int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM content.business_scenario bs JOIN content.scenario_step st ON st.scenario_id = bs.id WHERE bs.id = $1 AND bs.active = true`, scenarioID).Scan(&stepCount); err != nil {
		return nil, fmt.Errorf("scenario: validate active scenario: %w", err)
	}
	if stepCount == 0 {
		return nil, ErrNotFound
	}
	if len(choices) != stepCount {
		return nil, fmt.Errorf("%w: expected %d answers, got %d", ErrInvalidCompletion, stepCount, len(choices))
	}
	var totalPoints, maxPoints int
	answers := make([]map[string]any, 0, len(choices))
	seenSteps := make(map[int]struct{}, len(choices))
	for _, cr := range choices {
		var order int
		var choiceID, key string
		var points int
		q := `SELECT st.step_order, ch.id::text, ch.choice_key, ch.points_awarded FROM content.scenario_choice ch
		JOIN content.scenario_step st ON st.id = ch.step_id WHERE st.scenario_id = $1 AND `
		if cr.StepID != "" && cr.ChoiceID != "" {
			err = tx.QueryRow(ctx, q+`st.id = $2 AND ch.id = $3`, scenarioID, cr.StepID, cr.ChoiceID).Scan(&order, &choiceID, &key, &points)
		} else {
			err = tx.QueryRow(ctx, q+`st.step_order = $2 AND ch.choice_key = $3`, scenarioID, cr.StepOrder, cr.ChoiceKey).Scan(&order, &choiceID, &key, &points)
		}
		if err != nil {
			return nil, fmt.Errorf("%w: invalid choice: %v", ErrInvalidCompletion, err)
		}
		if _, duplicate := seenSteps[order]; duplicate {
			return nil, fmt.Errorf("%w: duplicate answer for step %d", ErrInvalidCompletion, order)
		}
		seenSteps[order] = struct{}{}
		totalPoints += points
		answers = append(answers, map[string]any{"stepOrder": order, "choiceKey": key})
	}
	if err := tx.QueryRow(ctx, `SELECT COALESCE(SUM(best.points_awarded), 0) FROM (
		SELECT MAX(ch.points_awarded) AS points_awarded FROM content.scenario_choice ch
		JOIN content.scenario_step st ON st.id = ch.step_id
		WHERE st.scenario_id = $1 AND ch.is_optimal = true GROUP BY st.id
	) best`, scenarioID).Scan(&maxPoints); err != nil {
		return nil, fmt.Errorf("scenario: calculate max points: %w", err)
	}
	choicesJSON, err := json.Marshal(answers)
	if err != nil {
		return nil, fmt.Errorf("scenario: encode choices: %w", err)
	}
	var result UserAttemptResult
	err = tx.QueryRow(ctx, `INSERT INTO content.user_scenario_attempt (user_id, scenario_id, total_points, max_points, choices, completed_at)
	VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id::text, total_points, max_points`, userID, scenarioID, totalPoints, maxPoints, choicesJSON).Scan(&result.ID, &result.TotalPoints, &result.MaxPoints)
	if err != nil {
		return nil, fmt.Errorf("scenario: complete: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("scenario: commit completion: %w", err)
	}
	return &result, nil
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
