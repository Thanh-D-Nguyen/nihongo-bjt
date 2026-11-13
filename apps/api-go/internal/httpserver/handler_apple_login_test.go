package httpserver

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/authn"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/session"
)

func TestAppleJWTVerifierRejectsTamperingNonceAndWrongAudience(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	encode := base64.RawURLEncoding.EncodeToString
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]any{"kid": "test", "kty": "RSA", "alg": "RS256", "use": "sig", "n": encode(key.N.Bytes()), "e": "AQAB"}}})
	}))
	defer keys.Close()
	verifier := newAppleJWTVerifier(keys.URL, keys.Client())
	nonce := "cryptographically-random-challenge"
	nonceHash := sha256.Sum256([]byte(nonce))
	sign := func(aud, nonceClaim string, expired, withEmail bool, verified string) string {
		header, _ := json.Marshal(map[string]any{"alg": "RS256", "kid": "test"})
		now := time.Now()
		exp := now.Add(time.Minute).Unix()
		if expired {
			exp = now.Add(-time.Minute).Unix()
		}
		claims := map[string]any{"iss": "https://appleid.apple.com", "aud": aud, "sub": "apple-123", "nonce": nonceClaim, "iat": now.Unix(), "exp": exp}
		if withEmail {
			claims["email"] = "private@privaterelay.appleid.com"
			claims["email_verified"] = verified
		}
		payload, _ := json.Marshal(claims)
		signed := encode(header) + "." + encode(payload)
		hash := sha256.Sum256([]byte(signed))
		signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
		if err != nil {
			t.Fatal(err)
		}
		return signed + "." + encode(signature)
	}
	valid := sign("com.ds.FlashcardApp", fmt.Sprintf("%x", nonceHash), false, true, "true")
	claims, err := verifier.Verify(context.Background(), valid, []string{"com.ds.FlashcardApp"}, nonce)
	if err != nil || claims.Subject != "apple-123" || claims.Email == "" {
		t.Fatalf("valid jwt: %+v %v", claims, err)
	}
	withoutEmail := sign("com.ds.FlashcardApp", fmt.Sprintf("%x", nonceHash), false, false, "")
	claims, err = verifier.Verify(context.Background(), withoutEmail, []string{"com.ds.FlashcardApp"}, nonce)
	if err != nil || claims.Subject != "apple-123" || claims.Email != "" || !claims.Verified {
		t.Fatalf("previously linked Apple ID must work without an email claim: %+v %v", claims, err)
	}
	for name, tc := range map[string]struct{ token, nonce string }{
		"wrong nonce":        {valid, "different"},
		"wrong audience":     {sign("attacker.bundle", fmt.Sprintf("%x", nonceHash), false, true, "true"), nonce},
		"expired":            {sign("com.ds.FlashcardApp", fmt.Sprintf("%x", nonceHash), true, true, "true"), nonce},
		"tampered signature": {valid[:len(valid)-4] + "AAAA", nonce},
		"unverified email":   {sign("com.ds.FlashcardApp", fmt.Sprintf("%x", nonceHash), false, true, "false"), nonce},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := verifier.Verify(context.Background(), tc.token, []string{"com.ds.FlashcardApp"}, tc.nonce); err == nil {
				t.Fatal("accepted invalid JWT")
			}
		})
	}
}

func TestAppleLoginInputAndAccountCollision(t *testing.T) {
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer limiter.Stop()
	valid := func(_ context.Context, token string, audiences []string, nonce string) (appleIdentity, error) {
		return appleIdentity{Subject: "apple-subject", Email: "learner@example.com", Verified: true}, nil
	}
	handler := appleLoginHandler(nil, nil, limiter, testLogger(), false, []string{"com.ds.FlashcardApp"}, valid)
	for _, tc := range []struct {
		body string
		want int
	}{
		{`{"idToken":"x","nonce":""}`, 400},
		{`{"idToken":"x","nonce":"nonce","unknown":1}`, 400},
		{`{"idToken":"x","nonce":"testnonce"}`, 503},
	} {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/apple", strings.NewReader(tc.body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != tc.want {
			t.Errorf("status=%d want=%d body=%s", res.Code, tc.want, res.Body.String())
		}
	}
	db := testPool(t)
	existing := newUUID(t)
	seedActiveUser(t, db, existing, "Local Learner", "learner@example.com", "")
	handler = appleLoginHandler(db, session.NewStore(db), limiter, testLogger(), false, []string{"com.ds.FlashcardApp"}, valid)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/apple", strings.NewReader(`{"idToken":"x","nonce":"testnonce"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != 409 {
		t.Fatalf("email collision should not link: %d %s", res.Code, res.Body.String())
	}
	appleSubject := "apple-" + newUUID(t)
	email := "apple-" + newUUID(t) + "@example.com"
	id, status, err := socialLearnerIdentity(context.Background(), db, "apple", appleSubject, email, "Apple Learner")
	if err != nil || id == "" || status != "active" {
		t.Fatalf("create Apple identity: id=%q status=%q err=%v", id, status, err)
	}
	repeatID, repeatStatus, err := socialLearnerIdentity(context.Background(), db, "apple", appleSubject, "", "")
	if err != nil || repeatID != id || repeatStatus != "active" {
		t.Fatalf("existing Apple ID without email: id=%q status=%q err=%v", repeatID, repeatStatus, err)
	}
	_, _, err = socialLearnerIdentity(context.Background(), db, "apple", appleSubject+"-unknown", "", "")
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("new Apple ID without email must not create account: %v", err)
	}
}

func TestAppleLoginWithoutEmailReachesLinkedAccountLookup(t *testing.T) {
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer limiter.Stop()
	verify := func(_ context.Context, token string, audiences []string, nonce string) (appleIdentity, error) {
		return appleIdentity{Subject: "apple-subject", Verified: true}, nil
	}
	handler := appleLoginHandler(nil, nil, limiter, testLogger(), false, []string{"com.ds.FlashcardApp"}, verify)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/apple", strings.NewReader(`{"idToken":"x","nonce":"testnonce"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("verified token without email must reach account lookup: %d %s", res.Code, res.Body.String())
	}
}
