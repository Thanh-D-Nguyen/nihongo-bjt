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

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/privacy"
)

func TestAdminPrivacyErasureConfirmDeletesAndAnonymizes(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()

	actorID, userID, requestID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("privacy-erase-%s@example.test", actorID[:8]), "Privacy Erasure Admin")
	grantAdminPermission(t, db, actorID, "privacy.manage")
	adminToken := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile(id,email,display_name,status,updated_at) VALUES($1,$2,'Disposable Erasure User','active',now())`, userID, fmt.Sprintf("erase-%s@example.test", userID[:8])); err != nil {
		t.Fatalf("seed disposable user: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO profile.privacy_request(id,user_id,kind,status) VALUES($1,$2,'delete','pending')`, requestID, userID); err != nil {
		t.Fatalf("seed erasure request: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO auth.password_credential(user_id,algorithm,hash_iterations,memory_kib,parallelism,hash_length,salt,hashed_value) VALUES($1,'argon2id',1,8,1,16,'salt','hash')`, userID); err != nil {
		t.Fatalf("seed disposable credential: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO auth.session(user_id,token_digest,expires_at) VALUES($1,$2,now()+interval '1 hour')`, userID, strings.Repeat("a", 64)); err != nil {
		t.Fatalf("seed disposable learner session: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM profile.privacy_request WHERE id=$1`, requestID) })

	call := func(token string, csrf bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/privacy/requests/"+requestID+"/erasure-confirm", strings.NewReader(`{"reason":"approved disposable erasure","confirmationToken":"`+requestID+`"}`))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if csrf {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "audit159-csrf")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	if got := call("", true).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d want 401", got)
	}
	deniedID := newUUID(t)
	seedAdminActor(t, db, deniedID, fmt.Sprintf("privacy-erase-denied-%s@example.test", deniedID[:8]), "Denied Privacy Admin")
	deniedToken := createAdminSession(t, sessions, deniedID)
	if got := call(deniedToken, true).Code; got != http.StatusForbidden {
		t.Fatalf("unauthorized role status=%d want 403", got)
	}
	if got := call(adminToken, false).Code; got != http.StatusForbidden {
		t.Fatalf("missing CSRF status=%d want 403", got)
	}
	res := call(adminToken, true)
	if res.Code != http.StatusOK {
		t.Fatalf("erasure status=%d body=%s", res.Code, res.Body.String())
	}

	var profileCount, credentialCount, sessionCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM profile.user_profile WHERE id=$1`, userID).Scan(&profileCount); err != nil || profileCount != 0 {
		t.Fatalf("profile remains count=%d err=%v", profileCount, err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM auth.password_credential WHERE user_id=$1`, userID).Scan(&credentialCount); err != nil || credentialCount != 0 {
		t.Fatalf("credential remains count=%d err=%v", credentialCount, err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM auth.session WHERE user_id=$1`, userID).Scan(&sessionCount); err != nil || sessionCount != 0 {
		t.Fatalf("session remains count=%d err=%v", sessionCount, err)
	}
	var status, anonymizedUserID string
	var completedAt *time.Time
	if err := db.QueryRow(ctx, `SELECT status,user_id,completed_at FROM profile.privacy_request WHERE id=$1`, requestID).Scan(&status, &anonymizedUserID, &completedAt); err != nil {
		t.Fatalf("read erasure request: %v", err)
	}
	if status != "completed" || anonymizedUserID == userID || completedAt == nil {
		t.Fatalf("request status=%q user_id=%q completed_at=%v", status, anonymizedUserID, completedAt)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='privacy.request' AND actor_id=$2 AND action='privacy.erasure.confirmed'`, requestID, actorID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("audit count=%d err=%v", auditCount, err)
	}
}

func TestAdminPrivacyFulfillAndPrivateLearnerDownload(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, userID, requestID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("privacy-export-%s@example.test", actorID[:8]), "Privacy Export Admin")
	grantAdminPermission(t, db, actorID, "privacy.manage")
	adminToken := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile(id,email,display_name,status,updated_at) VALUES($1,$2,'Disposable Export User','active',now())`, userID, fmt.Sprintf("export-%s@example.test", userID[:8])); err != nil {
		t.Fatalf("seed disposable user: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO profile.privacy_request(id,user_id,kind,status) VALUES($1,$2,'export','pending')`, requestID, userID); err != nil {
		t.Fatalf("seed export request: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM profile.privacy_request WHERE id=$1`, requestID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID)
	})

	call := func(token string, csrf bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/privacy/requests/"+requestID+"/fulfill", strings.NewReader(`{"reason":"approved disposable export","downloadUrl":"https://untrusted.example/export.json"}`))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if csrf {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "audit159-csrf")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	if got := call("", true).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d want 401", got)
	}
	deniedID := newUUID(t)
	seedAdminActor(t, db, deniedID, fmt.Sprintf("privacy-export-denied-%s@example.test", deniedID[:8]), "Denied Export Admin")
	if got := call(createAdminSession(t, sessions, deniedID), true).Code; got != http.StatusForbidden {
		t.Fatalf("unauthorized role status=%d want 403", got)
	}
	if got := call(adminToken, false).Code; got != http.StatusForbidden {
		t.Fatalf("missing CSRF status=%d want 403", got)
	}
	res := call(adminToken, true)
	if res.Code != http.StatusOK {
		t.Fatalf("fulfill status=%d body=%s want 200", res.Code, res.Body.String())
	}
	var status string
	var payload []byte
	var completedAt *time.Time
	if err := db.QueryRow(ctx, `SELECT status,result_payload,completed_at FROM profile.privacy_request WHERE id=$1`, requestID).Scan(&status, &payload, &completedAt); err != nil {
		t.Fatalf("read export request: %v", err)
	}
	if status != "completed" || len(payload) == 0 || completedAt == nil || !strings.Contains(string(payload), "Disposable Export User") {
		t.Fatalf("export not persisted: status=%q payload=%s completed=%v", status, payload, completedAt)
	}
	var exportMetadata struct {
		ExpiresAt time.Time `json:"expiresAt"`
	}
	if err := json.Unmarshal(payload, &exportMetadata); err != nil || !exportMetadata.ExpiresAt.After(time.Now()) || exportMetadata.ExpiresAt.After(time.Now().Add(24*time.Hour+time.Minute)) {
		t.Fatalf("export expiry=%s err=%v; want expiry within 24 hours", exportMetadata.ExpiresAt, err)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='privacy.request' AND action='privacy.request.fulfilled'`, requestID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("fulfillment audit count=%d err=%v", auditCount, err)
	}
	detailReq := httptest.NewRequest(http.MethodGet, "/api/admin/privacy/requests/"+requestID, nil)
	detailReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: adminToken})
	detailRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(detailRes, detailReq)
	if detailRes.Code != http.StatusOK || strings.Contains(detailRes.Body.String(), "Disposable Export User") {
		t.Fatal("admin detail response leaked private export content")
	}

	learnerSession := createLearnerSession(t, sessions, userID)
	download := func(token string, id string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/learner/privacy/requests/"+id+"/export", nil)
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	if got := download("", requestID).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous download status=%d want 401", got)
	}
	otherUserID := newUUID(t)
	seedActiveUser(t, db, otherUserID, "Other Export User", fmt.Sprintf("other-export-%s@example.test", otherUserID[:8]), "")
	if got := download(createLearnerSession(t, sessions, otherUserID), requestID).Code; got != http.StatusNotFound {
		t.Fatalf("cross-user download status=%d want 404", got)
	}
	gotDownload := download(learnerSession, requestID)
	if gotDownload.Code != http.StatusOK || !strings.Contains(gotDownload.Body.String(), "Disposable Export User") || gotDownload.Header().Get("Content-Disposition") == "" || gotDownload.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("owner download status=%d headers=%v body=%s", gotDownload.Code, gotDownload.Header(), gotDownload.Body.String())
	}
	listReq := httptest.NewRequest(http.MethodGet, "/api/learner/privacy/requests", nil)
	listReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: learnerSession})
	listRes := httptest.NewRecorder()
	listRouter := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, PrivacyStore: privacy.NewStore(db)})
	listRouter.ServeHTTP(listRes, listReq)
	if listRes.Code != http.StatusOK || strings.Contains(listRes.Body.String(), `"artifact"`) || strings.Contains(listRes.Body.String(), "Disposable Export User") {
		t.Fatalf("learner request list must not bypass the private download/expiry path: status=%d body=%s", listRes.Code, listRes.Body.String())
	}
	if _, err := db.Exec(ctx, `UPDATE profile.privacy_request SET result_payload=jsonb_set(result_payload,'{expiresAt}',to_jsonb(now()-interval '1 second')) WHERE id=$1`, requestID); err != nil {
		t.Fatalf("expire export fixture: %v", err)
	}
	if got := download(learnerSession, requestID).Code; got != http.StatusGone {
		t.Fatalf("expired download status=%d want 410", got)
	}
}
