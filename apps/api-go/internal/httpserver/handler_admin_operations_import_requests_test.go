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

func TestAdminImportDurableOperationRequests(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("import-queue-%s@example.test", actorID[:8]), "Import Queue Admin")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	batchID, manifestID := newUUID(t), newUUID(t)
	errorIDs := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_batch (id,source_type,source_dir,status,updated_at) VALUES ($1,'request-test','disposable','failed',now())`, batchID); err != nil {
		t.Fatalf("seed batch: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_mapping (id,source_type,target_type,version,status,mapping,updated_at) VALUES ($1,'request-test','request-test-target',1,'approved','{"field":"value"}',now())`, manifestID); err != nil {
		t.Fatalf("seed manifest: %v", err)
	}
	for _, id := range errorIDs {
		if _, err := db.Exec(ctx, `INSERT INTO content.content_import_error (id,import_batch_id,phase,severity,code,message,sample) VALUES ($1,$2,'validate','error','REQUEST_TEST','disposable import error','{"fixture":true}')`, id, batchID); err != nil {
			t.Fatalf("seed import error: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 OR target_id=ANY($2::uuid[])`, actorID, append([]string{manifestID}, errorIDs...))
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_operation_request WHERE import_error_id=ANY($1::uuid[]) OR import_mapping_id=$2`, errorIDs, manifestID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_error WHERE id=ANY($1::uuid[])`, errorIDs)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_mapping WHERE id=$1`, manifestID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_batch WHERE id=$1`, batchID)
	})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "audit162-csrf")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	t.Run("manifest run is a durable queued request with atomic audit and visible state", func(t *testing.T) {
		res := call(http.MethodPost, "/api/admin/operations/import-manifests/"+manifestID+"/run", `{"reason":"queue manifest run"}`)
		var got struct {
			RequestID     string `json:"requestId"`
			Status        string `json:"status"`
			RequestStatus string `json:"requestStatus"`
		}
		if res.Code != http.StatusAccepted || json.Unmarshal(res.Body.Bytes(), &got) != nil || got.RequestID == "" || got.Status != "queued" || got.RequestStatus != "queued" {
			t.Fatalf("run response status=%d body=%s; want 202 and durable queued request", res.Code, res.Body.String())
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM content.content_import_operation_request WHERE id=$1 AND import_mapping_id=$2 AND operation='manifest_run' AND status='queued'`, got.RequestID, manifestID).Scan(&count); err != nil || count != 1 {
			t.Fatalf("manifest request count=%d err=%v", count, err)
		}
		var audits int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='ops.import_manifest.run'`, actorID, manifestID).Scan(&audits); err != nil || audits != 1 {
			t.Fatalf("manifest audit count=%d err=%v", audits, err)
		}
		list := call(http.MethodGet, "/api/admin/operations/import-manifests?status=active", "")
		if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"runStatus":"queued"`) || !strings.Contains(list.Body.String(), got.RequestID) {
			t.Fatalf("manifest list does not expose queued request: status=%d body=%s", list.Code, list.Body.String())
		}
		history := call(http.MethodGet, "/api/admin/operations/import-manifests/"+manifestID+"/history", "")
		if history.Code != http.StatusOK || !strings.Contains(history.Body.String(), got.RequestID) || !strings.Contains(history.Body.String(), `"requestStatus":"queued"`) {
			t.Fatalf("manifest history omits request state: status=%d body=%s", history.Code, history.Body.String())
		}
	})

	t.Run("single retry enqueues durably and is idempotent while queued", func(t *testing.T) {
		path := "/api/admin/operations/import-staging/errors/" + errorIDs[0] + "/retry"
		first := call(http.MethodPatch, path, `{"reason":"retry import item"}`)
		var a struct{ RequestID, Status string }
		if first.Code != http.StatusAccepted || json.Unmarshal(first.Body.Bytes(), &a) != nil || a.RequestID == "" || a.Status != "queued" {
			t.Fatalf("retry response status=%d body=%s; want 202 queued", first.Code, first.Body.String())
		}
		second := call(http.MethodPatch, path, `{"reason":"retry again"}`)
		var b struct{ RequestID, Status string }
		if second.Code != http.StatusAccepted || json.Unmarshal(second.Body.Bytes(), &b) != nil || b.RequestID != a.RequestID {
			t.Fatalf("retry did not reuse queued operation: first=%s second_status=%d second=%s", first.Body.String(), second.Code, second.Body.String())
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM content.content_import_operation_request WHERE import_error_id=$1 AND operation='retry' AND status='queued'`, errorIDs[0]).Scan(&count); err != nil || count != 1 {
			t.Fatalf("retry request count=%d err=%v", count, err)
		}
		var errorStatus string
		if err := db.QueryRow(ctx, `SELECT status FROM content.content_import_error WHERE id=$1`, errorIDs[0]).Scan(&errorStatus); err != nil || errorStatus != "retry_queued" {
			t.Fatalf("retry item state=%q err=%v", errorStatus, err)
		}
		list := call(http.MethodGet, "/api/admin/operations/import-staging/errors?batchId="+batchID, "")
		if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"operationStatus":"queued"`) || !strings.Contains(list.Body.String(), `"status":"retry_queued"`) {
			t.Fatalf("staging list hides retry state: status=%d body=%s", list.Code, list.Body.String())
		}
	})

	t.Run("discard and bulk discard persist state; bulk retry queues each item", func(t *testing.T) {
		discard := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/"+errorIDs[1]+"/discard", `{"reason":"discard invalid item"}`)
		if discard.Code != http.StatusOK || !strings.Contains(discard.Body.String(), `"status":"discarded"`) {
			t.Fatalf("discard status=%d body=%s", discard.Code, discard.Body.String())
		}
		var discarded string
		if err := db.QueryRow(ctx, `SELECT status FROM content.content_import_error WHERE id=$1`, errorIDs[1]).Scan(&discarded); err != nil || discarded != "discarded" {
			t.Fatalf("discard persistence state=%q err=%v", discarded, err)
		}
		bulkDiscard := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/bulk", fmt.Sprintf(`{"ids":[%q],"action":"discard","reason":"bulk discard invalid item"}`, errorIDs[2]))
		if bulkDiscard.Code != http.StatusOK || !strings.Contains(bulkDiscard.Body.String(), `"status":"discarded"`) {
			t.Fatalf("bulk discard status=%d body=%s", bulkDiscard.Code, bulkDiscard.Body.String())
		}
		if err := db.QueryRow(ctx, `SELECT status FROM content.content_import_error WHERE id=$1`, errorIDs[2]).Scan(&discarded); err != nil || discarded != "discarded" {
			t.Fatalf("bulk discard persistence state=%q err=%v", discarded, err)
		}
		bulkRetry := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/bulk", fmt.Sprintf(`{"ids":[%q],"action":"retry","reason":"bulk retry item"}`, errorIDs[0]))
		if bulkRetry.Code != http.StatusAccepted || !strings.Contains(bulkRetry.Body.String(), `"status":"queued"`) {
			t.Fatalf("bulk retry status=%d body=%s", bulkRetry.Code, bulkRetry.Body.String())
		}
		var retries int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM content.content_import_operation_request WHERE import_error_id=$1 AND operation='retry' AND status='queued'`, errorIDs[0]).Scan(&retries); err != nil || retries != 1 {
			t.Fatalf("bulk retry duplicate count=%d err=%v", retries, err)
		}
	})

	t.Run("audit failure rolls back queued request and status mutation", func(t *testing.T) {
		suffix := strings.ReplaceAll(errorIDs[3], "-", "")
		functionName := "audit162_reject_" + suffix
		triggerName := "audit162_trigger_" + suffix
		_, err := db.Exec(ctx, fmt.Sprintf(`CREATE FUNCTION ops.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ops.import_error.retry' AND NEW.target_id='%s' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`, functionName, errorIDs[3]))
		if err != nil {
			t.Fatalf("create audit failure function: %v", err)
		}
		_, err = db.Exec(ctx, fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION ops.%s()`, triggerName, functionName))
		if err != nil {
			t.Fatalf("create audit failure trigger: %v", err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(ctx, fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON ops.admin_audit_log`, triggerName))
			_, _ = db.Exec(ctx, fmt.Sprintf(`DROP FUNCTION IF EXISTS ops.%s()`, functionName))
		})
		res := call(http.MethodPatch, "/api/admin/operations/import-staging/errors/"+errorIDs[3]+"/retry", `{"reason":"retry rollback test"}`)
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("injected audit failure status=%d body=%s", res.Code, res.Body.String())
		}
		var queueCount, auditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM content.content_import_operation_request WHERE import_error_id=$1 AND operation='retry'`, errorIDs[3]).Scan(&queueCount); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='ops.import_error.retry'`, errorIDs[3]).Scan(&auditCount); err != nil {
			t.Fatal(err)
		}
		var itemStatus string
		if err := db.QueryRow(ctx, `SELECT status FROM content.content_import_error WHERE id=$1`, errorIDs[3]).Scan(&itemStatus); err != nil {
			t.Fatal(err)
		}
		if queueCount != 0 || auditCount != 0 || itemStatus != "open" {
			t.Fatalf("partial commit: queue=%d audit=%d item_status=%q", queueCount, auditCount, itemStatus)
		}
	})
}
