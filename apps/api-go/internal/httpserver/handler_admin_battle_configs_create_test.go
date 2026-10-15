package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestAdminBattleConfigsCreatePersistsBotDifficulties(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-config-%s@example.com", actorID[:8]), "Battle Config Admin")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	token := createAdminSession(t, sessions, actorID)
	name := "audit-config-" + actorID[:8]
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.battle_config' AND target_id IN (SELECT id FROM learning.battle_config WHERE name=$1)`, name)
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_config WHERE name=$1`, name)
	})

	body := `{"name":"` + name + `","level":"jlpt_n3","questionPoolKey":"bjt_questions_active","questionCount":10,"timePerQuestionSec":30,"maxParticipants":2,"botDifficulties":["medium"],"scoringRules":{"correctPoints":10},"reason":"local integration regression"}`
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/configs", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("create status=%d, want 200", resp.StatusCode)
	}
	var result struct {
		ID              string   `json:"id"`
		Name            string   `json:"name"`
		BotDifficulties []string `json:"botDifficulties"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if result.ID == "" || result.Name != name || len(result.BotDifficulties) != 1 || result.BotDifficulties[0] != "medium" {
		t.Fatalf("unexpected create response: %+v", result)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_config WHERE id=$1 AND bot_difficulties=ARRAY['medium']::text[]`, result.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected persisted text[] bot difficulty, matching rows=%d", count)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE action='admin.battle.config.created' AND target_type='learning.battle_config' AND target_id=$1`, result.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected one create audit row, got %d", count)
	}
}

func TestAdminBattleConfigsCreateRequiresBattleManage(t *testing.T) {
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, testPool(t), actorID, fmt.Sprintf("config-roleless-%s@example.com", actorID[:8]), "Roleless Config Admin")
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/configs", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("roleless create status=%d, want 403", resp.StatusCode)
	}
}

func TestAdminBattleConfigsDuplicatePreservesBotDifficulties(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-config-duplicate-%s@example.com", actorID[:8]), "Battle Config Admin")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	sourceID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_config
			(id, name, level, question_pool_key, question_count, time_per_question_sec, max_participants, bot_difficulties, scoring_rules, created_by_id, updated_by_id, updated_at)
		VALUES ($1, 'Disposable source config', 'jlpt_n3', 'bjt_questions_active', 10, 30, 2, ARRAY['medium']::text[], '{"correctPoints":10}'::jsonb, $2, $2, now())`, sourceID, actorID); err != nil {
		t.Fatalf("seed source config: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.battle_config' AND target_id IN (SELECT id::text FROM learning.battle_config WHERE id=$1 OR name='Disposable source config (copy)')`, sourceID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_config WHERE id=$1 OR name='Disposable source config (copy)'`, sourceID)
	})

	duplicate := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/configs/"+sourceID+"/duplicate", strings.NewReader(`{"reason":"local duplicate integration regression"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("duplicate request: %v", err)
		}
		return resp
	}

	anonymous := duplicate("")
	anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous duplicate status=%d, want 401", anonymous.StatusCode)
	}
	allowed := duplicate(createAdminSession(t, sessions, actorID))
	defer allowed.Body.Close()
	if allowed.StatusCode != http.StatusOK {
		t.Fatalf("authorized duplicate status=%d, want 200", allowed.StatusCode)
	}
	var result struct {
		ID              string   `json:"id"`
		Name            string   `json:"name"`
		Status          string   `json:"status"`
		BotDifficulties []string `json:"botDifficulties"`
	}
	if err := json.NewDecoder(allowed.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if result.ID == "" || result.Name != "Disposable source config (copy)" || result.Status != "draft" || len(result.BotDifficulties) != 1 || result.BotDifficulties[0] != "medium" {
		t.Fatalf("unexpected duplicate response: %+v", result)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_config WHERE id=$1 AND bot_difficulties=ARRAY['medium']::text[]`, result.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("duplicate didn't preserve text[] bot difficulties, matching rows=%d", count)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE action='admin.battle.config.duplicated' AND target_type='learning.battle_config' AND target_id=$1`, result.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected one duplicate audit row, got %d", count)
	}
}
