package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminFlashcardStyleAdoptionCountsProfileSelections(t *testing.T) {
	db := testPool(t)
	styleID := newUUID(t)
	slug := "audit-style-" + styleID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_style (id,slug,name_key,config,tier,status)
VALUES($1,$2,'flashcards.styles.audit','{}','free','active')`, styleID, slug); err != nil {
		t.Fatalf("insert style fixture: %v", err)
	}
	userIDs := []string{newUUID(t), newUUID(t)}
	for i, userID := range userIDs {
		seedActiveUser(t, db, userID, "Flashcard style user", "flashcard-style-"+userID+"@example.test", "")
		if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET flashcard_style_slug=$1 WHERE id=$2`, slug, userID); err != nil {
			t.Fatalf("select fixture style for user %d: %v", i, err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE id=$1`, styleID)
	})

	rr := httptest.NewRecorder()
	adminFlashcardStylesAdoptionHandler(db, testLogger()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/admin/flashcards/styles/analytics/adoption", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("adoption status=%d body=%s", rr.Code, rr.Body.String())
	}
	var items []struct {
		ID        string `json:"id"`
		UserCount int    `json:"userCount"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &items); err != nil {
		t.Fatalf("decode adoption response: %v", err)
	}
	for _, item := range items {
		if item.ID == styleID {
			if item.UserCount != len(userIDs) {
				t.Fatalf("style adoption count=%d; want %d", item.UserCount, len(userIDs))
			}
			return
		}
	}
	t.Fatalf("adoption response omitted style %s: %s", styleID, rr.Body.String())
}

func TestAdminFlashcardStyleCreateRejectsInvalidTierAndStatus(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Flashcard style writer", actorID+"@example.test")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	store := session.NewStore(db)

	for _, tc := range []struct {
		name, tier, status string
	}{
		{name: "invalid tier", tier: "unexpected", status: "draft"},
		{name: "invalid status", tier: "free", status: "published"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			slug := "audit-invalid-" + fmt.Sprintf("%s-%s", tc.tier, newUUID(t)[:8])
			t.Cleanup(func() {
				_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM learning.flashcard_style WHERE slug=$1)`, slug)
				_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug=$1`, slug)
			})
			response := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/flashcards/styles", map[string]any{
				"slug": slug, "nameKey": "flashcard.audit.invalid", "tier": tc.tier, "status": tc.status, "config": map[string]any{},
			})
			if response.Code != http.StatusBadRequest {
				t.Fatalf("invalid %s status=%d body=%s; want 400", tc.name, response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminFlashcardStyleRoutesRequireContentPermissions(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Flashcard style reader", actorID+"@example.test")
	styleID := newUUID(t)
	slug := "audit-rbac-" + styleID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_style (id,slug,name_key,config,tier,status)
VALUES($1,$2,'flashcard.styles.audit','{}','free','draft')`, styleID, slug); err != nil {
		t.Fatalf("insert RBAC style fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, styleID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE id=$1`, styleID)
	})

	store := session.NewStore(db)
	router := buildDailyRadarTestRouter(db)
	cases := []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, "/api/admin/flashcards/styles", nil},
		{http.MethodGet, "/api/admin/flashcards/styles/analytics/adoption", nil},
		{http.MethodGet, "/api/admin/flashcards/styles/" + styleID, nil},
		{http.MethodPost, "/api/admin/flashcards/styles", map[string]any{"slug": slug + "-unauthorized", "nameKey": "flashcard.styles.denied"}},
		{http.MethodPatch, "/api/admin/flashcards/styles/" + styleID, map[string]any{"sortOrder": 99}},
		{http.MethodPost, "/api/admin/flashcards/styles/" + styleID + "/transition", map[string]any{"status": "active"}},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			response := performDailyRadarModuleRequest(t, router, store, actorID, tc.method, tc.path, tc.body)
			if response.Code != http.StatusForbidden {
				t.Fatalf("status=%d body=%s; want 403 for Admin without content permissions", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminFlashcardStyleMutationsRejectMissingOrigin(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Flashcard style writer", actorID+"@example.test")
	grantDailyRadarWritePermission(t, db, actorID)
	styleID := newUUID(t)
	slug := "audit-csrf-" + styleID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_style (id,slug,name_key,config,tier,status)
VALUES($1,$2,'flashcard.styles.audit','{}','free','draft')`, styleID, slug); err != nil {
		t.Fatalf("insert CSRF style fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM learning.flashcard_style WHERE slug LIKE $1)`, "audit-csrf-%")
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug LIKE $1`, "audit-csrf-%")
	})

	store := session.NewStore(db)
	router := buildDailyRadarTestRouter(db)
	cases := []struct {
		method, path, body string
	}{
		{http.MethodPost, "/api/admin/flashcards/styles", fmt.Sprintf(`{"slug":"%s-created","nameKey":"flashcard.styles.audit"}`, slug)},
		{http.MethodPatch, "/api/admin/flashcards/styles/" + styleID, `{"sortOrder":99}`},
		{http.MethodPost, "/api/admin/flashcards/styles/" + styleID + "/transition", `{"status":"active"}`},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			request.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusForbidden {
				t.Fatalf("status=%d body=%s; want 403 without a trusted Origin or Referer", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminFlashcardStyleConfigRejectsInvalidOrMissing(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Flashcard style writer", actorID+"@example.test")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	store := session.NewStore(db)

	for _, tc := range []struct {
		name   string
		config any
	}{
		{name: "missing"},
		{name: "empty", config: map[string]any{}},
		{name: "unknown field", config: map[string]any{"foreground": "#111827", "extra": true}},
		{name: "invalid color", config: map[string]any{"foreground": "red"}},
	} {
		t.Run("create/"+tc.name, func(t *testing.T) {
			slug := "audit-config-" + newUUID(t)[:8]
			t.Cleanup(func() {
				_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM learning.flashcard_style WHERE slug=$1)`, slug)
				_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug=$1`, slug)
			})
			body := map[string]any{"slug": slug, "nameKey": "flashcard.audit.config"}
			if tc.config != nil {
				body["config"] = tc.config
			}
			response := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/flashcards/styles", body)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status=%d body=%s; want 400", response.Code, response.Body.String())
			}
			var count int
			if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.flashcard_style WHERE slug=$1`, slug).Scan(&count); err != nil || count != 0 {
				t.Fatalf("invalid style persisted: count=%d err=%v", count, err)
			}
		})
	}

	styleID := newUUID(t)
	slug := "audit-config-patch-" + styleID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_style (id,slug,name_key,config,tier,status)
VALUES($1,$2,'flashcard.audit.config','{}','free','draft')`, styleID, slug); err != nil {
		t.Fatalf("insert style fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, styleID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE id=$1`, styleID)
	})
	response := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPatch, "/api/admin/flashcards/styles/"+styleID, map[string]any{"config": map[string]any{}})
	if response.Code != http.StatusBadRequest {
		t.Fatalf("invalid patch status=%d body=%s; want 400", response.Code, response.Body.String())
	}
	var config []byte
	if err := db.QueryRow(context.Background(), `SELECT config FROM learning.flashcard_style WHERE id=$1`, styleID).Scan(&config); err != nil || string(config) != "{}" {
		t.Fatalf("invalid patch changed config: config=%s err=%v", config, err)
	}
}

func TestAdminFlashcardStyleValidMutationsCommitAudit(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Flashcard style writer", actorID+"@example.test")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	store := session.NewStore(db)
	config := validFlashcardStyleConfig()
	slug := "audit-style-valid-" + newUUID(t)[:8]
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM learning.flashcard_style WHERE slug LIKE $1)`, slug+"%")
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug LIKE $1`, slug+"%")
	})
	missingConfig := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/flashcards/styles", map[string]any{"slug": slug + "-missing", "nameKey": "flashcard.audit.valid"})
	if missingConfig.Code != http.StatusBadRequest {
		t.Fatalf("missing config status=%d body=%s; want 400", missingConfig.Code, missingConfig.Body.String())
	}

	created := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/flashcards/styles", map[string]any{
		"slug": slug, "nameKey": "flashcard.audit.valid", "config": config, "tier": "free", "status": "draft",
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s; want 201", created.Code, created.Body.String())
	}
	var createdBody struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createdBody); err != nil || createdBody.ID == "" {
		t.Fatalf("decode created style: id=%q err=%v body=%s", createdBody.ID, err, created.Body.String())
	}

	patched := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPatch, "/api/admin/flashcards/styles/"+createdBody.ID, map[string]any{"config": config, "sortOrder": 8})
	if patched.Code != http.StatusOK {
		t.Fatalf("patch status=%d body=%s; want 200", patched.Code, patched.Body.String())
	}
	transitioned := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/flashcards/styles/"+createdBody.ID+"/transition", map[string]any{"status": "active"})
	if transitioned.Code != http.StatusOK {
		t.Fatalf("transition status=%d body=%s; want 200", transitioned.Code, transitioned.Body.String())
	}

	var status, background string
	var sortOrder, auditCount int
	if err := db.QueryRow(context.Background(), `SELECT status, sort_order, config->>'background' FROM learning.flashcard_style WHERE id=$1`, createdBody.ID).Scan(&status, &sortOrder, &background); err != nil {
		t.Fatalf("read persisted style: %v", err)
	}
	if status != "active" || sortOrder != 8 || background != config["background"] {
		t.Fatalf("persisted state=(%s,%d,%s); want active,8,%s", status, sortOrder, background, config["background"])
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action IN ('flashcard_style.create','flashcard_style.update','flashcard_style.transition')`, createdBody.ID).Scan(&auditCount); err != nil {
		t.Fatalf("count audit rows: %v", err)
	}
	if auditCount != 3 {
		t.Fatalf("audit rows=%d; want create, update, and transition entries", auditCount)
	}
}

func TestAdminFlashcardStyleAuditFailureRollsBackCreate(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Flashcard style writer", actorID+"@example.test")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	store := session.NewStore(db)
	slug := "audit-style-fail-" + newUUID(t)[:8]
	functionName := "audit_126_fail_" + strings.ReplaceAll(newUUID(t), "-", "")
	triggerName := functionName + "_trigger"
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION ops.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='flashcard_style.create' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$`, functionName)); err != nil {
		t.Fatalf("create audit failure function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION ops.%s()`, triggerName, functionName)); err != nil {
		t.Fatalf("create audit failure trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON ops.admin_audit_log`, triggerName))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS ops.%s()`, functionName))
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug=$1`, slug)
	})

	response := performDailyRadarModuleRequest(t, router, store, actorID, http.MethodPost, "/api/admin/flashcards/styles", map[string]any{
		"slug": slug, "nameKey": "flashcard.audit.failed", "config": validFlashcardStyleConfig(),
	})
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("audit failure status=%d body=%s; want 500", response.Code, response.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.flashcard_style WHERE slug=$1`, slug).Scan(&count); err != nil || count != 0 {
		t.Fatalf("style persisted without its audit row: count=%d err=%v", count, err)
	}
}

func validFlashcardStyleConfig() map[string]any {
	return map[string]any{
		"accent": "#1d4ed8", "accentForeground": "#ffffff", "background": "Linear-Gradient(135deg, #ffffff 0%, #eeeeee 100%)",
		"border": "#64748b", "contentSurface": "#ffffff", "controlBackground": "#111827", "controlForeground": "#ffffff",
		"focusRing": "#2563eb", "foreground": "#111827", "mutedForeground": "#4b5563", "flipAnimation": "rotateY",
	}
}
