package httpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminDailyRadarCardPublishRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar reader", actorID+"@example.com")
	_, cardID := seedDailyRadarCard(t, db, "audit-publish-denied")
	server, sessions := adminRBACTestServerWithPool(t, db)
	defer server.Close()

	request := dailyRadarPublishRequest(t, sessions, actorID, cardID, "http://localhost:3000")
	response := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("roleless publish status=%d body=%s; want 403", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("roleless publish changed status to %q", status)
	}
}

func TestAdminDailyRadarCardPublishRequiresTrustedOrigin(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	_, cardID := seedDailyRadarCard(t, db, "audit-publish-origin")
	server, sessions := adminRBACTestServerWithPool(t, db)
	defer server.Close()

	request := dailyRadarPublishRequest(t, sessions, actorID, cardID, "https://attacker.example")
	response := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin publish status=%d body=%s; want 403", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("untrusted-origin publish changed status to %q", status)
	}
}

func TestAdminDailyRadarCardPublishPersistsAndAudits(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	_, cardID := seedDailyRadarCard(t, db, "audit-publish-success")
	server, sessions := adminRBACTestServerWithPool(t, db)
	defer server.Close()
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, cardID)
	})

	request := dailyRadarPublishRequest(t, sessions, actorID, cardID, "http://localhost:3000")
	response := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("authorized publish status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var status string
	var updatedAt *string
	if err := db.QueryRow(context.Background(), `SELECT status,updated_at::text FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&status, &updatedAt); err != nil {
		t.Fatal(err)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='daily_radar.card.published'`, actorID, cardID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if status != "published" || updatedAt == nil || audits != 1 {
		t.Fatalf("published status=%q updated_at=%v audit rows=%d; want published, timestamp and one audit", status, updatedAt, audits)
	}

	missing := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(missing, dailyRadarPublishRequest(t, sessions, actorID, "00000000-0000-4000-8000-000000000000", "http://localhost:3000"))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing card publish status=%d; want 404", missing.Code)
	}
}

func TestAdminDailyRadarModuleDetailReturnsPersistedContract(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar reader", actorID+"@example.com")
	moduleID, _ := seedDailyRadarCard(t, db, "audit-module-detail")
	response := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodGet, "/api/admin/daily-radar/modules/"+moduleID, nil)
	if response.Code != http.StatusOK {
		t.Fatalf("module detail status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	unauthorized := httptest.NewRecorder()
	buildDailyRadarTestRouter(db).ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/admin/daily-radar/modules/"+moduleID, nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous module detail status=%d; want 401", unauthorized.Code)
	}
	for _, field := range []string{`"id":"` + moduleID + `"`, `"key":"audit-module-detail`, `"title":"Patch fixture module`, `"status":"draft"`, `"createdAt":`, `"updatedAt":`} {
		if !strings.Contains(response.Body.String(), field) {
			t.Errorf("module detail response missing %s: %s", field, response.Body.String())
		}
	}
	missing := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodGet, "/api/admin/daily-radar/modules/00000000-0000-4000-8000-000000000000", nil)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing module detail status=%d; want 404", missing.Code)
	}
}

func TestAdminDailyRadarModuleArchiveRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar reader", actorID+"@example.com")
	moduleID, _ := seedDailyRadarCard(t, db, "audit-module-archive-denied")
	response := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodPost, "/api/admin/daily-radar/modules/"+moduleID+"/archive", nil)
	if response.Code != http.StatusForbidden {
		t.Fatalf("roleless module archive status=%d body=%s; want 403", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_module_config WHERE id=$1`, moduleID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("roleless module archive changed status to %q", status)
	}
}

func TestAdminDailyRadarModuleArchiveRequiresTrustedOrigin(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	moduleID, _ := seedDailyRadarCard(t, db, "audit-module-archive-origin")
	request := httptest.NewRequest(http.MethodPost, "/api/admin/daily-radar/modules/"+moduleID+"/archive", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, session.NewStore(db), actorID)})
	request.Header.Set("Origin", "https://attacker.example")
	response := httptest.NewRecorder()
	buildDailyRadarTestRouter(db).ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin module archive status=%d body=%s; want 403", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_module_config WHERE id=$1`, moduleID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("untrusted-origin module archive changed status to %q", status)
	}
}

func TestAdminDailyRadarModuleArchivePersistsAndAudits(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	moduleID, _ := seedDailyRadarCard(t, db, "audit-module-archive-success")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2`, actorID, moduleID)
	})
	response := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodPost, "/api/admin/daily-radar/modules/"+moduleID+"/archive", nil)
	if response.Code != http.StatusOK {
		t.Fatalf("authorized archive status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_module_config WHERE id=$1`, moduleID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='daily_radar.module.archived'`, actorID, moduleID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if status != "archived" || audits != 1 {
		t.Fatalf("archived status=%q audit rows=%d; want archived and one audit", status, audits)
	}
	missing := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodPost, "/api/admin/daily-radar/modules/00000000-0000-4000-8000-000000000000/archive", nil)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing module archive status=%d; want 404", missing.Code)
	}
}

func TestAdminDailyRadarModuleArchiveRollsBackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	moduleID, _ := seedDailyRadarCard(t, db, "audit-module-archive-rollback")
	functionName := "audit122_fail_module_archive_" + strings.ReplaceAll(actorID, "-", "")
	triggerName := "audit122_reject_module_archive_" + strings.ReplaceAll(actorID, "-", "")
	if _, err := db.Exec(context.Background(), `CREATE FUNCTION public.`+functionName+`() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='daily_radar.module.archived' AND NEW.target_id='`+moduleID+`' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `CREATE TRIGGER `+triggerName+` BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.`+functionName+`() `); err != nil {
		_, _ = db.Exec(context.Background(), `DROP FUNCTION public.`+functionName+`() `)
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DROP TRIGGER IF EXISTS `+triggerName+` ON ops.admin_audit_log`)
		_, _ = db.Exec(context.Background(), `DROP FUNCTION IF EXISTS public.`+functionName+`() `)
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2`, actorID, moduleID)
	})

	response := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodPost, "/api/admin/daily-radar/modules/"+moduleID+"/archive", nil)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("archive status after audit failure=%d body=%s; want 500", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_module_config WHERE id=$1`, moduleID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("module status after failed audit=%q; want draft", status)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='daily_radar.module.archived'`, actorID, moduleID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if audits != 0 {
		t.Fatalf("failed archive wrote %d audit rows; want none", audits)
	}
}

func dailyRadarPublishRequest(t *testing.T, sessions *session.Store, actorID, cardID, origin string) *http.Request {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/api/admin/daily-radar/cards/"+cardID+"/publish", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
	request.Header.Set("Origin", origin)
	return request
}
