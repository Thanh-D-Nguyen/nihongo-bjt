package httpserver

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"
)

var errInvalidAppleToken = errors.New("invalid Apple identity token")

type appleIdentity struct {
	Subject  string
	Email    string
	Verified bool
}

type appleTokenVerifier func(context.Context, string, []string, string) (appleIdentity, error)

type appleJWTVerifier struct {
	url       string
	client    *http.Client
	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time
}

func newAppleJWTVerifier(url string, client *http.Client) *appleJWTVerifier {
	return &appleJWTVerifier{url: url, client: client}
}

func (v *appleJWTVerifier) signingKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if key := v.keys[kid]; key != nil && time.Since(v.lastFetch) < time.Hour {
		return key, nil
	}
	// Do not let attacker-selected unknown key IDs trigger unbounded requests to Apple.
	if !v.lastFetch.IsZero() && time.Since(v.lastFetch) < time.Minute {
		return nil, errInvalidAppleToken
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.url, nil)
	if err != nil {
		return nil, err
	}
	res, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, errInvalidAppleToken
	}
	// A local struct with explicit JSON names prevents silent field mismatch.
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err = json.NewDecoder(io.LimitReader(res.Body, 128*1024)).Decode(&jwks); err != nil {
		return nil, err
	}
	keys := make(map[string]*rsa.PublicKey)
	for _, item := range jwks.Keys {
		if item.Kid == "" || item.Kty != "RSA" || item.Alg != "RS256" || item.Use != "sig" {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(item.N)
		exponent, errE := base64.RawURLEncoding.DecodeString(item.E)
		if errN != nil || errE != nil || len(n) < 256 || len(n) > 1024 || len(exponent) < 1 || len(exponent) > 4 {
			continue
		}
		e := new(big.Int).SetBytes(exponent)
		if !e.IsInt64() || e.Int64() < 3 || e.Int64() > 2147483647 || e.Int64()%2 == 0 {
			continue
		}
		keys[item.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(e.Int64())}
	}
	v.keys = keys
	v.lastFetch = time.Now()
	key := keys[kid]
	if key == nil {
		return nil, errInvalidAppleToken
	}
	return key, nil
}

// Verify trusts only Apple's pinned JWKS endpoint; the JWT header never selects a URL or algorithm.
func (v *appleJWTVerifier) Verify(ctx context.Context, idToken string, audienceIDs []string, rawNonce string) (appleIdentity, error) {
	invalid := appleIdentity{}
	if len(idToken) == 0 || len(idToken) > 4000 || len(rawNonce) < 8 || len(rawNonce) > 256 {
		return invalid, errInvalidAppleToken
	}
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return invalid, errInvalidAppleToken
	}
	headerData, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return invalid, errInvalidAppleToken
	}
	var header struct {
		Alg string `json:"alg"`
		KID string `json:"kid"`
	}
	if len(headerData) > 1024 || json.Unmarshal(headerData, &header) != nil || header.Alg != "RS256" || len(header.KID) > 128 || header.KID == "" {
		return invalid, errInvalidAppleToken
	}
	key, err := v.signingKey(ctx, header.KID)
	if err != nil {
		return invalid, err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return invalid, errInvalidAppleToken
	}
	hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], signature) != nil {
		return invalid, errInvalidAppleToken
	}
	payloadData, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return invalid, errInvalidAppleToken
	}
	var claims struct {
		Issuer        string          `json:"iss"`
		Audience      string          `json:"aud"`
		Subject       string          `json:"sub"`
		Email         string          `json:"email"`
		EmailVerified json.RawMessage `json:"email_verified"`
		Nonce         string          `json:"nonce"`
		IssuedAt      int64           `json:"iat"`
		Expires       int64           `json:"exp"`
	}
	if len(payloadData) > 8192 || json.Unmarshal(payloadData, &claims) != nil {
		return invalid, errInvalidAppleToken
	}
	audienceOK := false
	for _, aud := range audienceIDs {
		if aud != "" && claims.Audience == aud {
			audienceOK = true
			break
		}
	}
	expectedNonce := sha256.Sum256([]byte(rawNonce))
	actualNonce := fmt.Sprintf("%x", expectedNonce)
	now := time.Now().Unix()
	if claims.Issuer != "https://appleid.apple.com" || !audienceOK || claims.Subject == "" || len(claims.Subject) > 255 ||
		subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(actualNonce)) != 1 ||
		claims.IssuedAt > now+60 || claims.IssuedAt < now-600 || claims.Expires <= now || claims.Expires <= claims.IssuedAt {
		return invalid, errInvalidAppleToken
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	if email != "" {
		parsed, mailErr := mail.ParseAddress(email)
		verified := string(claims.EmailVerified) == `"true"` || string(claims.EmailVerified) == `true`
		if mailErr != nil || parsed.Address != email || len(email) > 255 || !verified {
			return invalid, errInvalidAppleToken
		}
	}
	return appleIdentity{Subject: claims.Subject, Email: email, Verified: true}, nil
}
