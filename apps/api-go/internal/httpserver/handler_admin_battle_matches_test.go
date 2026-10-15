package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAdminBattleMatchesListUsesStartedAtAndAllowsRolelessAdminRead(t *testing.T) {
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	anonymous, err := srv.Client().Get(srv.URL + "/api/admin/battle/matches?page=0&pageSize=101")
	if err != nil {
		t.Fatal(err)
	}
	_ = anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d, want 401", anonymous.StatusCode)
	}

	actorID := newUUID(t)
	pool := testPool(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-matches-%s@example.com", actorID[:8]), "Roleless Battle Admin")
	olderID, newerID := newUUID(t), newUUID(t)
	questionID := seedBattleRoundQuestion(t, pool, actorID[:8])
	roomPrefix := "bm-" + actorID[:8]
	for _, fixture := range []struct {
		id, room, startedAt string
	}{{olderID, roomPrefix + "-old", "2026-01-01T00:00:00Z"}, {newerID, roomPrefix + "-new", "2026-01-02T00:00:00Z"}} {
		if _, err := pool.Exec(context.Background(), `
			INSERT INTO learning.battle_session (id, user_id, room_code, max_rounds, fairness_seed, started_at)
			VALUES ($1, $2, $3, 1, 'local-audit', $4)`, fixture.id, actorID, fixture.room, fixture.startedAt); err != nil {
			t.Fatalf("seed battle match: %v", err)
		}
	}
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_round (session_id, round_index, question_id, user_option_key, user_correct)
		VALUES ($1, 0, $2, 'A', true)`, newerID, questionID); err != nil {
		t.Fatalf("seed battle round: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id IN ($1, $2)`, olderID, newerID)
	})
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/battle/matches?page=0&pageSize=101", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("roleless Admin list status=%d, want 200", resp.StatusCode)
	}
	var result struct {
		Items []struct {
			ID                string `json:"id"`
			RoomCode          string `json:"roomCode"`
			Status            string `json:"status"`
			StartedAt         string `json:"startedAt"`
			CreatedAt         string `json:"createdAt"`
			CurrentRoundIndex *int   `json:"currentRoundIndex"`
			Count             *struct {
				Rounds *int `json:"rounds"`
			} `json:"_count"`
		} `json:"items"`
		Page     int `json:"page"`
		PageSize int `json:"pageSize"`
		Total    int `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) < 2 || result.Page != 1 || result.PageSize != 20 || result.Total < 2 {
		t.Fatalf("unexpected normalized match list response: %+v", result)
	}
	newerIndex, olderIndex := -1, -1
	for i, item := range result.Items {
		if item.ID == newerID {
			newerIndex = i
		}
		if item.ID == olderID {
			olderIndex = i
		}
	}
	if newerIndex < 0 || olderIndex < 0 || newerIndex >= olderIndex {
		t.Fatalf("expected fixtures ordered newest first; newer=%d older=%d", newerIndex, olderIndex)
	}
	newer, older := result.Items[newerIndex], result.Items[olderIndex]
	if newer.Status != "in_progress" || newer.CreatedAt != newer.StartedAt || newer.CurrentRoundIndex == nil || newer.Count == nil || newer.Count.Rounds == nil || *newer.CurrentRoundIndex != 0 || *newer.Count.Rounds != 1 || older.Count == nil || older.Count.Rounds == nil || *older.Count.Rounds != 0 {
		t.Fatalf("unexpected match fields/order: %+v", result.Items)
	}
}

func TestAdminBattleMatchesDetailReturnsClientContract(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-detail-%s@example.com", actorID[:8]), "Roleless Battle Admin")
	token := createAdminSession(t, sessions, actorID)
	matchID := newUUID(t)
	questionID := seedBattleRoundQuestion(t, pool, actorID[:8])
	roomCode := "detail-" + actorID[:8]
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_session (id, user_id, room_code, status, max_rounds, current_round_index, fairness_seed, user_score, opponent_score, started_at)
		VALUES ($1, $2, $3, 'in_progress', 1, 0, 'local-audit', 0, 0, '2026-01-03T00:00:00Z')`, matchID, actorID, roomCode); err != nil {
		t.Fatalf("seed battle session: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_round (session_id, round_index, question_id, user_option_key, user_correct)
		VALUES ($1, 0, $2, 'B', false)`, matchID, questionID); err != nil {
		t.Fatalf("seed battle round: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id=$1`, matchID)
	})
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO ops.admin_audit_log (actor_id, action, target_type, target_id, reason, before, after)
		VALUES ($1, 'admin.battle.match.test', 'learning.battle_session', $2, 'local audit fixture', '{"status":"new"}', '{"status":"in_progress"}')`, actorID, matchID); err != nil {
		t.Fatalf("seed match audit: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.battle_session' AND target_id=$1`, matchID)
	})
	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/battle/matches/"+matchID, nil)
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}
	anonymous := request("")
	_ = anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous detail status=%d, want 401", anonymous.StatusCode)
	}
	resp := request(token)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("roleless Admin detail status=%d, want 200", resp.StatusCode)
	}
	var result struct {
		ID                string `json:"id"`
		RoomCode          string `json:"roomCode"`
		CurrentRoundIndex int    `json:"currentRoundIndex"`
		Rounds            []struct {
			ID            string `json:"id"`
			RoundIndex    int    `json:"roundIndex"`
			QuestionID    string `json:"questionId"`
			UserOptionKey string `json:"userOptionKey"`
			UserCorrect   bool   `json:"userCorrect"`
		} `json:"rounds"`
		Audit []struct {
			Action string `json:"action"`
			Reason string `json:"reason"`
			Actor  struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			} `json:"actor"`
		} `json:"audit"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if result.ID != matchID || result.RoomCode != roomCode || result.CurrentRoundIndex != 0 || len(result.Rounds) != 1 || result.Rounds[0].QuestionID != questionID || result.Rounds[0].UserOptionKey != "B" || result.Rounds[0].UserCorrect || result.Audit == nil || len(result.Audit) != 1 || result.Audit[0].Action != "admin.battle.match.test" || result.Audit[0].Reason != "local audit fixture" || result.Audit[0].Actor.ID != actorID || result.Audit[0].Actor.DisplayName != "Roleless Battle Admin" {
		t.Fatalf("unexpected detail contract: %+v", result)
	}
}

func TestAdminBattleMatchAbortRequiresBattleManage(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, pool)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-abort-roleless-%s@example.com", actorID[:8]), "Roleless Battle Admin")
	matchID := seedAdminBattleMatch(t, pool, actorID, "in_progress")
	var seededStatus string
	if err := pool.QueryRow(context.Background(), `SELECT status FROM learning.battle_session WHERE id=$1`, matchID).Scan(&seededStatus); err != nil || seededStatus != "in_progress" {
		t.Fatalf("seeded match lookup: status=%q err=%v", seededStatus, err)
	}
	token := createAdminSession(t, sessions, actorID)
	check, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/battle/matches/"+matchID, nil)
	if err != nil {
		t.Fatal(err)
	}
	check.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	visible, err := srv.Client().Do(check)
	if err != nil {
		t.Fatal(err)
	}
	visibleBody, _ := io.ReadAll(visible.Body)
	_ = visible.Body.Close()
	if visible.StatusCode != http.StatusOK {
		t.Fatalf("seeded match detail status=%d, want 200; body=%s", visible.StatusCode, visibleBody)
	}
	resp := postAdminBattleMatchAction(t, srv, token, matchID, "abort", "local permission test")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("roleless abort status=%d, want 403; body=%s", resp.StatusCode, body)
	}
	var status string
	var audits int
	if err := pool.QueryRow(context.Background(), `SELECT status FROM learning.battle_session WHERE id=$1`, matchID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='learning.battle_session'`, matchID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if status != "in_progress" || audits != 0 {
		t.Fatalf("roleless abort side effects: status=%q auditRows=%d", status, audits)
	}
}

func TestAdminBattleMatchAbortPersistsStateAndAudit(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, pool)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-abort-authorized-%s@example.com", actorID[:8]), "Authorized Battle Admin")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	matchID := seedAdminBattleMatch(t, pool, actorID, "in_progress")
	resp := postAdminBattleMatchAction(t, srv, createAdminSession(t, sessions, actorID), matchID, "abort", "local persistence test")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("authorized abort status=%d, want 200", resp.StatusCode)
	}
	var status, abandonedReason string
	var completedAt *string
	if err := pool.QueryRow(context.Background(), `SELECT status, abandoned_reason, completed_at::text FROM learning.battle_session WHERE id=$1`, matchID).Scan(&status, &abandonedReason, &completedAt); err != nil {
		t.Fatal(err)
	}
	var audits int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='learning.battle_session' AND action='admin.battle.match.aborted' AND actor_id=$2 AND reason='local persistence test'`, matchID, actorID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if status != "abandoned" || abandonedReason != "admin_abort" || completedAt == nil || audits != 1 {
		t.Fatalf("abort persistence mismatch: status=%q reason=%q completedAt=%v auditRows=%d", status, abandonedReason, completedAt, audits)
	}
}

func TestAdminBattleMatchRerunRequiresBattleManage(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, pool)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-rerun-roleless-%s@example.com", actorID[:8]), "Roleless Battle Admin")
	matchID := seedAdminBattleMatch(t, pool, actorID, "completed")
	resp := postAdminBattleMatchAction(t, srv, createAdminSession(t, sessions, actorID), matchID, "rerun", "local permission test")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("roleless rerun status=%d, want 403", resp.StatusCode)
	}
	var matches, audits int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_session WHERE id=$1`, matchID).Scan(&matches); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='learning.battle_session'`, matchID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if matches != 1 || audits != 0 {
		t.Fatalf("roleless rerun side effects: matches=%d auditRows=%d", matches, audits)
	}
}

func TestAdminBattleMatchRerunCreatesSessionAndAudit(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, pool)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-rerun-authorized-%s@example.com", actorID[:8]), "Authorized Battle Admin")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	matchID := seedAdminBattleMatch(t, pool, actorID, "completed")
	resp := postAdminBattleMatchAction(t, srv, createAdminSession(t, sessions, actorID), matchID, "rerun", "local persistence test")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("authorized rerun status=%d, want 200", resp.StatusCode)
	}
	var result struct {
		ID       string `json:"id"`
		Status   string `json:"status"`
		RoomCode string `json:"roomCode"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if result.ID == "" || result.ID == matchID || result.Status != "in_progress" || result.RoomCode == "" {
		t.Fatalf("unexpected rerun response: %+v", result)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_session WHERE id=$1 AND status='in_progress' AND room_code=$2`, result.ID, result.RoomCode).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("rerun session was not persisted: matching rows=%d", count)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='learning.battle_session' AND action='admin.battle.match.rerun' AND actor_id=$2 AND reason='local persistence test'`, matchID, actorID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("rerun audit rows=%d, want 1", count)
	}
}

func TestAdminBattleMatchActionsRejectInvalidReasonWithoutSideEffects(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, pool)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-action-invalid-%s@example.com", actorID[:8]), "Authorized Battle Admin")
	grantAdminPermission(t, pool, actorID, "battle.manage")
	token := createAdminSession(t, sessions, actorID)
	abortID := seedAdminBattleMatch(t, pool, actorID, "in_progress")
	rerunID := seedAdminBattleMatch(t, pool, actorID, "completed")
	for _, action := range []struct{ id, name string }{{abortID, "abort"}, {rerunID, "rerun"}} {
		for _, body := range []string{"{", `{"reason":"   "}`} {
			resp := postAdminBattleMatchActionBody(t, srv, token, action.id, action.name, body)
			_ = resp.Body.Close()
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("invalid %s body status=%d, want 400", action.name, resp.StatusCode)
			}
		}
	}
	var abortStatus string
	if err := pool.QueryRow(context.Background(), `SELECT status FROM learning.battle_session WHERE id=$1`, abortID).Scan(&abortStatus); err != nil {
		t.Fatal(err)
	}
	var matches, audits int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.battle_session WHERE user_id=$1`, actorID).Scan(&matches); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_type='learning.battle_session' AND target_id IN ($1, $2)`, abortID, rerunID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if abortStatus != "in_progress" || matches != 2 || audits != 0 {
		t.Fatalf("invalid action side effects: abortStatus=%q matches=%d auditRows=%d", abortStatus, matches, audits)
	}
}

func TestAdminBattleSystemParametersFailsWhenAggregateQueryErrors(t *testing.T) {
	pool := testPool(t)
	pool.Close()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/battle/system-parameters", nil)
	adminBattleSystemParametersHandler(pool, slog.Default()).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("query failure status=%d, want 500; body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAdminBattleSystemParametersAllowsRolelessAdminRead(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, pool)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("battle-parameters-%s@example.com", actorID[:8]), "Roleless Battle Admin")
	token := createAdminSession(t, sessions, actorID)
	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/battle/system-parameters", nil)
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}
	anonymous := request("")
	_ = anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d, want 401", anonymous.StatusCode)
	}
	resp := request(token)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("roleless Admin status=%d, want 200", resp.StatusCode)
	}
	var got struct {
		ActiveBots          int `json:"activeBots"`
		ActiveConfigs       int `json:"activeConfigs"`
		PendingAbuseReports int `json:"pendingAbuseReports"`
		InProgressMatches   int `json:"inProgressMatches"`
		CompletedToday      int `json:"completedToday"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	var want struct {
		ActiveBots, ActiveConfigs, PendingAbuseReports, InProgressMatches, CompletedToday int
	}
	todayStart := time.Now().UTC().Truncate(24 * time.Hour).Format(time.RFC3339)
	for _, query := range []struct {
		sql   string
		args  []any
		count *int
	}{
		{"SELECT COUNT(*) FROM learning.battle_bot WHERE status='active'", nil, &want.ActiveBots},
		{"SELECT COUNT(*) FROM learning.battle_config WHERE status='published'", nil, &want.ActiveConfigs},
		{"SELECT COUNT(*) FROM learning.battle_abuse_report WHERE status='pending'", nil, &want.PendingAbuseReports},
		{"SELECT COUNT(*) FROM learning.battle_session WHERE status='in_progress'", nil, &want.InProgressMatches},
		{"SELECT COUNT(*) FROM learning.battle_session WHERE status='completed' AND completed_at >= $1", []any{todayStart}, &want.CompletedToday},
	} {
		if err := pool.QueryRow(context.Background(), query.sql, query.args...).Scan(query.count); err != nil {
			t.Fatal(err)
		}
	}
	if got.ActiveBots != want.ActiveBots || got.ActiveConfigs != want.ActiveConfigs || got.PendingAbuseReports != want.PendingAbuseReports || got.InProgressMatches != want.InProgressMatches || got.CompletedToday != want.CompletedToday {
		t.Fatalf("system parameter counts mismatch: got=%+v want=%+v", got, want)
	}
}

func seedAdminBattleMatch(t *testing.T, pool *pgxpool.Pool, userID, status string) string {
	t.Helper()
	matchID := newUUID(t)
	roomCode := "audit-" + matchID[:8]
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_session (id, user_id, room_code, status, max_rounds, fairness_seed, started_at)
		VALUES ($1, $2, $3, $4, 1, 'local-audit', now())`, matchID, userID, roomCode, status); err != nil {
		t.Fatalf("seed battle match: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.battle_session' AND (target_id=$1 OR target_id IN (SELECT id::text FROM learning.battle_session WHERE room_code LIKE $2))`, matchID, roomCode+"%")
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id=$1 OR room_code LIKE $2`, matchID, roomCode+"%")
	})
	return matchID
}

func postAdminBattleMatchAction(t *testing.T, srv *httptest.Server, token, matchID, action, reason string) *http.Response {
	t.Helper()
	body := fmt.Sprintf(`{"reason":%q}`, reason)
	return postAdminBattleMatchActionBody(t, srv, token, matchID, action, body)
}

func postAdminBattleMatchActionBody(t *testing.T, srv *httptest.Server, token, matchID, action, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/battle/matches/"+matchID+"/"+action, strings.NewReader(body))
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
	return resp
}

func seedBattleRoundQuestion(t *testing.T, pool *pgxpool.Pool, suffix string) string {
	t.Helper()
	testID, sectionID, questionID := newUUID(t), newUUID(t), newUUID(t)
	slug := "local-audit-" + suffix
	if _, err := pool.Exec(context.Background(), `INSERT INTO assessment.bjt_mock_test (id, slug, title_vi, type, status, created_at, updated_at) VALUES ($1, $2, 'Local audit fixture', 'practice', 'draft', now(), now())`, testID, slug); err != nil {
		t.Fatalf("seed BJT test: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `INSERT INTO assessment.bjt_test_section (id, test_id, code, title_vi, display_order) VALUES ($1, $2, 'audit', 'Local audit fixture', 0)`, sectionID, testID); err != nil {
		t.Fatalf("seed BJT section: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `INSERT INTO assessment.bjt_question (id, section_id, prompt, explanation_vi, skill_tag, created_at, updated_at) VALUES ($1, $2, 'Local audit question', 'Fixture only', 'audit', now(), now())`, questionID, sectionID); err != nil {
		t.Fatalf("seed BJT question: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM assessment.bjt_question WHERE id=$1`, questionID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM assessment.bjt_test_section WHERE id=$1`, sectionID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID)
	})
	return questionID
}
