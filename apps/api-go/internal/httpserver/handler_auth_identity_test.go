package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestLearnerIdentitiesAreSessionScopedAndCSRFProtected(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
	})
	userID, otherUserID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Identity Owner", fmt.Sprintf("identity-%s@example.com", userID[:8]), "")
	seedActiveUser(t, db, otherUserID, "Other Owner", fmt.Sprintf("identity-%s@example.com", otherUserID[:8]), "")
	ownID, otherID := uuid.NewString(), uuid.NewString()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, row := range []struct{ id, user, provider, subject string }{
		{ownID, userID, "google", "subject-owner"},
		{otherID, otherUserID, "google", "subject-other"},
	} {
		if _, err := db.Exec(ctx, `INSERT INTO auth.identity_provider_account (id,user_id,provider,provider_subject,email_at_link) VALUES ($1,$2,$3,$4,$5)`, row.id, row.user, row.provider, row.subject, row.subject+"@example.com"); err != nil {
			t.Fatalf("seed identity: %v", err)
		}
	}
	rawToken := createLearnerSession(t, sessions, userID)

	request := httptest.NewRequest(http.MethodGet, "/api/auth/identities?userId="+otherUserID, nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous list status=%d, want 401", response.Code)
	}

	request = httptest.NewRequest(http.MethodGet, "/api/auth/identities?userId="+otherUserID, nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s, want 200", response.Code, response.Body.String())
	}
	var rows []struct {
		ID          string  `json:"id"`
		Provider    string  `json:"provider"`
		EmailAtLink *string `json:"emailAtLink"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &rows); err != nil {
		t.Fatalf("decode identities: %v", err)
	}
	if len(rows) != 1 || rows[0].ID != ownID || rows[0].Provider != "google" || rows[0].EmailAtLink == nil {
		t.Fatalf("list included wrong identities or contract: %+v", rows)
	}

	request = httptest.NewRequest(http.MethodDelete, "/api/auth/identities/"+otherID+"?userId="+userID, nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("X-CSRF-Token", "test-csrf")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("cross-user delete status=%d, want 404", response.Code)
	}

	request = httptest.NewRequest(http.MethodDelete, "/api/auth/identities/"+ownID, nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("delete without CSRF status=%d, want 403", response.Code)
	}

	request = httptest.NewRequest(http.MethodDelete, "/api/auth/identities/"+ownID+"?userId="+otherUserID, nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("X-CSRF-Token", "test-csrf")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("owner delete status=%d body=%s, want 204", response.Code, response.Body.String())
	}
	var ownCount, otherCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM auth.identity_provider_account WHERE user_id=$1`, userID).Scan(&ownCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM auth.identity_provider_account WHERE id=$1`, otherID).Scan(&otherCount); err != nil {
		t.Fatal(err)
	}
	if ownCount != 0 || otherCount != 1 {
		t.Fatalf("delete persistence own=%d other=%d, want 0 and 1", ownCount, otherCount)
	}
}
