package httpserver

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAdminCompanionConfigReturnsServerErrorWhenDatabaseQueriesFail(t *testing.T) {
	db := testPool(t)
	db.Close()
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/companion/config", nil)
	adminCompanionConfigHandler(db, slog.Default()).ServeHTTP(response, request)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d, want 500; body=%s", response.Code, response.Body.String())
	}
}

func TestAdminCompanionTipCreateRollsBackWhenAuditWriteFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@companion-audit.example.com", "Companion audit test")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	rejectCompanionAuditAction(t, db, actorID, "companion.tip.created")

	contentJa := "AUDIT companion tip " + actorID
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.companion_tip WHERE content_ja=$1`, contentJa)
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/companion/tips", strings.NewReader(fmt.Sprintf(`{"category":"culture","contentJa":%q,"contentVi":"disposable"}`, contentJa)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("create status=%d body=%s; want 500 when audit write fails", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM content.companion_tip WHERE content_ja=$1`, contentJa).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("tip count=%d after rejected audit; want rolled-back create", count)
	}
}

func TestAdminCompanionTipPatchRollsBackWhenAuditWriteFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, tipID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@companion-patch-audit.example.com", "Companion patch audit test")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(ctx, `INSERT INTO content.companion_tip (id,category,content_ja,content_vi) VALUES ($1,'culture',$2,'before')`, tipID, actorID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.companion_tip WHERE id=$1`, tipID) })
	rejectCompanionAuditAction(t, db, actorID, "companion.tip.updated")
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/companion/tips/"+tipID, strings.NewReader(`{"contentJa":"after"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("patch status=%d body=%s; want 500 when audit write fails", res.Code, res.Body.String())
	}
	var contentJa string
	if err := db.QueryRow(ctx, `SELECT content_ja FROM content.companion_tip WHERE id=$1`, tipID).Scan(&contentJa); err != nil {
		t.Fatal(err)
	}
	if contentJa != actorID {
		t.Fatalf("contentJa=%q after rejected audit; want original %q", contentJa, actorID)
	}
}

func TestAdminCompanionTipDeleteRollsBackWhenAuditWriteFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, tipID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@companion-delete-audit.example.com", "Companion delete audit test")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(ctx, `INSERT INTO content.companion_tip (id,category,content_ja,content_vi) VALUES ($1,'culture',$2,'disposable')`, tipID, actorID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.companion_tip WHERE id=$1`, tipID) })
	rejectCompanionAuditAction(t, db, actorID, "companion.tip.deleted")
	req := httptest.NewRequest(http.MethodDelete, "/api/admin/companion/tips/"+tipID, nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("delete status=%d body=%s; want 500 when audit write fails", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM content.companion_tip WHERE id=$1`, tipID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("tip count=%d after rejected audit; want deleted row rolled back", count)
	}
}

func rejectCompanionAuditAction(t *testing.T, db *pgxpool.Pool, actorID, action string) {
	t.Helper()
	triggerName := "reject_companion_audit_" + strings.ReplaceAll(actorID, "-", "")
	functionName := "ops." + triggerName
	_, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.action = '%s' AND NEW.actor_id = '%s'::uuid THEN
				RAISE EXCEPTION 'disposable audit rejection';
			END IF;
			RETURN NEW;
		END
		$$`, functionName, action, actorID))
	if err != nil {
		t.Fatalf("create disposable audit trigger function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION %s()`, triggerName, functionName)); err != nil {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION %s()`, functionName))
		t.Fatalf("create disposable audit trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON ops.admin_audit_log`, triggerName))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS %s()`, functionName))
	})
}
