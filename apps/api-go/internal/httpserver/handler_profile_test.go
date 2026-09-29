package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"time"

	"log/slog"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// seedFullProfileUser creates a user with all M5 profile fields populated for testing.
// Seeds a media.asset row first so cover_asset_id FK is satisfied.
func seedFullProfileUser(t *testing.T, db *pgxpool.Pool, userID, email string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	coverAssetID := "00000000-0000-0000-0000-000000000001"
	_, err := db.Exec(ctx,
		`INSERT INTO media.asset (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, coverAssetID)
	if err != nil {
		t.Fatalf("seed media asset failed: %v", err)
	}
	_, err = db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, theme_mode,
			font_size_preference, density_preference, flashcard_style_slug,
			cover_asset_id, ads_personalization_opt_in, share_postcard_opt_in)
		 VALUES ($1, 'Test Learner', $2, 'active', 'dark', 'medium', 'comfortable', 'minimal',
			$3, true, false)
		 ON CONFLICT (id) DO UPDATE SET display_name='Test Learner', email=$2, status='active',
			theme_mode='dark', font_size_preference='medium', density_preference='comfortable',
			flashcard_style_slug='minimal', cover_asset_id=$3,
			ads_personalization_opt_in=true, share_postcard_opt_in=false`,
		userID, email, coverAssetID)
	if err != nil {
		t.Fatalf("seed full profile user failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
}

func TestLearnerGetMe_Success(t *testing.T) {
	db := testPool(t)
	profileStore := profile.NewStore(db)
	sessStore := session.NewStore(db)
	logger := slog.Default()

	userID := newUUID(t)
	email := fmt.Sprintf("getme-%s@example.com", userID[:8])
	seedFullProfileUser(t, db, userID, email)
	rawToken := createLearnerSession(t, sessStore, userID)

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       logger,
		SessionStore: sessStore,
		ProfileStore: profileStore,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}

	// Verify flat shape — no wrapper object.
	requiredFields := []string{"id", "email", "displayName", "status", "themeMode",
		"fontSizePreference", "densityPreference", "flashcardStyleSlug",
		"coverAssetId", "adsPersonalizationOptIn", "sharePostcardOptIn",
		"createdAt", "updatedAt"}
	for _, f := range requiredFields {
		if _, ok := resp[f]; !ok {
			t.Errorf("missing required field %q in response", f)
		}
	}

	if resp["id"] != userID {
		t.Errorf("expected id=%s, got %v", userID, resp["id"])
	}
	if resp["email"] != email {
		t.Errorf("expected email=%s, got %v", email, resp["email"])
	}
	if resp["displayName"] != "Test Learner" {
		t.Errorf("expected displayName=Test Learner, got %v", resp["displayName"])
	}
	if resp["themeMode"] != "dark" {
		t.Errorf("expected themeMode=dark, got %v", resp["themeMode"])
	}
}

func TestLearnerGetMe_Unauthorized(t *testing.T) {
	db := testPool(t)
	profileStore := profile.NewStore(db)
	sessStore := session.NewStore(db)
	logger := slog.Default()

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       logger,
		SessionStore: sessStore,
		ProfileStore: profileStore,
	})

	// No session cookie.
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLearnerUpdateMe_Success(t *testing.T) {
	db := testPool(t)
	profileStore := profile.NewStore(db)
	sessStore := session.NewStore(db)
	logger := slog.Default()

	userID := newUUID(t)
	email := fmt.Sprintf("upd-%s@example.com", userID[:8])
	seedFullProfileUser(t, db, userID, email)
	rawToken := createLearnerSession(t, sessStore, userID)

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       logger,
		SessionStore: sessStore,
		ProfileStore: profileStore,
	})

	body := `{"displayName":"Updated Name","themeMode":"light"}`
	req := httptest.NewRequest(http.MethodPut, "/api/auth/me", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf") // CSRF guard checks origin+token presence
	req.Header.Set("Origin", "http://localhost:3000")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["displayName"] != "Updated Name" {
		t.Errorf("expected displayName=Updated Name, got %v", resp["displayName"])
	}
	if resp["themeMode"] != "light" {
		t.Errorf("expected themeMode=light, got %v", resp["themeMode"])
	}
}

func TestLearnerUpdateMe_PartialUpdate(t *testing.T) {
	db := testPool(t)
	profileStore := profile.NewStore(db)
	sessStore := session.NewStore(db)
	logger := slog.Default()

	userID := newUUID(t)
	email := fmt.Sprintf("partial-%s@example.com", userID[:8])
	seedFullProfileUser(t, db, userID, email)
	rawToken := createLearnerSession(t, sessStore, userID)

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       logger,
		SessionStore: sessStore,
		ProfileStore: profileStore,
	})

	// Update only fontSizePreference; everything else should remain unchanged.
	body := `{"fontSizePreference":"large"}`
	req := httptest.NewRequest(http.MethodPut, "/api/auth/me", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["fontSizePreference"] != "large" {
		t.Errorf("expected fontSizePreference=large, got %v", resp["fontSizePreference"])
	}
	// Unchanged fields must retain their seeded values.
	if resp["displayName"] != "Test Learner" {
		t.Errorf("expected displayName unchanged (Test Learner), got %v", resp["displayName"])
	}
	if resp["themeMode"] != "dark" {
		t.Errorf("expected themeMode unchanged (dark), got %v", resp["themeMode"])
	}
}

func TestLearnerUpdateMe_ImmutableFieldsIgnored(t *testing.T) {
	db := testPool(t)
	profileStore := profile.NewStore(db)
	sessStore := session.NewStore(db)
	logger := slog.Default()

	userID := newUUID(t)
	email := fmt.Sprintf("immutable-%s@example.com", userID[:8])
	seedFullProfileUser(t, db, userID, email)
	rawToken := createLearnerSession(t, sessStore, userID)

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       logger,
		SessionStore: sessStore,
		ProfileStore: profileStore,
	})

	// Send immutable fields (email, status) along with a mutable one.
	body := `{"email":"hacked@evil.com","status":"disabled","displayName":"Still Me"}`
	req := httptest.NewRequest(http.MethodPut, "/api/auth/me", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}

	// Immutable fields must NOT have changed.
	if resp["email"] != email {
		t.Errorf("email should be immutable: expected %s, got %v", email, resp["email"])
	}
	if resp["status"] != "active" {
		t.Errorf("status should be immutable: expected active, got %v", resp["status"])
	}
	// Mutable field should have updated.
	if resp["displayName"] != "Still Me" {
		t.Errorf("expected displayName=Still Me, got %v", resp["displayName"])
	}
}

func TestLearnerUpdateMe_Unauthorized(t *testing.T) {
	db := testPool(t)
	profileStore := profile.NewStore(db)
	sessStore := session.NewStore(db)
	logger := slog.Default()

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       logger,
		SessionStore: sessStore,
		ProfileStore: profileStore,
	})

	body := `{"displayName":"No Session"}`
	req := httptest.NewRequest(http.MethodPut, "/api/auth/me", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	// No session cookie.
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rr.Code, rr.Body.String())
	}
}

// Ensure unused imports don't cause build failures.
var (
	_ = authn.GetLearnerIdentity
	_ = (*profile.Store)(nil)
)
