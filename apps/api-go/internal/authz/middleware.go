// Package authz provides admin RBAC middleware for HTTP handlers.
package authz

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// contextKey is an unexported type for context keys to avoid collisions.
type contextKey string

const (
	// AdminPrincipalKey stores the resolved AdminPrincipal in request context.
	AdminPrincipalKey contextKey = "admin_principal"
)

// PrincipalLoader abstracts permission loading for testability.
type PrincipalLoader interface {
	LoadPrincipal(ctx context.Context, actorID string) (*AdminPrincipal, error)
}

// RequirePermission returns middleware that checks whether the authenticated
// admin principal (set by AdminGuard in request context) has the given permission.
// Returns 401 if no identity present, 403 if insufficient permission or inactive actor,
// 500 on backend errors. Never leaks internal details.
func RequirePermission(loader PrincipalLoader, permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// Extract actor ID from context (set by authn.AdminGuard).
			identity, ok := authn.GetAdminIdentity(ctx)
			if !ok || identity.ActorID == "" {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized: no admin identity")
				return
			}

			principal, err := loader.LoadPrincipal(ctx, identity.ActorID)
			if err != nil {
				if errors.Is(err, ErrActorNotActive) {
					writeJSONError(w, http.StatusForbidden, "forbidden: account inactive")
					return
				}
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}

			if !principal.HasPermission(permission) {
				writeJSONError(w, http.StatusForbidden, fmt.Sprintf("forbidden: missing permission %q", permission))
				return
			}

			// Inject principal into context for downstream handlers.
			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, AdminPrincipalKey, principal)))
		})
	}
}

// RequireAnyPermission returns middleware that checks whether the authenticated
// admin principal has at least one of the given permissions.
func RequireAnyPermission(loader PrincipalLoader, permissions []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			identity, ok := authn.GetAdminIdentity(ctx)
			if !ok || identity.ActorID == "" {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized: no admin identity")
				return
			}

			principal, err := loader.LoadPrincipal(ctx, identity.ActorID)
			if err != nil {
				if errors.Is(err, ErrActorNotActive) {
					writeJSONError(w, http.StatusForbidden, "forbidden: account inactive")
					return
				}
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}

			if !principal.HasAnyPermission(permissions) {
				writeJSONError(w, http.StatusForbidden, "forbidden: insufficient permissions")
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, AdminPrincipalKey, principal)))
		})
	}
}

// GetPrincipal retrieves the AdminPrincipal from context, or nil if not present.
func GetPrincipal(ctx context.Context) *AdminPrincipal {
	p, _ := ctx.Value(AdminPrincipalKey).(*AdminPrincipal)
	return p
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
