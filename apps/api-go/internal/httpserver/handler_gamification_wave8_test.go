package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/gamification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAudit159Wave8GamificationStoreRoutes(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave 8 learner", fmt.Sprintf("wave8-%s@example.test", userID[:8]), "")

	achievementID, tierID, progressID := newUUID(t), newUUID(t), newUUID(t)
	boardID, eventID, challengeID, petID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO gamification.achievement_definition(id,slug,name_key,description_key,category,metric_key,display_order,enabled,updated_at) VALUES($1,$2,'achievement.wave8.name','achievement.wave8.description','study','reviews',1,true,NOW())`, []any{achievementID, "wave8-" + achievementID}},
		{`INSERT INTO gamification.achievement_tier(id,achievement_id,tier,threshold,name_key) VALUES($1,$2,'bronze',1,'achievement.wave8.bronze')`, []any{tierID, achievementID}},
		{`INSERT INTO gamification.user_achievement(id,user_id,achievement_id,tier_id,current_progress,earned_at,updated_at) VALUES($1,$2,$3,$4,1,NOW(),NOW())`, []any{progressID, userID, achievementID, tierID}},
		{`INSERT INTO gamification.leaderboard_config(id,name,name_key,metric_type,period,max_entries,enabled,updated_at) VALUES($1,'Wave 8','leaderboard.wave8','xp','weekly',10,true,NOW())`, []any{boardID}},
		{`INSERT INTO gamification.leaderboard_entry(leaderboard_id,user_id,rank,score,period_start,period_end) VALUES($1,$2,1,42,CURRENT_DATE,CURRENT_DATE+6)`, []any{boardID, userID}},
		{`INSERT INTO gamification.seasonal_event(id,slug,name_vi,description,start_date,end_date,active) VALUES($1,$2,'Sự kiện Wave 8','Mô tả',CURRENT_DATE-1,CURRENT_DATE+7,true)`, []any{eventID, "wave8-" + eventID}},
		{`INSERT INTO gamification.event_challenge(id,event_id,title,description,challenge_type,target_value,reward_xp,sort_order) VALUES($1,$2,'Học 5 từ',NULL,'reviews',5,10,1)`, []any{challengeID, eventID}},
		{`INSERT INTO gamification.companion_pet(id,user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at) VALUES($1,$2,'Mochi','baby',12,80,'happy',2,NOW(),NOW())`, []any{petID, userID}},
	} {
		if _, err := db.Exec(ctx, q.sql, q.args...); err != nil {
			t.Fatalf("seed Wave 8 fixture: %v", err)
		}
	}
	t.Cleanup(func() {
		for _, cleanup := range []struct {
			query string
			id    string
		}{
			{`DELETE FROM gamification.event_participant WHERE user_id=$1`, userID},
			{`DELETE FROM gamification.pet_costume_inventory WHERE user_id=$1`, userID},
			{`DELETE FROM gamification.companion_pet WHERE id=$1`, petID},
			{`DELETE FROM gamification.seasonal_event WHERE id=$1`, eventID},
			{`DELETE FROM gamification.leaderboard_entry WHERE leaderboard_id=$1`, boardID},
			{`DELETE FROM gamification.leaderboard_config WHERE id=$1`, boardID},
			{`DELETE FROM gamification.user_achievement WHERE id=$1`, progressID},
			{`DELETE FROM gamification.achievement_tier WHERE id=$1`, tierID},
			{`DELETE FROM gamification.achievement_definition WHERE id=$1`, achievementID},
		} {
			if _, err := db.Exec(ctx, cleanup.query, cleanup.id); err != nil {
				t.Errorf("cleanup Wave 8 fixture: %v", err)
			}
		}
	})

	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, GamificationStore: gamification.NewStore(db)})
	token := createLearnerSession(t, sessions, userID)
	paths := []struct{ method, path, body string }{
		{http.MethodGet, "/api/gamification/achievements", ""},
		{http.MethodGet, "/api/gamification/achievements/browse", ""},
		{http.MethodGet, "/api/gamification/achievements/me", ""},
		{http.MethodGet, "/api/gamification/achievements/me/pending", ""},
		{http.MethodPost, "/api/gamification/achievements/me/acknowledge", fmt.Sprintf(`{"ids":[%q]}`, progressID)},
		{http.MethodGet, "/api/gamification/events", ""},
		{http.MethodGet, "/api/gamification/events/" + eventID, ""},
		{http.MethodPost, "/api/gamification/events/" + eventID + "/join", "{}"},
		{http.MethodGet, "/api/gamification/leaderboards", ""},
		{http.MethodGet, "/api/gamification/leaderboards/" + boardID, ""},
		{http.MethodGet, "/api/gamification/leaderboards/" + boardID + "/me", ""},
		{http.MethodGet, "/api/gamification/leaderboards/" + boardID + "/my-rank", ""},
		{http.MethodGet, "/api/gamification/pet", ""},
		{http.MethodGet, "/api/gamification/pet/costumes", ""},
		{http.MethodPost, "/api/gamification/pet/feed", "{}"},
		{http.MethodPost, "/api/gamification/pet/rename", `{"name":"Mochi Updated"}`},
	}
	for _, tc := range paths {
		t.Run(tc.method+" "+strings.TrimPrefix(tc.path, "/api"), func(t *testing.T) {
			if got := gamificationRouteRequest(router, "", tc.method, tc.path, tc.body).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d, want 401", got)
			}
			res := gamificationRouteRequest(router, token, tc.method, tc.path, tc.body)
			if res.Code < 200 || res.Code >= 300 {
				t.Fatalf("authenticated status=%d body=%s", res.Code, res.Body.String())
			}
			if res.Header().Get("Content-Type") != "application/json" {
				t.Fatalf("content type=%q", res.Header().Get("Content-Type"))
			}
			var payload any
			if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
				t.Fatalf("invalid JSON response: %v (%s)", err, res.Body.String())
			}
			switch tc.path {
			case "/api/gamification/events":
				if !strings.Contains(res.Body.String(), eventID) {
					t.Fatalf("active event missing from response: %s", res.Body.String())
				}
			case "/api/gamification/events/" + eventID:
				for _, key := range []string{`"slug"`, `"nameVi"`, `"iconEmoji"`, `"bannerColor"`, `"challenges"`} {
					if !strings.Contains(res.Body.String(), key) {
						t.Errorf("event caller contract missing %s: %s", key, res.Body.String())
					}
				}
			case "/api/gamification/leaderboards/" + boardID:
				if !strings.Contains(res.Body.String(), `"leaderboard"`) || !strings.Contains(res.Body.String(), `"entries"`) {
					t.Fatalf("leaderboard caller contract must contain leaderboard and entries: %s", res.Body.String())
				}
			case "/api/gamification/achievements/me/pending":
				for _, key := range []string{`"id"`, `"tier"`, `"achievement"`} {
					if !strings.Contains(res.Body.String(), key) {
						t.Errorf("pending-achievement caller contract missing %s: %s", key, res.Body.String())
					}
				}
			case "/api/gamification/pet":
				for _, key := range []string{`"stage"`, `"mood"`, `"totalFeedings"`, `"nextStage"`, `"stageProgress"`} {
					if !strings.Contains(res.Body.String(), key) {
						t.Errorf("pet caller contract missing %s: %s", key, res.Body.String())
					}
				}
			}
		})
		if tc.method != http.MethodGet {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
			req.Header.Set("Content-Type", "application/json")
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Errorf("%s without trusted Origin status=%d, want 403: %s", tc.path, res.Code, res.Body.String())
			}
		}
	}
	if got := gamificationRouteRequest(router, token, http.MethodGet, "/api/gamification/leaderboards/not-a-uuid", "").Code; got != http.StatusBadRequest {
		t.Errorf("invalid leaderboard id status=%d, want 400", got)
	}
	if got := gamificationRouteRequest(router, token, http.MethodGet, "/api/gamification/events/not-a-uuid", "").Code; got != http.StatusBadRequest {
		t.Errorf("invalid event id status=%d, want 400", got)
	}
	missingBoardID := newUUID(t)
	for _, path := range []string{"/api/gamification/leaderboards/" + missingBoardID, "/api/gamification/leaderboards/" + missingBoardID + "/me", "/api/gamification/leaderboards/" + missingBoardID + "/my-rank"} {
		if got := gamificationRouteRequest(router, token, http.MethodGet, path, "").Code; got != http.StatusNotFound {
			t.Errorf("missing leaderboard route %s status=%d, want 404", path, got)
		}
	}
	if got := gamificationRouteRequest(router, token, http.MethodPost, "/api/gamification/achievements/me/acknowledge", `{"ids":[]}`).Code; got != http.StatusBadRequest {
		t.Errorf("empty acknowledgement status=%d, want 400", got)
	}

	var joined int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM gamification.event_participant WHERE event_id=$1 AND user_id=$2`, eventID, userID).Scan(&joined); err != nil || joined != 1 {
		t.Fatalf("join must persist once, count=%d err=%v", joined, err)
	}
	if got := gamificationRouteRequest(router, token, http.MethodPost, "/api/gamification/events/"+eventID+"/join", "{}").Code; got != http.StatusOK {
		t.Fatalf("repeat join status=%d, want idempotent 200", got)
	}
	joinedDetail := gamificationRouteRequest(router, token, http.MethodGet, "/api/gamification/events/"+eventID, "")
	if !strings.Contains(joinedDetail.Body.String(), `"joined":true`) || !strings.Contains(joinedDetail.Body.String(), `"participantCount":1`) {
		t.Fatalf("joined event state not reflected: %s", joinedDetail.Body.String())
	}
	var notified bool
	if err := db.QueryRow(ctx, `SELECT notified_at IS NOT NULL FROM gamification.user_achievement WHERE id=$1`, progressID).Scan(&notified); err != nil || !notified {
		t.Fatalf("acknowledgement must persist, notified=%v err=%v", notified, err)
	}
	var petName string
	var feedings int
	if err := db.QueryRow(ctx, `SELECT name,total_feedings FROM gamification.companion_pet WHERE id=$1`, petID).Scan(&petName, &feedings); err != nil || petName != "Mochi Updated" || feedings != 3 {
		t.Fatalf("pet rename/feed must persist, name=%q feedings=%d err=%v", petName, feedings, err)
	}
}

func gamificationRouteRequest(router http.Handler, token, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Origin", "http://localhost:3000")
	if token != "" {
		request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	}
	if method != http.MethodGet {
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-CSRF-Token", "test-csrf")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
