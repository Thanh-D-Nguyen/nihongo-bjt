package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/quiztemplate"
)

// listTemplatesHandler implements GET /api/quiz/templates.
// Public route — no authentication required.
func listTemplatesHandler(store *quiztemplate.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		templates, err := store.ListTemplates(r.Context())
		if err != nil {
			logger.Error("list quiz templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(templates)
	}
}

// getTemplateHandler implements GET /api/quiz/templates/{id}.
// Public route — returns section metadata only for official simulations.
func getTemplateHandler(store *quiztemplate.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "templates", 1)
		if id == "" {
			writeJSONError(w, "template id required", http.StatusBadRequest)
			return
		}
		tmpl, err := store.GetTemplate(r.Context(), id)
		if err != nil {
			if errors.Is(err, quiztemplate.ErrNotFound) {
				writeJSONError(w, "template not found", http.StatusNotFound)
				return
			}
			logger.Error("get quiz template", "error", err, "id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(tmpl)
	}
}

// getPrintableTemplateHandler implements GET /api/quiz/templates/{id}/printable.
// Public route — denies official simulations (403).
func getPrintableTemplateHandler(store *quiztemplate.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract id from path: .../templates/{id}/printable
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var id string
		for i, p := range parts {
			if p == "templates" && i+2 < len(parts) && parts[i+2] == "printable" {
				id = parts[i+1]
				break
			}
		}
		if id == "" {
			writeJSONError(w, "template id required", http.StatusBadRequest)
			return
		}
		pt, err := store.GetPrintableTemplate(r.Context(), id)
		if err != nil {
			if errors.Is(err, quiztemplate.ErrNotFound) {
				writeJSONError(w, "template not found", http.StatusNotFound)
				return
			}
			if errors.Is(err, quiztemplate.ErrForbidden) {
				writeJSONError(w, "official simulation content is only available inside an active session", http.StatusForbidden)
				return
			}
			logger.Error("get printable template", "error", err, "id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(pt)
	}
}

// getRevengeQueueHandler implements GET /api/quiz/revenge/queue.
// Authenticated learner route.
func getRevengeQueueHandler(store *quiztemplate.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		limit := 5
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		queue, err := store.GetRevengeQueue(r.Context(), identity.UserID, limit)
		if err != nil {
			logger.Error("get revenge queue", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(queue)
	}
}

// submitRevengeAnswerRequest is the JSON body for POST /api/quiz/revenge/answer.
type submitRevengeAnswerRequest struct {
	QuestionID    string `json:"questionId"`
	SelectedOption string `json:"selectedOption"`
}

// submitRevengeAnswerHandler implements POST /api/quiz/revenge/answer.
// Authenticated learner route with CSRF protection.
func submitRevengeAnswerHandler(store *quiztemplate.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req submitRevengeAnswerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.QuestionID == "" || req.SelectedOption == "" {
			writeJSONError(w, "questionId and selectedOption required", http.StatusBadRequest)
			return
		}
		result, err := store.SubmitRevengeAnswer(r.Context(), identity.UserID, req.QuestionID, req.SelectedOption)
		if err != nil {
			if errors.Is(err, quiztemplate.ErrNotFound) {
				writeJSONError(w, "question not found", http.StatusNotFound)
				return
			}
			logger.Error("submit revenge answer", "error", err, "user_id", identity.UserID, "question_id", req.QuestionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}