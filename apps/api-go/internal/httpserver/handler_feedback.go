package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"net/mail"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

const maxFeedbackBodyBytes = 8 * 1024

func feedbackHandler(db *pgxpool.Pool, limiter *authn.RateLimiter, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil || limiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, maxFeedbackBodyBytes+1))
		if err != nil || len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxFeedbackBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		decoder := json.NewDecoder(strings.NewReader(string(body)))
		decoder.DisallowUnknownFields()
		var req struct {
			Name     string `json:"name"`
			Email    string `json:"email"`
			Category string `json:"category"`
			Message  string `json:"message"`
		}
		if err := decoder.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		req.Email = strings.TrimSpace(req.Email)
		req.Category = strings.TrimSpace(req.Category)
		req.Message = strings.TrimSpace(req.Message)
		if len(req.Name) > 100 || len(req.Email) > 254 || len(req.Message) == 0 || len(req.Message) > 5000 {
			writeJSONError(w, "invalid feedback", http.StatusBadRequest)
			return
		}
		if req.Email != "" {
			address, err := mail.ParseAddress(req.Email)
			if err != nil || address.Address != req.Email {
				writeJSONError(w, "invalid feedback", http.StatusBadRequest)
				return
			}
		}
		switch req.Category {
		case "bug", "feature", "content", "other":
		default:
			writeJSONError(w, "invalid feedback", http.StatusBadRequest)
			return
		}
		allowed, err := limiter.Allow("ip:feedback:" + requestClientIP(r))
		if err != nil || !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		var id string
		if err := db.QueryRow(r.Context(), `INSERT INTO ops.feedback_submission (name,email,category,message) VALUES (NULLIF($1,''),NULLIF($2,''),$3,$4) RETURNING id`, req.Name, req.Email, req.Category, req.Message).Scan(&id); err != nil {
			logger.Error("feedback: persist submission", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}
