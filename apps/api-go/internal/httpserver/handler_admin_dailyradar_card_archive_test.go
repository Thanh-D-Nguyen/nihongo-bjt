package httpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminDailyRadarCardArchiveRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar reader", actorID+"@example.com")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
	})
	_, cardID := seedArchiveCard(t, db)
	req := archiveCardRequest(t, db, actorID, cardID)
	recorder := httptest.NewRecorder()
	buildArchiveTestRouter(db).ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s; want 403", recorder.Code, recorder.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "draft" {
		t.Fatalf("unauthorized archive changed persisted status to %q", status)
	}
}

func TestAdminDailyRadarCardArchivePersistsStatusAndAudit(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
	})
	grantArchivePermission(t, db, actorID)
	_, cardID := seedArchiveCard(t, db)
	recorder := httptest.NewRecorder()
	buildArchiveTestRouter(db).ServeHTTP(recorder, archiveCardRequest(t, db, actorID, cardID))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.daily_radar_card WHERE id=$1`, cardID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='daily_radar.card.archived'`, actorID, cardID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if status != "archived" || audits != 1 {
		t.Fatalf("status=%q audit rows=%d; want archived and exactly one audit", status, audits)
	}

	missing := httptest.NewRecorder()
	buildArchiveTestRouter(db).ServeHTTP(missing, archiveCardRequest(t, db, actorID, "00000000-0000-4000-8000-000000000000"))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing card status=%d body=%s; want 404", missing.Code, missing.Body.String())
	}
}

func seedArchiveCard(t *testing.T, db *pgxpool.Pool) (string, string) {
	t.Helper()
	moduleKey := "audit-archive-module-" + strings.ReplaceAll(newUUID(t), "-", "")[:12]
	var moduleID, cardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
VALUES($1,'Archive fixture','監査','Disposable fixture','life','content','draft',true,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_card
(module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,created_at,updated_at)
VALUES($1,$2,'Archive fixture card','Disposable fixture','life','content','Open','draft',NOW(),NOW()) RETURNING id::text`, moduleID, moduleKey+"-card").Scan(&cardID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE id=$1`, cardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})
	return moduleID, cardID
}

func grantArchivePermission(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	var permissionID string
	err := db.QueryRow(context.Background(), `SELECT id FROM authz.admin_permission WHERE code='admin.content.write'`).Scan(&permissionID)
	if err == pgx.ErrNoRows {
		permissionID = newUUID(t)
		if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_permission (id,code) VALUES ($1,'admin.content.write')`, permissionID); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(context.Background(), `DELETE FROM authz.admin_permission WHERE id=$1`, permissionID)
		})
	} else if err != nil {
		t.Fatal(err)
	}
	roleID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_role (id,code,name) VALUES ($1,$2,'Daily Radar archive writer')`, roleID, "test-daily-radar-archive-"+roleID[:8]); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_role_permission (role_id,permission_id) VALUES ($1,$2)`, roleID, permissionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_actor_role (actor_id,role_id) VALUES ($1,$2)`, actorID, roleID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM authz.admin_role WHERE id=$1`, roleID) })
}

func buildArchiveTestRouter(db *pgxpool.Pool) http.Handler {
	return NewRouter(Dependencies{
		Config:       &config.Config{Port: "4001", CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: session.NewStore(db),
		ProfileStore: profile.NewStore(db),
		RBACStore:    authz.NewStore(db),
		Version:      "test",
	})
}

func archiveCardRequest(t *testing.T, db *pgxpool.Pool, actorID, cardID string) *http.Request {
	t.Helper()
	store := session.NewStore(db)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/daily-radar/cards/"+cardID+"/archive", strings.NewReader(`{"reason":"local audit fixture"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	return req
}
