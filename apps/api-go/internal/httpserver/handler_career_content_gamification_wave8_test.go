package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAudit159Wave8LoginBonusRoutesMatchContractAndPersistOnce(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave 8 bonus", fmt.Sprintf("wave8-bonus-%s@example.test", userID[:8]), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM gamification.login_bonus_claim WHERE user_id=$1`, userID); err != nil {
			t.Errorf("cleanup login bonus claims: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM gamification.login_bonus_chain WHERE user_id=$1`, userID); err != nil {
			t.Errorf("cleanup login bonus chain: %v", err)
		}
	})
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	call := func(method, path, sessionToken string, csrf bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if sessionToken != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: sessionToken})
		}
		if csrf {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}

	if got := call(http.MethodGet, "/api/gamification/login-bonus", "", false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d, want 401", got)
	}
	if got := call(http.MethodPost, "/api/gamification/login-bonus/claim", "", true).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous claim status=%d, want 401", got)
	}
	if got := call(http.MethodPost, "/api/gamification/login-bonus/claim", token, false).Code; got != http.StatusForbidden {
		t.Fatalf("claim without CSRF status=%d, want 403", got)
	}
	status := call(http.MethodGet, "/api/gamification/login-bonus", token, false)
	if status.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", status.Code, status.Body.String())
	}
	var statusBody struct {
		ChainDay int  `json:"chainDay"`
		CanClaim bool `json:"canClaim"`
		Rewards  []struct {
			Day         int    `json:"day"`
			Type        string `json:"type"`
			Claimed     bool   `json:"claimed"`
			Current     bool   `json:"current"`
			IsBigReward bool   `json:"isBigReward"`
		} `json:"rewards"`
	}
	if err := json.Unmarshal(status.Body.Bytes(), &statusBody); err != nil {
		t.Fatalf("decode status: %v", err)
	}
	if !statusBody.CanClaim || len(statusBody.Rewards) != 7 || statusBody.Rewards[0].Day != 1 || !statusBody.Rewards[0].Current || statusBody.Rewards[3].Type != "xp" || statusBody.Rewards[6].Type != "xp" || !statusBody.Rewards[6].IsBigReward {
		t.Fatalf("status does not satisfy learner reward schedule: %+v (%s)", statusBody, status.Body.String())
	}

	var claimResponses [2]*httptest.ResponseRecorder
	start := make(chan struct{})
	var claimsWG sync.WaitGroup
	for i := range claimResponses {
		claimsWG.Add(1)
		go func(i int) {
			defer claimsWG.Done()
			<-start
			claimResponses[i] = call(http.MethodPost, "/api/gamification/login-bonus/claim", token, true)
		}(i)
	}
	close(start)
	claimsWG.Wait()
	var claimed *httptest.ResponseRecorder
	oks, conflicts := 0, 0
	for _, response := range claimResponses {
		switch response.Code {
		case http.StatusOK:
			oks++
			claimed = response
		case http.StatusConflict:
			conflicts++
		default:
			t.Fatalf("concurrent claim status=%d body=%s", response.Code, response.Body.String())
		}
	}
	if oks != 1 || conflicts != 1 {
		t.Fatalf("concurrent claims succeeded=%d conflicts=%d, want 1 each", oks, conflicts)
	}
	var claimBody struct {
		Claimed  bool `json:"claimed"`
		ChainDay int  `json:"chainDay"`
		Reward   *struct {
			Type  string `json:"type"`
			Value string `json:"value"`
			Label string `json:"label"`
		} `json:"reward"`
	}
	if err := json.Unmarshal(claimed.Body.Bytes(), &claimBody); err != nil {
		t.Fatalf("decode claim: %v", err)
	}
	if !claimBody.Claimed || claimBody.ChainDay != 1 || claimBody.Reward == nil || claimBody.Reward.Type != "xp" {
		t.Fatalf("claim response does not satisfy learner contract: %+v (%s)", claimBody, claimed.Body.String())
	}
	var claims int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM gamification.login_bonus_claim WHERE user_id=$1`, userID).Scan(&claims); err != nil || claims != 1 {
		t.Fatalf("persisted claims=%d err=%v, want exactly one", claims, err)
	}
	var rankXP int
	if err := db.QueryRow(context.Background(), `SELECT COALESCE((SELECT rank_xp FROM career.user_career_state WHERE user_id=$1),0)`, userID).Scan(&rankXP); err != nil || rankXP != 10 {
		t.Fatalf("login bonus rank XP=%d err=%v, want exactly 10 after one concurrent claim", rankXP, err)
	}
	status = call(http.MethodGet, "/api/gamification/login-bonus", token, false)
	if status.Code != http.StatusOK || !strings.Contains(status.Body.String(), `"canClaim":false`) || !strings.Contains(status.Body.String(), `"claimed":true`) {
		t.Fatalf("claimed status=%d body=%s", status.Code, status.Body.String())
	}
	if got := call(http.MethodPost, "/api/gamification/login-bonus/claim", token, true).Code; got != http.StatusConflict {
		t.Fatalf("duplicate same-day claim status=%d, want 409", got)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM gamification.login_bonus_claim WHERE user_id=$1`, userID).Scan(&claims); err != nil || claims != 1 {
		t.Fatalf("duplicate request changed persisted claims=%d err=%v", claims, err)
	}
}

func TestAudit159Wave8MysteryBoxRoutesEnforceGoalAndPersistReward(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave 8 mystery", fmt.Sprintf("wave8-box-%s@example.test", userID[:8]), "")
	rewardID, unsupportedRewardID, planID, taskID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO gamification.mystery_box_reward(id,slug,name_vi,reward_type,reward_value,rarity,icon_emoji,weight,active)
		VALUES($1,$2,'Wave 8 test reward','xp',25,'rare','🎁',2147483647,true)`, rewardID, "wave8-"+rewardID); err != nil {
		t.Fatalf("seed reward: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO gamification.mystery_box_reward(id,slug,name_vi,reward_type,reward_value,rarity,icon_emoji,weight,active)
		VALUES($1,$2,'Unsupported test reward','streak_freeze',1,'rare','🧊',2147483647,true)`, unsupportedRewardID, "wave8-inert-"+unsupportedRewardID); err != nil {
		t.Fatalf("seed unsupported reward: %v", err)
	}
	today := time.Now().In(time.FixedZone("Asia/Tokyo", 9*60*60)).Format("2006-01-02")
	if _, err := db.Exec(ctx, `INSERT INTO gamification.daily_study_plan(id,user_id,plan_date,target_minutes,updated_at) VALUES($1,$2,$3::date,10,NOW())`, planID, userID, today); err != nil {
		t.Fatalf("seed daily study plan: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO gamification.daily_study_task(id,plan_id,task_type,target_count,done_count,sort_order) VALUES($1,$2,'reviews',5,0,1)`, taskID, planID); err != nil {
		t.Fatalf("seed incomplete task: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(ctx, `DELETE FROM gamification.daily_study_plan WHERE id=$1`, planID); err != nil {
			t.Errorf("cleanup daily study plan: %v", err)
		}
		if _, err := db.Exec(ctx, `DELETE FROM gamification.mystery_box_reward WHERE id=$1`, rewardID); err != nil {
			t.Errorf("cleanup mystery box reward: %v", err)
		}
		if _, err := db.Exec(ctx, `DELETE FROM gamification.mystery_box_reward WHERE id=$1`, unsupportedRewardID); err != nil {
			t.Errorf("cleanup unsupported mystery box reward: %v", err)
		}
	})
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	t.Cleanup(func() {
		if _, err := db.Exec(ctx, `DELETE FROM gamification.mystery_box_claim WHERE user_id=$1`, userID); err != nil {
			t.Errorf("cleanup mystery box claims: %v", err)
		}
	})
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	call := func(method, path, sessionToken string, csrf bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if sessionToken != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: sessionToken})
		}
		if csrf {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}

	if got := call(http.MethodGet, "/api/gamification/mystery-box/status", "", false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d, want 401", got)
	}
	if got := call(http.MethodPost, "/api/gamification/mystery-box/open", "", true).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous open status=%d, want 401", got)
	}
	if got := call(http.MethodPost, "/api/gamification/mystery-box/open", token, false).Code; got != http.StatusForbidden {
		t.Fatalf("open without CSRF status=%d, want 403", got)
	}
	status := call(http.MethodGet, "/api/gamification/mystery-box/status", token, false)
	if status.Code != http.StatusOK || !strings.Contains(status.Body.String(), `"canOpen":false`) || !strings.Contains(status.Body.String(), `"goalComplete":false`) {
		t.Fatalf("incomplete goal status=%d body=%s", status.Code, status.Body.String())
	}
	if got := call(http.MethodPost, "/api/gamification/mystery-box/open", token, true).Code; got != http.StatusForbidden {
		t.Fatalf("open before goal completion status=%d, want 403", got)
	}
	if _, err := db.Exec(ctx, `UPDATE gamification.daily_study_task SET done_count=target_count WHERE id=$1`, taskID); err != nil {
		t.Fatalf("complete daily study task: %v", err)
	}
	status = call(http.MethodGet, "/api/gamification/mystery-box/status", token, false)
	if status.Code != http.StatusOK || !strings.Contains(status.Body.String(), `"canOpen":true`) || !strings.Contains(status.Body.String(), `"goalComplete":true`) {
		t.Fatalf("completed goal status=%d body=%s", status.Code, status.Body.String())
	}
	var openResponses [2]*httptest.ResponseRecorder
	start := make(chan struct{})
	var opensWG sync.WaitGroup
	for i := range openResponses {
		opensWG.Add(1)
		go func(i int) {
			defer opensWG.Done()
			<-start
			openResponses[i] = call(http.MethodPost, "/api/gamification/mystery-box/open", token, true)
		}(i)
	}
	close(start)
	opensWG.Wait()
	var opened *httptest.ResponseRecorder
	oks, conflicts := 0, 0
	for _, response := range openResponses {
		switch response.Code {
		case http.StatusOK:
			oks++
			opened = response
		case http.StatusConflict:
			conflicts++
		default:
			t.Fatalf("concurrent open status=%d body=%s", response.Code, response.Body.String())
		}
	}
	if oks != 1 || conflicts != 1 {
		t.Fatalf("concurrent opens succeeded=%d conflicts=%d, want 1 each", oks, conflicts)
	}
	var result struct {
		Opened bool `json:"opened"`
		Reward *struct {
			Slug        string  `json:"slug"`
			NameVi      string  `json:"nameVi"`
			RewardType  string  `json:"rewardType"`
			RewardValue int     `json:"rewardValue"`
			Rarity      string  `json:"rarity"`
			IconEmoji   string  `json:"iconEmoji"`
			Description *string `json:"description"`
		} `json:"reward"`
	}
	if err := json.Unmarshal(opened.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode open response: %v", err)
	}
	if !result.Opened || result.Reward == nil || result.Reward.Slug == "" || result.Reward.NameVi == "" || result.Reward.RewardType != "xp" {
		t.Fatalf("open response contract mismatch: %+v (%s)", result, opened.Body.String())
	}
	var claimCount int
	var storedSlug, storedName string
	if err := db.QueryRow(ctx, `SELECT mr.slug,mr.name_vi,count(*) OVER() FROM gamification.mystery_box_claim claim
		JOIN gamification.mystery_box_reward mr ON mr.id=claim.reward_id WHERE claim.user_id=$1 AND claim.claim_date=$2::date`, userID, today).Scan(&storedSlug, &storedName, &claimCount); err != nil || claimCount != 1 {
		t.Fatalf("load persisted mystery claim count=%d err=%v", claimCount, err)
	}
	if result.Reward.Slug != storedSlug || result.Reward.NameVi != storedName {
		t.Fatalf("response reward=(%s,%s) persisted=(%s,%s)", result.Reward.Slug, result.Reward.NameVi, storedSlug, storedName)
	}
	var rankXP int
	if err := db.QueryRow(ctx, `SELECT COALESCE((SELECT rank_xp FROM career.user_career_state WHERE user_id=$1),0)`, userID).Scan(&rankXP); err != nil || rankXP != result.Reward.RewardValue {
		t.Fatalf("mystery box rank XP=%d err=%v, want configured reward %d", rankXP, err, result.Reward.RewardValue)
	}
	status = call(http.MethodGet, "/api/gamification/mystery-box/status", token, false)
	if status.Code != http.StatusOK || !strings.Contains(status.Body.String(), `"canOpen":false`) || !strings.Contains(status.Body.String(), `"todayReward"`) || !strings.Contains(status.Body.String(), `"Wave 8 test reward"`) {
		t.Fatalf("post-open status=%d body=%s", status.Code, status.Body.String())
	}
	if got := call(http.MethodPost, "/api/gamification/mystery-box/open", token, true).Code; got != http.StatusConflict {
		t.Fatalf("duplicate open status=%d, want 409", got)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM gamification.mystery_box_claim WHERE user_id=$1`, userID).Scan(&claimCount); err != nil || claimCount != 1 {
		t.Fatalf("duplicate open changed claims=%d err=%v", claimCount, err)
	}
}
