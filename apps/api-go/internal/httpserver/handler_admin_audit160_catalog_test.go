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

func TestAdminMonetizationCatalogAUDIT160(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit160-catalog-%s@example.test", actorID[:8]), "AUDIT-160 Catalog Admin")
	token := createAdminSession(t, sessions, actorID)
	var couponID, entitlementID, planID, userID, overrideID string
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		if overrideID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.quota_user_override WHERE id=$1`, overrideID)
		}
		if planID != "" && entitlementID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.plan_entitlement WHERE plan_id=$1 AND entitlement_id=$2`, planID, entitlementID)
		}
		if entitlementID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.entitlement_definition WHERE id=$1`, entitlementID)
		}
		if couponID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.promotion_coupon WHERE id=$1`, couponID)
		}
		if planID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM monetization.plan WHERE id=$1`, planID)
		}
	})
	call := func(method, path, body string, authenticated bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	decode := func(res *httptest.ResponseRecorder, out any) {
		t.Helper()
		if err := json.Unmarshal(res.Body.Bytes(), out); err != nil {
			t.Fatalf("decode response (%d): %v; body=%s", res.Code, err, res.Body.String())
		}
	}
	routes := []struct{ method, path, body string }{
		{http.MethodGet, "/api/admin/monetization/coupons", ""},
		{http.MethodPost, "/api/admin/monetization/coupons", `{"code":"AUDIT160","discountType":"percent","discountValue":15}`},
		{http.MethodPatch, "/api/admin/monetization/coupons/not-a-uuid", `{"status":"paused"}`},
		{http.MethodGet, "/api/admin/monetization/entitlements", ""},
		{http.MethodPost, "/api/admin/monetization/entitlements", `{"key":"audit160.catalog"}`},
		{http.MethodPost, "/api/admin/monetization/plans/not-a-uuid/entitlements", `{"entitlementId":"00000000-0000-0000-0000-000000000000"}`},
		{http.MethodDelete, "/api/admin/monetization/plans/not-a-uuid/entitlements/also-bad", ""},
		{http.MethodGet, "/api/admin/monetization/quota-overrides", ""},
		{http.MethodPost, "/api/admin/monetization/quota-overrides", `{"userId":"00000000-0000-0000-0000-000000000000","quotaKey":"audit160.test","limitValue":1,"reason":"test"}`},
	}
	for _, route := range routes {
		t.Run("anonymous "+route.method+" "+route.path, func(t *testing.T) {
			if res := call(route.method, route.path, route.body, false); res.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", res.Code, res.Body.String())
			}
		})
		t.Run("roleless admin "+route.method+" "+route.path, func(t *testing.T) {
			if res := call(route.method, route.path, route.body, true); res.Code != http.StatusForbidden {
				t.Fatalf("roleless admin status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}

	grantAdminPermission(t, db, actorID, "admin.monetization.read")
	grantAdminPermission(t, db, actorID, "admin.monetization.write")
	grantAdminPermission(t, db, actorID, "billing.quota.override")
	userID = newUUID(t)
	seedActiveUser(t, db, userID, "AUDIT-160 quota user", fmt.Sprintf("audit160-user-%s@example.test", actorID[:8]), "audit160-subject-"+actorID)
	planID = newUUID(t)
	seedPricingPlan(t, db, planID, "audit160-"+planID[:8])

	couponCode := "AUDIT160-" + strings.ReplaceAll(actorID, "-", "")[:12]
	couponRes := call(http.MethodPost, "/api/admin/monetization/coupons", fmt.Sprintf(`{"code":%q,"discountType":"percent","discountValue":15,"allowedPlanSlugs":[]}`, couponCode), true)
	if couponRes.Code != http.StatusCreated {
		t.Fatalf("create coupon status=%d body=%s", couponRes.Code, couponRes.Body.String())
	}
	var coupon struct{ ID, Code, Status string }
	decode(couponRes, &coupon)
	couponID = coupon.ID
	if couponID == "" || coupon.Code != couponCode || coupon.Status != "active" {
		t.Fatalf("coupon response=%+v", coupon)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.coupon.created", "monetization.promotion_coupon", couponID)

	patch := call(http.MethodPatch, "/api/admin/monetization/coupons/"+couponID, `{"status":"paused"}`, true)
	if patch.Code != http.StatusOK {
		t.Fatalf("patch coupon status=%d body=%s", patch.Code, patch.Body.String())
	}
	var persistedCouponStatus string
	if err := db.QueryRow(ctx, `SELECT status FROM monetization.promotion_coupon WHERE id=$1`, couponID).Scan(&persistedCouponStatus); err != nil || persistedCouponStatus != "paused" {
		t.Fatalf("coupon patch persistence status=%q err=%v", persistedCouponStatus, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.coupon.updated", "monetization.promotion_coupon", couponID)
	listedCoupons := call(http.MethodGet, "/api/admin/monetization/coupons?status=paused&page=1&pageSize=20", "", true)
	if listedCoupons.Code != http.StatusOK || !strings.Contains(listedCoupons.Body.String(), couponID) {
		t.Fatalf("coupon list status=%d body=%s", listedCoupons.Code, listedCoupons.Body.String())
	}

	entitlementKey := "audit160.catalog." + strings.ReplaceAll(actorID, "-", "")[:12]
	entRes := call(http.MethodPost, "/api/admin/monetization/entitlements", fmt.Sprintf(`{"key":%q,"category":"audit"}`, entitlementKey), true)
	if entRes.Code != http.StatusCreated {
		t.Fatalf("create entitlement status=%d body=%s", entRes.Code, entRes.Body.String())
	}
	var createdEntitlement struct{ ID, Key string }
	decode(entRes, &createdEntitlement)
	entitlementID = createdEntitlement.ID
	if entitlementID == "" || createdEntitlement.Key != entitlementKey {
		t.Fatalf("entitlement response=%+v", createdEntitlement)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.entitlement.created", "monetization.entitlement_definition", entitlementID)
	link := call(http.MethodPost, "/api/admin/monetization/plans/"+planID+"/entitlements", fmt.Sprintf(`{"entitlementId":%q}`, entitlementID), true)
	if link.Code != http.StatusOK {
		t.Fatalf("link entitlement status=%d body=%s", link.Code, link.Body.String())
	}
	var linkCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM monetization.plan_entitlement WHERE plan_id=$1 AND entitlement_id=$2`, planID, entitlementID).Scan(&linkCount); err != nil || linkCount != 1 {
		t.Fatalf("plan entitlement link count=%d err=%v", linkCount, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.plan_entitlement.linked", "monetization.plan_entitlement", planID)
	listedEntitlements := call(http.MethodGet, "/api/admin/monetization/entitlements", "", true)
	if listedEntitlements.Code != http.StatusOK || !strings.Contains(listedEntitlements.Body.String(), entitlementKey) {
		t.Fatalf("entitlement list status=%d body=%s", listedEntitlements.Code, listedEntitlements.Body.String())
	}
	unlink := call(http.MethodDelete, "/api/admin/monetization/plans/"+planID+"/entitlements/"+entitlementID, "", true)
	if unlink.Code != http.StatusOK {
		t.Fatalf("unlink entitlement status=%d body=%s", unlink.Code, unlink.Body.String())
	}
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM monetization.plan_entitlement WHERE plan_id=$1 AND entitlement_id=$2`, planID, entitlementID).Scan(&linkCount); err != nil || linkCount != 0 {
		t.Fatalf("plan entitlement unlink count=%d err=%v", linkCount, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.plan_entitlement.unlinked", "monetization.plan_entitlement", planID)

	overrideRes := call(http.MethodPost, "/api/admin/monetization/quota-overrides", fmt.Sprintf(`{"userId":%q,"quotaKey":"audit160.test","limitValue":12,"reason":"AUDIT-160 fixture"}`, userID), true)
	if overrideRes.Code != http.StatusCreated {
		t.Fatalf("create quota override status=%d body=%s", overrideRes.Code, overrideRes.Body.String())
	}
	var createdOverride struct{ ID, UserID, QuotaKey string }
	decode(overrideRes, &createdOverride)
	overrideID = createdOverride.ID
	if overrideID == "" || createdOverride.UserID != userID || createdOverride.QuotaKey != "audit160.test" {
		t.Fatalf("quota override response=%+v", createdOverride)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.monetization.quota_override.created", "monetization.quota_user_override", overrideID)
	listedOverrides := call(http.MethodGet, "/api/admin/monetization/quota-overrides", "", true)
	if listedOverrides.Code != http.StatusOK || !strings.Contains(listedOverrides.Body.String(), overrideID) {
		t.Fatalf("quota override list status=%d body=%s", listedOverrides.Code, listedOverrides.Body.String())
	}

	for _, invalid := range []struct{ method, path, body string }{
		{http.MethodPost, "/api/admin/monetization/coupons", `{"code":"bad","discountType":"percent","discountValue":1.5}`},
		{http.MethodPatch, "/api/admin/monetization/coupons/not-a-uuid", `{"status":"paused"}`},
		{http.MethodPatch, "/api/admin/monetization/coupons/" + couponID, `{"discountValue":1.5}`},
		{http.MethodPost, "/api/admin/monetization/entitlements", `{"key":""}`},
		{http.MethodPost, "/api/admin/monetization/plans/not-a-uuid/entitlements", fmt.Sprintf(`{"entitlementId":%q}`, entitlementID)},
		{http.MethodDelete, "/api/admin/monetization/plans/" + planID + "/entitlements/not-a-uuid", ""},
		{http.MethodPost, "/api/admin/monetization/quota-overrides", fmt.Sprintf(`{"userId":%q,"quotaKey":"audit160.bad","limitValue":1,"reason":"fixture"}`, "not-a-uuid")},
	} {
		res := call(invalid.method, invalid.path, invalid.body, true)
		if res.Code != http.StatusBadRequest {
			t.Errorf("invalid %s %s status=%d body=%s; want 400", invalid.method, invalid.path, res.Code, res.Body.String())
		}
	}

	for _, route := range routes {
		if route.method == http.MethodGet {
			continue
		}
		t.Run("missing origin rejected "+route.method+" "+route.path, func(t *testing.T) {
			req := httptest.NewRequest(route.method, route.path, strings.NewReader(route.body))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			req.Header.Set("Content-Type", "application/json")
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("missing Origin status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}
}
