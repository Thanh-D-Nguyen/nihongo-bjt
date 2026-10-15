package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/studyplan"
)

func decodeJSONBody(w http.ResponseWriter, r *http.Request, target any, maxBytes int64) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return false
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBytes+1))
	if err != nil || len(body) == 0 {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return false
	}
	if int64(len(body)) > maxBytes {
		writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
		return false
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return false
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return false
	}
	return true
}

type quizSessionView struct {
	ID                string     `json:"id"`
	UserID            string     `json:"userId"`
	TemplateID        string     `json:"templateId"`
	Status            string     `json:"status"`
	StartedAt         time.Time  `json:"startedAt"`
	CompletedAt       *time.Time `json:"completedAt"`
	TotalQuestions    int        `json:"totalQuestions"`
	CurrentQuestionNo int        `json:"currentQuestionNo"`
	CorrectCount      int        `json:"correctCount"`
	EstimatedScore    *int       `json:"estimatedScore"`
	EstimatedBjtBand  *string    `json:"estimatedBjtBand"`
	TimeLimitSeconds  *int       `json:"timeLimitSeconds"`
	RemainingSeconds  *int       `json:"remainingSeconds"`
	TestType          string     `json:"testType"`
	TestTitleVi       string     `json:"testTitleVi"`
	TestTitleJa       *string    `json:"testTitleJa"`
	TestLevel         *string    `json:"testLevel"`
}

func startAssessmentQuizHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req startQuizSessionRequest
		if !decodeJSONBody(w, r, &req, maxQuizBodyBytes) {
			return
		}
		templateID := req.TemplateID
		if templateID == "" {
			templateID = req.TestID
		}
		templateID = strings.TrimSpace(templateID)
		if templateID == "" {
			writeJSONError(w, "templateId is required", http.StatusBadRequest)
			return
		}
		var total int
		var testType string
		err := db.QueryRow(r.Context(), `SELECT t.type, COUNT(q.id)::int
			FROM assessment.bjt_mock_test t
			LEFT JOIN assessment.bjt_test_section s ON s.test_id=t.id
			LEFT JOIN assessment.bjt_question q ON q.section_id=s.id AND q.status='published'
			WHERE t.id=$1 AND t.status='published' GROUP BY t.type`, templateID).Scan(&testType, &total)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "template not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("quiz template lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if total == 0 {
			writeJSONError(w, "template has no published questions", http.StatusConflict)
			return
		}
		if testType == "official" {
			available, err := officialQuizAllowed(r.Context(), db, identity.UserID)
			if err != nil {
				logger.Error("official quiz availability lookup failed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if !available {
				writeJSONError(w, "official simulation unavailable", http.StatusForbidden)
				return
			}
		}
		var id string
		err = db.QueryRow(r.Context(), `INSERT INTO assessment.quiz_session(user_id,test_id,total_questions)
			VALUES ($1,$2,$3) RETURNING id`, identity.UserID, templateID, total).Scan(&id)
		if err != nil {
			logger.Error("quiz session creation failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "userId": identity.UserID, "templateId": templateID, "status": "active", "startedAt": time.Now().UTC()})
	}
}

type officialQuizStatus struct {
	AvailableTemplates int    `json:"availableTemplates"`
	Enabled            bool   `json:"enabled"`
	EntitlementKey     string `json:"entitlementKey"`
	Entitled           bool   `json:"entitled"`
	FeatureFlag        string `json:"featureFlag"`
	PlanSlug           string `json:"planSlug"`
}

func getOfficialQuizStatus(ctx context.Context, db quizStatusQueryer, userID string) (officialQuizStatus, error) {
	status := officialQuizStatus{EntitlementKey: "quiz.official_simulation", FeatureFlag: "quiz.official_simulation.enabled", PlanSlug: "free"}
	if err := db.QueryRow(ctx, `SELECT COALESCE(enabled AND NOT kill_switch,false) FROM ops.feature_flag WHERE key=$1`, status.FeatureFlag).Scan(&status.Enabled); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return status, err
	}
	if err := db.QueryRow(ctx, `SELECT COUNT(*)::int FROM assessment.bjt_mock_test WHERE type='official' AND status='published'`).Scan(&status.AvailableTemplates); err != nil {
		return status, err
	}
	err := db.QueryRow(ctx, `SELECT p.slug FROM monetization.user_subscription us
		JOIN monetization.plan p ON p.id=us.plan_id
		JOIN monetization.plan_entitlement pe ON pe.plan_id=p.id
		JOIN monetization.entitlement_definition ed ON ed.id=pe.entitlement_id
		WHERE us.user_id=$1 AND us.status IN ('active','trialing') AND p.status='active'
		AND ed.key=$2 AND (us.current_period_start IS NULL OR us.current_period_start<=NOW())
		AND (us.current_period_end IS NULL OR us.current_period_end>NOW())
		AND (us.status<>'trialing' OR us.trial_end IS NULL OR us.trial_end>NOW())
		ORDER BY us.created_at DESC LIMIT 1`, userID, status.EntitlementKey).Scan(&status.PlanSlug)
	if err == nil {
		status.Entitled = true
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return status, err
	}
	return status, nil
}

type quizStatusQueryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func officialQuizAllowed(ctx context.Context, db quizStatusQueryer, userID string) (bool, error) {
	status, err := getOfficialQuizStatus(ctx, db, userID)
	return err == nil && status.Enabled && status.Entitled && status.AvailableTemplates > 0, err
}

func officialQuizStatusHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		status, err := getOfficialQuizStatus(r.Context(), db, identity.UserID)
		if err != nil {
			logger.Error("official quiz availability lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, status)
	}
}

func quizSessionQuestionHandler(db *pgxpool.Pool, plans *studyplan.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		session, err := loadQuizSession(r.Context(), db, chi.URLParam(r, "id"), identity.UserID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "session not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("quiz session lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		session, err = completeExpiredQuizSession(r.Context(), db, plans, session, identity.UserID)
		if err != nil {
			logger.Error("quiz session expiry failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if session.Status != "active" && session.Status != "completed" {
			writeJSONError(w, "session is not active", http.StatusConflict)
			return
		}
		if session.Status == "active" && session.TestType == "official" {
			available, err := officialQuizAllowed(r.Context(), db, identity.UserID)
			if err != nil {
				logger.Error("official quiz availability lookup failed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if !available {
				writeJSONError(w, "official simulation unavailable", http.StatusForbidden)
				return
			}
		}
		response := map[string]any{"session": session}
		if session.Status != "completed" && session.CurrentQuestionNo < session.TotalQuestions {
			var question map[string]any
			var id, prompt, skill, code string
			var scenario, audioScript, audioURL, imageURL, imageAlt *string
			err = db.QueryRow(r.Context(), `SELECT q.id,q.prompt,q.scenario,q.audio_script,q.audio_url,q.image_url,q.image_alt,q.skill_tag,s.code
				FROM assessment.quiz_session qs JOIN assessment.bjt_test_section s ON s.test_id=qs.test_id
				JOIN assessment.bjt_question q ON q.section_id=s.id AND q.status='published'
				WHERE qs.id=$1 ORDER BY s.display_order,q.created_at,q.id OFFSET $2 LIMIT 1`, session.ID, session.CurrentQuestionNo).
				Scan(&id, &prompt, &scenario, &audioScript, &audioURL, &imageURL, &imageAlt, &skill, &code)
			if err != nil {
				logger.Error("quiz question lookup failed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rows, err := db.Query(r.Context(), `SELECT option_key,text FROM assessment.bjt_question_option WHERE question_id=$1 ORDER BY option_key`, id)
			if err != nil {
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			options := []map[string]string{}
			for rows.Next() {
				var key, text string
				if err := rows.Scan(&key, &text); err != nil {
					rows.Close()
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				options = append(options, map[string]string{"optionKey": key, "text": text})
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rows.Close()
			question = map[string]any{"id": id, "prompt": prompt, "scenario": scenario, "audioScript": audioScript, "audioUrl": audioURL, "imageUrl": imageURL, "imageAlt": imageAlt, "skillTag": skill, "sectionCode": code, "options": options}
			response["question"] = question
		}
		writeJSON(w, http.StatusOK, response)
	}
}

func submitAssessmentQuizAnswerHandler(db *pgxpool.Pool, plans *studyplan.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req submitQuizAnswerRequest
		if !decodeJSONBody(w, r, &req, maxQuizBodyBytes) {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		tx, err := db.Begin(ctx)
		if err != nil {
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var sessionID, templateID, status, testType string
		var current, total int
		var startedAt time.Time
		var timeLimitSeconds *int
		err = tx.QueryRow(ctx, `SELECT qs.id,qs.test_id,qs.status,qs.current_question_no,qs.total_questions,qs.started_at,t.time_limit_seconds,t.type
			FROM assessment.quiz_session qs JOIN assessment.bjt_mock_test t ON t.id=qs.test_id
			WHERE qs.id=$1 AND qs.user_id=$2 FOR UPDATE OF qs`, chi.URLParam(r, "id"), identity.UserID).Scan(&sessionID, &templateID, &status, &current, &total, &startedAt, &timeLimitSeconds, &testType)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "session not found", http.StatusNotFound)
			return
		}
		if err != nil || status != "in_progress" {
			writeJSONError(w, "session is not active", http.StatusConflict)
			return
		}
		if timeLimitSeconds != nil && time.Since(startedAt) >= time.Duration(*timeLimitSeconds)*time.Second {
			if _, err := tx.Exec(ctx, `UPDATE assessment.quiz_session SET status='completed',completed_at=NOW() WHERE id=$1`, sessionID); err != nil {
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if _, err := plans.RecordProgressTx(ctx, tx, identity.UserID, "bjt_quiz"); err != nil {
				logger.Error("quiz study progress update failed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if err := tx.Commit(ctx); err != nil {
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSONError(w, "session expired", http.StatusConflict)
			return
		}
		if testType == "official" {
			available, err := officialQuizAllowed(ctx, tx, identity.UserID)
			if err != nil {
				logger.Error("official quiz availability lookup failed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if !available {
				writeJSONError(w, "official simulation unavailable", http.StatusForbidden)
				return
			}
		}
		var expectedQuestion string
		err = tx.QueryRow(ctx, `SELECT q.id FROM assessment.bjt_test_section s JOIN assessment.bjt_question q ON q.section_id=s.id
			WHERE s.test_id=$1 AND q.status='published' ORDER BY s.display_order,q.created_at,q.id OFFSET $2 LIMIT 1`, templateID, current).Scan(&expectedQuestion)
		if err != nil || expectedQuestion != req.QuestionID {
			writeJSONError(w, "question is not current", http.StatusConflict)
			return
		}
		var correct bool
		err = tx.QueryRow(ctx, `SELECT is_correct FROM assessment.bjt_question_option WHERE question_id=$1 AND option_key=$2`, expectedQuestion, req.SelectedOption).Scan(&correct)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "invalid option", http.StatusBadRequest)
			return
		}
		if err != nil {
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err = tx.Exec(ctx, `INSERT INTO assessment.quiz_answer(session_id,question_id,selected_option,is_correct) VALUES($1,$2,$3,$4)`, sessionID, expectedQuestion, req.SelectedOption, correct); err != nil {
			writeJSONError(w, "answer already recorded", http.StatusConflict)
			return
		}
		current++
		var newStatus string
		if current >= total {
			newStatus = "completed"
			_, err = tx.Exec(ctx, `UPDATE assessment.quiz_session SET current_question_no=$2,correct_count=correct_count+$3,status=$4,completed_at=NOW() WHERE id=$1`, sessionID, current, boolInt(correct), newStatus)
		} else {
			newStatus = "in_progress"
			_, err = tx.Exec(ctx, `UPDATE assessment.quiz_session SET current_question_no=$2,correct_count=correct_count+$3 WHERE id=$1`, sessionID, current, boolInt(correct))
		}
		if err != nil {
			logger.Error("quiz answer update failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if newStatus == "completed" {
			if _, err := plans.RecordProgressTx(ctx, tx, identity.UserID, "bjt_quiz"); err != nil {
				logger.Error("quiz study progress update failed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("quiz answer commit failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		session, err := loadQuizSession(ctx, db, sessionID, identity.UserID)
		if err != nil {
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"session": session})
	}
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func loadQuizSession(ctx context.Context, db *pgxpool.Pool, id, userID string) (quizSessionView, error) {
	var view quizSessionView
	err := db.QueryRow(ctx, `SELECT qs.id,qs.user_id,qs.test_id,qs.status,qs.started_at,qs.completed_at,qs.total_questions,
		qs.current_question_no,qs.correct_count,qs.estimated_score,qs.estimated_bjt_band,t.time_limit_seconds,t.type,t.title_vi,t.title_ja,t.level
		FROM assessment.quiz_session qs JOIN assessment.bjt_mock_test t ON t.id=qs.test_id
		WHERE qs.id=$1 AND qs.user_id=$2`, id, userID).Scan(&view.ID, &view.UserID, &view.TemplateID, &view.Status, &view.StartedAt, &view.CompletedAt, &view.TotalQuestions, &view.CurrentQuestionNo, &view.CorrectCount, &view.EstimatedScore, &view.EstimatedBjtBand, &view.TimeLimitSeconds, &view.TestType, &view.TestTitleVi, &view.TestTitleJa, &view.TestLevel)
	if err != nil {
		return view, err
	}
	if view.Status == "in_progress" {
		view.Status = "active"
	}
	if view.TimeLimitSeconds != nil {
		remainingDuration := time.Duration(*view.TimeLimitSeconds)*time.Second - time.Since(view.StartedAt)
		remaining := 0
		if remainingDuration > 0 {
			remaining = int((remainingDuration + time.Second - 1) / time.Second)
		}
		remaining = min(remaining, *view.TimeLimitSeconds)
		view.RemainingSeconds = &remaining
	}
	return view, nil
}

func completeExpiredQuizSession(ctx context.Context, db *pgxpool.Pool, plans *studyplan.Store, session quizSessionView, userID string) (quizSessionView, error) {
	if session.Status != "active" || session.RemainingSeconds == nil || *session.RemainingSeconds > 0 {
		return session, nil
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return session, err
	}
	defer tx.Rollback(ctx)
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM assessment.quiz_session WHERE id=$1 AND user_id=$2 FOR UPDATE`, session.ID, userID).Scan(&status); err != nil {
		return session, err
	}
	if status == "in_progress" {
		if _, err := tx.Exec(ctx, `UPDATE assessment.quiz_session SET status='completed',completed_at=NOW() WHERE id=$1`, session.ID); err != nil {
			return session, err
		}
		if _, err := plans.RecordProgressTx(ctx, tx, userID, "bjt_quiz"); err != nil {
			return session, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return session, err
	}
	return loadQuizSession(ctx, db, session.ID, userID)
}

func quizActiveSessionHandler(db *pgxpool.Pool, plans *studyplan.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var id string
		err := db.QueryRow(r.Context(), `SELECT id FROM assessment.quiz_session WHERE user_id=$1 AND status='in_progress' ORDER BY started_at DESC LIMIT 1`, identity.UserID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]any{"session": nil})
			return
		}
		if err != nil {
			logger.Error("active quiz lookup failed", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		session, err := loadQuizSession(r.Context(), db, id, identity.UserID)
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		session, err = completeExpiredQuizSession(r.Context(), db, plans, session, identity.UserID)
		if err != nil {
			logger.Error("active quiz expiry failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"session": session})
	}
}

func quizHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", 401)
			return
		}
		limit := 10
		rows, err := db.Query(r.Context(), `SELECT id FROM assessment.quiz_session WHERE user_id=$1 ORDER BY started_at DESC LIMIT $2`, identity.UserID, limit)
		if err != nil {
			logger.Error("quiz history lookup failed", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		defer rows.Close()
		sessions := []quizSessionView{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				writeJSONError(w, "internal error", 500)
				return
			}
			item, err := loadQuizSession(r.Context(), db, id, identity.UserID)
			if err != nil {
				writeJSONError(w, "internal error", 500)
				return
			}
			sessions = append(sessions, item)
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		writeJSON(w, http.StatusOK, sessions)
	}
}

func quizResultsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", 401)
			return
		}
		item, err := loadQuizSession(r.Context(), db, chi.URLParam(r, "id"), identity.UserID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "session not found", 404)
			return
		}
		if err != nil {
			logger.Error("quiz result lookup failed", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		if item.Status != "completed" {
			writeJSONError(w, "session is not completed", 409)
			return
		}
		writeJSON(w, http.StatusOK, item)
	}
}

func quizBreakdownHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", 401)
			return
		}
		id := chi.URLParam(r, "id")
		var testID, titleVi, testType string
		var titleJa *string
		var score *int
		var band *string
		err := db.QueryRow(r.Context(), `SELECT t.id,t.title_vi,t.title_ja,t.type,qs.estimated_score,qs.estimated_bjt_band FROM assessment.quiz_session qs JOIN assessment.bjt_mock_test t ON t.id=qs.test_id WHERE qs.id=$1 AND qs.user_id=$2 AND qs.status='completed'`, id, identity.UserID).Scan(&testID, &titleVi, &titleJa, &testType, &score, &band)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "session not found", 404)
			return
		}
		if err != nil {
			logger.Error("quiz breakdown lookup failed", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		if testType == "official" {
			available, err := officialQuizAllowed(r.Context(), db, identity.UserID)
			if err != nil {
				logger.Error("official quiz availability lookup failed", "error", err)
				writeJSONError(w, "internal error", 500)
				return
			}
			if !available {
				writeJSONError(w, "official simulation unavailable", http.StatusForbidden)
				return
			}
		}
		rows, err := db.Query(r.Context(), `SELECT q.id,q.prompt,qa.selected_option,qa.is_correct,q.explanation_vi,q.skill_tag,s.code,q.remediation_card_id FROM assessment.quiz_answer qa JOIN assessment.bjt_question q ON q.id=qa.question_id JOIN assessment.bjt_test_section s ON s.id=q.section_id WHERE qa.session_id=$1 ORDER BY s.display_order,q.created_at,q.id`, id)
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		defer rows.Close()
		breakdown := []map[string]any{}
		for rows.Next() {
			var qid, prompt, selected, explanation, skill, section string
			var correct bool
			var card *string
			if err := rows.Scan(&qid, &prompt, &selected, &correct, &explanation, &skill, &section, &card); err != nil {
				writeJSONError(w, "internal error", 500)
				return
			}
			breakdown = append(breakdown, map[string]any{"questionId": qid, "prompt": prompt, "selectedOption": selected, "isCorrect": correct, "explanationVi": explanation, "skillTag": skill, "sectionCode": section, "remediationCardId": card})
		}
		if err := rows.Err(); err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"sessionId": id, "testId": testID, "testTitleVi": titleVi, "testTitleJa": titleJa, "estimatedScore": score, "estimatedBjtBand": band, "breakdown": breakdown})
	}
}
