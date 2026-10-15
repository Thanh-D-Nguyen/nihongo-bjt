package passwordresetcontract

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestForgotPassword_DoesNotLogResetToken(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("TEST_DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		t.Fatalf("ping test database: %v", err)
	}

	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		t.Fatal(err)
	}
	userID := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", id[0:4], id[4:6], id[6:8], id[8:10], id[10:16])
	email := "reset-contract-" + userID[:8] + "@example.com"
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'Audit learner', $2, 'active', now())`, userID, email); err != nil {
		t.Fatalf("seed learner: %v", err)
	}
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_, _ = db.Exec(cleanup, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})

	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer limiter.Stop()
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	router := httpserver.NewRouter(httpserver.Dependencies{
		Config:          &config.Config{CORSOrigins: []string{"http://localhost"}},
		Logger:          logger,
		DBPool:          db,
		ProfileStore:    profile.NewStore(db),
		CredentialStore: credential.NewStore(db),
		SessionStore:    session.NewStore(db),
		RateLimiter:     limiter,
	})
	body, _ := json.Marshal(map[string]string{"email": email})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/forgot-password", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)

	if strings.Contains(logs.String(), `"token"`) {
		t.Fatal("recovery logs must not contain a bearer token")
	}
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured recovery delivery must fail closed, got %d", response.Code)
	}
	if strings.Contains(response.Body.String(), `"token"`) {
		t.Fatal("reset token must not be exposed in an HTTP response")
	}
}
