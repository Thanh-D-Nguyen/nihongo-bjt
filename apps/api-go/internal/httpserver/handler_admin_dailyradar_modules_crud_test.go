package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminDailyRadarModuleCreateContract(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar editor", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	store := session.NewStore(db)
	router := buildDailyRadarTestRouter(db)

	moduleKey := "audit-module-crud-" + strings.ReplaceAll(newUUID(t), "-", "")[:12]
	createBody := map[string]any{
		"moduleKey": moduleKey, "titleVi": "Audit module", "titleJa": "監査モジュール",
		"descriptionVi": "Disposable module fixture", "category": "life", "moduleType": "content",
		"status": "draft", "isEnabled": true, "isSpotlightEligible": false,
		"defaultPriority": 17, "visualTheme": "green_life", "routePath": "/vi/audit",
		"metadata": map[string]any{"fixture": true},
	}
	created := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/daily-radar/modules", createBody)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s; want 201", created.Code, created.Body.String())
	}
	var createdBody struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createdBody); err != nil || createdBody.ID == "" {
		t.Fatalf("create response missing id: %s (decode error: %v)", created.Body.String(), err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2`, actorID, createdBody.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, createdBody.ID)
	})

	var titleVi, titleJa, description, category, moduleType, status string
	var enabled, spotlight bool
	var priority int
	var visualTheme, routePath *string
	err := db.QueryRow(context.Background(), `SELECT title_vi,title_ja,description_vi,category,module_type,status,is_enabled,is_spotlight_eligible,default_priority,visual_theme,route_path FROM daily.daily_radar_module_config WHERE id=$1`, createdBody.ID).
		Scan(&titleVi, &titleJa, &description, &category, &moduleType, &status, &enabled, &spotlight, &priority, &visualTheme, &routePath)
	if err != nil {
		t.Fatal(err)
	}
	if titleVi != "Audit module" || titleJa != "監査モジュール" || description != "Disposable module fixture" || category != "life" || moduleType != "content" || status != "draft" || !enabled || spotlight || priority != 17 || visualTheme == nil || *visualTheme != "green_life" || routePath == nil || *routePath != "/vi/audit" {
		t.Fatalf("created module does not preserve UI payload: %+v", map[string]any{"titleVi": titleVi, "titleJa": titleJa, "description": description, "category": category, "moduleType": moduleType, "status": status, "enabled": enabled, "spotlight": spotlight, "priority": priority, "visualTheme": visualTheme, "routePath": routePath})
	}
	assertDailyRadarModuleAudit(t, db, actorID, "daily_radar.module.created", createdBody.ID)
}

func TestAdminDailyRadarModulePatchContract(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar editor", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	store := session.NewStore(db)
	moduleKey := "audit-module-patch-" + strings.ReplaceAll(newUUID(t), "-", "")[:12]
	var moduleID string
	var titleVi, description string
	var priority int
	var routePath *string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,default_priority,created_at,updated_at)
VALUES($1,'Original','元','Original fixture','life','content','draft',true,1,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2`, actorID, moduleID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})
	updated := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), store, actorID, http.MethodPatch, "/api/admin/daily-radar/modules/"+moduleID, map[string]any{
		"titleVi": "Audit module updated", "descriptionVi": "Updated fixture", "defaultPriority": 23, "routePath": nil,
	})
	if updated.Code != http.StatusOK {
		t.Fatalf("update status=%d body=%s; want 200", updated.Code, updated.Body.String())
	}
	err := db.QueryRow(context.Background(), `SELECT title_vi,description_vi,default_priority,route_path FROM daily.daily_radar_module_config WHERE id=$1`, moduleID).
		Scan(&titleVi, &description, &priority, &routePath)
	if err != nil {
		t.Fatal(err)
	}
	if titleVi != "Audit module updated" || description != "Updated fixture" || priority != 23 || routePath != nil {
		t.Fatalf("updated module not persisted: title=%q description=%q priority=%d route=%v", titleVi, description, priority, routePath)
	}
	assertDailyRadarModuleAudit(t, db, actorID, "daily_radar.module.updated", moduleID)
}

func assertDailyRadarModuleAudit(t *testing.T, db *pgxpool.Pool, actorID, action, targetID string) {
	t.Helper()
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action=$2 AND target_type='daily_radar_module' AND target_id=$3`, actorID, action, targetID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("audit rows=%d for %s; want exactly one", count, action)
	}
}

func TestAdminDailyRadarModuleCreateRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar reader", actorID+"@example.com")
	request := performDailyRadarModuleRequest(t, buildDailyRadarTestRouter(db), session.NewStore(db), actorID, http.MethodPost, "/api/admin/daily-radar/modules", map[string]any{
		"moduleKey": "unauthorized-audit-module", "titleVi": "Unauthorized", "titleJa": "許可されていない",
		"descriptionVi": "Must not persist", "category": "life", "moduleType": "content",
	})
	if request.Code != http.StatusForbidden {
		t.Fatalf("unauthorized create status=%d body=%s; want 403", request.Code, request.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM daily.daily_radar_module_config WHERE module_key='unauthorized-audit-module'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("unauthorized create persisted %d modules", count)
	}
}

func performDailyRadarModuleRequest(t *testing.T, router http.Handler, store *session.Store, actorID, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(method, path, strings.NewReader(string(encoded)))
	request.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	request.Header.Set("Origin", "http://localhost:18081")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
