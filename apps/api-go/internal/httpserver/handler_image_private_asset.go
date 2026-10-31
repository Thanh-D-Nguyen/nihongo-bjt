package httpserver

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// getPrivateImageAssetHandler implements GET /api/media/{id}/private-preview.
//
// Rehosted provider images stay pending_review until their rights are cleared,
// so the public stream route denies them. This route lets the learner who
// selected one keep seeing it on their own cards; everyone else gets 404.
func getPrivateImageAssetHandler(db *pgxpool.Pool, bucket *blob.Bucket, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if db == nil || bucket == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		id := chi.URLParam(r, "id")
		if !isValidUUID(id) {
			writeJSONError(w, "invalid asset id", http.StatusBadRequest)
			return
		}
		var key, mimeType string
		var createdAt time.Time
		err := db.QueryRow(r.Context(), `SELECT object_key, mime_type, created_at FROM media.asset
			WHERE id=$1 AND owner_user_id=$2 AND rights_status='pending_review' AND mime_type LIKE 'image/%'
			AND ((status='pending_review' AND provider IN ('pixabay','pexels','wikimedia')) OR
			(status='active' AND provider='local' AND (provenance->>'flashcardPendingRights'='true' OR EXISTS (SELECT 1 FROM learning.card_media_link WHERE asset_id=media.asset.id AND role='primary_image'))))`,
			id, identity.UserID).Scan(&key, &mimeType, &createdAt)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("private image preview: query failed", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		reader, err := bucket.NewReader(r.Context(), key, nil)
		if err != nil {
			if gcerrors.Code(err) == gcerrors.NotFound {
				writeJSONError(w, "not found", http.StatusNotFound)
				return
			}
			logger.Error("private image preview: open blob failed", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer reader.Close()
		w.Header().Set("Content-Type", mimeType)
		w.Header().Set("Content-Disposition", "inline")
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeContent(w, r, key, createdAt, reader)
	}
}
