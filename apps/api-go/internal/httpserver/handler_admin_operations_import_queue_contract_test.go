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

func TestImportOperationQueueRouteContracts(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, readerID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("import-queue-writer-%s@example.test", actorID[:8]), "Import Queue Writer")
	seedAdminActor(t, db, readerID, fmt.Sprintf("import-queue-reader-%s@example.test", readerID[:8]), "Import Queue Reader")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	adminToken := createAdminSession(t, sessions, actorID)
	readerToken := createAdminSession(t, sessions, readerID)

	batchID, manifestID, errorID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_batch (id,source_type,source_dir,status,updated_at) VALUES ($1,'queue-contract','disposable','failed',now())`, batchID); err != nil {
		t.Fatalf("seed batch: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_mapping (id,source_type,target_type,version,status,mapping,updated_at) VALUES ($1,'queue-contract','queue-contract-target',1,'approved','{"field":"value"}',now())`, manifestID); err != nil {
		t.Fatalf("seed manifest: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_error (id,import_batch_id,phase,severity,code,message,sample) VALUES ($1,$2,'validate','error','QUEUE_CONTRACT','disposable import error','{}')`, errorID, batchID); err != nil {
		t.Fatalf("seed error: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=ANY($1::uuid[]) OR target_id=ANY($2::uuid[])`, []string{actorID, readerID}, []string{manifestID, errorID})
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_operation_request WHERE import_mapping_id=$1 OR import_error_id=$2`, manifestID, errorID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_error WHERE id=$1`, errorID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_mapping WHERE id=$1`, manifestID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_batch WHERE id=$1`, batchID)
	})
	call := func(token, method, path, body string, csrf bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if csrf {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "import-queue-contract-csrf")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	assertRouteSecurity := func(t *testing.T, method, path, body string) {
		t.Helper()
		if got := call("", method, path, body, true).Code; got != http.StatusUnauthorized {
			t.Errorf("anonymous status=%d, want 401", got)
		}
		if got := call(readerToken, method, path, body, true).Code; got != http.StatusForbidden {
			t.Errorf("admin without content.write status=%d, want 403", got)
		}
		if got := call(adminToken, method, path, body, false).Code; got != http.StatusForbidden {
			t.Errorf("missing CSRF status=%d, want 403", got)
		}
	}
	assertQueuedResponse := func(t *testing.T, body string) string {
		t.Helper()
		var got struct {
			RequestID          string `json:"requestId"`
			Status             string `json:"status"`
			RequestStatus      string `json:"requestStatus"`
			ProcessorAvailable *bool  `json:"processorAvailable"`
		}
		if err := json.Unmarshal([]byte(body), &got); err != nil {
			t.Fatalf("decode queue response: %v (%s)", err, body)
		}
		if got.RequestID == "" || got.Status != "queued" || got.RequestStatus != "queued" || got.ProcessorAvailable == nil || *got.ProcessorAvailable {
			t.Fatalf("response must report durable queued work with no processor: %s", body)
		}
		return got.RequestID
	}

	t.Run("POST manifest run enforces security, validates, and persists queued request", func(t *testing.T) {
		path := "/api/admin/operations/import-manifests/" + manifestID + "/run"
		body := `{"reason":"queue contract run"}`
		assertRouteSecurity(t, http.MethodPost, path, body)
		if got := call(adminToken, http.MethodPost, "/api/admin/operations/import-manifests/not-a-uuid/run", body, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid manifest id status=%d, want 400", got)
		}
		if got := call(adminToken, http.MethodPost, path, `{"reason":"  "}`, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid reason status=%d, want 400", got)
		}
		res := call(adminToken, http.MethodPost, path, body, true)
		if res.Code != http.StatusAccepted {
			t.Fatalf("run status=%d body=%s, want 202", res.Code, res.Body.String())
		}
		requestID := assertQueuedResponse(t, res.Body.String())
		var status string
		if err := db.QueryRow(ctx, `SELECT status FROM content.content_import_operation_request WHERE id=$1 AND import_mapping_id=$2 AND operation='manifest_run'`, requestID, manifestID).Scan(&status); err != nil || status != "queued" {
			t.Fatalf("persisted manifest request status=%q err=%v", status, err)
		}
	})

	t.Run("PATCH bulk retry enforces security, validates, and reports processor absence", func(t *testing.T) {
		path := "/api/admin/operations/import-staging/errors/bulk"
		body := fmt.Sprintf(`{"ids":[%q],"action":"retry","reason":"queue contract bulk retry"}`, errorID)
		assertRouteSecurity(t, http.MethodPatch, path, body)
		if got := call(adminToken, http.MethodPatch, path, `{"ids":[],"action":"retry","reason":"valid reason"}`, true).Code; got != http.StatusBadRequest {
			t.Fatalf("empty ids status=%d, want 400", got)
		}
		if got := call(adminToken, http.MethodPatch, path, `{"ids":["bad"],"action":"retry","reason":"valid reason"}`, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid id status=%d, want 400", got)
		}
		if got := call(adminToken, http.MethodPatch, path, fmt.Sprintf(`{"ids":[%q],"action":"retry","reason":"valid reason"}`, newUUID(t)), true).Code; got != http.StatusNotFound {
			t.Fatalf("unknown id status=%d, want 404", got)
		}
		if got := call(adminToken, http.MethodPatch, path, fmt.Sprintf(`{"ids":[%q,%q],"action":"retry","reason":"valid reason"}`, errorID, errorID), true).Code; got != http.StatusBadRequest {
			t.Fatalf("duplicate id status=%d, want 400", got)
		}
		if got := call(adminToken, http.MethodPatch, path, `{"ids":["`+errorID+`"],"action":"unknown","reason":"valid reason"}`, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid action status=%d, want 400", got)
		}
		res := call(adminToken, http.MethodPatch, path, body, true)
		if res.Code != http.StatusAccepted {
			t.Fatalf("bulk retry status=%d body=%s, want 202", res.Code, res.Body.String())
		}
		var got struct {
			Status             string   `json:"status"`
			RequestIDs         []string `json:"requestIds"`
			ProcessorAvailable *bool    `json:"processorAvailable"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got.Status != "queued" || len(got.RequestIDs) != 1 || got.ProcessorAvailable == nil || *got.ProcessorAvailable {
			t.Fatalf("bulk response must expose queued state and processor absence: %s", res.Body.String())
		}
		var status string
		if err := db.QueryRow(ctx, `SELECT e.status FROM content.content_import_error e JOIN content.content_import_operation_request q ON q.import_error_id=e.id WHERE e.id=$1 AND q.id=$2 AND q.operation='retry'`, errorID, got.RequestIDs[0]).Scan(&status); err != nil || status != "retry_queued" {
			t.Fatalf("bulk persisted error status=%q err=%v", status, err)
		}
	})

	t.Run("PATCH single retry enforces security, validates, and persists queued request", func(t *testing.T) {
		id := newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO content.content_import_error (id,import_batch_id,phase,severity,code,message,sample) VALUES ($1,$2,'validate','error','QUEUE_CONTRACT','single retry item','{}')`, id, batchID); err != nil {
			t.Fatalf("seed retry error: %v", err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, id)
			_, _ = db.Exec(ctx, `DELETE FROM content.content_import_operation_request WHERE import_error_id=$1`, id)
			_, _ = db.Exec(ctx, `DELETE FROM content.content_import_error WHERE id=$1`, id)
		})
		path := "/api/admin/operations/import-staging/errors/" + id + "/retry"
		body := `{"reason":"queue contract single retry"}`
		assertRouteSecurity(t, http.MethodPatch, path, body)
		if got := call(adminToken, http.MethodPatch, "/api/admin/operations/import-staging/errors/not-a-uuid/retry", body, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid error id status=%d, want 400", got)
		}
		if got := call(adminToken, http.MethodPatch, path, `{"reason":" "}`, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid reason status=%d, want 400", got)
		}
		res := call(adminToken, http.MethodPatch, path, body, true)
		if res.Code != http.StatusAccepted {
			t.Fatalf("single retry status=%d body=%s, want 202", res.Code, res.Body.String())
		}
		requestID := assertQueuedResponse(t, res.Body.String())
		var status string
		if err := db.QueryRow(ctx, `SELECT e.status FROM content.content_import_error e JOIN content.content_import_operation_request q ON q.import_error_id=e.id WHERE e.id=$1 AND q.id=$2 AND q.operation='retry'`, id, requestID).Scan(&status); err != nil || status != "retry_queued" {
			t.Fatalf("single retry persisted status=%q err=%v", status, err)
		}
	})
}
