package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAdminContentCreatePersistsTypedContentAndAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-create.example.com", "Content Create Admin")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	for _, fixture := range []struct{ kind, unique, extras, table, column, target string }{
		{"lexeme", "AUDIT-CONTENT-" + newUUID(t), `"reading":"てすと","shortMeaningVi":"mục kiểm tra"`, "lexeme", "headword", "content.lexeme"},
		{"kanji", "𠀀", `"meaningVi":"mục kiểm tra","level":2,"strokeCount":8`, "kanji", "character", "content.kanji"},
		{"grammar", "AUDIT-GRAMMAR-" + newUUID(t), `"meaningVi":"mục kiểm tra","jlptLevel":"N3","category":"fixture"`, "grammar_point", "pattern", "content.grammar_point"},
	} {
		t.Run(fixture.kind, func(t *testing.T) {
			field := map[string]string{"lexeme": "headword", "kanji": "character", "grammar": "pattern"}[fixture.kind]
			body := fmt.Sprintf(`{"type":%q,%q:%q,"status":"needs_review",%s}`, fixture.kind, field, fixture.unique, fixture.extras)
			req := httptest.NewRequest(http.MethodPost, "/api/admin/content", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusCreated {
				t.Fatalf("create status=%d body=%s; want 201", res.Code, res.Body.String())
			}
			var result struct {
				ID string `json:"id"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil || result.ID == "" {
				t.Fatalf("response has no persisted id: body=%s err=%v", res.Body.String(), err)
			}
			t.Cleanup(func() {
				_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, result.ID)
				_, _ = db.Exec(context.Background(), `DELETE FROM content.`+fixture.table+` WHERE id=$1`, result.ID)
			})
			var stored string
			query := `SELECT ` + fixture.column + ` FROM content.` + fixture.table + ` WHERE id=$1`
			if err := db.QueryRow(context.Background(), query, result.ID).Scan(&stored); err != nil || stored != fixture.unique {
				t.Fatalf("persisted %s=%q err=%v; want %q", fixture.column, stored, err, fixture.unique)
			}
			assertAdminAuditEvent(t, db, actorID, "admin.content.created", fixture.target, result.ID)
		})
	}
}

func TestAdminContentCreateRequiresWritePermission(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-create-denied.example.com", "Content Read Only Admin")
	token := createAdminSession(t, sessions, actorID)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/content", strings.NewReader(`{"type":"lexeme","headword":"must-not-persist"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("create status=%d body=%s; want 403", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM content.lexeme WHERE headword='must-not-persist'`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("unauthorized create persisted count=%d err=%v", count, err)
	}
}

func TestAdminContentCreateRollsBackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-create-audit.example.com", "Content Audit Admin")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	rejectContentAuditAction(t, db, actorID, "admin.content.created")
	token := createAdminSession(t, sessions, actorID)
	headword := "AUDIT-ROLLBACK-" + newUUID(t)
	body := fmt.Sprintf(`{"type":"lexeme","headword":%q}`, headword)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/content", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("create status=%d body=%s; want 500 when audit fails", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM content.lexeme WHERE headword=$1`, headword).Scan(&count); err != nil || count != 0 {
		t.Fatalf("content count=%d after audit failure err=%v; want rollback", count, err)
	}
}

func rejectContentAuditAction(t *testing.T, db *pgxpool.Pool, actorID, action string) {
	t.Helper()
	name := "reject_content_create_audit_" + strings.ReplaceAll(actorID, "-", "")
	function := "ops." + name
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.action = '%s' AND NEW.actor_id = '%s'::uuid THEN RAISE EXCEPTION 'audit rejected'; END IF;
			RETURN NEW;
		END $$`, function, action, actorID)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION %s()`, name, function)); err != nil {
		_, _ = db.Exec(context.Background(), `DROP FUNCTION `+function+`()`)
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DROP TRIGGER IF EXISTS `+name+` ON ops.admin_audit_log`)
		_, _ = db.Exec(context.Background(), `DROP FUNCTION IF EXISTS `+function+`()`)
	})
}
