package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestAdminCardgenJobsListIncludesJobsWithNullableRuleAndUser(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()

	jobID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.flashcard_gen_job (id, mode, status, cards_generated)
		VALUES ($1, 'manual', 'completed', 3)`, jobID); err != nil {
		t.Fatalf("seed card generation job: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_job WHERE id=$1`, jobID)
	})

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-%s@example.com", actorID[:8]), "Cardgen Admin")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodGet, server.URL+"/api/admin/cardgen/jobs", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d, want 200", resp.StatusCode)
	}
	var jobs []struct {
		ID             string `json:"id"`
		RuleID         string `json:"ruleId"`
		UserID         string `json:"userId"`
		Status         string `json:"status"`
		CardsGenerated int    `json:"cardsGenerated"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jobs); err != nil {
		t.Fatal(err)
	}
	for _, job := range jobs {
		if job.ID == jobID {
			if job.RuleID != "" || job.UserID != "" || job.Status != "completed" || job.CardsGenerated != 3 {
				t.Fatalf("unexpected job contract: %+v", job)
			}
			return
		}
	}
	t.Fatalf("nullable card generation job %s omitted from response: %+v", jobID, jobs)
}

func TestAdminCardgenJobDetailUsesPersistedParamsAndNullableReferences(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()

	jobID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.flashcard_gen_job (id, mode, status, cards_generated, params)
		VALUES ($1, 'manual', 'completed', 2, '{"level":"J2"}')`, jobID); err != nil {
		t.Fatalf("seed card generation job: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_job WHERE id=$1`, jobID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-detail-%s@example.com", actorID[:8]), "Cardgen Detail Admin")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodGet, server.URL+"/api/admin/cardgen/jobs/"+jobID, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d, want 200", resp.StatusCode)
	}
	var job struct {
		ID     string          `json:"id"`
		RuleID string          `json:"ruleId"`
		UserID string          `json:"userId"`
		Params json.RawMessage `json:"params"`
		Status string          `json:"status"`
		Count  int             `json:"cardsGenerated"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&job); err != nil {
		t.Fatal(err)
	}
	if job.ID != jobID || job.RuleID != "" || job.UserID != "" || job.Status != "completed" || job.Count != 2 || string(job.Params) != `{"level":"J2"}` {
		t.Fatalf("unexpected card generation detail contract: %+v", job)
	}
	for _, fixture := range []struct {
		id     string
		status int
	}{{"bad-id", http.StatusBadRequest}, {newUUID(t), http.StatusNotFound}} {
		badReq, err := http.NewRequest(http.MethodGet, server.URL+"/api/admin/cardgen/jobs/"+fixture.id, nil)
		if err != nil {
			t.Fatal(err)
		}
		badReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		badResp, err := server.Client().Do(badReq)
		if err != nil {
			t.Fatal(err)
		}
		_ = badResp.Body.Close()
		if badResp.StatusCode != fixture.status {
			t.Errorf("id %q status=%d, want %d", fixture.id, badResp.StatusCode, fixture.status)
		}
	}
}

func TestAdminCardgenRulesListReturnsCanonicalStoredRuleFields(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	ruleID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.flashcard_gen_rule
			(id,name,source_type,filter_level,direction,filter_tags,card_template,enabled,updated_at)
		VALUES ($1,'Audit cardgen rule','kanji','J2','jp_to_vn','["audit"]','{"front":"reading"}',true,now())`, ruleID); err != nil {
		t.Fatalf("seed card generation rule: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-rules-%s@example.com", actorID[:8]), "Cardgen Rules Admin")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodGet, server.URL+"/api/admin/cardgen/rules", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d, want 200", resp.StatusCode)
	}
	var rules []struct {
		ID          string          `json:"id"`
		Name        string          `json:"name"`
		SourceType  string          `json:"sourceType"`
		FilterLevel *string         `json:"filterLevel"`
		Direction   string          `json:"direction"`
		FilterTags  json.RawMessage `json:"filterTags"`
		Enabled     bool            `json:"enabled"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rules); err != nil {
		t.Fatal(err)
	}
	for _, rule := range rules {
		if rule.ID == ruleID {
			if rule.Name != "Audit cardgen rule" || rule.SourceType != "kanji" || rule.FilterLevel == nil || *rule.FilterLevel != "J2" || rule.Direction != "jp_to_vn" || string(rule.FilterTags) != `["audit"]` || !rule.Enabled {
				t.Fatalf("unexpected card generation rule contract: %+v", rule)
			}
			return
		}
	}
	t.Fatalf("persisted card generation rule %s omitted from response", ruleID)
}

func TestAdminCardgenRuleDetailReturnsCanonicalStoredRuleFields(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	ruleID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO learning.flashcard_gen_rule
			(id,name,source_type,filter_level,direction,filter_tags,card_template,enabled,updated_at)
		VALUES ($1,'Audit detail rule','grammar','J1','vn_to_jp','[]','{"back":"meaning"}',false,now())`, ruleID); err != nil {
		t.Fatalf("seed card generation rule: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-rule-detail-%s@example.com", actorID[:8]), "Cardgen Rule Detail Admin")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodGet, server.URL+"/api/admin/cardgen/rules/"+ruleID, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d, want 200", resp.StatusCode)
	}
	var rule struct {
		ID          string          `json:"id"`
		Name        string          `json:"name"`
		SourceType  string          `json:"sourceType"`
		FilterLevel *string         `json:"filterLevel"`
		Direction   string          `json:"direction"`
		FilterTags  json.RawMessage `json:"filterTags"`
		Enabled     bool            `json:"enabled"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rule); err != nil {
		t.Fatal(err)
	}
	if rule.ID != ruleID || rule.Name != "Audit detail rule" || rule.SourceType != "grammar" || rule.FilterLevel == nil || *rule.FilterLevel != "J1" || rule.Direction != "vn_to_jp" || string(rule.FilterTags) != "[]" || rule.Enabled {
		t.Fatalf("unexpected card generation rule detail contract: %+v", rule)
	}
}

func TestAdminCardgenRuleCreateRequiresContentWritePermission(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-write-%s@example.com", actorID[:8]), "Roleless Cardgen Admin")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/admin/cardgen/rules", strings.NewReader(`{"name":"Audit unauthorized rule","sourceType":"kanji","direction":"jp_to_vn"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("roleless Admin create status=%d, want 403", resp.StatusCode)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.flashcard_gen_rule WHERE name='Audit unauthorized rule'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("unauthorized create persisted %d rule(s)", count)
	}
}

func TestAdminCardgenRuleCreatePersistsCanonicalFieldsAndAudit(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-create-%s@example.com", actorID[:8]), "Authorized Cardgen Admin")
	grantAdminPermission(t, pool, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/admin/cardgen/rules", strings.NewReader(`{"name":"Audit authorized rule","sourceType":"kanji","filterLevel":"J2","direction":"jp_to_vn","filterTags":["audit"],"cardTemplate":{"front":"reading"},"enabled":true}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("authorized create status=%d, want 201; body=%s", resp.StatusCode, body)
	}
	var result struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='flashcard_gen_rule'`, result.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_rule WHERE id=$1`, result.ID)
	})
	var name, source, direction string
	var tags []string
	var template map[string]string
	if err := pool.QueryRow(context.Background(), `SELECT name,source_type,direction,filter_tags,card_template FROM learning.flashcard_gen_rule WHERE id=$1`, result.ID).Scan(&name, &source, &direction, &tags, &template); err != nil {
		t.Fatal(err)
	}
	if name != "Audit authorized rule" || source != "kanji" || direction != "jp_to_vn" || len(tags) != 1 || tags[0] != "audit" || template["front"] != "reading" {
		t.Fatalf("persisted fields mismatch: %q %q %q %s %s", name, source, direction, tags, template)
	}
	var auditCount int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='cardgen.rule.created'`, actorID, result.ID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 1 {
		t.Fatalf("create audit rows=%d, want 1", auditCount)
	}
}

func TestAdminCardgenRuleDeleteRequiresContentWritePermission(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	ruleID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `INSERT INTO learning.flashcard_gen_rule(id,name,source_type,updated_at) VALUES ($1,'Audit protected delete','lexeme',now())`, ruleID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-delete-denied-%s@example.com", actorID[:8]), "Roleless Cardgen Admin")
	token := createAdminSession(t, sessions, actorID)
	req, err := http.NewRequest(http.MethodDelete, server.URL+"/api/admin/cardgen/rules/"+ruleID, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("roleless Admin delete status=%d, want 403", resp.StatusCode)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("unauthorized delete changed rule row count to %d", count)
	}
}

func TestAdminCardgenRuleDeletePersistsAuditAndNotFoundContract(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	ruleID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `INSERT INTO learning.flashcard_gen_rule(id,name,source_type,updated_at) VALUES ($1,'Audit authorized delete','lexeme',now())`, ruleID); err != nil {
		t.Fatal(err)
	}
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-delete-%s@example.com", actorID[:8]), "Cardgen Delete Admin")
	grantAdminPermission(t, pool, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	deleteRule := func(id string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/api/admin/cardgen/rules/"+id, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", "http://localhost:3000")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		resp, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}
	resp := deleteRule(ruleID)
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		t.Fatalf("delete status=%d, want 200; body=%s", resp.StatusCode, body)
	}
	_ = resp.Body.Close()
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND action='cardgen.rule.deleted'`, ruleID)
	})
	var count, audits int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='cardgen.rule.deleted'`, actorID, ruleID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if count != 0 || audits != 1 {
		t.Fatalf("after delete rules=%d audits=%d, want 0 and 1", count, audits)
	}
	missing := deleteRule(ruleID)
	_ = missing.Body.Close()
	if missing.StatusCode != http.StatusNotFound {
		t.Fatalf("delete missing status=%d, want 404", missing.StatusCode)
	}
}

func TestAdminCardgenRuleUpdatePersistsCanonicalFieldsAndAudit(t *testing.T) {
	pool := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, pool)
	defer server.Close()
	ruleID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `INSERT INTO learning.flashcard_gen_rule(id,name,source_type,direction,updated_at) VALUES ($1,'Before update','lexeme','both',now())`, ruleID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND action='cardgen.rule.updated'`, ruleID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID)
	})
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("cardgen-update-%s@example.com", actorID[:8]), "Cardgen Update Admin")
	grantAdminPermission(t, pool, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	body := `{"name":"After update","sourceType":"kanji","filterLevel":"J2","direction":"jp_to_vn","filterTags":["updated"],"cardTemplate":{"front":"reading"},"enabled":false}`
	req, err := http.NewRequest(http.MethodPut, server.URL+"/api/admin/cardgen/rules/"+ruleID, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		t.Fatalf("update status=%d, want 200; body=%s", resp.StatusCode, data)
	}
	var name, source, direction string
	var level *string
	var tags []string
	var template map[string]string
	var enabled bool
	err = pool.QueryRow(context.Background(), `SELECT name,source_type,filter_level,direction,filter_tags,card_template,enabled FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID).Scan(&name, &source, &level, &direction, &tags, &template, &enabled)
	if err != nil {
		t.Fatal(err)
	}
	if name != "After update" || source != "kanji" || level == nil || *level != "J2" || direction != "jp_to_vn" || len(tags) != 1 || tags[0] != "updated" || template["front"] != "reading" || enabled {
		t.Fatalf("persisted update mismatch: %q %q %v %q %v %v %t", name, source, level, direction, tags, template, enabled)
	}
	var auditCount int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='cardgen.rule.updated'`, actorID, ruleID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 1 {
		t.Fatalf("update audit rows=%d, want 1", auditCount)
	}
	for _, fixture := range []struct {
		id, body string
		status   int
	}{{ruleID, `{}`, http.StatusBadRequest}, {"bad-id", `{"name":"bad"}`, http.StatusBadRequest}, {newUUID(t), `{"name":"missing"}`, http.StatusNotFound}} {
		badReq, err := http.NewRequest(http.MethodPut, server.URL+"/api/admin/cardgen/rules/"+fixture.id, strings.NewReader(fixture.body))
		if err != nil {
			t.Fatal(err)
		}
		badReq.Header.Set("Content-Type", "application/json")
		badReq.Header.Set("Origin", "http://localhost:3000")
		badReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		badResp, err := server.Client().Do(badReq)
		if err != nil {
			t.Fatal(err)
		}
		_ = badResp.Body.Close()
		if badResp.StatusCode != fixture.status {
			t.Errorf("id %q update status=%d, want %d", fixture.id, badResp.StatusCode, fixture.status)
		}
	}
}
