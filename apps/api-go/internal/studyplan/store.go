// Package studyplan provides access to daily study plans and progress tracking.
package studyplan

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TodayPlan represents the auto-generated daily study plan for a learner.
type TodayPlan struct {
	Date          string      `json:"date"`
	TargetMinutes int         `json:"targetMinutes"`
	Tasks         []StudyTask `json:"tasks"`
	Completed     int         `json:"completed"`
	Total         int         `json:"total"`
	StreakDays    int         `json:"streakDays"`
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
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("studyplan: begin plan read: %w", err)
	}
	defer tx.Rollback(ctx)

	planID, err := ensureTodayPlan(ctx, tx, userID, today)
	if err != nil {
		return nil, err
	}
	plan := &TodayPlan{Date: today, Tasks: []StudyTask{}}
	if err := tx.QueryRow(ctx, `SELECT target_minutes FROM gamification.daily_study_plan WHERE id=$1`, planID).Scan(&plan.TargetMinutes); err != nil {
		return nil, fmt.Errorf("studyplan: load target minutes: %w", err)
	}
	rows, err := tx.Query(ctx, `SELECT task_type,target_count,done_count,completed_at
		FROM gamification.daily_study_task WHERE plan_id=$1 ORDER BY sort_order,created_at`, planID)
	if err != nil {
		return nil, fmt.Errorf("studyplan: load tasks: %w", err)
	}
	for rows.Next() {
		var task StudyTask
		var completedAt *time.Time
		if err := rows.Scan(&task.TaskType, &task.TargetCount, &task.DoneCount, &completedAt); err != nil {
			rows.Close()
			return nil, fmt.Errorf("studyplan: scan task: %w", err)
		}
		task.Label = taskLabel(task.TaskType)
		task.IsComplete = completedAt != nil || task.DoneCount >= task.TargetCount
		if task.IsComplete {
			plan.Completed++
		}
		plan.Tasks = append(plan.Tasks, task)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("studyplan: iterate tasks: %w", err)
	}
	rows.Close()
	plan.Total = len(plan.Tasks)
	plan.StreakDays, err = loadStreakDays(ctx, tx, userID, today)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("studyplan: commit plan read: %w", err)
	}
	return plan, nil
}

// RecordProgress increments the done count for a task type and returns updated state.
func (s *Store) RecordProgress(ctx context.Context, userID, taskType string) (*ProgressResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("studyplan: begin progress: %w", err)
	}
	defer tx.Rollback(ctx)
	result, err := s.RecordProgressTx(ctx, tx, userID, taskType)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("studyplan: commit progress: %w", err)
	}
	return result, nil
}

// RecordProgressTx records task progress inside the caller's transaction.
func (s *Store) RecordProgressTx(ctx context.Context, tx pgx.Tx, userID, taskType string) (*ProgressResult, error) {
	today := time.Now().Format("2006-01-02")
	var planID string
	planID, err := ensureTodayPlan(ctx, tx, userID, today)
	if err != nil {
		return nil, fmt.Errorf("studyplan: load plan: %w", err)
	}
	var result ProgressResult
	result.TaskType = taskType
	var completedAt *time.Time
	var targetCount int
	if err := tx.QueryRow(ctx, `UPDATE gamification.daily_study_task
		SET done_count=done_count+1,
		    completed_at=CASE WHEN done_count+1 >= target_count THEN COALESCE(completed_at,NOW()) ELSE NULL END
		WHERE plan_id=$1 AND task_type=$2
		RETURNING done_count,target_count,completed_at`, planID, taskType).Scan(&result.DoneCount, &targetCount, &completedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("studyplan: unknown task type: %s", taskType)
		}
		return nil, fmt.Errorf("studyplan: update task: %w", err)
	}
	result.IsComplete = completedAt != nil || result.DoneCount >= targetCount
	if _, err := tx.Exec(ctx, `UPDATE gamification.daily_study_plan
		SET completed_at=CASE WHEN NOT EXISTS (
			SELECT 1 FROM gamification.daily_study_task WHERE plan_id=$1 AND done_count < target_count
		) THEN COALESCE(completed_at,NOW()) ELSE NULL END, updated_at=NOW()
		WHERE id=$1`, planID); err != nil {
		return nil, fmt.Errorf("studyplan: update plan completion: %w", err)
	}
	result.StreakDays, err = loadStreakDays(ctx, tx, userID, today)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func ensureTodayPlan(ctx context.Context, tx pgx.Tx, userID, today string) (string, error) {
	if _, err := tx.Exec(ctx, `INSERT INTO gamification.daily_study_plan(user_id,plan_date,target_minutes,updated_at)
		SELECT $1,$2::date,COALESCE((SELECT target_minutes FROM gamification.daily_study_goal WHERE user_id=$1),20),NOW()
		ON CONFLICT(user_id,plan_date) DO NOTHING`, userID, today); err != nil {
		return "", fmt.Errorf("studyplan: create plan: %w", err)
	}
	var planID string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM gamification.daily_study_plan WHERE user_id=$1 AND plan_date=$2::date FOR UPDATE`, userID, today).Scan(&planID); err != nil {
		return "", fmt.Errorf("studyplan: lock plan: %w", err)
	}
	var taskCount int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM gamification.daily_study_task WHERE plan_id=$1`, planID).Scan(&taskCount); err != nil {
		return "", fmt.Errorf("studyplan: count tasks: %w", err)
	}
	if taskCount == 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO gamification.daily_study_task(plan_id,task_type,target_count,sort_order) VALUES
			($1,'srs_review',20,1),($1,'bjt_quiz',1,2),($1,'daily_phrase',1,3),($1,'battle_bot',1,4)`, planID); err != nil {
			return "", fmt.Errorf("studyplan: create tasks: %w", err)
		}
	}
	return planID, nil
}

func taskLabel(taskType string) string {
	labels := map[string]string{"srs_review": "SRS Review", "bjt_quiz": "BJT Quiz", "daily_phrase": "Daily Phrase", "battle_bot": "Battle Bot"}
	if label, ok := labels[taskType]; ok {
		return label
	}
	return strings.ReplaceAll(taskType, "_", " ")
}

func loadStreakDays(ctx context.Context, tx pgx.Tx, userID, today string) (int, error) {
	rows, err := tx.Query(ctx, `SELECT plan_date::text FROM gamification.daily_study_plan
		WHERE user_id=$1 AND completed_at IS NOT NULL AND plan_date <= $2::date ORDER BY plan_date DESC LIMIT 366`, userID, today)
	if err != nil {
		return 0, fmt.Errorf("studyplan: load completed dates: %w", err)
	}
	defer rows.Close()
	todayDate, err := time.Parse("2006-01-02", today)
	if err != nil {
		return 0, fmt.Errorf("studyplan: parse today: %w", err)
	}
	expected := todayDate
	streak := 0
	for rows.Next() {
		var rawDate string
		if err := rows.Scan(&rawDate); err != nil {
			return 0, fmt.Errorf("studyplan: scan completed date: %w", err)
		}
		date, err := time.Parse("2006-01-02", rawDate)
		if err != nil {
			return 0, fmt.Errorf("studyplan: parse completed date: %w", err)
		}
		if streak == 0 && date.Equal(expected.AddDate(0, 0, -1)) {
			expected = expected.AddDate(0, 0, -1)
		}
		if !date.Equal(expected) {
			break
		}
		streak++
		expected = expected.AddDate(0, 0, -1)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("studyplan: iterate completed dates: %w", err)
	}
	return streak, nil
}
