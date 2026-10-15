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
	"reflect"
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
	ExerciseType string   `json:"exerciseType"`
	ExerciseIDs  []string `json:"exerciseIds"`
	SessionType  string   `json:"sessionType"`
	Placement    string   `json:"placement"`
	Level        string   `json:"level"`
}

// submitExerciseAnswerRequest is the JSON body for POST /api/exercises/sessions/:id/answer.
type submitExerciseAnswerRequest struct {
	ExerciseID  string          `json:"exerciseId"`
	TimeSpentMs int             `json:"timeSpentMs"`
	UserAnswer  json.RawMessage `json:"userAnswer"`
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
		level := strings.TrimSpace(req.Level)
		requestedPlacement := strings.TrimSpace(req.Placement)
		sessionType := strings.TrimSpace(req.SessionType)
		if exerciseType != "meaning_match" && exerciseType != "cloze" && exerciseType != "word_order" && exerciseType != "translation" && exerciseType != "listening" {
			writeJSONError(w, "unsupported exercise type", http.StatusBadRequest)
			return
		}
		if level != "" && level != "N1" && level != "N2" && level != "N3" && level != "N4" && level != "N5" {
			writeJSONError(w, "invalid level", http.StatusBadRequest)
			return
		}
		if !validExercisePlacement(requestedPlacement) || !validExercisePlacement(sessionType) {
			writeJSONError(w, "invalid session placement", http.StatusBadRequest)
			return
		}
		if len(req.ExerciseIDs) == 0 || len(req.ExerciseIDs) > 50 {
			writeJSONError(w, "exerciseIds must contain between 1 and 50 exercises", http.StatusBadRequest)
			return
		}
		seen := make(map[string]struct{}, len(req.ExerciseIDs))
		for _, id := range req.ExerciseIDs {
			if _, exists := seen[id]; exists {
				writeJSONError(w, "exerciseIds must be unique", http.StatusBadRequest)
				return
			}
			seen[id] = struct{}{}
		}
		var assignedCount int
		if err := db.QueryRow(r.Context(), `SELECT count(*) FROM exercise.exercise WHERE id::text = ANY($1::text[]) AND exercise_type = $2`, req.ExerciseIDs, exerciseType).Scan(&assignedCount); err != nil {
			logger.Error("start exercise session: validate questions failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if assignedCount != len(req.ExerciseIDs) {
			writeJSONError(w, "one or more exercises are unavailable for this type", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		placement := requestedPlacement
		if placement == "" {
			placement = sessionType
		}
		if placement == "" {
			placement = "practice_tab"
		}
		sessionID, err := createExerciseSession(ctx, db, identity.UserID, exerciseType, placement, level, req.ExerciseIDs)
		if err != nil {
			logger.Error("start exercise session: create failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		resp := exerciseSessionResponse{
			ID:           sessionID,
			UserID:       identity.UserID,
			ExerciseType: exerciseType,
			Placement:    placement,
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

		if req.ExerciseID == "" || req.TimeSpentMs < 0 || req.TimeSpentMs > 600000 || len(req.UserAnswer) == 0 {
			writeJSONError(w, "exerciseId, userAnswer, and a valid timeSpentMs are required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("submit exercise answer: begin transaction failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var status, sessionExerciseType string
		err = tx.QueryRow(ctx, `SELECT status, exercise_type FROM exercise.exercise_session
			WHERE id = $1 AND user_id = $2 AND EXISTS (
				SELECT 1 FROM unnest(exercise_ids) AS assigned_id WHERE assigned_id::text = $3
			) FOR UPDATE`, sessionID, identity.UserID, req.ExerciseID).Scan(&status, &sessionExerciseType)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "session not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("submit exercise answer: session lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "in_progress" {
			writeJSONError(w, "session is not active", http.StatusBadRequest)
			return
		}

		var exerciseType string
		var correctAnswer json.RawMessage
		var explanation *string
		err = tx.QueryRow(ctx, `SELECT exercise_type, correct_answer, explanation FROM exercise.exercise WHERE id = $1`, req.ExerciseID).
			Scan(&exerciseType, &correctAnswer, &explanation)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "exercise not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("submit exercise answer: exercise lookup failed", "error", err, "exercise_id", req.ExerciseID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if exerciseType != sessionExerciseType {
			writeJSONError(w, "exercise type does not match session", http.StatusBadRequest)
			return
		}
		var alreadyAnswered bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM exercise.exercise_answer WHERE session_id = $1 AND exercise_id = $2)`, sessionID, req.ExerciseID).Scan(&alreadyAnswered); err != nil {
			logger.Error("submit exercise answer: duplicate check failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if alreadyAnswered {
			writeJSONError(w, "exercise already answered", http.StatusConflict)
			return
		}
		correct, err := exerciseAnswerIsCorrect(correctAnswer, req.UserAnswer)
		if err != nil {
			writeJSONError(w, "invalid answer", http.StatusBadRequest)
			return
		}
		var attemptID string
		err = tx.QueryRow(ctx, `INSERT INTO exercise.exercise_answer (session_id, exercise_id, user_answer, is_correct, time_spent_ms)
			VALUES ($1, $2, $3, $4, $5) RETURNING id::text`, sessionID, req.ExerciseID, req.UserAnswer, correct, req.TimeSpentMs).Scan(&attemptID)
		if err != nil {
			logger.Error("submit exercise answer: create attempt failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("submit exercise answer: commit failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":            attemptID,
			"sessionId":     sessionID,
			"isCorrect":     correct,
			"correctAnswer": correctAnswer,
			"explanation":   explanation,
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

		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("complete exercise session: begin transaction failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var status string
		var exerciseIDs []string
		err = tx.QueryRow(ctx, `SELECT status, exercise_ids FROM exercise.exercise_session WHERE id = $1 AND user_id = $2 FOR UPDATE`, sessionID, identity.UserID).Scan(&status, &exerciseIDs)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "session not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("complete exercise session: lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "in_progress" {
			writeJSONError(w, "session is not active", http.StatusBadRequest)
			return
		}
		var answeredCount int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM exercise.exercise_answer WHERE session_id = $1 AND exercise_id = ANY($2::uuid[])`, sessionID, exerciseIDs).Scan(&answeredCount); err != nil {
			logger.Error("complete exercise session: answer count failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(exerciseIDs) == 0 || answeredCount != len(exerciseIDs) {
			writeJSONError(w, "all assigned exercises must be answered before completion", http.StatusConflict)
			return
		}

		_, err = tx.Exec(ctx, `UPDATE exercise.exercise_session SET status = 'completed', completed_at = now(),
			total_questions = $2,
			correct_count = (SELECT count(*) FROM exercise.exercise_answer WHERE session_id = $1 AND exercise_id = ANY($3::uuid[]) AND is_correct),
			score = (SELECT count(*) * 10 FROM exercise.exercise_answer WHERE session_id = $1 AND exercise_id = ANY($3::uuid[]) AND is_correct)
			WHERE id = $1 AND status = 'in_progress'`, sessionID, len(exerciseIDs), exerciseIDs)
		if err != nil {
			logger.Error("complete exercise session: update failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		var totalQuestions, correctCount, score int
		if err := tx.QueryRow(ctx, `SELECT total_questions, correct_count, score FROM exercise.exercise_session WHERE id = $1`, sessionID).Scan(&totalQuestions, &correctCount, &score); err != nil {
			logger.Error("complete exercise session: score lookup failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("complete exercise session: commit failed", "error", err, "session_id", sessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id": sessionID, "status": "completed", "totalQuestions": totalQuestions,
			"correctCount": correctCount, "score": score,
		})
	}
}

func validExercisePlacement(value string) bool {
	return value == "" || value == "practice_tab" || value == "post_review" || value == "daily_hub"
}

// DB helper functions for exercise sessions.

func createExerciseSession(ctx context.Context, db *pgxpool.Pool, userID, exerciseType, placement, level string, exerciseIDs []string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO exercise.exercise_session (user_id, session_type, exercise_type, level, exercise_ids, status)
		VALUES ($1, $2, $3, NULLIF($4, ''), ARRAY(SELECT unnest($5::text[])::uuid), 'in_progress') RETURNING id::text`
	var id string
	err := db.QueryRow(ctx, q, userID, placement, exerciseType, level, exerciseIDs).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create exercise session: %w", err)
	}
	return id, nil
}

func exerciseAnswerIsCorrect(correctAnswer, userAnswer json.RawMessage) (bool, error) {
	var expected, actual interface{}
	if err := json.Unmarshal(correctAnswer, &expected); err != nil {
		return false, fmt.Errorf("decode correct answer: %w", err)
	}
	if err := json.Unmarshal(userAnswer, &actual); err != nil {
		return false, fmt.Errorf("decode user answer: %w", err)
	}
	return reflect.DeepEqual(expected, actual), nil
}
