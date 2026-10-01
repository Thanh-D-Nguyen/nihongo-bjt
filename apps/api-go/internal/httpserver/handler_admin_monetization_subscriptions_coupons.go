package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A5.3: Admin Monetization — Subscriptions + Coupons Sub-Domain (5 routes) ─
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/monetization/monetization-admin-console.service.ts
// subscriptions list, subscription patch, coupons list, coupon create, coupon patch.

// adminMonetizationSubscriptionsListHandler implements GET /api/admin/monetization/subscriptions.
func adminMonetizationSubscriptionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("us.status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(up.email ILIKE $%[1]d OR up.display_name ILIKE $%[1]d OR p.slug ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := `SELECT COUNT(*) FROM monetization.user_subscription us
			JOIN profile.user_profile up ON up.id = us.user_id
			JOIN monetization.plan p ON p.id = us.plan_id ` + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count subscriptions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT us.id, us.user_id, up.email, up.display_name,
				us.plan_id, p.slug as plan_slug, p.name_key as plan_name_key,
				us.status, us.current_period_start, us.current_period_end,
				us.cancel_at_period_end, us.created_at, us.updated_at
			FROM monetization.user_subscription us
			JOIN profile.user_profile up ON up.id = us.user_id
			JOIN monetization.plan p ON p.id = us.plan_id
			%s
			ORDER BY us.created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list subscriptions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Subscription struct {
			ID                 string  `json:"id"`
			UserID             string  `json:"userId"`
			UserEmail          *string `json:"userEmail,omitempty"`
			UserDisplayName    *string `json:"userDisplayName,omitempty"`
			PlanID             string  `json:"planId"`
			PlanSlug           string  `json:"planSlug"`
			PlanNameKey        string  `json:"planNameKey"`
			Status             string  `json:"status"`
			CurrentPeriodStart *string `json:"currentPeriodStart,omitempty"`
			CurrentPeriodEnd   *string `json:"currentPeriodEnd,omitempty"`
			CancelAtPeriodEnd  bool    `json:"cancelAtPeriodEnd"`
			CreatedAt          string  `json:"createdAt"`
			UpdatedAt          string  `json:"updatedAt"`
		}
		var items []Subscription
		for rows.Next() {
			var s Subscription
			var createdAt, updatedAt time.Time
			var periodStart, periodEnd *time.Time
			if err := rows.Scan(&s.ID, &s.UserID, &s.UserEmail, &s.UserDisplayName,
				&s.PlanID, &s.PlanSlug, &s.PlanNameKey, &s.Status,
				&periodStart, &periodEnd, &s.CancelAtPeriodEnd,
				&createdAt, &updatedAt); err == nil {
				s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				s.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if periodStart != nil {
					ps := periodStart.UTC().Format(time.RFC3339)
					s.CurrentPeriodStart = &ps
				}
				if periodEnd != nil {
					pe := periodEnd.UTC().Format(time.RFC3339)
					s.CurrentPeriodEnd = &pe
				}
				items = append(items, s)
			}
		}
		if items == nil {
			items = []Subscription{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminMonetizationSubscriptionsPatchHandler implements PATCH /api/admin/monetization/subscriptions/{id}.
func adminMonetizationSubscriptionsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "subscriptions", 1)
		if id == "" {
			writeJSONError(w, "subscription id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Status            *string `json:"status,omitempty"`
			CancelAtPeriodEnd *bool   `json:"cancelAtPeriodEnd,omitempty"`
			Reason            string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.user_subscription WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "subscription not found", http.StatusNotFound)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Status != nil {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
			argIdx++
		}
		if req.CancelAtPeriodEnd != nil {
			setClauses = append(setClauses, "cancel_at_period_end = $"+itoa(argIdx))
			args = append(args, *req.CancelAtPeriodEnd)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.user_subscription SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch subscription", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.monetization.subscription.updated', $1, $2, 'monetization.user_subscription', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminMonetizationCouponsListHandler implements GET /api/admin/monetization/coupons.
func adminMonetizationCouponsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM monetization.promotion_coupon " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count coupons", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, code, discount_type, discount_value, status,
				max_redemptions, redemption_count, starts_at, ends_at,
				allowed_plan_slugs, created_at, updated_at
			FROM monetization.promotion_coupon %s
			ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list coupons", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Coupon struct {
			ID               string          `json:"id"`
			Code             string          `json:"code"`
			DiscountType     string          `json:"discountType"`
			DiscountValue    float64         `json:"discountValue"`
			Status           string          `json:"status"`
			MaxRedemptions   *int            `json:"maxRedemptions,omitempty"`
			RedemptionCount  int             `json:"redemptionCount"`
			StartsAt         *string         `json:"startsAt,omitempty"`
			EndsAt           *string         `json:"endsAt,omitempty"`
			AllowedPlanSlugs json.RawMessage `json:"allowedPlanSlugs,omitempty"`
			CreatedAt        string          `json:"createdAt"`
			UpdatedAt        string          `json:"updatedAt"`
		}
		var items []Coupon
		for rows.Next() {
			var c Coupon
			var createdAt, updatedAt time.Time
			var startsAt, endsAt *time.Time
			var allowedSlugsBytes []byte
			if err := rows.Scan(&c.ID, &c.Code, &c.DiscountType, &c.DiscountValue, &c.Status,
				&c.MaxRedemptions, &c.RedemptionCount, &startsAt, &endsAt,
				&allowedSlugsBytes, &createdAt, &updatedAt); err == nil {
				c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if startsAt != nil {
					s := startsAt.UTC().Format(time.RFC3339)
					c.StartsAt = &s
				}
				if endsAt != nil {
					s := endsAt.UTC().Format(time.RFC3339)
					c.EndsAt = &s
				}
				if allowedSlugsBytes != nil {
					c.AllowedPlanSlugs = allowedSlugsBytes
				}
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Coupon{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminMonetizationCouponsCreateHandler implements POST /api/admin/monetization/coupons.
func adminMonetizationCouponsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Code             string          `json:"code"`
			DiscountType     string          `json:"discountType"`
			DiscountValue    float64         `json:"discountValue"`
			Status           string          `json:"status"`
			MaxRedemptions   *int            `json:"maxRedemptions,omitempty"`
			StartsAt         *string         `json:"startsAt,omitempty"`
			EndsAt           *string         `json:"endsAt,omitempty"`
			AllowedPlanSlugs json.RawMessage `json:"allowedPlanSlugs,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Code == "" || req.DiscountType == "" {
			writeJSONError(w, "code and discountType are required", http.StatusBadRequest)
			return
		}
		if req.Status == "" {
			req.Status = "active"
		}
		allowedSlugsJSON := req.AllowedPlanSlugs
		if allowedSlugsJSON == nil {
			allowedSlugsJSON = json.RawMessage("[]")
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.promotion_coupon (code, discount_type, discount_value, status,
				max_redemptions, redemption_count, starts_at, ends_at, allowed_plan_slugs,
				created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, NOW(), NOW()) RETURNING id`,
			req.Code, req.DiscountType, req.DiscountValue, req.Status,
			req.MaxRedemptions, req.StartsAt, req.EndsAt, allowedSlugsJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create coupon", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"code": req.Code, "discountType": req.DiscountType, "status": req.Status})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.coupon.created', $1, $2, 'monetization.promotion_coupon', $3, $4, NOW())`,
			identity.ActorID, createdID, "coupon created via admin console", afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "code": req.Code, "status": req.Status})
	}
}

// adminMonetizationCouponsPatchHandler implements PATCH /api/admin/monetization/coupons/{id}.
func adminMonetizationCouponsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "coupons", 1)
		if id == "" {
			writeJSONError(w, "coupon id required", http.StatusBadRequest)
			return
		}
		var req struct {
			DiscountType     *string         `json:"discountType,omitempty"`
			DiscountValue    *float64        `json:"discountValue,omitempty"`
			Status           *string         `json:"status,omitempty"`
			MaxRedemptions   *int            `json:"maxRedemptions,omitempty"`
			StartsAt         *string         `json:"startsAt,omitempty"`
			EndsAt           *string         `json:"endsAt,omitempty"`
			AllowedPlanSlugs json.RawMessage `json:"allowedPlanSlugs,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.promotion_coupon WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "coupon not found", http.StatusNotFound)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.DiscountType != nil {
			setClauses = append(setClauses, "discount_type = $"+itoa(argIdx))
			args = append(args, *req.DiscountType)
			argIdx++
		}
		if req.DiscountValue != nil {
			setClauses = append(setClauses, "discount_value = $"+itoa(argIdx))
			args = append(args, *req.DiscountValue)
			argIdx++
		}
		if req.Status != nil {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
			argIdx++
		}
		if req.MaxRedemptions != nil {
			setClauses = append(setClauses, "max_redemptions = $"+itoa(argIdx))
			args = append(args, *req.MaxRedemptions)
			argIdx++
		}
		if req.StartsAt != nil {
			setClauses = append(setClauses, "starts_at = $"+itoa(argIdx))
			args = append(args, *req.StartsAt)
			argIdx++
		}
		if req.EndsAt != nil {
			setClauses = append(setClauses, "ends_at = $"+itoa(argIdx))
			args = append(args, *req.EndsAt)
			argIdx++
		}
		if req.AllowedPlanSlugs != nil {
			setClauses = append(setClauses, "allowed_plan_slugs = $"+itoa(argIdx))
			args = append(args, req.AllowedPlanSlugs)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.promotion_coupon SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch coupon", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.monetization.coupon.updated', $1, $2, 'monetization.promotion_coupon', $3, $4, $5, NOW())`,
			identity.ActorID, id, "coupon updated via admin console", afterJSON, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// Ensure fmt is used.
var _ = fmt.Sprintf