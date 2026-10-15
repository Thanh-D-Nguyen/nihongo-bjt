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

func TestAdminOperationsDeadLetterWave4Contracts(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, deniedID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit162-dlq-%s@example.test", actorID[:8]), "AUDIT-162 DLQ Admin")
	seedAdminActor(t, db, deniedID, fmt.Sprintf("audit162-dlq-denied-%s@example.test", deniedID[:8]), "AUDIT-162 DLQ Denied")
	token, deniedToken := createAdminSession(t, sessions, actorID), createAdminSession(t, sessions, deniedID)
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	for i, id := range ids {
		status := "open"
		if i == 1 || i == 4 || i == 5 {
			status = "failed"
		}
		if _, err := db.Exec(ctx, `INSERT INTO ops.dead_letter_entry (id,source,queue_name,event_type,payload,status,retry_count) VALUES ($1,'audit162','audit162.queue','audit162.event','{"fixture":true}',$2,0)`, id, status); err != nil {
			t.Fatalf("seed dead-letter fixture: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_type='ops.dead_letter_entry' AND target_id=ANY($1::text[])`, ids)
		_, _ = db.Exec(ctx, `DELETE FROM ops.dead_letter_entry WHERE id=ANY($1::uuid[])`, ids)
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
		{http.MethodPatch, "/api/admin/operations/dead-letter-queue/bulk", fmt.Sprintf(`{"ids":[%q],"action":"discard","reason":"AUDIT-162 bulk"}`, ids[0]), true},
		{http.MethodGet, "/api/admin/operations/dead-letter-queue/" + ids[0], "", false},
		{http.MethodPatch, "/api/admin/operations/dead-letter-queue/" + ids[0], `{"status":"discarded","reason":"AUDIT-162 resolve"}`, true},
		{http.MethodPatch, "/api/admin/operations/dead-letter-queue/" + ids[1] + "/retry", `{"reason":"AUDIT-162 retry"}`, true},
	}
	for _, route := range routes {
		route := route
		t.Run(route.method+" "+route.path+" auth and CSRF", func(t *testing.T) {
			if got := call(route.method, route.path, route.body, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			if got := call(route.method, route.path, route.body, deniedToken, true).Code; got != http.StatusForbidden {
				t.Fatalf("admin without permission status=%d; want 403", got)
			}
			if route.write {
				grantAdminPermission(t, db, actorID, "iam.manage")
				if got := call(route.method, route.path, route.body, token, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing CSRF status=%d; want 403", got)
				}
			} else {
				grantAdminPermission(t, db, actorID, "admin.content.read")
			}
		})
	}
	_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_type='ops.dead_letter_entry' AND target_id=ANY($1::text[])`, ids)
	_, _ = db.Exec(ctx, `UPDATE ops.dead_letter_entry SET status=CASE WHEN id=$1 THEN 'open' ELSE 'failed' END, retry_count=0, resolved_at=NULL WHERE id=ANY($2::uuid[])`, ids[0], ids[:2])
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "iam.manage")

	t.Run("detail contract and audit actor", func(t *testing.T) {
		if _, err := db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,reason,after,created_at) VALUES ('ops.dead_letter.test',$1,$2,'ops.dead_letter_entry','fixture','{"status":"open"}',now())`, actorID, ids[0]); err != nil {
			t.Fatalf("seed audit: %v", err)
		}
		res := call(http.MethodGet, "/api/admin/operations/dead-letter-queue/"+ids[0], "", token, true)
		if res.Code != http.StatusOK {
			t.Fatalf("detail status=%d body=%s", res.Code, res.Body.String())
		}
		var detail struct {
			ID    string `json:"id"`
			Audit []struct {
				Actor struct {
					ID          string  `json:"id"`
					DisplayName *string `json:"displayName"`
					Email       *string `json:"email"`
				} `json:"actor"`
			} `json:"audit"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &detail); err != nil || detail.ID != ids[0] || len(detail.Audit) != 1 || detail.Audit[0].Actor.ID != actorID || detail.Audit[0].Actor.DisplayName == nil {
			t.Fatalf("detail contract=%s err=%v", res.Body.String(), err)
		}
	})

	t.Run("invalid id and DB failure are not reported as not found", func(t *testing.T) {
		if got := call(http.MethodGet, "/api/admin/operations/dead-letter-queue/not-a-uuid", "", token, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid UUID status=%d; want 400", got)
		}
		missingID := newUUID(t)
		for _, tc := range []struct{ method, path, body string }{
			{http.MethodGet, "/api/admin/operations/dead-letter-queue/" + missingID, ""},
			{http.MethodPatch, "/api/admin/operations/dead-letter-queue/" + missingID, `{"status":"discarded","reason":"AUDIT-162 missing"}`},
			{http.MethodPatch, "/api/admin/operations/dead-letter-queue/" + missingID + "/retry", `{"reason":"AUDIT-162 missing"}`},
		} {
			if got := call(tc.method, tc.path, tc.body, token, true).Code; got != http.StatusNotFound {
				t.Fatalf("missing entity %s %s status=%d; want 404", tc.method, tc.path, got)
			}
		}
		if _, err := db.Exec(ctx, `ALTER TABLE ops.dead_letter_entry RENAME TO dead_letter_entry_audit162_fault`); err != nil {
			t.Fatal(err)
		}
		res := call(http.MethodGet, "/api/admin/operations/dead-letter-queue/"+ids[0], "", token, true)
		_, restoreErr := db.Exec(ctx, `ALTER TABLE ops.dead_letter_entry_audit162_fault RENAME TO dead_letter_entry`)
		if restoreErr != nil {
			t.Fatal(restoreErr)
		}
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("DB failure status=%d body=%s; want 500", res.Code, res.Body.String())
		}
		if _, err := db.Exec(ctx, `ALTER TABLE ops.admin_audit_log RENAME TO admin_audit_log_audit162_fault`); err != nil {
			t.Fatal(err)
		}
		res = call(http.MethodGet, "/api/admin/operations/dead-letter-queue/"+ids[0], "", token, true)
		_, restoreErr = db.Exec(ctx, `ALTER TABLE ops.admin_audit_log_audit162_fault RENAME TO admin_audit_log`)
		if restoreErr != nil {
			t.Fatal(restoreErr)
		}
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("audit query failure status=%d body=%s; want 500", res.Code, res.Body.String())
		}
	})

	t.Run("retry is a single durable state transition", func(t *testing.T) {
		path := "/api/admin/operations/dead-letter-queue/" + ids[1] + "/retry"
		for attempt := 0; attempt < 2; attempt++ {
			res := call(http.MethodPatch, path, `{"reason":"AUDIT-162 retry"}`, token, true)
			if res.Code != http.StatusOK {
				t.Fatalf("retry attempt %d status=%d body=%s", attempt+1, res.Code, res.Body.String())
			}
		}
		var status string
		var retryCount, audits int
		if err := db.QueryRow(ctx, `SELECT status,retry_count FROM ops.dead_letter_entry WHERE id=$1`, ids[1]).Scan(&status, &retryCount); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='ops.dead_letter.retry'`, ids[1]).Scan(&audits); err != nil {
			t.Fatal(err)
		}
		if status != "open" || retryCount != 1 || audits != 1 {
			t.Fatalf("retry side effect status=%s count=%d audits=%d; want open/1/1", status, retryCount, audits)
		}
		bulkPath := "/api/admin/operations/dead-letter-queue/bulk"
		bulkBody := fmt.Sprintf(`{"ids":[%q],"action":"retry","reason":"AUDIT-162 bulk retry"}`, ids[5])
		for attempt := 0; attempt < 2; attempt++ {
			res := call(http.MethodPatch, bulkPath, bulkBody, token, true)
			if res.Code != http.StatusOK {
				t.Fatalf("bulk retry attempt %d status=%d body=%s", attempt+1, res.Code, res.Body.String())
			}
		}
		if err := db.QueryRow(ctx, `SELECT retry_count FROM ops.dead_letter_entry WHERE id=$1`, ids[5]).Scan(&retryCount); err != nil || retryCount != 1 {
			t.Fatalf("bulk retry count=%d err=%v; want 1 after duplicate request", retryCount, err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='ops.dead_letter.retry'`, ids[5]).Scan(&audits); err != nil || audits != 1 {
			t.Fatalf("bulk retry audit count=%d err=%v; want 1", audits, err)
		}
	})

	t.Run("resolve supports resolved state", func(t *testing.T) {
		res := call(http.MethodPatch, "/api/admin/operations/dead-letter-queue/"+ids[4], `{"status":"resolved","reason":"AUDIT-162 resolve"}`, token, true)
		if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"status":"resolved"`) {
			t.Fatalf("resolve status=%d body=%s; want resolved", res.Code, res.Body.String())
		}
	})

	t.Run("resolve and bulk audit are atomic", func(t *testing.T) {
		badID := "not-a-uuid"
		invalid := call(http.MethodPatch, "/api/admin/operations/dead-letter-queue/bulk", fmt.Sprintf(`{"ids":[%q],"action":"discard","reason":"AUDIT-162 invalid"}`, badID), token, true)
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("invalid bulk ID status=%d body=%s; want 400", invalid.Code, invalid.Body.String())
		}
		duplicate := call(http.MethodPatch, "/api/admin/operations/dead-letter-queue/bulk", fmt.Sprintf(`{"ids":[%q,%q],"action":"discard","reason":"AUDIT-162 duplicate"}`, ids[2], strings.ToUpper(ids[2])), token, true)
		if duplicate.Code != http.StatusBadRequest {
			t.Fatalf("duplicate bulk ID status=%d body=%s; want 400", duplicate.Code, duplicate.Body.String())
		}
		missing := call(http.MethodPatch, "/api/admin/operations/dead-letter-queue/bulk", fmt.Sprintf(`{"ids":[%q],"action":"discard","reason":"AUDIT-162 missing"}`, newUUID(t)), token, true)
		if missing.Code != http.StatusNotFound {
			t.Fatalf("missing bulk ID status=%d body=%s; want 404", missing.Code, missing.Body.String())
		}
		if _, err := db.Exec(ctx, `CREATE FUNCTION public.fail_dead_letter_audit162() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AUDIT-162 injected audit failure'; END $$`); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `CREATE TRIGGER fail_dead_letter_audit162 BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW WHEN (NEW.target_type='ops.dead_letter_entry') EXECUTE FUNCTION public.fail_dead_letter_audit162()`); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(ctx, `DROP TRIGGER IF EXISTS fail_dead_letter_audit162 ON ops.admin_audit_log`)
			_, _ = db.Exec(ctx, `DROP FUNCTION IF EXISTS public.fail_dead_letter_audit162()`)
		})
		resolve := call(http.MethodPatch, "/api/admin/operations/dead-letter-queue/"+ids[2], `{"status":"discarded","reason":"AUDIT-162 failing audit"}`, token, true)
		if resolve.Code != http.StatusInternalServerError {
			t.Fatalf("resolve audit failure status=%d body=%s; want 500", resolve.Code, resolve.Body.String())
		}
		bulk := call(http.MethodPatch, "/api/admin/operations/dead-letter-queue/bulk", fmt.Sprintf(`{"ids":[%q,%q],"action":"discard","reason":"AUDIT-162 failing audit"}`, ids[2], ids[3]), token, true)
		if bulk.Code != http.StatusInternalServerError {
			t.Fatalf("bulk audit failure status=%d body=%s; want 500", bulk.Code, bulk.Body.String())
		}
		var unchanged int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.dead_letter_entry WHERE id=ANY($1::uuid[]) AND status='open' AND retry_count=0`, ids[2:]).Scan(&unchanged); err != nil || unchanged != 2 {
			t.Fatalf("failed mutations changed %d entries err=%v; want 2 unchanged", 2-unchanged, err)
		}
	})
}
