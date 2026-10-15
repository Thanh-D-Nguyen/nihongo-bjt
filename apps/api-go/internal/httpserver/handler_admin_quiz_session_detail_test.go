package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAdminQuizSessionDetailReturnsPersistedSessionAndAnswers(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	ctx := context.Background()

	testID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,level,time_limit_seconds,updated_at)
		VALUES ($1,$2,'Quiz detail fixture','mock','draft','J4',600,now())`, testID, "quiz-detail-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID) })
	var sectionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section (test_id,code,title_vi,display_order)
		VALUES ($1,$2,'Detail section',1) RETURNING id::text`, testID, "DETAIL_"+testID[:8]).Scan(&sectionID); err != nil {
		t.Fatal(err)
	}
	var questionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_question (section_id,prompt,explanation_vi,skill_tag,difficulty,status,updated_at)
		VALUES ($1,'Detail question','Detail explanation','detail-skill','standard','published',now()) RETURNING id::text`, sectionID).Scan(&questionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id,option_key,text,is_correct)
		VALUES ($1,'A','Correct option',true),($1,'B','Wrong option',false)`, questionID); err != nil {
		t.Fatal(err)
	}
	sessionID, userID := newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.quiz_session (id,user_id,test_id,status,current_question_no,total_questions,correct_count,started_at)
		VALUES ($1,$2,$3,'completed',1,1,1,now()-interval '2 minutes')`, sessionID, userID, testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE id=$1`, sessionID) })
	if _, err := db.Exec(ctx, `INSERT INTO assessment.quiz_answer (session_id,question_id,selected_option,is_correct)
		VALUES ($1,$2,'A',true)`, sessionID, questionID); err != nil {
		t.Fatal(err)
	}
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@quiz-detail.example.com", "Quiz Detail Admin")
	grantAdminPermission(t, db, actorID, "assessment.manage")
	token := createAdminSession(t, sessions, actorID)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/assessment/quiz-sessions/"+sessionID, nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("detail status=%d body=%s, want 200 for persisted session", res.Code, res.Body.String())
	}
	var detail struct {
		ID             string `json:"id"`
		EstimatedScore *int   `json:"estimatedScore"`
		Test           struct {
			Slug             string `json:"slug"`
			TitleVi          string `json:"titleVi"`
			TimeLimitSeconds int    `json:"timeLimitSeconds"`
		} `json:"test"`
		Answers []struct {
			ID                string `json:"id"`
			SelectedOptionKey string `json:"selectedOptionKey"`
			IsCorrect         bool   `json:"isCorrect"`
			Question          struct {
				Prompt  string `json:"prompt"`
				Options []struct {
					OptionKey string `json:"optionKey"`
				} `json:"options"`
			} `json:"question"`
		} `json:"answers"`
		Breakdown struct {
			BySkill map[string]struct {
				Correct int `json:"correct"`
				Total   int `json:"total"`
			} `json:"bySkill"`
		} `json:"breakdown"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.ID != sessionID || detail.EstimatedScore != nil || detail.Test.Slug != "quiz-detail-"+testID || detail.Test.TitleVi != "Quiz detail fixture" || detail.Test.TimeLimitSeconds != 600 {
		t.Fatalf("unexpected session/test contract: %+v", detail)
	}
	if len(detail.Answers) != 1 || detail.Answers[0].ID == "" || detail.Answers[0].SelectedOptionKey != "A" || !detail.Answers[0].IsCorrect || detail.Answers[0].Question.Prompt != "Detail question" || len(detail.Answers[0].Question.Options) != 2 {
		t.Fatalf("unexpected answer contract: %+v", detail.Answers)
	}
	if got := detail.Breakdown.BySkill["detail-skill"]; got.Correct != 1 || got.Total != 1 {
		t.Fatalf("unexpected skill breakdown: %+v", detail.Breakdown.BySkill)
	}

	missing := httptest.NewRequest(http.MethodGet, "/api/admin/assessment/quiz-sessions/"+newUUID(t), nil)
	missing.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	missingRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(missingRes, missing)
	if missingRes.Code != http.StatusNotFound || !strings.Contains(missingRes.Body.String(), "quiz_session_not_found") {
		t.Fatalf("missing session status=%d body=%s, want 404", missingRes.Code, missingRes.Body.String())
	}
}

func TestAdminQuizTestsListReturnsPersistedRowsAndContractFields(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	testID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,time_limit_seconds,updated_at)
		VALUES ($1,$2,'Audit list fixture','mock','draft',600,now())`, testID, "admin-quiz-list-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID)
	})
	var sectionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section (test_id,code,title_vi,display_order)
		VALUES ($1,$2,'Audit list section',1) RETURNING id::text`, testID, "LIST_"+testID[:8]).Scan(&sectionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question (section_id,prompt,explanation_vi,skill_tag,updated_at)
		VALUES ($1,'Audit list question','Explanation','audit-list',now())`, sectionID); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/admin/quiz/tests?type=mock&status=draft", nil)
	response := httptest.NewRecorder()
	adminQuizTestsListHandler(db, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var body struct {
		Items []struct {
			ID              string `json:"id"`
			Title           string `json:"title"`
			Status          string `json:"status"`
			DurationMinutes int    `json:"durationMinutes"`
			QuestionCount   int    `json:"questionCount"`
			CreatedAt       string `json:"createdAt"`
			UpdatedAt       string `json:"updatedAt"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Total < 1 {
		t.Fatalf("total=%d; expected fixture in response %s", body.Total, response.Body.String())
	}
	for _, item := range body.Items {
		if item.ID != testID {
			continue
		}
		if item.Title != "Audit list fixture" || item.Status != "draft" || item.DurationMinutes != 10 || item.QuestionCount != 1 || item.CreatedAt == "" || item.UpdatedAt == "" {
			t.Fatalf("fixture contract fields=%+v", item)
		}
		return
	}
	t.Fatalf("fixture %s omitted despite total=%d; response=%s", testID, body.Total, response.Body.String())
}

func TestAdminQuizSessionListIncludesNullEstimatedScore(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	ctx := context.Background()
	testID, sessionID, userID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,level,updated_at)
		VALUES ($1,$2,'List fixture','mock','draft','J4',now())`, testID, "quiz-list-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID) })
	if _, err := db.Exec(ctx, `INSERT INTO assessment.quiz_session (id,user_id,test_id,status,current_question_no,total_questions,correct_count,started_at)
		VALUES ($1,$2,$3,'completed',0,1,0,now())`, sessionID, userID, testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE id=$1`, sessionID) })
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@quiz-list.example.com", "Quiz List Admin")
	grantAdminPermission(t, db, actorID, "assessment.manage")
	token := createAdminSession(t, sessions, actorID)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/assessment/quiz-sessions?page=1&pageSize=25", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s, want 200", res.Code, res.Body.String())
	}
	var result struct {
		Items []struct {
			ID             string `json:"id"`
			EstimatedScore *int   `json:"estimatedScore"`
			Test           struct {
				Slug             string `json:"slug"`
				TimeLimitSeconds *int   `json:"timeLimitSeconds"`
			} `json:"test"`
		} `json:"items"`
		Total    int `json:"total"`
		Page     int `json:"page"`
		PageSize int `json:"pageSize"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	for _, item := range result.Items {
		if item.ID == sessionID {
			if item.EstimatedScore != nil || item.Test.Slug != "quiz-list-"+testID || item.Test.TimeLimitSeconds != nil {
				t.Fatalf("unexpected listed session contract: %+v", item)
			}
			return
		}
	}
	t.Fatalf("list omitted persisted row with NULL estimated_score: total=%d page=%d pageSize=%d items=%+v", result.Total, result.Page, result.PageSize, result.Items)
}

func TestAdminQuizSessionExtendTimePersistsTimeAndAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	ctx := context.Background()
	testID, sessionID, userID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,level,time_limit_seconds,updated_at)
		VALUES ($1,$2,'Extension fixture','mock','draft','J4',600,now())`, testID, "quiz-extend-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID) })
	if _, err := db.Exec(ctx, `INSERT INTO assessment.quiz_session (id,user_id,test_id,status,current_question_no,total_questions,correct_count,started_at)
		VALUES ($1,$2,$3,'in_progress',0,1,0,now()-interval '5 minutes')`, sessionID, userID, testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND action='quiz_session.time_extended'`, sessionID)
		_, _ = db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE id=$1`, sessionID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@quiz-extend.example.com", "Quiz Extend Admin")
	grantAdminPermission(t, db, actorID, "assessment.manage")
	token := createAdminSession(t, sessions, actorID)
	var before time.Time
	if err := db.QueryRow(ctx, `SELECT started_at FROM assessment.quiz_session WHERE id=$1`, sessionID).Scan(&before); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/quiz-sessions/"+sessionID+"/extend-time", strings.NewReader(`{"addSeconds":120,"reason":"support extension"}`))
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("extend status=%d body=%s, want 200", res.Code, res.Body.String())
	}
	var result struct {
		ID         string `json:"id"`
		Extended   bool   `json:"extended"`
		AddSeconds int    `json:"addSeconds"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ID != sessionID || !result.Extended || result.AddSeconds != 120 {
		t.Fatalf("unexpected extension response: %+v", result)
	}
	var after time.Time
	if err := db.QueryRow(ctx, `SELECT started_at FROM assessment.quiz_session WHERE id=$1`, sessionID).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if delta := before.Sub(after); delta < 119*time.Second || delta > 121*time.Second {
		t.Fatalf("started_at shift=%s, want 120s", delta)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM ops.admin_audit_log WHERE action='quiz_session.time_extended' AND target_id=$1 AND reason='support extension'`, sessionID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 1 {
		t.Fatalf("extension audit rows=%d, want 1", auditCount)
	}
}

func TestAdminQuizSessionAbortPersistsStatusAndAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	ctx := context.Background()
	testID, sessionID, userID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,level,updated_at)
		VALUES ($1,$2,'Abort fixture','mock','draft','J4',now())`, testID, "quiz-abort-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID) })
	if _, err := db.Exec(ctx, `INSERT INTO assessment.quiz_session (id,user_id,test_id,status,current_question_no,total_questions,correct_count,started_at)
		VALUES ($1,$2,$3,'in_progress',0,1,0,now())`, sessionID, userID, testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND action='quiz_session.aborted'`, sessionID)
		_, _ = db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE id=$1`, sessionID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@quiz-abort.example.com", "Quiz Abort Admin")
	grantAdminPermission(t, db, actorID, "assessment.manage")
	token := createAdminSession(t, sessions, actorID)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/quiz-sessions/"+sessionID+"/abort", strings.NewReader(`{"reason":"integrity review"}`))
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("abort status=%d body=%s, want 200", res.Code, res.Body.String())
	}
	var result struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ID != sessionID || result.Status != "abandoned" {
		t.Fatalf("unexpected abort response: %+v", result)
	}
	var status string
	if err := db.QueryRow(ctx, `SELECT status FROM assessment.quiz_session WHERE id=$1`, sessionID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "abandoned" {
		t.Fatalf("persisted status=%s, want abandoned", status)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM ops.admin_audit_log WHERE action='quiz_session.aborted' AND target_id=$1 AND reason='integrity review'`, sessionID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 1 {
		t.Fatalf("abort audit rows=%d, want 1", auditCount)
	}
}
