// Package studyplan provides access to daily study plans and progress tracking.
package studyplan

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TodayPlan represents the auto-generated daily study plan for a learner.
type TodayPlan struct {
	Date       string      `json:"date"`
	Tasks      []StudyTask `json:"tasks"`
	Completed  int         `json:"completed"`
	Total      int         `json:"total"`
	StreakDays int         `json:"streakDays"`
}

// StudyTask is one item in the daily study plan.
type StudyTask struct {
	TaskType    string `json:"taskType"`
	Label       string `json:"label"`
	TargetCount int    `json:"targetCount"`
	DoneCount   int    `json:"doneCount"`
	IsComplete  bool   `json:"isComplete"`
}

// ProgressResult is returned after recording task progress.
type ProgressResult struct {
	TaskType   string `json:"taskType"`
	DoneCount  int    `json:"doneCount"`
	IsComplete bool   `json:"isComplete"`
	StreakDays int    `json:"streakDays"`
}

// Store provides read/write access to gamification.daily_study_plan and related tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a study plan store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetTodayPlan returns or auto-generates today's study plan for the user.
func (s *Store) GetTodayPlan(ctx context.Context, userID string) (*TodayPlan, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	today := time.Now().Format("2006-01-02")

	// Try to load existing plan
	const q = `SELECT date, tasks, completed, total, streak_days
		FROM gamification.daily_study_plan
		WHERE user_id = $1 AND date = $2`
	var plan TodayPlan
	var tasksJSON []byte
	err := s.db.QueryRow(ctx, q, userID, today).Scan(&plan.Date, &tasksJSON, &plan.Completed, &plan.Total, &plan.StreakDays)
	if err == nil {
		if len(tasksJSON) > 0 {
			_ = json.Unmarshal(tasksJSON, &plan.Tasks)
		}
		if plan.Tasks == nil {
			plan.Tasks = []StudyTask{}
		}
		return &plan, nil
	}

	// Auto-generate default plan if not found
	defaultTasks := []StudyTask{
		{TaskType: "srs_review", Label: "SRS Review", TargetCount: 20, DoneCount: 0, IsComplete: false},
		{TaskType: "bjt_quiz", Label: "BJT Quiz", TargetCount: 1, DoneCount: 0, IsComplete: false},
		{TaskType: "daily_phrase", Label: "Daily Phrase", TargetCount: 1, DoneCount: 0, IsComplete: false},
		{TaskType: "battle_bot", Label: "Battle Bot", TargetCount: 1, DoneCount: 0, IsComplete: false},
	}
	tasksBytes, _ := json.Marshal(defaultTasks)

	const insertQ = `INSERT INTO gamification.daily_study_plan (user_id, date, tasks, completed, total, streak_days)
		VALUES ($1, $2, $3, 0, 4, COALESCE(
			(SELECT streak_days FROM gamification.daily_study_plan WHERE user_id = $1 ORDER BY date DESC LIMIT 1), 0
		))
		ON CONFLICT (user_id, date) DO NOTHING`
	if _, err := s.db.Exec(ctx, insertQ, userID, today, tasksBytes); err != nil {
		// Non-fatal: return default plan even if insert fails
	}

	return &TodayPlan{
		Date:       today,
		Tasks:      defaultTasks,
		Completed:  0,
		Total:      4,
		StreakDays: 0,
	}, nil
}

// RecordProgress increments the done count for a task type and returns updated state.
func (s *Store) RecordProgress(ctx context.Context, userID, taskType string) (*ProgressResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	today := time.Now().Format("2006-01-02")

	// Ensure plan exists
	if _, err := s.GetTodayPlan(ctx, userID); err != nil {
		return nil, fmt.Errorf("studyplan: get today plan: %w", err)
	}

	// Load current tasks
	const loadQ = `SELECT tasks, completed, total, streak_days FROM gamification.daily_study_plan WHERE user_id = $1 AND date = $2`
	var tasksJSON []byte
	var completed, total, streakDays int
	if err := s.db.QueryRow(ctx, loadQ, userID, today).Scan(&tasksJSON, &completed, &total, &streakDays); err != nil {
		return nil, fmt.Errorf("studyplan: load plan: %w", err)
	}

	var tasks []StudyTask
	if len(tasksJSON) > 0 {
		_ = json.Unmarshal(tasksJSON, &tasks)
	}

	// Find and update the matching task
	var result ProgressResult
	result.TaskType = taskType
	found := false
	for i, t := range tasks {
		if t.TaskType == taskType {
			tasks[i].DoneCount++
			if tasks[i].DoneCount >= tasks[i].TargetCount {
				tasks[i].IsComplete = true
				if !t.IsComplete {
					completed++
				}
			}
			result.DoneCount = tasks[i].DoneCount
			result.IsComplete = tasks[i].IsComplete
			found = true
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("studyplan: unknown task type: %s", taskType)
	}

	// Save updated tasks
	updatedBytes, _ := json.Marshal(tasks)
	const updateQ = `UPDATE gamification.daily_study_plan SET tasks = $3, completed = $4, updated_at = NOW() WHERE user_id = $1 AND date = $2`
	if _, err := s.db.Exec(ctx, updateQ, userID, today, updatedBytes, completed); err != nil {
		return nil, fmt.Errorf("studyplan: update plan: %w", err)
	}

	result.StreakDays = streakDays
	return &result, nil
}

// Ensure imports are used.
var _ = pgx.ErrNoRows