package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestAdminBattleAbuseListRequiresReadPermission(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	reportID := newUUID(t)
	subjectID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_abuse_report (id, subject_id, kind, description, updated_at)
		VALUES ($1, $2, 'harassment', 'disposable system report', now())`, reportID, subjectID); err != nil {
		t.Fatalf("seed disposable system abuse report: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_abuse_report WHERE id = $1`, reportID)
	})

	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/battle/abuse?page=1&pageSize=20", nil)
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
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
	seedAdminActor(t, pool, rolelessID, fmt.Sprintf("abuse-roleless-%s@example.com", rolelessID[:8]), "Roleless Abuse Viewer")
	rolelessToken := createAdminSession(t, sessions, rolelessID)
	denied := request(rolelessToken)
	denied.Body.Close()
	if denied.StatusCode != http.StatusForbidden {
		t.Fatalf("expected roleless Admin to receive 403, got %d", denied.StatusCode)
	}

	for _, permission := range []string{"iam.manage", "support.user.read"} {
		actorID := newUUID(t)
		seedAdminActor(t, pool, actorID, fmt.Sprintf("abuse-reader-%s@example.com", actorID[:8]), "Abuse Report Reader")
		grantAdminPermission(t, pool, actorID, permission)
		token := createAdminSession(t, sessions, actorID)
		allowed := request(token)
		var body struct {
			Items []struct {
				ID         string  `json:"id"`
				SubjectID  string  `json:"subjectId"`
				ReporterID *string `json:"reporterId"`
			} `json:"items"`
			Page     int `json:"page"`
			PageSize int `json:"pageSize"`
			Total    int `json:"total"`
		}
		if allowed.StatusCode != http.StatusOK {
			allowed.Body.Close()
			t.Fatalf("expected %s to receive 200, got %d", permission, allowed.StatusCode)
		}
		if err := json.NewDecoder(allowed.Body).Decode(&body); err != nil {
			allowed.Body.Close()
			t.Fatalf("decode %s list response: %v", permission, err)
		}
		allowed.Body.Close()
		if body.Page != 1 || body.PageSize != 20 || body.Total != len(body.Items) || len(body.Items) != 1 || body.Items[0].ID != reportID || body.Items[0].SubjectID != subjectID || body.Items[0].ReporterID != nil {
			t.Fatalf("unexpected %s list contract: %+v", permission, body)
		}
	}
}

func TestAdminBattleAbuseDetailRequiresReadPermission(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	reportID := newUUID(t)
	subjectID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.battle_abuse_report (id, subject_id, kind, description, evidence, updated_at)
		VALUES ($1, $2, 'harassment', 'disposable RBAC fixture', '{"source":"test"}'::jsonb, now())`, reportID, subjectID); err != nil {
		t.Fatalf("seed disposable abuse report: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.battle_abuse_report WHERE id = $1`, reportID)
	})

	request := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/battle/abuse/"+reportID, nil)
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
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
	seedAdminActor(t, pool, rolelessID, fmt.Sprintf("abuse-detail-roleless-%s@example.com", rolelessID[:8]), "Roleless Abuse Detail Viewer")
	roleless := request(createAdminSession(t, sessions, rolelessID))
	roleless.Body.Close()
	if roleless.StatusCode != http.StatusForbidden {
		t.Fatalf("expected roleless Admin to receive 403, got %d", roleless.StatusCode)
	}

	for _, permission := range []string{"iam.manage", "support.user.read"} {
		actorID := newUUID(t)
		seedAdminActor(t, pool, actorID, fmt.Sprintf("abuse-detail-reader-%s@example.com", actorID[:8]), "Abuse Detail Reader")
		grantAdminPermission(t, pool, actorID, permission)
		allowed := request(createAdminSession(t, sessions, actorID))
		var body map[string]json.RawMessage
		if allowed.StatusCode != http.StatusOK {
			allowed.Body.Close()
			t.Fatalf("expected %s to receive 200, got %d", permission, allowed.StatusCode)
		}
		if err := json.NewDecoder(allowed.Body).Decode(&body); err != nil {
			allowed.Body.Close()
			t.Fatalf("decode %s detail response: %v", permission, err)
		}
		allowed.Body.Close()
		var gotID, gotSubject, gotDescription string
		var gotEvidence map[string]any
		if err := json.Unmarshal(body["id"], &gotID); err != nil {
			t.Fatalf("decode %s report id: %v", permission, err)
		}
		if err := json.Unmarshal(body["subjectId"], &gotSubject); err != nil {
			t.Fatalf("decode %s subject id: %v", permission, err)
		}
		if err := json.Unmarshal(body["description"], &gotDescription); err != nil {
			t.Fatalf("decode %s description: %v", permission, err)
		}
		if err := json.Unmarshal(body["evidence"], &gotEvidence); err != nil {
			t.Fatalf("decode %s evidence: %v", permission, err)
		}
		if gotID != reportID || gotSubject != subjectID || gotDescription != "disposable RBAC fixture" || gotEvidence["source"] != "test" || string(body["reporterId"]) != "null" || string(body["priorAgainstSubject"]) != "[]" || string(body["audit"]) != "[]" {
			t.Fatalf("unexpected %s detail contract: %s", permission, body)
		}
	}
}
