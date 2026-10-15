package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestAdminBattleBotsCreateRequiresBattleManage(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	create := func(token, botKey string) *http.Response {
		t.Helper()
		body := fmt.Sprintf(`{"botKey":%q,"name":"Disposable RBAC bot","difficulty":"easy","accuracyPct":70,"minDelayMs":1000,"maxDelayMs":2000,"vocabularyLevel":"jlpt_n3","avatarFallback":"RB","styleToken":"focused","riveArtboard":"__default__","riveStateMachine":"__none__","riveProvenance":{"purpose":"rbac-regression"},"reason":"local regression"}`, botKey)
		req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/bots", strings.NewReader(body))
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
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

	anonymous := create("", "audit-bot-anon-"+newUUID(t))
	anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous create status=%d, want 401", anonymous.StatusCode)
	}

	rolelessID := newUUID(t)
	seedAdminActor(t, pool, rolelessID, fmt.Sprintf("bot-create-roleless-%s@example.com", rolelessID[:8]), "Roleless Bot Admin")
	rolelessKey := "audit-bot-roleless-" + rolelessID[:8]
	authorizedID := newUUID(t)
	seedAdminActor(t, pool, authorizedID, fmt.Sprintf("bot-create-authorized-%s@example.com", authorizedID[:8]), "Authorized Bot Admin")
	grantAdminPermission(t, pool, authorizedID, "battle.manage")
	authorizedKey := "audit-bot-authorized-" + authorizedID[:8]
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.battle_bot' AND (after->>'botKey'=$1 OR after->>'botKey'=$2)`, rolelessKey, authorizedKey)
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_bot WHERE bot_key IN ($1,$2)`, rolelessKey, authorizedKey)
	})
	roleless := create(createAdminSession(t, sessions, rolelessID), rolelessKey)
	if roleless.StatusCode != http.StatusForbidden {
		t.Fatalf("roleless create status=%d, want 403", roleless.StatusCode)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_bot WHERE bot_key=$1`, rolelessKey).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("roleless create persisted %d bot row(s)", count)
	}

	resp := create(createAdminSession(t, sessions, authorizedID), authorizedKey)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("authorized create status=%d, want 200", resp.StatusCode)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_bot WHERE bot_key=$1`, authorizedKey).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("authorized create persisted %d bot row(s), want 1", count)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE action='admin.battle.bot.created' AND target_type='learning.battle_bot' AND after->>'botKey'=$1`, authorizedKey).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("authorized create wrote %d audit row(s), want 1", count)
	}
}
