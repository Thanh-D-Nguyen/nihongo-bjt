// Package flashcarddeck provides access to flashcard deck CRUD, generation, sharing, and cloning.
package flashcarddeck

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested deck does not exist.
var ErrNotFound = errors.New("flashcarddeck: not found")

// ErrNotOwner is returned when the authenticated user does not own the deck.
var ErrNotOwner = errors.New("flashcarddeck: not owner")

// Deck represents a flashcard deck with metadata.
type Deck struct {
	ID          string          `json:"id"`
	UserID      string          `json:"userId"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Status      string          `json:"status"`
	CardCount   int             `json:"cardCount"`
	ShareToken  *string         `json:"shareToken,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// CreateDeckInput contains validated fields for creating a new deck.
type CreateDeckInput struct {
	UserID      string  `json:"userId"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// UpdateDeckInput contains validated fields for updating an existing deck.
type UpdateDeckInput struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// GenerateDeckInput contains filters for auto-generating a deck from dictionary content.
type GenerateDeckInput struct {
	UserID     string   `json:"userId"`
	Name       string   `json:"name"`
	SourceTypes []string `json:"sourceTypes"`
	Levels     []string `json:"levels"`
	Limit      int      `json:"limit"`
}

// PreviewCountResult is the response for POST /api/flashcards/decks/generate/preview.
type PreviewCountResult struct {
	AvailableCount int `json:"availableCount"`
}

// SuggestCardsInput contains filters for suggesting cards for manual composition.
type SuggestCardsInput struct {
	UserID      string   `json:"userId"`
	Query       string   `json:"query"`
	SourceTypes []string `json:"sourceTypes"`
	Limit       int      `json:"limit"`
}

// SuggestedCard is one card suggestion result.
type SuggestedCard struct {
	VariantID   string `json:"variantId"`
	SourceType  string `json:"sourceType"`
	SourceID    string `json:"sourceId"`
	FrontText   string `json:"frontText"`
	BackText    string `json:"backText"`
	Reading     *string `json:"reading,omitempty"`
}

// CreateCardFromContentInput creates a single card from a dictionary/content entry.
type CreateCardFromContentInput struct {
	UserID     string  `json:"userId"`
	DeckID     string  `json:"deckId"`
	SourceType string  `json:"sourceType"`
	SourceID   string  `json:"sourceId"`
	FrontText  string  `json:"frontText"`
	BackText   string  `json:"backText"`
	Reading    *string `json:"reading,omitempty"`
}

// Store provides read/write access to learning.flashcard_deck, learning.deck_card, and learning.flashcard_variant.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a flashcard deck store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ListDecks returns paginated decks owned by or visible to the user.
func (s *Store) ListDecks(ctx context.Context, userID string, limit int) ([]Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if limit <= 0 || limit > 200 {
		limit = 80
	}
	const q = `SELECT d.id, d.user_id, d.name, d.description, d.status, d.share_token, d.created_at, d.updated_at,
		(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count
	FROM learning.flashcard_deck d
	WHERE d.user_id = $1 AND d.status != 'archived'
	ORDER BY d.updated_at DESC
	LIMIT $2`
	rows, err := s.db.Query(ctx, q, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: list decks: %w", err)
	}
	defer rows.Close()
	var decks []Deck
	for rows.Next() {
		var d Deck
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Status, &d.ShareToken, &d.CreatedAt, &d.UpdatedAt, &d.CardCount); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan deck: %w", err)
		}
		decks = append(decks, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("flashcarddeck: iterate decks: %w", err)
	}
	if decks == nil {
		decks = []Deck{}
	}
	return decks, nil
}

// CreateDeck inserts a new flashcard deck.
func (s *Store) CreateDeck(ctx context.Context, input CreateDeckInput) (*Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `INSERT INTO learning.flashcard_deck (user_id, name, description, status)
		VALUES ($1, $2, $3, 'active') RETURNING id, created_at, updated_at`
	var d Deck
	d.UserID = input.UserID
	d.Name = input.Name
	d.Description = input.Description
	d.Status = "active"
	d.CardCount = 0
	err := s.db.QueryRow(ctx, q, input.UserID, input.Name, input.Description).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: create deck: %w", err)
	}
	return &d, nil
}

// UpdateDeck updates metadata for a learner-owned deck.
func (s *Store) UpdateDeck(ctx context.Context, userID, deckID string, input UpdateDeckInput) (*Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	// Verify ownership
	const ownerQ = `SELECT id FROM learning.flashcard_deck WHERE id = $1 AND user_id = $2 AND status != 'archived'`
	var exists string
	if err := s.db.QueryRow(ctx, ownerQ, deckID, userID).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotOwner
		}
		return nil, fmt.Errorf("flashcarddeck: verify ownership: %w", err)
	}
	// Build dynamic update
	if input.Name != nil {
		const nameQ = `UPDATE learning.flashcard_deck SET name = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`
		if _, err := s.db.Exec(ctx, nameQ, deckID, userID, *input.Name); err != nil {
			return nil, fmt.Errorf("flashcarddeck: update name: %w", err)
		}
	}
	if input.Description != nil {
		const descQ = `UPDATE learning.flashcard_deck SET description = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`
		if _, err := s.db.Exec(ctx, descQ, deckID, userID, *input.Description); err != nil {
			return nil, fmt.Errorf("flashcarddeck: update description: %w", err)
		}
	}
	// Return updated deck
	const getQ = `SELECT d.id, d.user_id, d.name, d.description, d.status, d.share_token, d.created_at, d.updated_at,
		(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count
	FROM learning.flashcard_deck d WHERE d.id = $1`
	var d Deck
	if err := s.db.QueryRow(ctx, getQ, deckID).Scan(&d.ID, &d.UserID, &d.Name, &d.Description, &d.Status, &d.ShareToken, &d.CreatedAt, &d.UpdatedAt, &d.CardCount); err != nil {
		return nil, fmt.Errorf("flashcarddeck: reload deck: %w", err)
	}
	return &d, nil
}

// ArchiveDeck soft-deletes a learner-owned deck and prunes orphaned user_flashcard rows.
func (s *Store) ArchiveDeck(ctx context.Context, userID, deckID string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("flashcarddeck: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	// Verify ownership
	const ownerQ = `SELECT id FROM learning.flashcard_deck WHERE id = $1 AND user_id = $2 AND status != 'archived'`
	var exists string
	if err := tx.QueryRow(ctx, ownerQ, deckID, userID).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotOwner
		}
		return fmt.Errorf("flashcarddeck: verify ownership: %w", err)
	}
	// Archive the deck
	const archiveQ = `UPDATE learning.flashcard_deck SET status = 'archived', updated_at = NOW() WHERE id = $1`
	if _, err := tx.Exec(ctx, archiveQ, deckID); err != nil {
		return fmt.Errorf("flashcarddeck: archive deck: %w", err)
	}
	// Remove deck-card links
	const unlinkQ = `DELETE FROM learning.deck_card WHERE deck_id = $1`
	if _, err := tx.Exec(ctx, unlinkQ, deckID); err != nil {
		return fmt.Errorf("flashcarddeck: unlink cards: %w", err)
	}
	// Prune user_flashcard rows where the card has no remaining active deck membership
	const pruneQ = `DELETE FROM learning.user_flashcard uf
		WHERE uf.user_id = $1
		AND NOT EXISTS (
			SELECT 1 FROM learning.deck_card dc
			JOIN learning.flashcard_deck fd ON fd.id = dc.deck_id
			WHERE dc.card_id = uf.card_id AND fd.status != 'archived'
			AND (fd.user_id = $1 OR fd.status = 'public')
		)`
	if _, err := tx.Exec(ctx, pruneQ, userID); err != nil {
		return fmt.Errorf("flashcarddeck: prune orphaned user flashcards: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return nil
}

// ShareDeck generates or returns an existing share token for a learner-owned deck.
func (s *Store) ShareDeck(ctx context.Context, userID, deckID string) (*string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	// Verify ownership
	const ownerQ = `SELECT share_token FROM learning.flashcard_deck WHERE id = $1 AND user_id = $2 AND status != 'archived'`
	var existingToken *string
	if err := s.db.QueryRow(ctx, ownerQ, deckID, userID).Scan(&existingToken); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotOwner
		}
		return nil, fmt.Errorf("flashcarddeck: verify ownership: %w", err)
	}
	if existingToken != nil && *existingToken != "" {
		return existingToken, nil
	}
	// Generate new token
	token := generateShareToken()
	const updateQ = `UPDATE learning.flashcard_deck SET share_token = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`
	if _, err := s.db.Exec(ctx, updateQ, deckID, userID, token); err != nil {
		return nil, fmt.Errorf("flashcarddeck: set share token: %w", err)
	}
	return &token, nil
}

// UnshareDeck removes the share token from a learner-owned deck.
func (s *Store) UnshareDeck(ctx context.Context, userID, deckID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `UPDATE learning.flashcard_deck SET share_token = NULL, updated_at = NOW()
		WHERE id = $1 AND user_id = $2 AND status != 'archived'`
	result, err := s.db.Exec(ctx, q, deckID, userID)
	if err != nil {
		return fmt.Errorf("flashcarddeck: unshare deck: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotOwner
	}
	return nil
}

// CloneDeck clones a shared deck into the authenticated user's collection using the share token.
func (s *Store) CloneDeck(ctx context.Context, userID, token string) (*Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	// Find source deck by token
	const findQ = `SELECT id, name, description FROM learning.flashcard_deck WHERE share_token = $1 AND status != 'archived'`
	var srcID, srcName string
	var srcDesc *string
	if err := tx.QueryRow(ctx, findQ, token).Scan(&srcID, &srcName, &srcDesc); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("flashcarddeck: find source deck: %w", err)
	}
	// Create cloned deck
	clonedName := srcName + " (copy)"
	const createQ = `INSERT INTO learning.flashcard_deck (user_id, name, description, status)
		VALUES ($1, $2, $3, 'active') RETURNING id, created_at, updated_at`
	var d Deck
	d.UserID = userID
	d.Name = clonedName
	d.Description = srcDesc
	d.Status = "active"
	if err := tx.QueryRow(ctx, createQ, userID, clonedName, srcDesc).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create cloned deck: %w", err)
	}
	// Copy deck-card links
	const copyLinksQ = `INSERT INTO learning.deck_card (deck_id, card_id, position)
		SELECT $1, card_id, position FROM learning.deck_card WHERE deck_id = $2`
	if _, err := tx.Exec(ctx, copyLinksQ, d.ID, srcID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: copy deck-card links: %w", err)
	}
	// Create user_flashcard entries for new cards
	const createUserFlashcardsQ = `INSERT INTO learning.user_flashcard (user_id, card_id, state, due_at)
		SELECT $1, dc.card_id, 'new', NOW()
		FROM learning.deck_card dc
		WHERE dc.deck_id = $2
		ON CONFLICT (user_id, card_id) DO NOTHING`
	if _, err := tx.Exec(ctx, createUserFlashcardsQ, userID, d.ID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create user flashcards: %w", err)
	}
	// Get card count
	const countQ = `SELECT COUNT(*) FROM learning.deck_card WHERE deck_id = $1`
	if err := tx.QueryRow(ctx, countQ, d.ID).Scan(&d.CardCount); err != nil {
		return nil, fmt.Errorf("flashcarddeck: count cards: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return &d, nil
}

// PreviewGenerateCount returns the number of available content items matching the generation filters.
func (s *Store) PreviewGenerateCount(ctx context.Context, input GenerateDeckInput) (*PreviewCountResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	// Count available variants matching source types and levels
	// This is a simplified query; full implementation requires joining with lexeme/grammar/kanji tables
	const q = `SELECT COUNT(*) FROM learning.flashcard_variant fv
		WHERE fv.status = 'active'
		AND ($1::text[] IS NULL OR fv.source_type = ANY($1))`
	var count int
	if err := s.db.QueryRow(ctx, q, input.SourceTypes).Scan(&count); err != nil {
		return nil, fmt.Errorf("flashcarddeck: preview count: %w", err)
	}
	return &PreviewCountResult{AvailableCount: count}, nil
}

// GenerateDeck auto-generates a deck from dictionary content matching the filters.
func (s *Store) GenerateDeck(ctx context.Context, input GenerateDeckInput) (*Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	// Create the deck
	const createQ = `INSERT INTO learning.flashcard_deck (user_id, name, status)
		VALUES ($1, $2, 'active') RETURNING id, created_at, updated_at`
	var d Deck
	d.UserID = input.UserID
	d.Name = input.Name
	d.Status = "active"
	if err := tx.QueryRow(ctx, createQ, input.UserID, input.Name).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create generated deck: %w", err)
	}
	// Select variants matching filters
	limit := input.Limit
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	const selectQ = `SELECT id FROM learning.flashcard_variant
		WHERE status = 'active'
		AND ($1::text[] IS NULL OR source_type = ANY($1))
		ORDER BY RANDOM() LIMIT $2`
	rows, err := tx.Query(ctx, selectQ, input.SourceTypes, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: select variants: %w", err)
	}
	defer rows.Close()
	var variantIDs []string
	for rows.Next() {
		var vid string
		if err := rows.Scan(&vid); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan variant id: %w", err)
		}
		variantIDs = append(variantIDs, vid)
	}
	// Insert deck-card links and user_flashcard entries
	for i, vid := range variantIDs {
		const linkQ = `INSERT INTO learning.deck_card (deck_id, card_id, position) VALUES ($1, $2, $3)`
		if _, err := tx.Exec(ctx, linkQ, d.ID, vid, i); err != nil {
			return nil, fmt.Errorf("flashcarddeck: link card: %w", err)
		}
		const ufQ = `INSERT INTO learning.user_flashcard (user_id, card_id, state, due_at)
			VALUES ($1, $2, 'new', NOW()) ON CONFLICT (user_id, card_id) DO NOTHING`
		if _, err := tx.Exec(ctx, ufQ, input.UserID, vid); err != nil {
			return nil, fmt.Errorf("flashcarddeck: create user flashcard: %w", err)
		}
	}
	d.CardCount = len(variantIDs)
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return &d, nil
}

// SuggestCards returns card suggestions for manual deck composition.
func (s *Store) SuggestCards(ctx context.Context, input SuggestCardsInput) ([]SuggestedCard, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	limit := input.Limit
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	const q = `SELECT id, source_type, source_id, front_text, back_text, reading
		FROM learning.flashcard_variant
		WHERE status = 'active'
		AND ($1::text[] IS NULL OR source_type = ANY($1))
		AND ($2 = '' OR front_text ILIKE '%' || $2 || '%' OR back_text ILIKE '%' || $2 || '%')
		ORDER BY RANDOM() LIMIT $3`
	rows, err := s.db.Query(ctx, q, input.SourceTypes, input.Query, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: suggest cards: %w", err)
	}
	defer rows.Close()
	var cards []SuggestedCard
	for rows.Next() {
		var c SuggestedCard
		if err := rows.Scan(&c.VariantID, &c.SourceType, &c.SourceID, &c.FrontText, &c.BackText, &c.Reading); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan suggested card: %w", err)
		}
		cards = append(cards, c)
	}
	if cards == nil {
		cards = []SuggestedCard{}
	}
	return cards, nil
}

// CreateCardFromContent creates a single flashcard variant and links it to a deck.
func (s *Store) CreateCardFromContent(ctx context.Context, input CreateCardFromContentInput) (*SuggestedCard, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	// Create variant
	const insertQ = `INSERT INTO learning.flashcard_variant (source_type, source_id, front_text, back_text, reading, status)
		VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`
	var variantID string
	if err := tx.QueryRow(ctx, insertQ, input.SourceType, input.SourceID, input.FrontText, input.BackText, input.Reading).Scan(&variantID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create variant: %w", err)
	}
	// Link to deck
	const linkQ = `INSERT INTO learning.deck_card (deck_id, card_id, position)
		VALUES ($1, $2, COALESCE((SELECT MAX(position)+1 FROM learning.deck_card WHERE deck_id = $1), 0))`
	if _, err := tx.Exec(ctx, linkQ, input.DeckID, variantID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: link to deck: %w", err)
	}
	// Create user flashcard entry
	const ufQ = `INSERT INTO learning.user_flashcard (user_id, card_id, state, due_at)
		VALUES ($1, $2, 'new', NOW()) ON CONFLICT (user_id, card_id) DO NOTHING`
	if _, err := tx.Exec(ctx, ufQ, input.UserID, variantID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create user flashcard: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return &SuggestedCard{
		VariantID:  variantID,
		SourceType: input.SourceType,
		SourceID:   input.SourceID,
		FrontText:  input.FrontText,
		BackText:   input.BackText,
		Reading:    input.Reading,
	}, nil
}

// generateShareToken creates a random share token.
func generateShareToken() string {
	// Simple implementation; production should use crypto/rand
	return fmt.Sprintf("share_%d", time.Now().UnixNano())
}

// Ensure json import is used.
var _ = json.RawMessage{}