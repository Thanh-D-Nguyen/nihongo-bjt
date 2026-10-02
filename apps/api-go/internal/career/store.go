// Package career provides access to career RPG state, ranks, inbox, and clock-in.
package career

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
var ErrNotFound = errors.New("career: not found")

// CareerMe is the full career state for GET /api/career/me.
type CareerMe struct {
	UserID          string            `json:"userId"`
	CurrentRankCode string            `json:"currentRankCode"`
	RankXP          int               `json:"rankXp"`
	JPWorkName      string            `json:"jpWorkName"`
	CompanyTheme    string            `json:"companyTheme"`
	HireDate        string            `json:"hireDate"`
	LastClockInAt   *string           `json:"lastClockInAt,omitempty"`
	StreakDays      int               `json:"streakDays"`
	Skills          []CareerSkillStat `json:"skills"`
	RankTitle       *RankTitle        `json:"rankTitle,omitempty"`
}

// RankTitle is the localized title for a rank.
type RankTitle struct {
	TitleJa string `json:"titleJa"`
	TitleVi string `json:"titleVi"`
}

// CareerSkillStat is one skill axis value.
type CareerSkillStat struct {
	AxisCode string `json:"axisCode"`
	Value    int    `json:"value"`
}

// CareerRankSummary is a rank entry for GET /api/career/ranks.
type CareerRankSummary struct {
	ID                 string          `json:"id"`
	RankCode           string          `json:"rankCode"`
	TitleJa            string          `json:"titleJa"`
	TitleVi            string          `json:"titleVi"`
	BJTBandTarget      string          `json:"bjtBandTarget"`
	MinSkillFloor      int             `json:"minSkillFloor"`
	RequiredArcCount   int             `json:"requiredArcCount"`
	XPToNext           int             `json:"xpToNext"`
	DisplayOrder       int             `json:"displayOrder"`
	UnlockedSceneTypes json.RawMessage `json:"unlockedSceneTypes"`
	RewardsPayload     json.RawMessage `json:"rewardsPayload"`
}

// ContextMemo is one inbox item for GET /api/career/inbox.
type ContextMemo struct {
	ID        string          `json:"id"`
	MemoType  string          `json:"memoType"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"createdAt"`
	ReadAt    *time.Time      `json:"readAt,omitempty"`
}

// Store provides read/write access to career tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a career store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetMe returns the full career state for a user, auto-creating if needed.
func (s *Store) GetMe(ctx context.Context, userID string) (*CareerMe, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT ucs.current_rank_code, ucs.rank_xp, ucs.jp_work_name, ucs.company_theme,
		ucs.hire_date, ucs.last_clock_in_at, ucs.streak_days
		FROM career.user_career_state ucs WHERE ucs.user_id = $1`
	var me CareerMe
	me.UserID = userID
	var hireDate time.Time
	var lastClockIn *time.Time
	if err := s.db.QueryRow(ctx, q, userID).Scan(&me.CurrentRankCode, &me.RankXP, &me.JPWorkName,
		&me.CompanyTheme, &hireDate, &lastClockIn, &me.StreakDays); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Auto-create default career state
			return s.createDefaultCareerState(ctx, userID)
		}
		return nil, fmt.Errorf("career: get me: %w", err)
	}
	me.HireDate = hireDate.Format("2006-01-02")
	if lastClockIn != nil {
		s := lastClockIn.Format(time.RFC3339)
		me.LastClockInAt = &s
	}

	// Load skills
	const skillQ = `SELECT axis_code, value FROM career.career_skill_stat WHERE user_id = $1`
	rows, err := s.db.Query(ctx, skillQ, userID)
	if err == nil {
		for rows.Next() {
			var sk CareerSkillStat
			if err := rows.Scan(&sk.AxisCode, &sk.Value); err == nil {
				me.Skills = append(me.Skills, sk)
			}
		}
		rows.Close()
	}
	if me.Skills == nil {
		me.Skills = []CareerSkillStat{}
	}

	// Load rank title
	const rankQ = `SELECT title_ja, title_vi FROM career.career_rank WHERE rank_code = $1`
	var rt RankTitle
	if err := s.db.QueryRow(ctx, rankQ, me.CurrentRankCode).Scan(&rt.TitleJa, &rt.TitleVi); err == nil {
		me.RankTitle = &rt
	}

	return &me, nil
}

func (s *Store) createDefaultCareerState(ctx context.Context, userID string) (*CareerMe, error) {
	const insertQ = `INSERT INTO career.user_career_state (user_id, current_rank_code, rank_xp, jp_work_name, company_theme, hire_date, streak_days, updated_at)
		VALUES ($1, 'R1', 0, '田中 太郎', 'mirai-shoji', CURRENT_DATE, 0, NOW())
		ON CONFLICT (user_id) DO NOTHING`
	if _, err := s.db.Exec(ctx, insertQ, userID); err != nil {
		return nil, fmt.Errorf("career: create default: %w", err)
	}
	return s.GetMe(ctx, userID)
}

// UpdateMe updates career profile fields.
func (s *Store) UpdateMe(ctx context.Context, userID string, jpWorkName, companyTheme *string) (*CareerMe, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if jpWorkName != nil {
		const q = `UPDATE career.user_career_state SET jp_work_name = $2, updated_at = NOW() WHERE user_id = $1`
		if _, err := s.db.Exec(ctx, q, userID, *jpWorkName); err != nil {
			return nil, fmt.Errorf("career: update name: %w", err)
		}
	}
	if companyTheme != nil {
		const q = `UPDATE career.user_career_state SET company_theme = $2, updated_at = NOW() WHERE user_id = $1`
		if _, err := s.db.Exec(ctx, q, userID, *companyTheme); err != nil {
			return nil, fmt.Errorf("career: update theme: %w", err)
		}
	}
	return s.GetMe(ctx, userID)
}

// ClockIn records a daily clock-in and updates streak.
func (s *Store) ClockIn(ctx context.Context, userID string) (*CareerMe, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	now := time.Now()
	today := now.Format("2006-01-02")

	const q = `UPDATE career.user_career_state SET
		last_clock_in_at = NOW(),
		streak_days = CASE
			WHEN last_clock_in_at >= $2::date THEN streak_days
			WHEN last_clock_in_at >= ($2::date - INTERVAL '1 day') THEN streak_days + 1
			ELSE 1
		END,
		rank_xp = rank_xp + 10,
		updated_at = NOW()
		WHERE user_id = $1`
	if _, err := s.db.Exec(ctx, q, userID, today); err != nil {
		return nil, fmt.Errorf("career: clock in: %w", err)
	}
	return s.GetMe(ctx, userID)
}

// ListRanks returns all career ranks ordered by display order.
func (s *Store) ListRanks(ctx context.Context) ([]CareerRankSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, rank_code, title_ja, title_vi, bjt_band_target, min_skill_floor,
		required_arc_count, xp_to_next, display_order, unlocked_scene_types, rewards_payload
		FROM career.career_rank ORDER BY display_order ASC`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("career: list ranks: %w", err)
	}
	defer rows.Close()

	var ranks []CareerRankSummary
	for rows.Next() {
		var r CareerRankSummary
		if err := rows.Scan(&r.ID, &r.RankCode, &r.TitleJa, &r.TitleVi, &r.BJTBandTarget,
			&r.MinSkillFloor, &r.RequiredArcCount, &r.XPToNext, &r.DisplayOrder,
			&r.UnlockedSceneTypes, &r.RewardsPayload); err != nil {
			return nil, fmt.Errorf("career: scan rank: %w", err)
		}
		ranks = append(ranks, r)
	}
	if ranks == nil {
		ranks = []CareerRankSummary{}
	}
	return ranks, nil
}

// GetInbox returns context memos for a user.
func (s *Store) GetInbox(ctx context.Context, userID string) ([]ContextMemo, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, memo_type, payload, created_at, read_at
		FROM career.context_memo WHERE user_id = $1
		ORDER BY created_at DESC LIMIT 50`
	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return []ContextMemo{}, nil // table may not exist yet
	}
	defer rows.Close()

	var memos []ContextMemo
	for rows.Next() {
		var m ContextMemo
		if err := rows.Scan(&m.ID, &m.MemoType, &m.Payload, &m.CreatedAt, &m.ReadAt); err != nil {
			continue
		}
		memos = append(memos, m)
	}
	if memos == nil {
		memos = []ContextMemo{}
	}
	return memos, nil
}
