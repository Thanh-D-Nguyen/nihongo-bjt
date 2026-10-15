// Package gamification provides access to streaks, achievements, leaderboards,
// focus sessions, companion pet, and seasonal events.
package gamification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested entity does not exist.
var ErrNotFound = errors.New("gamification: not found")

// ── Streaks ────────────────────────────────────────────────────────────────

// StreakData represents all streak information for a user.
type StreakData struct {
	Streaks []StreakInfo `json:"streaks"`
}

// StreakInfo is one streak config + user state.
type StreakInfo struct {
	ConfigID       string    `json:"configId"`
	Name           string    `json:"name"`
	ActivityType   string    `json:"activityType"`
	CurrentStreak  int       `json:"currentStreak"`
	LongestStreak  int       `json:"longestStreak"`
	LastActiveDate *string   `json:"lastActiveDate,omitempty"`
	FreezesUsed    int       `json:"freezesUsed"`
	FreezesAllowed int       `json:"freezesAllowed"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// ── Achievements ───────────────────────────────────────────────────────────

// AchievementDefinition is an admin-defined achievement with tiers.
type AchievementDefinition struct {
	ID             string            `json:"id"`
	Slug           string            `json:"slug"`
	NameKey        string            `json:"nameKey"`
	DescriptionKey string            `json:"descriptionKey"`
	Category       string            `json:"category"`
	MetricKey      string            `json:"metricKey"`
	IconURL        *string           `json:"iconUrl,omitempty"`
	DisplayOrder   int               `json:"displayOrder"`
	Tiers          []AchievementTier `json:"tiers"`
}

// AchievementTier is one threshold level within an achievement.
type AchievementTier struct {
	ID          string  `json:"id"`
	Tier        string  `json:"tier"`
	Threshold   int     `json:"threshold"`
	RewardType  *string `json:"rewardType,omitempty"`
	RewardValue *string `json:"rewardValue,omitempty"`
	IconURL     *string `json:"iconUrl,omitempty"`
	NameKey     *string `json:"nameKey,omitempty"`
}

// UserAchievementProgress is a user's progress toward an achievement tier.
type UserAchievementProgress struct {
	ID              string     `json:"id,omitempty"`
	AchievementID   string     `json:"achievementId"`
	TierID          string     `json:"tierId"`
	Tier            string     `json:"tier"`
	CurrentProgress int        `json:"currentProgress"`
	Threshold       int        `json:"threshold"`
	EarnedAt        *time.Time `json:"earnedAt,omitempty"`
}

// PendingAchievement is a newly earned achievement not yet acknowledged.
type PendingAchievement struct {
	ID       string    `json:"id"`
	EarnedAt time.Time `json:"earnedAt"`
	Tier     struct {
		Tier        string  `json:"tier"`
		Threshold   int     `json:"threshold"`
		NameKey     *string `json:"nameKey"`
		Achievement struct {
			Slug           string `json:"slug"`
			NameKey        string `json:"nameKey"`
			DescriptionKey string `json:"descriptionKey"`
			Category       string `json:"category"`
		} `json:"achievement"`
	} `json:"tier"`
}

// BrowseAchievement is an achievement definition overlaid with user progress.
type BrowseAchievement struct {
	ID             string                  `json:"id"`
	Slug           string                  `json:"slug"`
	NameKey        string                  `json:"nameKey"`
	DescriptionKey string                  `json:"descriptionKey"`
	Category       string                  `json:"category"`
	MetricKey      string                  `json:"metricKey"`
	IconURL        *string                 `json:"iconUrl,omitempty"`
	DisplayOrder   int                     `json:"displayOrder"`
	Tiers          []BrowseAchievementTier `json:"tiers"`
}

type BrowseAchievementTier struct {
	AchievementTier
	UserProgress *AchievementTierProgress `json:"userProgress"`
}

type AchievementTierProgress struct {
	ID              string     `json:"id"`
	CurrentProgress int        `json:"currentProgress"`
	EarnedAt        *time.Time `json:"earnedAt"`
}

// ── Leaderboards ───────────────────────────────────────────────────────────

// LeaderboardConfig is a leaderboard definition.
type LeaderboardConfig struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	NameKey    *string `json:"nameKey,omitempty"`
	MetricType string  `json:"metricType"`
	Period     string  `json:"period"`
	MaxEntries int     `json:"maxEntries"`
}

// LeaderboardEntry is one ranked entry in a leaderboard.
type LeaderboardEntry struct {
	ID     string          `json:"id"`
	Rank   int             `json:"rank"`
	UserID string          `json:"userId"`
	Score  int             `json:"score"`
	User   LeaderboardUser `json:"user"`
}

type LeaderboardUser struct {
	DisplayName string  `json:"displayName"`
	AvatarURL   *string `json:"avatarUrl"`
}

type LeaderboardData struct {
	Leaderboard LeaderboardConfig  `json:"leaderboard"`
	Entries     []LeaderboardEntry `json:"entries"`
}

// UserRank is the current user's rank on a leaderboard.
type UserRank struct {
	Rank       *int `json:"rank"`
	Score      int  `json:"score"`
	TotalUsers int  `json:"totalUsers"`
}

// ── Focus / Study Timer ────────────────────────────────────────────────────

// FocusSession is the result of starting a focus session.
type FocusSession struct {
	SessionID       string    `json:"id"`
	DurationMinutes int       `json:"durationMinutes"`
	Mode            string    `json:"mode"`
	StartedAt       time.Time `json:"startedAt"`
}

// FocusTodaySummary is the daily focus summary.
type FocusTodaySummary struct {
	TodayMinutes  int           `json:"todayMinutes"`
	TodaySessions int           `json:"todaySessions"`
	GoalMinutes   int           `json:"goalMinutes"`
	ActiveSession *FocusSession `json:"activeSession"`
}

// ── Companion Pet ──────────────────────────────────────────────────────────

// Pet is the user's companion pet state.
type Pet struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Stage         string     `json:"stage"`
	XP            int        `json:"xp"`
	Happiness     int        `json:"happiness"`
	Mood          string     `json:"mood"`
	TotalFeedings int        `json:"totalFeedings"`
	CostumeSlug   *string    `json:"costumeSlug"`
	LastFedAt     *time.Time `json:"lastFedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	NextStage     *string    `json:"nextStage"`
	NextThreshold *int       `json:"nextThreshold"`
	StageProgress int        `json:"stageProgress"`
}

// PetCostume is one available costume.
type PetCostume struct {
	Slug    string  `json:"slug"`
	NameKey string  `json:"nameKey"`
	IconURL *string `json:"iconUrl,omitempty"`
	Owned   bool    `json:"owned"`
}

// ── Seasonal Events ────────────────────────────────────────────────────────

// SeasonalEvent is an active seasonal event.
type SeasonalEvent struct {
	ID               string    `json:"id"`
	Slug             string    `json:"slug"`
	NameVi           string    `json:"nameVi"`
	IconEmoji        string    `json:"iconEmoji"`
	BannerColor      string    `json:"bannerColor"`
	Description      *string   `json:"description,omitempty"`
	EndDate          time.Time `json:"endDate"`
	Joined           bool      `json:"joined"`
	DaysRemaining    int       `json:"daysRemaining"`
	ParticipantCount int       `json:"participantCount"`
}

// EventDetail includes full event info with rewards.
type EventDetail struct {
	SeasonalEvent
	Challenges []EventChallenge `json:"challenges"`
}

type EventChallenge struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	TargetValue  int    `json:"targetValue"`
	CurrentValue int    `json:"currentValue"`
	Completed    bool   `json:"completed"`
	RewardXP     int    `json:"rewardXp"`
}

// Store provides read/write access to gamification tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a gamification store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ── Streaks ────────────────────────────────────────────────────────────────

// GetStreaks returns all streak data for a user.
func (s *Store) GetStreaks(ctx context.Context, userID string) (*StreakData, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT sc.id, sc.name, sc.activity_type, sc.freezes_allowed,
		COALESCE(us.current_streak, 0), COALESCE(us.longest_streak, 0),
		us.last_activity_date, COALESCE(us.freezes_used, 0), us.updated_at
	FROM gamification.streak_config sc
	LEFT JOIN gamification.user_streak us ON us.streak_config_id = sc.id AND us.user_id = $1
	WHERE sc.enabled = true
	ORDER BY sc.created_at ASC`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification: get streaks: %w", err)
	}
	defer rows.Close()

	var streaks []StreakInfo
	for rows.Next() {
		var si StreakInfo
		var lastActive *time.Time
		var updatedAt *time.Time
		if err := rows.Scan(&si.ConfigID, &si.Name, &si.ActivityType, &si.FreezesAllowed,
			&si.CurrentStreak, &si.LongestStreak, &lastActive, &si.FreezesUsed, &updatedAt); err != nil {
			return nil, fmt.Errorf("gamification: scan streak: %w", err)
		}
		if lastActive != nil {
			s := lastActive.Format("2006-01-02")
			si.LastActiveDate = &s
		}
		if updatedAt != nil {
			si.UpdatedAt = *updatedAt
		}
		streaks = append(streaks, si)
	}
	if streaks == nil {
		streaks = []StreakInfo{}
	}
	return &StreakData{Streaks: streaks}, nil
}

// RecordActivity records an activity for streak tracking.
func (s *Store) RecordActivity(ctx context.Context, userID, activityType string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	today := time.Now().Format("2006-01-02")

	const q = `INSERT INTO gamification.user_streak (streak_config_id, user_id, current_streak, longest_streak, last_activity_date, updated_at)
	SELECT sc.id, $1, 1, 1, $2::date, NOW()
	FROM gamification.streak_config sc
	WHERE sc.enabled = true AND (sc.activity_type = $3 OR sc.activity_type = 'any')
	ON CONFLICT (streak_config_id, user_id) DO UPDATE SET
		current_streak = CASE
			WHEN user_streak.last_activity_date = $2::date THEN user_streak.current_streak
			WHEN user_streak.last_activity_date = ($2::date - INTERVAL '1 day') THEN user_streak.current_streak + 1
			ELSE 1
		END,
		longest_streak = GREATEST(user_streak.longest_streak,
			CASE
				WHEN user_streak.last_activity_date = $2::date THEN user_streak.current_streak
				WHEN user_streak.last_activity_date = ($2::date - INTERVAL '1 day') THEN user_streak.current_streak + 1
				ELSE 1
			END),
		last_activity_date = $2::date,
		updated_at = NOW()`

	if _, err := s.db.Exec(ctx, q, userID, today, activityType); err != nil {
		return fmt.Errorf("gamification: record activity: %w", err)
	}
	return nil
}

// ── Achievements ───────────────────────────────────────────────────────────

// GetAllAchievementDefinitions returns all enabled achievement definitions with tiers.
func (s *Store) GetAllAchievementDefinitions(ctx context.Context) ([]AchievementDefinition, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, slug, name_key, description_key, category, metric_key, icon_url, display_order
	FROM gamification.achievement_definition WHERE enabled = true ORDER BY display_order ASC, created_at ASC`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("gamification: list achievements: %w", err)
	}
	defer rows.Close()

	var defs []AchievementDefinition
	for rows.Next() {
		var d AchievementDefinition
		if err := rows.Scan(&d.ID, &d.Slug, &d.NameKey, &d.DescriptionKey, &d.Category, &d.MetricKey, &d.IconURL, &d.DisplayOrder); err != nil {
			return nil, fmt.Errorf("gamification: scan achievement: %w", err)
		}
		defs = append(defs, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate achievements: %w", err)
	}

	// Load tiers for each definition
	for i := range defs {
		const tierQ = `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
		FROM gamification.achievement_tier WHERE achievement_id = $1 ORDER BY threshold ASC`
		tRows, err := s.db.Query(ctx, tierQ, defs[i].ID)
		if err != nil {
			return nil, fmt.Errorf("gamification: list achievement tiers: %w", err)
		}
		for tRows.Next() {
			var t AchievementTier
			if err := tRows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey); err != nil {
				tRows.Close()
				return nil, fmt.Errorf("gamification: scan achievement tier: %w", err)
			}
			defs[i].Tiers = append(defs[i].Tiers, t)
		}
		if err := tRows.Err(); err != nil {
			tRows.Close()
			return nil, fmt.Errorf("gamification: iterate achievement tiers: %w", err)
		}
		tRows.Close()
		if defs[i].Tiers == nil {
			defs[i].Tiers = []AchievementTier{}
		}
	}

	if defs == nil {
		defs = []AchievementDefinition{}
	}
	return defs, nil
}

// BrowseAllAchievements returns all achievements with user progress overlay.
func (s *Store) BrowseAllAchievements(ctx context.Context, userID string) ([]BrowseAchievement, error) {
	defs, err := s.GetAllAchievementDefinitions(ctx)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var result []BrowseAchievement
	for _, d := range defs {
		ba := BrowseAchievement{ID: d.ID, Slug: d.Slug, NameKey: d.NameKey, DescriptionKey: d.DescriptionKey,
			Category: d.Category, MetricKey: d.MetricKey, IconURL: d.IconURL, DisplayOrder: d.DisplayOrder}
		progressByTier := make(map[string]AchievementTierProgress, len(d.Tiers))
		const progressQ = `SELECT ua.id, ua.tier_id, ua.current_progress, ua.earned_at
		FROM gamification.user_achievement ua
		JOIN gamification.achievement_tier at ON at.id = ua.tier_id
		WHERE ua.user_id = $1 AND ua.achievement_id = $2
		ORDER BY at.threshold ASC`
		pRows, err := s.db.Query(ctx, progressQ, userID, d.ID)
		if err != nil {
			return nil, fmt.Errorf("gamification: browse achievement progress: %w", err)
		}
		for pRows.Next() {
			var p AchievementTierProgress
			var tierID string
			if err := pRows.Scan(&p.ID, &tierID, &p.CurrentProgress, &p.EarnedAt); err != nil {
				pRows.Close()
				return nil, fmt.Errorf("gamification: scan achievement progress: %w", err)
			}
			progressByTier[tierID] = p
		}
		if err := pRows.Err(); err != nil {
			pRows.Close()
			return nil, fmt.Errorf("gamification: iterate achievement progress: %w", err)
		}
		pRows.Close()
		for _, tier := range d.Tiers {
			browseTier := BrowseAchievementTier{AchievementTier: tier}
			if progress, ok := progressByTier[tier.ID]; ok {
				browseTier.UserProgress = &progress
			}
			ba.Tiers = append(ba.Tiers, browseTier)
		}
		result = append(result, ba)
	}
	if result == nil {
		result = []BrowseAchievement{}
	}
	return result, nil
}

// GetUserAchievements returns the user's earned achievement progress.
func (s *Store) GetUserAchievements(ctx context.Context, userID string) ([]UserAchievementProgress, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT ua.id, ua.achievement_id, ua.tier_id, at.tier, ua.current_progress, at.threshold, ua.earned_at
	FROM gamification.user_achievement ua
	JOIN gamification.achievement_tier at ON at.id = ua.tier_id
	WHERE ua.user_id = $1
	ORDER BY ua.earned_at DESC NULLS LAST, ua.updated_at DESC`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification: get user achievements: %w", err)
	}
	defer rows.Close()

	var progress []UserAchievementProgress
	for rows.Next() {
		var p UserAchievementProgress
		if err := rows.Scan(&p.ID, &p.AchievementID, &p.TierID, &p.Tier, &p.CurrentProgress, &p.Threshold, &p.EarnedAt); err != nil {
			return nil, fmt.Errorf("gamification: scan user achievement: %w", err)
		}
		progress = append(progress, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate user achievements: %w", err)
	}
	if progress == nil {
		progress = []UserAchievementProgress{}
	}
	return progress, nil
}

// GetPendingAchievements returns newly earned achievements not yet acknowledged.
func (s *Store) GetPendingAchievements(ctx context.Context, userID string) ([]PendingAchievement, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT ua.id, ua.earned_at, at.tier, at.threshold, at.name_key,
		ad.slug, ad.name_key, ad.description_key, ad.category
	FROM gamification.user_achievement ua
	JOIN gamification.achievement_tier at ON at.id = ua.tier_id
	JOIN gamification.achievement_definition ad ON ad.id = ua.achievement_id
	WHERE ua.user_id = $1 AND ua.earned_at IS NOT NULL AND ua.notified_at IS NULL
	ORDER BY ua.earned_at DESC`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification: get pending achievements: %w", err)
	}
	defer rows.Close()

	var pending []PendingAchievement
	for rows.Next() {
		var p PendingAchievement
		if err := rows.Scan(&p.ID, &p.EarnedAt, &p.Tier.Tier, &p.Tier.Threshold, &p.Tier.NameKey,
			&p.Tier.Achievement.Slug, &p.Tier.Achievement.NameKey, &p.Tier.Achievement.DescriptionKey, &p.Tier.Achievement.Category); err != nil {
			return nil, fmt.Errorf("gamification: scan pending achievement: %w", err)
		}
		pending = append(pending, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate pending achievements: %w", err)
	}
	if pending == nil {
		pending = []PendingAchievement{}
	}
	return pending, nil
}

// AcknowledgeAchievements marks achievements as shown to the user.
func (s *Store) AcknowledgeAchievements(ctx context.Context, userID string, ids []string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if len(ids) == 0 {
		return nil
	}

	const q = `UPDATE gamification.user_achievement SET notified_at = NOW()
	WHERE user_id = $1 AND id = ANY($2) AND earned_at IS NOT NULL`

	if _, err := s.db.Exec(ctx, q, userID, ids); err != nil {
		return fmt.Errorf("gamification: acknowledge achievements: %w", err)
	}
	return nil
}

// ── Leaderboards ───────────────────────────────────────────────────────────

// GetEnabledLeaderboards returns all enabled leaderboard configs.
func (s *Store) GetEnabledLeaderboards(ctx context.Context) ([]LeaderboardConfig, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, name, name_key, metric_type, period, max_entries
	FROM gamification.leaderboard_config WHERE enabled = true ORDER BY created_at ASC`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("gamification: list leaderboards: %w", err)
	}
	defer rows.Close()

	var boards []LeaderboardConfig
	for rows.Next() {
		var b LeaderboardConfig
		if err := rows.Scan(&b.ID, &b.Name, &b.NameKey, &b.MetricType, &b.Period, &b.MaxEntries); err != nil {
			return nil, fmt.Errorf("gamification: scan leaderboard: %w", err)
		}
		boards = append(boards, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate leaderboards: %w", err)
	}
	if boards == nil {
		boards = []LeaderboardConfig{}
	}
	return boards, nil
}

// GetLeaderboard returns ranked entries for a specific leaderboard.
func (s *Store) GetLeaderboard(ctx context.Context, leaderboardID string) (*LeaderboardData, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var data LeaderboardData
	const configQ = `SELECT id,name,name_key,metric_type,period,max_entries
	FROM gamification.leaderboard_config WHERE id=$1 AND enabled=true`
	if err := s.db.QueryRow(ctx, configQ, leaderboardID).Scan(&data.Leaderboard.ID, &data.Leaderboard.Name,
		&data.Leaderboard.NameKey, &data.Leaderboard.MetricType, &data.Leaderboard.Period, &data.Leaderboard.MaxEntries); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: get leaderboard config: %w", err)
	}
	limit := data.Leaderboard.MaxEntries
	if limit < 1 || limit > 100 {
		limit = 100
	}
	const q = `SELECT le.id,le.rank,le.user_id,le.score,COALESCE(up.display_name,'Anonymous'),ma.source_url
	FROM gamification.leaderboard_entry le
	LEFT JOIN profile.user_profile up ON up.id = le.user_id
	LEFT JOIN media.asset ma ON ma.id=up.avatar_asset_id AND ma.status='active'
	WHERE le.leaderboard_id = $1
	ORDER BY le.rank ASC
	LIMIT $2`

	rows, err := s.db.Query(ctx, q, leaderboardID, limit)
	if err != nil {
		return nil, fmt.Errorf("gamification: get leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.ID, &e.Rank, &e.UserID, &e.Score, &e.User.DisplayName, &e.User.AvatarURL); err != nil {
			return nil, fmt.Errorf("gamification: scan leaderboard entry: %w", err)
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate leaderboard entries: %w", err)
	}
	if entries == nil {
		entries = []LeaderboardEntry{}
	}
	data.Entries = entries
	return &data, nil
}

// GetUserRank returns the current user's rank on a specific leaderboard.
func (s *Store) GetUserRank(ctx context.Context, leaderboardID, userID string) (*UserRank, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var enabled bool
	if err := s.db.QueryRow(ctx, `SELECT enabled FROM gamification.leaderboard_config WHERE id=$1`, leaderboardID).Scan(&enabled); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: check leaderboard: %w", err)
	}
	if !enabled {
		return nil, ErrNotFound
	}
	const q = `SELECT rank, score FROM gamification.leaderboard_entry
	WHERE leaderboard_id = $1 AND user_id = $2 LIMIT 1`

	var rank UserRank
	var r *int
	if err := s.db.QueryRow(ctx, q, leaderboardID, userID).Scan(&r, &rank.Score); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			rank.Rank = nil
			rank.Score = 0
		} else {
			return nil, fmt.Errorf("gamification: get user rank: %w", err)
		}
	} else {
		rank.Rank = r
	}

	const countQ = `SELECT COUNT(*) FROM gamification.leaderboard_entry WHERE leaderboard_id = $1`
	if err := s.db.QueryRow(ctx, countQ, leaderboardID).Scan(&rank.TotalUsers); err != nil {
		return nil, fmt.Errorf("gamification: count leaderboard entries: %w", err)
	}

	return &rank, nil
}

// ── Focus / Study Timer ────────────────────────────────────────────────────

// StartFocusSession creates a new focus study session.
func (s *Store) StartFocusSession(ctx context.Context, userID string, durationMinutes int, mode string) (*FocusSession, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if durationMinutes <= 0 || durationMinutes > 120 {
		durationMinutes = 15
	}
	if mode == "" {
		mode = "focus"
	}

	const q = `INSERT INTO learning.study_session (user_id, duration_minutes, mode, started_at, completed)
	VALUES ($1, $2, $3, NOW(), false) RETURNING id, started_at`

	var fs FocusSession
	fs.DurationMinutes = durationMinutes
	fs.Mode = mode
	if err := s.db.QueryRow(ctx, q, userID, durationMinutes, mode).Scan(&fs.SessionID, &fs.StartedAt); err != nil {
		return nil, fmt.Errorf("gamification: start focus: %w", err)
	}
	return &fs, nil
}

// EndFocusSession marks a focus session as completed.
func (s *Store) EndFocusSession(ctx context.Context, userID, sessionID string, completed bool) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE learning.study_session SET completed = $3, ended_at = NOW()
	WHERE id = $1 AND user_id = $2 AND mode = 'focus' AND ended_at IS NULL`

	result, err := s.db.Exec(ctx, q, sessionID, userID, completed)
	if err != nil {
		return fmt.Errorf("gamification: end focus: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetFocusToday returns today's focus session summary.
func (s *Store) GetFocusToday(ctx context.Context, userID string) (*FocusTodaySummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT COALESCE(SUM(duration_minutes), 0), COUNT(*)
	FROM learning.study_session
	WHERE user_id = $1 AND started_at >= CURRENT_DATE AND started_at < (CURRENT_DATE + INTERVAL '1 day')
	AND mode = 'focus' AND completed = true`

	var summary FocusTodaySummary
	if err := s.db.QueryRow(ctx, q, userID).Scan(&summary.TodayMinutes, &summary.TodaySessions); err != nil {
		return nil, fmt.Errorf("gamification: get focus summary: %w", err)
	}

	const activeQ = `SELECT id, duration_minutes, mode, started_at
	FROM learning.study_session
	WHERE user_id = $1 AND mode = 'focus' AND completed = false AND ended_at IS NULL
	ORDER BY started_at DESC
	LIMIT 1`
	var active FocusSession
	if err := s.db.QueryRow(ctx, activeQ, userID).Scan(&active.SessionID, &active.DurationMinutes, &active.Mode, &active.StartedAt); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("gamification: get active focus session: %w", err)
		}
	} else {
		summary.ActiveSession = &active
	}

	// Get goal from daily_study_goal
	const goalQ = `SELECT target_minutes FROM gamification.daily_study_goal WHERE user_id = $1 LIMIT 1`
	if err := s.db.QueryRow(ctx, goalQ, userID).Scan(&summary.GoalMinutes); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			summary.GoalMinutes = 15
		} else {
			return nil, fmt.Errorf("gamification: get focus goal: %w", err)
		}
	}

	return &summary, nil
}

// ── Companion Pet ──────────────────────────────────────────────────────────

// GetPet returns the user's companion pet.
func (s *Store) GetPet(ctx context.Context, userID string) (*Pet, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id,name,stage,xp,happiness,mood,total_feedings,costume_slug,last_fed_at,created_at
	FROM gamification.companion_pet WHERE user_id = $1 LIMIT 1`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID).Scan(&p.ID, &p.Name, &p.Stage, &p.XP,
		&p.Happiness, &p.Mood, &p.TotalFeedings, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if _, err := s.createDefaultPet(ctx, userID); err != nil {
				return nil, err
			}
			return s.GetPet(ctx, userID)
		}
		return nil, fmt.Errorf("gamification: get pet: %w", err)
	}
	setPetEvolution(&p)
	return &p, nil
}

func (s *Store) createDefaultPet(ctx context.Context, userID string) (*Pet, error) {
	const q = `INSERT INTO gamification.companion_pet (user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at)
	VALUES ($1,'Mochi','egg',0,100,'happy',0,NOW(),NOW())
	ON CONFLICT (user_id) DO NOTHING RETURNING id,name,stage,xp,happiness,mood,total_feedings,costume_slug,last_fed_at,created_at`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID).Scan(&p.ID, &p.Name, &p.Stage, &p.XP,
		&p.Happiness, &p.Mood, &p.TotalFeedings, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("gamification: create default pet: %w", err)
	}
	setPetEvolution(&p)
	return &p, nil
}

// FeedPet increases pet happiness and XP.
func (s *Store) FeedPet(ctx context.Context, userID string) (*Pet, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE gamification.companion_pet SET
		happiness = LEAST(happiness + 10, 100),
		xp = xp + 5,
		total_feedings = total_feedings + 1,
		stage = CASE WHEN xp + 5 >= 1500 THEN 'master' WHEN xp + 5 >= 500 THEN 'adult' WHEN xp + 5 >= 200 THEN 'teen' WHEN xp + 5 >= 50 THEN 'baby' ELSE 'egg' END,
		mood = CASE WHEN LEAST(happiness + 10, 100) >= 80 THEN 'happy' WHEN LEAST(happiness + 10, 100) >= 50 THEN 'neutral' WHEN LEAST(happiness + 10, 100) >= 20 THEN 'sad' ELSE 'sick' END,
		last_fed_at = NOW(),
		updated_at = NOW()
	WHERE user_id = $1
	RETURNING id,name,stage,xp,happiness,mood,total_feedings,costume_slug,last_fed_at,created_at`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID).Scan(&p.ID, &p.Name, &p.Stage, &p.XP,
		&p.Happiness, &p.Mood, &p.TotalFeedings, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: feed pet: %w", err)
	}
	setPetEvolution(&p)
	return &p, nil
}

// RenamePet updates the pet's name.
func (s *Store) RenamePet(ctx context.Context, userID, newName string) (*Pet, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	newName = strings.TrimSpace(newName)
	if newName == "" || len([]rune(newName)) > 30 {
		return nil, fmt.Errorf("gamification: invalid pet name")
	}
	const q = `UPDATE gamification.companion_pet SET name = $2, updated_at = NOW()
	WHERE user_id = $1
	RETURNING id,name,stage,xp,happiness,mood,total_feedings,costume_slug,last_fed_at,created_at`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID, newName).Scan(&p.ID, &p.Name, &p.Stage, &p.XP,
		&p.Happiness, &p.Mood, &p.TotalFeedings, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: rename pet: %w", err)
	}
	setPetEvolution(&p)
	return &p, nil
}

func setPetEvolution(p *Pet) {
	if p.XP < 0 {
		p.XP = 0
	}
	stages := []struct {
		name      string
		threshold int
	}{{"egg", 0}, {"baby", 50}, {"teen", 200}, {"adult", 500}, {"master", 1500}}
	for i, stage := range stages {
		if p.XP < stage.threshold {
			previous := stages[i-1]
			p.NextStage, p.NextThreshold = &stage.name, &stage.threshold
			p.StageProgress = (p.XP - previous.threshold) * 100 / (stage.threshold - previous.threshold)
			return
		}
	}
	p.StageProgress = 100
}

// GetPetCostumes returns available costumes with ownership status.
func (s *Store) GetPetCostumes(ctx context.Context, userID string) ([]PetCostume, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Return owned costumes from inventory
	const q = `SELECT costume_slug, obtained_from FROM gamification.pet_costume_inventory
	WHERE user_id = $1 ORDER BY obtained_at DESC`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification: list pet costumes: %w", err)
	}
	defer rows.Close()

	owned := make(map[string]bool)
	for rows.Next() {
		var slug, from string
		if err := rows.Scan(&slug, &from); err != nil {
			return nil, fmt.Errorf("gamification: scan pet costume: %w", err)
		}
		owned[slug] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate pet costumes: %w", err)
	}

	// Default costumes (always available)
	costumes := []PetCostume{
		{Slug: "default", NameKey: "pet.costume.default", Owned: true},
		{Slug: "ribbon", NameKey: "pet.costume.ribbon", Owned: owned["ribbon"]},
		{Slug: "glasses", NameKey: "pet.costume.glasses", Owned: owned["glasses"]},
		{Slug: "hat", NameKey: "pet.costume.hat", Owned: owned["hat"]},
	}
	return costumes, nil
}

// ── Seasonal Events ────────────────────────────────────────────────────────

// GetActiveEvents returns currently active seasonal events.
func (s *Store) GetActiveEvents(ctx context.Context, userID string) ([]SeasonalEvent, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	today := tokyoDate()
	const q = `SELECT se.id,se.slug,se.name_vi,se.icon_emoji,se.banner_color,se.description,se.end_date,
		EXISTS(SELECT 1 FROM gamification.event_participant ep WHERE ep.event_id=se.id AND ep.user_id=$1),
		GREATEST(se.end_date-$2::date,0),
		(SELECT COUNT(*) FROM gamification.event_participant ep WHERE ep.event_id=se.id)
	FROM gamification.seasonal_event se
	WHERE se.active=true AND se.start_date <= $2::date AND se.end_date >= $2::date
	ORDER BY se.start_date ASC`

	rows, err := s.db.Query(ctx, q, userID, today)
	if err != nil {
		return nil, fmt.Errorf("gamification: list active events: %w", err)
	}
	defer rows.Close()

	var events []SeasonalEvent
	for rows.Next() {
		var e SeasonalEvent
		if err := rows.Scan(&e.ID, &e.Slug, &e.NameVi, &e.IconEmoji, &e.BannerColor, &e.Description, &e.EndDate, &e.Joined, &e.DaysRemaining, &e.ParticipantCount); err != nil {
			return nil, fmt.Errorf("gamification: scan active event: %w", err)
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate active events: %w", err)
	}
	if events == nil {
		events = []SeasonalEvent{}
	}
	return events, nil
}

// GetEvent returns full event detail including rewards.
func (s *Store) GetEvent(ctx context.Context, userID, eventID string) (*EventDetail, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	today := tokyoDate()
	const q = `SELECT se.id,se.slug,se.name_vi,se.icon_emoji,se.banner_color,se.description,se.end_date,
		EXISTS(SELECT 1 FROM gamification.event_participant ep WHERE ep.event_id=se.id AND ep.user_id=$1),
		GREATEST(se.end_date-$3::date,0),
		(SELECT COUNT(*) FROM gamification.event_participant ep WHERE ep.event_id=se.id)
	FROM gamification.seasonal_event se
	WHERE se.id=$2 AND se.active=true AND se.start_date <= $3::date AND se.end_date >= $3::date`

	var ed EventDetail
	if err := s.db.QueryRow(ctx, q, userID, eventID, today).Scan(&ed.ID, &ed.Slug, &ed.NameVi, &ed.IconEmoji, &ed.BannerColor,
		&ed.Description, &ed.EndDate, &ed.Joined, &ed.DaysRemaining, &ed.ParticipantCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: get event: %w", err)
	}

	const challengeQ = `SELECT ec.id,ec.title,ec.target_value,COALESCE(ep.current_value,0),COALESCE(ep.completed,false),ec.reward_xp
	FROM gamification.event_challenge ec
	LEFT JOIN gamification.event_challenge_progress ep ON ep.challenge_id=ec.id AND ep.user_id=$1
	WHERE ec.event_id=$2 ORDER BY ec.sort_order,ec.id`
	rRows, err := s.db.Query(ctx, challengeQ, userID, eventID)
	if err != nil {
		return nil, fmt.Errorf("gamification: list event challenges: %w", err)
	}
	defer rRows.Close()
	for rRows.Next() {
		var challenge EventChallenge
		if err := rRows.Scan(&challenge.ID, &challenge.Title, &challenge.TargetValue, &challenge.CurrentValue, &challenge.Completed, &challenge.RewardXP); err != nil {
			return nil, fmt.Errorf("gamification: scan event challenge: %w", err)
		}
		ed.Challenges = append(ed.Challenges, challenge)
	}
	if err := rRows.Err(); err != nil {
		return nil, fmt.Errorf("gamification: iterate event challenges: %w", err)
	}
	if ed.Challenges == nil {
		ed.Challenges = []EventChallenge{}
	}

	return &ed, nil
}

// JoinEvent records user participation in a seasonal event.
func (s *Store) JoinEvent(ctx context.Context, userID, eventID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	today := tokyoDate()
	const q = `INSERT INTO gamification.event_participant(event_id,user_id,joined_at)
	SELECT $1,$2,NOW() WHERE EXISTS (
		SELECT 1 FROM gamification.seasonal_event WHERE id=$1 AND active=true AND start_date <= $3::date AND end_date >= $3::date
	) ON CONFLICT (event_id,user_id) DO NOTHING`

	tag, err := s.db.Exec(ctx, q, eventID, userID, today)
	if err != nil {
		return fmt.Errorf("gamification: join event: %w", err)
	}
	if tag.RowsAffected() == 0 {
		var active bool
		if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM gamification.seasonal_event WHERE id=$1 AND active=true AND start_date <= $2::date AND end_date >= $2::date)`, eventID, today).Scan(&active); err != nil {
			return fmt.Errorf("gamification: check event before join: %w", err)
		}
		if !active {
			return ErrNotFound
		}
	}
	return nil
}

func tokyoDate() string {
	location, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		return time.Now().UTC().Format("2006-01-02")
	}
	return time.Now().In(location).Format("2006-01-02")
}

// Ensure json import is used.
var _ = json.RawMessage{}
