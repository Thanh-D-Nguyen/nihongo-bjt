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

func TestAdminLeaderboardAndPetsRoutesEnforceContentPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("gamification-roleless-%s@example.test", actorID[:8]), "Roleless Gamification Admin")
	token := createAdminSession(t, sessions, actorID)
	id := newUUID(t)
	cases := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/admin/gamification/leaderboards", ""},
		{http.MethodPost, "/api/admin/gamification/leaderboards", `{"name":"Audit leaderboard","metricType":"xp","period":"weekly","maxEntries":25,"enabled":true}`},
		{http.MethodPut, "/api/admin/gamification/leaderboards/" + id, `{"name":"Audit leaderboard","metricType":"xp","period":"weekly","maxEntries":25,"enabled":true}`},
		{http.MethodDelete, "/api/admin/gamification/leaderboards/" + id, ""},
		{http.MethodGet, "/api/admin/gamification/pets", ""},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			anonymous := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(anonymous, httptest.NewRequest(tc.method, tc.path, nil))
			if anonymous.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", anonymous.Code, anonymous.Body.String())
			}
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			req.Header.Set("Origin", "http://localhost:3000")
			if tc.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			roleless := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(roleless, req)
			if roleless.Code != http.StatusForbidden {
				t.Fatalf("roleless status=%d body=%s; want 403", roleless.Code, roleless.Body.String())
			}
		})
	}
	grantAdminPermission(t, db, actorID, "admin.content.read")
	do := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	for _, tc := range cases[1:4] {
		if got := do(tc.method, tc.path, tc.body).Code; got != http.StatusForbidden {
			t.Fatalf("read-only Admin %s %s status=%d; want 403", tc.method, tc.path, got)
		}
	}
	grantAdminPermission(t, db, actorID, "admin.content.write")
	csrfReq := httptest.NewRequest(http.MethodPost, cases[1].path, strings.NewReader(`{"name":"CSRF probe","metricType":"xp","period":"weekly","maxEntries":5}`))
	csrfReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	csrfReq.Header.Set("Content-Type", "application/json")
	csrfReq.Header.Set("X-CSRF-Token", "test-csrf")
	csrfRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(csrfRes, csrfReq)
	if csrfRes.Code != http.StatusForbidden {
		t.Fatalf("missing-origin POST status=%d; want 403", csrfRes.Code)
	}
	config := `{"name":"Audit leaderboard","nameKey":"leaderboard.audit143","metricType":"xp","period":"weekly","maxEntries":25,"enabled":true}`
	invalid := do(http.MethodPost, cases[1].path, `{"name":"","metricType":"xp","period":"weekly","maxEntries":25}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid create status=%d body=%s; want 400", invalid.Code, invalid.Body.String())
	}
	tooMany := do(http.MethodPost, cases[1].path, `{"name":"Too many","metricType":"xp","period":"weekly","maxEntries":2147483648}`)
	if tooMany.Code != http.StatusBadRequest {
		t.Fatalf("int32 overflow create status=%d body=%s; want 400", tooMany.Code, tooMany.Body.String())
	}
	created := do(http.MethodPost, cases[1].path, config)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
	}
	var createdBody struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createdBody); err != nil || createdBody.ID == "" {
		t.Fatalf("create response=%s err=%v", created.Body.String(), err)
	}
	id = createdBody.ID
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, id)
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.leaderboard_config WHERE id=$1`, id)
	})
	listed := do(http.MethodGet, cases[0].path, "")
	if listed.Code != http.StatusOK || !strings.Contains(listed.Body.String(), `"id":"`+id+`"`) || !strings.Contains(listed.Body.String(), `"name":"Audit leaderboard"`) {
		t.Fatalf("list status=%d body=%s", listed.Code, listed.Body.String())
	}
	var auditCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.gamification.leaderboard.created'`, id).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("create audit count=%d err=%v", auditCount, err)
	}
	updatedConfig := `{"name":"Audit leaderboard updated","nameKey":"leaderboard.audit143.updated","metricType":"xp","period":"monthly","maxEntries":50,"enabled":false}`
	updated := do(http.MethodPut, "/api/admin/gamification/leaderboards/"+id, updatedConfig)
	if updated.Code != http.StatusOK {
		t.Fatalf("update status=%d body=%s", updated.Code, updated.Body.String())
	}
	var updatedName string
	if err := db.QueryRow(context.Background(), `SELECT name FROM gamification.leaderboard_config WHERE id=$1`, id).Scan(&updatedName); err != nil || updatedName != "Audit leaderboard updated" {
		t.Fatalf("persisted name=%q err=%v", updatedName, err)
	}
	if got := do(http.MethodPut, "/api/admin/gamification/leaderboards/"+newUUID(t), updatedConfig).Code; got != http.StatusNotFound {
		t.Fatalf("missing update status=%d; want 404", got)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.gamification.leaderboard.updated'`, id).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("update audit count=%d err=%v", auditCount, err)
	}
	entryID := newUUID(t)
	entryTx, err := db.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entryTx.Exec(context.Background(), `INSERT INTO gamification.leaderboard_entry (id,leaderboard_id,user_id,rank,score,period_start,period_end) VALUES ($1,$2,$3,1,250,'2026-10-01','2026-10-31')`, entryID, id, newUUID(t)); err != nil {
		_ = entryTx.Rollback(context.Background())
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.leaderboard_entry WHERE id=$1`, entryID)
	})
	deleteResult := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		req := httptest.NewRequest(http.MethodDelete, "/api/admin/gamification/leaderboards/"+id, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		deleteResult <- res
	}()
	time.Sleep(50 * time.Millisecond)
	select {
	case res := <-deleteResult:
		t.Fatalf("delete did not wait for in-flight history insert: status=%d body=%s", res.Code, res.Body.String())
	default:
	}
	if err := entryTx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	var blockedDelete *httptest.ResponseRecorder
	select {
	case blockedDelete = <-deleteResult:
	case <-time.After(2 * time.Second):
		t.Fatal("delete did not resume after history insert committed")
	}
	if blockedDelete.Code != http.StatusConflict {
		t.Fatalf("delete with concurrent history status=%d body=%s; want 409", blockedDelete.Code, blockedDelete.Body.String())
	}
	var entryCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM gamification.leaderboard_entry WHERE id=$1`, entryID).Scan(&entryCount); err != nil || entryCount != 1 {
		t.Fatalf("historical entry count=%d err=%v", entryCount, err)
	}
	if _, err := db.Exec(context.Background(), `DELETE FROM gamification.leaderboard_entry WHERE id=$1`, entryID); err != nil {
		t.Fatal(err)
	}
	deleted := do(http.MethodDelete, "/api/admin/gamification/leaderboards/"+id, "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	if got := do(http.MethodDelete, "/api/admin/gamification/leaderboards/"+id, "").Code; got != http.StatusNotFound {
		t.Fatalf("missing delete status=%d; want 404", got)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.gamification.leaderboard.deleted'`, id).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("delete audit count=%d err=%v", auditCount, err)
	}
	petUserID := newUUID(t)
	petID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.companion_pet (id,user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at) VALUES ($1,$2,'Audit Pet','egg',7,81,'happy',3,$3,$3)`, petID, petUserID, time.Now()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.companion_pet WHERE id=$1`, petID)
	})
	pets := do(http.MethodGet, cases[4].path+"?stage=egg&search=Audit%20Pet", "")
	if pets.Code != http.StatusOK || !strings.Contains(pets.Body.String(), `"id":"`+petID+`"`) || !strings.Contains(pets.Body.String(), `"totalFeedings":3`) {
		t.Fatalf("pet list status=%d body=%s", pets.Code, pets.Body.String())
	}
	if got := do(http.MethodGet, cases[4].path+"?stage=unknown", "").Code; got != http.StatusBadRequest {
		t.Fatalf("invalid pet stage status=%d; want 400", got)
	}
}

func TestAdminLeaderboardMaxEntriesRejectsInt32Overflow(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("leaderboard-overflow-%s@example.test", actorID[:8]), "Leaderboard Overflow Admin")
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	req := httptest.NewRequest(http.MethodPost, "/api/admin/gamification/leaderboards", strings.NewReader(`{"name":"Too many","metricType":"xp","period":"weekly","maxEntries":2147483648}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for INTEGER overflow, got %d body=%s", res.Code, res.Body.String())
	}
}
