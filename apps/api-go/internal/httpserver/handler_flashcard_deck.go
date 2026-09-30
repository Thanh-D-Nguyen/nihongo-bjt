package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

// listDecksHandler implements GET /api/flashcards/decks.
func listDecksHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		limit := 80
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		decks, err := store.ListDecks(r.Context(), identity.UserID, limit)
		if err != nil {
			logger.Error("list decks", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(decks)
	}
}

// createDeckHandler implements POST /api/flashcards/decks.
func createDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name        string  `json:"name"`
			Description *string `json:"description,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			writeJSONError(w, "name is required", http.StatusBadRequest)
			return
		}
		deck, err := store.CreateDeck(r.Context(), flashcarddeck.CreateDeckInput{
			UserID:      identity.UserID,
			Name:        req.Name,
			Description: req.Description,
		})
		if err != nil {
			logger.Error("create deck", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(deck)
	}
}

// updateDeckHandler implements PATCH /api/flashcards/decks/{deckId}.
func updateDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		deckID := extractPathParam(r.URL.Path, "decks", 1)
		if deckID == "" {
			writeJSONError(w, "deckId required", http.StatusBadRequest)
			return
		}
		var req struct {
			Name        *string `json:"name,omitempty"`
			Description *string `json:"description,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		deck, err := store.UpdateDeck(r.Context(), identity.UserID, deckID, flashcarddeck.UpdateDeckInput{
			Name:        req.Name,
			Description: req.Description,
		})
		if err != nil {
			if errors.Is(err, flashcarddeck.ErrNotOwner) {
				writeJSONError(w, "not owner", http.StatusForbidden)
				return
			}
			logger.Error("update deck", "error", err, "deck_id", deckID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(deck)
	}
}

// archiveDeckHandler implements DELETE /api/flashcards/decks/{deckId} and POST /api/flashcards/decks/{deckId}/archive.
func archiveDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		deckID := extractPathParam(r.URL.Path, "decks", 1)
		if deckID == "" {
			writeJSONError(w, "deckId required", http.StatusBadRequest)
			return
		}
		if err := store.ArchiveDeck(r.Context(), identity.UserID, deckID); err != nil {
			if errors.Is(err, flashcarddeck.ErrNotOwner) {
				writeJSONError(w, "not owner", http.StatusForbidden)
				return
			}
			logger.Error("archive deck", "error", err, "deck_id", deckID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"archived": true})
	}
}

// shareDeckHandler implements POST /api/flashcards/decks/{deckId}/share.
func shareDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		deckID := extractPathParam(r.URL.Path, "decks", 1)
		if deckID == "" {
			writeJSONError(w, "deckId required", http.StatusBadRequest)
			return
		}
		token, err := store.ShareDeck(r.Context(), identity.UserID, deckID)
		if err != nil {
			if errors.Is(err, flashcarddeck.ErrNotOwner) {
				writeJSONError(w, "not owner", http.StatusForbidden)
				return
			}
			logger.Error("share deck", "error", err, "deck_id", deckID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"shareToken": *token})
	}
}

// unshareDeckHandler implements DELETE /api/flashcards/decks/{deckId}/share.
func unshareDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		deckID := extractPathParam(r.URL.Path, "decks", 1)
		if deckID == "" {
			writeJSONError(w, "deckId required", http.StatusBadRequest)
			return
		}
		if err := store.UnshareDeck(r.Context(), identity.UserID, deckID); err != nil {
			if errors.Is(err, flashcarddeck.ErrNotOwner) {
				writeJSONError(w, "not owner", http.StatusForbidden)
				return
			}
			logger.Error("unshare deck", "error", err, "deck_id", deckID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"unshared": true})
	}
}

// cloneDeckHandler implements POST /api/flashcards/decks/clone/{token}.
func cloneDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Extract token from path: .../clone/{token}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var token string
		for i, p := range parts {
			if p == "clone" && i+1 < len(parts) {
				token = parts[i+1]
				break
			}
		}
		if token == "" {
			writeJSONError(w, "share token required", http.StatusBadRequest)
			return
		}
		deck, err := store.CloneDeck(r.Context(), identity.UserID, token)
		if err != nil {
			if errors.Is(err, flashcarddeck.ErrNotFound) {
				writeJSONError(w, "deck not found or invalid token", http.StatusNotFound)
				return
			}
			logger.Error("clone deck", "error", err, "token", token)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(deck)
	}
}

// generateDeckHandler implements POST /api/flashcards/decks/generate.
func generateDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name        string   `json:"name"`
			SourceTypes []string `json:"sourceTypes"`
			Levels      []string `json:"levels"`
			Limit       int      `json:"limit"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			writeJSONError(w, "name is required", http.StatusBadRequest)
			return
		}
		deck, err := store.GenerateDeck(r.Context(), flashcarddeck.GenerateDeckInput{
			UserID:      identity.UserID,
			Name:        req.Name,
			SourceTypes: req.SourceTypes,
			Levels:      req.Levels,
			Limit:       req.Limit,
		})
		if err != nil {
			logger.Error("generate deck", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(deck)
	}
}

// previewGenerateCountHandler implements POST /api/flashcards/decks/generate/preview.
func previewGenerateCountHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			SourceTypes []string `json:"sourceTypes"`
			Levels      []string `json:"levels"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		result, err := store.PreviewGenerateCount(r.Context(), flashcarddeck.GenerateDeckInput{
			UserID:      identity.UserID,
			SourceTypes: req.SourceTypes,
			Levels:      req.Levels,
		})
		if err != nil {
			logger.Error("preview generate count", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}

// suggestCardsHandler implements POST /api/flashcards/cards/suggest.
func suggestCardsHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Query       string   `json:"query"`
			SourceTypes []string `json:"sourceTypes"`
			Limit       int      `json:"limit"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		cards, err := store.SuggestCards(r.Context(), flashcarddeck.SuggestCardsInput{
			UserID:      identity.UserID,
			Query:       req.Query,
			SourceTypes: req.SourceTypes,
			Limit:       req.Limit,
		})
		if err != nil {
			logger.Error("suggest cards", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(cards)
	}
}

// createCardFromContentHandler implements POST /api/flashcards/cards/from-content.
func createCardFromContentHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			DeckID     string  `json:"deckId"`
			SourceType string  `json:"sourceType"`
			SourceID   string  `json:"sourceId"`
			FrontText  string  `json:"frontText"`
			BackText   string  `json:"backText"`
			Reading    *string `json:"reading,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.DeckID == "" || req.SourceType == "" || req.SourceID == "" || req.FrontText == "" || req.BackText == "" {
			writeJSONError(w, "deckId, sourceType, sourceId, frontText, backText are required", http.StatusBadRequest)
			return
		}
		card, err := store.CreateCardFromContent(r.Context(), flashcarddeck.CreateCardFromContentInput{
			UserID:     identity.UserID,
			DeckID:     req.DeckID,
			SourceType: req.SourceType,
			SourceID:   req.SourceID,
			FrontText:  req.FrontText,
			BackText:   req.BackText,
			Reading:    req.Reading,
		})
		if err != nil {
			logger.Error("create card from content", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(card)
	}
}

// extractPathParam extracts a parameter after a known segment in the URL path.
// offset indicates how many segments after the marker to return (1 = next segment).
func extractPathParam(path, marker string, offset int) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	for i, p := range parts {
		if p == marker && i+offset < len(parts) {
			return parts[i+offset]
		}
	}
	return ""
}