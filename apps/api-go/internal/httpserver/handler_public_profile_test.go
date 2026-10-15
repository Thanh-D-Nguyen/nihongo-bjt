package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func seedPublicProfileUser(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	_, err := db.Exec(context.Background(), `INSERT INTO profile.user_profile
		(id, display_name, email, keycloak_subject, status, updated_at)
		VALUES ($1, 'Visible Learner', $2, $3, 'active', now())`,
		userID, fmt.Sprintf("public-profile-%s@example.test", userID[:8]), "private-auth-subject")
	if err != nil {
		t.Fatalf("seed public profile: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id=$1`, userID); err != nil {
			t.Errorf("delete public profile fixture: %v", err)
		}
	})
}

func TestPublicProfilePrivacyAndIdentity(t *testing.T) {
	db := testPool(t)
	targetID, friendID, strangerID, blockedID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedActiveUser(t, db, targetID, "Private Target", "public-target-"+targetID[:8]+"@example.test", "target-auth-subject")
	seedActiveUser(t, db, friendID, "Profile Friend", "public-friend-"+friendID[:8]+"@example.test", "friend-auth-subject")
	seedActiveUser(t, db, strangerID, "Profile Stranger", "public-stranger-"+strangerID[:8]+"@example.test", "stranger-auth-subject")
	seedActiveUser(t, db, blockedID, "Blocked Profile Viewer", "public-blocked-"+blockedID[:8]+"@example.test", "blocked-auth-subject")
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET privacy_level='private', target_bjt_band='J2', learning_purpose='career' WHERE id=$1`, targetID); err != nil {
		t.Fatalf("set private profile: %v", err)
	}
	pairKey := "audit-public-profile-" + targetID[:8] + friendID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.user_social_connection
		(pair_key, requester_user_id, addressee_user_id, status) VALUES ($1,$2,$3,'accepted')`, pairKey, friendID, targetID); err != nil {
		t.Fatalf("seed accepted relationship: %v", err)
	}
	blockedKey := "audit-public-blocked-" + targetID[:8] + blockedID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.user_social_connection
		(pair_key, requester_user_id, addressee_user_id, status, blocked_by_user_id) VALUES ($1,$2,$3,'blocked',$2)`, blockedKey, blockedID, targetID); err != nil {
		t.Fatalf("seed blocked relationship: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.user_social_connection WHERE pair_key IN ($1,$2)`, pairKey, blockedKey)
	})

	sessionStore := session.NewStore(db)
	limiter := levelTestRateLimiter(t)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config: &config.Config{}, Logger: testLogger(), DBPool: db, ProfileStore: profile.NewStore(db), SessionStore: sessionStore,
	}, limiter))
	request := func(viewer string) map[string]any {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+targetID+"/profile", nil)
		if viewer != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, sessionStore, viewer)})
		}
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		if response.Code != http.StatusOK {
			t.Fatalf("expected profile 200 for viewer %q, got %d: %s", viewer, response.Code, response.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode profile: %v", err)
		}
		return body
	}
	for _, tc := range []struct {
		name, viewer, relationship string
		visible                    bool
	}{
		{"anonymous private", "", "", false},
		{"self", targetID, "self", true},
		{"friend", friendID, "friend", true},
		{"stranger", strangerID, "stranger", false},
		{"blocked", blockedID, "blocked", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := request(tc.viewer)
			if tc.relationship == "" {
				if body["relationship"] != nil {
					t.Errorf("anonymous relationship must be null, got %v", body["relationship"])
				}
			} else if body["relationship"] != tc.relationship {
				t.Errorf("expected relationship %q, got %v", tc.relationship, body["relationship"])
			}
			if got := body["stats"] != nil; got != tc.visible {
				t.Errorf("stats visibility=%t, want %t", got, tc.visible)
			}
			if got := body["targetBjtBand"] != nil; got != tc.visible {
				t.Errorf("target band visibility=%t, want %t", got, tc.visible)
			}
			if !tc.visible && body["learningPurpose"] != nil {
				t.Errorf("private learning purpose leaked: %v", body["learningPurpose"])
			}
			if !tc.visible && body["achievements"] != nil {
				t.Errorf("private achievements leaked: %v", body["achievements"])
			}
		})
	}
	invalid := httptest.NewRecorder()
	router.ServeHTTP(invalid, httptest.NewRequest(http.MethodGet, "/api/users/not-a-uuid/profile", nil))
	if invalid.Code != http.StatusBadRequest || !strings.Contains(invalid.Body.String(), "valid UUID") {
		t.Errorf("invalid user ID must return 400, got %d: %s", invalid.Code, invalid.Body.String())
	}
	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/users/"+newUUID(t)+"/profile", nil))
	if missing.Code != http.StatusNotFound {
		t.Errorf("unknown user must return 404, got %d: %s", missing.Code, missing.Body.String())
	}
	inactiveID := newUUID(t)
	seedActiveUser(t, db, inactiveID, "Inactive Profile", "public-inactive-"+inactiveID[:8]+"@example.test", "inactive-auth-subject")
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET status='disabled' WHERE id=$1`, inactiveID); err != nil {
		t.Fatalf("disable profile fixture: %v", err)
	}
	inactive := httptest.NewRecorder()
	router.ServeHTTP(inactive, httptest.NewRequest(http.MethodGet, "/api/users/"+inactiveID+"/profile", nil))
	if inactive.Code != http.StatusNotFound {
		t.Errorf("inactive user must return 404, got %d: %s", inactive.Code, inactive.Body.String())
	}
}

func TestPublicProfileRouteReturnsAllowlistedProfile(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedPublicProfileUser(t, db, userID)
	limiter := levelTestRateLimiter(t)
	deps := withLevelReadLimiter(Dependencies{
		Config: &config.Config{}, Logger: testLogger(), DBPool: db, ProfileStore: profile.NewStore(db),
	}, limiter)
	router := NewRouter(deps)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/users/"+userID+"/profile", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected public profile 200, got %d: %s", response.Code, response.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	for _, key := range []string{"id", "displayName", "avatarUrl", "coverUrl", "targetBjtBand", "learningPurpose", "privacyLevel", "memberSince", "online", "lastSeenAt", "relationship", "stats", "achievements"} {
		if _, ok := body[key]; !ok {
			t.Errorf("missing public profile field %q", key)
		}
	}
	if body["id"] != userID || body["displayName"] != "Visible Learner" {
		t.Errorf("profile identity did not match fixture: id=%v displayName=%v", body["id"], body["displayName"])
	}
	if body["relationship"] != nil || body["stats"] == nil || body["achievements"] == nil {
		t.Errorf("anonymous standard profile should expose stats with a null relationship: %+v", body)
	}
	for _, key := range []string{"email", "keycloakSubject", "authSyncStatus"} {
		if _, ok := body[key]; ok {
			t.Errorf("private auth field %q leaked", key)
		}
	}
}
