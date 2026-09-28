package authn

import (
	"context"
	"net/http"
)

// WithAdminIdentity returns a new request with AdminIdentity injected into the context.
// This is exported ONLY for testing cross-package middleware that depends on authn's
// unexported context key. Production code must use AdminGuard to inject identity.
func WithAdminIdentity(r *http.Request, actorID, sessionID string) *http.Request {
	ctx := context.WithValue(r.Context(), adminIdentityKey, AdminIdentity{
		SessionID: sessionID,
		ActorID:   actorID,
	})
	return r.WithContext(ctx)
}

// WithLearnerIdentity returns a new request with LearnerIdentity injected into the context.
// Exported ONLY for testing. Production code must use LearnerGuard.
func WithLearnerIdentity(r *http.Request, userID, sessionID string) *http.Request {
	ctx := context.WithValue(r.Context(), learnerIdentityKey, LearnerIdentity{
		SessionID: sessionID,
		UserID:    userID,
	})
	return r.WithContext(ctx)
}
