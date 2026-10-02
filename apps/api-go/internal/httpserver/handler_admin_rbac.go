// Package httpserver provides HTTP handlers for admin RBAC management endpoints.
package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
)

const (
	// maxAdminRBACBodyBytes bounds JSON body size for admin RBAC endpoints.
	maxAdminRBACBodyBytes = 4096

	// minAdminPasswordLen enforces minimum password strength for admin actor creation.
	minAdminPasswordLen = 8
)

// createActorRequest is the expected JSON shape for POST /api/admin/actors.
type createActorRequest struct {
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Password    string `json:"password"`
}

// updateActorStatusRequest is the expected JSON shape for PUT /api/admin/actors/:id/status.
type updateActorStatusRequest struct {
	Status string `json:"status"`
}

// assignRoleRequest is the expected JSON shape for POST /api/admin/actors/:id/roles.
type assignRoleRequest struct {
	RoleID string `json:"roleId"`
}

// adminActorResponse represents an admin actor in list/create responses.
type adminActorResponse struct {
	ID          string           `json:"id"`
	Email       string           `json:"email"`
	DisplayName string           `json:"displayName"`
	Status      string           `json:"status"`
	Roles       []adminRoleBrief `json:"roles"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   *time.Time       `json:"updatedAt"`
}

// adminRoleBrief is a minimal role representation embedded in actor responses.
type adminRoleBrief struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// adminRoleResponse represents a role with its permissions for GET /api/admin/roles.
type adminRoleResponse struct {
	ID          string                 `json:"id"`
	Code        string                 `json:"code"`
	Name        string                 `json:"name"`
	Description *string                `json:"description"`
	Status      string                 `json:"status"`
	Permissions []adminPermissionBrief `json:"permissions"`
	CreatedAt   time.Time              `json:"createdAt"`
}

// adminPermissionBrief is a minimal permission representation embedded in role responses.
type adminPermissionBrief struct {
	ID   string `json:"id"`
	Code string `json:"code"`
}

// adminPermissionResponse represents a permission for GET /api/admin/permissions.
type adminPermissionResponse struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Description *string `json:"description"`
}

// listActorsHandler implements GET /api/admin/actors.
func listActorsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		ctx := r.Context()
		actors, err := queryAllActors(ctx, db)
		if err != nil {
			logger.Error("list-actors: query failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(actors)
	}
}

// createActorHandler implements POST /api/admin/actors.
func createActorHandler(
	db *pgxpool.Pool,
	credStore *credential.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if rateLimiter == nil {
			logger.Error("create-actor: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxAdminRBACBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxAdminRBACBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req createActorRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		displayName := strings.TrimSpace(req.DisplayName)
		password := req.Password

		if email == "" || displayName == "" || password == "" {
			writeJSONError(w, "email, displayName, and password are required", http.StatusBadRequest)
			return
		}
		if len(displayName) > 120 {
			writeJSONError(w, "displayName must be at most 120 characters", http.StatusBadRequest)
			return
		}
		if len(password) < minAdminPasswordLen {
			writeJSONError(w, fmt.Sprintf("password must be at least %d characters", minAdminPasswordLen), http.StatusBadRequest)
			return
		}
		if len(password) > credential.MaxPasswordLen {
			writeJSONError(w, "password too long", http.StatusBadRequest)
			return
		}

		// Rate limit by IP.
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:admin-create:" + peerIP
		ok, err := rateLimiter.Allow(ipKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		ctx := r.Context()

		// Check for existing actor or learner with this email.
		existingID, err := lookupAdminActorIDByEmail(ctx, db, email)
		if err != nil {
			logger.Error("create-actor: email lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existingID != "" {
			writeJSONError(w, "email already registered", http.StatusConflict)
			return
		}

		// Create admin actor within transaction.
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("create-actor: begin tx failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		actorID, err := createAdminActor(ctx, tx, email, displayName)
		if err != nil {
			if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
				writeJSONError(w, "email already registered", http.StatusConflict)
				return
			}
			logger.Error("create-actor: create failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Set admin credential within the same transaction (admin actors live in authz.admin_actor,
		// not profile.user_profile, so we must use the admin credential table).
		if err := credStore.SetAdminCredentialTx(ctx, tx, actorID, []byte(password)); err != nil {
			logger.Error("create-actor: set credential failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(ctx); err != nil {
			logger.Error("create-actor: commit failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"id": actorID})
	}
}

// updateActorStatusHandler implements PUT /api/admin/actors/:id/status.
func updateActorStatusHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		actorID := chi.URLParam(r, "id")
		if actorID == "" || !isValidUUID(actorID) {
			writeJSONError(w, "invalid actor id", http.StatusBadRequest)
			return
		}

		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Cannot disable yourself.
		if identity.ActorID == actorID {
			writeJSONError(w, "cannot update own status", http.StatusForbidden)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxAdminRBACBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxAdminRBACBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req updateActorStatusRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		status := strings.TrimSpace(req.Status)
		if status != "active" && status != "disabled" {
			writeJSONError(w, "status must be 'active' or 'disabled'", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		if err := updateAdminActorStatus(ctx, db, actorID, status); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "actor not found", http.StatusNotFound)
				return
			}
			logger.Error("update-actor-status: failed", "error", err, "actor_id", actorID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Return updated actor.
		actor, err := queryActorByID(ctx, db, actorID)
		if err != nil {
			logger.Error("update-actor-status: re-fetch failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(actor)
	}
}

// assignRoleHandler implements POST /api/admin/actors/:id/roles.
func assignRoleHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		actorID := chi.URLParam(r, "id")
		if actorID == "" || !isValidUUID(actorID) {
			writeJSONError(w, "invalid actor id", http.StatusBadRequest)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxAdminRBACBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req assignRoleRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		roleID := strings.TrimSpace(req.RoleID)
		if roleID == "" || !isValidUUID(roleID) {
			writeJSONError(w, "invalid roleId", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		grantedAt, err := assignActorRole(ctx, db, actorID, roleID)
		if err != nil {
			if strings.Contains(err.Error(), "foreign key") || strings.Contains(err.Error(), "violates") {
				writeJSONError(w, "actor or role not found", http.StatusNotFound)
				return
			}
			logger.Error("assign-role: failed", "error", err, "actor_id", actorID, "role_id", roleID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"actorId":   actorID,
			"roleId":    roleID,
			"grantedAt": grantedAt,
		})
	}
}

// removeRoleHandler implements DELETE /api/admin/actors/:id/roles/:roleId.
func removeRoleHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		actorID := chi.URLParam(r, "id")
		roleID := chi.URLParam(r, "roleId")
		if actorID == "" || !isValidUUID(actorID) {
			writeJSONError(w, "invalid actor id", http.StatusBadRequest)
			return
		}
		if roleID == "" || !isValidUUID(roleID) {
			writeJSONError(w, "invalid role id", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		if err := removeActorRole(ctx, db, actorID, roleID); err != nil {
			logger.Error("remove-role: failed", "error", err, "actor_id", actorID, "role_id", roleID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// listRolesHandler implements GET /api/admin/roles.
func listRolesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		ctx := r.Context()
		roles, err := queryAllRoles(ctx, db)
		if err != nil {
			logger.Error("list-roles: query failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(roles)
	}
}

// listPermissionsHandler implements GET /api/admin/permissions.
func listPermissionsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		ctx := r.Context()
		perms, err := queryAllPermissions(ctx, db)
		if err != nil {
			logger.Error("list-permissions: query failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(perms)
	}
}

// --- DB helpers ---

func queryAllActors(ctx context.Context, db *pgxpool.Pool) ([]adminActorResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	const q = `SELECT a.id, a.email, a.display_name, a.status, a.created_at, a.updated_at,
		r.id AS role_id, r.code AS role_code, r.name AS role_name
	FROM authz.admin_actor a
	LEFT JOIN authz.admin_actor_role ar ON ar.actor_id = a.id
	LEFT JOIN authz.admin_role r ON r.id = ar.role_id
	ORDER BY a.created_at DESC`

	rows, err := db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query actors: %w", err)
	}
	defer rows.Close()

	actorMap := make(map[string]*adminActorResponse)
	var orderedIDs []string
	for rows.Next() {
		var a adminActorResponse
		var roleID, roleCode, roleName *string
		if err := rows.Scan(&a.ID, &a.Email, &a.DisplayName, &a.Status, &a.CreatedAt, &a.UpdatedAt, &roleID, &roleCode, &roleName); err != nil {
			return nil, fmt.Errorf("scan actor: %w", err)
		}
		if _, exists := actorMap[a.ID]; !exists {
			a.Roles = []adminRoleBrief{}
			actorMap[a.ID] = &a
			orderedIDs = append(orderedIDs, a.ID)
		}
		if roleID != nil && roleCode != nil && roleName != nil {
			actorMap[a.ID].Roles = append(actorMap[a.ID].Roles, adminRoleBrief{ID: *roleID, Code: *roleCode, Name: *roleName})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate actors: %w", err)
	}

	result := make([]adminActorResponse, 0, len(orderedIDs))
	for _, id := range orderedIDs {
		result = append(result, *actorMap[id])
	}
	return result, nil
}

func queryActorByID(ctx context.Context, db *pgxpool.Pool, actorID string) (*adminActorResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT a.id, a.email, a.display_name, a.status, a.created_at, a.updated_at,
		r.id AS role_id, r.code AS role_code, r.name AS role_name
	FROM authz.admin_actor a
	LEFT JOIN authz.admin_actor_role ar ON ar.actor_id = a.id
	LEFT JOIN authz.admin_role r ON r.id = ar.role_id
	WHERE a.id = $1`

	rows, err := db.Query(ctx, q, actorID)
	if err != nil {
		return nil, fmt.Errorf("query actor by id: %w", err)
	}
	defer rows.Close()

	var actor *adminActorResponse
	for rows.Next() {
		var a adminActorResponse
		var roleID, roleCode, roleName *string
		if err := rows.Scan(&a.ID, &a.Email, &a.DisplayName, &a.Status, &a.CreatedAt, &a.UpdatedAt, &roleID, &roleCode, &roleName); err != nil {
			return nil, fmt.Errorf("scan actor: %w", err)
		}
		if actor == nil {
			a.Roles = []adminRoleBrief{}
			actor = &a
		}
		if roleID != nil && roleCode != nil && roleName != nil {
			actor.Roles = append(actor.Roles, adminRoleBrief{ID: *roleID, Code: *roleCode, Name: *roleName})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate actor: %w", err)
	}
	if actor == nil {
		return nil, pgx.ErrNoRows
	}
	return actor, nil
}

func lookupAdminActorIDByEmail(ctx context.Context, db *pgxpool.Pool, email string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id FROM authz.admin_actor WHERE lower(email) = $1 LIMIT 1`
	var id string
	if err := db.QueryRow(ctx, q, email).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("lookup admin actor: %w", err)
	}
	return id, nil
}

func createAdminActor(ctx context.Context, tx pgx.Tx, email, displayName string) (string, error) {
	// updated_at is NOT NULL without a DB default (Prisma @updatedAt).
	const q = `INSERT INTO authz.admin_actor (email, display_name, status, updated_at)
	VALUES ($1, $2, 'active', now())
	RETURNING id`
	var id string
	if err := tx.QueryRow(ctx, q, email, displayName).Scan(&id); err != nil {
		return "", fmt.Errorf("create admin actor: %w", err)
	}
	return id, nil
}

func updateAdminActorStatus(ctx context.Context, db *pgxpool.Pool, actorID, status string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE authz.admin_actor SET status = $2, updated_at = now() WHERE id = $1 AND status != $2`
	tag, err := db.Exec(ctx, q, actorID, status)
	if err != nil {
		return fmt.Errorf("update actor status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func assignActorRole(ctx context.Context, db *pgxpool.Pool, actorID, roleID string) (time.Time, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO authz.admin_actor_role (actor_id, role_id)
	VALUES ($1, $2)
	ON CONFLICT (actor_id, role_id) DO NOTHING
	RETURNING granted_at`
	var grantedAt time.Time
	if err := db.QueryRow(ctx, q, actorID, roleID).Scan(&grantedAt); err != nil {
		// If ON CONFLICT DO NOTHING fired, no row returned — query existing.
		if errors.Is(err, pgx.ErrNoRows) {
			const q2 = `SELECT granted_at FROM authz.admin_actor_role WHERE actor_id = $1 AND role_id = $2`
			if err2 := db.QueryRow(ctx, q2, actorID, roleID).Scan(&grantedAt); err2 != nil {
				return time.Time{}, fmt.Errorf("assign role (idempotent): %w", err2)
			}
			return grantedAt, nil
		}
		return time.Time{}, fmt.Errorf("assign role: %w", err)
	}
	return grantedAt, nil
}

func removeActorRole(ctx context.Context, db *pgxpool.Pool, actorID, roleID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `DELETE FROM authz.admin_actor_role WHERE actor_id = $1 AND role_id = $2`
	_, err := db.Exec(ctx, q, actorID, roleID)
	if err != nil {
		return fmt.Errorf("remove role: %w", err)
	}
	return nil
}

func queryAllRoles(ctx context.Context, db *pgxpool.Pool) ([]adminRoleResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	const q = `SELECT r.id, r.code, r.name, r.status, r.created_at,
		p.id AS perm_id, p.code AS perm_code
	FROM authz.admin_role r
	LEFT JOIN authz.admin_role_permission rp ON rp.role_id = r.id
	LEFT JOIN authz.admin_permission p ON p.id = rp.permission_id
	ORDER BY r.name`

	rows, err := db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query roles: %w", err)
	}
	defer rows.Close()

	roleMap := make(map[string]*adminRoleResponse)
	var orderedIDs []string
	for rows.Next() {
		var roleID, roleCode, roleName, roleStatus string
		var createdAt time.Time
		var permID, permCode *string
		if err := rows.Scan(&roleID, &roleCode, &roleName, &roleStatus, &createdAt, &permID, &permCode); err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		if _, exists := roleMap[roleID]; !exists {
			roleMap[roleID] = &adminRoleResponse{
				ID:          roleID,
				Code:        roleCode,
				Name:        roleName,
				Status:      roleStatus,
				CreatedAt:   createdAt,
				Permissions: []adminPermissionBrief{},
			}
			orderedIDs = append(orderedIDs, roleID)
		}
		if permID != nil && permCode != nil {
			roleMap[roleID].Permissions = append(roleMap[roleID].Permissions, adminPermissionBrief{
				ID:   *permID,
				Code: *permCode,
			})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate roles: %w", err)
	}

	result := make([]adminRoleResponse, 0, len(orderedIDs))
	for _, id := range orderedIDs {
		result = append(result, *roleMap[id])
	}
	return result, nil
}

func queryAllPermissions(ctx context.Context, db *pgxpool.Pool) ([]adminPermissionResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	const q = `SELECT id, code FROM authz.admin_permission ORDER BY code`
	rows, err := db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query permissions: %w", err)
	}
	defer rows.Close()

	var perms []adminPermissionResponse
	for rows.Next() {
		var id, code string
		if err := rows.Scan(&id, &code); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, adminPermissionResponse{
			ID:   id,
			Code: code,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate permissions: %w", err)
	}
	return perms, nil
}

// isValidUUID performs basic UUID format validation (8-4-4-4-12 hex chars).
func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// parsePermissionCode splits "resource:action" into parts. If no colon, resource="" and action=code.
func parsePermissionCode(code string) (resource, action string) {
	parts := strings.SplitN(code, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", code
}
