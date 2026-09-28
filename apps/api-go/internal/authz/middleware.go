// Package authz provides admin RBAC middleware for HTTP handlers.
package authz

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// contextKey is an unexported type for context keys to prevent cross-package fabrication.
type contextKey int

const (
	adminPrincipalKey contextKey = iota
)

// PrincipalLoader abstracts permission loading for testability.
type PrincipalLoader interface {
	LoadPrincipal(ctx context.Context, actorID string) (*AdminPrincipal, error)
}

// RequirePermission returns middleware that checks whether the authenticated
// admin principal (set by authn.AdminGuard in request context) has the given permission.
// Returns 401 for missing/invalid session, 403 for insufficient permission or inactive actor,
// 500 on backend errors or unexpected loader results. Never leaks internal details or
// the specific permission code that was checked.
func RequirePermission(loader PrincipalLoader, permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			identity, ok := authn.GetAdminIdentity(ctx)
			if !ok || identity.ActorID == "" {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			principal, err := loader.LoadPrincipal(ctx, identity.ActorID)
			if err != nil {
				if errors.Is(err, ErrActorNotActive) {
					writeJSONError(w, http.StatusForbidden, "forbidden")
					return
				}
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if principal == nil {
				// Defensive: loader returned (nil, nil). Treat as internal error
				// rather than panicking downstream.
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}

			if !principal.HasPermission(permission) {
				writeJSONError(w, http.StatusForbidden, "forbidden")
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, adminPrincipalKey, principal)))
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
				writeJSONError(w, http.StatusUnauthorized, "unauthorized")
				return
			}

			principal, err := loader.LoadPrincipal(ctx, identity.ActorID)
			if err != nil {
				if errors.Is(err, ErrActorNotActive) {
					writeJSONError(w, http.StatusForbidden, "forbidden")
					return
				}
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if principal == nil {
				writeJSONError(w, http.StatusInternalServerError, "internal error")
				return
			}

			if !principal.HasAnyPermission(permissions) {
				writeJSONError(w, http.StatusForbidden, "forbidden")
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, adminPrincipalKey, principal)))
		})
	}
}

// GetPrincipal retrieves the AdminPrincipal from context, or nil if not present.
// This is the only supported accessor; the context key is unexported.
func GetPrincipal(ctx context.Context) *AdminPrincipal {
	p, _ := ctx.Value(adminPrincipalKey).(*AdminPrincipal)
	return p
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
