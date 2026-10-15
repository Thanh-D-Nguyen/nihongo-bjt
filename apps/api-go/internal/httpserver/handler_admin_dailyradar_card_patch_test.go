package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminDailyRadarCardPatchRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar editor", actorID+"@example.com")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
	})
	_, cardID := seedDailyRadarCard(t, db, "audit-patch-rbac")
	store := session.NewStore(db)
	router := buildDailyRadarTestRouter(db)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/daily-radar/cards/"+cardID, strings.NewReader(`{"titleVi":"Unauthorized title"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s; want 403", recorder.Code, recorder.Body.String())
	}
	var title string
	if err := db.QueryRow(context.Background(), `SELECT title_vi FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&title); err != nil {
		t.Fatal(err)
	}
	if title != "Patch fixture" {
		t.Fatalf("unauthorized patch changed persisted title to %q", title)
	}
}

func TestAdminDailyRadarCardPatchPersistsUIContractAndAudit(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar editor", actorID+"@example.com")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
	})
	grantDailyRadarWritePermission(t, db, actorID)
	_, cardID := seedDailyRadarCard(t, db, "audit-patch-ui")
	store := session.NewStore(db)
	router := buildDailyRadarTestRouter(db)
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/daily-radar/cards/"+cardID, strings.NewReader(`{"titleVi":"Updated from UI","descriptionVi":"Updated description","metadata":{"body":"Updated body"},"status":"draft"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	var persisted struct {
		Title, Description, Status string
		Metadata                   []byte
	}
	if err := db.QueryRow(context.Background(), `SELECT title_vi,description_vi,status,metadata FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&persisted.Title, &persisted.Description, &persisted.Status, &persisted.Metadata); err != nil {
		t.Fatal(err)
	}
	var metadata map[string]string
	if err := json.Unmarshal(persisted.Metadata, &metadata); err != nil {
		t.Fatal(err)
	}
	if persisted.Title != "Updated from UI" || persisted.Description != "Updated description" || metadata["body"] != "Updated body" || persisted.Status != "draft" {
		t.Fatalf("unexpected persisted patch: %+v metadata=%+v", persisted, metadata)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='daily_radar.card.updated' AND actor_id=$2`, cardID, actorID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if audits != 1 {
		t.Fatalf("audit rows=%d; want exactly one", audits)
	}
}

func seedDailyRadarCard(t *testing.T, db *pgxpool.Pool, prefix string) (moduleID, cardID string) {
	t.Helper()
	moduleKey := prefix + "-module-" + newUUID(t)[:8]
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
		VALUES($1,'Patch fixture module','監査','Fixture','daily','reading','draft',true,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_card
		(module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,created_at,updated_at)
		VALUES($1,$2,'Patch fixture','Original description','daily','reading','Open','draft',NOW(),NOW()) RETURNING id::text`, moduleID, prefix+"-card-"+newUUID(t)[:8]).Scan(&cardID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE id=$1`, cardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})
	return moduleID, cardID
}

func buildDailyRadarTestRouter(db *pgxpool.Pool) http.Handler {
	logger := testLogger()
	return NewRouter(Dependencies{
		Config:       &config.Config{Port: "4001", CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       logger,
		DBPool:       db,
		SessionStore: session.NewStore(db),
		ProfileStore: profile.NewStore(db),
		RBACStore:    authz.NewStore(db),
		Version:      "test",
	})
}

func grantDailyRadarWritePermission(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var permissionID string
	err := db.QueryRow(ctx, `SELECT id FROM authz.admin_permission WHERE code='admin.content.write'`).Scan(&permissionID)
	if errors.Is(err, pgx.ErrNoRows) {
		permissionID = newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO authz.admin_permission (id,code) VALUES ($1,'admin.content.write')`, permissionID); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(context.Background(), `DELETE FROM authz.admin_permission WHERE id=$1`, permissionID)
		})
	} else if err != nil {
		t.Fatal(err)
	}
	roleID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO authz.admin_role (id,code,name) VALUES ($1,$2,'Daily Radar test writer')`, roleID, "test-daily-radar-"+roleID[:8]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO authz.admin_role_permission (role_id,permission_id) VALUES ($1,$2)`, roleID, permissionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO authz.admin_actor_role (actor_id,role_id) VALUES ($1,$2)`, actorID, roleID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM authz.admin_role WHERE id=$1`, roleID) })
}
