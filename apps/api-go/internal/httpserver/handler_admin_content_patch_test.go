package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminContentPatchPersistsAndAuditsLexeme(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-patch.example.com", "Content Editor")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	itemID := newUUID(t)
	before := "AUDIT-PATCH-BEFORE-" + newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,status,created_at,updated_at) VALUES ($1,$2,'needs_review',NOW(),NOW())`, itemID, before); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, itemID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, itemID)
	})
	updated := "AUDIT-PATCH-AFTER-" + newUUID(t)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content/lexeme/"+itemID, strings.NewReader(fmt.Sprintf(`{"headword":%q,"reason":"audit patch"}`, updated)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("patch status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var stored string
	if err := db.QueryRow(context.Background(), `SELECT headword FROM content.lexeme WHERE id=$1`, itemID).Scan(&stored); err != nil || stored != updated {
		t.Fatalf("stored headword=%q err=%v; want %q", stored, err, updated)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.content.updated", "content.lexeme", itemID)
}
