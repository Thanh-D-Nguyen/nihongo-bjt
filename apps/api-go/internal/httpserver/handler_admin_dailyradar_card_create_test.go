package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminDailyRadarCardCreateRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@daily-radar-denied.example.com", "Daily Radar Denied")
	token := createAdminSession(t, sessions, actorID)
	slug := "audit-daily-radar-denied-" + actorID[:8]
	body := fmt.Sprintf(`{"slug":%q,"titleVi":"Denied card","category":"daily","moduleType":"reading","ctaLabelVi":"Open"}`, slug)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/daily-radar/cards", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("roleless create status=%d body=%s; want 403", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM daily.daily_radar_card WHERE slug=$1`, slug).Scan(&count); err != nil || count != 0 {
		t.Fatalf("unauthorized request persisted a card: count=%d err=%v", count, err)
	}
}

func TestAdminDailyRadarCardCreatePersistsCanonicalCardAndAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@daily-radar-create.example.com", "Daily Radar Creator")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	moduleKey := "audit-daily-radar-module-" + actorID[:8]
	var moduleID string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
		VALUES($1,'Audit module','監査','Fixture','daily','reading','draft',true,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	slug := "audit-daily-radar-card-" + actorID[:8]
	body := fmt.Sprintf(`{"moduleConfigId":%q,"slug":%q,"titleVi":"Create fixture","descriptionVi":"Persisted fixture","category":"daily","moduleType":"reading","ctaLabelVi":"Open","status":"draft","priority":3}`, moduleID, slug)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/daily-radar/cards", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("authorized create status=%d body=%s; want 201", res.Code, res.Body.String())
	}
	var result struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ID == "" || result.Status != "draft" {
		t.Fatalf("unexpected create response: %+v", result)
	}
	defer db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, result.ID)
	var title, auditAction string
	var priority int
	if err := db.QueryRow(context.Background(), `SELECT title_vi,priority FROM daily.daily_radar_card WHERE id=$1`, result.ID).Scan(&title, &priority); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT action FROM ops.admin_audit_log WHERE target_id=$1`, result.ID).Scan(&auditAction); err != nil {
		t.Fatal(err)
	}
	if title != "Create fixture" || priority != 3 || auditAction != "daily_radar.card.created" {
		t.Fatalf("persisted card/audit mismatch: title=%q priority=%d action=%q", title, priority, auditAction)
	}
}
