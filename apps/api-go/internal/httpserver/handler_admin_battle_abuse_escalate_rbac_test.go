package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestAdminBattleAbuseEscalateRequiresBattleManage(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	reportID := newUUID(t)
	subjectID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_abuse_report (id, subject_id, kind, description, updated_at)
		VALUES ($1, $2, 'harassment', 'disposable write RBAC fixture', now())`, reportID, subjectID); err != nil {
		t.Fatalf("seed disposable abuse report: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id = $1 AND target_type = 'learning.battle_abuse_report'`, reportID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_abuse_report WHERE id = $1`, reportID)
	})

	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/abuse/"+reportID+"/escalate", strings.NewReader(`{"reason":"local regression"}`))
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		return resp
	}

	anonymous := request("")
	anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected anonymous request to return 401, got %d", anonymous.StatusCode)
	}

	rolelessID := newUUID(t)
	seedAdminActor(t, pool, rolelessID, fmt.Sprintf("abuse-escalate-roleless-%s@example.com", rolelessID[:8]), "Roleless Abuse Moderator")
	roleless := request(createAdminSession(t, sessions, rolelessID))
	roleless.Body.Close()
	if roleless.StatusCode != http.StatusForbidden {
		t.Fatalf("expected roleless Admin to receive 403, got %d", roleless.StatusCode)
	}
	var status string
	if err := pool.QueryRow(context.Background(), `SELECT status FROM learning.battle_abuse_report WHERE id = $1`, reportID).Scan(&status); err != nil {
		t.Fatalf("read report after denied request: %v", err)
	}
	if status != "open" {
		t.Fatalf("roleless request changed report status to %q", status)
	}

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("abuse-escalate-authorized-%s@example.com", actorID[:8]), "Authorized Abuse Moderator")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	allowed := request(createAdminSession(t, sessions, actorID))
	allowed.Body.Close()
	if allowed.StatusCode != http.StatusOK {
		t.Fatalf("expected battle.manage Admin to receive 200, got %d", allowed.StatusCode)
	}
	if err := pool.QueryRow(context.Background(), `SELECT status FROM learning.battle_abuse_report WHERE id = $1`, reportID).Scan(&status); err != nil {
		t.Fatalf("read report after authorized request: %v", err)
	}
	if status != "escalated" {
		t.Fatalf("expected authorized request to persist escalated status, got %q", status)
	}
	var auditCount int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id = $1 AND action = 'admin.battle.abuse.escalated'`, reportID).Scan(&auditCount); err != nil {
		t.Fatalf("count escalation audit rows: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected one escalation audit row, got %d", auditCount)
	}
}
