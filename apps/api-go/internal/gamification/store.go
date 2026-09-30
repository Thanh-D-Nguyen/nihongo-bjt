// Package gamification provides access to streaks, achievements, leaderboards,
// focus sessions, companion pet, and seasonal events.
package gamification

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
	AchievementID   string     `json:"achievementId"`
	TierID          string     `json:"tierId"`
	Tier            string     `json:"tier"`
	CurrentProgress int        `json:"currentProgress"`
	Threshold       int        `json:"threshold"`
	EarnedAt        *time.Time `json:"earnedAt,omitempty"`
}

// PendingAchievement is a newly earned achievement not yet acknowledged.
type PendingAchievement struct {
	UserAchievementID string    `json:"userAchievementId"`
	AchievementSlug   string    `json:"achievementSlug"`
	Tier              string    `json:"tier"`
	NameKey           string    `json:"nameKey"`
	IconURL           *string   `json:"iconUrl,omitempty"`
	EarnedAt          time.Time `json:"earnedAt"`
}

// BrowseAchievement is an achievement definition overlaid with user progress.
type BrowseAchievement struct {
	AchievementDefinition
	UserProgress []UserAchievementProgress `json:"userProgress"`
}

// ── Leaderboards ───────────────────────────────────────────────────────────

// LeaderboardConfig is a leaderboard definition.
type LeaderboardConfig struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	NameKey    *string `json:"nameKey,omitempty"`
	MetricType string `json:"metricType"`
	Period     string `json:"period"`
	MaxEntries int    `json:"maxEntries"`
}

// LeaderboardEntry is one ranked entry in a leaderboard.
type LeaderboardEntry struct {
	Rank      int    `json:"rank"`
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Score     int    `json:"score"`
}

// UserRank is the current user's rank on a leaderboard.
type UserRank struct {
	Rank      *int   `json:"rank,omitempty"`
	Score     int    `json:"score"`
	TotalUsers int   `json:"totalUsers"`
}

// ── Focus / Study Timer ────────────────────────────────────────────────────

// FocusSession is the result of starting a focus session.
type FocusSession struct {
	SessionID      string    `json:"sessionId"`
	DurationMinutes int      `json:"durationMinutes"`
	Mode           string    `json:"mode"`
	StartedAt      time.Time `json:"startedAt"`
}

// FocusTodaySummary is the daily focus summary.
type FocusTodaySummary struct {
	TotalMinutes   int `json:"totalMinutes"`
	SessionCount   int `json:"sessionCount"`
	GoalMinutes    int `json:"goalMinutes"`
}

// ── Companion Pet ──────────────────────────────────────────────────────────

// Pet is the user's companion pet state.
type Pet struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Species      string  `json:"species"`
	Level        int     `json:"level"`
	XP           int     `json:"xp"`
	Happiness    int     `json:"happiness"`
	Hunger       int     `json:"hunger"`
	CostumeSlug  *string `json:"costumeSlug,omitempty"`
	LastFedAt    *time.Time `json:"lastFedAt,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

// PetCostume is one available costume.
type PetCostume struct {
	Slug     string  `json:"slug"`
	NameKey  string  `json:"nameKey"`
	IconURL  *string `json:"iconUrl,omitempty"`
	Owned    bool    `json:"owned"`
}

// ── Seasonal Events ────────────────────────────────────────────────────────

// SeasonalEvent is an active seasonal event.
type SeasonalEvent struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	BannerURL   *string    `json:"bannerUrl,omitempty"`
	StartDate   time.Time  `json:"startDate"`
	EndDate     time.Time  `json:"endDate"`
	Status      string     `json:"status"`
	Joined      bool       `json:"joined"`
}

// EventDetail includes full event info with rewards.
type EventDetail struct {
	SeasonalEvent
	Rewards []EventReward `json:"rewards"`
}

// EventReward is one reward tier in a seasonal event.
type EventReward struct {
	ID          string  `json:"id"`
	NameKey     string  `json:"nameKey"`
	Description *string `json:"description,omitempty"`
	Threshold   int     `json:"threshold"`
	Claimed     bool    `json:"claimed"`
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
		us.last_active_date, COALESCE(us.freezes_used, 0), us.updated_at
	FROM gamification.streak_config sc
	LEFT JOIN gamification.user_streak us ON us.config_id = sc.id AND us.user_id = $1
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

	const q = `INSERT INTO gamification.user_streak (config_id, user_id, current_streak, longest_streak, last_active_date, updated_at)
	SELECT sc.id, $1, 1, 1, $2::date, NOW()
	FROM gamification.streak_config sc
	WHERE sc.enabled = true AND (sc.activity_type = $3 OR sc.activity_type = 'any')
	ON CONFLICT (config_id, user_id) DO UPDATE SET
		current_streak = CASE
			WHEN user_streak.last_active_date = $2::date THEN user_streak.current_streak
			WHEN user_streak.last_active_date = ($2::date - INTERVAL '1 day') THEN user_streak.current_streak + 1
			ELSE 1
		END,
		longest_streak = GREATEST(user_streak.longest_streak,
			CASE
				WHEN user_streak.last_active_date = $2::date THEN user_streak.current_streak
				WHEN user_streak.last_active_date = ($2::date - INTERVAL '1 day') THEN user_streak.current_streak + 1
				ELSE 1
			END),
		last_active_date = $2::date,
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

	// Load tiers for each definition
	for i := range defs {
		const tierQ = `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
		FROM gamification.achievement_tier WHERE achievement_id = $1 ORDER BY threshold ASC`
		tRows, err := s.db.Query(ctx, tierQ, defs[i].ID)
		if err != nil {
			continue
		}
		for tRows.Next() {
			var t AchievementTier
			if err := tRows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey); err != nil {
				continue
			}
			defs[i].Tiers = append(defs[i].Tiers, t)
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
		ba := BrowseAchievement{AchievementDefinition: d}
		const progressQ = `SELECT ua.tier_id, at.tier, ua.current_progress, at.threshold, ua.earned_at
		FROM gamification.user_achievement ua
		JOIN gamification.achievement_tier at ON at.id = ua.tier_id
		WHERE ua.user_id = $1 AND ua.achievement_id = $2
		ORDER BY at.threshold ASC`
		pRows, err := s.db.Query(ctx, progressQ, userID, d.ID)
		if err == nil {
			for pRows.Next() {
				var p UserAchievementProgress
				p.AchievementID = d.ID
				if err := pRows.Scan(&p.TierID, &p.Tier, &p.CurrentProgress, &p.Threshold, &p.EarnedAt); err == nil {
					ba.UserProgress = append(ba.UserProgress, p)
				}
			}
			pRows.Close()
		}
		if ba.UserProgress == nil {
			ba.UserProgress = []UserAchievementProgress{}
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

	const q = `SELECT ua.achievement_id, ua.tier_id, at.tier, ua.current_progress, at.threshold, ua.earned_at
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
		if err := rows.Scan(&p.AchievementID, &p.TierID, &p.Tier, &p.CurrentProgress, &p.Threshold, &p.EarnedAt); err != nil {
			return nil, fmt.Errorf("gamification: scan user achievement: %w", err)
		}
		progress = append(progress, p)
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

	const q = `SELECT ua.id, ad.slug, at.tier, ad.name_key, at.icon_url, ua.earned_at
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
		if err := rows.Scan(&p.UserAchievementID, &p.AchievementSlug, &p.Tier, &p.NameKey, &p.IconURL, &p.EarnedAt); err != nil {
			return nil, fmt.Errorf("gamification: scan pending achievement: %w", err)
		}
		pending = append(pending, p)
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
	if boards == nil {
		boards = []LeaderboardConfig{}
	}
	return boards, nil
}

// GetLeaderboard returns ranked entries for a specific leaderboard.
func (s *Store) GetLeaderboard(ctx context.Context, leaderboardID string) ([]LeaderboardEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT le.rank, le.user_id, COALESCE(up.display_name, 'Anonymous'), le.score
	FROM gamification.leaderboard_entry le
	LEFT JOIN public.user_profile up ON up.id = le.user_id
	WHERE le.leaderboard_id = $1
	ORDER BY le.rank ASC
	LIMIT 100`

	rows, err := s.db.Query(ctx, q, leaderboardID)
	if err != nil {
		return nil, fmt.Errorf("gamification: get leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.Rank, &e.UserID, &e.Username, &e.Score); err != nil {
			return nil, fmt.Errorf("gamification: scan leaderboard entry: %w", err)
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []LeaderboardEntry{}
	}
	return entries, nil
}

// GetUserRank returns the current user's rank on a specific leaderboard.
func (s *Store) GetUserRank(ctx context.Context, leaderboardID, userID string) (*UserRank, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

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
		rank.TotalUsers = 0
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

	const q = `INSERT INTO gamification.focus_session (user_id, duration_minutes, mode, started_at, status)
	VALUES ($1, $2, $3, NOW(), 'active') RETURNING id, started_at`

	var fs FocusSession
	fs.DurationMinutes = durationMinutes
	fs.Mode = mode
	if err := s.db.QueryRow(ctx, q, userID, durationMinutes, mode).Scan(&fs.SessionID, &fs.StartedAt); err != nil {
		return nil, fmt.Errorf("gamification: start focus: %w", err)
	}
	return &fs, nil
}

// EndFocusSession marks a focus session as completed.
func (s *Store) EndFocusSession(ctx context.Context, userID, sessionID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE gamification.focus_session SET status = 'completed', ended_at = NOW()
	WHERE id = $1 AND user_id = $2 AND status = 'active'`

	result, err := s.db.Exec(ctx, q, sessionID, userID)
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

	today := time.Now().Format("2006-01-02")

	const q = `SELECT COALESCE(SUM(duration_minutes), 0), COUNT(*)
	FROM gamification.focus_session
	WHERE user_id = $1 AND started_at >= $2::date AND started_at < ($2::date + INTERVAL '1 day')
	AND status = 'completed'`

	var summary FocusTodaySummary
	if err := s.db.QueryRow(ctx, q, userID, today).Scan(&summary.TotalMinutes, &summary.SessionCount); err != nil {
		return &FocusTodaySummary{}, nil
	}

	// Get goal from daily_study_goal
	const goalQ = `SELECT target_minutes FROM gamification.daily_study_goal WHERE user_id = $1 LIMIT 1`
	if err := s.db.QueryRow(ctx, goalQ, userID).Scan(&summary.GoalMinutes); err != nil {
		summary.GoalMinutes = 15 // default
	}

	return &summary, nil
}

// ── Companion Pet ──────────────────────────────────────────────────────────

// GetPet returns the user's companion pet.
func (s *Store) GetPet(ctx context.Context, userID string) (*Pet, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, name, species, level, xp, happiness, hunger, costume_slug, last_fed_at, created_at
	FROM gamification.companion_pet WHERE user_id = $1 LIMIT 1`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID).Scan(&p.ID, &p.Name, &p.Species, &p.Level, &p.XP,
		&p.Happiness, &p.Hunger, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Auto-create default pet
			return s.createDefaultPet(ctx, userID)
		}
		return nil, fmt.Errorf("gamification: get pet: %w", err)
	}
	return &p, nil
}

func (s *Store) createDefaultPet(ctx context.Context, userID string) (*Pet, error) {
	const q = `INSERT INTO gamification.companion_pet (user_id, name, species, level, xp, happiness, hunger, created_at)
	VALUES ($1, 'Mochi', 'shiba', 1, 0, 80, 20, NOW())
	RETURNING id, name, species, level, xp, happiness, hunger, created_at`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID).Scan(&p.ID, &p.Name, &p.Species, &p.Level, &p.XP,
		&p.Happiness, &p.Hunger, &p.CreatedAt); err != nil {
		return nil, fmt.Errorf("gamification: create default pet: %w", err)
	}
	return &p, nil
}

// FeedPet increases pet happiness and XP.
func (s *Store) FeedPet(ctx context.Context, userID string) (*Pet, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE gamification.companion_pet SET
		happiness = LEAST(happiness + 10, 100),
		xp = xp + 5,
		hunger = GREATEST(hunger - 15, 0),
		last_fed_at = NOW(),
		updated_at = NOW()
	WHERE user_id = $1
	RETURNING id, name, species, level, xp, happiness, hunger, costume_slug, last_fed_at, created_at`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID).Scan(&p.ID, &p.Name, &p.Species, &p.Level, &p.XP,
		&p.Happiness, &p.Hunger, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: feed pet: %w", err)
	}
	return &p, nil
}

// RenamePet updates the pet's name.
func (s *Store) RenamePet(ctx context.Context, userID, newName string) (*Pet, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE gamification.companion_pet SET name = $2, updated_at = NOW()
	WHERE user_id = $1
	RETURNING id, name, species, level, xp, happiness, hunger, costume_slug, last_fed_at, created_at`

	var p Pet
	if err := s.db.QueryRow(ctx, q, userID, newName).Scan(&p.ID, &p.Name, &p.Species, &p.Level, &p.XP,
		&p.Happiness, &p.Hunger, &p.CostumeSlug, &p.LastFedAt, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: rename pet: %w", err)
	}
	return &p, nil
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
		return []PetCostume{}, nil
	}
	defer rows.Close()

	owned := make(map[string]bool)
	for rows.Next() {
		var slug, from string
		if err := rows.Scan(&slug, &from); err == nil {
			owned[slug] = true
		}
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

	now := time.Now()
	const q = `SELECT se.id, se.name, se.description, se.banner_url, se.start_date, se.end_date, se.status,
		EXISTS(SELECT 1 FROM gamification.event_participation ep WHERE ep.event_id = se.id AND ep.user_id = $1) as joined
	FROM gamification.seasonal_event se
	WHERE se.status = 'active' AND se.start_date <= $2 AND se.end_date >= $2
	ORDER BY se.start_date ASC`

	rows, err := s.db.Query(ctx, q, userID, now)
	if err != nil {
		return []SeasonalEvent{}, nil
	}
	defer rows.Close()

	var events []SeasonalEvent
	for rows.Next() {
		var e SeasonalEvent
		if err := rows.Scan(&e.ID, &e.Name, &e.Description, &e.BannerURL, &e.StartDate, &e.EndDate, &e.Status, &e.Joined); err != nil {
			continue
		}
		events = append(events, e)
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

	now := time.Now()
	const q = `SELECT se.id, se.name, se.description, se.banner_url, se.start_date, se.end_date, se.status,
		EXISTS(SELECT 1 FROM gamification.event_participation ep WHERE ep.event_id = se.id AND ep.user_id = $1) as joined
	FROM gamification.seasonal_event se
	WHERE se.id = $2 AND se.status = 'active' AND se.start_date <= $3 AND se.end_date >= $3`

	var ed EventDetail
	if err := s.db.QueryRow(ctx, q, userID, eventID, now).Scan(&ed.ID, &ed.Name, &ed.Description,
		&ed.BannerURL, &ed.StartDate, &ed.EndDate, &ed.Status, &ed.Joined); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("gamification: get event: %w", err)
	}

	// Load rewards
	const rewardQ = `SELECT er.id, er.name_key, er.description, er.threshold,
		EXISTS(SELECT 1 FROM gamification.event_reward_claim erc WHERE erc.reward_id = er.id AND erc.user_id = $1) as claimed
	FROM gamification.event_reward er WHERE er.event_id = $2 ORDER BY er.threshold ASC`

	rRows, err := s.db.Query(ctx, rewardQ, userID, eventID)
	if err == nil {
		for rRows.Next() {
			var r EventReward
			if err := rRows.Scan(&r.ID, &r.NameKey, &r.Description, &r.Threshold, &r.Claimed); err == nil {
				ed.Rewards = append(ed.Rewards, r)
			}
		}
		rRows.Close()
	}
	if ed.Rewards == nil {
		ed.Rewards = []EventReward{}
	}

	return &ed, nil
}

// JoinEvent records user participation in a seasonal event.
func (s *Store) JoinEvent(ctx context.Context, userID, eventID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO gamification.event_participation (event_id, user_id, joined_at)
	VALUES ($1, $2, NOW()) ON CONFLICT (event_id, user_id) DO NOTHING`

	if _, err := s.db.Exec(ctx, q, eventID, userID); err != nil {
		return fmt.Errorf("gamification: join event: %w", err)
	}
	return nil
}

// Ensure json import is used.
var _ = json.RawMessage{}