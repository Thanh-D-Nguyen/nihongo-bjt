package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM assessment.bjt_mock_test "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count quiz tests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQ := fmt.Sprintf(`SELECT t.id, t.title_vi, t.type, t.status, COALESCE(t.time_limit_seconds / 60, 0),
			(SELECT COUNT(*) FROM assessment.bjt_question q JOIN assessment.bjt_test_section s ON s.id = q.section_id WHERE s.test_id = t.id),
			t.created_at, t.updated_at
			FROM assessment.bjt_mock_test t %s ORDER BY t.created_at DESC LIMIT $%d OFFSET $%d`,
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
			if err := rows.Scan(&t.ID, &t.Title, &t.Type, &t.Status, &t.DurationMinutes, &t.QuestionCount, &ca, &ua); err != nil {
				logger.Error("scan quiz test", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			t.CreatedAt = ca.UTC().Format(time.RFC3339)
			t.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, t)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate quiz tests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
			(SELECT COUNT(*) FROM assessment.quiz_answer WHERE question_id = assessment.bjt_question.id) as option_count
			FROM assessment.bjt_question ORDER BY created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("list quiz remediation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Item struct {
			ID                string  `json:"id"`
			Prompt            string  `json:"prompt"`
			SkillTag          string  `json:"skillTag"`
			Difficulty        string  `json:"difficulty"`
			RemediationCardID *string `json:"remediationCardId,omitempty"`
			ExplanationVi     string  `json:"explanationVi"`
			Status            string  `json:"status"`
			CreatedAt         string  `json:"createdAt"`
			HasRemediation    bool    `json:"hasRemediation"`
			HasExplanation    bool    `json:"hasExplanation"`
			OptionCount       int     `json:"optionCount"`
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
			(SELECT COUNT(*) FROM assessment.bjt_question_option WHERE question_id = assessment.bjt_question.id) as option_count
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM assessment.quiz_session qs "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count assessment quiz sessions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQ := fmt.Sprintf(`SELECT qs.id, qs.user_id, qs.test_id, qs.status, qs.current_question_no, qs.total_questions, qs.correct_count,
			qs.estimated_score, qs.estimated_bjt_band, qs.started_at, qs.completed_at,
			mt.id, mt.slug, mt.title_vi, mt.type, mt.level, mt.time_limit_seconds
			FROM assessment.quiz_session qs JOIN assessment.bjt_mock_test mt ON mt.id = qs.test_id
			%s ORDER BY qs.started_at DESC LIMIT $%d OFFSET $%d`,
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
			ID                string  `json:"id"`
			UserID            string  `json:"userId"`
			TestID            string  `json:"testId"`
			Status            string  `json:"status"`
			CurrentQuestionNo int     `json:"currentQuestionNo"`
			TotalQuestions    int     `json:"totalQuestions"`
			CorrectCount      int     `json:"correctCount"`
			EstimatedScore    *int    `json:"estimatedScore"`
			EstimatedBand     *string `json:"estimatedBjtBand,omitempty"`
			StartedAt         string  `json:"startedAt"`
			CompletedAt       *string `json:"completedAt,omitempty"`
			Test              struct {
				ID               string `json:"id"`
				Slug             string `json:"slug"`
				TitleVi          string `json:"titleVi"`
				Type             string `json:"type"`
				Level            string `json:"level"`
				TimeLimitSeconds *int   `json:"timeLimitSeconds"`
			} `json:"test"`
		}
		var items []Session
		for rows.Next() {
			var s Session
			var sa time.Time
			var cat *time.Time
			err := rows.Scan(&s.ID, &s.UserID, &s.TestID, &s.Status, &s.CurrentQuestionNo, &s.TotalQuestions, &s.CorrectCount,
				&s.EstimatedScore, &s.EstimatedBand, &sa, &cat, &s.Test.ID, &s.Test.Slug, &s.Test.TitleVi,
				&s.Test.Type, &s.Test.Level, &s.Test.TimeLimitSeconds)
			if err != nil {
				logger.Error("scan assessment quiz session", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			s.StartedAt = sa.UTC().Format(time.RFC3339)
			if cat != nil {
				cs := cat.UTC().Format(time.RFC3339)
				s.CompletedAt = &cs
			}
			items = append(items, s)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate assessment quiz sessions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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

		type Option struct {
			OptionKey string `json:"optionKey"`
			IsCorrect bool   `json:"isCorrect"`
			Text      string `json:"text"`
		}
		type Question struct {
			ID         string   `json:"id"`
			Prompt     string   `json:"prompt"`
			SkillTag   string   `json:"skillTag"`
			Difficulty string   `json:"difficulty"`
			SectionID  string   `json:"sectionId"`
			Options    []Option `json:"options"`
		}
		type Answer struct {
			ID                string   `json:"id"`
			QuestionID        string   `json:"questionId"`
			SelectedOptionKey string   `json:"selectedOptionKey"`
			IsCorrect         bool     `json:"isCorrect"`
			AnsweredAt        string   `json:"answeredAt"`
			Question          Question `json:"question"`
		}
		type BreakdownValue struct {
			Correct int `json:"correct"`
			Total   int `json:"total"`
		}
		type Detail struct {
			ID                string                               `json:"id"`
			UserID            string                               `json:"userId"`
			TestID            string                               `json:"testId"`
			Status            string                               `json:"status"`
			CurrentQuestionNo int                                  `json:"currentQuestionNo"`
			TotalQuestions    int                                  `json:"totalQuestions"`
			CorrectCount      int                                  `json:"correctCount"`
			EstimatedScore    *int                                 `json:"estimatedScore"`
			EstimatedBand     *string                              `json:"estimatedBjtBand"`
			StartedAt         string                               `json:"startedAt"`
			CompletedAt       *string                              `json:"completedAt"`
			ExpiresAt         *string                              `json:"expiresAt"`
			Test              map[string]any                       `json:"test"`
			Answers           []Answer                             `json:"answers"`
			Audit             []map[string]any                     `json:"audit"`
			Breakdown         map[string]map[string]BreakdownValue `json:"breakdown"`
		}
		var d Detail
		var sa time.Time
		var cat *time.Time
		var slug, titleVi, testType string
		var level *string
		var timeLimitSeconds *int
		err := db.QueryRow(r.Context(), `SELECT qs.id, qs.user_id, qs.test_id, qs.status, qs.current_question_no,
			qs.total_questions, qs.correct_count, qs.estimated_score, qs.estimated_bjt_band,
			qs.started_at, qs.completed_at, mt.slug, mt.title_vi, mt.type, mt.level, mt.time_limit_seconds
			FROM assessment.quiz_session qs
			JOIN assessment.bjt_mock_test mt ON mt.id=qs.test_id
			WHERE qs.id=$1`, id).Scan(&d.ID, &d.UserID, &d.TestID, &d.Status, &d.CurrentQuestionNo,
			&d.TotalQuestions, &d.CorrectCount, &d.EstimatedScore, &d.EstimatedBand, &sa, &cat,
			&slug, &titleVi, &testType, &level, &timeLimitSeconds)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "quiz_session_not_found", http.StatusNotFound)
				return
			}
			logger.Error("get assessment quiz session", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		d.StartedAt = sa.UTC().Format(time.RFC3339)
		d.Test = map[string]any{"id": d.TestID, "slug": slug, "titleVi": titleVi, "type": testType, "level": level, "timeLimitSeconds": timeLimitSeconds}
		if cat != nil {
			cs := cat.UTC().Format(time.RFC3339)
			d.CompletedAt = &cs
		}
		if d.Status == "in_progress" && timeLimitSeconds != nil && *timeLimitSeconds > 0 {
			expiresAt := sa.Add(time.Duration(*timeLimitSeconds) * time.Second).UTC().Format(time.RFC3339)
			d.ExpiresAt = &expiresAt
		}

		d.Breakdown = map[string]map[string]BreakdownValue{
			"bySkill": {}, "byDifficulty": {}, "bySection": {},
		}
		d.Answers = []Answer{}
		ansRows, err := db.Query(r.Context(), `SELECT qa.id, qa.question_id, qa.selected_option, qa.is_correct, qa.answered_at,
			q.prompt, q.skill_tag, q.difficulty, q.section_id,
			COALESCE(jsonb_agg(jsonb_build_object('optionKey', qo.option_key, 'isCorrect', qo.is_correct, 'text', qo.text)
				ORDER BY qo.option_key) FILTER (WHERE qo.id IS NOT NULL), '[]'::jsonb)
			FROM assessment.quiz_answer qa
			JOIN assessment.bjt_question q ON q.id=qa.question_id
			LEFT JOIN assessment.bjt_question_option qo ON qo.question_id=q.id
			WHERE qa.session_id=$1
			GROUP BY qa.id, q.id
			ORDER BY qa.answered_at ASC`, id)
		if err != nil {
			logger.Error("get assessment quiz answers", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for ansRows.Next() {
			var a Answer
			var answeredAt time.Time
			var options json.RawMessage
			if err := ansRows.Scan(&a.ID, &a.QuestionID, &a.SelectedOptionKey, &a.IsCorrect, &answeredAt,
				&a.Question.Prompt, &a.Question.SkillTag, &a.Question.Difficulty, &a.Question.SectionID, &options); err != nil {
				ansRows.Close()
				logger.Error("scan assessment quiz answer", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.Question.ID = a.QuestionID
			a.Question.Options = []Option{}
			if err := json.Unmarshal(options, &a.Question.Options); err != nil {
				ansRows.Close()
				logger.Error("decode assessment quiz answer options", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.AnsweredAt = answeredAt.UTC().Format(time.RFC3339)
			d.Answers = append(d.Answers, a)
			for key, val := range map[string]string{"bySkill": a.Question.SkillTag, "byDifficulty": a.Question.Difficulty, "bySection": a.Question.SectionID} {
				value := d.Breakdown[key][val]
				value.Total++
				if a.IsCorrect {
					value.Correct++
				}
				d.Breakdown[key][val] = value
			}
		}
		if err := ansRows.Err(); err != nil {
			ansRows.Close()
			logger.Error("iterate assessment quiz answers", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		ansRows.Close()

		d.Audit = []map[string]any{}
		auditRows, err := db.Query(r.Context(), `SELECT l.id, l.action, l.reason, l.created_at, a.id, a.display_name, a.email
			FROM ops.admin_audit_log l
			JOIN authz.admin_actor a ON a.id=l.actor_id
			WHERE l.target_id=$1 AND l.target_type='quiz_session'
			ORDER BY l.created_at DESC LIMIT 50`, id)
		if err != nil {
			logger.Error("get assessment quiz session audit", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for auditRows.Next() {
			var auditID, action, actorID, displayName, email string
			var reason *string
			var createdAt time.Time
			if err := auditRows.Scan(&auditID, &action, &reason, &createdAt, &actorID, &displayName, &email); err != nil {
				auditRows.Close()
				logger.Error("scan assessment quiz session audit", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			d.Audit = append(d.Audit, map[string]any{"id": auditID, "action": action, "reason": reason,
				"createdAt": createdAt.UTC().Format(time.RFC3339),
				"actor":     map[string]string{"id": actorID, "displayName": displayName, "email": email}})
		}
		if err := auditRows.Err(); err != nil {
			auditRows.Close()
			logger.Error("iterate assessment quiz session audit", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		auditRows.Close()

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

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin quiz session abort", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM assessment.quiz_session WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "quiz_session_not_found", http.StatusNotFound)
			} else {
				logger.Error("load quiz session for abort", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		// Idempotent on terminal states
		if beforeStatus != "in_progress" {
			beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
			afterJSON, _ := json.Marshal(map[string]any{"status": beforeStatus, "noop": true})
			if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
				VALUES ('quiz_session.abort.noop',$1,$2,'quiz_session',$3,$4,$5,NOW())`,
				identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
				logger.Error("audit quiz session abort no-op", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if err := tx.Commit(r.Context()); err != nil {
				logger.Error("commit quiz session abort no-op", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": beforeStatus, "noop": true})
			return
		}

		_, err = tx.Exec(r.Context(), `UPDATE assessment.quiz_session SET status='abandoned', completed_at=NOW() WHERE id=$1`, id)
		if err != nil {
			logger.Error("abort quiz session", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "abandoned"})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('quiz_session.aborted',$1,$2,'quiz_session',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit quiz session abort", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit quiz session abort", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin quiz session extension", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		var beforeStartedAt time.Time
		err = tx.QueryRow(r.Context(), "SELECT status, started_at FROM assessment.quiz_session WHERE id=$1 FOR UPDATE", id).
			Scan(&beforeStatus, &beforeStartedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "quiz_session_not_found", http.StatusNotFound)
			} else {
				logger.Error("load quiz session for extension", "session_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		if beforeStatus != "in_progress" {
			writeJSONError(w, "only in_progress sessions can be extended", http.StatusBadRequest)
			return
		}

		// Shift started_at earlier by addSeconds to effectively extend the timer
		_, err = tx.Exec(r.Context(), `UPDATE assessment.quiz_session SET
			started_at = started_at - ($1::int * INTERVAL '1 second') WHERE id=$2`,
			req.AddSeconds, id)
		if err != nil {
			logger.Error("extend quiz session time", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"addSeconds": req.AddSeconds, "newStartedAt": beforeStartedAt.Add(-time.Duration(req.AddSeconds) * time.Second).UTC().Format(time.RFC3339)})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('quiz_session.time_extended',$1,$2,'quiz_session',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON); err != nil {
			logger.Error("audit quiz session extension", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit quiz session extension", "session_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "extended": true, "addSeconds": req.AddSeconds})
	}
}
