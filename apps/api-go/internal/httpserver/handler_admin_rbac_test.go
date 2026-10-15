package httpserver

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// adminRBACTestServer creates a test server with all M6 admin RBAC routes wired
// through the real router so admin guard + CSRF middleware are applied.
func adminRBACTestServer(t *testing.T) (*httptest.Server, *session.Store) {
	t.Helper()
	return adminRBACTestServerWithPool(t, testPool(t))
}

func adminRBACTestServerWithPool(t *testing.T, pool *pgxpool.Pool) (*httptest.Server, *session.Store) {
	t.Helper()
	rbacStore := authz.NewStore(pool)
	sessStore := session.NewStore(pool)
	credStore := credential.NewStore(pool)
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit:      100,
		Window:     time.Minute,
		TTL:        5 * time.Minute,
		EvictEvery: time.Minute,
		MaxKeys:    10000,
	})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	logger := slog.Default()

	router := NewRouter(Dependencies{
		Config:          &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:          logger,
		DBPool:          pool,
		SessionStore:    sessStore,
		RBACStore:       rbacStore,
		CredentialStore: credStore,
		RateLimiter:     rateLimiter,
	})

	return httptest.NewServer(router), sessStore
}

// seedAdminActor creates an admin actor directly in the authz schema for testing.
func seedAdminActor(t *testing.T, db *pgxpool.Pool, actorID, email, displayName string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, email, display_name, status, updated_at)
		 VALUES ($1, $2, $3, 'active', now())
		 ON CONFLICT (id) DO UPDATE SET email=$2, display_name=$3, status='active'`,
		actorID, email, displayName)
	if err != nil {
		t.Fatalf("seed admin actor failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM ops.admin_audit_log WHERE actor_id = $1`, actorID)
		_, _ = db.Exec(cctx, `DELETE FROM admin.audit_log WHERE admin_user_id = $1`, actorID)
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_actor WHERE id = $1`, actorID)
	})
}

func cleanupAdminActorByEmail(t *testing.T, db *pgxpool.Pool, email string) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, err := db.Exec(ctx, `DELETE FROM authz.admin_actor WHERE lower(email) = lower($1)`, email)
		if err != nil {
			t.Errorf("cleanup created admin actor %s: %v", email, err)
		}
	})
}

// seedAdminRole creates a role for testing.
func seedAdminRole(t *testing.T, db *pgxpool.Pool, roleID, code, name string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_role (id, code, name, status)
		 VALUES ($1, $2, $3, 'active')
		 ON CONFLICT (id) DO UPDATE SET code=$2, name=$3, status='active'`,
		roleID, code, name)
	if err != nil {
		t.Fatalf("seed admin role failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_role WHERE id = $1`, roleID)
	})
}

// seedAdminPermission creates a permission for testing.
func seedAdminPermission(t *testing.T, db *pgxpool.Pool, permID, code string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_permission (id, code)
		 VALUES ($1, $2)
		 ON CONFLICT (id) DO UPDATE SET code=$2`,
		permID, code)
	if err != nil {
		t.Fatalf("seed admin permission failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_permission WHERE id = $1`, permID)
	})
}

func grantAdminPermission(t *testing.T, db *pgxpool.Pool, actorID, code string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var permissionID string
	err := db.QueryRow(ctx, `SELECT id FROM authz.admin_permission WHERE code = $1`, code).Scan(&permissionID)
	if errors.Is(err, pgx.ErrNoRows) {
		permissionID = newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO authz.admin_permission (id, code) VALUES ($1, $2)`, permissionID, code); err != nil {
			t.Fatalf("seed %s permission: %v", code, err)
		}
		t.Cleanup(func() {
			cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer ccancel()
			_, _ = db.Exec(cctx, `DELETE FROM authz.admin_permission WHERE id = $1`, permissionID)
		})
	} else if err != nil {
		t.Fatalf("lookup %s permission: %v", code, err)
	}
	roleID := newUUID(t)
	roleCode := fmt.Sprintf("test-%s-%s", strings.ReplaceAll(code, ".", "-"), roleID[:8])
	if _, err := db.Exec(ctx, `INSERT INTO authz.admin_role (id, code, name) VALUES ($1, $2, $3)`, roleID, roleCode, "Test "+code); err != nil {
		t.Fatalf("create test role for %s: %v", code, err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO authz.admin_role_permission (role_id, permission_id) VALUES ($1, $2)`, roleID, permissionID); err != nil {
		t.Fatalf("grant %s to test role: %v", code, err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2)`, actorID, roleID); err != nil {
		t.Fatalf("assign test IAM role: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_role WHERE id = $1`, roleID)
	})
}

func grantIAMManage(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	grantAdminPermission(t, db, actorID, "iam.manage")
}

func assertAdminAuditEvent(t *testing.T, db *pgxpool.Pool, actorID, action, targetType, targetID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var count int
	err := db.QueryRow(ctx, `SELECT COUNT(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action=$2 AND target_type=$3 AND target_id=$4`, actorID, action, targetType, targetID).Scan(&count)
	if err != nil {
		t.Fatalf("query admin audit event: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one %s audit event for %s, got %d", action, targetID, count)
	}
}

func TestListActors_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("list-actors-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "List Actor")
	grantIAMManage(t, pool, actorID)
	rawToken := createAdminSession(t, sessStore, actorID)

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/actors", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var actors []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&actors); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if len(actors) < 1 {
		t.Error("expected at least one actor in list")
	}
}

func TestAdminSupportNotesRequiresPermission(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()
	for _, tc := range []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/admin/support/notes"},
		{method: http.MethodPost, path: "/api/admin/support/notes", body: `{"userId":"00000000-0000-0000-0000-000000000001","body":"note","reason":"test","visibility":"team"}`},
	} {
		req, err := http.NewRequest(tc.method, srv.URL+tc.path, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		if tc.method == http.MethodPost {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("anonymous request failed: %v", err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected anonymous %s %s to return 401, got %d", tc.method, tc.path, resp.StatusCode)
		}
	}

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("support-denied-%s@example.com", actorID[:8]), "Support Denied")
	rawToken := createAdminSession(t, sessStore, actorID)
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/support/notes", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	resp.Body.Close()
	req, err = http.NewRequest(http.MethodPost, srv.URL+"/api/admin/support/notes", strings.NewReader(`{"userId":"00000000-0000-0000-0000-000000000001","body":"note","reason":"test","visibility":"team"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Content-Type", "application/json")
	resp, err = srv.Client().Do(req)
	if err != nil {
		t.Fatalf("unauthorized create request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected create 403, got %d", resp.StatusCode)
	}
}

func TestAdminSupportNotesCreateListAndAudit(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, fmt.Sprintf("support-write-%s@example.com", actorID[:8]), "Support Writer")
	grantAdminPermission(t, pool, actorID, "support.user.write")
	rawToken := createAdminSession(t, sessStore, actorID)
	userID := newUUID(t)
	if _, err := pool.Exec(context.Background(), `INSERT INTO profile.user_profile (id, display_name, email, status, updated_at)
		VALUES ($1, 'Support fixture', $2, 'active', NOW())`, userID, fmt.Sprintf("support-user-%s@example.com", userID[:8])); err != nil {
		t.Fatalf("seed support user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id=$1`, userID) })

	request := func(method, path, body string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
		req.Header.Set("Origin", "http://localhost:3000")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request %s %s: %v", method, path, err)
		}
		return resp
	}
	for _, visibility := range []string{"team", "private", "audit_only"} {
		post := request(http.MethodPost, "/api/admin/support/notes", fmt.Sprintf(`{"userId":%q,"body":"%s note","reason":"Follow-up","visibility":%q}`, userID, visibility, visibility))
		if post.StatusCode != http.StatusCreated {
			post.Body.Close()
			t.Fatalf("expected create 201 for %s, got %d", visibility, post.StatusCode)
		}
		post.Body.Close()
	}
	sibling := request(http.MethodPost, "/api/admin/users/"+userID+"/support-notes", `{"body":"Additional support note","reason":"Follow-up","visibility":"team"}`)
	if sibling.StatusCode != http.StatusCreated {
		sibling.Body.Close()
		t.Fatalf("expected user support-note route create 201, got %d", sibling.StatusCode)
	}
	sibling.Body.Close()
	for _, tc := range []struct {
		body string
		want int
	}{
		{body: fmt.Sprintf(`{"userId":%q,"body":"No reason","visibility":"team"}`, userID), want: http.StatusBadRequest},
		{body: fmt.Sprintf(`{"userId":%q,"body":"Bad visibility","reason":"Follow-up","visibility":"public"}`, userID), want: http.StatusBadRequest},
		{body: fmt.Sprintf(`{"userId":%q,"body":"Missing user","reason":"Follow-up","visibility":"team"}`, newUUID(t)), want: http.StatusNotFound},
	} {
		invalid := request(http.MethodPost, "/api/admin/support/notes", tc.body)
		invalid.Body.Close()
		if invalid.StatusCode != tc.want {
			t.Fatalf("expected invalid create status %d, got %d", tc.want, invalid.StatusCode)
		}
	}
	var createAuditCount int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action='admin.support_note.created' AND target_type='admin.support_note' AND target_id=$2`, actorID, userID).Scan(&createAuditCount); err != nil {
		t.Fatalf("query create audit: %v", err)
	}
	if createAuditCount != 4 {
		t.Fatalf("expected four create audit events, got %d", createAuditCount)
	}

	get := request(http.MethodGet, "/api/admin/support/notes?userId="+userID+"&limit=50&offset=0", "")
	defer get.Body.Close()
	if get.StatusCode != http.StatusOK {
		t.Fatalf("expected list 200, got %d", get.StatusCode)
	}
	var listed struct {
		Items []struct {
			ID       string `json:"id"`
			TargetID string `json:"targetId"`
			After    struct {
				Body string `json:"body"`
			} `json:"after"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.NewDecoder(get.Body).Decode(&listed); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if listed.Total != 3 || len(listed.Items) != 3 || listed.Items[0].TargetID != userID || listed.Items[0].After.Body == "audit_only note" {
		t.Fatalf("created note missing or contract mismatch: %+v", listed)
	}
	var readAuditCount int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action='admin.support_note.listed'`, actorID).Scan(&readAuditCount); err != nil {
		t.Fatalf("query read audit: %v", err)
	}
	if readAuditCount != 1 {
		t.Fatalf("expected one read audit event, got %d", readAuditCount)
	}
}

func TestListActors_RequiresIAMManage(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("list-actors-no-iam-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "Admin Without IAM Permission")
	rawToken := createAdminSession(t, sessStore, actorID)

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/actors", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for Admin without iam.manage, got %d", resp.StatusCode)
	}

	createEmail := fmt.Sprintf("create-no-iam-%s@example.com", actorID[:8])
	body, _ := json.Marshal(map[string]string{"email": createEmail, "displayName": "Denied Actor", "password": "securepass123"})
	createReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(body))
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("X-CSRF-Token", "test-csrf")
	createReq.Header.Set("Origin", "http://localhost:3000")
	createReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	createResp, err := srv.Client().Do(createReq)
	if err != nil {
		t.Fatalf("create request failed: %v", err)
	}
	defer createResp.Body.Close()
	if createResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 when creating actor without iam.manage, got %d", createResp.StatusCode)
	}
	if actor, err := lookupAdminActorIDByEmail(context.Background(), pool, createEmail); err != nil || actor != "" {
		t.Fatalf("unauthorized create persisted actor %q (error %v)", actor, err)
	}
}

func TestIAMAdminListExposesRoleCodesForAdminClient(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("iam-list-contract-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "IAM List Contract")
	grantIAMManage(t, pool, actorID)
	rawToken := createAdminSession(t, sessStore, actorID)

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/iam/admins?page=1&pageSize=100", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result struct {
		Items []struct {
			ID        string          `json:"id"`
			RoleCodes json.RawMessage `json:"roleCodes"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	for _, item := range result.Items {
		if item.ID != actorID {
			continue
		}
		var codes []string
		if err := json.Unmarshal(item.RoleCodes, &codes); err != nil || len(codes) == 0 {
			t.Fatalf("expected roleCodes array for admin client, got %s", item.RoleCodes)
		}
		return
	}
	t.Fatalf("actor %s missing from IAM list", actorID)
}

func TestAdminAdsRuleUpsertPersistsRule(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("ads-rule-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "Ads Rule Admin")
	grantAdminPermission(t, pool, actorID, "ads.rules.manage")
	rawToken := createAdminSession(t, sessStore, actorID)
	ruleKey := "audit-test-" + actorID[:8]
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM monetization.ad_safety_rule WHERE rule_key = $1`, ruleKey)
	})

	body, _ := json.Marshal(map[string]any{
		"ruleKey": ruleKey, "enabled": false, "config": map[string]bool{"fixture": true}, "reason": "integration test",
	})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/ads/rules", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, payload)
	}
	var result struct {
		ID      string `json:"id"`
		RuleKey string `json:"ruleKey"`
		Enabled bool   `json:"enabled"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result.ID == "" || result.RuleKey != ruleKey || result.Enabled {
		t.Fatalf("unexpected rule result: %+v", result)
	}
	var persisted bool
	if err := pool.QueryRow(context.Background(), `SELECT enabled FROM monetization.ad_safety_rule WHERE id=$1`, result.ID).Scan(&persisted); err != nil || persisted {
		t.Fatalf("rule was not persisted disabled (enabled=%t, error=%v)", persisted, err)
	}
}

func TestAdminAnalyticsExportUsesRealData(t *testing.T) {
	pool := testPool(t)
	logger := slog.Default()
	handler := adminAnalyticsExportHandler(pool, logger)

	for _, tc := range []struct {
		view   string
		header []string
	}{
		{view: "summary", header: []string{"id", "value", "previous", "deltaRatio", "format", "available"}},
		{view: "timeseries", header: []string{"t", "value"}},
		{view: "breakdown", header: []string{"label", "key", "attempts", "averageScore", "passRate", "accuracy"}},
	} {
		body, _ := json.Marshal(map[string]string{"view": tc.view})
		req := httptest.NewRequest(http.MethodPost, "/api/admin/analytics/battle/export", bytes.NewReader(body))
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("view %s: expected 200, got %d: %s", tc.view, res.Code, res.Body.String())
		}
		if !strings.HasPrefix(res.Header().Get("Content-Type"), "text/csv") {
			t.Fatalf("view %s: expected CSV content type, got %q", tc.view, res.Header().Get("Content-Type"))
		}
		rows, err := csv.NewReader(strings.NewReader(res.Body.String())).ReadAll()
		if err != nil {
			t.Fatalf("view %s: parse CSV: %v", tc.view, err)
		}
		if len(rows) == 0 || strings.Join(rows[0], ",") != strings.Join(tc.header, ",") {
			t.Fatalf("view %s: unexpected CSV header: %v", tc.view, rows)
		}
		if strings.Contains(res.Body.String(), "placeholder") || strings.Contains(res.Body.String(), "(no data)") {
			t.Fatalf("view %s: export contains fabricated placeholder data: %s", tc.view, res.Body.String())
		}
	}

	body := []byte(`{"view":"unsupported"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/analytics/battle/export", bytes.NewReader(body))
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("unsupported view: expected 400, got %d", res.Code)
	}
}

func TestAdminAnalyticsRoutesRequireViewPermission(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, actorID+"@analytics.example.com", "Analytics Admin")
	token := createAdminSession(t, sessions, actorID)
	paths := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/admin/analytics"},
		{method: http.MethodGet, path: "/api/admin/analytics/battle/summary"},
		{method: http.MethodGet, path: "/api/admin/analytics/battle/timeseries"},
		{method: http.MethodGet, path: "/api/admin/analytics/battle/breakdown"},
		{method: http.MethodPost, path: "/api/admin/analytics/battle/export", body: `{"view":"summary"}`},
	}
	request := func(path string) int {
		var body io.Reader
		method := http.MethodGet
		for _, route := range paths {
			if route.path == path {
				method, body = route.method, strings.NewReader(route.body)
				break
			}
		}
		req, err := http.NewRequest(method, srv.URL+path, body)
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if method == http.MethodPost {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Origin", "http://localhost:3000")
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request %s: %v", path, err)
		}
		defer resp.Body.Close()
		return resp.StatusCode
	}
	for _, route := range paths {
		if got := request(route.path); got != http.StatusForbidden {
			t.Fatalf("expected 403 without analytics permission for %s, got %d", route.path, got)
		}
	}
	grantAdminPermission(t, pool, actorID, "analytics.view")
	for _, route := range paths {
		if got := request(route.path); got != http.StatusOK {
			t.Fatalf("expected 200 with analytics.view for %s, got %d", route.path, got)
		}
	}
}

func TestAdminAnalyticsRefreshPersistsCanonicalRollup(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, actorID+"@refresh.example.com", "Analytics Refresher")
	grantAdminPermission(t, pool, actorID, "analytics.view")
	token := createAdminSession(t, sessions, actorID)
	reason := "local audit refresh " + actorID
	body, _ := json.Marshal(map[string]string{"reason": reason})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/analytics/battle/refresh", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("refresh request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		payload, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 202, got %d: %s", resp.StatusCode, payload)
	}
	var result struct {
		RunID string `json:"runId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.RunID == "" {
		t.Fatalf("expected persisted rollup run id in response, got %+v (%v)", result, err)
	}
	var name, status string
	var details []byte
	if err := pool.QueryRow(context.Background(), `SELECT name, status, details FROM analytics.rollup_run WHERE id=$1`, result.RunID).Scan(&name, &status, &details); err != nil {
		t.Fatalf("refresh run not persisted: %v", err)
	}
	var metadata map[string]string
	if err := json.Unmarshal(details, &metadata); err != nil {
		t.Fatalf("decode rollup details: %v", err)
	}
	if name != "battle" || status != "accepted" || metadata["reason"] != reason || metadata["requestedBy"] != actorID {
		t.Fatalf("unexpected rollup record: name=%q status=%q details=%s", name, status, details)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM analytics.rollup_run WHERE id=$1`, result.RunID)
	})
}

func TestAdminAnalyticsSummaryReadsCanonicalRollupFreshness(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, actorID+"@freshness.example.com", "Analytics Viewer")
	grantAdminPermission(t, pool, actorID, "analytics.view")
	token := createAdminSession(t, sessions, actorID)
	var runID string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO analytics.rollup_run (name, status, window_start, window_end, metrics, details)
		VALUES ('battle', 'accepted', now(), now(), 0, '{}'::jsonb) RETURNING id`).Scan(&runID)
	if err != nil {
		t.Fatalf("seed canonical rollup: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), `DELETE FROM analytics.rollup_run WHERE id=$1`, runID) })
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/analytics/battle/summary", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("summary request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, payload)
	}
	var result struct {
		Freshness struct {
			Status       *string `json:"status"`
			SourceTable  string  `json:"sourceTable"`
			LastRollupAt *string `json:"lastRollupAt"`
		} `json:"freshness"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode summary: %v", err)
	}
	if result.Freshness.Status == nil || *result.Freshness.Status != "accepted" || result.Freshness.SourceTable != "learning.battle_session" {
		t.Fatalf("expected canonical rollup freshness, got %+v", result.Freshness)
	}
}

func TestAdminFlashcardAnalyticsUsesReviewEvents(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, actorID+"@flash-analytics.example.com", "Flashcard Analytics Viewer")
	grantAdminPermission(t, pool, actorID, "analytics.view")
	token := createAdminSession(t, sessions, actorID)
	var cardID, userFlashcardID string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO learning.flashcard_variant (source_type, source_id, front_text, back_text, created_at, updated_at)
		VALUES ('audit', gen_random_uuid(), 'front', 'back', now(), now()) RETURNING id`).Scan(&cardID)
	if err != nil {
		t.Fatalf("seed flashcard variant: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, cardID)
	})
	err = pool.QueryRow(context.Background(), `
		INSERT INTO learning.user_flashcard (user_id, card_id, created_at, updated_at) VALUES ($1, $2, now(), now()) RETURNING id`, actorID, cardID).Scan(&userFlashcardID)
	if err != nil {
		t.Fatalf("seed user flashcard: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE id=$1`, userFlashcardID)
	})
	_, err = pool.Exec(context.Background(), `
		INSERT INTO learning.review_event (user_id, user_flashcard_id, rating, elapsed_ms, previous_due_at, next_due_at, reviewed_at)
		VALUES ($1, $2, 'good', 350, now(), now() + interval '1 day', now())`, actorID, userFlashcardID)
	if err != nil {
		t.Fatalf("seed review event: %v", err)
	}

	get := func(path string) map[string]json.RawMessage {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request %s: %v", path, err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			payload, _ := io.ReadAll(resp.Body)
			t.Fatalf("%s: expected 200, got %d: %s", path, resp.StatusCode, payload)
		}
		var result map[string]json.RawMessage
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
		return result
	}

	var summary struct {
		KPIs []struct {
			ID        string   `json:"id"`
			Value     *float64 `json:"value"`
			Format    string   `json:"format"`
			Available bool     `json:"available"`
		} `json:"kpis"`
	}
	if err := json.Unmarshal(get("/api/admin/analytics/flashcards/summary")["kpis"], &summary.KPIs); err != nil {
		t.Fatalf("decode summary KPIs: %v", err)
	}
	if summary.KPIs[0].Value == nil || *summary.KPIs[0].Value != 1 {
		t.Fatalf("expected one persisted review in summary, got %+v", summary.KPIs)
	}
	if summary.KPIs[1].Value == nil || *summary.KPIs[1].Value != 1 || summary.KPIs[2].Value == nil || *summary.KPIs[2].Value != 1 || summary.KPIs[3].Value == nil || *summary.KPIs[3].Value != 350 || summary.KPIs[3].Format != "duration_ms" {
		t.Fatalf("expected cards reviewed, retention and duration KPIs to use event data, got %+v", summary.KPIs)
	}

	var series struct {
		Series []struct {
			Value float64 `json:"value"`
		} `json:"series"`
	}
	if err := json.Unmarshal(get("/api/admin/analytics/flashcards/timeseries")["series"], &series.Series); err != nil {
		t.Fatalf("decode timeseries: %v", err)
	}
	total := 0.0
	for _, point := range series.Series {
		total += point.Value
	}
	if total != 1 {
		t.Fatalf("expected one review in timeseries, got %v", total)
	}

	var breakdown struct {
		Rows []struct {
			Label    string `json:"label"`
			Attempts int    `json:"attempts"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(get("/api/admin/analytics/flashcards/breakdown")["rows"], &breakdown.Rows); err != nil {
		t.Fatalf("decode breakdown: %v", err)
	}
	if len(breakdown.Rows) != 1 || breakdown.Rows[0].Label != "good" || breakdown.Rows[0].Attempts != 1 {
		t.Fatalf("expected one good rating in breakdown, got %+v", breakdown.Rows)
	}
	if _, err := pool.Exec(context.Background(), `DELETE FROM learning.review_event WHERE user_flashcard_id=$1`, userFlashcardID); err != nil {
		t.Fatalf("clear review event fixture: %v", err)
	}
	summary.KPIs = nil
	if err := json.Unmarshal(get("/api/admin/analytics/flashcards/summary")["kpis"], &summary.KPIs); err != nil {
		t.Fatalf("decode empty summary KPIs: %v", err)
	}
	for _, index := range []int{2, 3, 4} {
		if summary.KPIs[index].Available || summary.KPIs[index].Value != nil {
			t.Fatalf("expected empty metric %s to be unavailable without a fabricated value, got %+v", summary.KPIs[index].ID, summary.KPIs[index])
		}
	}
}

func TestAdminGrowthAnalyticsUsesStudySessionXP(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedActiveUser(t, pool, actorID, "Growth Analytics Learner", actorID+"@growth-analytics.example.com", "growth-"+actorID)
	seedAdminActor(t, pool, actorID, actorID+"@growth-analytics-admin.example.com", "Growth Analytics Viewer")
	grantAdminPermission(t, pool, actorID, "analytics.view")
	token := createAdminSession(t, sessions, actorID)
	var sessionID string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO learning.study_session (user_id, mode, duration_minutes, xp_earned, completed, started_at)
		VALUES ($1, 'focus', 10, 42, true, now()) RETURNING id`, actorID).Scan(&sessionID)
	if err != nil {
		t.Fatalf("seed XP-bearing study session: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM learning.study_session WHERE id=$1`, sessionID)
	})
	call := func(path string) map[string]json.RawMessage {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request %s: %v", path, err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			payload, _ := io.ReadAll(resp.Body)
			t.Fatalf("%s: expected 200, got %d: %s", path, resp.StatusCode, payload)
		}
		var result map[string]json.RawMessage
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
		return result
	}
	var summary struct {
		KPIs []struct {
			ID        string   `json:"id"`
			Value     *float64 `json:"value"`
			Available bool     `json:"available"`
		} `json:"kpis"`
	}
	if err := json.Unmarshal(call("/api/admin/analytics/growth/summary")["kpis"], &summary.KPIs); err != nil {
		t.Fatalf("decode growth summary: %v", err)
	}
	if summary.KPIs[0].Value == nil || *summary.KPIs[0].Value != 1 || summary.KPIs[1].Value == nil || *summary.KPIs[1].Value != 42 {
		t.Fatalf("expected one XP event and 42 persisted XP in growth KPIs, got %+v", summary.KPIs)
	}
	if summary.KPIs[4].Available || summary.KPIs[4].Value != nil {
		t.Fatalf("streak updates must be unavailable without a persisted streak event source, got %+v", summary.KPIs[4])
	}
	var series struct {
		Series []struct {
			Value float64 `json:"value"`
		} `json:"series"`
	}
	if err := json.Unmarshal(call("/api/admin/analytics/growth/timeseries?metric=xp_total")["series"], &series.Series); err != nil {
		t.Fatalf("decode growth timeseries: %v", err)
	}
	total := 0.0
	for _, point := range series.Series {
		total += point.Value
	}
	if total != 42 {
		t.Fatalf("expected 42 XP in timeseries, got %v", total)
	}
	var breakdown struct {
		Rows []struct {
			Label    string `json:"label"`
			Attempts int    `json:"attempts"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(call("/api/admin/analytics/growth/breakdown")["rows"], &breakdown.Rows); err != nil {
		t.Fatalf("decode growth breakdown: %v", err)
	}
	if len(breakdown.Rows) != 1 || breakdown.Rows[0].Label != "focus" || breakdown.Rows[0].Attempts != 42 {
		t.Fatalf("expected 42 XP grouped by persisted study mode, got %+v", breakdown.Rows)
	}
	var learningSummary struct {
		KPIs []struct {
			ID        string   `json:"id"`
			Value     *float64 `json:"value"`
			Available bool     `json:"available"`
			Format    string   `json:"format"`
		} `json:"kpis"`
	}
	if err := json.Unmarshal(call("/api/admin/analytics/learning/summary")["kpis"], &learningSummary.KPIs); err != nil {
		t.Fatalf("decode learning summary: %v", err)
	}
	if learningSummary.KPIs[0].Value == nil || *learningSummary.KPIs[0].Value != 1 || learningSummary.KPIs[1].Value == nil || *learningSummary.KPIs[1].Value != 1 || learningSummary.KPIs[2].Value == nil || *learningSummary.KPIs[2].Value != 1 || learningSummary.KPIs[3].Value == nil || *learningSummary.KPIs[3].Value != 600000 || learningSummary.KPIs[3].Format != "duration_ms" || learningSummary.KPIs[4].Value == nil || *learningSummary.KPIs[4].Value != 1 {
		t.Fatalf("expected study_session values in all learning summary KPIs, got %+v", learningSummary.KPIs)
	}
	var learningSeries struct {
		Series []struct {
			Value float64 `json:"value"`
		} `json:"series"`
	}
	if err := json.Unmarshal(call("/api/admin/analytics/learning/timeseries?metric=completion_rate")["series"], &learningSeries.Series); err != nil {
		t.Fatalf("decode learning completion series: %v", err)
	}
	completedTotal := 0.0
	for _, point := range learningSeries.Series {
		completedTotal += point.Value
	}
	if completedTotal != 1 {
		t.Fatalf("expected one completed study session across the series, got %v", completedTotal)
	}
	var learningBreakdown struct {
		Rows []struct {
			Label    string `json:"label"`
			Attempts int    `json:"attempts"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(call("/api/admin/analytics/learning/breakdown")["rows"], &learningBreakdown.Rows); err != nil {
		t.Fatalf("decode learning breakdown: %v", err)
	}
	if len(learningBreakdown.Rows) != 1 || learningBreakdown.Rows[0].Label != "focus" || learningBreakdown.Rows[0].Attempts != 1 {
		t.Fatalf("expected one study session grouped under focus mode, got %+v", learningBreakdown.Rows)
	}
	if _, err := pool.Exec(context.Background(), `DELETE FROM learning.study_session WHERE id=$1`, sessionID); err != nil {
		t.Fatalf("remove study session fixture: %v", err)
	}
	if err := json.Unmarshal(call("/api/admin/analytics/learning/summary")["kpis"], &learningSummary.KPIs); err != nil {
		t.Fatalf("decode empty learning summary: %v", err)
	}
	for _, index := range []int{2, 3} {
		if learningSummary.KPIs[index].Available || learningSummary.KPIs[index].Value != nil {
			t.Fatalf("expected empty learning metric %s to be unavailable without a value, got %+v", learningSummary.KPIs[index].ID, learningSummary.KPIs[index])
		}
	}
}

func TestAdminGrowthAnalyticsConfigUsesStudySessions(t *testing.T) {
	cfg := domainConfigs["growth"]
	if cfg.SessionTable != "learning.study_session" {
		t.Fatalf("expected growth analytics source learning.study_session, got %s", cfg.SessionTable)
	}
	if domainConfigs["battle"].TimeColumn != "started_at" {
		t.Fatalf("expected battle analytics to use started_at, got %s", analyticsTimeColumn(domainConfigs["battle"]))
	}
}

func TestAdminLearningAnalyticsConfigUsesStudySessions(t *testing.T) {
	cfg := domainConfigs["learning"]
	if cfg.SessionTable != "learning.study_session" || analyticsTimeColumn(cfg) != "started_at" || cfg.BreakdownDim != "by_mode" {
		t.Fatalf("expected learning analytics to use learning.study_session.started_at grouped by mode, got table=%s time=%s dimension=%s", cfg.SessionTable, analyticsTimeColumn(cfg), cfg.BreakdownDim)
	}
}

func TestAdminSearchAnalyticsConfigUsesPersistedEvents(t *testing.T) {
	cfg := domainConfigs["search"]
	if cfg.SessionTable != "analytics.analytics_event" || analyticsTimeColumn(cfg) != "created_at" || cfg.BreakdownDim != "by_source" {
		t.Fatalf("expected search analytics to use analytics.analytics_event.created_at grouped by source, got table=%s time=%s dimension=%s", cfg.SessionTable, analyticsTimeColumn(cfg), cfg.BreakdownDim)
	}
}

func TestAdminSystemAnalyticsConfigUsesPersistedEvents(t *testing.T) {
	cfg := domainConfigs["system"]
	if cfg.SessionTable != "analytics.analytics_event" || analyticsTimeColumn(cfg) != "created_at" || cfg.BreakdownDim != "by_event_name" {
		t.Fatalf("expected system analytics to use analytics.analytics_event.created_at grouped by event_name, got table=%s time=%s dimension=%s", cfg.SessionTable, analyticsTimeColumn(cfg), cfg.BreakdownDim)
	}
}

func TestAdminSystemAnalyticsUsesPersistedEvents(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, actorID+"@system-analytics.example.com", "System Analytics Viewer")
	grantAdminPermission(t, pool, actorID, "analytics.view")
	token := createAdminSession(t, sessions, actorID)
	var eventID string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO analytics.analytics_event (anonymous_id, event_name, source, payload, created_at)
		VALUES ($1, 'study_session_completed', 'learner_web', '{}', now()) RETURNING id`, "audit-"+actorID).Scan(&eventID)
	if err != nil {
		t.Fatalf("seed system event: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM analytics.analytics_event WHERE id=$1`, eventID)
	})
	call := func(method, path string, body []byte) []byte {
		t.Helper()
		req, err := http.NewRequest(method, srv.URL+path, bytes.NewReader(body))
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request %s: %v", path, err)
		}
		defer resp.Body.Close()
		payload, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("read response %s: %v", path, err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", path, resp.StatusCode, payload)
		}
		return payload
	}
	var summary struct {
		KPIs []struct {
			ID        string   `json:"id"`
			Value     *float64 `json:"value"`
			Available bool     `json:"available"`
		} `json:"kpis"`
	}
	if err := json.Unmarshal(call(http.MethodGet, "/api/admin/analytics/system/summary", nil), &summary); err != nil {
		t.Fatalf("decode system summary: %v", err)
	}
	if summary.KPIs[0].Value == nil || *summary.KPIs[0].Value != 1 || summary.KPIs[1].Value == nil || *summary.KPIs[1].Value != 1 || summary.KPIs[2].Value == nil || *summary.KPIs[2].Value != 1 || summary.KPIs[3].Value == nil || *summary.KPIs[3].Value != 1 || summary.KPIs[4].Available {
		t.Fatalf("expected one persisted event/user/type and unavailable error-rate, got %+v", summary.KPIs)
	}
	var series struct {
		Series []struct {
			Value float64 `json:"value"`
		} `json:"series"`
	}
	if err := json.Unmarshal(call(http.MethodGet, "/api/admin/analytics/system/timeseries?metric=events", nil), &series); err != nil {
		t.Fatalf("decode system timeseries: %v", err)
	}
	total := 0.0
	for _, point := range series.Series {
		total += point.Value
	}
	if total != 1 {
		t.Fatalf("expected one event in timeseries, got %v", total)
	}
	var breakdown struct {
		Rows []struct {
			Label    string `json:"label"`
			Attempts int    `json:"attempts"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(call(http.MethodGet, "/api/admin/analytics/system/breakdown", nil), &breakdown); err != nil {
		t.Fatalf("decode system breakdown: %v", err)
	}
	if len(breakdown.Rows) != 1 || breakdown.Rows[0].Label != "study_session_completed" || breakdown.Rows[0].Attempts != 1 {
		t.Fatalf("expected event-name breakdown, got %+v", breakdown.Rows)
	}
	if export := string(call(http.MethodPost, "/api/admin/analytics/system/export", []byte(`{"view":"summary"}`))); !strings.Contains(export, "errorRate,,,,percent,false") {
		t.Fatalf("expected CSV to preserve unavailable error rate, got %s", export)
	}
}

func TestAdminSearchAnalyticsUsesPersistedEvents(t *testing.T) {
	pool := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, pool, actorID, actorID+"@search-analytics.example.com", "Search Analytics Viewer")
	grantAdminPermission(t, pool, actorID, "analytics.view")
	token := createAdminSession(t, sessions, actorID)
	var eventID string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO analytics.analytics_event (event_name, source, payload, created_at)
		VALUES ('content_search_submitted', 'learner_web', '{"query":"漢字","resultCount":3,"scope":"all"}', now()) RETURNING id`).Scan(&eventID)
	if err != nil {
		t.Fatalf("seed search event: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM analytics.analytics_event WHERE id=$1`, eventID)
	})
	call := func(method, path string, body []byte) (*http.Response, []byte) {
		t.Helper()
		req, err := http.NewRequest(method, srv.URL+path, bytes.NewReader(body))
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request %s: %v", path, err)
		}
		defer resp.Body.Close()
		payload, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("read response %s: %v", path, err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", path, resp.StatusCode, payload)
		}
		return resp, payload
	}
	_, summaryBody := call(http.MethodGet, "/api/admin/analytics/search/summary", nil)
	var summary struct {
		KPIs []struct {
			ID        string   `json:"id"`
			Value     *float64 `json:"value"`
			Available bool     `json:"available"`
		} `json:"kpis"`
	}
	if err := json.Unmarshal(summaryBody, &summary); err != nil {
		t.Fatalf("decode search summary: %v", err)
	}
	if summary.KPIs[0].Value == nil || *summary.KPIs[0].Value != 1 || summary.KPIs[1].Value == nil || *summary.KPIs[1].Value != 1 || summary.KPIs[2].Value == nil || *summary.KPIs[2].Value != 3 || summary.KPIs[3].Available || summary.KPIs[4].Value == nil || *summary.KPIs[4].Value != 0 {
		t.Fatalf("expected query/results metrics and unavailable click tracking from the persisted event, got %+v", summary.KPIs)
	}
	_, seriesBody := call(http.MethodGet, "/api/admin/analytics/search/timeseries?metric=queries", nil)
	var series struct {
		Series []struct {
			Value float64 `json:"value"`
		} `json:"series"`
	}
	if err := json.Unmarshal(seriesBody, &series); err != nil {
		t.Fatalf("decode search timeseries: %v", err)
	}
	total := 0.0
	for _, point := range series.Series {
		total += point.Value
	}
	if total != 1 {
		t.Fatalf("expected one search event in timeseries, got %v", total)
	}
	_, breakdownBody := call(http.MethodGet, "/api/admin/analytics/search/breakdown", nil)
	var breakdown struct {
		Rows []struct {
			Label    string `json:"label"`
			Attempts int    `json:"attempts"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(breakdownBody, &breakdown); err != nil {
		t.Fatalf("decode search breakdown: %v", err)
	}
	if len(breakdown.Rows) != 1 || breakdown.Rows[0].Label != "learner_web" || breakdown.Rows[0].Attempts != 1 {
		t.Fatalf("expected source breakdown for one search, got %+v", breakdown.Rows)
	}
	_, exportBody := call(http.MethodPost, "/api/admin/analytics/search/export", []byte(`{"view":"summary"}`))
	if !strings.Contains(string(exportBody), "clickThroughRate,,,,percent,false") || !strings.Contains(string(exportBody), "avgResultsCount,3") {
		t.Fatalf("expected CSV export to preserve persisted metrics and unsupported click tracking, got %s", exportBody)
	}
}

func TestAdminAdsCampaignRoutesRequireDomainPermissions(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("ads-campaign-rbac-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "Ads Campaign RBAC")
	rawToken := createAdminSession(t, sessStore, actorID)
	campaignName := "audit-campaign-test-" + actorID[:8]
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM monetization.ad_campaign WHERE name = $1`, campaignName)
	})
	call := func(method, path string, payload []byte) *http.Response {
		t.Helper()
		req, err := http.NewRequest(method, srv.URL+path, bytes.NewReader(payload))
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Origin", "http://localhost:3000")
		}
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		return resp
	}

	get := call(http.MethodGet, "/api/admin/ads/campaigns", nil)
	get.Body.Close()
	if get.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 campaign list without ads.campaign.view, got %d", get.StatusCode)
	}
	body, _ := json.Marshal(map[string]any{"name": campaignName, "providerKey": "local", "reason": "RBAC test"})
	createDenied := call(http.MethodPost, "/api/admin/ads/campaigns", body)
	createDenied.Body.Close()
	if createDenied.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 campaign create without ads.campaign.manage, got %d", createDenied.StatusCode)
	}
	grantAdminPermission(t, pool, actorID, "ads.campaign.view")
	getAllowed := call(http.MethodGet, "/api/admin/ads/campaigns", nil)
	getAllowed.Body.Close()
	if getAllowed.StatusCode != http.StatusOK {
		t.Fatalf("expected campaign viewer to receive 200, got %d", getAllowed.StatusCode)
	}
	grantAdminPermission(t, pool, actorID, "ads.campaign.manage")
	createAllowed := call(http.MethodPost, "/api/admin/ads/campaigns", body)
	defer createAllowed.Body.Close()
	if createAllowed.StatusCode != http.StatusCreated {
		payload, _ := io.ReadAll(createAllowed.Body)
		t.Fatalf("expected campaign manager to receive 201, got %d: %s", createAllowed.StatusCode, payload)
	}
}

func TestAdminAdsAuditRequiresPermission(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("ads-audit-no-permission-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "Admin Without Ads Audit Permission")
	rawToken := createAdminSession(t, sessStore, actorID)
	request := func() *http.Response {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/ads/audit", nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		return resp
	}

	denied := request()
	denied.Body.Close()
	if denied.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 without ads audit permission, got %d", denied.StatusCode)
	}

	grantAdminPermission(t, pool, actorID, "ads.audit.view")
	allowed := request()
	defer allowed.Body.Close()
	if allowed.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 with ads.audit.view, got %d", allowed.StatusCode)
	}
}

func TestAdminAuditRequiresViewerAuditOrIAMManage(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	call := func(token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/audit?limit=1&page=1", nil)
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

	anonymous := call("")
	anonymous.Body.Close()
	if anonymous.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected anonymous request to return 401, got %d", anonymous.StatusCode)
	}

	viewerID := newUUID(t)
	seedAdminActor(t, pool, viewerID, fmt.Sprintf("audit-viewer-%s@example.com", viewerID[:8]), "Audit Viewer")
	viewerToken := createAdminSession(t, sessStore, viewerID)
	denied := call(viewerToken)
	denied.Body.Close()
	if denied.StatusCode != http.StatusForbidden {
		t.Fatalf("expected roleless Admin to return 403, got %d", denied.StatusCode)
	}

	grantAdminPermission(t, pool, viewerID, "viewer.audit")
	allowed := call(viewerToken)
	defer allowed.Body.Close()
	if allowed.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(allowed.Body)
		t.Fatalf("expected viewer.audit Admin to receive 200, got %d: %s", allowed.StatusCode, payload)
	}
	var response struct {
		Items    []json.RawMessage `json:"items"`
		Page     int               `json:"page"`
		PageSize int               `json:"pageSize"`
		Total    int               `json:"total"`
	}
	if err := json.NewDecoder(allowed.Body).Decode(&response); err != nil {
		t.Fatalf("decode audit response: %v", err)
	}
	if response.Page != 1 || response.PageSize != 1 || response.Total < 0 || len(response.Items) > 1 {
		t.Fatalf("unexpected audit response contract: %+v", response)
	}

	managerID := newUUID(t)
	seedAdminActor(t, pool, managerID, fmt.Sprintf("audit-manager-%s@example.com", managerID[:8]), "Audit IAM Manager")
	grantIAMManage(t, pool, managerID)
	managerToken := createAdminSession(t, sessStore, managerID)
	managerAllowed := call(managerToken)
	defer managerAllowed.Body.Close()
	if managerAllowed.StatusCode != http.StatusOK {
		payload, _ := io.ReadAll(managerAllowed.Body)
		t.Fatalf("expected iam.manage Admin to receive 200, got %d: %s", managerAllowed.StatusCode, payload)
	}
}

func TestCreateActor_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("create-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Creator Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	body := map[string]string{
		"email":       fmt.Sprintf("new-actor-%s@example.com", newUUID(t)[:8]),
		"displayName": "New Actor",
		"password":    "securepass123",
	}
	cleanupAdminActorByEmail(t, pool, body["email"])
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["id"] == "" {
		t.Error("expected id in response")
	}
	assertAdminAuditEvent(t, pool, adminID, "admin.iam.actor.created", "authz.admin_actor", result["id"])
	var auditAfter map[string]any
	if err := pool.QueryRow(context.Background(), `SELECT after FROM ops.admin_audit_log WHERE actor_id=$1 AND action='admin.iam.actor.created' AND target_id=$2`, adminID, result["id"]).Scan(&auditAfter); err != nil {
		t.Fatalf("read actor-create audit snapshot: %v", err)
	}
	if _, containsPassword := auditAfter["password"]; containsPassword {
		t.Fatal("actor-create audit snapshot must not contain plaintext password")
	}
}

func TestCreateActor_DuplicateEmail(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("dup-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Dup Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	newEmail := fmt.Sprintf("dup-target-%s@example.com", newUUID(t)[:8])
	cleanupAdminActorByEmail(t, pool, newEmail)
	body := map[string]string{
		"email":       newEmail,
		"displayName": "First Actor",
		"password":    "securepass123",
	}
	b, _ := json.Marshal(body)

	// First creation should succeed.
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("first creation expected 201, got %d", resp.StatusCode)
	}

	// Second creation with same email should conflict.
	req2, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req2.Header.Set("Content-Type", "application/json")
	req2.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req2.Header.Set("X-CSRF-Token", "test-csrf")
	req2.Header.Set("Origin", "http://localhost:3000")
	resp2, err := srv.Client().Do(req2)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp2.StatusCode)
	}
}

func TestCreateActor_WeakPassword(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("weak-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Weak Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	body := map[string]string{
		"email":       fmt.Sprintf("weak-%s@example.com", newUUID(t)[:8]),
		"displayName": "Weak Actor",
		"password":    "short",
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestUpdateActorStatus_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("status-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Status Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Target Actor")

	body := map[string]string{"status": "disabled"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/admin/actors/%s/status", srv.URL, targetID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["status"] != "disabled" {
		t.Errorf("expected status=disabled, got %v", result["status"])
	}
	assertAdminAuditEvent(t, pool, adminID, "admin.iam.actor.status_changed", "authz.admin_actor", targetID)
}

func TestUpdateActorStatus_CannotDisableSelf(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("self-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Self Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	body := map[string]string{"status": "disabled"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/admin/actors/%s/status", srv.URL, adminID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestAssignRole_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("assign-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Assign Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("assign-target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Assign Target")

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "test-role", "Test Role")

	body := map[string]string{"roleId": roleID}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/admin/actors/%s/roles", srv.URL, targetID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["actorId"] != targetID {
		t.Errorf("expected actorId=%s, got %v", targetID, result["actorId"])
	}
	if result["roleId"] != roleID {
		t.Errorf("expected roleId=%s, got %v", roleID, result["roleId"])
	}
	assertAdminAuditEvent(t, pool, adminID, "admin.iam.actor.role_assigned", "authz.admin_actor_role", targetID)
}

func TestAssignRole_Idempotent(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("idem-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Idem Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("idem-target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Idem Target")

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "idem-role", "Idem Role")

	body := map[string]string{"roleId": roleID}
	b, _ := json.Marshal(body)

	// First assignment.
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/admin/actors/%s/roles", srv.URL, targetID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("first assignment expected 200, got %d", resp.StatusCode)
	}

	// Second assignment (idempotent).
	req2, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/admin/actors/%s/roles", srv.URL, targetID), bytes.NewReader(b))
	req2.Header.Set("Content-Type", "application/json")
	req2.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req2.Header.Set("X-CSRF-Token", "test-csrf")
	req2.Header.Set("Origin", "http://localhost:3000")
	resp2, err := srv.Client().Do(req2)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusOK {
		t.Errorf("idempotent assignment expected 200, got %d", resp2.StatusCode)
	}
}

func TestRemoveRole_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("remove-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Remove Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("remove-target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Remove Target")

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "remove-role", "Remove Role")

	// Assign first.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := pool.Exec(ctx,
		`INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2)`,
		targetID, roleID)
	if err != nil {
		t.Fatalf("pre-assign role: %v", err)
	}

	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/admin/actors/%s/roles/%s", srv.URL, targetID, roleID), nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", resp.StatusCode)
	}
	assertAdminAuditEvent(t, pool, adminID, "admin.iam.actor.role_revoked", "authz.admin_actor_role", targetID)
}

func TestListRoles_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("roles-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Roles Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "list-test-role", "List Test Role")

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/roles", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var roles []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&roles); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	found := false
	for _, r := range roles {
		if r["id"] == roleID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("seeded role %s not found in list", roleID)
	}
}

func TestListPermissions_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("perms-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Perms Admin")
	grantIAMManage(t, pool, adminID)
	rawToken := createAdminSession(t, sessStore, adminID)

	permID := newUUID(t)
	seedAdminPermission(t, pool, permID, "users:read")

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/permissions", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var perms []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&perms); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	found := false
	for _, p := range perms {
		if p["id"] == permID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("seeded permission %s not found in list", permID)
	}
}
