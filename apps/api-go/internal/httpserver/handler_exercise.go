// Package httpserver provides HTTP handlers for exercise session endpoints.
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
	// maxExerciseBodyBytes bounds JSON body size for exercise endpoints.
	maxExerciseBodyBytes = 8192
)

// startExerciseSessionRequest is the JSON body for POST /api/exercises/sessions.
type startExerciseSessionRequest struct {
	ExerciseType string `json:"exerciseType"`
	Placement    string `json:"placement"`
}

// submitExerciseAnswerRequest is the JSON body for POST /api/exercises/sessions/:id/answer.
type submitExerciseAnswerRequest struct {
	ExerciseData json.RawMessage `json:"exerciseData"`
	UserAnswer   json.RawMessage `json:"userAnswer"`
	Correct      bool            `json:"correct"`
	SRSBefore    json.RawMessage `json:"srsStateBefore"`
	SRSAfter     json.RawMessage `json:"srsStateAfter"`
}

// exerciseSessionResponse is returned by start and complete endpoints.
type exerciseSessionResponse struct {
	ID           string     `json:"id"`
	UserID       string     `json:"userId"`
	ExerciseType string     `json:"exerciseType"`
	Placement    string     `json:"placement,omitempty"`
	Status       string     `json:"status"`
	StartedAt    time.Time  `json:"startedAt"`
	CompletedAt  *time.Time `json:"completedAt,omitempty"`
}

// startExerciseSessionHandler implements POST /api/exercises/sessions.
func startExerciseSessionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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

		body, err := io.ReadAll(io.LimitReader(r.Body, maxExerciseBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxExerciseBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req startExerciseSessionRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		exerciseType := strings.TrimSpace(req.ExerciseType)
		if exerciseType == "" {
			writeJSONError(w, "exerciseType is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		sessionID, err := createExerciseSession(ctx, db, identity.UserID, exerciseType, req.Placement)
		if err != nil {
			logger.Error("start exercise session: create failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		resp := exerciseSessionResponse{
			ID:           sessionID,
			UserID:       identity.UserID,
			ExerciseType: exerciseType,
			Placement:    req.Placement,
			Status:       "active",
			StartedAt:    time.Now(),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// submitExerciseAnswerHandler implements POST /api/exercises/sessions/:id/answer.
func submitExerciseAnswerHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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

		body, err := io.ReadAll(io.LimitReader(r.Body, maxExerciseBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxExerciseBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req submitExerciseAnswerRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Verify session belongs to user and is active.
		status, err := getExerciseSessionStatus(ctx, db, sessionID, identity.UserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "session not found", http.StatusNotFound)
				return
			}
			logger.Error("submit exercise answer: session lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "active" {
			writeJSONError(w, "session is not active", http.StatusBadRequest)
			return
		}

		attemptID, err := createExerciseAttempt(ctx, db, sessionID, req)
		if err != nil {
			logger.Error("submit exercise answer: create attempt failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":        attemptID,
			"sessionId": sessionID,
			"correct":   req.Correct,
		})
	}
}

// completeExerciseSessionHandler implements POST /api/exercises/sessions/:id/complete.
func completeExerciseSessionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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

		ctx := r.Context()

		// Verify session belongs to user.
		status, err := getExerciseSessionStatus(ctx, db, sessionID, identity.UserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "session not found", http.StatusNotFound)
				return
			}
			logger.Error("complete exercise session: lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "active" {
			writeJSONError(w, "session is not active", http.StatusBadRequest)
			return
		}

		if err := completeExerciseSession(ctx, db, sessionID); err != nil {
			logger.Error("complete exercise session: update failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":     sessionID,
			"status": "completed",
		})
	}
}

// DB helper functions for exercise sessions.

func createExerciseSession(ctx context.Context, db *pgxpool.Pool, userID, exerciseType, placement string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO learner.exercise_session (user_id, exercise_type, placement) VALUES ($1, $2, $3) RETURNING id`
	var id string
	err := db.QueryRow(ctx, q, userID, exerciseType, placement).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create exercise session: %w", err)
	}
	return id, nil
}

func getExerciseSessionStatus(ctx context.Context, db *pgxpool.Pool, sessionID, userID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT status FROM learner.exercise_session WHERE id = $1 AND user_id = $2`
	var status string
	err := db.QueryRow(ctx, q, sessionID, userID).Scan(&status)
	if err != nil {
		return "", err
	}
	return status, nil
}

func createExerciseAttempt(ctx context.Context, db *pgxpool.Pool, sessionID string, req submitExerciseAnswerRequest) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	exerciseData := req.ExerciseData
	if exerciseData == nil {
		exerciseData = json.RawMessage(`{}`)
	}
	userAnswer := req.UserAnswer
	if userAnswer == nil {
		userAnswer = json.RawMessage(`{}`)
	}

	const q = `INSERT INTO learner.exercise_attempt (session_id, exercise_data, user_answer, correct, srs_state_before, srs_state_after)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	var id string
	err := db.QueryRow(ctx, q, sessionID, exerciseData, userAnswer, req.Correct, req.SRSBefore, req.SRSAfter).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create exercise attempt: %w", err)
	}
	return id, nil
}

func completeExerciseSession(ctx context.Context, db *pgxpool.Pool, sessionID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE learner.exercise_session SET status = 'completed', completed_at = now() WHERE id = $1`
	_, err := db.Exec(ctx, q, sessionID)
	if err != nil {
		return fmt.Errorf("complete exercise session: %w", err)
	}
	return nil
}
