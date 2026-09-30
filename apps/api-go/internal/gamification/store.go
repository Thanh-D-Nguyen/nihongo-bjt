// Package gamification provides access to learner streak and leaderboard data.
package gamification

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested gamification entity does not exist.
var ErrNotFound = errors.New("gamification: not found")

// StreakData represents aggregated streak information for a user.
type StreakData struct {
	CurrentStreak int       `json:"currentStreak"`
	LongestStreak int       `json:"longestStreak"`
	LastActiveAt  *time.Time `json:"lastActiveAt,omitempty"`
	ConfigName    string    `json:"configName"`
	ActivityType  string    `json:"activityType"`
}

// LeaderboardConfig represents an enabled leaderboard definition.
type LeaderboardConfig struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	NameKey    *string `json:"nameKey,omitempty"`
	MetricType string `json:"metricType"`
	Period     string `json:"period"`
	MaxEntries int    `json:"maxEntries"`
}

// LeaderboardEntry represents a single ranked entry in a leaderboard.
type LeaderboardEntry struct {
	Rank      int    `json:"rank"`
	UserID    string `json:"userId"`
	DisplayName string `json:"displayName"`
	Score     int    `json:"score"`
}

// MyRankResponse contains the current user's rank in a specific leaderboard.
type MyRankResponse struct {
	Rank      *int   `json:"rank,omitempty"`
	Score     int    `json:"score"`
	TotalEntries int `json:"totalEntries"`
	LeaderboardID string `json:"leaderboardId"`
}

// Store provides read/write access to gamification schema tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a gamification store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetUserStreaks returns all active streak configurations with user progress.
func (s *Store) GetUserStreaks(ctx context.Context, userID string) ([]StreakData, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT
		sc.name, sc.activity_type,
		COALESCE(us.current_streak, 0), COALESCE(us.longest_streak, 0), us.last_active_at
	FROM gamification.streak_config sc
	LEFT JOIN gamification.user_streak us ON us.config_id = sc.id AND us.user_id = $1
	WHERE sc.enabled = true
	ORDER BY sc.created_at`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification: get user streaks: %w", err)
	}
	defer rows.Close()

	var streaks []StreakData
	for rows.Next() {
		var sd StreakData
		if err := rows.Scan(&sd.ConfigName, &sd.ActivityType, &sd.CurrentStreak, &sd.LongestStreak, &sd.LastActiveAt); err != nil {
			return nil, fmt.Errorf("gamification: scan streak: %w", err)
		}
		streaks = append(streaks, sd)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate streaks: %w", err)
	}
	if streaks == nil {
		streaks = []StreakData{}
	}
	return streaks, nil
}

// RecordActivity updates streak state for a user based on activity type.
// This is a simplified implementation; full streak logic requires date-based continuity checks.
func (s *Store) RecordActivity(ctx context.Context, userID, activityType string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Find matching enabled streak configs
	const findConfigs = `SELECT id FROM gamification.streak_config
		WHERE enabled = true AND (activity_type = $1 OR activity_type = 'any')`

	rows, err := s.db.Query(ctx, findConfigs, activityType)
	if err != nil {
		return fmt.Errorf("gamification: find streak configs: %w", err)
	}
	defer rows.Close()

	var configIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("gamification: scan config id: %w", err)
		}
		configIDs = append(configIDs, id)
	}

	now := time.Now()
	for _, cfgID := range configIDs {
		// Upsert user streak record
		const upsert = `INSERT INTO gamification.user_streak (user_id, config_id, current_streak, longest_streak, last_active_at)
			VALUES ($1, $2, 1, 1, $3)
			ON CONFLICT (user_id, config_id) DO UPDATE SET
				last_active_at = $3,
				current_streak = CASE
					WHEN gamification.user_streak.last_active_at >= CURRENT_DATE - INTERVAL '1 day'
					THEN gamification.user_streak.current_streak + 1
					ELSE 1
				END,
				longest_streak = GREATEST(
					gamification.user_streak.longest_streak,
					CASE
						WHEN gamification.user_streak.last_active_at >= CURRENT_DATE - INTERVAL '1 day'
						THEN gamification.user_streak.current_streak + 1
						ELSE 1
					END
				)`
		if _, err := s.db.Exec(ctx, upsert, userID, cfgID, now); err != nil {
			return fmt.Errorf("gamification: upsert user streak: %w", err)
		}
	}
	return nil
}

// GetEnabledLeaderboards returns all active leaderboard configurations.
func (s *Store) GetEnabledLeaderboards(ctx context.Context) ([]LeaderboardConfig, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, name, name_key, metric_type, period, max_entries
		FROM gamification.leaderboard_config WHERE enabled = true ORDER BY created_at`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("gamification: list leaderboards: %w", err)
	}
	defer rows.Close()

	var boards []LeaderboardConfig
	for rows.Next() {
		var lb LeaderboardConfig
		if err := rows.Scan(&lb.ID, &lb.Name, &lb.NameKey, &lb.MetricType, &lb.Period, &lb.MaxEntries); err != nil {
			return nil, fmt.Errorf("gamification: scan leaderboard: %w", err)
		}
		boards = append(boards, lb)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate leaderboards: %w", err)
	}
	if boards == nil {
		boards = []LeaderboardConfig{}
	}
	return boards, nil
}

// GetLeaderboardEntries returns ranked entries for a specific leaderboard and current period.
func (s *Store) GetLeaderboardEntries(ctx context.Context, leaderboardID string) ([]LeaderboardEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT le.rank, le.user_id, COALESCE(up.display_name, 'Anonymous'), le.score
		FROM gamification.leaderboard_entry le
		LEFT JOIN profile.user_profile up ON up.id = le.user_id
		WHERE le.leaderboard_id = $1
		  AND le.period_start <= CURRENT_DATE AND le.period_end >= CURRENT_DATE
		ORDER BY le.rank ASC
		LIMIT 100`

	rows, err := s.db.Query(ctx, q, leaderboardID)
	if err != nil {
		return nil, fmt.Errorf("gamification: get leaderboard entries: %w", err)
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.Rank, &e.UserID, &e.DisplayName, &e.Score); err != nil {
			return nil, fmt.Errorf("gamification: scan entry: %w", err)
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate entries: %w", err)
	}
	if entries == nil {
		entries = []LeaderboardEntry{}
	}
	return entries, nil
}

// GetMyRank returns the current user's rank and score in a specific leaderboard.
func (s *Store) GetMyRank(ctx context.Context, leaderboardID, userID string) (*MyRankResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT le.rank, le.score,
		(SELECT COUNT(*) FROM gamification.leaderboard_entry le2
		 WHERE le2.leaderboard_id = $1 AND le2.period_start <= CURRENT_DATE AND le2.period_end >= CURRENT_DATE) as total
		FROM gamification.leaderboard_entry le
		WHERE le.leaderboard_id = $1 AND le.user_id = $2
		  AND le.period_start <= CURRENT_DATE AND le.period_end >= CURRENT_DATE`

	var resp MyRankResponse
	resp.LeaderboardID = leaderboardID
	err := s.db.QueryRow(ctx, q, leaderboardID, userID).Scan(&resp.Rank, &resp.Score, &resp.TotalEntries)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// User not ranked yet — return zero score with nil rank
			resp.Rank = nil
			resp.Score = 0
			// Still need total entries count
			const countQ = `SELECT COUNT(*) FROM gamification.leaderboard_entry
				WHERE leaderboard_id = $1 AND period_start <= CURRENT_DATE AND period_end >= CURRENT_DATE`
			if cerr := s.db.QueryRow(ctx, countQ, leaderboardID).Scan(&resp.TotalEntries); cerr != nil {
				return nil, fmt.Errorf("gamification: count entries: %w", cerr)
			}
			return &resp, nil
		}
		return nil, fmt.Errorf("gamification: get my rank: %w", err)
	}
	return &resp, nil
}