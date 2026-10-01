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

// ── P1-A7: Admin Core — IAM + Users + Content + Support + Audit + I18n + ReadingAssist (38 routes) ──
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/admin/admin.controller.ts and i18n-admin.controller.ts.

// ── Session / Me / Module Contracts ─────────────────────────────────────────

// adminMeHandler implements GET /api/admin/me.
func adminMeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		type AdminDetail struct {
			ActorID     string   `json:"actorId"`
			DisplayName *string  `json:"displayName,omitempty"`
			Email       *string  `json:"email,omitempty"`
			Permissions []string `json:"permissions"`
		}
		var ad AdminDetail
		ad.ActorID = identity.ActorID
		ad.Permissions = []string{}
		db.QueryRow(r.Context(),
			"SELECT display_name, email FROM authz.admin_actor WHERE id = $1",
			identity.ActorID).Scan(&ad.DisplayName, &ad.Email)
		writeJSON(w, http.StatusOK, ad)
	}
}

// adminModuleContractsHandler implements GET /api/admin/module-contracts.
func adminModuleContractsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(),
			"SELECT module_key, status, implemented_routes, total_routes, last_updated FROM admin.module_contract ORDER BY module_key ASC")
		if err != nil {
			logger.Error("list module contracts", "error", err)
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		defer rows.Close()
		type MC struct {
			ModuleKey         string  `json:"moduleKey"`
			Status            string  `json:"status"`
			ImplementedRoutes int     `json:"implementedRoutes"`
			TotalRoutes       int     `json:"totalRoutes"`
			LastUpdated       *string `json:"lastUpdated,omitempty"`
		}
		var items []MC
		for rows.Next() {
			var mc MC
			var lu *time.Time
			if rows.Scan(&mc.ModuleKey, &mc.Status, &mc.ImplementedRoutes, &mc.TotalRoutes, &lu) == nil {
				if lu != nil {
					s := lu.UTC().Format(time.RFC3339)
					mc.LastUpdated = &s
				}
				items = append(items, mc)
			}
		}
		if items == nil {
			items = []MC{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// ── IAM: Roles ──────────────────────────────────────────────────────────────

// adminIamRolesListHandler implements GET /api/admin/iam/roles.
func adminIamRolesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(),
			"SELECT code, name, description, is_system, created_at FROM authz.role ORDER BY code ASC")
		if err != nil {
			logger.Error("list iam roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Role struct {
			Code        string  `json:"code"`
			Name        string  `json:"name"`
			Description *string `json:"description,omitempty"`
			IsSystem    bool    `json:"isSystem"`
			CreatedAt   string  `json:"createdAt"`
		}
		var items []Role
		for rows.Next() {
			var rl Role
			var ca time.Time
			if rows.Scan(&rl.Code, &rl.Name, &rl.Description, &rl.IsSystem, &ca) == nil {
				rl.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, rl)
			}
		}
		if items == nil {
			items = []Role{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminIamRoleDetailHandler implements GET /api/admin/iam/roles/{code}.
func adminIamRoleDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := extractPathParam(r.URL.Path, "roles", 1)
		if code == "" {
			writeJSONError(w, "role code required", http.StatusBadRequest)
			return
		}
		type RoleDetail struct {
			Code        string   `json:"code"`
			Name        string   `json:"name"`
			Description *string  `json:"description,omitempty"`
			IsSystem    bool     `json:"isSystem"`
			Permissions []string `json:"permissions"`
			AdminsCount int      `json:"adminsCount"`
		}
		var rd RoleDetail
		err := db.QueryRow(r.Context(),
			"SELECT code, name, description, is_system FROM authz.role WHERE code = $1", code).
			Scan(&rd.Code, &rd.Name, &rd.Description, &rd.IsSystem)
		if err != nil {
			writeJSONError(w, "role not found", http.StatusNotFound)
			return
		}
		permRows, _ := db.Query(r.Context(),
			"SELECT permission_code FROM authz.role_permission WHERE role_code = $1 ORDER BY permission_code", code)
		if permRows != nil {
			defer permRows.Close()
			for permRows.Next() {
				var p string
				if permRows.Scan(&p) == nil {
					rd.Permissions = append(rd.Permissions, p)
				}
			}
		}
		if rd.Permissions == nil {
			rd.Permissions = []string{}
		}
		db.QueryRow(r.Context(),
			"SELECT COUNT(*) FROM authz.admin_role WHERE role_code = $1", code).Scan(&rd.AdminsCount)
		writeJSON(w, http.StatusOK, rd)
	}
}

// ── IAM: Permissions ────────────────────────────────────────────────────────

// adminIamPermissionsListHandler implements GET /api/admin/iam/permissions.
func adminIamPermissionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(),
			`SELECT p.code, p.description, p.category,
			 (SELECT COUNT(*) FROM authz.role_permission rp WHERE rp.permission_code = p.code) as roles_count
			 FROM authz.permission p ORDER BY p.category, p.code`)
		if err != nil {
			logger.Error("list iam permissions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Perm struct {
			Code        string  `json:"code"`
			Description *string `json:"description,omitempty"`
			Category    *string `json:"category,omitempty"`
			RolesCount  int     `json:"rolesCount"`
		}
		var items []Perm
		for rows.Next() {
			var p Perm
			if rows.Scan(&p.Code, &p.Description, &p.Category, &p.RolesCount) == nil {
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Perm{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminIamPermissionDetailHandler implements GET /api/admin/iam/permissions/{code}.
func adminIamPermissionDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := extractPathParam(r.URL.Path, "permissions", 1)
		if code == "" {
			writeJSONError(w, "permission code required", http.StatusBadRequest)
			return
		}
		type PermDetail struct {
			Code        string   `json:"code"`
			Description *string  `json:"description,omitempty"`
			Category    *string  `json:"category,omitempty"`
			Roles       []string `json:"roles"`
			AdminsCount int      `json:"adminsCount"`
			Truncated   bool     `json:"adminsTruncated"`
		}
		var pd PermDetail
		err := db.QueryRow(r.Context(),
			"SELECT code, description, category FROM authz.permission WHERE code = $1", code).
			Scan(&pd.Code, &pd.Description, &pd.Category)
		if err != nil {
			writeJSONError(w, "permission not found", http.StatusNotFound)
			return
		}
		roleRows, _ := db.Query(r.Context(),
			"SELECT role_code FROM authz.role_permission WHERE permission_code = $1 ORDER BY role_code", code)
		if roleRows != nil {
			defer roleRows.Close()
			for roleRows.Next() {
				var rc string
				if roleRows.Scan(&rc) == nil {
					pd.Roles = append(pd.Roles, rc)
				}
			}
		}
		if pd.Roles == nil {
			pd.Roles = []string{}
		}
		db.QueryRow(r.Context(),
			`SELECT COUNT(DISTINCT ar.admin_actor_id) FROM authz.admin_role ar
			 JOIN authz.role_permission rp ON rp.role_code = ar.role_code
			 WHERE rp.permission_code = $1`, code).Scan(&pd.AdminsCount)
		writeJSON(w, http.StatusOK, pd)
	}
}

// ── IAM: Admins ─────────────────────────────────────────────────────────────

// adminIamAdminsListHandler implements GET /api/admin/iam/admins.
func adminIamAdminsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
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
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(aa.display_name ILIKE $%[1]d OR aa.email ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("aa.status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM authz.admin_actor aa "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT aa.id, aa.display_name, aa.email, aa.status, aa.created_at, aa.updated_at
			FROM authz.admin_actor aa %s ORDER BY aa.created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list admins", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Admin struct {
			ID          string   `json:"id"`
			DisplayName *string  `json:"displayName,omitempty"`
			Email       *string  `json:"email,omitempty"`
			Status      string   `json:"status"`
			CreatedAt   string   `json:"createdAt"`
			UpdatedAt   string   `json:"updatedAt"`
			Roles       []string `json:"roles"`
		}
		var items []Admin
		for rows.Next() {
			var a Admin
			var ca, ua time.Time
			if rows.Scan(&a.ID, &a.DisplayName, &a.Email, &a.Status, &ca, &ua) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				a.UpdatedAt = ua.UTC().Format(time.RFC3339)
				rRows, _ := db.Query(r.Context(), "SELECT role_code FROM authz.admin_role WHERE admin_actor_id = $1", a.ID)
				if rRows != nil {
					for rRows.Next() {
						var rc string
						if rRows.Scan(&rc) == nil {
							a.Roles = append(a.Roles, rc)
						}
					}
					rRows.Close()
				}
				if a.Roles == nil {
					a.Roles = []string{}
				}
				items = append(items, a)
			}
		}
		if items == nil {
			items = []Admin{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "pageSize": pageSize, "total": total})
	}
}

// adminIamAdminDetailHandler implements GET /api/admin/iam/admins/{id}.
func adminIamAdminDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "admins", 1)
		if id == "" {
			writeJSONError(w, "admin id required", http.StatusBadRequest)
			return
		}
		type Detail struct {
			ID          string   `json:"id"`
			DisplayName *string  `json:"displayName,omitempty"`
			Email       *string  `json:"email,omitempty"`
			Status      string   `json:"status"`
			Roles       []string `json:"roles"`
			CreatedAt   string   `json:"createdAt"`
		}
		var d Detail
		var ca time.Time
		err := db.QueryRow(r.Context(),
			"SELECT id, display_name, email, status, created_at FROM authz.admin_actor WHERE id = $1", id).
			Scan(&d.ID, &d.DisplayName, &d.Email, &d.Status, &ca)
		if err != nil {
			writeJSONError(w, "admin not found", http.StatusNotFound)
			return
		}
		d.CreatedAt = ca.UTC().Format(time.RFC3339)
		rRows, _ := db.Query(r.Context(), "SELECT role_code FROM authz.admin_role WHERE admin_actor_id = $1", id)
		if rRows != nil {
			defer rRows.Close()
			for rRows.Next() {
				var rc string
				if rRows.Scan(&rc) == nil {
					d.Roles = append(d.Roles, rc)
				}
			}
		}
		if d.Roles == nil {
			d.Roles = []string{}
		}
		writeJSON(w, http.StatusOK, d)
	}
}

// adminIamAdminAssignRoleHandler implements POST /api/admin/iam/admins/{id}/roles.
func adminIamAdminAssignRoleHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		adminID := extractPathParam(r.URL.Path, "admins", 1)
		if adminID == "" {
			writeJSONError(w, "admin id required", http.StatusBadRequest)
			return
		}
		var req struct {
			RoleCode string `json:"roleCode"`
			Reason   string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.RoleCode == "" {
			writeJSONError(w, "roleCode required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		_, err := db.Exec(ctx,
			"INSERT INTO authz.admin_role (admin_actor_id, role_code, assigned_by, reason, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING",
			adminID, req.RoleCode, identity.ActorID, req.Reason)
		if err != nil {
			logger.Error("assign admin role", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"adminId": adminID, "roleCode": req.RoleCode})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.iam.role.assigned', $1, $2, 'authz.admin_role', $3, $4, NOW())`,
			identity.ActorID, adminID, req.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"assigned": true, "adminId": adminID, "roleCode": req.RoleCode})
	}
}

// adminIamAdminRevokeRoleHandler implements DELETE /api/admin/iam/admins/{id}/roles/{roleCode}.
func adminIamAdminRevokeRoleHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var adminID, roleCode string
		for i, p := range parts {
			if p == "admins" && i+1 < len(parts) {
				adminID = parts[i+1]
			}
			if p == "roles" && i+1 < len(parts) {
				roleCode = parts[i+1]
			}
		}
		if adminID == "" || roleCode == "" {
			writeJSONError(w, "admin id and role code required", http.StatusBadRequest)
			return
		}
		var reason string
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		reason = body.Reason
		ctx := r.Context()
		db.Exec(ctx, "DELETE FROM authz.admin_role WHERE admin_actor_id = $1 AND role_code = $2", adminID, roleCode)
		beforeJSON, _ := json.Marshal(map[string]any{"adminId": adminID, "roleCode": roleCode})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.iam.role.revoked', $1, $2, 'authz.admin_role', $3, $4, NOW())`,
			identity.ActorID, adminID, reason, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"revoked": true, "adminId": adminID, "roleCode": roleCode})
	}
}

// adminIamAdminPatchHandler implements PATCH /api/admin/iam/admins/{id}.
func adminIamAdminPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "admins", 1)
		if id == "" {
			writeJSONError(w, "admin id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Status      *string `json:"status,omitempty"`
			DisplayName *string `json:"displayName,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Status != nil {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
			argIdx++
		}
		if req.DisplayName != nil {
			setClauses = append(setClauses, "display_name = $"+itoa(argIdx))
			args = append(args, *req.DisplayName)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE authz.admin_actor SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.iam.admin.updated', $1, $2, 'authz.admin_actor', $3, $4, NOW())`,
			identity.ActorID, id, "admin updated", afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// ── IAM: Role Audit ─────────────────────────────────────────────────────────

// adminIamRoleAuditHandler implements GET /api/admin/iam/role-audit.
func adminIamRoleAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(),
			"SELECT id, admin_actor_id, role_code, assigned_by, reason, created_at FROM authz.admin_role ORDER BY created_at DESC LIMIT 200")
		if err != nil {
			logger.Error("list role audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Audit struct {
			ID           string  `json:"id"`
			AdminActorID string  `json:"adminActorId"`
			RoleCode     string  `json:"roleCode"`
			AssignedBy   *string `json:"assignedBy,omitempty"`
			Reason       *string `json:"reason,omitempty"`
			CreatedAt    string  `json:"createdAt"`
		}
		var items []Audit
		for rows.Next() {
			var a Audit
			var ca time.Time
			var assignedBy *string
			if rows.Scan(&a.ID, &a.AdminActorID, &a.RoleCode, &assignedBy, &a.Reason, &ca) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, a)
			}
		}
		if items == nil {
			items = []Audit{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// ── Content: Summary ────────────────────────────────────────────────────────

// adminContentSummaryHandler implements GET /api/admin/content/summary.
func adminContentSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type Summary struct {
			Lexemes  int `json:"lexemes"`
			Kanji    int `json:"kanji"`
			Grammar  int `json:"grammar"`
			Examples int `json:"examples"`
		}
		var s Summary
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.lexeme WHERE status = 'active'").Scan(&s.Lexemes)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.kanji WHERE status = 'active'").Scan(&s.Kanji)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.grammar WHERE status = 'active'").Scan(&s.Grammar)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.example_sentence WHERE status = 'active'").Scan(&s.Examples)
		writeJSON(w, http.StatusOK, s)
	}
}

// ── Content: Lexeme Examples ────────────────────────────────────────────────

// adminLexemeExamplesCreateHandler implements POST /api/admin/lexemes/{id}/examples.
func adminLexemeExamplesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		lexemeID := extractPathParam(r.URL.Path, "lexemes", 1)
		if lexemeID == "" {
			writeJSONError(w, "lexeme id required", http.StatusBadRequest)
			return
		}
		var req struct {
			SentenceJa string  `json:"sentenceJa"`
			SentenceVi *string `json:"sentenceVi,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx,
			"INSERT INTO content.lexeme_example (lexeme_id, sentence_ja, sentence_vi) VALUES ($1, $2, $3) RETURNING id",
			lexemeID, req.SentenceJa, req.SentenceVi).Scan(&createdID)
		if err != nil {
			logger.Error("create lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID})
	}
}

// adminLexemeExamplePatchHandler implements PATCH /api/admin/lexemes/{id}/examples/{linkId}.
func adminLexemeExamplePatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var lexemeID, linkID string
		for i, p := range parts {
			if p == "lexemes" && i+1 < len(parts) {
				lexemeID = parts[i+1]
			}
			if p == "examples" && i+1 < len(parts) {
				linkID = parts[i+1]
			}
		}
		if lexemeID == "" || linkID == "" {
			writeJSONError(w, "lexeme id and example id required", http.StatusBadRequest)
			return
		}
		var req struct {
			SentenceJa *string `json:"sentenceJa,omitempty"`
			SentenceVi *string `json:"sentenceVi,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.SentenceJa != nil {
			setClauses = append(setClauses, "sentence_ja = $"+itoa(argIdx))
			args = append(args, *req.SentenceJa)
			argIdx++
		}
		if req.SentenceVi != nil {
			setClauses = append(setClauses, "sentence_vi = $"+itoa(argIdx))
			args = append(args, *req.SentenceVi)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		query := "UPDATE content.lexeme_example SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx) + " AND lexeme_id = $" + itoa(argIdx+1)
		args = append(args, linkID, lexemeID)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": linkID, "updated": true})
	}
}

// adminLexemeExampleDeleteHandler implements DELETE /api/admin/lexemes/{id}/examples/{linkId}.
func adminLexemeExampleDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var lexemeID, linkID string
		for i, p := range parts {
			if p == "lexemes" && i+1 < len(parts) {
				lexemeID = parts[i+1]
			}
			if p == "examples" && i+1 < len(parts) {
				linkID = parts[i+1]
			}
		}
		if lexemeID == "" || linkID == "" {
			writeJSONError(w, "lexeme id and example id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()
		db.Exec(ctx, "DELETE FROM content.lexeme_example WHERE id = $1 AND lexeme_id = $2", linkID, lexemeID)
		beforeJSON, _ := json.Marshal(map[string]any{"id": linkID})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.content.example.deleted', $1, $2, 'content.lexeme_example', $3, $4, NOW())`,
			identity.ActorID, linkID, req.Reason, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": linkID})
	}
}

// ── Content: CRUD ───────────────────────────────────────────────────────────

// adminContentListHandler implements GET /api/admin/content.
func adminContentListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
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
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(headword ILIKE $%[1]d OR reading ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.lexeme "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, status, created_at
			FROM content.lexeme %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list content", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Item struct {
			ID             string  `json:"id"`
			Headword       string  `json:"headword"`
			Reading        *string `json:"reading,omitempty"`
			KanjiMeaningVi *string `json:"kanjiMeaningVi,omitempty"`
			JLPTLevel      *string `json:"jlptLevel,omitempty"`
			Status         string  `json:"status"`
			CreatedAt      string  `json:"createdAt"`
		}
		var items []Item
		for rows.Next() {
			var it Item
			var ca time.Time
			if rows.Scan(&it.ID, &it.Headword, &it.Reading, &it.KanjiMeaningVi, &it.JLPTLevel, &it.Status, &ca) == nil {
				it.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, it)
			}
		}
		if items == nil {
			items = []Item{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "pageSize": pageSize, "total": total})
	}
}

// adminContentCreateHandler implements POST /api/admin/content.
func adminContentCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"created": true, "type": req.Type})
	}
}

// adminContentStatusPatchHandler implements PATCH /api/admin/content/{type}/{id}/status.
func adminContentStatusPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var cType, cID string
		for i, p := range parts {
			if p == "content" && i+1 < len(parts) {
				cType = parts[i+1]
			}
			if p == cType && i+1 < len(parts) {
				cID = parts[i+1]
			}
		}
		if cType == "" || cID == "" {
			writeJSONError(w, "content type and id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Status string `json:"status"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		table := "content.lexeme"
		switch cType {
		case "kanji":
			table = "content.kanji"
		case "grammar":
			table = "content.grammar"
		case "example":
			table = "content.example_sentence"
		}
		_, err := db.Exec(ctx, fmt.Sprintf("UPDATE %s SET status = $1, updated_at = NOW() WHERE id = $2", table), req.Status, cID)
		if err != nil {
			logger.Error("patch content status", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Status})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.content.status.updated', $1, $2, $3, $4, $5, NOW())`,
			identity.ActorID, cID, cType, req.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": cID, "status": req.Status})
	}
}

// adminContentPatchHandler implements PATCH /api/admin/content/{type}/{id}.
func adminContentPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var cType, cID string
		for i, p := range parts {
			if p == "content" && i+1 < len(parts) {
				cType = parts[i+1]
			}
			if p == cType && i+1 < len(parts) {
				cID = parts[i+1]
			}
		}
		if cType == "" || cID == "" {
			writeJSONError(w, "content type and id required", http.StatusBadRequest)
			return
		}
		if cType == "example" {
			writeJSONError(w, "examples do not support this endpoint", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": cID, "type": cType, "updated": true})
	}
}

// ── Users ───────────────────────────────────────────────────────────────────

// adminUsersKpisHandler implements GET /api/admin/users/kpis.
func adminUsersKpisHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type KPIs struct {
			Total          int `json:"total"`
			Active         int `json:"active"`
			Suspended      int `json:"suspended"`
			OnboardingOpen int `json:"onboardingOpen"`
		}
		var k KPIs
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM profile.user_profile").Scan(&k.Total)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM profile.user_profile WHERE status = 'active'").Scan(&k.Active)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM profile.user_profile WHERE status = 'suspended'").Scan(&k.Suspended)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM profile.user_profile WHERE onboarding_status = 'open'").Scan(&k.OnboardingOpen)
		writeJSON(w, http.StatusOK, k)
	}
}

// adminUsersListHandler implements GET /api/admin/users.
func adminUsersListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(up.email ILIKE $%[1]d OR up.display_name ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("up.status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM profile.user_profile up "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT up.id, up.email, up.display_name, up.status, up.created_at
			FROM profile.user_profile up %s ORDER BY up.created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list users", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type User struct {
			ID          string  `json:"id"`
			Email       *string `json:"email,omitempty"`
			DisplayName *string `json:"displayName,omitempty"`
			Status      string  `json:"status"`
			CreatedAt   string  `json:"createdAt"`
		}
		var items []User
		for rows.Next() {
			var u User
			var ca time.Time
			if rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status, &ca) == nil {
				u.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, u)
			}
		}
		if items == nil {
			items = []User{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "pageSize": pageSize, "total": total})
	}
}

// adminUserDetailHandler implements GET /api/admin/users/{id}.
func adminUserDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "users", 1)
		if id == "" {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		type UserDetail struct {
			ID          string  `json:"id"`
			Email       *string `json:"email,omitempty"`
			DisplayName *string `json:"displayName,omitempty"`
			Status      string  `json:"status"`
			PlanID      *string `json:"planId,omitempty"`
		}
		var ud UserDetail
		err := db.QueryRow(r.Context(),
			"SELECT id, email, display_name, status FROM profile.user_profile WHERE id = $1", id).
			Scan(&ud.ID, &ud.Email, &ud.DisplayName, &ud.Status)
		if err != nil {
			writeJSONError(w, "user not found", http.StatusNotFound)
			return
		}
		db.QueryRow(r.Context(), "SELECT plan_id FROM monetization.user_subscription WHERE user_id = $1 AND status = 'active' LIMIT 1", id).Scan(&ud.PlanID)
		writeJSON(w, http.StatusOK, ud)
	}
}

// adminUserAuditHandler implements GET /api/admin/users/{id}/audit.
func adminUserAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "users", 1)
		if id == "" {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		limit := queryInt(r, "limit", 50)
		if limit < 1 || limit > 200 {
			limit = 50
		}
		rows, err := db.Query(r.Context(),
			"SELECT id, action, target_id, target_type, reason, created_at FROM ops.admin_audit_log WHERE target_id = $1 ORDER BY created_at DESC LIMIT $2",
			id, limit)
		if err != nil {
			logger.Error("list user audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Audit struct {
			ID         string  `json:"id"`
			Action     string  `json:"action"`
			TargetID   *string `json:"targetId,omitempty"`
			TargetType *string `json:"targetType,omitempty"`
			Reason     *string `json:"reason,omitempty"`
			CreatedAt  string  `json:"createdAt"`
		}
		var items []Audit
		for rows.Next() {
			var a Audit
			var ca time.Time
			if rows.Scan(&a.ID, &a.Action, &a.TargetID, &a.TargetType, &a.Reason, &ca) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, a)
			}
		}
		if items == nil {
			items = []Audit{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminUserStatusPatchHandler implements PATCH /api/admin/users/{id}/status.
func adminUserStatusPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "users", 1)
		if id == "" {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Status string `json:"status"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		_, err := db.Exec(ctx, "UPDATE profile.user_profile SET status = $1, updated_at = NOW() WHERE id = $2", req.Status, id)
		if err != nil {
			logger.Error("patch user status", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Status})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.user.status.updated', $1, $2, $3, $4, $5, NOW())`,
			identity.ActorID, id, "profile.user_profile", req.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Status})
	}
}

// adminUserPlanPatchHandler implements PATCH /api/admin/users/{id}/plan.
func adminUserPlanPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "users", 1)
		if id == "" {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		var req struct {
			PlanID string `json:"planId"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		_, err := db.Exec(ctx, `
			INSERT INTO monetization.user_subscription (user_id, plan_id, status, created_at, updated_at)
			VALUES ($1, $2, 'active', NOW(), NOW())
			ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active', updated_at = NOW()`,
			id, req.PlanID)
		if err != nil {
			logger.Error("assign user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"planId": req.PlanID})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.user.plan.updated', $1, $2, $3, $4, $5, NOW())`,
			identity.ActorID, id, "monetization.user_subscription", req.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "planId": req.PlanID})
	}
}

// adminUserSupportNoteHandler implements POST /api/admin/users/{id}/support-notes.
func adminUserSupportNoteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "users", 1)
		if id == "" {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Body       string `json:"body"`
			Reason     string `json:"reason"`
			Visibility string `json:"visibility"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var noteID string
		err := db.QueryRow(ctx, `
			INSERT INTO admin.support_note (user_id, author_id, body, visibility, created_at)
			VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
			id, identity.ActorID, req.Body, req.Visibility).Scan(&noteID)
		if err != nil {
			logger.Error("add support note", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": noteID})
	}
}

// adminUserInviteHandler implements POST /api/admin/users/invite.
func adminUserInviteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Email       string  `json:"email"`
			DisplayName *string `json:"displayName,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var userID string
		err := db.QueryRow(ctx, `
			INSERT INTO profile.user_profile (email, display_name, status, created_at)
			VALUES ($1, $2, 'pending', NOW()) RETURNING id`,
			req.Email, req.DisplayName).Scan(&userID)
		if err != nil {
			logger.Error("invite user", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": userID, "email": req.Email})
	}
}

// adminUserCreateHandler implements POST /api/admin/users.
func adminUserCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Email       string  `json:"email"`
			DisplayName *string `json:"displayName,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var userID string
		err := db.QueryRow(ctx, `
			INSERT INTO profile.user_profile (email, display_name, status, created_at)
			VALUES ($1, $2, 'pending', NOW()) RETURNING id`,
			req.Email, req.DisplayName).Scan(&userID)
		if err != nil {
			logger.Error("create user", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": userID})
	}
}

// ── Audit ───────────────────────────────────────────────────────────────────

// adminAuditHandler implements GET /api/admin/audit.
func adminAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 25)
		page := queryInt(r, "page", 1)
		action := r.URL.Query().Get("action")
		actorID := r.URL.Query().Get("actorId")
		targetType := r.URL.Query().Get("targetType")
		q := r.URL.Query().Get("q")
		dateFrom := r.URL.Query().Get("dateFrom")
		dateTo := r.URL.Query().Get("dateTo")
		if limit < 1 || limit > 100 {
			limit = 25
		}
		if page < 1 {
			page = 1
		}
		offset := (page - 1) * limit
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if action != "" {
			whereParts = append(whereParts, fmt.Sprintf("action ILIKE $%d", argIdx))
			args = append(args, "%"+action+"%")
			argIdx++
		}
		if actorID != "" {
			whereParts = append(whereParts, fmt.Sprintf("actor_id = $%d", argIdx))
			args = append(args, actorID)
			argIdx++
		}
		if targetType != "" {
			whereParts = append(whereParts, fmt.Sprintf("target_type = $%d", argIdx))
			args = append(args, targetType)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(action ILIKE $%[1]d OR target_id ILIKE $%[1]d OR reason ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if dateFrom != "" {
			whereParts = append(whereParts, fmt.Sprintf("created_at >= $%d", argIdx))
			args = append(args, dateFrom)
			argIdx++
		}
		if dateTo != "" {
			whereParts = append(whereParts, fmt.Sprintf("created_at <= $%d", argIdx))
			args = append(args, dateTo)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM ops.admin_audit_log "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT id, action, actor_id, target_id, target_type, reason, created_at
			FROM ops.admin_audit_log %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Audit struct {
			ID         string  `json:"id"`
			Action     string  `json:"action"`
			ActorID    *string `json:"actorId,omitempty"`
			TargetID   *string `json:"targetId,omitempty"`
			TargetType *string `json:"targetType,omitempty"`
			Reason     *string `json:"reason,omitempty"`
			CreatedAt  string  `json:"createdAt"`
		}
		var items []Audit
		for rows.Next() {
			var a Audit
			var ca time.Time
			if rows.Scan(&a.ID, &a.Action, &a.ActorID, &a.TargetID, &a.TargetType, &a.Reason, &ca) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, a)
			}
		}
		if items == nil {
			items = []Audit{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "pageSize": limit, "total": total})
	}
}

// ── Support Notes ───────────────────────────────────────────────────────────

// adminSupportNotesListHandler implements GET /api/admin/support/notes.
func adminSupportNotesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)
		userID := r.URL.Query().Get("userId")
		createdBy := r.URL.Query().Get("createdBy")
		q := r.URL.Query().Get("q")
		visibility := r.URL.Query().Get("visibility")
		dateFrom := r.URL.Query().Get("dateFrom")
		dateTo := r.URL.Query().Get("dateTo")
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if userID != "" {
			whereParts = append(whereParts, fmt.Sprintf("sn.user_id = $%d", argIdx))
			args = append(args, userID)
			argIdx++
		}
		if createdBy != "" {
			whereParts = append(whereParts, fmt.Sprintf("sn.author_id = $%d", argIdx))
			args = append(args, createdBy)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("sn.body ILIKE $%d", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if visibility != "" {
			whereParts = append(whereParts, fmt.Sprintf("sn.visibility = $%d", argIdx))
			args = append(args, visibility)
			argIdx++
		}
		if dateFrom != "" {
			whereParts = append(whereParts, fmt.Sprintf("sn.created_at >= $%d", argIdx))
			args = append(args, dateFrom)
			argIdx++
		}
		if dateTo != "" {
			whereParts = append(whereParts, fmt.Sprintf("sn.created_at <= $%d", argIdx))
			args = append(args, dateTo)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM admin.support_note sn "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT sn.id, sn.user_id, sn.author_id, sn.body, sn.visibility, sn.created_at
			FROM admin.support_note sn %s ORDER BY sn.created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list support notes", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Note struct {
			ID         string `json:"id"`
			UserID     string `json:"userId"`
			AuthorID   string `json:"authorId"`
			Body       string `json:"body"`
			Visibility string `json:"visibility"`
			CreatedAt  string `json:"createdAt"`
		}
		var items []Note
		for rows.Next() {
			var n Note
			var ca time.Time
			if rows.Scan(&n.ID, &n.UserID, &n.AuthorID, &n.Body, &n.Visibility, &ca) == nil {
				n.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, n)
			}
		}
		if items == nil {
			items = []Note{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// adminSupportNotesCreateHandler implements POST /api/admin/support/notes.
func adminSupportNotesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			UserID     string `json:"userId"`
			Body       string `json:"body"`
			Reason     string `json:"reason"`
			Visibility string `json:"visibility"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var noteID string
		err := db.QueryRow(ctx, `
			INSERT INTO admin.support_note (user_id, author_id, body, visibility, created_at)
			VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
			req.UserID, identity.ActorID, req.Body, req.Visibility).Scan(&noteID)
		if err != nil {
			logger.Error("create support note", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": noteID})
	}
}

// ── Reading Assist Reports ──────────────────────────────────────────────────

// adminReadingAssistReportsHandler implements GET /api/admin/reading-assist/reports.
func adminReadingAssistReportsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		if limit < 1 || limit > 200 {
			limit = 50
		}
		rows, err := db.Query(r.Context(), `
			SELECT id, user_id, text_hash, exam_context, quiz_session_id, created_at
			FROM study.reading_assist_analysis
			ORDER BY created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("list reading assist reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Report struct {
			ID            string  `json:"id"`
			UserID        string  `json:"userId"`
			TextHash      string  `json:"textHash"`
			ExamContext   bool    `json:"examContext"`
			QuizSessionID *string `json:"quizSessionId,omitempty"`
			CreatedAt     string  `json:"createdAt"`
		}
		var items []Report
		for rows.Next() {
			var rp Report
			var ca time.Time
			if rows.Scan(&rp.ID, &rp.UserID, &rp.TextHash, &rp.ExamContext, &rp.QuizSessionID, &ca) == nil {
				rp.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, rp)
			}
		}
		if items == nil {
			items = []Report{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// ── I18n Admin ──────────────────────────────────────────────────────────────

// adminI18nKeysListHandler implements GET /api/admin/i18n/keys.
func adminI18nKeysListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), "SELECT key, value, locale FROM i18n.translation ORDER BY key ASC")
		if err != nil {
			logger.Error("list i18n keys", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Key struct {
			Key    string `json:"key"`
			Value  string `json:"value"`
			Locale string `json:"locale"`
		}
		var items []Key
		for rows.Next() {
			var k Key
			if rows.Scan(&k.Key, &k.Value, &k.Locale) == nil {
				items = append(items, k)
			}
		}
		if items == nil {
			items = []Key{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminI18nPendingHandler implements GET /api/admin/i18n/pending.
func adminI18nPendingHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), "SELECT key, locale FROM i18n.translation WHERE value IS NULL ORDER BY key ASC")
		if err != nil {
			logger.Error("list pending i18n", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Pending struct {
			Key    string `json:"key"`
			Locale string `json:"locale"`
		}
		var items []Pending
		for rows.Next() {
			var p Pending
			if rows.Scan(&p.Key, &p.Locale) == nil {
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Pending{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminI18nKeyDetailHandler implements GET /api/admin/i18n/keys/{id}.
func adminI18nKeyDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "keys", 1)
		if id == "" {
			writeJSONError(w, "key id required", http.StatusBadRequest)
			return
		}
		type Detail struct {
			Key          string            `json:"key"`
			Translations map[string]string `json:"translations"`
		}
		rows, err := db.Query(r.Context(), "SELECT locale, value FROM i18n.translation WHERE key = $1", id)
		if err != nil {
			logger.Error("get i18n key detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		d := Detail{Key: id, Translations: make(map[string]string)}
		for rows.Next() {
			var locale, value string
			if rows.Scan(&locale, &value) == nil && value != "" {
				d.Translations[locale] = value
			}
		}
		writeJSON(w, http.StatusOK, d)
	}
}

// adminI18nTranslationPatchHandler implements PATCH /api/admin/i18n/keys/{id}/translation.
func adminI18nTranslationPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "keys", 1)
		if id == "" {
			writeJSONError(w, "key id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Locale string `json:"locale"`
			Value  string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		_, err := db.Exec(ctx, `
			INSERT INTO i18n.translation (key, locale, value, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (key, locale) DO UPDATE SET value = $3, updated_at = NOW()`,
			id, req.Locale, req.Value)
		if err != nil {
			logger.Error("patch i18n translation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"key": id, "locale": req.Locale})
	}
}