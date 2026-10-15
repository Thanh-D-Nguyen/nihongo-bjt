package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/mail"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
)

// ── P1-A7: Admin Core — IAM + Users + Content + Support + Audit + I18n + ReadingAssist (38 routes) ──
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/admin/admin.controller.ts and i18n-admin.controller.ts.

// ── Session / Me / Module Contracts ─────────────────────────────────────────

// adminMeHandler implements GET /api/admin/me.
func adminMeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok || identity.ActorID == "" {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		type Permission struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		}
		type PermissionLink struct {
			Permission Permission `json:"permission"`
		}
		type Role struct {
			ID          string           `json:"id"`
			Code        string           `json:"code"`
			Name        string           `json:"name"`
			Status      string           `json:"status"`
			Permissions []PermissionLink `json:"permissions"`
		}
		type RoleLink struct {
			Role Role `json:"role"`
		}
		type AdminDetail struct {
			ID          string     `json:"id"`
			ActorID     string     `json:"actorId"`
			DisplayName string     `json:"displayName"`
			Email       string     `json:"email"`
			Status      string     `json:"status"`
			CreatedAt   time.Time  `json:"createdAt"`
			UpdatedAt   time.Time  `json:"updatedAt"`
			Roles       []RoleLink `json:"roles"`
			Permissions []string   `json:"permissions"`
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		// Match authz.Store.LoadPrincipal's actor and active-role filtering in a
		// single snapshot, retaining role membership for the admin client contract.
		rows, err := db.Query(ctx, `
			SELECT a.id, a.display_name, a.email, a.status, a.created_at, a.updated_at,
			       r.id, r.code, r.name, r.status, p.id, p.code
			FROM authz.admin_actor a
			LEFT JOIN authz.admin_actor_role ar ON ar.actor_id = a.id
			LEFT JOIN authz.admin_role r ON r.id = ar.role_id AND r.status = 'active'
			LEFT JOIN authz.admin_role_permission rp ON rp.role_id = r.id
			LEFT JOIN authz.admin_permission p ON p.id = rp.permission_id
			WHERE a.id = $1 AND a.status = 'active'
			ORDER BY r.code, p.code`, identity.ActorID)
		if err != nil {
			logger.Error("load admin me", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		ad := AdminDetail{Roles: []RoleLink{}, Permissions: []string{}}
		seenPermissions := make(map[string]bool)
		for rows.Next() {
			var roleID, roleCode, roleName, roleStatus, permissionID, permissionCode *string
			if err := rows.Scan(&ad.ID, &ad.DisplayName, &ad.Email, &ad.Status, &ad.CreatedAt, &ad.UpdatedAt,
				&roleID, &roleCode, &roleName, &roleStatus, &permissionID, &permissionCode); err != nil {
				logger.Error("scan admin me", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if roleID == nil {
				continue
			}
			if len(ad.Roles) == 0 || ad.Roles[len(ad.Roles)-1].Role.ID != *roleID {
				ad.Roles = append(ad.Roles, RoleLink{Role: Role{
					ID: *roleID, Code: *roleCode, Name: *roleName, Status: *roleStatus,
					Permissions: []PermissionLink{},
				}})
			}
			if permissionID != nil && permissionCode != nil && *permissionCode != "" {
				role := &ad.Roles[len(ad.Roles)-1].Role
				role.Permissions = append(role.Permissions, PermissionLink{Permission: Permission{ID: *permissionID, Code: *permissionCode}})
				if !seenPermissions[*permissionCode] {
					seenPermissions[*permissionCode] = true
					ad.Permissions = append(ad.Permissions, *permissionCode)
				}
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate admin me", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if ad.ID == "" {
			writeJSONError(w, "forbidden", http.StatusForbidden)
			return
		}
		ad.ActorID = ad.ID
		sort.Strings(ad.Permissions)
		writeJSON(w, http.StatusOK, ad)
	}
}

// adminModuleContractsHandler implements GET /api/admin/module-contracts.
func adminModuleContractsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// No dedicated module_contracts table exists; return empty list.
		writeJSON(w, http.StatusOK, []any{})
	}
}

// ── IAM: Roles ──────────────────────────────────────────────────────────────

// adminIamRolesListHandler implements GET /api/admin/iam/roles.
func adminIamRolesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT ar.id, ar.code, ar.name, ar.description, ar.status, ar.created_at,
			(SELECT COUNT(*) FROM authz.admin_role_permission rp WHERE rp.role_id = ar.id),
			(SELECT COUNT(*) FROM authz.admin_actor_role aar WHERE aar.role_id = ar.id)
			FROM authz.admin_role ar ORDER BY ar.code ASC`)
		if err != nil {
			logger.Error("list iam roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Role struct {
			ID              string  `json:"id"`
			Code            string  `json:"code"`
			Name            string  `json:"name"`
			Description     *string `json:"description,omitempty"`
			Status          string  `json:"status"`
			PermissionCount int     `json:"permissionCount"`
			AdminCount      int     `json:"adminCount"`
			CreatedAt       string  `json:"createdAt"`
		}
		var items []Role
		for rows.Next() {
			var rl Role
			var ca time.Time
			if err := rows.Scan(&rl.ID, &rl.Code, &rl.Name, &rl.Description, &rl.Status, &ca, &rl.PermissionCount, &rl.AdminCount); err != nil {
				logger.Error("scan iam role", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rl.CreatedAt = ca.UTC().Format(time.RFC3339)
			items = append(items, rl)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate iam roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		type RolePermission struct {
			Code        string  `json:"code"`
			Description *string `json:"description"`
		}
		type RoleAdmin struct {
			ID          string `json:"id"`
			DisplayName string `json:"displayName"`
			Email       string `json:"email"`
			Status      string `json:"status"`
			UpdatedAt   string `json:"updatedAt"`
		}
		type RoleDetail struct {
			ID          string           `json:"id"`
			Code        string           `json:"code"`
			Name        string           `json:"name"`
			Description *string          `json:"description"`
			Status      string           `json:"status"`
			CreatedAt   string           `json:"createdAt"`
			Permissions []RolePermission `json:"permissions"`
			Admins      []RoleAdmin      `json:"admins"`
		}
		var rd RoleDetail
		var createdAt time.Time
		err := db.QueryRow(r.Context(),
			"SELECT id, code, name, description, status, created_at FROM authz.admin_role WHERE code = $1", code).
			Scan(&rd.ID, &rd.Code, &rd.Name, &rd.Description, &rd.Status, &createdAt)
		if err != nil {
			writeJSONError(w, "role not found", http.StatusNotFound)
			return
		}
		rd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		permRows, err := db.Query(r.Context(),
			`SELECT ap.code, ap.description FROM authz.admin_role_permission arp
			 JOIN authz.admin_permission ap ON ap.id = arp.permission_id
			 JOIN authz.admin_role ar ON ar.id = arp.role_id
			 WHERE ar.code = $1 ORDER BY ap.code`, code)
		if err != nil {
			logger.Error("list iam role permissions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer permRows.Close()
		for permRows.Next() {
			var p RolePermission
			if err := permRows.Scan(&p.Code, &p.Description); err != nil {
				logger.Error("scan iam role permission", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rd.Permissions = append(rd.Permissions, p)
		}
		if err := permRows.Err(); err != nil {
			logger.Error("iterate iam role permissions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if rd.Permissions == nil {
			rd.Permissions = []RolePermission{}
		}
		adminRows, err := db.Query(r.Context(), `SELECT a.id, a.display_name, a.email, a.status, a.updated_at
			FROM authz.admin_actor_role aar JOIN authz.admin_actor a ON a.id = aar.actor_id
			JOIN authz.admin_role ar ON ar.id = aar.role_id WHERE ar.code = $1 ORDER BY a.email`, code)
		if err != nil {
			logger.Error("list iam role admins", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer adminRows.Close()
		for adminRows.Next() {
			var a RoleAdmin
			var updatedAt time.Time
			if err := adminRows.Scan(&a.ID, &a.DisplayName, &a.Email, &a.Status, &updatedAt); err != nil {
				logger.Error("scan iam role admin", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			rd.Admins = append(rd.Admins, a)
		}
		if err := adminRows.Err(); err != nil {
			logger.Error("iterate iam role admins", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if rd.Admins == nil {
			rd.Admins = []RoleAdmin{}
		}
		writeJSON(w, http.StatusOK, rd)
	}
}

// ── IAM: Permissions ────────────────────────────────────────────────────────

func iamPermissionGroup(code string) string {
	if index := strings.LastIndex(code, "."); index >= 0 {
		return code[:index]
	}
	return "(misc)"
}

// adminIamPermissionsListHandler implements GET /api/admin/iam/permissions.
func adminIamPermissionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT p.id, p.code, p.description, p.created_at,
			COALESCE((SELECT array_agg(ar.code ORDER BY ar.code) FROM authz.admin_role_permission rp JOIN authz.admin_role ar ON ar.id = rp.role_id WHERE rp.permission_id = p.id), '{}'::text[]),
			(SELECT COUNT(*) FROM authz.admin_role_permission rp WHERE rp.permission_id = p.id),
			(SELECT COUNT(DISTINCT aar.actor_id) FROM authz.admin_actor_role aar JOIN authz.admin_role_permission rp ON rp.role_id = aar.role_id WHERE rp.permission_id = p.id)
			FROM authz.admin_permission p ORDER BY p.code`)
		if err != nil {
			logger.Error("list iam permissions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Perm struct {
			ID          string   `json:"id"`
			Code        string   `json:"code"`
			Group       string   `json:"group"`
			Description *string  `json:"description"`
			RoleCodes   []string `json:"roleCodes"`
			RoleCount   int      `json:"roleCount"`
			AdminCount  int      `json:"adminCount"`
			CreatedAt   string   `json:"createdAt"`
		}
		var items []Perm
		for rows.Next() {
			var p Perm
			var createdAt time.Time
			if err := rows.Scan(&p.ID, &p.Code, &p.Description, &createdAt, &p.RoleCodes, &p.RoleCount, &p.AdminCount); err != nil {
				logger.Error("scan iam permission", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			p.Group = iamPermissionGroup(p.Code)
			p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			items = append(items, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate iam permissions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		type PermissionRole struct {
			ID          string  `json:"id"`
			Code        string  `json:"code"`
			Name        string  `json:"name"`
			Description *string `json:"description"`
			Status      string  `json:"status"`
		}
		type PermissionAdmin struct {
			ID           string   `json:"id"`
			DisplayName  string   `json:"displayName"`
			Email        string   `json:"email"`
			Status       string   `json:"status"`
			ViaRoleCodes []string `json:"viaRoleCodes"`
		}
		type PermDetail struct {
			ID          string            `json:"id"`
			Code        string            `json:"code"`
			Group       string            `json:"group"`
			Description *string           `json:"description"`
			CreatedAt   string            `json:"createdAt"`
			RoleCount   int               `json:"roleCount"`
			AdminCount  int               `json:"adminCount"`
			Roles       []PermissionRole  `json:"roles"`
			Admins      []PermissionAdmin `json:"admins"`
			Truncated   bool              `json:"adminsTruncated"`
		}
		var pd PermDetail
		var createdAt time.Time
		err := db.QueryRow(r.Context(),
			"SELECT id, code, description, created_at FROM authz.admin_permission WHERE code = $1", code).
			Scan(&pd.ID, &pd.Code, &pd.Description, &createdAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "permission not found", http.StatusNotFound)
				return
			}
			logger.Error("load iam permission", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		pd.Group, pd.CreatedAt = iamPermissionGroup(pd.Code), createdAt.UTC().Format(time.RFC3339)
		roleRows, err := db.Query(r.Context(), `SELECT ar.id, ar.code, ar.name, ar.description, ar.status
			FROM authz.admin_role_permission rp JOIN authz.admin_role ar ON ar.id = rp.role_id
			WHERE rp.permission_id = $1 ORDER BY ar.code`, pd.ID)
		if err != nil {
			logger.Error("list permission roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer roleRows.Close()
		for roleRows.Next() {
			var role PermissionRole
			if err := roleRows.Scan(&role.ID, &role.Code, &role.Name, &role.Description, &role.Status); err != nil {
				logger.Error("scan permission role", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			pd.Roles = append(pd.Roles, role)
		}
		if err := roleRows.Err(); err != nil {
			logger.Error("iterate permission roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if pd.Roles == nil {
			pd.Roles = []PermissionRole{}
		}
		if err := db.QueryRow(r.Context(), `SELECT COUNT(DISTINCT aar.actor_id) FROM authz.admin_actor_role aar
			JOIN authz.admin_role_permission rp ON rp.role_id = aar.role_id WHERE rp.permission_id = $1`, pd.ID).Scan(&pd.AdminCount); err != nil {
			logger.Error("count permission admins", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		pd.RoleCount = len(pd.Roles)
		adminRows, err := db.Query(r.Context(), `SELECT a.id, a.display_name, a.email, a.status, array_agg(ar.code ORDER BY ar.code)
			FROM authz.admin_actor_role aar JOIN authz.admin_actor a ON a.id = aar.actor_id
			JOIN authz.admin_role ar ON ar.id = aar.role_id JOIN authz.admin_role_permission rp ON rp.role_id = ar.id
			WHERE rp.permission_id = $1 GROUP BY a.id, a.display_name, a.email, a.status ORDER BY a.email LIMIT 101`, pd.ID)
		if err != nil {
			logger.Error("list permission admins", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer adminRows.Close()
		for adminRows.Next() {
			var admin PermissionAdmin
			if err := adminRows.Scan(&admin.ID, &admin.DisplayName, &admin.Email, &admin.Status, &admin.ViaRoleCodes); err != nil {
				logger.Error("scan permission admin", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if len(pd.Admins) == 100 {
				pd.Truncated = true
				break
			}
			pd.Admins = append(pd.Admins, admin)
		}
		if err := adminRows.Err(); err != nil {
			logger.Error("iterate permission admins", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if pd.Admins == nil {
			pd.Admins = []PermissionAdmin{}
		}
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
			Roles       []string `json:"roleCodes"`
		}
		var items []Admin
		for rows.Next() {
			var a Admin
			var ca, ua time.Time
			if rows.Scan(&a.ID, &a.DisplayName, &a.Email, &a.Status, &ca, &ua) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				a.UpdatedAt = ua.UTC().Format(time.RFC3339)
				rRows, _ := db.Query(r.Context(),
					`SELECT ar.code FROM authz.admin_actor_role aar
					JOIN authz.admin_role ar ON ar.id = aar.role_id
					WHERE aar.actor_id = $1`, a.ID)
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
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "admin not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read admin detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		d.CreatedAt = ca.UTC().Format(time.RFC3339)
		rRows, err := db.Query(r.Context(),
			`SELECT ar.code FROM authz.admin_actor_role aar
			JOIN authz.admin_role ar ON ar.id = aar.role_id
			WHERE aar.actor_id = $1`, id)
		if err != nil {
			logger.Error("read admin detail roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rRows.Close()
		for rRows.Next() {
			var rc string
			if err := rRows.Scan(&rc); err != nil {
				logger.Error("scan admin detail role", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			d.Roles = append(d.Roles, rc)
		}
		if err := rRows.Err(); err != nil {
			logger.Error("iterate admin detail roles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin admin role assignment", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var targetID string
		if err := tx.QueryRow(ctx, "SELECT id FROM authz.admin_actor WHERE id=$1 FOR UPDATE", adminID).Scan(&targetID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "admin not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read admin for role assignment", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// Resolve role_id from code, then insert into junction table
		var roleID string
		if err := tx.QueryRow(ctx, "SELECT id FROM authz.admin_role WHERE code = $1", req.RoleCode).Scan(&roleID); err != nil {
			writeJSONError(w, "role not found", http.StatusBadRequest)
			return
		}
		_, err = tx.Exec(ctx,
			"INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			adminID, roleID)
		if err != nil {
			logger.Error("assign admin role", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.iam.role.assigned", "authz.admin_actor_role", adminID, req.Reason, nil, map[string]any{"adminId": adminID, "roleCode": req.RoleCode}); err != nil {
			logger.Error("audit admin role assignment", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit admin role assignment", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		var body struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(strings.TrimSpace(body.Reason)) < 3 {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin admin role revoke", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		// Resolve role_id from code, then delete from junction table
		var roleID string
		if err := tx.QueryRow(ctx, "SELECT id FROM authz.admin_role WHERE code = $1", roleCode).Scan(&roleID); err != nil {
			writeJSONError(w, "role not found", http.StatusBadRequest)
			return
		}
		deleted, err := tx.Exec(ctx, "DELETE FROM authz.admin_actor_role WHERE actor_id = $1 AND role_id = $2", adminID, roleID)
		if err != nil {
			logger.Error("revoke admin role", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if deleted.RowsAffected() == 0 {
			writeJSONError(w, "admin role assignment not found", http.StatusNotFound)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.iam.role.revoked", "authz.admin_actor_role", adminID, body.Reason, map[string]any{"adminId": adminID, "roleCode": roleCode}, nil); err != nil {
			logger.Error("audit admin role revoke", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit admin role revoke", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
			Reason      string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Status != nil && *req.Status != "active" && *req.Status != "disabled" {
			writeJSONError(w, "invalid admin status", http.StatusBadRequest)
			return
		}
		if req.DisplayName != nil && (strings.TrimSpace(*req.DisplayName) == "" || len([]rune(strings.TrimSpace(*req.DisplayName))) > 120) {
			writeJSONError(w, "invalid display name", http.StatusBadRequest)
			return
		}
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin admin update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeName *string
		var beforeStatus string
		if err := tx.QueryRow(ctx, `SELECT display_name,status FROM authz.admin_actor WHERE id=$1 FOR UPDATE`, id).Scan(&beforeName, &beforeStatus); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "admin not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read admin before patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
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
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			logger.Error("patch admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"status": beforeStatus}
		if req.DisplayName != nil {
			after["displayName"] = strings.TrimSpace(*req.DisplayName)
		} else {
			after["displayName"] = beforeName
		}
		before := map[string]any{"displayName": beforeName, "status": beforeStatus}
		if req.Status != nil {
			after["status"] = *req.Status
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.iam.admin.updated", "authz.admin_actor", id, req.Reason, before, after); err != nil {
			logger.Error("audit admin update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit admin update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// ── IAM: Role Audit ─────────────────────────────────────────────────────────

// adminIamRoleAuditHandler implements GET /api/admin/iam/role-audit.
func adminIamRoleAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 100)
		if limit < 1 || limit > 200 {
			limit = 100
		}
		rows, err := db.Query(r.Context(), `SELECT l.id, l.action, l.created_at, l.reason, l.target_id, l.target_type,
			a.id, a.email, a.display_name FROM ops.admin_audit_log l
			LEFT JOIN authz.admin_actor a ON a.id = l.actor_id
			WHERE l.action LIKE 'admin.iam.role.%' ORDER BY l.created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("list role audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Audit struct {
			ID         string  `json:"id"`
			Action     string  `json:"action"`
			CreatedAt  string  `json:"createdAt"`
			Reason     *string `json:"reason"`
			TargetID   *string `json:"targetId"`
			TargetType *string `json:"targetType"`
			Actor      *struct {
				ID          string `json:"id"`
				Email       string `json:"email"`
				DisplayName string `json:"displayName"`
			} `json:"actor"`
		}
		var items []Audit
		for rows.Next() {
			var a Audit
			var ca time.Time
			var actorID, email, displayName *string
			if err := rows.Scan(&a.ID, &a.Action, &ca, &a.Reason, &a.TargetID, &a.TargetType, &actorID, &email, &displayName); err != nil {
				logger.Error("scan iam role audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.CreatedAt = ca.UTC().Format(time.RFC3339)
			if actorID != nil {
				a.Actor = &struct {
					ID          string `json:"id"`
					Email       string `json:"email"`
					DisplayName string `json:"displayName"`
				}{ID: *actorID}
				if email != nil {
					a.Actor.Email = *email
				}
				if displayName != nil {
					a.Actor.DisplayName = *displayName
				}
			}
			items = append(items, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate iam role audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
			ByCategory         map[string]int `json:"byCategory,omitempty"`
			ByLevel            map[string]int `json:"byLevel"`
			ByStatus           map[string]int `json:"byStatus"`
			DistinctLevelCount int            `json:"distinctLevelCount"`
			LastUpdatedAt      *string        `json:"lastUpdatedAt"`
			Total              int            `json:"total"`
			Type               string         `json:"type"`
		}

		contentType := r.URL.Query().Get("type")
		if contentType == "" {
			contentType = "lexeme"
		}
		tables := map[string]struct {
			table, level, search string
		}{
			"lexeme":  {"content.lexeme", "jlpt_level", "(headword ILIKE $%[1]d OR reading ILIKE $%[1]d)"},
			"kanji":   {"content.kanji", "level", "(character ILIKE $%[1]d OR meaning_vi ILIKE $%[1]d)"},
			"grammar": {"content.grammar_point", "jlpt_level", "(pattern ILIKE $%[1]d OR meaning_vi ILIKE $%[1]d)"},
		}
		cfg, supported := tables[contentType]
		if !supported {
			writeJSONError(w, "unsupported content type", http.StatusBadRequest)
			return
		}

		whereParts := []string{}
		args := []any{}
		if query := strings.TrimSpace(r.URL.Query().Get("q")); query != "" {
			args = append(args, "%"+query+"%")
			whereParts = append(whereParts, fmt.Sprintf(cfg.search, len(args)))
		}
		if status := r.URL.Query().Get("status"); status != "" {
			args = append(args, status)
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", len(args)))
		}
		levelParam := "jlptLevel"
		if contentType == "kanji" {
			levelParam = "level"
		}
		if level := r.URL.Query().Get(levelParam); level != "" {
			args = append(args, level)
			whereParts = append(whereParts, fmt.Sprintf("%s::text = $%d", cfg.level, len(args)))
		}
		if reading := strings.TrimSpace(r.URL.Query().Get("reading")); reading != "" && contentType == "lexeme" {
			args = append(args, "%"+reading+"%")
			whereParts = append(whereParts, fmt.Sprintf("reading ILIKE $%d", len(args)))
		}
		var err error
		whereParts, args, err = appendAdminKanjiStrokeCountFilters(r, contentType, whereParts, args)
		if err != nil {
			writeJSONError(w, "invalid stroke count filter", http.StatusBadRequest)
			return
		}
		where := ""
		if len(whereParts) > 0 {
			where = " WHERE " + strings.Join(whereParts, " AND ")
		}

		if category := strings.TrimSpace(r.URL.Query().Get("category")); category != "" && contentType == "grammar" {
			args = append(args, category)
			whereParts = append(whereParts, fmt.Sprintf("category = $%d", len(args)))
			where = " WHERE " + strings.Join(whereParts, " AND ")
		}
		result := Summary{ByLevel: map[string]int{}, ByStatus: map[string]int{}, Type: contentType}
		if contentType == "grammar" {
			result.ByCategory = map[string]int{}
		}
		var lastUpdatedAt *time.Time
		if err := db.QueryRow(r.Context(), fmt.Sprintf("SELECT COUNT(*), COUNT(DISTINCT %s), MAX(updated_at) FROM %s%s", cfg.level, cfg.table, where), args...).Scan(&result.Total, &result.DistinctLevelCount, &lastUpdatedAt); err != nil {
			logger.Error("summarize admin content", "type", contentType, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if lastUpdatedAt != nil {
			formatted := lastUpdatedAt.UTC().Format(time.RFC3339)
			result.LastUpdatedAt = &formatted
		}
		for _, aggregate := range []struct {
			column string
			target map[string]int
		}{{"status", result.ByStatus}, {cfg.level, result.ByLevel}} {
			rows, err := db.Query(r.Context(), fmt.Sprintf("SELECT COALESCE(%s::text, ''), COUNT(*) FROM %s%s GROUP BY %s", aggregate.column, cfg.table, where, aggregate.column), args...)
			if err != nil {
				logger.Error("aggregate admin content", "type", contentType, "column", aggregate.column, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			for rows.Next() {
				var key string
				var count int
				if err := rows.Scan(&key, &count); err != nil {
					rows.Close()
					logger.Error("scan admin content summary", "column", aggregate.column, "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				aggregate.target[key] = count
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				logger.Error("iterate admin content summary", "column", aggregate.column, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rows.Close()
		}
		if contentType == "grammar" {
			rows, err := db.Query(r.Context(), fmt.Sprintf("SELECT COALESCE(category, ''), COUNT(*) FROM %s%s GROUP BY category", cfg.table, where), args...)
			if err != nil {
				logger.Error("aggregate admin grammar categories", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			for rows.Next() {
				var key string
				var count int
				if err := rows.Scan(&key, &count); err != nil {
					rows.Close()
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				result.ByCategory[key] = count
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rows.Close()
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func appendAdminKanjiStrokeCountFilters(r *http.Request, contentType string, whereParts []string, args []any) ([]string, []any, error) {
	if contentType != "kanji" {
		return whereParts, args, nil
	}
	var min, max *int
	for _, filter := range []struct {
		param string
		bound **int
	}{{"strokeCountMin", &min}, {"strokeCountMax", &max}} {
		raw := r.URL.Query().Get(filter.param)
		if raw == "" {
			continue
		}
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 || value > 200 {
			return nil, nil, fmt.Errorf("%s must be an integer between 0 and 200", filter.param)
		}
		*filter.bound = &value
	}
	if min != nil && max != nil && *min > *max {
		return nil, nil, fmt.Errorf("strokeCountMin must not exceed strokeCountMax")
	}
	for _, filter := range []struct {
		bound *int
		op    string
	}{{min, ">="}, {max, "<="}} {
		if filter.bound == nil {
			continue
		}
		args = append(args, *filter.bound)
		whereParts = append(whereParts, fmt.Sprintf("stroke_count %s $%d", filter.op, len(args)))
	}
	return whereParts, args, nil
}

// ── Content: Lexeme Examples ────────────────────────────────────────────────

func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

// adminLexemeExamplesCreateHandler implements POST /api/admin/lexemes/{id}/examples.
func adminLexemeExamplesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
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
			JapaneseText string  `json:"japaneseText"`
			Reading      *string `json:"reading"`
			Translation  *string `json:"translationVi"`
			Reason       string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.JapaneseText = strings.TrimSpace(req.JapaneseText)
		req.Reason = strings.TrimSpace(req.Reason)
		if req.JapaneseText == "" || len(req.Reason) < 3 {
			writeJSONError(w, "Japanese text and a reason of at least 3 characters are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin create lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var meaning string
		if err := tx.QueryRow(ctx, `SELECT COALESCE(NULLIF(short_meaning_vi,''),NULLIF(kanji_meaning_vi,''),'')
			FROM content.lexeme WHERE id=$1 FOR UPDATE`, lexemeID).Scan(&meaning); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "lexeme not found", http.StatusNotFound)
				return
			}
			logger.Error("load lexeme for example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if strings.TrimSpace(meaning) == "" {
			writeJSONError(w, "add a Vietnamese meaning before adding an example", http.StatusBadRequest)
			return
		}
		var senseID string
		err = tx.QueryRow(ctx, `SELECT id::text FROM content.lexeme_sense WHERE lexeme_id=$1 ORDER BY position LIMIT 1`, lexemeID).Scan(&senseID)
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `INSERT INTO content.lexeme_sense (lexeme_id,position,meaning_vi)
				VALUES ($1,1,$2) RETURNING id::text`, lexemeID, meaning).Scan(&senseID)
		}
		if err != nil {
			logger.Error("load or create lexeme sense for example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var sentenceID, linkID string
		if err := tx.QueryRow(ctx, `INSERT INTO content.example_sentence
			(japanese_text,reading,translation_vi,status,created_at,updated_at)
			VALUES ($1,NULLIF($2,''),NULLIF($3,''),'active',NOW(),NOW()) RETURNING id::text`,
			req.JapaneseText, optionalString(req.Reading), optionalString(req.Translation)).Scan(&sentenceID); err != nil {
			logger.Error("create example sentence", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.QueryRow(ctx, `INSERT INTO content.lexeme_sense_example (sense_id,example_sentence_id,source_example_key)
			VALUES ($1,$2,$3) RETURNING id::text`, senseID, sentenceID, "admin:"+sentenceID).Scan(&linkID); err != nil {
			logger.Error("link lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"japaneseText": req.JapaneseText, "reading": req.Reading, "translationVi": req.Translation}
		if err := writeAdminAuditLog(ctx, tx, identity.ActorID, "admin.content.example.created", "content.lexeme_example", linkID, nil, after); err != nil {
			logger.Error("audit create lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit create lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": linkID, "exampleSentenceId": sentenceID})
	}
}

// adminLexemeExamplePatchHandler implements PATCH /api/admin/lexemes/{id}/examples/{linkId}.
func adminLexemeExamplePatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
			JapaneseText string  `json:"japaneseText"`
			Reading      *string `json:"reading"`
			Translation  *string `json:"translationVi"`
			Reason       string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.JapaneseText = strings.TrimSpace(req.JapaneseText)
		req.Reason = strings.TrimSpace(req.Reason)
		if req.JapaneseText == "" || len(req.Reason) < 3 {
			writeJSONError(w, "Japanese text and a reason of at least 3 characters are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin update lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var sentenceID, beforeJapanese, beforeReading, beforeTranslation string
		err = tx.QueryRow(ctx, `SELECT es.id::text,es.japanese_text,COALESCE(es.reading,''),COALESCE(es.translation_vi,'')
			FROM content.lexeme_sense_example lse JOIN content.lexeme_sense ls ON ls.id=lse.sense_id
			JOIN content.example_sentence es ON es.id=lse.example_sentence_id
			WHERE lse.id=$1 AND ls.lexeme_id=$2 FOR UPDATE OF lse,es`, linkID, lexemeID).
			Scan(&sentenceID, &beforeJapanese, &beforeReading, &beforeTranslation)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "example not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load lexeme example for update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE content.example_sentence SET japanese_text=$1,reading=NULLIF($2,''),translation_vi=NULLIF($3,''),updated_at=NOW() WHERE id=$4`,
			req.JapaneseText, optionalString(req.Reading), optionalString(req.Translation), sentenceID); err != nil {
			logger.Error("update example sentence", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		before := map[string]any{"japaneseText": beforeJapanese, "reading": beforeReading, "translationVi": beforeTranslation}
		after := map[string]any{"japaneseText": req.JapaneseText, "reading": req.Reading, "translationVi": req.Translation}
		if err := writeAdminAuditLog(ctx, tx, identity.ActorID, "admin.content.example.updated", "content.lexeme_example", linkID, before, after); err != nil {
			logger.Error("audit update lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit update lexeme example", "error", err)
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin delete lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before map[string]any
		err = tx.QueryRow(ctx, `SELECT jsonb_build_object('id',lse.id,'japaneseText',es.japanese_text,
			'reading',es.reading,'translationVi',es.translation_vi) FROM content.lexeme_sense_example lse
			JOIN content.lexeme_sense ls ON ls.id=lse.sense_id JOIN content.example_sentence es ON es.id=lse.example_sentence_id
			WHERE lse.id=$1 AND ls.lexeme_id=$2 FOR UPDATE OF lse,es`, linkID, lexemeID).Scan(&before)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "example not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load lexeme example for deletion", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `DELETE FROM content.lexeme_sense_example WHERE id=$1`, linkID); err != nil {
			logger.Error("delete lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(ctx, tx, identity.ActorID, "admin.content.example.deleted", "content.lexeme_example", linkID, before, map[string]any{"reason": req.Reason}); err != nil {
			logger.Error("audit delete lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit delete lexeme example", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": linkID})
	}
}

// ── Content: CRUD ───────────────────────────────────────────────────────────

// adminContentListHandler implements GET /api/admin/content.
func adminContentListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		contentType := r.URL.Query().Get("type")
		if contentType == "" {
			contentType = "lexeme"
		}
		contentTypes := map[string]struct {
			table, search, fields string
		}{
			"lexeme": {"content.lexeme", "(headword ILIKE $%[1]d OR reading ILIKE $%[1]d)", `jsonb_build_object(
			'id',id,'headword',headword,'reading',reading,'shortMeaningVi',short_meaning_vi,'kanjiMeaningVi',kanji_meaning_vi,
			'jlptLevel',jlpt_level,'status',status,'createdAt',created_at,
			'lexemeExamples',COALESCE((SELECT jsonb_agg(x.example ORDER BY x.position,x.source_key) FROM (
				SELECT ls.position,lse.source_example_key AS source_key,jsonb_build_object(
					'exampleSentenceId',es.id,'japaneseText',es.japanese_text,'linkId',lse.id,
					'reading',es.reading,'senseId',ls.id,'sensePosition',ls.position,
					'status',es.status,'translationVi',es.translation_vi) AS example
				FROM content.lexeme_sense ls
				JOIN content.lexeme_sense_example lse ON lse.sense_id=ls.id
				JOIN content.example_sentence es ON es.id=lse.example_sentence_id
				WHERE ls.lexeme_id=lexeme.id
				ORDER BY ls.position,lse.source_example_key LIMIT 5
			) x),'[]'::jsonb))`},
			"kanji":   {"content.kanji", "(character ILIKE $%[1]d OR meaning_vi ILIKE $%[1]d)", `jsonb_build_object('id',id,'character',character,'meaningVi',meaning_vi,'level',level,'strokeCount',stroke_count,'status',status,'createdAt',created_at)`},
			"grammar": {"content.grammar_point", "(pattern ILIKE $%[1]d OR meaning_vi ILIKE $%[1]d)", `jsonb_build_object('id',id,'pattern',pattern,'meaningVi',meaning_vi,'jlptLevel',jlpt_level,'category',category,'status',status,'createdAt',created_at)`},
		}
		cfg, ok := contentTypes[contentType]
		if !ok {
			writeJSONError(w, "unsupported content type", http.StatusBadRequest)
			return
		}
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
			whereParts = append(whereParts, fmt.Sprintf(cfg.search, argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		for _, filter := range []struct{ param, column string }{
			{"jlptLevel", "jlpt_level"}, {"level", "level"}, {"category", "category"},
		} {
			if value := r.URL.Query().Get(filter.param); value != "" && ((filter.param == "level" && contentType == "kanji") || (filter.param == "jlptLevel" && contentType != "kanji") || (filter.param == "category" && contentType == "grammar")) {
				whereParts = append(whereParts, fmt.Sprintf("%s::text = $%d", filter.column, argIdx))
				args = append(args, value)
				argIdx++
			}
		}
		if reading := strings.TrimSpace(r.URL.Query().Get("reading")); reading != "" && contentType == "lexeme" {
			whereParts = append(whereParts, fmt.Sprintf("reading ILIKE $%d", argIdx))
			args = append(args, "%"+reading+"%")
			argIdx++
		}
		var err error
		whereParts, args, err = appendAdminKanjiStrokeCountFilters(r, contentType, whereParts, args)
		if err != nil {
			writeJSONError(w, "invalid stroke count filter", http.StatusBadRequest)
			return
		}
		argIdx = len(args) + 1
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM "+cfg.table+" "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count admin content", "type", contentType, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		dataQ := fmt.Sprintf("SELECT %s FROM %s %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", cfg.fields, cfg.table, whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list content", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := make([]json.RawMessage, 0, pageSize)
		for rows.Next() {
			var item []byte
			if err := rows.Scan(&item); err != nil {
				logger.Error("scan admin content", "type", contentType, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			items = append(items, json.RawMessage(item))
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate admin content", "type", contentType, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "pageSize": pageSize, "total": total})
	}
}

// adminContentCreateHandler implements POST /api/admin/content.
func adminContentCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Type           string `json:"type"`
			Headword       string `json:"headword"`
			Reading        string `json:"reading"`
			ShortMeaningVi string `json:"shortMeaningVi"`
			KanjiMeaningVi string `json:"kanjiMeaningVi"`
			JLPTLevel      string `json:"jlptLevel"`
			Character      string `json:"character"`
			MeaningVi      string `json:"meaningVi"`
			Onyomi         string `json:"onyomi"`
			Kunyomi        string `json:"kunyomi"`
			StrokeCount    *int   `json:"strokeCount"`
			Level          *int   `json:"level"`
			Pattern        string `json:"pattern"`
			Category       string `json:"category"`
			Status         string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Type = strings.TrimSpace(req.Type)
		if req.Status == "" {
			req.Status = "needs_review"
		}
		if req.Status != "active" && req.Status != "needs_review" && req.Status != "archived" {
			writeJSONError(w, "invalid content status", http.StatusBadRequest)
			return
		}
		optional := func(value string) any {
			if value = strings.TrimSpace(value); value == "" {
				return nil
			}
			return value
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin admin content create", "type", req.Type, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())

		var id, targetType string
		switch req.Type {
		case "lexeme":
			req.Headword = strings.TrimSpace(req.Headword)
			if req.Headword == "" {
				writeJSONError(w, "headword is required", http.StatusBadRequest)
				return
			}
			targetType = "content.lexeme"
			err = tx.QueryRow(r.Context(), `INSERT INTO content.lexeme
				(headword, reading, short_meaning_vi, kanji_meaning_vi, jlpt_level, status, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING id::text`,
				req.Headword, optional(req.Reading), optional(req.ShortMeaningVi), optional(req.KanjiMeaningVi), optional(req.JLPTLevel), req.Status).Scan(&id)
		case "kanji":
			req.Character = strings.TrimSpace(req.Character)
			if req.Character == "" || (req.StrokeCount != nil && *req.StrokeCount < 1) || (req.Level != nil && (*req.Level < 1 || *req.Level > 10)) {
				writeJSONError(w, "valid character, strokeCount and level are required", http.StatusBadRequest)
				return
			}
			targetType = "content.kanji"
			err = tx.QueryRow(r.Context(), `INSERT INTO content.kanji
				(character, meaning_vi, onyomi, kunyomi, stroke_count, level, status, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id::text`,
				req.Character, optional(req.MeaningVi), optional(req.Onyomi), optional(req.Kunyomi), req.StrokeCount, req.Level, req.Status).Scan(&id)
		case "grammar":
			req.Pattern = strings.TrimSpace(req.Pattern)
			req.MeaningVi = strings.TrimSpace(req.MeaningVi)
			if req.Pattern == "" || req.MeaningVi == "" {
				writeJSONError(w, "pattern and meaningVi are required", http.StatusBadRequest)
				return
			}
			targetType = "content.grammar_point"
			err = tx.QueryRow(r.Context(), `INSERT INTO content.grammar_point
				(pattern, meaning_vi, jlpt_level, category, status, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id::text`,
				req.Pattern, req.MeaningVi, optional(req.JLPTLevel), optional(req.Category), req.Status).Scan(&id)
		default:
			writeJSONError(w, "unsupported content type", http.StatusBadRequest)
			return
		}
		if err != nil {
			logger.Error("create admin content", "type", req.Type, "error", err)
			writeJSONError(w, "content could not be created", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "admin.content.created", targetType, id, nil, map[string]any{"type": req.Type, "status": req.Status}); err != nil {
			logger.Error("audit admin content create", "type", req.Type, "id", id, "error", err)
			writeJSONError(w, "content could not be created", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit admin content create", "type", req.Type, "id", id, "error", err)
			writeJSONError(w, "content could not be created", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "created": true, "type": req.Type})
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
		parsedID, err := uuid.Parse(cID)
		if err != nil {
			writeJSONError(w, "invalid content id", http.StatusBadRequest)
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
		req.Status = strings.TrimSpace(req.Status)
		req.Reason = strings.TrimSpace(req.Reason)
		if req.Status != "active" && req.Status != "needs_review" && req.Status != "archived" {
			writeJSONError(w, "invalid content status", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}
		tables := map[string]string{"lexeme": "content.lexeme", "kanji": "content.kanji", "grammar": "content.grammar_point"}
		table, supported := tables[cType]
		if !supported {
			writeJSONError(w, "unsupported content type", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin admin content status patch", "type", cType, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeJSON []byte
		if err := tx.QueryRow(ctx, "SELECT to_jsonb(item) FROM "+table+" AS item WHERE id=$1 FOR UPDATE", parsedID).Scan(&beforeJSON); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "content not found", http.StatusNotFound)
				return
			}
			logger.Error("load content before status patch", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, "UPDATE "+table+" SET status=$1, updated_at=NOW() WHERE id=$2", req.Status, parsedID); err != nil {
			logger.Error("patch admin content status", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"status": req.Status, "reason": req.Reason}
		if err := writeAdminAuditLog(ctx, tx, identity.ActorID, "admin.content.status.updated", table, cID, json.RawMessage(beforeJSON), after); err != nil {
			logger.Error("audit admin content status patch", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit admin content status patch", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": cID, "status": req.Status})
	}
}

// adminContentPatchHandler implements PATCH /api/admin/content/{type}/{id}.
func adminContentPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		parsedID, err := uuid.Parse(cID)
		if err != nil {
			writeJSONError(w, "invalid content id", http.StatusBadRequest)
			return
		}
		var req map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		fields := map[string]string{}
		tables := map[string]string{"lexeme": "content.lexeme", "kanji": "content.kanji", "grammar": "content.grammar_point"}
		table, supported := tables[cType]
		if !supported {
			writeJSONError(w, "unsupported content type", http.StatusBadRequest)
			return
		}
		switch cType {
		case "lexeme":
			fields = map[string]string{"headword": "headword", "reading": "reading", "shortMeaningVi": "short_meaning_vi", "kanjiMeaningVi": "kanji_meaning_vi", "jlptLevel": "jlpt_level", "status": "status"}
		case "kanji":
			fields = map[string]string{"character": "character", "meaningVi": "meaning_vi", "onyomi": "onyomi", "kunyomi": "kunyomi", "strokeCount": "stroke_count", "level": "level", "status": "status"}
		case "grammar":
			fields = map[string]string{"pattern": "pattern", "meaningVi": "meaning_vi", "jlptLevel": "jlpt_level", "category": "category", "status": "status"}
		}
		var reason string
		if raw := req["reason"]; len(raw) > 0 {
			_ = json.Unmarshal(raw, &reason)
		}
		reason = strings.TrimSpace(reason)
		if len(reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}
		updates := make([]struct {
			column string
			value  any
		}, 0, len(req))
		after := map[string]any{"reason": reason}
		for key, raw := range req {
			if key == "reason" {
				continue
			}
			column, valid := fields[key]
			if !valid {
				writeJSONError(w, "unsupported content field", http.StatusBadRequest)
				return
			}
			var value any
			if err := json.Unmarshal(raw, &value); err != nil {
				writeJSONError(w, "invalid content field", http.StatusBadRequest)
				return
			}
			if key == "strokeCount" || key == "level" {
				if value != nil {
					number, ok := value.(float64)
					if !ok || number != float64(int(number)) || number < 1 || number > 100 {
						writeJSONError(w, "invalid numeric content field", http.StatusBadRequest)
						return
					}
					value = int(number)
				}
			} else if value != nil {
				text, ok := value.(string)
				if !ok {
					writeJSONError(w, "content fields must be strings", http.StatusBadRequest)
					return
				}
				text = strings.TrimSpace(text)
				if (key == "headword" || key == "character" || key == "pattern" || key == "meaningVi") && text == "" {
					writeJSONError(w, "required content field cannot be empty", http.StatusBadRequest)
					return
				}
				if key == "status" && text != "active" && text != "needs_review" && text != "archived" {
					writeJSONError(w, "invalid content status", http.StatusBadRequest)
					return
				}
				value = text
			}
			updates = append(updates, struct {
				column string
				value  any
			}{column, value})
			after[key] = value
		}
		if len(updates) == 0 {
			writeJSONError(w, "at least one content field is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin admin content patch", "type", cType, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeJSON []byte
		if err := tx.QueryRow(ctx, "SELECT to_jsonb(item) FROM "+table+" AS item WHERE id=$1 FOR UPDATE", parsedID).Scan(&beforeJSON); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "content not found", http.StatusNotFound)
				return
			}
			logger.Error("load content before patch", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		args := make([]any, 0, len(updates)+1)
		sets := make([]string, 0, len(updates)+1)
		for i, update := range updates {
			sets = append(sets, fmt.Sprintf("%s=$%d", update.column, i+1))
			args = append(args, update.value)
		}
		sets = append(sets, "updated_at=NOW()")
		args = append(args, parsedID)
		query := fmt.Sprintf("UPDATE %s SET %s WHERE id=$%d", table, strings.Join(sets, ", "), len(args))
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			logger.Error("update admin content", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(ctx, tx, identity.ActorID, "admin.content.updated", table, cID, json.RawMessage(beforeJSON), after); err != nil {
			logger.Error("audit admin content patch", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit admin content patch", "type", cType, "id", cID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": cID, "type": cType, "updated": true})
	}
}

// ── Users ───────────────────────────────────────────────────────────────────

func adminUserPermission(db *pgxpool.Pool, write bool, handler http.HandlerFunc) http.HandlerFunc {
	permissions := []string{"support.user.read", "support.user.write", "support.user", "iam.manage"}
	if write {
		permissions = []string{"support.user.write", "support.user", "iam.manage"}
	}
	return authz.RequireAnyPermission(authz.NewStore(db), permissions)(handler).ServeHTTP
}

func adminUserID(r *http.Request) (string, error) {
	id := extractPathParam(r.URL.Path, "users", 1)
	parsed, err := uuid.Parse(id)
	if err != nil {
		return "", err
	}
	return parsed.String(), nil
}

func adminUserAudit(ctx context.Context, tx pgx.Tx, actorID, targetID, action, reason string, before, after any) error {
	return writeAdminAuditWithReason(ctx, tx, actorID, action, "profile.user_profile", targetID, reason, before, after)
}

func parseAdminUserEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if len(email) > 255 {
		return "", fmt.Errorf("email is too long")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", fmt.Errorf("invalid email")
	}
	return email, nil
}

// adminUsersKpisHandler implements GET /api/admin/users/kpis.
func adminUsersKpisHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
		type KPIs struct {
			TotalUsers           int `json:"totalUsers"`
			ActiveLearners       int `json:"activeLearners"`
			SuspendedOrDisabled  int `json:"suspendedOrDisabled"`
			OnboardingIncomplete int `json:"onboardingIncomplete"`
			PaidUsers            int `json:"paidUsers"`
		}
		var k KPIs
		err := db.QueryRow(r.Context(), `SELECT COUNT(*), COUNT(*) FILTER (WHERE status='active'),
			COUNT(*) FILTER (WHERE status IN ('suspended','disabled')),
			COUNT(*) FILTER (WHERE status='active' AND onboarding_current_level IS NULL),
			(SELECT COUNT(DISTINCT s.user_id) FROM monetization.user_subscription s JOIN monetization.plan p ON p.id=s.plan_id WHERE s.status='active' AND p.slug NOT IN ('free','internal'))
			FROM profile.user_profile`).Scan(&k.TotalUsers, &k.ActiveLearners, &k.SuspendedOrDisabled, &k.OnboardingIncomplete, &k.PaidUsers)
		if err != nil {
			logger.Error("load user KPIs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, k)
	})
}

// adminUsersListHandler implements GET /api/admin/users.
func adminUsersListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM profile.user_profile up "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count users", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
			if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status, &ca); err != nil {
				logger.Error("scan user list row", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			u.CreatedAt = ca.UTC().Format(time.RFC3339)
			items = append(items, u)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate user list", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []User{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "pageSize": pageSize, "total": total})
	})
}

// adminUserDetailHandler implements GET /api/admin/users/{id}.
func adminUserDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
		id, idErr := adminUserID(r)
		if idErr != nil {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		type UserDetail struct {
			ID          string  `json:"id"`
			Email       *string `json:"email,omitempty"`
			DisplayName *string `json:"displayName,omitempty"`
			Status      string  `json:"status"`
			PlanSlug    *string `json:"planSlug,omitempty"`
		}
		var ud UserDetail
		err := db.QueryRow(r.Context(),
			"SELECT id, email, display_name, status FROM profile.user_profile WHERE id = $1", id).
			Scan(&ud.ID, &ud.Email, &ud.DisplayName, &ud.Status)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "user not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load user detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := db.QueryRow(r.Context(), "SELECT p.slug FROM monetization.user_subscription s JOIN monetization.plan p ON p.id=s.plan_id WHERE s.user_id = $1 AND s.status = 'active' ORDER BY s.updated_at DESC LIMIT 1", id).Scan(&ud.PlanSlug); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("load user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, ud)
	})
}

// adminUserAuditHandler implements GET /api/admin/users/{id}/audit.
func adminUserAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
		id, idErr := adminUserID(r)
		if idErr != nil {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		var exists bool
		if err := db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM profile.user_profile WHERE id=$1)`, id).Scan(&exists); err != nil {
			logger.Error("check user for audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !exists {
			writeJSONError(w, "user not found", http.StatusNotFound)
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
			if err := rows.Scan(&a.ID, &a.Action, &a.TargetID, &a.TargetType, &a.Reason, &ca); err != nil {
				logger.Error("scan user audit row", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.CreatedAt = ca.UTC().Format(time.RFC3339)
			items = append(items, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate user audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Audit{}
		}
		writeJSON(w, http.StatusOK, items)
	})
}

// adminUserStatusPatchHandler implements PATCH /api/admin/users/{id}/status.
func adminUserStatusPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id, idErr := adminUserID(r)
		if idErr != nil {
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
		req.Status = strings.TrimSpace(req.Status)
		req.Reason = strings.TrimSpace(req.Reason)
		if (req.Status != "active" && req.Status != "suspended" && req.Status != "disabled" && req.Status != "pending") || len(req.Reason) < 3 || len(req.Reason) > 500 {
			writeJSONError(w, "invalid status or reason", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin user status update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before string
		err = tx.QueryRow(ctx, `SELECT status FROM profile.user_profile WHERE id=$1 FOR UPDATE`, id).Scan(&before)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "user not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("patch user status", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE profile.user_profile SET status=$1,updated_at=NOW() WHERE id=$2`, req.Status, id); err != nil {
			logger.Error("patch user status", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := adminUserAudit(ctx, tx, identity.ActorID, id, "admin.user.status.updated", req.Reason, map[string]string{"status": before}, map[string]string{"status": req.Status}); err != nil {
			logger.Error("audit user status", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit user status", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Status})
	})
}

// adminUserPlanPatchHandler implements PATCH /api/admin/users/{id}/plan.
func adminUserPlanPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id, idErr := adminUserID(r)
		if idErr != nil {
			writeJSONError(w, "user id required", http.StatusBadRequest)
			return
		}
		var req struct {
			PlanSlug string `json:"planSlug"`
			Reason   string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.PlanSlug = strings.TrimSpace(req.PlanSlug)
		req.Reason = strings.TrimSpace(req.Reason)
		if req.PlanSlug == "" || len(req.PlanSlug) > 64 || len(req.Reason) < 3 || len(req.Reason) > 500 {
			writeJSONError(w, "invalid plan or reason", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin user plan update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var userExists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM profile.user_profile WHERE id=$1)`, id).Scan(&userExists); err != nil {
			logger.Error("check user for plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !userExists {
			writeJSONError(w, "user not found", http.StatusNotFound)
			return
		}
		var planID string
		if err := tx.QueryRow(ctx, `SELECT id FROM monetization.plan WHERE slug=$1 AND status='active'`, req.PlanSlug).Scan(&planID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "plan not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("lookup user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var before *string
		if err := tx.QueryRow(ctx, `SELECT p.slug FROM monetization.user_subscription s JOIN monetization.plan p ON p.id=s.plan_id WHERE s.user_id=$1 AND s.status='active' ORDER BY s.updated_at DESC LIMIT 1`, id).Scan(&before); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("load current user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE monetization.user_subscription SET status='ended',updated_at=NOW() WHERE user_id=$1 AND status='active'`, id); err != nil {
			logger.Error("end current user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(ctx, `INSERT INTO monetization.user_subscription (user_id,plan_id,status,created_at,updated_at) VALUES ($1,$2,'active',NOW(),NOW())`, id, planID)
		if err != nil {
			logger.Error("assign user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := adminUserAudit(ctx, tx, identity.ActorID, id, "admin.user.plan.updated", req.Reason, map[string]any{"planSlug": before}, map[string]string{"planSlug": req.PlanSlug}); err != nil {
			logger.Error("audit user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit user plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "planSlug": req.PlanSlug})
	})
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
		noteID, status, err := createAdminSupportNote(r.Context(), db, identity.ActorID, id, req.Body, req.Reason, req.Visibility)
		if err != nil {
			if status == http.StatusInternalServerError {
				logger.Error("add support note", "error", err)
			}
			writeJSONError(w, http.StatusText(status), status)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": noteID})
	}
}

// adminUserInviteHandler implements POST /api/admin/users/invite.
func adminUserInviteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Email          string `json:"email"`
			DisplayName    string `json:"displayName"`
			AccountType    string `json:"accountType"`
			InitialStatus  string `json:"initialStatus"`
			CreationReason string `json:"creationReason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var emailErr error
		req.Email, emailErr = parseAdminUserEmail(req.Email)
		req.DisplayName = strings.TrimSpace(req.DisplayName)
		req.CreationReason = strings.TrimSpace(req.CreationReason)
		if emailErr != nil || req.DisplayName == "" || len(req.DisplayName) > 200 || len(req.CreationReason) < 3 || len(req.CreationReason) > 500 {
			writeJSONError(w, "invalid email, display name, or creation reason", http.StatusBadRequest)
			return
		}
		if req.AccountType == "" {
			req.AccountType = "learner"
		}
		if req.AccountType != "learner" && req.AccountType != "admin" && req.AccountType != "staff" {
			writeJSONError(w, "invalid account type", http.StatusBadRequest)
			return
		}
		if req.InitialStatus == "" {
			req.InitialStatus = "pending"
		}
		if req.InitialStatus != "active" && req.InitialStatus != "disabled" && req.InitialStatus != "pending" {
			writeJSONError(w, "invalid initial status", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin user invitation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var userID, invitationID string
		err = tx.QueryRow(ctx, `INSERT INTO profile.user_profile (email,display_name,account_type,status,created_at,updated_at)
			VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`, req.Email, req.DisplayName, req.AccountType, req.InitialStatus).Scan(&userID)
		if err != nil {
			adminUserWriteError(w, logger, "invite user", err)
			return
		}
		err = tx.QueryRow(ctx, `INSERT INTO profile.user_invitation (email,display_name,account_type,status,invited_by_id,user_profile_id,updated_at)
			VALUES ($1,$2,$3,'pending',$4,$5,NOW()) RETURNING id`, req.Email, req.DisplayName, req.AccountType, identity.ActorID, userID).Scan(&invitationID)
		if err != nil {
			logger.Error("persist user invitation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := adminUserAudit(ctx, tx, identity.ActorID, userID, "admin.user.invited", req.CreationReason, nil, map[string]string{"email": req.Email, "displayName": req.DisplayName, "invitationId": invitationID}); err != nil {
			logger.Error("audit user invitation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit user invitation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": userID, "email": req.Email, "invitationId": invitationID})
	})
}

// adminUserCreateHandler implements POST /api/admin/users.
func adminUserCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminUserPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Email          string `json:"email"`
			DisplayName    string `json:"displayName"`
			CreationReason string `json:"creationReason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var emailErr error
		req.Email, emailErr = parseAdminUserEmail(req.Email)
		req.DisplayName = strings.TrimSpace(req.DisplayName)
		req.CreationReason = strings.TrimSpace(req.CreationReason)
		if emailErr != nil || req.DisplayName == "" || len(req.DisplayName) > 200 || len(req.CreationReason) < 3 || len(req.CreationReason) > 500 {
			writeJSONError(w, "invalid email, display name, or creation reason", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin user creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var userID string
		err = tx.QueryRow(ctx, `INSERT INTO profile.user_profile (email,display_name,status,created_at,updated_at)
			VALUES ($1,$2,'pending',NOW(),NOW()) RETURNING id`, req.Email, req.DisplayName).Scan(&userID)
		if err != nil {
			adminUserWriteError(w, logger, "create user", err)
			return
		}
		if err := adminUserAudit(ctx, tx, identity.ActorID, userID, "admin.user.created", req.CreationReason, nil, map[string]string{"email": req.Email, "displayName": req.DisplayName}); err != nil {
			logger.Error("audit user creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit user creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": userID, "email": req.Email})
	})
}

func adminUserWriteError(w http.ResponseWriter, logger *slog.Logger, operation string, err error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		writeJSONError(w, "user already exists", http.StatusConflict)
		return
	}
	logger.Error(operation, "error", err)
	writeJSONError(w, "internal error", http.StatusInternalServerError)
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
		if limit < 1 || limit > 200 {
			limit = 50
		}
		offset := queryInt(r, "offset", 0)
		if offset < 0 {
			offset = 0
		}
		identity, ok := authn.GetAdminIdentity(r.Context())
		principal := authz.GetPrincipal(r.Context())
		if !ok || principal == nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		auditScope := principal.HasAnyPermission([]string{"iam.manage"})
		userID := r.URL.Query().Get("userId")
		createdBy := r.URL.Query().Get("createdBy")
		q := r.URL.Query().Get("q")
		visibility := r.URL.Query().Get("visibility")
		dateFrom := r.URL.Query().Get("dateFrom")
		dateTo := r.URL.Query().Get("dateTo")
		whereParts := []string{"a.action = 'admin.support_note.created'", "a.target_type = 'admin.support_note'"}
		args := []any{}
		argIdx := 1
		if auditScope {
			whereParts = append(whereParts, "TRUE")
		} else {
			whereParts = append(whereParts, fmt.Sprintf("(COALESCE(a.before->>'visibility', 'team') = 'team' OR (COALESCE(a.before->>'visibility', 'team') = 'private' AND a.actor_id = $%d))", argIdx))
			args = append(args, identity.ActorID)
			argIdx++
		}
		if userID != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.target_id = $%d", argIdx))
			args = append(args, userID)
			argIdx++
		}
		if createdBy != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.actor_id::text = $%d", argIdx))
			args = append(args, createdBy)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(a.reason ILIKE $%[1]d OR a.target_id ILIKE $%[1]d OR a.after->>'body' ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if visibility != "" {
			whereParts = append(whereParts, fmt.Sprintf("COALESCE(a.before->>'visibility', 'team') = $%d", argIdx))
			args = append(args, visibility)
			argIdx++
		}
		if dateFrom != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at >= $%d", argIdx))
			args = append(args, dateFrom)
			argIdx++
		}
		if dateTo != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at <= $%d", argIdx))
			args = append(args, dateTo)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM ops.admin_audit_log a "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count support notes", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		dataQ := fmt.Sprintf(`SELECT a.id, a.action, a.reason, a.created_at, a.target_id,
			COALESCE(a.before, jsonb_build_object('visibility', 'team')),
			COALESCE(a.after, '{}'::jsonb), a.actor_id, actor.display_name, actor.email
			FROM ops.admin_audit_log a
			JOIN authz.admin_actor actor ON actor.id = a.actor_id
			%s ORDER BY a.created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list support notes", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type NoteActor struct {
			ID          string  `json:"id"`
			DisplayName *string `json:"displayName"`
			Email       *string `json:"email"`
		}
		type Note struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			Reason    *string         `json:"reason"`
			CreatedAt string          `json:"createdAt"`
			TargetID  string          `json:"targetId"`
			Before    json.RawMessage `json:"before"`
			After     json.RawMessage `json:"after"`
			Actor     *NoteActor      `json:"actor"`
		}
		var items []Note
		for rows.Next() {
			var n Note
			var ca time.Time
			var actor NoteActor
			if err := rows.Scan(&n.ID, &n.Action, &n.Reason, &ca, &n.TargetID, &n.Before, &n.After, &actor.ID, &actor.DisplayName, &actor.Email); err != nil {
				logger.Error("scan support note", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			n.CreatedAt = ca.UTC().Format(time.RFC3339)
			n.Actor = &actor
			items = append(items, n)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate support notes", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Note{}
		}
		filters, _ := json.Marshal(map[string]any{"userId": userID, "createdBy": createdBy, "visibility": visibility})
		if _, err := db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_type, target_id, reason, after, created_at)
			VALUES ('admin.support_note.listed', $1, 'admin.support_note.query', 'list', 'support notes list read', $2, NOW())`, identity.ActorID, filters); err != nil {
			logger.Error("audit support notes read", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		noteID, status, err := createAdminSupportNote(r.Context(), db, identity.ActorID, req.UserID, req.Body, req.Reason, req.Visibility)
		if err != nil {
			if status == http.StatusInternalServerError {
				logger.Error("create support note", "error", err)
			}
			writeJSONError(w, http.StatusText(status), status)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": noteID})
	}
}

func createAdminSupportNote(ctx context.Context, db *pgxpool.Pool, actorID, userID, body, reason, visibility string) (string, int, error) {
	userID = strings.TrimSpace(userID)
	body = strings.TrimSpace(body)
	reason = strings.TrimSpace(reason)
	if userID == "" || body == "" || len(body) > 4000 || len(reason) < 3 || len(reason) > 500 {
		return "", http.StatusBadRequest, errors.New("invalid support note fields")
	}
	if visibility != "private" && visibility != "team" && visibility != "audit_only" {
		return "", http.StatusBadRequest, errors.New("invalid support note visibility")
	}
	var exists bool
	if err := db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM profile.user_profile WHERE id::text = $1)", userID).Scan(&exists); err != nil {
		return "", http.StatusInternalServerError, err
	}
	if !exists {
		return "", http.StatusNotFound, pgx.ErrNoRows
	}
	before, _ := json.Marshal(map[string]string{"visibility": visibility})
	after, _ := json.Marshal(map[string]string{"userId": userID, "body": body})
	tx, err := db.Begin(ctx)
	if err != nil {
		return "", http.StatusInternalServerError, err
	}
	defer tx.Rollback(ctx)
	var noteID string
	err = tx.QueryRow(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_type, target_id, reason, before, after, created_at)
		VALUES ('admin.support_note.created', $1, 'admin.support_note', $2, $3, $4, $5, NOW()) RETURNING id`, actorID, userID, reason, before, after).Scan(&noteID)
	if err != nil {
		return "", http.StatusInternalServerError, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", http.StatusInternalServerError, err
	}
	return noteID, http.StatusCreated, nil
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
			SELECT id, user_id, text_hash, kind, context, created_at
			FROM learning.reading_assist_report
			ORDER BY created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("list reading assist reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Report struct {
			ID        string  `json:"id"`
			UserID    string  `json:"userId"`
			TextHash  string  `json:"textHash"`
			Kind      string  `json:"kind"`
			Context   *string `json:"context,omitempty"`
			CreatedAt string  `json:"createdAt"`
		}
		var items []Report
		for rows.Next() {
			var rp Report
			var ca time.Time
			if rows.Scan(&rp.ID, &rp.UserID, &rp.TextHash, &rp.Kind, &rp.Context, &ca) == nil {
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

type adminI18nSummary struct {
	ID          string             `json:"id"`
	Namespace   string             `json:"namespace"`
	Key         string             `json:"key"`
	Description *string            `json:"description"`
	Values      map[string]*string `json:"values"`
	Status      map[string]string  `json:"status"`
	Complete    bool               `json:"complete"`
	CreatedAt   string             `json:"createdAt"`
	UpdatedAt   string             `json:"updatedAt"`
}

func buildAdminI18nSummary(id, namespace, key string, description *string, valuesJSON []byte, createdAt, updatedAt time.Time) (adminI18nSummary, error) {
	values := map[string]string{}
	if len(valuesJSON) != 0 {
		if err := json.Unmarshal(valuesJSON, &values); err != nil {
			return adminI18nSummary{}, err
		}
	}
	summary := adminI18nSummary{
		ID: id, Namespace: namespace, Key: key, Description: description,
		Values: make(map[string]*string, 3), Status: make(map[string]string, 3),
		CreatedAt: createdAt.UTC().Format(time.RFC3339), UpdatedAt: updatedAt.UTC().Format(time.RFC3339),
	}
	summary.Complete = true
	for _, locale := range []string{"vi", "ja", "en"} {
		if value, ok := values[locale]; ok {
			copy := value
			summary.Values[locale] = &copy
			if value == "" {
				summary.Status[locale] = "empty"
				summary.Complete = false
			} else {
				summary.Status[locale] = "translated"
			}
		} else {
			summary.Values[locale] = nil
			summary.Status[locale] = "missing"
			summary.Complete = false
		}
	}
	return summary, nil
}

// adminI18nKeysListHandler implements GET /api/admin/i18n/keys.
func adminI18nKeysListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q, namespace, status := strings.TrimSpace(r.URL.Query().Get("q")), strings.TrimSpace(r.URL.Query().Get("namespace")), r.URL.Query().Get("status")
		page, pageSize := queryInt(r, "page", 1), queryInt(r, "pageSize", 50)
		if len(q) > 200 || len(namespace) > 120 || (status != "" && status != "complete" && status != "untranslated") {
			writeJSONError(w, "invalid i18n filters", http.StatusBadRequest)
			return
		}
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 50
		}
		var total int
		if err := db.QueryRow(r.Context(), `WITH key_rows AS (
			SELECT k.id, k.namespace, k.key, k.description, k.created_at, k.updated_at,
				COALESCE(jsonb_object_agg(v.locale_code, v.value) FILTER (WHERE v.locale_code IS NOT NULL), '{}'::jsonb) AS values
			FROM l10n.translation_key k LEFT JOIN l10n.translation_value v ON v.key_id = k.id GROUP BY k.id
		) SELECT count(*) FROM key_rows WHERE ($1 = '' OR key ILIKE '%' || $1 || '%' OR namespace ILIKE '%' || $1 || '%')
			AND ($2 = '' OR namespace = $2)
			AND ($3 = '' OR ($3 = 'complete' AND COALESCE(values->>'vi','') <> '' AND COALESCE(values->>'ja','') <> '' AND COALESCE(values->>'en','') <> '')
				OR ($3 = 'untranslated' AND (COALESCE(values->>'vi','') = '' OR COALESCE(values->>'ja','') = '' OR COALESCE(values->>'en','') = '')))`, q, namespace, status).Scan(&total); err != nil {
			logger.Error("count i18n keys", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		rows, err := db.Query(r.Context(), `WITH key_rows AS (
			SELECT k.id, k.namespace, k.key, k.description, k.created_at, k.updated_at,
				COALESCE(jsonb_object_agg(v.locale_code, v.value) FILTER (WHERE v.locale_code IS NOT NULL), '{}'::jsonb) AS values
			FROM l10n.translation_key k LEFT JOIN l10n.translation_value v ON v.key_id = k.id GROUP BY k.id
		) SELECT id::text, namespace, key, description, values, created_at, updated_at FROM key_rows
			WHERE ($1 = '' OR key ILIKE '%' || $1 || '%' OR namespace ILIKE '%' || $1 || '%')
			AND ($2 = '' OR namespace = $2)
			AND ($3 = '' OR ($3 = 'complete' AND COALESCE(values->>'vi','') <> '' AND COALESCE(values->>'ja','') <> '' AND COALESCE(values->>'en','') <> '')
				OR ($3 = 'untranslated' AND (COALESCE(values->>'vi','') = '' OR COALESCE(values->>'ja','') = '' OR COALESCE(values->>'en','') = '')))
			ORDER BY namespace, key, id LIMIT $4 OFFSET $5`, q, namespace, status, pageSize, (page-1)*pageSize)
		if err != nil {
			logger.Error("list i18n keys", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := []adminI18nSummary{}
		for rows.Next() {
			var id, key, ns string
			var description *string
			var values []byte
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&id, &ns, &key, &description, &values, &createdAt, &updatedAt); err != nil {
				logger.Error("scan i18n key", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			item, err := buildAdminI18nSummary(id, ns, key, description, values, createdAt, updatedAt)
			if err != nil {
				logger.Error("decode i18n values", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate i18n keys", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "page": page, "pageSize": pageSize})
	}
}

// adminI18nPendingHandler implements GET /api/admin/i18n/pending.
func adminI18nPendingHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `WITH key_rows AS (
			SELECT k.id, k.namespace, k.key, k.description, k.created_at, k.updated_at,
				COALESCE(jsonb_object_agg(v.locale_code, v.value) FILTER (WHERE v.locale_code IS NOT NULL), '{}'::jsonb) AS values
			FROM l10n.translation_key k LEFT JOIN l10n.translation_value v ON v.key_id = k.id GROUP BY k.id
		) SELECT namespace, count(*) AS total,
			count(*) FILTER (WHERE COALESCE(values->>'vi','') <> '' AND COALESCE(values->>'ja','') <> '' AND COALESCE(values->>'en','') <> '') AS complete
			FROM key_rows GROUP BY namespace ORDER BY namespace`)
		if err != nil {
			logger.Error("list pending i18n", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Namespace struct {
			Namespace string `json:"namespace"`
			Pending   int    `json:"pending"`
			Total     int    `json:"total"`
		}
		items := []Namespace{}
		var total, complete, pending int
		for rows.Next() {
			var ns Namespace
			if err := rows.Scan(&ns.Namespace, &ns.Total, &ns.Pending); err != nil {
				logger.Error("scan pending i18n", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			ns.Pending = ns.Total - ns.Pending
			pending += ns.Pending
			total += ns.Total
			complete += ns.Total - ns.Pending
			items = append(items, ns)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate pending i18n", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"total": total, "pending": pending, "complete": complete, "namespaces": items})
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
		var key, namespace string
		var description *string
		var values []byte
		var createdAt, updatedAt time.Time
		err := db.QueryRow(r.Context(), `WITH key_rows AS (
			SELECT k.id, k.namespace, k.key, k.description, k.created_at, k.updated_at,
				COALESCE(jsonb_object_agg(v.locale_code, v.value) FILTER (WHERE v.locale_code IS NOT NULL), '{}'::jsonb) AS values
			FROM l10n.translation_key k
			LEFT JOIN l10n.translation_value v ON v.key_id = k.id
			GROUP BY k.id
		) SELECT id::text, namespace, key, description, values, created_at, updated_at
			FROM key_rows WHERE id = $1::bigint`, id).
			Scan(&id, &namespace, &key, &description, &values, &createdAt, &updatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "translation key not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get i18n key detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		d, err := buildAdminI18nSummary(id, namespace, key, description, values, createdAt, updatedAt)
		if err != nil {
			logger.Error("decode i18n detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		auditRows, err := db.Query(r.Context(), `SELECT id::text,action,reason,before,after,created_at FROM ops.admin_audit_log WHERE target_type='l10n.translation_key' AND target_id=$1 ORDER BY created_at DESC LIMIT 20`, id)
		if err != nil {
			logger.Error("read i18n audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		audit := []map[string]any{}
		defer auditRows.Close()
		for auditRows.Next() {
			var auditID, action string
			var reason *string
			var before, after []byte
			var at time.Time
			if err := auditRows.Scan(&auditID, &action, &reason, &before, &after, &at); err != nil {
				logger.Error("scan i18n audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			audit = append(audit, map[string]any{"id": auditID, "action": action, "reason": reason, "before": json.RawMessage(before), "after": json.RawMessage(after), "createdAt": at.UTC().Format(time.RFC3339)})
		}
		if err := auditRows.Err(); err != nil {
			logger.Error("iterate i18n audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": d.ID, "namespace": d.Namespace, "key": d.Key, "description": d.Description, "values": d.Values, "status": d.Status, "complete": d.Complete, "createdAt": d.CreatedAt, "updatedAt": d.UpdatedAt, "audit": audit})
	}
}

// adminI18nTranslationPatchHandler implements PATCH /api/admin/i18n/keys/{id}/translation.
func adminI18nTranslationPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
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
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Locale != "vi" && req.Locale != "ja" && req.Locale != "en" || len([]rune(req.Value)) > 5000 || len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "invalid translation update", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin i18n translation update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before *string
		if err := tx.QueryRow(ctx, `SELECT value FROM l10n.translation_value WHERE key_id=$1::bigint AND locale_code=$2 FOR UPDATE`, id, req.Locale).Scan(&before); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("read prior i18n translation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `INSERT INTO l10n.translation_value (key_id, locale_code, value, updated_at)
			VALUES ($1::bigint, $2, $3, NOW()) ON CONFLICT (key_id, locale_code) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, id, req.Locale, req.Value); err != nil {
			logger.Error("patch i18n translation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"locale": req.Locale, "value": before})
		afterJSON, _ := json.Marshal(map[string]any{"locale": req.Locale, "value": req.Value})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action,actor_id,target_type,target_id,reason,before,after,created_at) VALUES ('admin.i18n.translation.updated',$1,'l10n.translation_key',$2,$3,$4,$5,NOW())`, identity.ActorID, id, strings.TrimSpace(req.Reason), beforeJSON, afterJSON); err != nil {
			logger.Error("audit i18n translation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit i18n translation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		adminI18nKeyDetailHandler(db, logger)(w, r)
	}
}
