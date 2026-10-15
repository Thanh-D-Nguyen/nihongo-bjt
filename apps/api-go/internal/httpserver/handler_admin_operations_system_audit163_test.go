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

func TestAdminOperationsSystemAUDIT163(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, deniedID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit163-%s@example.test", actorID[:8]), "AUDIT-163 Admin")
	seedAdminActor(t, db, deniedID, fmt.Sprintf("audit163-denied-%s@example.test", deniedID[:8]), "AUDIT-163 Denied")
	token, deniedToken := createAdminSession(t, sessions, actorID), createAdminSession(t, sessions, deniedID)
	grantAdminPermission(t, db, actorID, "iam.manage")
	grantAdminPermission(t, db, actorID, "viewer.audit")
	queue := "audit163_" + strings.ReplaceAll(actorID, "-", "")[:12]
	flagKey := "queue." + queue + ".paused"
	killKey := "audit163.kill." + strings.ReplaceAll(actorID, "-", "")[:12]
	if _, err := db.Exec(ctx, `INSERT INTO ops.feature_flag (key, enabled, kill_switch, description, scope, rules, created_at, updated_at) VALUES ($1,true,true,'AUDIT-163 kill switch','audit163','{}',now(),now())`, killKey); err != nil {
		t.Fatalf("seed disposable kill switch: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.feature_flag WHERE key IN ($1,$2)`, flagKey, killKey)
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
				req.Header.Set("X-CSRF-Token", "audit163-csrf")
			}
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path, body, permission string
	}{
		{http.MethodGet, "/api/admin/operations/system/health", "", "viewer.audit"},
		{http.MethodGet, "/api/admin/operations/system/queue-health", "", "viewer.audit"},
		{http.MethodGet, "/api/admin/operations/system/queue-health/actions", "", "viewer.audit"},
		{http.MethodPost, "/api/admin/operations/system/queue-health/drain", fmt.Sprintf(`{"queueName":%q,"reason":"AUDIT-163 drain","confirmation":%q}`, queue, queue), "iam.manage"},
		{http.MethodPost, "/api/admin/operations/system/queue-health/pause", fmt.Sprintf(`{"queueName":%q,"reason":"AUDIT-163 pause"}`, queue), "iam.manage"},
		{http.MethodPost, "/api/admin/operations/system/queue-health/resume", fmt.Sprintf(`{"queueName":%q,"reason":"AUDIT-163 resume"}`, queue), "iam.manage"},
		{http.MethodGet, "/api/admin/operations/system/release", "", ""},
		{http.MethodGet, "/api/admin/operations/system/release/history", "", "viewer.audit"},
		{http.MethodPost, "/api/admin/operations/system/release/mark-known-good", `{"version":"audit163-v1","reason":"AUDIT-163 known good","confirmation":"audit163-v1"}`, "iam.manage"},
		{http.MethodPost, "/api/admin/operations/system/release/prepare-rollback", `{"targetVersion":"audit163-v0","reason":"AUDIT-163 rollback","confirmation":"audit163-v0"}`, "iam.manage"},
		{http.MethodGet, "/api/admin/operations/kill-switches", "", "iam.manage"},
	}
	for _, route := range routes {
		route := route
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, route.body, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			deniedStatus := http.StatusForbidden
			if route.permission == "" {
				deniedStatus = http.StatusOK // release metadata is admin-session scoped by the router.
			}
			if got := call(route.method, route.path, route.body, deniedToken, true).Code; got != deniedStatus {
				t.Fatalf("admin without %s status=%d; want %d", route.permission, got, deniedStatus)
			}
			if route.method != http.MethodGet {
				if got := call(route.method, route.path, route.body, token, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing CSRF status=%d; want 403", got)
				}
			}
			res := call(route.method, route.path, route.body, token, true)
			if res.Code != http.StatusOK {
				t.Fatalf("authorized status=%d body=%s", res.Code, res.Body.String())
			}
		})
	}
	killSwitches := call(http.MethodGet, "/api/admin/operations/kill-switches", "", token, true)
	var killList []map[string]json.RawMessage
	if err := json.Unmarshal(killSwitches.Body.Bytes(), &killList); err != nil || len(killList) == 0 {
		t.Fatalf("kill switch list status=%d body=%s err=%v", killSwitches.Code, killSwitches.Body.String(), err)
	}
	foundKillSwitch := false
	for _, item := range killList {
		var key string
		if json.Unmarshal(item["key"], &key) == nil && key == killKey {
			foundKillSwitch = true
			break
		}
	}
	if !foundKillSwitch {
		t.Fatalf("kill switch fixture %q missing from %s", killKey, killSwitches.Body.String())
	}
	release := call(http.MethodGet, "/api/admin/operations/system/release", "", token, true)
	var releaseBody map[string]json.RawMessage
	if err := json.Unmarshal(release.Body.Bytes(), &releaseBody); err != nil || len(releaseBody["version"]) == 0 || len(releaseBody["status"]) == 0 {
		t.Fatalf("release metadata status=%d body=%s err=%v", release.Code, release.Body.String(), err)
	}

	t.Run("health and queue read contracts and database errors", func(t *testing.T) {
		health := call(http.MethodGet, "/api/admin/operations/system/health", "", token, true)
		var healthBody map[string]json.RawMessage
		if err := json.Unmarshal(health.Body.Bytes(), &healthBody); err != nil || len(healthBody["checks"]) == 0 || len(healthBody["status"]) == 0 {
			t.Fatalf("health contract body=%s err=%v", health.Body.String(), err)
		}
		queueHealth := call(http.MethodGet, "/api/admin/operations/system/queue-health", "", token, true)
		var queueBody map[string]json.RawMessage
		if err := json.Unmarshal(queueHealth.Body.Bytes(), &queueBody); err != nil || len(queueBody["queues"]) == 0 || len(queueBody["deadLetters"]) == 0 {
			t.Fatalf("queue health contract body=%s err=%v", queueHealth.Body.String(), err)
		}
		searchSync := call(http.MethodGet, "/api/admin/operations/system/search-sync", "", token, true)
		var searchSyncBody map[string]json.RawMessage
		if err := json.Unmarshal(searchSync.Body.Bytes(), &searchSyncBody); err != nil || len(searchSyncBody["contentProjectionTotal"]) == 0 || len(searchSyncBody["status"]) == 0 || len(searchSyncBody["totalDocs"]) == 0 || len(searchSyncBody["byType"]) == 0 || len(searchSyncBody["lastJob"]) == 0 {
			t.Fatalf("search sync contract status=%d body=%s err=%v", searchSync.Code, searchSync.Body.String(), err)
		}
		for _, tc := range []struct{ table, renamed, path string }{
			{"ops.feature_flag", "ops.audit163_system_flags", "/api/admin/operations/system/health"},
			{"ops.dead_letter_entry", "ops.audit163_system_dead_letters", "/api/admin/operations/system/queue-health"},
			{"ops.admin_audit_log", "ops.audit163_system_audit_log", "/api/admin/operations/system/queue-health/actions"},
			{"ops.admin_audit_log", "ops.audit163_system_audit_log", "/api/admin/operations/system/release/history"},
			{"ops.admin_audit_log", "ops.audit163_system_audit_log", "/api/admin/operations/system/search-sync"},
		} {
			if _, err := db.Exec(ctx, "ALTER TABLE "+tc.table+" RENAME TO "+strings.TrimPrefix(tc.renamed, "ops.")); err != nil {
				t.Fatalf("rename %s: %v", tc.table, err)
			}
			res := call(http.MethodGet, tc.path, "", token, true)
			if _, err := db.Exec(ctx, "ALTER TABLE "+tc.renamed+" RENAME TO "+strings.TrimPrefix(tc.table, "ops.")); err != nil {
				t.Fatalf("restore %s: %v", tc.table, err)
			}
			if res.Code != http.StatusInternalServerError {
				t.Errorf("database failure %s status=%d body=%s; want 500", tc.path, res.Code, res.Body.String())
			}
		}
		for _, path := range []string{"/api/admin/operations/system/queue-health/actions?limit=invalid", "/api/admin/operations/system/release/history?limit=101"} {
			if res := call(http.MethodGet, path, "", token, true); res.Code != http.StatusBadRequest {
				t.Errorf("invalid query %s status=%d; want 400", path, res.Code)
			}
		}
	})

	t.Run("queue state, audit and idempotent state transitions", func(t *testing.T) {
		for _, action := range []struct {
			name   string
			paused bool
		}{{"pause", true}, {"resume", false}} {
			path := "/api/admin/operations/system/queue-health/" + action.name
			body := fmt.Sprintf(`{"queueName":%q,"reason":"AUDIT-163 %s"}`, queue, action.name)
			for attempt := 0; attempt < 2; attempt++ {
				if res := call(http.MethodPost, path, body, token, true); res.Code != http.StatusOK {
					t.Fatalf("%s attempt %d status=%d body=%s", action.name, attempt, res.Code, res.Body.String())
				}
			}
			var paused bool
			if err := db.QueryRow(ctx, `SELECT enabled FROM ops.feature_flag WHERE key=$1`, flagKey).Scan(&paused); err != nil || paused != action.paused {
				t.Fatalf("%s persisted paused=%t err=%v", action.name, paused, err)
			}
		}
		var auditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_type='ops.queue' AND target_id=$2`, actorID, queue).Scan(&auditCount); err != nil || auditCount != 7 {
			t.Fatalf("queue audit count=%d err=%v; want one event per accepted request", auditCount, err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,created_at) VALUES ('ops.queue.legacy', $1, $2, 'ops.queue', now())`, actorID, queue); err != nil {
			t.Fatalf("seed legacy queue event without reason: %v", err)
		}
		queueHealth := call(http.MethodGet, "/api/admin/operations/system/queue-health", "", token, true)
		var queueSnapshot struct {
			Queues []struct {
				Name   string `json:"name"`
				Paused bool   `json:"paused"`
			} `json:"queues"`
		}
		if err := json.Unmarshal(queueHealth.Body.Bytes(), &queueSnapshot); err != nil {
			t.Fatalf("decode queue health: %v", err)
		}
		foundQueue := false
		for _, item := range queueSnapshot.Queues {
			if item.Name == queue {
				foundQueue = true
				if item.Paused {
					t.Fatal("queue health reports resumed queue as paused")
				}
			}
		}
		if !foundQueue {
			t.Fatalf("queue health omitted persisted queue %q: %s", queue, queueHealth.Body.String())
		}
		actions := call(http.MethodGet, "/api/admin/operations/system/queue-health/actions?queueName="+queue, "", token, true)
		var queueActions []map[string]json.RawMessage
		if err := json.Unmarshal(actions.Body.Bytes(), &queueActions); err != nil || len(queueActions) == 0 || len(queueActions[0]["actor"]) == 0 {
			t.Fatalf("queue actions UI contract status=%d body=%s err=%v", actions.Code, actions.Body.String(), err)
		}
		if got := call(http.MethodPost, "/api/admin/operations/system/queue-health/drain", fmt.Sprintf(`{"queueName":%q,"reason":"AUDIT-163 drain"}`, queue), token, true).Code; got != http.StatusBadRequest {
			t.Fatalf("unconfirmed drain status=%d; want 400", got)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action='ops.queue.drain' AND target_id=$2`, actorID, queue).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("confirmed drain audit count=%d err=%v; drain must remain an auditable request", auditCount, err)
		}
		if _, err := db.Exec(ctx, `CREATE FUNCTION public.audit163_fail_queue_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_type='ops.queue' THEN RAISE EXCEPTION 'AUDIT-163 injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER audit163_fail_queue_audit BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.audit163_fail_queue_audit()`); err != nil {
			t.Fatalf("install queue audit failure fixture: %v", err)
		}
		failure := call(http.MethodPost, "/api/admin/operations/system/queue-health/pause", fmt.Sprintf(`{"queueName":%q,"reason":"AUDIT-163 atomic failure"}`, queue+"-failure"), token, true)
		_, _ = db.Exec(ctx, `DROP TRIGGER audit163_fail_queue_audit ON ops.admin_audit_log; DROP FUNCTION public.audit163_fail_queue_audit()`)
		if failure.Code != http.StatusInternalServerError {
			t.Fatalf("audit failure status=%d body=%s; want 500", failure.Code, failure.Body.String())
		}
		var failedMutationCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.feature_flag WHERE key=$1`, "queue."+queue+"-failure.paused").Scan(&failedMutationCount); err != nil || failedMutationCount != 0 {
			t.Fatalf("failed audited transition persisted %d flags; err=%v", failedMutationCount, err)
		}
	})

	t.Run("release action validations, persistence and UI history shape", func(t *testing.T) {
		release := call(http.MethodGet, "/api/admin/operations/system/release", "", token, true)
		var releaseBody map[string]json.RawMessage
		if err := json.Unmarshal(release.Body.Bytes(), &releaseBody); err != nil || len(releaseBody["version"]) == 0 || len(releaseBody["environment"]) == 0 || len(releaseBody["commitSha"]) == 0 {
			t.Fatalf("release metadata contract status=%d body=%s err=%v", release.Code, release.Body.String(), err)
		}
		var auditCount int
		for _, tc := range []struct{ path, bad, good, action, target string }{
			{"/api/admin/operations/system/release/mark-known-good", `{"version":"audit163-v2","reason":"AUDIT-163 invalid confirmation","confirmation":"wrong"}`, `{"version":"audit163-v2","reason":"AUDIT-163 known good","confirmation":"audit163-v2"}`, "ops.release.mark_known_good", "audit163-v2"},
			{"/api/admin/operations/system/release/prepare-rollback", `{"targetVersion":"audit163-v1","reason":"AUDIT-163 invalid confirmation","confirmation":"wrong"}`, `{"targetVersion":"audit163-v1","reason":"AUDIT-163 rollback","confirmation":"audit163-v1"}`, "ops.release.prepare_rollback", "audit163-v1"},
		} {
			if got := call(http.MethodPost, tc.path, `{"version":"","targetVersion":"","reason":"","confirmation":""}`, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("empty release request %s status=%d; want 400", tc.path, got)
			}
			invalid := call(http.MethodPost, tc.path, tc.bad, token, true)
			if invalid.Code != http.StatusBadRequest || !strings.Contains(invalid.Body.String(), `"code":"typed_confirmation_required"`) {
				t.Errorf("invalid confirmation %s status=%d body=%s; want typed-confirmation 400", tc.path, invalid.Code, invalid.Body.String())
			}
			for attempt := 0; attempt < 2; attempt++ {
				if res := call(http.MethodPost, tc.path, tc.good, token, true); res.Code != http.StatusOK {
					t.Fatalf("%s status=%d body=%s", tc.path, res.Code, res.Body.String())
				}
			}
			if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action=$2 AND target_id=$3`, actorID, tc.action, tc.target).Scan(&auditCount); err != nil || auditCount != 2 {
				t.Errorf("release audit %s count=%d err=%v; each accepted request is auditable", tc.action, auditCount, err)
			}
		}
		if _, err := db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,created_at) VALUES ('ops.release.legacy', $1, 'audit163-v0', 'ops.release', now())`, actorID); err != nil {
			t.Fatalf("seed legacy release event without reason: %v", err)
		}
		history := call(http.MethodGet, "/api/admin/operations/system/release/history?limit=100", "", token, true)
		var events []map[string]json.RawMessage
		if err := json.Unmarshal(history.Body.Bytes(), &events); err != nil || len(events) < 4 || len(events[0]["actor"]) == 0 {
			t.Fatalf("release history UI contract status=%d body=%s err=%v", history.Code, history.Body.String(), err)
		}
		if _, err := db.Exec(ctx, `CREATE FUNCTION public.audit163_fail_release_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_type='ops.release' THEN RAISE EXCEPTION 'AUDIT-163 injected release audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER audit163_fail_release_audit BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.audit163_fail_release_audit()`); err != nil {
			t.Fatalf("install release audit failure fixture: %v", err)
		}
		failure := call(http.MethodPost, "/api/admin/operations/system/release/mark-known-good", `{"version":"audit163-error","reason":"AUDIT-163 injected failure","confirmation":"audit163-error"}`, token, true)
		_, _ = db.Exec(ctx, `DROP TRIGGER audit163_fail_release_audit ON ops.admin_audit_log; DROP FUNCTION public.audit163_fail_release_audit()`)
		if failure.Code != http.StatusInternalServerError {
			t.Fatalf("release audit failure status=%d body=%s; want 500", failure.Code, failure.Body.String())
		}
	})
}
