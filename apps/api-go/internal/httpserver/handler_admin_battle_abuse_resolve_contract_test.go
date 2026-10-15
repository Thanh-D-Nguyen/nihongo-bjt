package httpserver

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestAdminBattleAbuseResolveAcceptsFrontendActions(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("abuse-resolve-%s@example.com", actorID[:8]), "Abuse Resolver")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	token := createAdminSession(t, sessions, actorID)

	actions := []struct {
		value      string
		wantStatus string
	}{
		{value: "warning", wantStatus: "resolved"},
		{value: "temp_ban", wantStatus: "resolved"},
		{value: "perm_ban", wantStatus: "resolved"},
		{value: "dismissed", wantStatus: "dismissed"},
		{value: "warned", wantStatus: "resolved"},
		{value: "banned", wantStatus: "resolved"},
		{value: "other", wantStatus: "resolved"},
	}

	for _, tc := range actions {
		t.Run(tc.value, func(t *testing.T) {
			reportID := newUUID(t)
			subjectID := newUUID(t)
			if _, err := pool.Exec(context.Background(), `
				INSERT INTO learning.battle_abuse_report (id, subject_id, kind, description, updated_at)
				VALUES ($1, $2, 'harassment', 'disposable resolve contract fixture', now())`, reportID, subjectID); err != nil {
				t.Fatalf("seed disposable abuse report: %v", err)
			}
			t.Cleanup(func() {
				_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id = $1 AND target_type = 'learning.battle_abuse_report'`, reportID)
				_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_abuse_report WHERE id = $1`, reportID)
			})

			body := fmt.Sprintf(`{"action":%q,"notes":"reviewed disposable evidence","reason":"local contract test"}`, tc.value)
			req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/abuse/"+reportID+"/resolve", strings.NewReader(body))
			if err != nil {
				t.Fatalf("create request: %v", err)
			}
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			resp, err := srv.Client().Do(req)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("expected action %q to resolve with 200, got %d", tc.value, resp.StatusCode)
			}

			var status, action, notes, resolvedBy string
			if err := pool.QueryRow(context.Background(), `
				SELECT status, action_taken, resolution_notes, resolved_by_id
				FROM learning.battle_abuse_report WHERE id = $1`, reportID).Scan(&status, &action, &notes, &resolvedBy); err != nil {
				t.Fatalf("read resolved report: %v", err)
			}
			if status != tc.wantStatus || action != tc.value || notes != "reviewed disposable evidence" || resolvedBy != actorID {
				t.Fatalf("unexpected persisted resolution: status=%q action=%q notes=%q resolver=%q", status, action, notes, resolvedBy)
			}
			var auditCount int
			if err := pool.QueryRow(context.Background(), `
				SELECT count(*) FROM ops.admin_audit_log
				WHERE target_id = $1 AND action = 'admin.battle.abuse.resolved'`, reportID).Scan(&auditCount); err != nil {
				t.Fatalf("count resolution audit rows: %v", err)
			}
			if auditCount != 1 {
				t.Fatalf("expected one resolution audit row, got %d", auditCount)
			}
		})
	}
}

func TestAdminBattleAbuseResolveInvalidActionErrorListsAcceptedActions(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("abuse-resolve-invalid-%s@example.com", actorID[:8]), "Abuse Resolver")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	body := `{"action":"bogus","notes":"invalid action fixture","reason":"invalid action check"}`
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/abuse/"+newUUID(t)+"/resolve", strings.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected invalid action to return 400, got %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read invalid action response: %v", err)
	}
	if !strings.Contains(string(raw), "warning, temp_ban, perm_ban, dismissed, warned, banned, or other") {
		t.Fatalf("expected invalid action error to list all accepted values, got %s", raw)
	}
}
