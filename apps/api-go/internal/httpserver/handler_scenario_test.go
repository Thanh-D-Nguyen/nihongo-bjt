package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/scenario"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const scenarioTestOrigin = "http://localhost:3000"

// TestScenarioLearnerHTTPContract drives the five learner scenario routes through NewRouter and records the wire
// contract the mobile client relies on: bearer session, Origin allow-list on unsafe methods, a hidden answer key in
// the playable payload, a stateless step answer, and a completion that is not idempotent.
func TestScenarioLearnerHTTPContract(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:        &config.Config{CORSOrigins: []string{scenarioTestOrigin}},
		Logger:        slog.Default(),
		SessionStore:  sessions,
		ScenarioStore: scenario.NewStore(db),
	})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Scenario Learner", fmt.Sprintf("scenario-%s@example.com", userID[:8]), "")
	token := createLearnerSession(t, sessions, userID)

	slug := fmt.Sprintf("http-contract-%s", newUUID(t)[:8])
	var scenarioID, stepOne, stepTwo, optimalOne string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, title_ja, description_vi, difficulty, category, icon_emoji, estimated_min, active, sort_order)
		VALUES ($1, 'Tình huống HTTP', 'HTTPテスト', 'Mô tả', 'beginner', 'email', 'E', 3, true, -1000) RETURNING id::text`, slug).Scan(&scenarioID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM content.user_scenario_attempt WHERE scenario_id = $1`, scenarioID)
		_, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, scenarioID)
	})
	for order, target := range map[int]*string{1: &stepOne, 2: &stepTwo} {
		if err := db.QueryRow(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi, situation_ja, speaker_name, speaker_role)
			VALUES ($1, $2, 'Tình huống', '状況', 'Hệ thống', 'Narrator') RETURNING id::text`, scenarioID, order).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	for _, step := range []string{stepOne, stepTwo} {
		if _, err := db.Exec(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded)
			VALUES ($1, 'A', 'Tốt', 'よい', true, 'Đúng', 10), ($1, 'B', 'Tạm', 'ふつう', false, 'Chưa tốt', 3)`, step); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.QueryRow(ctx, `SELECT id::text FROM content.scenario_choice WHERE step_id = $1 AND choice_key = 'A'`, stepOne).Scan(&optimalOne); err != nil {
		t.Fatal(err)
	}

	do := func(method, path, body, origin string, withToken bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if withToken {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr
	}
	decode := func(rr *httptest.ResponseRecorder, into any) {
		t.Helper()
		if err := json.Unmarshal(rr.Body.Bytes(), into); err != nil {
			t.Fatalf("response is not the expected JSON (%d): %s", rr.Code, rr.Body.String())
		}
	}
	attemptCount := func() int {
		var n int
		if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM content.user_scenario_attempt WHERE scenario_id = $1 AND user_id = $2`, scenarioID, userID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	t.Run("every route needs a learner session", func(t *testing.T) {
		for _, route := range []struct{ method, path, body string }{
			{http.MethodGet, "/api/scenarios", ""},
			{http.MethodGet, "/api/scenarios/" + scenarioID, ""},
			{http.MethodGet, "/api/scenarios/" + scenarioID + "/attempts", ""},
			{http.MethodPost, "/api/scenarios/steps/" + stepOne + "/answer", `{"choiceKey":"A"}`},
			{http.MethodPost, "/api/scenarios/" + scenarioID + "/complete", `{"choices":[]}`},
		} {
			if rr := do(route.method, route.path, route.body, scenarioTestOrigin, false); rr.Code != http.StatusUnauthorized {
				t.Errorf("%s %s without a session = %d, want 401", route.method, route.path, rr.Code)
			}
		}
	})

	t.Run("list and detail expose the playable content without the answer key", func(t *testing.T) {
		rr := do(http.MethodGet, "/api/scenarios", "", "", true)
		if rr.Code != http.StatusOK {
			t.Fatalf("list = %d: %s", rr.Code, rr.Body.String())
		}
		var list []map[string]any
		decode(rr, &list)
		var row map[string]any
		for _, candidate := range list {
			if candidate["id"] == scenarioID {
				row = candidate
			}
		}
		if row == nil {
			t.Fatalf("seeded scenario missing from list: %s", rr.Body.String())
		}
		for _, key := range []string{"id", "slug", "titleVi", "titleJa", "descriptionVi", "difficulty", "category", "iconEmoji", "estimatedMin", "_count"} {
			if _, ok := row[key]; !ok {
				t.Errorf("list row lacks %q: %v", key, row)
			}
		}
		if counts, _ := row["_count"].(map[string]any); counts["steps"] != float64(2) {
			t.Errorf("_count.steps = %v, want 2", counts["steps"])
		}

		rr = do(http.MethodGet, "/api/scenarios/"+scenarioID, "", "", true)
		if rr.Code != http.StatusOK {
			t.Fatalf("detail = %d: %s", rr.Code, rr.Body.String())
		}
		for _, secret := range []string{"isOptimal", "pointsAwarded", "feedbackVi", "is_optimal", "points"} {
			if strings.Contains(rr.Body.String(), secret) {
				t.Errorf("detail leaks %q before the learner answers: %s", secret, rr.Body.String())
			}
		}
		var detail struct {
			Steps []struct {
				ID        string `json:"id"`
				StepOrder int    `json:"stepOrder"`
				Choices   []struct {
					ID        string `json:"id"`
					ChoiceKey string `json:"choiceKey"`
					TextVi    string `json:"textVi"`
				} `json:"choices"`
			} `json:"steps"`
		}
		decode(rr, &detail)
		if len(detail.Steps) != 2 || detail.Steps[0].StepOrder != 1 || len(detail.Steps[0].Choices) != 2 || detail.Steps[0].Choices[0].ChoiceKey != "A" {
			t.Errorf("steps are not ordered with their choices: %+v", detail.Steps)
		}
		if rr := do(http.MethodGet, "/api/scenarios/"+newUUID(t), "", "", true); rr.Code != http.StatusNotFound {
			t.Errorf("unknown scenario = %d, want 404", rr.Code)
		}
	})

	t.Run("unsafe methods need a trusted Origin", func(t *testing.T) {
		body := `{"choiceKey":"A"}`
		path := "/api/scenarios/steps/" + stepOne + "/answer"
		if rr := do(http.MethodPost, path, body, "", true); rr.Code != http.StatusForbidden {
			t.Errorf("answer without Origin = %d, want 403", rr.Code)
		}
		if rr := do(http.MethodPost, path, body, "https://evil.example", true); rr.Code != http.StatusForbidden {
			t.Errorf("answer from an untrusted Origin = %d, want 403", rr.Code)
		}
		if rr := do(http.MethodPost, "/api/scenarios/"+scenarioID+"/complete", `{"choices":[]}`, "", true); rr.Code != http.StatusForbidden {
			t.Errorf("complete without Origin = %d, want 403", rr.Code)
		}
	})

	t.Run("a step answer is feedback only and stores nothing", func(t *testing.T) {
		path := "/api/scenarios/steps/" + stepOne + "/answer"
		for _, body := range []string{`{"choiceKey":"A"}`, `{"choiceKey":"A"}`, fmt.Sprintf(`{"choiceId":"%s"}`, optimalOne)} {
			rr := do(http.MethodPost, path, body, scenarioTestOrigin, true)
			if rr.Code != http.StatusOK {
				t.Fatalf("answer %s = %d: %s", body, rr.Code, rr.Body.String())
			}
			var result struct {
				ChoiceKey     string  `json:"choiceKey"`
				IsOptimal     bool    `json:"isOptimal"`
				PointsAwarded int     `json:"pointsAwarded"`
				FeedbackVi    *string `json:"feedbackVi"`
			}
			decode(rr, &result)
			if result.ChoiceKey != "A" || !result.IsOptimal || result.PointsAwarded != 10 || result.FeedbackVi == nil {
				t.Errorf("answer result = %+v", result)
			}
		}
		if n := attemptCount(); n != 0 {
			t.Errorf("a step answer stored %d attempts, want 0", n)
		}
		if rr := do(http.MethodPost, path, `{"choiceKey":"Z"}`, scenarioTestOrigin, true); rr.Code != http.StatusNotFound {
			t.Errorf("unknown choice = %d, want 404", rr.Code)
		}
		if rr := do(http.MethodPost, path, `{}`, scenarioTestOrigin, true); rr.Code != http.StatusBadRequest {
			t.Errorf("empty answer = %d, want 400", rr.Code)
		}
		if rr := do(http.MethodPost, path, `not json`, scenarioTestOrigin, true); rr.Code != http.StatusBadRequest {
			t.Errorf("malformed answer = %d, want 400", rr.Code)
		}
	})

	t.Run("completion is scored by the server and every call records a new attempt", func(t *testing.T) {
		path := "/api/scenarios/" + scenarioID + "/complete"
		if rr := do(http.MethodPost, path, `{"choices":[{"stepOrder":1,"choiceKey":"A"}]}`, scenarioTestOrigin, true); rr.Code != http.StatusBadRequest {
			t.Errorf("incomplete answers = %d, want 400", rr.Code)
		}
		if rr := do(http.MethodPost, path, `{"choices":[]}`, scenarioTestOrigin, true); rr.Code != http.StatusBadRequest {
			t.Errorf("empty answers = %d, want 400", rr.Code)
		}
		if rr := do(http.MethodPost, path, `{"choices":[{"stepOrder":1,"choiceKey":"A"},{"stepOrder":1,"choiceKey":"B"}]}`, scenarioTestOrigin, true); rr.Code != http.StatusBadRequest {
			t.Errorf("duplicate step = %d, want 400", rr.Code)
		}
		if n := attemptCount(); n != 0 {
			t.Fatalf("rejected completions stored %d attempts, want 0", n)
		}
		if rr := do(http.MethodPost, "/api/scenarios/"+newUUID(t)+"/complete", `{"choices":[]}`, scenarioTestOrigin, true); rr.Code != http.StatusNotFound {
			t.Errorf("unknown scenario = %d, want 404", rr.Code)
		}

		byID := fmt.Sprintf(`{"choices":[{"stepId":"%s","choiceId":"%s"},{"stepOrder":2,"choiceKey":"A","points":999}]}`, stepOne, optimalOne)
		var firstID string
		for call := 1; call <= 2; call++ {
			rr := do(http.MethodPost, path, byID, scenarioTestOrigin, true)
			if rr.Code != http.StatusOK {
				t.Fatalf("complete #%d = %d: %s", call, rr.Code, rr.Body.String())
			}
			var result struct {
				ID          string `json:"id"`
				TotalPoints int    `json:"totalPoints"`
				MaxPoints   int    `json:"maxPoints"`
			}
			decode(rr, &result)
			if result.TotalPoints != 20 || result.MaxPoints != 20 {
				t.Errorf("complete #%d scored %d/%d, want 20/20 (client points must be ignored)", call, result.TotalPoints, result.MaxPoints)
			}
			if call == 1 {
				firstID = result.ID
			} else if result.ID == firstID {
				t.Errorf("a repeated completion returned the same attempt id; the contract is one new attempt per call")
			}
		}
		if n := attemptCount(); n != 2 {
			t.Errorf("two identical completions stored %d attempts, want 2 (not idempotent)", n)
		}
	})

	t.Run("attempts are the caller's own and carry choices as a base64 string", func(t *testing.T) {
		rr := do(http.MethodGet, "/api/scenarios/"+scenarioID+"/attempts", "", "", true)
		if rr.Code != http.StatusOK {
			t.Fatalf("attempts = %d: %s", rr.Code, rr.Body.String())
		}
		var attempts []struct {
			ID          string `json:"id"`
			TotalPoints int    `json:"totalPoints"`
			MaxPoints   int    `json:"maxPoints"`
			Choices     string `json:"choices"`
			CompletedAt string `json:"completedAt"`
		}
		decode(rr, &attempts)
		if len(attempts) != 2 {
			t.Fatalf("attempts = %d, want 2", len(attempts))
		}
		if rr := do(http.MethodGet, "/api/scenarios/not-a-uuid/attempts", "", "", true); rr.Code != http.StatusOK || strings.TrimSpace(rr.Body.String()) != "[]" {
			t.Errorf("malformed scenario id = %d %s, want 200 []", rr.Code, rr.Body.String())
		}
		raw, err := base64.StdEncoding.DecodeString(attempts[0].Choices)
		if err != nil {
			t.Fatalf("choices is not base64 (the Go []byte encoding the clients must undo): %q", attempts[0].Choices)
		}
		var stored []struct {
			StepOrder int    `json:"stepOrder"`
			ChoiceKey string `json:"choiceKey"`
		}
		if err := json.Unmarshal(raw, &stored); err != nil || len(stored) != 2 || stored[0].ChoiceKey != "A" {
			t.Errorf("decoded choices = %s (%v)", raw, err)
		}

		otherID := newUUID(t)
		seedActiveUser(t, db, otherID, "Other Learner", fmt.Sprintf("scenario-%s@example.com", otherID[:8]), "")
		other := createLearnerSession(t, sessions, otherID)
		req := httptest.NewRequest(http.MethodGet, "/api/scenarios/"+scenarioID+"/attempts", nil)
		req.Header.Set("Authorization", "Bearer "+other)
		otherRR := httptest.NewRecorder()
		router.ServeHTTP(otherRR, req)
		if strings.TrimSpace(otherRR.Body.String()) != "[]" {
			t.Errorf("another learner sees %s, want []", otherRR.Body.String())
		}
	})
}
