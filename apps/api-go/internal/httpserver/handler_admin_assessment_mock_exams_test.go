package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
)

func TestAdminMockExamDetailReturnsPersistedSections(t *testing.T) {
	db := testPool(t)
	id := newUUID(t)
	slug := "local-audit-" + id
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Audit fixture','mock','draft',now())`, id, slug); err != nil {
		t.Fatalf("create mock exam fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, id) })
	var firstSectionID string
	for i, code := range []string{"AUDIT_ONE", "AUDIT_TWO"} {
		var sectionID string
		if err := db.QueryRow(context.Background(), `INSERT INTO assessment.bjt_test_section (test_id,code,title_vi,display_order) VALUES ($1,$2,$3,$4) RETURNING id::text`, id, code, fmt.Sprintf("Audit section %d", i+1), i+1).Scan(&sectionID); err != nil {
			t.Fatalf("create section fixture: %v", err)
		}
		if i == 0 {
			firstSectionID = sectionID
		}
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.bjt_question (section_id,prompt,explanation_vi,skill_tag,updated_at) VALUES ($1,'Fixture question','Fixture explanation','AUDIT',now())`, firstSectionID); err != nil {
		t.Fatalf("create question fixture: %v", err)
	}
	req := httptest.NewRequest("GET", "/api/admin/assessment/mock-exams/"+id, nil)
	res := httptest.NewRecorder()
	adminAssessmentMockExamsDetailHandler(db, slog.New(slog.NewTextHandler(io.Discard, nil))).ServeHTTP(res, req)
	if res.Code != 200 {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	var body struct {
		Sections []struct {
			Code          string `json:"code"`
			DisplayOrder  int    `json:"displayOrder"`
			QuestionCount int    `json:"questionCount"`
		} `json:"sections"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Sections) != 2 {
		t.Fatalf("detail returned %d sections, want 2; response=%s", len(body.Sections), res.Body.String())
	}
	for i, section := range body.Sections {
		if section.Code == "" || section.DisplayOrder != i+1 {
			t.Errorf("sections[%d]=%+v; want nonempty code and display order %d", i, section, i+1)
		}
	}
	if body.Sections[0].QuestionCount != 1 || body.Sections[1].QuestionCount != 0 {
		t.Errorf("question counts = [%d,%d], want [1,0]", body.Sections[0].QuestionCount, body.Sections[1].QuestionCount)
	}
}
