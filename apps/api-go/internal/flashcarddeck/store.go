// Package flashcarddeck provides access to flashcard deck CRUD, generation, sharing, and cloning.
package flashcarddeck

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
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
	ID            string    `json:"id"`
	UserID        *string   `json:"ownerUserId"`
	Name          string    `json:"titleVi"`
	TitleJa       *string   `json:"titleJa"`
	Description   *string   `json:"descriptionVi"`
	DescriptionJa *string   `json:"descriptionJa"`
	Visibility    string    `json:"visibility"`
	Status        string    `json:"status"`
	CardCount     int       `json:"cardCount"`
	Count         deckCount `json:"_count"`
	ShareToken    *string   `json:"shareToken,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type deckCount struct {
	Cards int `json:"cards"`
}

type DeckDetail struct {
	Deck
	Cards []DeckDetailCard `json:"cards"`
}

type DeckDetailCard struct {
	ID       string       `json:"id"`
	Position int          `json:"position"`
	Card     DeckCardData `json:"card"`
}

type SharedDeckPreview struct {
	TitleVi       string                  `json:"titleVi"`
	TitleJa       *string                 `json:"titleJa"`
	DescriptionVi *string                 `json:"descriptionVi"`
	DescriptionJa *string                 `json:"descriptionJa"`
	CardCount     int                     `json:"cardCount"`
	CloneCount    int                     `json:"cloneCount"`
	SampleCards   []SharedDeckPreviewCard `json:"sampleCards"`
}

type SharedDeckPreviewCard struct {
	FrontText string  `json:"frontText"`
	Reading   *string `json:"reading"`
}

type DeckCardData struct {
	ID         string  `json:"id"`
	FrontText  string  `json:"frontText"`
	BackText   string  `json:"backText"`
	Reading    *string `json:"reading"`
	SourceID   string  `json:"sourceId"`
	SourceType string  `json:"sourceType"`
}

// CreateDeckInput contains validated fields for creating a new deck.
type CreateDeckInput struct {
	UserID      string          `json:"userId"`
	Name        string          `json:"name"`
	TitleJa     *string         `json:"titleJa,omitempty"`
	Description *string         `json:"description,omitempty"`
	Visibility  string          `json:"visibility,omitempty"`
	Cards       []DeckCardInput `json:"cards,omitempty"`
}

type DeckCardInput struct {
	CardID    string  `json:"cardId,omitempty"`
	FrontText string  `json:"frontText"`
	BackText  string  `json:"backText"`
	Reading   *string `json:"reading,omitempty"`
}

// UpdateDeckInput contains validated fields for updating an existing deck.
type UpdateDeckInput struct {
	Name        *string          `json:"name,omitempty"`
	TitleJa     *string          `json:"titleJa,omitempty"`
	Description *string          `json:"description,omitempty"`
	Visibility  *string          `json:"visibility,omitempty"`
	Cards       *[]DeckCardInput `json:"cards,omitempty"`
}

// GenerateDeckInput contains filters for auto-generating a deck from dictionary content.
type GenerateDeckInput struct {
	UserID      string   `json:"userId"`
	Name        string   `json:"name"`
	SourceTypes []string `json:"sourceTypes"`
	Levels      []string `json:"levels"`
	Limit       int      `json:"limit"`
	Direction   string   `json:"direction"`
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
	VariantID  string  `json:"variantId"`
	SourceType string  `json:"sourceType"`
	SourceID   string  `json:"sourceId"`
	FrontText  string  `json:"frontText"`
	BackText   string  `json:"backText"`
	Reading    *string `json:"reading,omitempty"`
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

// Store provides read/write access to learning.deck, learning.deck_card, and learning.flashcard_variant.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a flashcard deck store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// redactForeignDeck removes owner-only capabilities from decks the viewer does
// not own: the share token is a bearer credential for clone/preview and the
// owner's account ID is not part of the public deck contract.
func redactForeignDeck(viewerID string, d *Deck) {
	if d.UserID != nil && *d.UserID == viewerID {
		return
	}
	d.ShareToken = nil
	d.UserID = nil
}

// ListDecks returns paginated decks owned by or visible to the user.
func (s *Store) ListDecks(ctx context.Context, userID string, limit int) ([]Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if limit <= 0 || limit > 200 {
		limit = 80
	}
	const q = `SELECT d.id, d.owner_user_id::text, d.title_vi, d.title_ja, d.description_vi, d.description_ja, d.visibility, d.status, d.share_token, d.created_at, d.updated_at,
		(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count
	FROM learning.deck d
	WHERE d.status != 'archived' AND (d.owner_user_id = $1 OR d.visibility = 'public')
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
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.TitleJa, &d.Description, &d.DescriptionJa, &d.Visibility, &d.Status, &d.ShareToken, &d.CreatedAt, &d.UpdatedAt, &d.CardCount); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan deck: %w", err)
		}
		d.Count.Cards = d.CardCount
		redactForeignDeck(userID, &d)
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

func (s *Store) GetDeck(ctx context.Context, userID, deckID string) (*DeckDetail, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	const deckQ = `SELECT d.id,d.owner_user_id::text,d.title_vi,d.title_ja,d.description_vi,d.description_ja,d.visibility,d.status,d.share_token,d.created_at,d.updated_at,
		(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id=d.id)
		FROM learning.deck d WHERE d.id=$1 AND d.status!='archived'
		AND (d.owner_user_id=$2 OR d.visibility='public')`
	detail := &DeckDetail{}
	if err := s.db.QueryRow(ctx, deckQ, deckID, userID).Scan(&detail.ID, &detail.UserID, &detail.Name, &detail.TitleJa, &detail.Description, &detail.DescriptionJa, &detail.Visibility, &detail.Status, &detail.ShareToken, &detail.CreatedAt, &detail.UpdatedAt, &detail.CardCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("flashcarddeck: get deck: %w", err)
	}
	detail.Count.Cards = detail.CardCount
	redactForeignDeck(userID, &detail.Deck)
	const cardsQ = `SELECT dc.id,dc.position,fv.id,fv.front_text,fv.back_text,fv.reading,fv.source_id,fv.source_type
		FROM learning.deck_card dc JOIN learning.flashcard_variant fv ON fv.id=dc.card_id
		WHERE dc.deck_id=$1 AND fv.status='active' ORDER BY dc.position,dc.id`
	rows, err := s.db.Query(ctx, cardsQ, deckID)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: list deck cards: %w", err)
	}
	defer rows.Close()
	detail.Cards = []DeckDetailCard{}
	for rows.Next() {
		var card DeckDetailCard
		if err := rows.Scan(&card.ID, &card.Position, &card.Card.ID, &card.Card.FrontText, &card.Card.BackText, &card.Card.Reading, &card.Card.SourceID, &card.Card.SourceType); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan deck card: %w", err)
		}
		detail.Cards = append(detail.Cards, card)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("flashcarddeck: iterate deck cards: %w", err)
	}
	return detail, nil
}

// CreateDeck inserts a new flashcard deck.
func (s *Store) CreateDeck(ctx context.Context, input CreateDeckInput) (*Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	visibility := input.Visibility
	if visibility != "public" {
		visibility = "private"
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	const q = `INSERT INTO learning.deck (owner_user_id, title_vi, title_ja, description_vi, visibility, status, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'active', NOW()) RETURNING id, created_at, updated_at`
	var d Deck
	d.UserID = &input.UserID
	d.Name = input.Name
	d.TitleJa = input.TitleJa
	d.Description = input.Description
	d.Visibility = visibility
	d.Status = "active"
	if err := tx.QueryRow(ctx, q, input.UserID, input.Name, input.TitleJa, input.Description, visibility).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create deck: %w", err)
	}
	if err := insertDeckCards(ctx, tx, input.UserID, d.ID, input.Cards); err != nil {
		return nil, err
	}
	d.CardCount = len(input.Cards)
	d.Count.Cards = d.CardCount
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return &d, nil
}

func insertDeckCards(ctx context.Context, tx pgx.Tx, userID, deckID string, cards []DeckCardInput) error {
	for i, card := range cards {
		cardID := card.CardID
		if cardID == "" {
			const createCard = `INSERT INTO learning.flashcard_variant (source_type, source_id, front_text, back_text, reading, status, updated_at)
				VALUES ('custom', $1, $2, $3, $4, 'active', NOW()) RETURNING id`
			if err := tx.QueryRow(ctx, createCard, deckID, card.FrontText, card.BackText, card.Reading).Scan(&cardID); err != nil {
				return fmt.Errorf("flashcarddeck: create custom card: %w", err)
			}
		} else {
			if _, err := loadDeckCard(ctx, tx, userID, deckID, cardID); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `INSERT INTO learning.deck_card (deck_id,card_id,position) VALUES ($1,$2,$3) ON CONFLICT (deck_id,card_id) DO NOTHING`, deckID, cardID, i); err != nil {
			return fmt.Errorf("flashcarddeck: link card: %w", err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO learning.user_flashcard (user_id,card_id,state,due_at,updated_at) VALUES ($1,$2,'new',NOW(),NOW()) ON CONFLICT (user_id,card_id) DO NOTHING`, userID, cardID); err != nil {
			return fmt.Errorf("flashcarddeck: create user flashcard: %w", err)
		}
	}
	return nil
}

func loadDeckCard(ctx context.Context, tx pgx.Tx, userID, deckID, cardID string) (DeckCardData, error) {
	const q = `SELECT fv.id::text,fv.front_text,fv.back_text,fv.reading,fv.source_id::text,fv.source_type
		FROM learning.flashcard_variant fv
		WHERE fv.id=$1 AND fv.status='active' AND (
			(fv.source_type='lexeme' AND EXISTS (SELECT 1 FROM content.lexeme l WHERE l.id=fv.source_id AND l.status='active')) OR
			(fv.source_type='grammar' AND EXISTS (SELECT 1 FROM content.grammar_point g WHERE g.id=fv.source_id AND g.status='active')) OR
			(fv.source_type='kanji' AND EXISTS (SELECT 1 FROM content.kanji k WHERE k.id=fv.source_id AND k.status='active')) OR
			(fv.source_type='custom' AND fv.source_id=$2 AND EXISTS (SELECT 1 FROM learning.deck d WHERE d.id=$2 AND d.owner_user_id=$3 AND d.status='active'))
		)`
	var card DeckCardData
	if err := tx.QueryRow(ctx, q, cardID, deckID, userID).Scan(&card.ID, &card.FrontText, &card.BackText, &card.Reading, &card.SourceID, &card.SourceType); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DeckCardData{}, ErrNotOwner
		}
		return DeckCardData{}, fmt.Errorf("flashcarddeck: load accessible card: %w", err)
	}
	return card, nil
}

// UpdateDeck updates metadata for a learner-owned deck.
func (s *Store) UpdateDeck(ctx context.Context, userID, deckID string, input UpdateDeckInput) (*Deck, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)
	// Verify ownership
	const ownerQ = `SELECT id FROM learning.deck WHERE id = $1 AND owner_user_id = $2 AND status != 'archived' FOR UPDATE`
	var exists string
	if err := tx.QueryRow(ctx, ownerQ, deckID, userID).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotOwner
		}
		return nil, fmt.Errorf("flashcarddeck: verify ownership: %w", err)
	}
	// Apply only supplied metadata fields.
	if input.Name != nil {
		if _, err := tx.Exec(ctx, `UPDATE learning.deck SET title_vi=$3,updated_at=NOW() WHERE id=$1 AND owner_user_id=$2`, deckID, userID, *input.Name); err != nil {
			return nil, fmt.Errorf("flashcarddeck: update name: %w", err)
		}
	}
	if input.TitleJa != nil {
		if _, err := tx.Exec(ctx, `UPDATE learning.deck SET title_ja=$3,updated_at=NOW() WHERE id=$1 AND owner_user_id=$2`, deckID, userID, nullIfEmpty(*input.TitleJa)); err != nil {
			return nil, fmt.Errorf("flashcarddeck: update Japanese title: %w", err)
		}
	}
	if input.Description != nil {
		if _, err := tx.Exec(ctx, `UPDATE learning.deck SET description_vi=$3,updated_at=NOW() WHERE id=$1 AND owner_user_id=$2`, deckID, userID, nullIfEmpty(*input.Description)); err != nil {
			return nil, fmt.Errorf("flashcarddeck: update description: %w", err)
		}
	}
	if input.Visibility != nil {
		visibility := *input.Visibility
		if visibility != "public" {
			visibility = "private"
		}
		if _, err := tx.Exec(ctx, `UPDATE learning.deck SET visibility=$3,updated_at=NOW() WHERE id=$1 AND owner_user_id=$2`, deckID, userID, visibility); err != nil {
			return nil, fmt.Errorf("flashcarddeck: update visibility: %w", err)
		}
	}
	if input.Cards != nil {
		cards := append([]DeckCardInput(nil), (*input.Cards)...)
		for i := range cards {
			if cards[i].CardID == "" {
				continue
			}
			original, err := loadDeckCard(ctx, tx, userID, deckID, cards[i].CardID)
			if err != nil {
				return nil, err
			}
			if strings.TrimSpace(cards[i].FrontText) == "" {
				cards[i].FrontText = original.FrontText
			}
			if strings.TrimSpace(cards[i].BackText) == "" {
				cards[i].BackText = original.BackText
			}
			if cards[i].Reading == nil {
				cards[i].Reading = original.Reading
			}
			newReading := ""
			if cards[i].Reading != nil {
				newReading = *cards[i].Reading
			}
			oldReading := ""
			if original.Reading != nil {
				oldReading = *original.Reading
			}
			if original.FrontText == cards[i].FrontText && original.BackText == cards[i].BackText && oldReading == newReading {
				continue
			}
			if original.SourceType == "custom" && original.SourceID == deckID {
				if _, err := tx.Exec(ctx, `UPDATE learning.flashcard_variant SET front_text=$2,back_text=$3,reading=$4,updated_at=NOW() WHERE id=$1`, cards[i].CardID, cards[i].FrontText, cards[i].BackText, nullIfEmpty(newReading)); err != nil {
					return nil, fmt.Errorf("flashcarddeck: update custom card: %w", err)
				}
				continue
			}
			// Keep canonical/shared variants unchanged; create a deck-owned copy for edited text.
			cards[i].CardID = ""
		}
		if _, err := tx.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id=$1`, deckID); err != nil {
			return nil, fmt.Errorf("flashcarddeck: replace deck cards: %w", err)
		}
		if err := insertDeckCards(ctx, tx, userID, deckID, cards); err != nil {
			return nil, err
		}
		if err := archiveOrphanedCustomCards(ctx, tx, deckID); err != nil {
			return nil, err
		}
	}
	// Return updated deck
	const getQ = `SELECT d.id, d.owner_user_id, d.title_vi, d.title_ja, d.description_vi, d.description_ja, d.visibility, d.status, d.share_token, d.created_at, d.updated_at,
		(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count
	FROM learning.deck d WHERE d.id = $1`
	var d Deck
	if err := tx.QueryRow(ctx, getQ, deckID).Scan(&d.ID, &d.UserID, &d.Name, &d.TitleJa, &d.Description, &d.DescriptionJa, &d.Visibility, &d.Status, &d.ShareToken, &d.CreatedAt, &d.UpdatedAt, &d.CardCount); err != nil {
		return nil, fmt.Errorf("flashcarddeck: reload deck: %w", err)
	}
	d.Count.Cards = d.CardCount
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return &d, nil
}

func archiveOrphanedCustomCards(ctx context.Context, tx pgx.Tx, deckID string) error {
	const q = `UPDATE learning.flashcard_variant fv SET status='archived',updated_at=NOW()
		WHERE fv.source_type='custom' AND fv.source_id=$1 AND fv.status='active'
		AND NOT EXISTS (SELECT 1 FROM learning.deck_card dc WHERE dc.card_id=fv.id)`
	if _, err := tx.Exec(ctx, q, deckID); err != nil {
		return fmt.Errorf("flashcarddeck: archive orphaned custom cards: %w", err)
	}
	return nil
}

func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
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
	const ownerQ = `SELECT id FROM learning.deck WHERE id = $1 AND owner_user_id = $2 AND status != 'archived'`
	var exists string
	if err := tx.QueryRow(ctx, ownerQ, deckID, userID).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotOwner
		}
		return fmt.Errorf("flashcarddeck: verify ownership: %w", err)
	}
	// Archive the deck
	const archiveQ = `UPDATE learning.deck SET status = 'archived', updated_at = NOW() WHERE id = $1`
	if _, err := tx.Exec(ctx, archiveQ, deckID); err != nil {
		return fmt.Errorf("flashcarddeck: archive deck: %w", err)
	}
	// Remove deck-card links
	const unlinkQ = `DELETE FROM learning.deck_card WHERE deck_id = $1`
	if _, err := tx.Exec(ctx, unlinkQ, deckID); err != nil {
		return fmt.Errorf("flashcarddeck: unlink cards: %w", err)
	}
	if err := archiveOrphanedCustomCards(ctx, tx, deckID); err != nil {
		return err
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
	const ownerQ = `SELECT share_token FROM learning.deck WHERE id = $1 AND owner_user_id = $2 AND status != 'archived'`
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
	token, err := generateShareToken()
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: generate share token: %w", err)
	}
	const updateQ = `UPDATE learning.deck SET share_token = $3, updated_at = NOW() WHERE id = $1 AND owner_user_id = $2`
	if _, err := s.db.Exec(ctx, updateQ, deckID, userID, token); err != nil {
		return nil, fmt.Errorf("flashcarddeck: set share token: %w", err)
	}
	return &token, nil
}

// UnshareDeck removes the share token from a learner-owned deck.
func (s *Store) UnshareDeck(ctx context.Context, userID, deckID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `UPDATE learning.deck SET share_token = NULL, updated_at = NOW()
		WHERE id = $1 AND owner_user_id = $2 AND status != 'archived'`
	result, err := s.db.Exec(ctx, q, deckID, userID)
	if err != nil {
		return fmt.Errorf("flashcarddeck: unshare deck: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotOwner
	}
	return nil
}

// GetSharedDeckPreview returns only public fields for an active shared deck.
func (s *Store) GetSharedDeckPreview(ctx context.Context, token string) (*SharedDeckPreview, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	preview := &SharedDeckPreview{SampleCards: []SharedDeckPreviewCard{}}
	const deckQ = `SELECT d.title_vi, d.title_ja, d.description_vi, d.description_ja,
		(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id), d.clone_count
		FROM learning.deck d WHERE d.share_token = $1 AND d.status = 'active'`
	if err := s.db.QueryRow(ctx, deckQ, token).Scan(&preview.TitleVi, &preview.TitleJa, &preview.DescriptionVi, &preview.DescriptionJa, &preview.CardCount, &preview.CloneCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("flashcarddeck: get shared preview: %w", err)
	}
	const sampleQ = `SELECT fv.front_text, fv.reading
		FROM learning.deck d JOIN learning.deck_card dc ON dc.deck_id = d.id
		JOIN learning.flashcard_variant fv ON fv.id = dc.card_id
		WHERE d.share_token = $1 AND d.status = 'active' AND fv.status = 'active'
		ORDER BY dc.position, dc.id LIMIT 5`
	rows, err := s.db.Query(ctx, sampleQ, token)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: list shared preview samples: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var card SharedDeckPreviewCard
		if err := rows.Scan(&card.FrontText, &card.Reading); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan shared preview sample: %w", err)
		}
		preview.SampleCards = append(preview.SampleCards, card)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("flashcarddeck: iterate shared preview samples: %w", err)
	}
	return preview, nil
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
	const findQ = `SELECT id, title_vi, description_vi FROM learning.deck WHERE share_token = $1 AND status != 'archived'`
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
	const createQ = `INSERT INTO learning.deck (owner_user_id, title_vi, description_vi, visibility, status, source_deck_id, updated_at)
		VALUES ($1, $2, $3, 'private', 'active', $4, NOW()) RETURNING id, created_at, updated_at`
	var d Deck
	d.UserID = &userID
	d.Name = clonedName
	d.Description = srcDesc
	d.Status = "active"
	if err := tx.QueryRow(ctx, createQ, userID, clonedName, srcDesc, srcID).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create cloned deck: %w", err)
	}
	// Copy deck-card links
	const copyLinksQ = `INSERT INTO learning.deck_card (deck_id, card_id, position)
		SELECT $1, card_id, position FROM learning.deck_card WHERE deck_id = $2`
	if _, err := tx.Exec(ctx, copyLinksQ, d.ID, srcID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: copy deck-card links: %w", err)
	}
	// Create user_flashcard entries for new cards
	const createUserFlashcardsQ = `INSERT INTO learning.user_flashcard (user_id, card_id, state, due_at, updated_at)
		SELECT $1, dc.card_id, 'new', NOW(), NOW()
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
	if _, err := tx.Exec(ctx, `UPDATE learning.deck SET clone_count = clone_count + 1 WHERE id = $1`, srcID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: increment source clone count: %w", err)
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
	jlptLevels, kanjiLevels := normalizeLevels(input.Levels)
	const q = `SELECT COUNT(*) FROM learning.flashcard_variant fv
		WHERE fv.status = 'active'
		AND ($1::text[] IS NULL OR fv.source_type = ANY($1))
		AND ((fv.source_type='lexeme' AND EXISTS (SELECT 1 FROM content.lexeme l WHERE l.id=fv.source_id AND l.status='active' AND ($2::text[] IS NULL OR l.jlpt_level=ANY($2)))) OR
			(fv.source_type='grammar' AND EXISTS (SELECT 1 FROM content.grammar_point g WHERE g.id=fv.source_id AND g.status='active' AND ($2::text[] IS NULL OR g.jlpt_level=ANY($2)))) OR
			(fv.source_type='kanji' AND EXISTS (SELECT 1 FROM content.kanji k WHERE k.id=fv.source_id AND k.status='active' AND ($3::int[] IS NULL OR k.level=ANY($3)))) )`
	var count int
	if err := s.db.QueryRow(ctx, q, input.SourceTypes, jlptLevels, kanjiLevels).Scan(&count); err != nil {
		return nil, fmt.Errorf("flashcarddeck: preview count: %w", err)
	}
	return &PreviewCountResult{AvailableCount: count}, nil
}

func normalizeLevels(levels []string) ([]string, []int) {
	if len(levels) == 0 {
		return nil, nil
	}
	jlptSet := make(map[string]struct{})
	kanjiSet := make(map[int]struct{})
	for _, raw := range levels {
		level := strings.ToUpper(strings.TrimSpace(raw))
		level = strings.TrimSuffix(level, "+")
		digits := strings.TrimLeft(level, "JN")
		if digits == "" {
			digits = level
		}
		var n int
		if _, err := fmt.Sscanf(digits, "%d", &n); err != nil || n < 1 || n > 5 {
			continue
		}
		kanjiSet[n] = struct{}{}
		jlptSet[fmt.Sprintf("N%d", n)] = struct{}{}
		jlptSet[fmt.Sprintf("J%d", n)] = struct{}{}
	}
	if len(jlptSet) == 0 {
		return nil, nil
	}
	jlptLevels := make([]string, 0, len(jlptSet))
	for level := range jlptSet {
		jlptLevels = append(jlptLevels, level)
	}
	kanjiLevels := make([]int, 0, len(kanjiSet))
	for level := range kanjiSet {
		kanjiLevels = append(kanjiLevels, level)
	}
	return jlptLevels, kanjiLevels
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
	const createQ = `INSERT INTO learning.deck (owner_user_id, title_vi, visibility, status, updated_at)
		VALUES ($1, $2, 'private', 'active', NOW()) RETURNING id, created_at, updated_at`
	var d Deck
	d.UserID = &input.UserID
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
	jlptLevels, kanjiLevels := normalizeLevels(input.Levels)
	const selectQ = `SELECT fv.id,fv.source_type,fv.source_id,fv.front_text,fv.back_text,fv.reading FROM learning.flashcard_variant fv
		WHERE fv.status = 'active'
		AND ($1::text[] IS NULL OR fv.source_type = ANY($1))
		AND ((fv.source_type='lexeme' AND EXISTS (SELECT 1 FROM content.lexeme l WHERE l.id=fv.source_id AND l.status='active' AND ($2::text[] IS NULL OR l.jlpt_level=ANY($2)))) OR
			(fv.source_type='grammar' AND EXISTS (SELECT 1 FROM content.grammar_point g WHERE g.id=fv.source_id AND g.status='active' AND ($2::text[] IS NULL OR g.jlpt_level=ANY($2)))) OR
			(fv.source_type='kanji' AND EXISTS (SELECT 1 FROM content.kanji k WHERE k.id=fv.source_id AND k.status='active' AND ($3::int[] IS NULL OR k.level=ANY($3)))) )
		ORDER BY RANDOM() LIMIT $4`
	rows, err := tx.Query(ctx, selectQ, input.SourceTypes, jlptLevels, kanjiLevels, limit)
	if err != nil {
		return nil, fmt.Errorf("flashcarddeck: select variants: %w", err)
	}
	defer rows.Close()
	type variant struct {
		id, sourceType, sourceID, front, back string
		reading                               *string
	}
	var variants []variant
	for rows.Next() {
		var v variant
		if err := rows.Scan(&v.id, &v.sourceType, &v.sourceID, &v.front, &v.back, &v.reading); err != nil {
			return nil, fmt.Errorf("flashcarddeck: scan variant: %w", err)
		}
		variants = append(variants, v)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("flashcarddeck: iterate variants: %w", err)
	}
	rows.Close()
	// Insert deck-card links and user_flashcard entries
	for i, v := range variants {
		cardID := v.id
		reverse := input.Direction == "vn_to_jp" || (input.Direction == "both" && i%2 == 1)
		if reverse {
			const cloneQ = `INSERT INTO learning.flashcard_variant (source_type,source_id,front_text,back_text,reading,status,updated_at)
				VALUES ($1,$2,$3,$4,$5,'active',NOW()) RETURNING id`
			if err := tx.QueryRow(ctx, cloneQ, v.sourceType, v.sourceID, v.back, v.front, v.reading).Scan(&cardID); err != nil {
				return nil, fmt.Errorf("flashcarddeck: create reversed card: %w", err)
			}
		}
		const linkQ = `INSERT INTO learning.deck_card (deck_id, card_id, position) VALUES ($1, $2, $3)`
		if _, err := tx.Exec(ctx, linkQ, d.ID, cardID, i); err != nil {
			return nil, fmt.Errorf("flashcarddeck: link card: %w", err)
		}
		const ufQ = `INSERT INTO learning.user_flashcard (user_id, card_id, state, due_at, updated_at)
			VALUES ($1, $2, 'new', NOW(), NOW()) ON CONFLICT (user_id, card_id) DO NOTHING`
		if _, err := tx.Exec(ctx, ufQ, input.UserID, cardID); err != nil {
			return nil, fmt.Errorf("flashcarddeck: create user flashcard: %w", err)
		}
	}
	d.CardCount = len(variants)
	d.Count.Cards = d.CardCount
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
		AND ((source_type='lexeme' AND EXISTS (SELECT 1 FROM content.lexeme l WHERE l.id=source_id AND l.status='active')) OR
			(source_type='grammar' AND EXISTS (SELECT 1 FROM content.grammar_point g WHERE g.id=source_id AND g.status='active')) OR
			(source_type='kanji' AND EXISTS (SELECT 1 FROM content.kanji k WHERE k.id=source_id AND k.status='active')))
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
	var owned bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM learning.deck WHERE id=$1 AND owner_user_id=$2 AND status='active')`, input.DeckID, input.UserID).Scan(&owned); err != nil {
		return nil, fmt.Errorf("flashcarddeck: verify deck ownership: %w", err)
	}
	if !owned {
		return nil, ErrNotOwner
	}
	var canonicalSource bool
	if err := tx.QueryRow(ctx, `SELECT
		($1='lexeme' AND EXISTS (SELECT 1 FROM content.lexeme WHERE id=$2 AND status='active')) OR
		($1='grammar' AND EXISTS (SELECT 1 FROM content.grammar_point WHERE id=$2 AND status='active')) OR
		($1='kanji' AND EXISTS (SELECT 1 FROM content.kanji WHERE id=$2 AND status='active')) OR
		($1='magazine_vocab' AND EXISTS (SELECT 1 FROM daily.magazine_vocab_item v
			JOIN daily.magazine_article a ON a.id=v.article_id WHERE v.id=$2 AND a.status='published'))`, input.SourceType, input.SourceID).Scan(&canonicalSource); err != nil {
		return nil, fmt.Errorf("flashcarddeck: verify canonical source: %w", err)
	}
	if !canonicalSource {
		return nil, ErrNotFound
	}
	// Keep card text private to this learner's deck; the validated canonical row is only its source.
	const insertQ = `INSERT INTO learning.flashcard_variant (source_type, source_id, front_text, back_text, reading, status, updated_at)
		VALUES ('custom', $1, $2, $3, $4, 'active', NOW()) RETURNING id`
	var variantID string
	if err := tx.QueryRow(ctx, insertQ, input.DeckID, input.FrontText, input.BackText, input.Reading).Scan(&variantID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create variant: %w", err)
	}
	// Link to deck
	const linkQ = `INSERT INTO learning.deck_card (deck_id, card_id, position)
		VALUES ($1, $2, COALESCE((SELECT MAX(position)+1 FROM learning.deck_card WHERE deck_id = $1), 0))`
	if _, err := tx.Exec(ctx, linkQ, input.DeckID, variantID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: link to deck: %w", err)
	}
	// Create user flashcard entry
	const ufQ = `INSERT INTO learning.user_flashcard (user_id, card_id, state, due_at, updated_at)
		VALUES ($1, $2, 'new', NOW(), NOW()) ON CONFLICT (user_id, card_id) DO NOTHING`
	if _, err := tx.Exec(ctx, ufQ, input.UserID, variantID); err != nil {
		return nil, fmt.Errorf("flashcarddeck: create user flashcard: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("flashcarddeck: commit: %w", err)
	}
	return &SuggestedCard{
		VariantID:  variantID,
		SourceType: "custom",
		SourceID:   input.DeckID,
		FrontText:  input.FrontText,
		BackText:   input.BackText,
		Reading:    input.Reading,
	}, nil
}

func generateShareToken() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}
