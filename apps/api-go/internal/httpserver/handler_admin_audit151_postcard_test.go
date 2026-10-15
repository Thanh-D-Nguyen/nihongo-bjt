package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAudit151PostcardDetailPatchPublishArchiveLifecycle(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, postcardID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-postcard-%s@example.com", actorID[:8]), "AUDIT-151 postcard manager")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	slug := "audit151_pc_" + strings.ReplaceAll(postcardID, "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'streak',$3::jsonb,false,now(),now())`, postcardID, slug, `{"surface":"postcard","name":"Before","bodyTemplate":"Before","privacyClass":"anonymized","noPiiVerified":true}`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, postcardID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE id=$1`, postcardID)
	})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	path := "/api/admin/growth/postcards/" + postcardID
	if got := call(http.MethodGet, path, ""); got.Code != http.StatusOK || !strings.Contains(got.Body.String(), `"id":"`+postcardID+`"`) {
		t.Fatalf("detail status=%d body=%s", got.Code, got.Body.String())
	}
	newSlug := slug + "_edited"
	patched := call(http.MethodPatch, path, fmt.Sprintf(`{"slug":%q,"reason":"audit151 edit"}`, newSlug))
	if patched.Code != http.StatusOK || !strings.Contains(patched.Body.String(), `"slug":"`+newSlug+`"`) {
		t.Fatalf("patch status=%d body=%s", patched.Code, patched.Body.String())
	}
	for _, action := range []string{"publish", "archive"} {
		res := call(http.MethodPost, path+"/"+action, fmt.Sprintf(`{"reason":"audit151 %s"}`, action))
		if res.Code != http.StatusOK {
			t.Fatalf("%s status=%d body=%s", action, res.Code, res.Body.String())
		}
		wantActive := action == "publish"
		var active bool
		if err := db.QueryRow(ctx, `SELECT active FROM growth.share_template WHERE id=$1`, postcardID).Scan(&active); err != nil || active != wantActive {
			t.Fatalf("after %s active=%v err=%v want %v", action, active, err, wantActive)
		}
	}
	var audits int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action IN ('admin.growth.postcard_template.updated','admin.growth.postcard_template.published','admin.growth.postcard_template.archived')`, actorID, postcardID).Scan(&audits); err != nil || audits != 3 {
		t.Fatalf("postcard audit rows=%d err=%v want 3", audits, err)
	}
}

func TestAudit156PostcardPublishReadsStateAfterConcurrentWriter(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, postcardID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit156-%s@example.com", actorID[:8]), "AUDIT-156 postcard manager")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(ctx, `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'streak','{"surface":"postcard","bodyTemplate":"Hi","privacyClass":"anonymized","noPiiVerified":true}',false,now(),now())`, postcardID, "audit156_"+strings.ReplaceAll(postcardID, "-", "")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, postcardID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE id=$1`, postcardID)
	})
	lockTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer lockTx.Rollback(ctx)
	var active bool
	if err := lockTx.QueryRow(ctx, `SELECT active FROM growth.share_template WHERE id=$1 FOR UPDATE`, postcardID).Scan(&active); err != nil {
		t.Fatal(err)
	}
	response := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/postcards/"+postcardID+"/publish", strings.NewReader(`{"reason":"audit156 concurrent publish"}`))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		response <- res
	}()
	deadline := time.Now().Add(3 * time.Second)
	for {
		var selectWaiting bool
		if err := db.QueryRow(ctx, `SELECT EXISTS (
			SELECT 1 FROM pg_stat_activity
			WHERE wait_event_type='Lock' AND query ILIKE '%SELECT active, config FROM growth.share_template%'
		)`).Scan(&selectWaiting); err != nil {
			t.Fatal(err)
		}
		if selectWaiting {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("publish did not wait on its locked state read")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if _, err := lockTx.Exec(ctx, `UPDATE growth.share_template SET active=true WHERE id=$1`, postcardID); err != nil {
		t.Fatal(err)
	}
	if err := lockTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case res := <-response:
		if res.Code != http.StatusOK {
			t.Fatalf("publish status=%d body=%s", res.Code, res.Body.String())
		}
	case <-time.After(3 * time.Second):
		t.Fatal("publish did not finish after competing transaction committed")
	}
	var auditedBefore json.RawMessage
	if err := db.QueryRow(ctx, `SELECT before FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.growth.postcard_template.published'`, postcardID).Scan(&auditedBefore); err != nil {
		t.Fatal(err)
	}
	var before map[string]bool
	if err := json.Unmarshal(auditedBefore, &before); err != nil || !before["active"] {
		t.Fatalf("audit before=%s err=%v; want active=true from serialized state", auditedBefore, err)
	}
}
