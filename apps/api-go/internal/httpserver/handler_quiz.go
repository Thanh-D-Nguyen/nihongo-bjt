// Package httpserver provides HTTP handlers for quiz session endpoints.
package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

const (
	// maxQuizBodyBytes bounds JSON body size for quiz endpoints.
	maxQuizBodyBytes = 8192
)

// startQuizSessionRequest is the JSON body for POST /api/quiz/start.
type startQuizSessionRequest struct {
	TemplateID string `json:"templateId"`
}

// submitQuizAnswerRequest is the JSON body for POST /api/quiz/session/:id/answer.
type submitQuizAnswerRequest struct {
	QuestionID     string `json:"questionId"`
	SelectedOption string `json:"selectedOption"`
}

// quizSessionResponse is returned by quiz start endpoint.
type quizSessionResponse struct {
	ID         string    `json:"id"`
	UserID     string    `json:"userId"`
	TemplateID string    `json:"templateId"`
	Status     string    `json:"status"`
	StartedAt  time.Time `json:"startedAt"`
}

// startQuizSessionHandler implements POST /api/quiz/start.
func startQuizSessionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxQuizBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxQuizBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req startQuizSessionRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		templateID := strings.TrimSpace(req.TemplateID)
		if templateID == "" {
			writeJSONError(w, "templateId is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		sessionID, err := createQuizSession(ctx, db, identity.UserID, templateID)
		if err != nil {
			logger.Error("start quiz session: create failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		resp := quizSessionResponse{
			ID:         sessionID,
			UserID:     identity.UserID,
			TemplateID: templateID,
			Status:     "active",
			StartedAt:  time.Now(),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// submitQuizAnswerHandler implements POST /api/quiz/session/:id/answer.
func submitQuizAnswerHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		sessionID := chi.URLParam(r, "id")
		if sessionID == "" {
			writeJSONError(w, "session id is required", http.StatusBadRequest)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxQuizBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxQuizBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req submitQuizAnswerRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		questionID := strings.TrimSpace(req.QuestionID)
		selectedOption := strings.TrimSpace(req.SelectedOption)
		if questionID == "" || selectedOption == "" {
			writeJSONError(w, "questionId and selectedOption are required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// Verify session belongs to user and is active.
		status, err := getQuizSessionStatus(ctx, db, sessionID, identity.UserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "session not found", http.StatusNotFound)
				return
			}
			logger.Error("submit quiz answer: session lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "active" {
			writeJSONError(w, "session is not active", http.StatusBadRequest)
			return
		}

		answerID, err := createQuizAnswer(ctx, db, sessionID, questionID, selectedOption)
		if err != nil {
			logger.Error("submit quiz answer: create answer failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":         answerID,
			"sessionId":  sessionID,
			"questionId": questionID,
		})
	}
}

// DB helper functions for quiz sessions.
func createQuizSession(ctx context.Context, db *pgxpool.Pool, userID, templateID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO learner.quiz_session (user_id, template_id) VALUES ($1, $2) RETURNING id`
	var id string
	err := db.QueryRow(ctx, q, userID, templateID).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create quiz session: %w", err)
	}
	return id, nil
}

func getQuizSessionStatus(ctx context.Context, db *pgxpool.Pool, sessionID, userID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT status FROM learner.quiz_session WHERE id = $1 AND user_id = $2`
	var status string
	err := db.QueryRow(ctx, q, sessionID, userID).Scan(&status)
	if err != nil {
		return "", err
	}
	return status, nil
}

func createQuizAnswer(ctx context.Context, db *pgxpool.Pool, sessionID, questionID, selectedOption string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO learner.quiz_answer (session_id, question_id, selected_option)
	VALUES ($1, $2, $3) RETURNING id`
	var id string
	err := db.QueryRow(ctx, q, sessionID, questionID, selectedOption).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create quiz answer: %w", err)
	}
	return id, nil
}
