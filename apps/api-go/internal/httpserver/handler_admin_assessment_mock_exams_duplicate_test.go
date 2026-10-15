package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminMockExamDuplicateCopiesSectionsQuestionsAndOptions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	ctx := context.Background()
	sourceID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Duplicate fixture','mock','published',now())`, sourceID, "audit-duplicate-"+sourceID); err != nil {
		t.Fatalf("create source exam: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, sourceID) })

	sectionIDs := make([]string, 2)
	for i, code := range []string{"AUDIT_DUP_ONE", "AUDIT_DUP_TWO"} {
		if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section (test_id,code,title_vi,display_order) VALUES ($1,$2,$3,$4) RETURNING id::text`, sourceID, code, fmt.Sprintf("Duplicate section %d", i+1), i+1).Scan(&sectionIDs[i]); err != nil {
			t.Fatalf("create source section: %v", err)
		}
	}
	var sourceQuestionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_question (section_id,prompt,explanation_vi,skill_tag,updated_at) VALUES ($1,'Unique duplicate fixture prompt','Fixture explanation','AUDIT',now()) RETURNING id::text`, sectionIDs[0]).Scan(&sourceQuestionID); err != nil {
		t.Fatalf("create source question: %v", err)
	}
	for _, option := range []struct {
		key       string
		text      string
		isCorrect bool
	}{{"A", "Wrong answer", false}, {"B", "Correct answer", true}} {
		if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id,option_key,text,is_correct) VALUES ($1,$2,$3,$4)`, sourceQuestionID, option.key, option.text, option.isCorrect); err != nil {
			t.Fatalf("create source option: %v", err)
		}
	}

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@duplicate.example.com", "Duplicate Admin")
	token := createAdminSession(t, sessions, actorID)
	body, _ := json.Marshal(map[string]string{"reason": "copy fixture for regression coverage"})
	unauthorized := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/mock-exams/"+sourceID+"/duplicate", bytes.NewReader(body))
	unauthorized.Header.Set("Content-Type", "application/json")
	unauthorized.Header.Set("Origin", "http://localhost:3000")
	unauthorized.Header.Set("X-CSRF-Token", "test-csrf")
	unauthorizedResponse := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(unauthorizedResponse, unauthorized)
	if unauthorizedResponse.Code != http.StatusUnauthorized {
		t.Fatalf("duplicate without an Admin session status=%d, want 401; body=%s", unauthorizedResponse.Code, unauthorizedResponse.Body.String())
	}
	underprivileged := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/mock-exams/"+sourceID+"/duplicate", bytes.NewReader(body))
	underprivileged.Header.Set("Content-Type", "application/json")
	underprivileged.Header.Set("Origin", "http://localhost:3000")
	underprivileged.Header.Set("X-CSRF-Token", "test-csrf")
	underprivileged.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	underprivilegedResponse := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(underprivilegedResponse, underprivileged)
	if underprivilegedResponse.Code != http.StatusForbidden {
		t.Fatalf("duplicate without admin.content.write status=%d, want 403; body=%s", underprivilegedResponse.Code, underprivilegedResponse.Body.String())
	}
	grantAdminPermission(t, db, actorID, "admin.content.write")

	req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/mock-exams/"+sourceID+"/duplicate", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("duplicate status=%d body=%s", res.Code, res.Body.String())
	}

	var result struct {
		ID       string `json:"id"`
		Slug     string `json:"slug"`
		Status   string `json:"status"`
		Sections []struct {
			Code          string `json:"code"`
			DisplayOrder  int    `json:"displayOrder"`
			QuestionCount int    `json:"questionCount"`
		} `json:"sections"`
		Audit []struct {
			Reason string `json:"reason"`
		} `json:"audit"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode duplicate response: %v", err)
	}
	if result.ID == "" || result.ID == sourceID || result.Slug == "" || result.Slug == "audit-duplicate-"+sourceID || result.Status != "draft" {
		t.Fatalf("duplicate identity/state not fresh draft: %+v", result)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, result.ID) })
	if len(result.Sections) != 2 || result.Sections[0].Code != "AUDIT_DUP_ONE" || result.Sections[0].DisplayOrder != 1 || result.Sections[0].QuestionCount != 1 || result.Sections[1].Code != "AUDIT_DUP_TWO" || result.Sections[1].DisplayOrder != 2 || result.Sections[1].QuestionCount != 0 {
		t.Fatalf("copied section contract mismatch: %+v", result.Sections)
	}
	if len(result.Audit) == 0 || result.Audit[0].Reason != "copy fixture for regression coverage" {
		t.Fatalf("duplicate audit reason missing: %+v", result.Audit)
	}

	var copiedQuestionID string
	if err := db.QueryRow(ctx, `SELECT q.id::text FROM assessment.bjt_question q JOIN assessment.bjt_test_section s ON s.id=q.section_id WHERE s.test_id=$1 AND q.prompt='Unique duplicate fixture prompt'`, result.ID).Scan(&copiedQuestionID); err != nil {
		t.Fatalf("copied question missing: %v", err)
	}
	if copiedQuestionID == sourceQuestionID {
		t.Fatal("duplicate reused source question id")
	}
	var optionCount, correctCount int
	if err := db.QueryRow(ctx, `SELECT count(*),count(*) FILTER (WHERE is_correct) FROM assessment.bjt_question_option WHERE question_id=$1`, copiedQuestionID).Scan(&optionCount, &correctCount); err != nil {
		t.Fatal(err)
	}
	if optionCount != 2 || correctCount != 1 {
		t.Fatalf("copied options=(%d total,%d correct), want (2,1)", optionCount, correctCount)
	}
}
