package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestAuthProfileAndRegistrationWave7Contracts(t *testing.T) {
	db := testPool(t)
	router := audit159w6Router(t, db)
	email := fmt.Sprintf("audit159-wave7-%s@example.test", newUUID(t)[:8])
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE email=$1`, email)
	})
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut} {
		if anonymous := audit159w6Request(t, router, method, "/api/auth/profile", `{}`, nil, audit159w6Origin); anonymous.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous %s profile status=%d body=%s", method, anonymous.Code, anonymous.Body.String())
		}
	}
	invalidEmail := audit159w6Request(t, router, http.MethodPost, "/api/auth/register",
		`{"email":"not-an-email","password":"wave7-password-123","username":"Wave Seven"}`, nil, audit159w6Origin)
	if invalidEmail.Code != http.StatusBadRequest {
		t.Fatalf("invalid registration email status=%d body=%s", invalidEmail.Code, invalidEmail.Body.String())
	}

	registerBody := fmt.Sprintf(`{"email":%q,"password":"wave7-password-123","username":"Wave Seven"}`, email)
	var decodedRegister registerRequest
	if err := json.Unmarshal([]byte(registerBody), &decodedRegister); err != nil || decodedRegister.Username != "Wave Seven" {
		t.Fatalf("test fixture does not match frontend registration contract: decoded=%+v err=%v", decodedRegister, err)
	}
	register := audit159w6Request(t, router, http.MethodPost, "/api/auth/register", registerBody, nil, audit159w6Origin)
	if register.Code != http.StatusCreated {
		t.Fatalf("registration with frontend username contract status=%d body=%s", register.Code, register.Body.String())
	}
	var registered struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(register.Body.Bytes(), &registered); err != nil || registered.UserID == "" {
		t.Fatalf("registration response=%s err=%v", register.Body.String(), err)
	}
	duplicate := audit159w6Request(t, router, http.MethodPost, "/api/auth/register",
		fmt.Sprintf(`{"email":%q,"password":"wave7-password-123","username":"Wave Seven"}`, email), nil, audit159w6Origin)
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate registration status=%d body=%s", duplicate.Code, duplicate.Body.String())
	}
	var registrationCookie *http.Cookie
	for _, candidate := range register.Result().Cookies() {
		if candidate.Name == learnerCookieName && candidate.Value != "" && candidate.HttpOnly {
			registrationCookie = candidate
			break
		}
	}
	if registrationCookie == nil {
		t.Fatalf("registration did not set an HttpOnly learner session cookie: %#v", register.Result().Cookies())
	}
	profileFromRegistrationSession := audit159w6Request(t, router, http.MethodGet, "/api/auth/profile", "", registrationCookie, "")
	if profileFromRegistrationSession.Code != http.StatusOK || !strings.Contains(profileFromRegistrationSession.Body.String(), registered.UserID) {
		t.Fatalf("registration session profile status=%d body=%s", profileFromRegistrationSession.Code, profileFromRegistrationSession.Body.String())
	}
	cookie := audit159w6Login(t, router, "/api/auth/login", email, "wave7-password-123", learnerCookieName)

	get := audit159w6Request(t, router, http.MethodGet, "/api/auth/profile", "", cookie, "")
	if get.Code != http.StatusOK || !strings.Contains(get.Body.String(), `"profile"`) {
		t.Fatalf("GET profile status=%d body=%s", get.Code, get.Body.String())
	}
	post := audit159w6Request(t, router, http.MethodPost, "/api/auth/profile", `{}`, cookie, audit159w6Origin)
	if post.Code != http.StatusOK || !strings.Contains(post.Body.String(), `"profile"`) {
		t.Fatalf("POST profile status=%d body=%s", post.Code, post.Body.String())
	}
	if denied := audit159w6Request(t, router, http.MethodPut, "/api/auth/profile", `{"displayName":"Blocked"}`, cookie, "https://untrusted.example.test"); denied.Code != http.StatusForbidden {
		t.Fatalf("PUT profile untrusted origin status=%d body=%s", denied.Code, denied.Body.String())
	}
	if invalid := audit159w6Request(t, router, http.MethodPut, "/api/auth/profile", `{"displayName":" "}`, cookie, audit159w6Origin); invalid.Code != http.StatusBadRequest {
		t.Fatalf("PUT profile invalid displayName status=%d body=%s", invalid.Code, invalid.Body.String())
	}
	if invalid := audit159w6Request(t, router, http.MethodPut, "/api/auth/profile", `{"themeMode":"sepia"}`, cookie, audit159w6Origin); invalid.Code != http.StatusBadRequest {
		t.Fatalf("PUT profile invalid themeMode status=%d body=%s", invalid.Code, invalid.Body.String())
	}
	updated := audit159w6Request(t, router, http.MethodPut, "/api/auth/profile", `{"displayName":"Wave Seven Updated","sharePostcardOptIn":true}`, cookie, audit159w6Origin)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), "Wave Seven Updated") {
		t.Fatalf("PUT profile status=%d body=%s", updated.Code, updated.Body.String())
	}
	var persistedName string
	var persistedConsent bool
	if err := db.QueryRow(context.Background(), `SELECT display_name, share_postcard_opt_in FROM profile.user_profile WHERE id=$1`, registered.UserID).Scan(&persistedName, &persistedConsent); err != nil || persistedName != "Wave Seven Updated" || !persistedConsent {
		t.Fatalf("persisted profile displayName=%q sharePostcardOptIn=%t err=%v", persistedName, persistedConsent, err)
	}

	avatarAssetID := newUUID(t)
	objectKey := "audit159-wave7/" + avatarAssetID + ".png"
	if _, err := db.Exec(context.Background(), `INSERT INTO media.asset (id,owner_user_id,object_key,mime_type,rights_status,status,created_at,updated_at)
		VALUES ($1,$2,$3,'image/png','approved','active',NOW(),NOW())`, avatarAssetID, registered.UserID, objectKey); err != nil {
		t.Fatalf("insert avatar asset fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM media.asset WHERE id=$1`, avatarAssetID) })
	avatar := audit159w6Request(t, router, http.MethodPut, "/api/auth/profile", fmt.Sprintf(`{"avatarAssetId":%q}`, avatarAssetID), cookie, audit159w6Origin)
	if avatar.Code != http.StatusOK {
		t.Fatalf("PUT profile avatar status=%d body=%s", avatar.Code, avatar.Body.String())
	}
	var persistedAvatar *string
	if err := db.QueryRow(context.Background(), `SELECT avatar_asset_id::text FROM profile.user_profile WHERE id=$1`, registered.UserID).Scan(&persistedAvatar); err != nil || persistedAvatar == nil || *persistedAvatar != avatarAssetID {
		t.Fatalf("persisted profile avatarAssetId=%v want=%s err=%v", persistedAvatar, avatarAssetID, err)
	}
	clearedAvatar := audit159w6Request(t, router, http.MethodPut, "/api/auth/profile", `{"avatarAssetId":null}`, cookie, audit159w6Origin)
	if clearedAvatar.Code != http.StatusOK {
		t.Fatalf("PUT profile clear avatar status=%d body=%s", clearedAvatar.Code, clearedAvatar.Body.String())
	}
	if err := db.QueryRow(context.Background(), `SELECT avatar_asset_id::text FROM profile.user_profile WHERE id=$1`, registered.UserID).Scan(&persistedAvatar); err != nil || persistedAvatar != nil {
		t.Fatalf("cleared profile avatarAssetId=%v err=%v", persistedAvatar, err)
	}
}
