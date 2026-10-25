package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"google.golang.org/api/idtoken"
)

func googleVerifier(email, subject string, verified bool) googleTokenVerifier {
	return func(_ context.Context, token, audience string) (*idtoken.Payload, error) {
		if token != "signed-google-token" || audience != "web-client-id.apps.googleusercontent.com" {
			return nil, errors.New("bad token")
		}
		return &idtoken.Payload{Subject: subject, Audience: audience, Issuer: "https://accounts.google.com", Expires: time.Now().Add(time.Minute).Unix(), Claims: map[string]interface{}{"email": email, "email_verified": verified, "name": "Google Learner"}}, nil
	}
}

func googleRequest(handler http.Handler, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}

func TestGoogleLoginRejectsMalformedAndUnverifiedTokens(t *testing.T) {
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer limiter.Stop()
	for _, tc := range []struct {
		body     string
		email    string
		verified bool
		code     int
	}{
		{`{"idToken":""}`, "valid@example.com", true, 400},
		{`{"idToken":"signed-google-token","unexpected":true}`, "valid@example.com", true, 400},
		{`{"idToken":"signed-google-token"}`, "valid@example.com", false, 401},
		{`{"idToken":"signed-google-token"}`, "", true, 401},
	} {
		handler := googleLoginHandler(nil, nil, limiter, testLogger(), false, "web-client-id.apps.googleusercontent.com", googleVerifier(tc.email, "google-123", tc.verified))
		res := googleRequest(handler, tc.body)
		if res.Code != tc.code {
			t.Errorf("body=%s email=%q verified=%v: got %d expected %d (%s)", tc.body, tc.email, tc.verified, res.Code, tc.code, res.Body.String())
		}
	}
}

func TestGoogleLoginCreatesIdentityAndReusesIt(t *testing.T) {
	db := testPool(t)
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer limiter.Stop()
	email := fmt.Sprintf("google-%s@example.test", newUUID(t))
	subject := "google-" + newUUID(t)
	handler := googleLoginHandler(db, session.NewStore(db), limiter, testLogger(), true, "web-client-id.apps.googleusercontent.com", googleVerifier(email, subject, true))
	for i := 0; i < 2; i++ {
		res := googleRequest(handler, `{"idToken":"signed-google-token"}`)
		if res.Code != http.StatusOK {
			t.Fatalf("login %d: %d %s", i, res.Code, res.Body.String())
		}
		var out struct {
			OK    bool   `json:"ok"`
			Token string `json:"token"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil || !out.OK || out.Token == "" {
			t.Fatalf("invalid response: %v %s", err, res.Body.String())
		}
		cookies := res.Result().Cookies()
		if len(cookies) == 0 || cookies[0].Name != learnerCookieName || !cookies[0].HttpOnly || !cookies[0].Secure {
			t.Fatalf("missing secure learner cookie: %v", cookies)
		}
	}
	var n int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM auth.identity_provider_account WHERE provider='google' AND provider_subject=$1`, subject).Scan(&n); err != nil || n != 1 {
		t.Fatalf("expected single identity, count=%d err=%v", n, err)
	}
	_, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE email=$1`, email)
}

func TestGoogleLoginNeverAutoLinksAnExistingPasswordAccount(t *testing.T) {
	db := testPool(t)
	id := newUUID(t)
	email := fmt.Sprintf("google-conflict-%s@example.test", id)
	seedActiveUser(t, db, id, "Password Learner", email, "")
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer limiter.Stop()
	handler := googleLoginHandler(db, session.NewStore(db), limiter, testLogger(), true, "web-client-id.apps.googleusercontent.com", googleVerifier(email, "new-google-subject", true))
	res := googleRequest(handler, `{"idToken":"signed-google-token"}`)
	if res.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", res.Code, res.Body.String())
	}
	if res.Header().Get("Set-Cookie") != "" {
		t.Fatal("unexpected session cookie on conflict")
	}
}
