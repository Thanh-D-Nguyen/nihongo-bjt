package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminContentStatusPatchRollsBackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-status.example.com", "Content Status Admin")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	rejectContentAuditAction(t, db, actorID, "admin.content.status.updated")
	token := createAdminSession(t, sessions, actorID)
	itemID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,status,created_at,updated_at) VALUES ($1,'AUDIT-STATUS-FIXTURE','needs_review',NOW(),NOW())`, itemID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, itemID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, itemID)
	})
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content/lexeme/"+itemID+"/status", strings.NewReader(fmt.Sprintf(`{"status":"active","reason":"publish fixture"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("status patch status=%d body=%s; want 500 when audit fails", res.Code, res.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM content.lexeme WHERE id=$1`, itemID).Scan(&status); err != nil || status != "needs_review" {
		t.Fatalf("status=%q err=%v after audit failure; want needs_review rollback", status, err)
	}
}
