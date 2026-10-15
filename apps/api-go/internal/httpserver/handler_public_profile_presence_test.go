package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/realtime"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"github.com/redis/go-redis/v9"
)

// Presence is activity data: it must not reach viewers that the profile's
// privacy settings already withhold stats and goals from.
func TestPublicProfilePresenceFollowsPrivacy(t *testing.T) {
	db := testPool(t)
	redisURL := os.Getenv("TEST_REDIS_URL")
	if redisURL == "" {
		t.Skip("TEST_REDIS_URL not set; skipping Redis integration test")
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse TEST_REDIS_URL: %v", err)
	}
	redisClient := redis.NewClient(options)
	t.Cleanup(func() { _ = redisClient.Close() })
	presence := realtime.NewPresenceService(redisClient)

	targetID, friendID, strangerID, blockedID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	for id, label := range map[string]string{targetID: "Presence Target", friendID: "Presence Friend", strangerID: "Presence Stranger", blockedID: "Presence Blocked"} {
		seedActiveUser(t, db, id, label, "presence-privacy-"+id[:8]+"@example.test", "presence-auth-"+id[:8])
	}
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET privacy_level='private' WHERE id=$1`, targetID); err != nil {
		t.Fatalf("set private profile: %v", err)
	}
	friendKey, blockedKey := "presence-friend-"+targetID[:8]+friendID[:8], "presence-blocked-"+targetID[:8]+blockedID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.user_social_connection
		(pair_key, requester_user_id, addressee_user_id, status) VALUES ($1,$2,$3,'accepted')`, friendKey, friendID, targetID); err != nil {
		t.Fatalf("seed friend: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.user_social_connection
		(pair_key, requester_user_id, addressee_user_id, status, blocked_by_user_id) VALUES ($1,$2,$3,'blocked',$2)`, blockedKey, blockedID, targetID); err != nil {
		t.Fatalf("seed blocked: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.user_social_connection WHERE pair_key IN ($1,$2)`, friendKey, blockedKey)
		_, _ = redisClient.HDel(context.Background(), "presence:online", targetID).Result()
		_, _ = redisClient.HDel(context.Background(), "presence:last_seen", targetID).Result()
	})
	if err := presence.SetOnline(context.Background(), targetID); err != nil {
		t.Fatalf("mark target online: %v", err)
	}

	sessions := session.NewStore(db)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config: &config.Config{}, Logger: testLogger(), DBPool: db, ProfileStore: profile.NewStore(db),
		SessionStore: sessions, PresenceService: presence,
	}, levelTestRateLimiter(t)))
	fetch := func(viewer string) map[string]any {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/users/"+targetID+"/profile", nil)
		if viewer != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, sessions, viewer)})
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("viewer %q: status %d: %s", viewer, rec.Code, rec.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return body
	}
	for _, tc := range []struct {
		name, viewer string
		visible      bool
	}{
		{"anonymous", "", false},
		{"stranger", strangerID, false},
		{"blocked", blockedID, false},
		{"friend", friendID, true},
		{"self", targetID, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := fetch(tc.viewer)
			online, _ := body["online"].(bool)
			if online != tc.visible {
				t.Errorf("online=%v, want %v", online, tc.visible)
			}
			if got := body["lastSeenAt"] != nil; got && !tc.visible {
				t.Errorf("lastSeenAt leaked to %s: %v", tc.name, body["lastSeenAt"])
			}
		})
	}
}
