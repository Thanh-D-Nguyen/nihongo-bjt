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

func TestAdminMonetizationWave3Routes(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit-wave3-%s@example.test", actorID[:8]), "Wave 3 Admin")
	token := createAdminSession(t, sessions, actorID)
	call := func(method, path, body string, auth, csrf bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if auth {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if method != http.MethodGet && csrf {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	planID, userID, policyID, overrideID, subscriptionID := newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedPricingPlan(t, db, planID, "wave3-"+planID[:8])
	seedActiveUser(t, db, userID, "Wave Three Learner", "wave3-"+userID[:8]+"@example.test", "wave3-"+userID[:8])
	if _, err := db.Exec(ctx, `INSERT INTO monetization.quota_policy (id,key,window_code) VALUES ($1,$2,'day')`, policyID, "wave3."+policyID[:8]); err != nil {
		t.Fatalf("seed policy: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription (id,user_id,plan_id,status,updated_at) VALUES ($1,$2,$3,'active',now())`, subscriptionID, userID, planID); err != nil {
		t.Fatalf("seed subscription: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.quota_user_override (id,user_id,quota_key,limit_value,reason) VALUES ($1,$2,$3,10,'fixture')`, overrideID, userID, "wave3."+policyID[:8]); err != nil {
		t.Fatalf("seed override: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.user_subscription WHERE id=$1`, subscriptionID)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.quota_user_override WHERE id=$1`, overrideID)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.quota_policy WHERE id=$1`, policyID)
	})

	routes := []struct{ method, path, body string }{
		{http.MethodDelete, "/api/admin/monetization/quota-overrides/" + overrideID, ""},
		{http.MethodGet, "/api/admin/monetization/quotas", ""},
		{http.MethodPost, "/api/admin/monetization/quotas/plan-links", fmt.Sprintf(`{"planId":%q,"quotaPolicyId":%q,"limitValue":25,"reason":"wave3 test"}`, planID, policyID)},
		{http.MethodPost, "/api/admin/monetization/quotas/policies", fmt.Sprintf(`{"key":%q,"windowCode":"day","reason":"wave3 test"}`, "wave3.roleless."+actorID[:8])},
		{http.MethodPatch, "/api/admin/monetization/quotas/policies/" + policyID, `{"description":"updated","reason":"wave3 test"}`},
		{http.MethodGet, "/api/admin/monetization/subscriptions", ""},
		{http.MethodPatch, "/api/admin/monetization/subscriptions/" + subscriptionID, `{"status":"canceled","reason":"wave3 test"}`},
	}
	for _, route := range routes {
		t.Run("anonymous denied "+route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, route.body, false, true).Code; got != http.StatusUnauthorized {
				t.Fatalf("status=%d, want 401", got)
			}
		})
		t.Run("roleless admin denied "+route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, route.body, true, true).Code; got != http.StatusForbidden {
				t.Fatalf("status=%d, want 403", got)
			}
		})
		if route.method != http.MethodGet {
			t.Run("CSRF required "+route.method+" "+route.path, func(t *testing.T) {
				if got := call(route.method, route.path, route.body, true, false).Code; got != http.StatusForbidden {
					t.Fatalf("status=%d, want 403", got)
				}
			})
		}
	}
	if got := call(http.MethodGet, "/api/admin/monetization/summary", "", true, true).Code; got != http.StatusForbidden {
		t.Fatalf("roleless summary status=%d, want 403", got)
	}
	// The pre-fix handlers could mutate fixtures before returning success to roleless admins.
	_, _ = db.Exec(ctx, `DELETE FROM monetization.plan_quota WHERE plan_id=$1 AND quota_policy_id=$2`, planID, policyID)
	_, _ = db.Exec(ctx, `DELETE FROM monetization.quota_policy WHERE key=$1`, "wave3.roleless."+actorID[:8])
	_, _ = db.Exec(ctx, `UPDATE monetization.quota_policy SET description=NULL WHERE id=$1`, policyID)
	_, _ = db.Exec(ctx, `UPDATE monetization.user_subscription SET status='active' WHERE id=$1`, subscriptionID)
	_, _ = db.Exec(ctx, `INSERT INTO monetization.quota_user_override (id,user_id,quota_key,limit_value,reason) VALUES ($1,$2,$3,10,'fixture') ON CONFLICT (id) DO NOTHING`, overrideID, userID, "wave3."+policyID[:8])
	grantAdminPermission(t, db, actorID, "admin.monetization.read")
	grantAdminPermission(t, db, actorID, "admin.monetization.write")

	created := call(http.MethodPost, "/api/admin/monetization/quotas/policies", fmt.Sprintf(`{"key":%q,"windowCode":"day","reason":"wave3 test"}`, "wave3.created."+actorID[:8]), true, true)
	if created.Code != http.StatusCreated {
		t.Fatalf("create policy status=%d body=%s", created.Code, created.Body.String())
	}
	var createdBody struct{ ID, Key string }
	if err := json.Unmarshal(created.Body.Bytes(), &createdBody); err != nil || createdBody.ID == "" {
		t.Fatalf("decode created policy: body=%s err=%v", created.Body.String(), err)
	}
	policyCreatedID := createdBody.ID
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM monetization.quota_policy WHERE id=$1`, policyCreatedID) })
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.quota_policy.created", "monetization.quota_policy", policyCreatedID)

	link := call(http.MethodPost, "/api/admin/monetization/quotas/plan-links", fmt.Sprintf(`{"planId":%q,"quotaPolicyId":%q,"limitValue":25,"reason":"wave3 test"}`, planID, policyID), true, true)
	if link.Code != http.StatusCreated {
		t.Fatalf("create plan quota link status=%d body=%s", link.Code, link.Body.String())
	}
	var linkedID string
	if err := db.QueryRow(ctx, `SELECT id FROM monetization.plan_quota WHERE plan_id=$1 AND quota_policy_id=$2`, planID, policyID).Scan(&linkedID); err != nil {
		t.Fatalf("plan quota link was not persisted: %v", err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.plan_quota.created", "monetization.plan_quota", linkedID)
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM monetization.plan_quota WHERE id=$1`, linkedID) })

	patchPolicy := call(http.MethodPatch, "/api/admin/monetization/quotas/policies/"+policyID, `{"description":"updated","reason":"wave3 test"}`, true, true)
	if patchPolicy.Code != http.StatusOK {
		t.Fatalf("patch policy status=%d body=%s", patchPolicy.Code, patchPolicy.Body.String())
	}
	var description string
	if err := db.QueryRow(ctx, `SELECT description FROM monetization.quota_policy WHERE id=$1`, policyID).Scan(&description); err != nil || description != "updated" {
		t.Fatalf("policy patch persistence description=%q err=%v", description, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.quota_policy.updated", "monetization.quota_policy", policyID)

	patchSub := call(http.MethodPatch, "/api/admin/monetization/subscriptions/"+subscriptionID, `{"status":"canceled","reason":"wave3 test"}`, true, true)
	if patchSub.Code != http.StatusOK {
		t.Fatalf("patch subscription status=%d body=%s", patchSub.Code, patchSub.Body.String())
	}
	var status string
	if err := db.QueryRow(ctx, `SELECT status FROM monetization.user_subscription WHERE id=$1`, subscriptionID).Scan(&status); err != nil || status != "canceled" {
		t.Fatalf("subscription patch persistence status=%q err=%v", status, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.subscription.updated", "monetization.user_subscription", subscriptionID)

	deleted := call(http.MethodDelete, "/api/admin/monetization/quota-overrides/"+overrideID+"?reason=wave3+cleanup", "", true, true)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete override status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	var remaining int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM monetization.quota_user_override WHERE id=$1`, overrideID).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("override remains after delete: count=%d err=%v", remaining, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.quota_override.deleted", "monetization.quota_user_override", overrideID)

	quotaList := call(http.MethodGet, "/api/admin/monetization/quotas", "", true, true)
	var quotaBody struct {
		Policies   []struct{ ID, Key string }                   `json:"policies"`
		PlanQuotas []struct{ ID, PlanID, QuotaPolicyID string } `json:"planQuotas"`
	}
	if quotaList.Code != http.StatusOK || json.Unmarshal(quotaList.Body.Bytes(), &quotaBody) != nil || len(quotaBody.Policies) == 0 || len(quotaBody.PlanQuotas) == 0 {
		t.Fatalf("quota list contract status=%d body=%s", quotaList.Code, quotaList.Body.String())
	}
	subscriptionList := call(http.MethodGet, "/api/admin/monetization/subscriptions?limit=20&offset=0", "", true, true)
	var subscriptionBody struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if subscriptionList.Code != http.StatusOK || json.Unmarshal(subscriptionList.Body.Bytes(), &subscriptionBody) != nil || subscriptionBody.Total < 1 || len(subscriptionBody.Items) == 0 || subscriptionBody.Items[0].ID != subscriptionID {
		t.Fatalf("subscription list contract status=%d body=%s", subscriptionList.Code, subscriptionList.Body.String())
	}
	summary := call(http.MethodGet, "/api/admin/monetization/summary", "", true, true)
	var summaryBody map[string]json.RawMessage
	if summary.Code != http.StatusOK || json.Unmarshal(summary.Body.Bytes(), &summaryBody) != nil || len(summaryBody["kpis"]) == 0 || len(summaryBody["charts"]) == 0 {
		t.Fatalf("summary contract status=%d body=%s", summary.Code, summary.Body.String())
	}

	for _, tc := range []struct {
		method, path, body string
		want               int
	}{
		{http.MethodDelete, "/api/admin/monetization/quota-overrides/not-a-uuid", "", http.StatusBadRequest},
		{http.MethodDelete, "/api/admin/monetization/quota-overrides/" + newUUID(t), "", http.StatusNotFound},
		{http.MethodPatch, "/api/admin/monetization/quotas/policies/not-a-uuid", `{"description":"x"}`, http.StatusBadRequest},
		{http.MethodPatch, "/api/admin/monetization/quotas/policies/" + newUUID(t), `{"description":"x"}`, http.StatusNotFound},
		{http.MethodPost, "/api/admin/monetization/quotas/plan-links", `{"planId":"bad","quotaPolicyId":"bad","limitValue":-1}`, http.StatusBadRequest},
		{http.MethodPost, "/api/admin/monetization/quotas/plan-links", fmt.Sprintf(`{"planId":%q,"quotaPolicyId":%q,"limitValue":1}`, newUUID(t), newUUID(t)), http.StatusNotFound},
		{http.MethodPatch, "/api/admin/monetization/subscriptions/not-a-uuid", `{"status":"canceled","reason":"wave3 test"}`, http.StatusBadRequest},
		{http.MethodPatch, "/api/admin/monetization/subscriptions/" + newUUID(t), `{"status":"canceled","reason":"wave3 test"}`, http.StatusNotFound},
	} {
		res := call(tc.method, tc.path, tc.body, true, true)
		if res.Code != tc.want {
			t.Errorf("%s %s status=%d want=%d body=%s", tc.method, tc.path, res.Code, tc.want, res.Body.String())
		}
	}
}
