// Package authz provides admin RBAC permission loading from PostgreSQL authz tables.
package authz

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrActorNotActive is returned when an admin actor is disabled or missing.
var ErrActorNotActive = errors.New("authz: admin actor not active")

// AdminPrincipal holds a resolved admin identity with expanded permissions.
type AdminPrincipal struct {
	ActorID     string
	DisplayName string
	Permissions map[string]bool
}

// HasPermission checks whether the principal has the given permission code.
// Wildcard "*" grants all permissions, matching NestJS AdminAuthService behavior.
func (p *AdminPrincipal) HasPermission(code string) bool {
	if p.Permissions["*"] {
		return true
	}
	return p.Permissions[code]
}

// HasAnyPermission checks whether the principal has at least one of the candidate permissions.
func (p *AdminPrincipal) HasAnyPermission(codes []string) bool {
	if p.Permissions["*"] {
		return true
	}
	for _, c := range codes {
		if p.Permissions[c] {
			return true
		}
	}
	return false
}

// Store provides admin RBAC queries against PostgreSQL authz schema.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates an RBAC store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// LoadPrincipal loads an active admin actor and expands role→permission codes.
// Returns ErrActorNotActive if the actor is missing or status != 'active'.
func (s *Store) LoadPrincipal(ctx context.Context, actorID string) (*AdminPrincipal, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT a.display_name, p.code
FROM authz.admin_actor a
LEFT JOIN authz.admin_actor_role ar ON ar.actor_id = a.id
LEFT JOIN authz.admin_role r ON r.id = ar.role_id AND r.status = 'active'
LEFT JOIN authz.admin_role_permission rp ON rp.role_id = r.id
LEFT JOIN authz.admin_permission p ON p.id = rp.permission_id
WHERE a.id = $1 AND a.status = 'active'`

	rows, err := s.db.Query(ctx, q, actorID)
	if err != nil {
		return nil, fmt.Errorf("authz: load principal: %w", err)
	}
	defer rows.Close()

	var displayName string
	perms := make(map[string]bool)
	found := false

	for rows.Next() {
		found = true
		var permCode *string
		if err := rows.Scan(&displayName, &permCode); err != nil {
			return nil, fmt.Errorf("authz: scan principal row: %w", err)
		}
		if permCode != nil && *permCode != "" {
			perms[*permCode] = true
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("authz: iterate principal rows: %w", err)
	}

	if !found {
		return nil, ErrActorNotActive
	}

	return &AdminPrincipal{
		ActorID:     actorID,
		DisplayName: displayName,
		Permissions: perms,
	}, nil
}
