package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminMockExamPublishDoesNotReportSuccessWhenStatusWriteFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	ctx := context.Background()
	id := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Publish failure fixture','mock','draft',now())`, id, "audit-publish-failure-"+id); err != nil {
		t.Fatalf("create draft fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, id) })

	constraint := "reject_publish_" + strings.ReplaceAll(id, "-", "")
	if _, err := db.Exec(ctx, fmt.Sprintf(`ALTER TABLE assessment.bjt_mock_test ADD CONSTRAINT %s CHECK (id <> '%s'::uuid OR status <> 'published') NOT VALID`, constraint, id)); err != nil {
		t.Fatalf("force status update rejection: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, fmt.Sprintf(`ALTER TABLE assessment.bjt_mock_test DROP CONSTRAINT %s`, constraint))
	})

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@publish.example.com", "Publish Admin")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/mock-exams/"+id+"/publish", strings.NewReader(`{"reason":"forced persistence failure"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("publish status=%d body=%s, want 500 when status persistence fails", res.Code, res.Body.String())
	}
	var status string
	if err := db.QueryRow(ctx, `SELECT status FROM assessment.bjt_mock_test WHERE id=$1`, id).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("failed publish persisted status %q, want draft", status)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.assessment.mock_exam.published'`, id).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 0 {
		t.Fatalf("failed publish wrote %d audit events, want none", auditCount)
	}
}
