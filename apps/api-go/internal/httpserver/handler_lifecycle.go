// Package httpserver provides HTTP handlers for account lifecycle endpoints.
package httpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const (
	// maxLifecycleBodyBytes bounds JSON body size for lifecycle endpoints.
	maxLifecycleBodyBytes = 4096

	// minPasswordLen enforces minimum password strength at registration/reset.
	minPasswordLen = 8

	// resetTokenTTL is the validity window for password reset tokens.
	resetTokenTTL = 1 * time.Hour

	// rawResetTokenLen is the byte length of the raw reset token (32 bytes = 256 bits).
	rawResetTokenLen = 32
)

// registerRequest is the expected JSON shape for POST /api/auth/register.
type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

// forgotPasswordRequest is the expected JSON shape for POST /api/auth/forgot-password.
type forgotPasswordRequest struct {
	Email string `json:"email"`
}

// resetPasswordRequest is the expected JSON shape for POST /api/auth/reset-password.
type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// changePasswordRequest is the expected JSON shape for POST /api/auth/change-password.
type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// registerHandler implements POST /api/auth/register.
// Creates a new learner profile with email/password/displayName and Argon2id credential.
func registerHandler(
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
			logger.Error("register: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxLifecycleBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxLifecycleBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req registerRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		password := req.Password
		displayName := strings.TrimSpace(req.DisplayName)

		// Validate inputs before rate limiting or expensive work.
		if email == "" || password == "" || displayName == "" {
			writeJSONError(w, "email, password, and displayName are required", http.StatusBadRequest)
			return
		}
		if len(password) < minPasswordLen {
			writeJSONError(w, fmt.Sprintf("password must be at least %d characters", minPasswordLen), http.StatusBadRequest)
			return
		}
		if len(password) > credential.MaxPasswordLen {
			writeJSONError(w, "password too long", http.StatusBadRequest)
			return
		}
		if len(displayName) > 100 {
			writeJSONError(w, "displayName too long", http.StatusBadRequest)
			return
		}

		// Rate limit by IP.
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:reg:" + peerIP
		ok, err := rateLimiter.Allow(ipKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		ctx := r.Context()

		// Check for existing user with this email.
		existingID, err := lookupUserIDByEmail(ctx, db, email)
		if err != nil {
			logger.Error("register: email lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existingID != "" {
			writeJSONError(w, "email already registered", http.StatusConflict)
			return
		}

		// Create user profile within transaction.
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("register: begin tx failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		userID, err := createLearnerProfile(ctx, tx, email, displayName)
		if err != nil {
			// Check for unique violation (race condition).
			if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
				writeJSONError(w, "email already registered", http.StatusConflict)
				return
			}
			logger.Error("register: create profile failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Set credential within the same transaction as profile creation (FK constraint).
		if err := credStore.SetLearnerCredentialTx(ctx, tx, userID, []byte(password)); err != nil {
			logger.Error("register: set credential failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(ctx); err != nil {
			logger.Error("register: commit failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"userId": userID})
	}
}

// forgotPasswordHandler implements POST /api/auth/forgot-password.
// Generates a single-use reset token, stores SHA-256 hash, always returns 200 (anti-enumeration).
func forgotPasswordHandler(
	db *pgxpool.Pool,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if rateLimiter == nil {
			logger.Error("forgot-password: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxLifecycleBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxLifecycleBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req forgotPasswordRequest
		if err := dec.Decode(&req); err != nil {
			// Anti-enumeration: still return 200.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		if email == "" {
			// Anti-enumeration: still return 200.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
			return
		}

		// Rate limit by IP.
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:forgot:" + peerIP
		ok, err := rateLimiter.Allow(ipKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		ctx := r.Context()

		// Lookup user.
		userID, err := lookupUserIDByEmail(ctx, db, email)
		if err != nil {
			logger.Error("forgot-password: lookup failed", "error", err)
			// Anti-enumeration: still return 200.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
			return
		}
		if userID == "" {
			// Anti-enumeration: burn time and return 200.
			burnTime()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
			return
		}

		// Generate raw token.
		rawToken := make([]byte, rawResetTokenLen)
		if _, err := rand.Read(rawToken); err != nil {
			logger.Error("forgot-password: token generation failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		tokenHex := hex.EncodeToString(rawToken)

		// Hash token for storage.
		h := sha256.Sum256(rawToken)
		tokenHash := hex.EncodeToString(h[:])

		// Store token in DB.
		expiresAt := time.Now().Add(resetTokenTTL)
		if err := storeResetToken(ctx, db, userID, tokenHash, expiresAt); err != nil {
			logger.Error("forgot-password: store token failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// In production, send email with token. For now, log it (TODO: integrate email service).
		logger.Info("forgot-password: token generated", "user_id", userID, "token", tokenHex)

		// Always return 200.
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

// resetPasswordHandler implements POST /api/auth/reset-password.
// Validates token, updates password, revokes sessions.
func resetPasswordHandler(
	db *pgxpool.Pool,
	credStore *credential.Store,
	sessionStore *session.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if rateLimiter == nil {
			logger.Error("reset-password: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxLifecycleBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxLifecycleBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req resetPasswordRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		token := strings.TrimSpace(req.Token)
		password := req.Password

		if token == "" || password == "" {
			writeJSONError(w, "token and password are required", http.StatusBadRequest)
			return
		}
		if len(password) < minPasswordLen {
			writeJSONError(w, fmt.Sprintf("password must be at least %d characters", minPasswordLen), http.StatusBadRequest)
			return
		}
		if len(password) > credential.MaxPasswordLen {
			writeJSONError(w, "password too long", http.StatusBadRequest)
			return
		}

		// Rate limit by IP.
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:reset:" + peerIP
		ok, err := rateLimiter.Allow(ipKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		// Hash the raw token string (SHA-256 of the opaque token value).
		h := sha256.Sum256([]byte(token))
		tokenHash := hex.EncodeToString(h[:])

		ctx := r.Context()

		// Lookup and validate token.
		userID, tokenID, err := lookupResetToken(ctx, db, tokenHash)
		if err != nil {
			logger.Error("reset-password: token lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if userID == "" {
			writeJSONError(w, "invalid or expired token", http.StatusBadRequest)
			return
		}

		// Mark token as used.
		if err := markResetTokenUsed(ctx, db, tokenID); err != nil {
			logger.Error("reset-password: mark token used failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Update password.
		if err := credStore.SetLearnerCredential(ctx, userID, []byte(password)); err != nil {
			logger.Error("reset-password: set credential failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Revoke all sessions for this user.
		if err := sessionStore.RevokeAllLearnerSessions(ctx, userID); err != nil {
			logger.Error("reset-password: revoke sessions failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

// changePasswordHandler implements POST /api/auth/change-password.
// Verifies current password, updates to new password, revokes sessions. Requires session cookie.
func changePasswordHandler(
	db *pgxpool.Pool,
	credStore *credential.Store,
	sessionStore *session.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if rateLimiter == nil {
			logger.Error("change-password: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxLifecycleBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxLifecycleBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req changePasswordRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		currentPassword := req.CurrentPassword
		newPassword := req.NewPassword

		if currentPassword == "" || newPassword == "" {
			writeJSONError(w, "currentPassword and newPassword are required", http.StatusBadRequest)
			return
		}
		if len(newPassword) < minPasswordLen {
			writeJSONError(w, fmt.Sprintf("new password must be at least %d characters", minPasswordLen), http.StatusBadRequest)
			return
		}
		if len(newPassword) > credential.MaxPasswordLen {
			writeJSONError(w, "new password too long", http.StatusBadRequest)
			return
		}

		// Extract session from cookie.
		cookie, err := r.Cookie(learnerCookieName)
		if err != nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := r.Context()

		// Lookup session.
		sess, err := sessionStore.LookupLearnerSession(ctx, cookie.Value)
		if err != nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Verify current password.
		if err := credStore.VerifyLearner(ctx, sess.UserID, []byte(currentPassword)); err != nil {
			if errors.Is(err, credential.ErrMismatch) ||
				errors.Is(err, credential.ErrCredentialNotFound) {
				writeJSONError(w, "current password is incorrect", http.StatusUnauthorized)
				return
			}
			logger.Error("change-password: verify current failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Update password.
		if err := credStore.SetLearnerCredential(ctx, sess.UserID, []byte(newPassword)); err != nil {
			logger.Error("change-password: set credential failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Revoke all sessions.
		if err := sessionStore.RevokeAllLearnerSessions(ctx, sess.UserID); err != nil {
			logger.Error("change-password: revoke sessions failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Clear session cookie.
		http.SetCookie(w, &http.Cookie{
			Name:     learnerCookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

// disableAccountHandler implements POST /api/auth/disable.
// Sets status='disabled', revokes sessions. Requires session cookie.
func disableAccountHandler(
	db *pgxpool.Pool,
	sessionStore *session.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if rateLimiter == nil {
			logger.Error("disable-account: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Extract session from cookie.
		cookie, err := r.Cookie(learnerCookieName)
		if err != nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := r.Context()

		// Lookup session.
		sess, err := sessionStore.LookupLearnerSession(ctx, cookie.Value)
		if err != nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Disable account.
		if err := disableUserProfile(ctx, db, sess.UserID); err != nil {
			logger.Error("disable-account: update status failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Revoke all sessions.
		if err := sessionStore.RevokeAllLearnerSessions(ctx, sess.UserID); err != nil {
			logger.Error("disable-account: revoke sessions failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Clear session cookie.
		http.SetCookie(w, &http.Cookie{
			Name:     learnerCookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

// deleteAccountHandler implements POST /api/auth/delete.
// Hard deletes user, CASCADE removes sessions/credentials. Requires session cookie.
func deleteAccountHandler(
	db *pgxpool.Pool,
	sessionStore *session.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if rateLimiter == nil {
			logger.Error("delete-account: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Extract session from cookie.
		cookie, err := r.Cookie(learnerCookieName)
		if err != nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := r.Context()

		// Lookup session.
		sess, err := sessionStore.LookupLearnerSession(ctx, cookie.Value)
		if err != nil {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Delete user (CASCADE handles sessions/credentials).
		if err := deleteUserProfile(ctx, db, sess.UserID); err != nil {
			logger.Error("delete-account: delete failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Clear session cookie.
		http.SetCookie(w, &http.Cookie{
			Name:     learnerCookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
		})

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

// Helper functions.

func lookupUserIDByEmail(ctx context.Context, db *pgxpool.Pool, email string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id FROM profile.user_profile WHERE email = $1`
	var id string
	err := db.QueryRow(ctx, q, email).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("lookup user by email: %w", err)
	}
	return id, nil
}

func createLearnerProfile(ctx context.Context, tx pgx.Tx, email, displayName string) (string, error) {
	const q = `INSERT INTO profile.user_profile (email, display_name, status, created_at, updated_at) VALUES ($1, $2, 'active', now(), now()) RETURNING id`
	var id string
	err := tx.QueryRow(ctx, q, email, displayName).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create learner profile: %w", err)
	}
	return id, nil
}

func storeResetToken(ctx context.Context, db *pgxpool.Pool, userID, tokenHash string, expiresAt time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `INSERT INTO auth.password_reset_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`
	_, err := db.Exec(ctx, q, userID, tokenHash, expiresAt)
	if err != nil {
		return fmt.Errorf("store reset token: %w", err)
	}
	return nil
}

func lookupResetToken(ctx context.Context, db *pgxpool.Pool, tokenHash string) (userID string, tokenID string, err error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT id, user_id FROM auth.password_reset_token WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`
	err = db.QueryRow(ctx, q, tokenHash).Scan(&tokenID, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", nil
		}
		return "", "", fmt.Errorf("lookup reset token: %w", err)
	}
	return userID, tokenID, nil
}

func markResetTokenUsed(ctx context.Context, db *pgxpool.Pool, tokenID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE auth.password_reset_token SET used_at = now() WHERE id = $1`
	_, err := db.Exec(ctx, q, tokenID)
	if err != nil {
		return fmt.Errorf("mark reset token used: %w", err)
	}
	return nil
}

func disableUserProfile(ctx context.Context, db *pgxpool.Pool, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE profile.user_profile SET status = 'disabled' WHERE id = $1`
	_, err := db.Exec(ctx, q, userID)
	if err != nil {
		return fmt.Errorf("disable user profile: %w", err)
	}
	return nil
}

func deleteUserProfile(ctx context.Context, db *pgxpool.Pool, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `DELETE FROM profile.user_profile WHERE id = $1`
	_, err := db.Exec(ctx, q, userID)
	if err != nil {
		return fmt.Errorf("delete user profile: %w", err)
	}
	return nil
}
