// Package flashcardstyle provides access to flashcard style definitions and user preferences.
package flashcardstyle

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested style does not exist.
var ErrNotFound = errors.New("flashcardstyle: not found")

// Style represents an available flashcard visual theme.
type Style struct {
	ID             string          `json:"id"`
	Slug           string          `json:"slug"`
	NameKey        string          `json:"nameKey"`
	DescriptionKey *string         `json:"descriptionKey,omitempty"`
	ThumbnailURL   *string         `json:"thumbnailUrl,omitempty"`
	Config         json.RawMessage `json:"config"`
	Tier           string          `json:"tier"`
	SortOrder      int             `json:"sortOrder"`
	Status         string          `json:"status"`
	Locked         bool            `json:"locked"`
}

// ActiveStyleResponse is returned by GET /api/flashcards/styles/active.
type ActiveStyleResponse struct {
	Slug   *string         `json:"slug"`
	Config json.RawMessage `json:"config"`
}

// Store provides read/write access to content.flashcard_style and profile.user_profile.flashcard_style_slug.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a flashcard style store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ListForLearner returns all active flashcard styles with lock status based on user tier.
// For now, all styles are returned as unlocked (tier gating requires subscription service integration).
func (s *Store) ListForLearner(ctx context.Context, userID string) ([]Style, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status
FROM content.flashcard_style
WHERE status = 'active'
ORDER BY sort_order ASC, created_at ASC`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("flashcardstyle: list styles: %w", err)
	}
	defer rows.Close()

	var styles []Style
	for rows.Next() {
		var st Style
		var configBytes []byte
		if err := rows.Scan(&st.ID, &st.Slug, &st.NameKey, &st.DescriptionKey, &st.ThumbnailURL, &configBytes, &st.Tier, &st.SortOrder, &st.Status); err != nil {
			return nil, fmt.Errorf("flashcardstyle: scan style: %w", err)
		}
		if len(configBytes) > 0 {
			st.Config = configBytes
		} else {
			st.Config = json.RawMessage("{}")
		}
		// TODO: Check user subscription tier to set Locked field
		st.Locked = false
		styles = append(styles, st)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("flashcardstyle: iterate styles: %w", err)
	}
	if styles == nil {
		styles = []Style{}
	}
	return styles, nil
}

// GetActiveStyle returns the user's currently active flashcard style slug and config.
// Returns default style if no preference is set.
func (s *Store) GetActiveStyle(ctx context.Context, userID string) (*ActiveStyleResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Load user's preferred style slug
	const userQ = `SELECT flashcard_style_slug FROM profile.user_profile WHERE id = $1 AND status = 'active'`
	var slug *string
	err := s.db.QueryRow(ctx, userQ, userID).Scan(&slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &ActiveStyleResponse{Slug: nil, Config: json.RawMessage("{}")}, nil
		}
		return nil, fmt.Errorf("flashcardstyle: get user preference: %w", err)
	}

	if slug == nil || *slug == "" {
		return &ActiveStyleResponse{Slug: nil, Config: json.RawMessage("{}")}, nil
	}

	// Load the style config
	const styleQ = `SELECT config FROM content.flashcard_style WHERE slug = $1 AND status = 'active'`
	var configBytes []byte
	if err := s.db.QueryRow(ctx, styleQ, *slug).Scan(&configBytes); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Preferred style no longer exists; return nil slug
			return &ActiveStyleResponse{Slug: nil, Config: json.RawMessage("{}")}, nil
		}
		return nil, fmt.Errorf("flashcardstyle: get style config: %w", err)
	}

	config := json.RawMessage("{}")
	if len(configBytes) > 0 {
		config = configBytes
	}
	return &ActiveStyleResponse{Slug: slug, Config: config}, nil
}

// SetActiveStyle updates the user's preferred flashcard style.
// Pass nil slug to reset to default.
func (s *Store) SetActiveStyle(ctx context.Context, userID string, slug *string) (*ActiveStyleResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if slug != nil && *slug != "" {
		// Validate style exists and is active
		const checkQ = `SELECT slug FROM content.flashcard_style WHERE slug = $1 AND status = 'active'`
		var validSlug string
		if err := s.db.QueryRow(ctx, checkQ, *slug).Scan(&validSlug); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("flashcardstyle: style not found: %w", ErrNotFound)
			}
			return nil, fmt.Errorf("flashcardstyle: validate style: %w", err)
		}
	}

	// Update user profile
	const updateQ = `UPDATE profile.user_profile SET flashcard_style_slug = $2, updated_at = NOW() WHERE id = $1`
	if _, err := s.db.Exec(ctx, updateQ, userID, slug); err != nil {
		return nil, fmt.Errorf("flashcardstyle: update user preference: %w", err)
	}

	return s.GetActiveStyle(ctx, userID)
}