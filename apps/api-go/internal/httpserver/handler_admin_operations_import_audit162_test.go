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

func TestAdminOperationsImportAUDIT162Routes(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, deniedID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit162-admin-%s@example.test", actorID[:8]), "AUDIT-162 Admin")
	seedAdminActor(t, db, deniedID, fmt.Sprintf("audit162-denied-%s@example.test", deniedID[:8]), "AUDIT-162 Denied")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token, deniedToken := createAdminSession(t, sessions, actorID), createAdminSession(t, sessions, deniedID)
	batchID, manifestID, errorID, secondErrorID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_batch (id,source_type,source_dir,status,file_count,item_count,error_count,updated_at) VALUES ($1,'audit162','disposable','failed',1,2,2,now())`, batchID); err != nil {
		t.Fatalf("seed batch: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_mapping (id,source_type,target_type,version,status,mapping,updated_at) VALUES ($1,'audit162','audit162_target',1,'approved','{"field":"value"}',now())`, manifestID); err != nil {
		t.Fatalf("seed manifest: %v", err)
	}
	for _, id := range []string{errorID, secondErrorID} {
		if _, err := db.Exec(ctx, `INSERT INTO content.content_import_error (id,import_batch_id,phase,severity,code,message,sample) VALUES ($1,$2,'validate','error','AUDIT162','disposable import error','{"fixture":true}')`, id, batchID); err != nil {
			t.Fatalf("seed import error: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 OR target_id IN ($2,$3,$4,$5)`, actorID, batchID, manifestID, errorID, secondErrorID)
		_, _ = db.Exec(ctx, `DELETE FROM ops.dead_letter_entry WHERE event_type=$1`, "content_import_error:"+errorID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_error WHERE id IN ($1,$2)`, errorID, secondErrorID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_mapping WHERE id=$1`, manifestID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_batch WHERE id=$1`, batchID)
	})
	call := func(method, path, body, session string, csrf bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if session != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: session})
		}
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			if csrf {
				req.Header.Set("Origin", "http://localhost:3000")
				req.Header.Set("X-CSRF-Token", "audit162-csrf")
			}
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path, body string
		write              bool
	}{
		{http.MethodGet, "/api/admin/operations/import-batches?status=failed", "", false},
		{http.MethodGet, "/api/admin/operations/import-manifests?status=approved", "", false},
		{http.MethodPost, "/api/admin/operations/import-manifests", `{"sourceType":"audit162_create","targetType":"audit162_created_target","version":1,"mapping":{"field":"value"},"reason":"AUDIT-162 create"}`, true},
		{http.MethodGet, "/api/admin/operations/import-manifests/" + manifestID, "", false},
		{http.MethodPatch, "/api/admin/operations/import-manifests/" + manifestID, `{"notes":"updated","reason":"AUDIT-162 update"}`, true},
		{http.MethodGet, "/api/admin/operations/import-manifests/" + manifestID + "/history", "", false},
		{http.MethodPost, "/api/admin/operations/import-manifests/" + manifestID + "/run", `{"reason":"AUDIT-162 run"}`, true},
		{http.MethodGet, "/api/admin/operations/import-staging/errors?batchId=" + batchID, "", false},
		{http.MethodPatch, "/api/admin/operations/import-staging/errors/bulk", fmt.Sprintf(`{"ids":[%q,%q],"action":"retry","reason":"AUDIT-162 bulk retry"}`, errorID, secondErrorID), true},
		{http.MethodPatch, "/api/admin/operations/import-staging/errors/" + errorID + "/dead-letter", `{"reason":"AUDIT-162 dead letter"}`, true},
		{http.MethodPatch, "/api/admin/operations/import-staging/errors/" + secondErrorID + "/discard", `{"reason":"AUDIT-162 discard"}`, true},
		{http.MethodPatch, "/api/admin/operations/import-staging/errors/" + errorID + "/retry", `{"reason":"AUDIT-162 retry"}`, true},
	}
	for _, route := range routes {
		route := route
		t.Run(route.method+" "+strings.Split(route.path, "?")[0]+" auth and CSRF", func(t *testing.T) {
			if got := call(route.method, route.path, route.body, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			if got := call(route.method, route.path, route.body, deniedToken, true).Code; got != http.StatusForbidden {
				t.Fatalf("admin without permission status=%d; want 403", got)
			}
			if route.write {
				if got := call(route.method, route.path, route.body, token, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing CSRF status=%d; want 403", got)
				}
			}
		})
	}

	t.Run("GET import batches and manifests contracts", func(t *testing.T) {
		batches := call(http.MethodGet, "/api/admin/operations/import-batches?status=failed&limit=10&offset=0", "", token, false)
		if batches.Code != http.StatusOK || !strings.Contains(batches.Body.String(), batchID) || !strings.Contains(batches.Body.String(), `"total":1`) {
			t.Fatalf("batches status=%d body=%s", batches.Code, batches.Body.String())
		}
		manifests := call(http.MethodGet, "/api/admin/operations/import-manifests?status=active&limit=10&offset=0", "", token, false)
		if manifests.Code != http.StatusOK || !strings.Contains(manifests.Body.String(), manifestID) || !strings.Contains(manifests.Body.String(), `"total":1`) {
			t.Fatalf("manifests status=%d body=%s", manifests.Code, manifests.Body.String())
		}
		var list struct {
			Items []json.RawMessage `json:"items"`
			Total int               `json:"total"`
		}
		if err := json.Unmarshal(manifests.Body.Bytes(), &list); err != nil || len(list.Items) != 1 || list.Total != 1 {
			t.Fatalf("manifest list contract=%s err=%v", manifests.Body.String(), err)
		}
	})

	t.Run("create manifest persists with required audit", func(t *testing.T) {
		created := call(http.MethodPost, "/api/admin/operations/import-manifests", routes[2].body, token, true)
		if created.Code != http.StatusOK {
			t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
		}
		var response struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil || response.ID == "" || response.Status != "draft" {
			t.Fatalf("create response=%s err=%v", created.Body.String(), err)
		}
		var audits int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='ops.import_manifest.create'`, actorID, response.ID).Scan(&audits); err != nil || audits != 1 {
			t.Fatalf("create audit count=%d err=%v", audits, err)
		}
		duplicate := call(http.MethodPost, "/api/admin/operations/import-manifests", routes[2].body, token, true)
		if duplicate.Code != http.StatusConflict {
			t.Fatalf("duplicate manifest status=%d body=%s; want 409", duplicate.Code, duplicate.Body.String())
		}
		if invalid := call(http.MethodPost, "/api/admin/operations/import-manifests", `{"sourceType":"x","targetType":"y","version":0,"mapping":[],"reason":"invalid"}`, token, true); invalid.Code != http.StatusBadRequest {
			t.Fatalf("invalid manifest status=%d body=%s; want 400", invalid.Code, invalid.Body.String())
		}
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, response.ID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_mapping WHERE id=$1`, response.ID)
	})

	t.Run("manifest detail, update, run and history persist", func(t *testing.T) {
		detail := call(http.MethodGet, "/api/admin/operations/import-manifests/"+manifestID, "", token, false)
		if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"mapping":{"field":"value"}`) {
			t.Fatalf("detail status=%d body=%s", detail.Code, detail.Body.String())
		}
		update := call(http.MethodPatch, "/api/admin/operations/import-manifests/"+manifestID, `{"notes":"updated","status":"active","reason":"AUDIT-162 update"}`, token, true)
		if update.Code != http.StatusOK || !strings.Contains(update.Body.String(), `"notes":"updated"`) || !strings.Contains(update.Body.String(), `"status":"active"`) {
			t.Fatalf("update status=%d body=%s", update.Code, update.Body.String())
		}
		var persisted, persistedStatus string
		if err := db.QueryRow(ctx, `SELECT notes,status FROM content.content_import_mapping WHERE id=$1`, manifestID).Scan(&persisted, &persistedStatus); err != nil || persisted != "updated" || persistedStatus != "approved" {
			t.Fatalf("persisted notes=%q status=%q err=%v", persisted, persistedStatus, err)
		}
		var updateAudits int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='ops.import_manifest.update'`, actorID, manifestID).Scan(&updateAudits); err != nil || updateAudits != 1 {
			t.Fatalf("update audit count=%d err=%v", updateAudits, err)
		}
		run := call(http.MethodPost, "/api/admin/operations/import-manifests/"+manifestID+"/run", `{"reason":"AUDIT-162 run"}`, token, true)
		if run.Code != http.StatusAccepted || !strings.Contains(run.Body.String(), `"status":"queued"`) || !strings.Contains(run.Body.String(), `"processorAvailable":false`) {
			t.Fatalf("approved manifest run status=%d body=%s", run.Code, run.Body.String())
		}
		history := call(http.MethodGet, "/api/admin/operations/import-manifests/"+manifestID+"/history?limit=20", "", token, false)
		if history.Code != http.StatusOK || !strings.Contains(history.Body.String(), `"ops.import_manifest.run"`) {
			t.Fatalf("history status=%d body=%s", history.Code, history.Body.String())
		}
	})

	t.Run("staging list and bulk/single actions persist audits", func(t *testing.T) {
		listed := call(http.MethodGet, "/api/admin/operations/import-staging/errors?batchId="+batchID+"&limit=100", "", token, false)
		if listed.Code != http.StatusOK || !strings.Contains(listed.Body.String(), errorID) || !strings.Contains(listed.Body.String(), secondErrorID) {
			t.Fatalf("staging list status=%d body=%s", listed.Code, listed.Body.String())
		}
		bulk := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/bulk", routes[8].body, token, true)
		if bulk.Code != http.StatusAccepted || !strings.Contains(bulk.Body.String(), `"processed":2`) || !strings.Contains(bulk.Body.String(), `"status":"queued"`) {
			t.Fatalf("bulk status=%d body=%s", bulk.Code, bulk.Body.String())
		}
		deadLetter := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/"+errorID+"/dead-letter", `{"reason":"AUDIT-162 dead letter"}`, token, true)
		if deadLetter.Code != http.StatusOK {
			t.Fatalf("dead-letter status=%d body=%s", deadLetter.Code, deadLetter.Body.String())
		}
		var deadLetterResponse struct {
			ID            string `json:"id"`
			AlreadyExists bool   `json:"alreadyExists"`
		}
		if err := json.Unmarshal(deadLetter.Body.Bytes(), &deadLetterResponse); err != nil || deadLetterResponse.ID == "" {
			t.Fatalf("dead-letter response=%s err=%v", deadLetter.Body.String(), err)
		}
		again := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/"+errorID+"/dead-letter", `{"reason":"AUDIT-162 duplicate"}`, token, true)
		var duplicate struct {
			ID            string `json:"id"`
			AlreadyExists bool   `json:"alreadyExists"`
		}
		if again.Code != http.StatusOK || json.Unmarshal(again.Body.Bytes(), &duplicate) != nil || duplicate.ID != deadLetterResponse.ID || !duplicate.AlreadyExists {
			t.Fatalf("idempotent dead-letter status=%d body=%s", again.Code, again.Body.String())
		}
		discard := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/"+secondErrorID+"/discard", `{"reason":"AUDIT-162 discard"}`, token, true)
		if discard.Code != http.StatusOK || !strings.Contains(discard.Body.String(), `"status":"discarded"`) {
			t.Fatalf("discard status=%d body=%s", discard.Code, discard.Body.String())
		}
		retry := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/"+errorID+"/retry", `{"reason":"AUDIT-162 retry"}`, token, true)
		if retry.Code != http.StatusAccepted || !strings.Contains(retry.Body.String(), `"status":"queued"`) {
			t.Fatalf("retry status=%d body=%s", retry.Code, retry.Body.String())
		}
		var auditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_type='content.content_import_error' AND target_id IN ($2,$3)`, actorID, errorID, secondErrorID).Scan(&auditCount); err != nil || auditCount != 4 {
			t.Fatalf("staging audit count=%d err=%v; want 4 (2 bulk, dead-letter, discard; repeat retry is idempotent)", auditCount, err)
		}
	})
}
