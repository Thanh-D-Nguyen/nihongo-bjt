package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/authn"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/flashcarddeck"
)

func reportDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		deckID := extractPathParam(r.URL.Path, "decks", 1)
		if _, err := uuid.Parse(deckID); err != nil {
			writeJSONError(w, "invalid deckId", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil || (req.Reason != "spam" && req.Reason != "abuse" && req.Reason != "sexual" && req.Reason != "other") {
			writeJSONError(w, "invalid reason", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid body", http.StatusBadRequest)
			return
		}
		if err := store.ReportDeck(r.Context(), identity.UserID, deckID, req.Reason); err != nil {
			writeDeckModerationError(w, logger, "report deck", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func blockDeckAuthorHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		deckID := extractPathParam(r.URL.Path, "decks", 1)
		if _, err := uuid.Parse(deckID); err != nil {
			writeJSONError(w, "invalid deckId", http.StatusBadRequest)
			return
		}
		if err := store.BlockDeckAuthor(r.Context(), identity.UserID, deckID); err != nil {
			writeDeckModerationError(w, logger, "block deck author", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func writeDeckModerationError(w http.ResponseWriter, logger *slog.Logger, operation string, err error) {
	if errors.Is(err, flashcarddeck.ErrNotFound) {
		writeJSONError(w, "deck not found", http.StatusNotFound)
		return
	}
	logger.Error(operation, "error", err)
	writeJSONError(w, "internal error", http.StatusInternalServerError)
}
