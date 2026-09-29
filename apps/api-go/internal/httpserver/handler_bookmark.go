// Package httpserver provides HTTP handlers for bookmark endpoints.
package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

const (
	// maxBookmarkBodyBytes bounds JSON body size for bookmark endpoints.
	maxBookmarkBodyBytes = 1024

	// defaultBookmarkLimit is the default number of bookmarks returned per list request.
	defaultBookmarkLimit = 20

	// maxBookmarkLimit caps the limit parameter to prevent unbounded queries.
	maxBookmarkLimit = 100
)

// validBookmarkTypes enumerates accepted target_type values after normalization.
var validBookmarkTypes = map[string]bool{
	"lexeme":  true,
	"kanji":   true,
	"grammar": true,
}

// normalizeBookmarkType maps user-facing type names to canonical DB values.
// "word" is normalized to "lexeme" to match the NestJS service contract.
func normalizeBookmarkType(t string) string {
	t = strings.ToLower(strings.TrimSpace(t))
	if t == "word" {
		return "lexeme"
	}
	return t
}

// bookmarkResponse is the JSON shape returned by toggle and check endpoints.
type bookmarkResponse struct {
	Bookmarked bool    `json:"bookmarked"`
	BookmarkID *string `json:"bookmarkId,omitempty"`
	TargetID   string  `json:"targetId"`
	Type       string  `json:"type"`
}

// bookmarkListResponse is the JSON shape returned by list endpoints.
type bookmarkListResponse struct {
	Items []bookmarkItem `json:"items"`
	Limit int            `json:"limit"`
	Type  string         `json:"type"`
}

// bookmarkItem represents a single bookmark in list responses.
type bookmarkItem struct {
	ID        string    `json:"id"`
	TargetID  string    `json:"targetId"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"createdAt"`
}

// toggleBookmarkHandler implements POST /api/bookmarks/{type}/{id}.
// Idempotent toggle: creates bookmark if absent, deletes if present.
func toggleBookmarkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		rawType := chi.URLParam(r, "type")
		targetID := chi.URLParam(r, "id")

		targetType := normalizeBookmarkType(rawType)
		if !validBookmarkTypes[targetType] {
			writeJSONError(w, "invalid bookmark type", http.StatusBadRequest)
			return
		}
		if targetID == "" {
			writeJSONError(w, "target id is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Check for existing bookmark.
		existingID, err := lookupBookmark(ctx, db, identity.UserID, targetType, targetID)
		if err != nil {
			logger.Error("toggle bookmark: lookup failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		if existingID != "" {
			// Delete existing bookmark.
			if err := deleteBookmark(ctx, db, existingID); err != nil {
				logger.Error("toggle bookmark: delete failed", "error", err, "bookmark_id", existingID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(bookmarkResponse{
				Bookmarked: false,
				TargetID:   targetID,
				Type:       rawType,
			})
			return
		}

		// Create new bookmark.
		bookmarkID, err := createBookmark(ctx, db, identity.UserID, targetType, targetID)
		if err != nil {
			// Handle unique constraint race condition.
			if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
				// Another request created it concurrently; treat as already bookmarked.
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(bookmarkResponse{
					Bookmarked: true,
					TargetID:   targetID,
					Type:       rawType,
				})
				return
			}
			logger.Error("toggle bookmark: create failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(bookmarkResponse{
			Bookmarked: true,
			BookmarkID: &bookmarkID,
			TargetID:   targetID,
			Type:       rawType,
		})
	}
}

// checkBookmarkHandler implements GET /api/bookmarks/check/{type}/{id}.
// Returns whether the current learner has bookmarked the target.
func checkBookmarkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		rawType := chi.URLParam(r, "type")
		targetID := chi.URLParam(r, "id")

		targetType := normalizeBookmarkType(rawType)
		if !validBookmarkTypes[targetType] {
			writeJSONError(w, "invalid bookmark type", http.StatusBadRequest)
			return
		}
		if targetID == "" {
			writeJSONError(w, "target id is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		existingID, err := lookupBookmark(ctx, db, identity.UserID, targetType, targetID)
		if err != nil {
			logger.Error("check bookmark: lookup failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		resp := bookmarkResponse{
			Bookmarked: existingID != "",
			TargetID:   targetID,
			Type:       rawType,
		}
		if existingID != "" {
			resp.BookmarkID = &existingID
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// listBookmarksHandler returns a handler for listing bookmarks by type.
// Implements GET /api/bookmarks/words, /api/bookmarks/kanji, /api/bookmarks/grammar.
func listBookmarksHandler(db *pgxpool.Pool, targetType string, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		limit := defaultBookmarkLimit
		if l := r.URL.Query().Get("limit"); l != "" {
			parsed, err := strconv.Atoi(l)
			if err != nil || parsed < 1 {
				writeJSONError(w, "invalid limit parameter", http.StatusBadRequest)
				return
			}
			limit = parsed
			if limit > maxBookmarkLimit {
				limit = maxBookmarkLimit
			}
		}

		ctx := r.Context()

		items, err := listBookmarks(ctx, db, identity.UserID, targetType, limit)
		if err != nil {
			logger.Error("list bookmarks: query failed", "error", err, "user_id", identity.UserID, "type", targetType)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(bookmarkListResponse{
			Items: items,
			Limit: limit,
			Type:  targetType,
		})
	}
}

// DB helper functions.

func lookupBookmark(ctx context.Context, db *pgxpool.Pool, userID, targetType, targetID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id FROM learner.bookmark WHERE user_id = $1 AND target_type = $2 AND target_id = $3`
	var id string
	err := db.QueryRow(ctx, q, userID, targetType, targetID).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("lookup bookmark: %w", err)
	}
	return id, nil
}

func createBookmark(ctx context.Context, db *pgxpool.Pool, userID, targetType, targetID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO learner.bookmark (user_id, target_type, target_id) VALUES ($1, $2, $3) RETURNING id`
	var id string
	err := db.QueryRow(ctx, q, userID, targetType, targetID).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create bookmark: %w", err)
	}
	return id, nil
}

func deleteBookmark(ctx context.Context, db *pgxpool.Pool, bookmarkID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `DELETE FROM learner.bookmark WHERE id = $1`
	_, err := db.Exec(ctx, q, bookmarkID)
	if err != nil {
		return fmt.Errorf("delete bookmark: %w", err)
	}
	return nil
}

func listBookmarks(ctx context.Context, db *pgxpool.Pool, userID, targetType string, limit int) ([]bookmarkItem, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, target_id, target_type, created_at FROM learner.bookmark
	           WHERE user_id = $1 AND target_type = $2 ORDER BY created_at DESC LIMIT $3`
	rows, err := db.Query(ctx, q, userID, targetType, limit)
	if err != nil {
		return nil, fmt.Errorf("list bookmarks: %w", err)
	}
	defer rows.Close()

	var items []bookmarkItem
	for rows.Next() {
		var item bookmarkItem
		if err := rows.Scan(&item.ID, &item.TargetID, &item.Type, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan bookmark: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}
	if items == nil {
		items = []bookmarkItem{}
	}
	return items, nil
}
