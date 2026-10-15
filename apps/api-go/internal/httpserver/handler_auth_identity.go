package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type learnerIdentity struct {
	ID          string  `json:"id"`
	Provider    string  `json:"provider"`
	EmailAtLink *string `json:"emailAtLink"`
	CreatedAt   string  `json:"createdAt"`
}

func listLearnerIdentitiesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		rows, err := db.Query(r.Context(), `SELECT id, provider, email_at_link, created_at FROM auth.identity_provider_account WHERE user_id=$1 ORDER BY created_at DESC, id`, identity.UserID)
		if err != nil {
			logger.Error("list learner identities", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := make([]learnerIdentity, 0)
		for rows.Next() {
			var item learnerIdentity
			var createdAt time.Time
			if err := rows.Scan(&item.ID, &item.Provider, &item.EmailAtLink, &createdAt); err != nil {
				logger.Error("scan learner identity", "error", err, "user_id", identity.UserID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			item.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate learner identities", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(items)
	}
}

func deleteLearnerIdentityHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeJSONError(w, "invalid identity id", http.StatusBadRequest)
			return
		}
		result, err := db.Exec(r.Context(), `DELETE FROM auth.identity_provider_account WHERE id=$1 AND user_id=$2`, id, identity.UserID)
		if err != nil {
			logger.Error("delete learner identity", "error", err, "user_id", identity.UserID, "identity_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
