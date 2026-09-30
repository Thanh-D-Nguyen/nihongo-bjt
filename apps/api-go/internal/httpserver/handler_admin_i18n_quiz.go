package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── Quiz Admin ──────────────────────────────────────────────────────────────

// adminQuizTestsListHandler implements GET /api/admin/quiz/tests.
func adminQuizTestsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)
		status := r.URL.Query().Get("status")
		testType := r.URL.Query().Get("type")
		if limit < 1 || limit > 200 {
			limit = 50
		}
		if offset < 0 {
			offset = 0
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if testType != "" {
			whereParts = append(whereParts, fmt.Sprintf("type = $%d", argIdx))
			args = append(args, testType)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM assessment.bjt_test "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, title, type, status, duration_minutes, question_count, created_at, updated_at
			FROM assessment.bjt_test %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list quiz tests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Test struct {
			ID              string `json:"id"`
			Title           string `json:"title"`
			Type            string `json:"type"`
			Status          string `json:"status"`
			DurationMinutes int    `json:"durationMinutes"`
			QuestionCount   int    `json:"questionCount"`
			CreatedAt       string `json:"createdAt"`
			UpdatedAt       string `json:"updatedAt"`
		}
		var items []Test
		for rows.Next() {
			var t Test
			var ca, ua time.Time
			if rows.Scan(&t.ID, &t.Title, &t.Type, &t.Status, &t.DurationMinutes, &t.QuestionCount, &ca, &ua) == nil {
				t.CreatedAt = ca.UTC().Format(time.RFC3339)
				t.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, t)
			}
		}
		if items == nil {
			items = []Test{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// adminQuizRemediationListHandler implements GET /api/admin/quiz/remediation.
func adminQuizRemediationListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		if limit < 1 || limit > 200 {
			limit = 50
		}

		rows, err := db.Query(r.Context(), `SELECT id, prompt, skill_tag, difficulty, remediation_card_id,
			explanation_vi, status, created_at,
			(SELECT COUNT(*) FROM assessment.bjt_option WHERE question_id = assessment.bjt_question.id) as option_count
			FROM assessment.bjt_question ORDER BY created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("list quiz remediation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Item struct {
			ID               string `json:"id"`
			Prompt           string `json:"prompt"`
			SkillTag         string `json:"skillTag"`
			Difficulty       string `json:"difficulty"`
			RemediationCardID *string `json:"remediationCardId,omitempty"`
			ExplanationVi    string `json:"explanationVi"`
			Status           string `json:"status"`
			CreatedAt        string `json:"createdAt"`
			HasRemediation   bool   `json:"hasRemediation"`
			HasExplanation   bool   `json:"hasExplanation"`
			OptionCount      int    `json:"optionCount"`
		}
		var items []Item
		for rows.Next() {
			var i Item
			var ca time.Time
			if rows.Scan(&i.ID, &i.Prompt, &i.SkillTag, &i.Difficulty, &i.RemediationCardID,
				&i.ExplanationVi, &i.Status, &ca, &i.OptionCount) == nil {
				i.CreatedAt = ca.UTC().Format(time.RFC3339)
				i.HasRemediation = i.RemediationCardID != nil
				i.HasExplanation = len(i.ExplanationVi) > 0
				items = append(items, i)
			}
		}
		if items == nil {
			items = []Item{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	}
}

// adminQuizQuestionsListHandler implements GET /api/admin/quiz/questions.
func adminQuizQuestionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)
		status := r.URL.Query().Get("status")
		if limit < 1 || limit > 200 {
			limit = 50
		}
		if offset < 0 {
			offset = 0
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM assessment.bjt_question "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, prompt, skill_tag, difficulty, status, created_at,
			(SELECT COUNT(*) FROM assessment.bjt_option WHERE question_id = assessment.bjt_question.id) as option_count
			FROM assessment.bjt_question %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list quiz questions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Question struct {
			ID          string `json:"id"`
			Prompt      string `json:"prompt"`
			SkillTag    string `json:"skillTag"`
			Difficulty  string `json:"difficulty"`
			Status      string `json:"status"`
			CreatedAt   string `json:"createdAt"`
			OptionCount int    `json:"optionCount"`
		}
		var items []Question
		for rows.Next() {
			var q Question
			var ca time.Time
			if rows.Scan(&q.ID, &q.Prompt, &q.SkillTag, &q.Difficulty, &q.Status, &ca, &q.OptionCount) == nil {
				q.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, q)
			}
		}
		if items == nil {
			items = []Question{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// adminQuizSessionsListHandler implements GET /api/admin/quiz/sessions.
func adminQuizSessionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)
		status := r.URL.Query().Get("status")
		if limit < 1 || limit > 200 {
			limit = 50
		}
		if offset < 0 {
			offset = 0
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM assessment.quiz_session "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, user_id, test_id, status, total_questions, correct_count,
			estimated_score, estimated_bjt_band, started_at, completed_at
			FROM assessment.quiz_session %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list quiz sessions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Session struct {
			ID             string  `json:"id"`
			UserID         string  `json:"userId"`
			TestID         string  `json:"testId"`
			Status         string  `json:"status"`
			TotalQuestions int     `json:"totalQuestions"`
			CorrectCount   int     `json:"correctCount"`
			EstimatedScore float64 `json:"estimatedScore"`
			EstimatedBand  *string `json:"estimatedBjtBand,omitempty"`
			StartedAt      string  `json:"startedAt"`
			CompletedAt    *string `json:"completedAt,omitempty"`
		}
		var items []Session
		for rows.Next() {
			var s Session
			var sa time.Time
			var cat *time.Time
			if rows.Scan(&s.ID, &s.UserID, &s.TestID, &s.Status, &s.TotalQuestions, &s.CorrectCount,
				&s.EstimatedScore, &s.EstimatedBand, &sa, &cat) == nil {
				s.StartedAt = sa.UTC().Format(time.RFC3339)
				if cat != nil {
					cs := cat.UTC().Format(time.RFC3339)
					s.CompletedAt = &cs
				}
				items = append(items, s)
			}
		}
		if items == nil {
			items = []Session{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// ── Quiz Sessions Admin (nested under /api/admin/assessment/quiz-sessions) ──

// adminAssessmentQuizSessionsListHandler implements GET /api/admin/assessment/quiz-sessions.
func adminAssessmentQuizSessionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 25)
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		userID := r.URL.Query().Get("userId")
		testID := r.URL.Query().Get("testId")
		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 25
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if q != "" {
			whereParts = append(whereParts, fmt.Sprintf("qs.id::text ILIKE $%d", argIdx))
			args = append(args, "%"+q+"%")
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("qs.status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if userID != "" {
			whereParts = append(whereParts, fmt.Sprintf("qs.user_id = $%d", argIdx))
			args = append(args, userID)
			argIdx++
		}
		if testID != "" {
			whereParts = append(whereParts, fmt.Sprintf("qs.test_id = $%d", argIdx))
			args = append(args, testID)
			argIdx++
		}
		if from != "" {
			whereParts = append(whereParts, fmt.Sprintf("qs.started_at >= $%d", argIdx))
			args = append(args, from)
			argIdx++
		}
		if to != "" {
			whereParts = append(whereParts, fmt.Sprintf("qs.started_at <= $%d", argIdx))
			args = append(args, to)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM assessment.quiz_session qs "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT qs.id, qs.user_id, qs.test_id, qs.status, qs.total_questions, qs.correct_count,
			qs.estimated_score, qs.estimated_bjt_band, qs.started_at, qs.completed_at
			FROM assessment.quiz_session qs %s ORDER BY qs.started_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list assessment quiz sessions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Session struct {
			ID             string  `json:"id"`
			UserID         string  `json:"userId"`
			TestID         string  `json:"testId"`
			Status         string  `json:"status"`
			TotalQuestions int     `json:"totalQuestions"`
			CorrectCount   int     `json:"correctCount"`
			EstimatedScore float64 `json:"estimatedScore"`
			EstimatedBand  *string `json:"estimatedBjtBand,omitempty"`
			StartedAt      string  `json:"startedAt"`
			CompletedAt    *string `json:"completedAt,omitempty"`
		}
		var items []Session
		for rows.Next() {
			var s Session
			var sa time.Time
			var cat *time.Time
			if rows.Scan(&s.ID, &s.UserID, &s.TestID, &s.Status, &s.TotalQuestions, &s.CorrectCount,
				&s.EstimatedScore, &s.EstimatedBand, &sa, &cat) == nil {
				s.StartedAt = sa.UTC().Format(time.RFC3339)
				if cat != nil {
					cs := cat.UTC().Format(time.RFC3339)
					s.CompletedAt = &cs
				}
				items = append(items, s)
			}
		}
		if items == nil {
			items = []Session{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
		})
	}
}

// adminAssessmentQuizSessionDetailHandler implements GET /api/admin/assessment/quiz-sessions/{id}.
func adminAssessmentQuizSessionDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "quiz-sessions", 1)
		if id == "" {
			writeJSONError(w, "session id required", http.StatusBadRequest)
			return
		}

		type Answer struct {
			QuestionID    string `json:"questionId"`
			SelectedIndex int    `json:"selectedIndex"`
			Correct       bool   `json:"correct"`
			TimeMs        int    `json:"timeMs"`
		}
		type Detail struct {
			ID             string    `json:"id"`
			UserID         string    `json:"userId"`
			TestID         string    `json:"testId"`
			Status         string    `json:"status"`
			TotalQuestions int       `json:"totalQuestions"`
			CorrectCount   int       `json:"correctCount"`
			EstimatedScore float64   `json:"estimatedScore"`
			EstimatedBand  *string   `json:"estimatedBjtBand,omitempty"`
			StartedAt      string    `json:"startedAt"`
			CompletedAt    *string   `json:"completedAt,omitempty"`
			Answers        []Answer  `json:"answers"`
			Audit          []json.RawMessage `json:"audit"`
		}
		var d Detail
		var sa time.Time
		var cat *time.Time
		err := db.QueryRow(r.Context(), `SELECT id, user_id, test_id, status, total_questions, correct_count,
			estimated_score, estimated_bjt_band, started_at, completed_at
			FROM assessment.quiz_session WHERE id=$1`, id).
			Scan(&d.ID, &d.UserID, &d.TestID, &d.Status, &d.TotalQuestions, &d.CorrectCount,
				&d.EstimatedScore, &d.EstimatedBand, &sa, &cat)
		if err != nil {
			writeJSONError(w, "quiz_session_not_found", http.StatusNotFound)
			return
		}
		d.StartedAt = sa.UTC().Format(time.RFC3339)
		if cat != nil {
			cs := cat.UTC().Format(time.RFC3339)
			d.CompletedAt = &cs
		}

		// Load answers
		ansRows, _ := db.Query(r.Context(), `SELECT question_id, selected_index, correct, time_ms
			FROM assessment.quiz_answer WHERE session_id=$1 ORDER BY answered_at ASC`, id)
		d.Answers = []Answer{}
		if ansRows != nil {
			for ansRows.Next() {
				var a Answer
				if ansRows.Scan(&a.QuestionID, &a.SelectedIndex, &a.Correct, &a.TimeMs) == nil {
					d.Answers = append(d.Answers, a)
				}
			}
			ansRows.Close()
		}

		// Load audit
		d.Audit = []json.RawMessage{}
		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM admin.admin_audit_log WHERE target_id=$1 AND target_type='quiz_session'
			ORDER BY created_at DESC LIMIT 50`, id)
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var aca time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca) == nil {
					entry, _ := json.Marshal(map[string]any{
						"id": aid, "action": action, "actorId": actorID,
						"reason": reason, "before": before, "after": after,
						"createdAt": aca.UTC().Format(time.RFC3339),
					})
					d.Audit = append(d.Audit, entry)
				}
			}
			auditRows.Close()
		}

		writeJSON(w, http.StatusOK, d)
	}
}

// adminAssessmentQuizSessionAbortHandler implements POST /api/admin/assessment/quiz-sessions/{id}/abort.
func adminAssessmentQuizSessionAbortHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-sessions", 1)
		if id == "" {
			writeJSONError(w, "session id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM assessment.quiz_session WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "quiz_session_not_found", http.StatusNotFound)
			return
		}

		// Idempotent on terminal states
		if beforeStatus != "in_progress" {
			beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
			afterJSON, _ := json.Marshal(map[string]any{"status": beforeStatus, "noop": true})
			db.Exec(r.Context(), `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
				VALUES ('quiz_session.abort.noop',$1,$2,'quiz_session',$3,$4,$5,NOW())`,
				identity.ActorID, id, req.Reason, beforeJSON, afterJSON)
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": beforeStatus, "noop": true})
			return
		}

		_, err = db.Exec(r.Context(), `UPDATE assessment.quiz_session SET status='abandoned', completed_at=NOW(), updated_at=NOW() WHERE id=$1`, id)
		if err != nil {
			logger.Error("abort quiz session", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "abandoned"})
		db.Exec(r.Context(), `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('quiz_session.aborted',$1,$2,'quiz_session',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "abandoned"})
	}
}

// adminAssessmentQuizSessionExtendTimeHandler implements POST /api/admin/assessment/quiz-sessions/{id}/extend-time.
func adminAssessmentQuizSessionExtendTimeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-sessions", 1)
		if id == "" {
			writeJSONError(w, "session id required", http.StatusBadRequest)
			return
		}

		var req struct {
			AddSeconds int    `json:"addSeconds"`
			Reason     string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.AddSeconds < 1 {
			writeJSONError(w, "addSeconds must be positive", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		var beforeStatus string
		var beforeStartedAt time.Time
		err := db.QueryRow(r.Context(), "SELECT status, started_at FROM assessment.quiz_session WHERE id=$1", id).
			Scan(&beforeStatus, &beforeStartedAt)
		if err != nil {
			writeJSONError(w, "quiz_session_not_found", http.StatusNotFound)
			return
		}
		if beforeStatus != "in_progress" {
			writeJSONError(w, "only in_progress sessions can be extended", http.StatusBadRequest)
			return
		}

		// Shift started_at earlier by addSeconds to effectively extend the timer
		_, err = db.Exec(r.Context(), `UPDATE assessment.quiz_session SET
			started_at = started_at - ($1 || ' seconds')::interval, updated_at=NOW() WHERE id=$2`,
			req.AddSeconds, id)
		if err != nil {
			logger.Error("extend quiz session time", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"addSeconds": req.AddSeconds, "newStartedAt": beforeStartedAt.Add(-time.Duration(req.AddSeconds) * time.Second).UTC().Format(time.RFC3339)})
		db.Exec(r.Context(), `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('quiz_session.time_extended',$1,$2,'quiz_session',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "extended": true, "addSeconds": req.AddSeconds})
	}
}