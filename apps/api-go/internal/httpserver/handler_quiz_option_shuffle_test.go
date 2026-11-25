package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"testing"

	"github.com/kiokoto/nihongo-bjt/api-go/internal/config"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/scenario"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/session"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/studyplan"
)

func TestQuizSessionOptionShuffleDistributionStabilityAndGrading(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:         &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:         testLogger(),
		DBPool:         db,
		SessionStore:   sessions,
		StudyPlanStore: studyplan.NewStore(db),
	})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Shuffle learner", fmt.Sprintf("quiz-shuffle-%s@example.com", userID[:8]), "")
	rawToken := createLearnerSession(t, sessions, userID)

	testID := newUUID(t)
	sectionID := newUUID(t)
	questionID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test(id,slug,title_vi,type,status,time_limit_seconds,created_at,updated_at)
		VALUES($1,$2,'Shuffle bias fixture','practice','published',NULL,NOW(),NOW())`, testID, "quiz-shuffle-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM assessment.quiz_session WHERE test_id=$1`, testID)
		_, _ = db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID)
	})
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_test_section(id,test_id,code,title_vi,display_order,created_at)
		VALUES($1,$2,'RC1','Part 1',1,NOW())`, sectionID, testID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question(id,section_id,prompt,explanation_vi,skill_tag,status,created_at,updated_at)
		VALUES($1,$2,'正しい敬語表現を選んでください。','Bが正解です。','keigo','published',NOW(),NOW())`, questionID, sectionID); err != nil {
		t.Fatal(err)
	}
	expectedTextByKey := map[string]string{
		"A": "選択肢A（不正解）",
		"B": "選択肢B（正解）",
		"C": "選択肢C（不正解）",
		"D": "選択肢D（不正解）",
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option(question_id,option_key,text,is_correct,created_at)
		VALUES
			($1,'A',$2,false,NOW()),
			($1,'B',$3,true,NOW()),
			($1,'C',$4,false,NOW()),
			($1,'D',$5,false,NOW())`,
		questionID, expectedTextByKey["A"], expectedTextByKey["B"], expectedTextByKey["C"], expectedTextByKey["D"]); err != nil {
		t.Fatal(err)
	}

	type servedOption struct {
		OptionKey string `json:"optionKey"`
		Text      string `json:"text"`
	}
	fetchQuestion := func(sessionID string) []servedOption {
		t.Helper()
		res := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+sessionID+"/question", "")
		if res.Code != http.StatusOK {
			t.Fatalf("GET question session=%s: want 200, got %d: %s", sessionID, res.Code, res.Body.String())
		}
		var payload struct {
			Question struct {
				ID      string         `json:"id"`
				Options []servedOption `json:"options"`
			} `json:"question"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode question response: %v", err)
		}
		if payload.Question.ID != questionID {
			t.Fatalf("question id = %q, want %q", payload.Question.ID, questionID)
		}
		if len(payload.Question.Options) != 4 {
			t.Fatalf("options len = %d, want 4", len(payload.Question.Options))
		}
		return payload.Question.Options
	}

	const numSessions = 400
	var posCounts [4]int
	sessionBySlot := [4]string{}
	firstSessionID := ""
	var firstOrder []servedOption

	for i := 0; i < numSessions; i++ {
		started := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, testID))
		if started.Code != http.StatusCreated {
			t.Fatalf("start session %d: want 201, got %d: %s", i, started.Code, started.Body.String())
		}
		var startData struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(started.Body.Bytes(), &startData); err != nil {
			t.Fatal(err)
		}

		opts := fetchQuestion(startData.ID)
		if i == 0 {
			firstSessionID = startData.ID
			firstOrder = opts
		}

		seen := make(map[string]bool, 4)
		correctSlot := -1
		for slot, opt := range opts {
			wantText, ok := expectedTextByKey[opt.OptionKey]
			if !ok {
				t.Fatalf("session %s returned unknown optionKey %q", startData.ID, opt.OptionKey)
			}
			if opt.Text != wantText {
				t.Fatalf("session %s broke optionKey->text binding: key %q got text %q, want %q", startData.ID, opt.OptionKey, opt.Text, wantText)
			}
			if seen[opt.OptionKey] {
				t.Fatalf("session %s returned duplicate optionKey %q", startData.ID, opt.OptionKey)
			}
			seen[opt.OptionKey] = true
			if opt.Text == expectedTextByKey["B"] {
				correctSlot = slot
			}
		}
		if correctSlot < 0 {
			t.Fatalf("session %s omitted correct option text", startData.ID)
		}
		posCounts[correctSlot]++
		if sessionBySlot[correctSlot] == "" {
			sessionBySlot[correctSlot] = startData.ID
		}
	}

	// Re-fetching the same (session, question) must always return the identical order.
	for retry := 0; retry < 5; retry++ {
		again := fetchQuestion(firstSessionID)
		if !reflect.DeepEqual(again, firstOrder) {
			t.Fatalf("quiz session refetch %d changed option order: got %+v, want %+v", retry, again, firstOrder)
		}
	}

	t.Logf("quiz_session served correct-answer positions (N=%d): slot0=%d (%.1f%%) slot1=%d (%.1f%%) slot2=%d (%.1f%%) slot3=%d (%.1f%%)",
		numSessions,
		posCounts[0], float64(posCounts[0])*100/numSessions,
		posCounts[1], float64(posCounts[1])*100/numSessions,
		posCounts[2], float64(posCounts[2])*100/numSessions,
		posCounts[3], float64(posCounts[3])*100/numSessions,
	)

	minBound := int(float64(numSessions) * 0.15)
	maxBound := int(float64(numSessions) * 0.35)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("quiz session answer-position distribution out of uniform bounds: slot %d got %d/%d (%.1f%%), want [%d, %d] (15%%-35%%); full counts=%v",
				slot, count, numSessions, float64(count)*100/numSessions, minBound, maxBound, posCounts)
		}
	}

	// Grading must resolve by optionKey wherever the correct text landed.
	for slot, sid := range sessionBySlot {
		if sid == "" {
			continue
		}
		opts := fetchQuestion(sid)
		chosenKey := opts[slot].OptionKey
		if opts[slot].Text != expectedTextByKey["B"] {
			t.Fatalf("session %s slot %d text = %q, want %q", sid, slot, opts[slot].Text, expectedTextByKey["B"])
		}
		ansRes := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/session/"+sid+"/answer",
			fmt.Sprintf(`{"questionId":%q,"selectedOption":%q}`, questionID, chosenKey))
		if ansRes.Code != http.StatusCreated {
			t.Fatalf("grade correct option from slot %d (key=%s): want 201, got %d: %s", slot, chosenKey, ansRes.Code, ansRes.Body.String())
		}
		var graded struct {
			Session struct {
				Status       string `json:"status"`
				CorrectCount int    `json:"correctCount"`
			} `json:"session"`
		}
		if err := json.Unmarshal(ansRes.Body.Bytes(), &graded); err != nil {
			t.Fatal(err)
		}
		if graded.Session.Status != "completed" || graded.Session.CorrectCount != 1 {
			t.Fatalf("grading by optionKey from slot %d failed: got %+v, want completed with correctCount=1", slot, graded.Session)
		}

		// Breakdown must expose the session's positional display label matching the clicked slot.
		bdRes := quizRequest(t, router, rawToken, http.MethodGet, "/api/quiz/session/"+sid+"/results/breakdown", "")
		if bdRes.Code != http.StatusOK {
			t.Fatalf("breakdown session=%s: want 200, got %d: %s", sid, bdRes.Code, bdRes.Body.String())
		}
		var bd struct {
			Breakdown []struct {
				SelectedOption        string `json:"selectedOption"`
				SelectedDisplayOption string `json:"selectedDisplayOption"`
			} `json:"breakdown"`
		}
		if err := json.Unmarshal(bdRes.Body.Bytes(), &bd); err != nil {
			t.Fatal(err)
		}
		wantDisplay := string(rune('A' + slot))
		if len(bd.Breakdown) != 1 || bd.Breakdown[0].SelectedOption != "B" || bd.Breakdown[0].SelectedDisplayOption != wantDisplay {
			t.Fatalf("breakdown slot %d = %+v, want selectedOption=B selectedDisplayOption=%s", slot, bd.Breakdown, wantDisplay)
		}
	}

	// Submitting a distractor optionKey must still be marked incorrect.
	wrongStart := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/start", fmt.Sprintf(`{"templateId":%q}`, testID))
	var wrongSession struct {
		ID string `json:"id"`
	}
	if wrongStart.Code != http.StatusCreated || json.Unmarshal(wrongStart.Body.Bytes(), &wrongSession) != nil {
		t.Fatalf("start wrong-answer session: %d %s", wrongStart.Code, wrongStart.Body.String())
	}
	wrongOpts := fetchQuestion(wrongSession.ID)
	var distractorKey string
	for _, opt := range wrongOpts {
		if opt.Text != expectedTextByKey["B"] {
			distractorKey = opt.OptionKey
			break
		}
	}
	wrongAns := quizRequest(t, router, rawToken, http.MethodPost, "/api/quiz/session/"+wrongSession.ID+"/answer",
		fmt.Sprintf(`{"questionId":%q,"selectedOption":%q}`, questionID, distractorKey))
	var wrongGraded struct {
		Session struct {
			CorrectCount int `json:"correctCount"`
		} `json:"session"`
	}
	if wrongAns.Code != http.StatusCreated || json.Unmarshal(wrongAns.Body.Bytes(), &wrongGraded) != nil {
		t.Fatalf("grade wrong option: %d %s", wrongAns.Code, wrongAns.Body.String())
	}
	if wrongGraded.Session.CorrectCount != 0 {
		t.Fatalf("distractor key %q graded as correct: got correctCount=%d, want 0", distractorKey, wrongGraded.Session.CorrectCount)
	}
}

func TestPlacementOptionShuffleDistributionStabilityAndGrading(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	router, sessions := placementTestRouter(t, db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Placement shuffle", "placement-shuffle-"+userID[:8]+"@example.test", "")
	token := createLearnerSession(t, sessions, userID)

	testID, sectionID, questionID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Placement shuffle fixture','mock','published',NOW())`, testID, "placement-shuffle-"+testID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.learner_onboarding WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM assessment.placement_test_session WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID)
	})
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_test_section (id,test_id,code,title_vi,display_order) VALUES ($1,$2,'placement-shuffle','Fixture',1)`, sectionID, testID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question (id,section_id,prompt,explanation_vi,skill_tag,status,updated_at) VALUES ($1,$2,'Placement shuffle prompt','B is right','business','published',NOW())`, questionID, sectionID); err != nil {
		t.Fatal(err)
	}
	expectedText := map[string]string{
		"A": "Placement Wrong A",
		"B": "Placement Correct B",
		"C": "Placement Wrong C",
		"D": "Placement Wrong D",
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id,option_key,text,is_correct)
		VALUES ($1,'A',$2,false),($1,'B',$3,true),($1,'C',$4,false),($1,'D',$5,false)`,
		questionID, expectedText["A"], expectedText["B"], expectedText["C"], expectedText["D"]); err != nil {
		t.Fatal(err)
	}

	type placementOpt struct {
		OptionKey string `json:"optionKey"`
		Text      string `json:"text"`
	}
	type placementQuestion struct {
		ID      string         `json:"id"`
		Options []placementOpt `json:"options"`
	}
	findTargetOptions := func(questions []placementQuestion) []placementOpt {
		for _, q := range questions {
			if q.ID == questionID {
				return q.Options
			}
		}
		return nil
	}

	const numSessions = 400
	var posCounts [4]int
	var gradedCorrect bool

	for i := 0; i < numSessions; i++ {
		startRes := placementRequest(t, router, token, http.MethodPost, "/api/learner/placement/start", `{}`)
		if startRes.Code != http.StatusOK {
			t.Fatalf("placement start %d: want 200, got %d: %s", i, startRes.Code, startRes.Body.String())
		}
		var started struct {
			SessionID string              `json:"sessionId"`
			Questions []placementQuestion `json:"questions"`
		}
		if err := json.Unmarshal(startRes.Body.Bytes(), &started); err != nil {
			t.Fatal(err)
		}
		opts := findTargetOptions(started.Questions)
		if len(opts) != 4 {
			t.Fatalf("placement session %s missing fixture question options: %+v", started.SessionID, opts)
		}

		if i == 0 {
			// Resuming start and reading onboarding state must return the exact same order.
			resumeRes := placementRequest(t, router, token, http.MethodPost, "/api/learner/placement/start", `{}`)
			var resumed struct {
				Questions []placementQuestion `json:"questions"`
			}
			if resumeRes.Code != http.StatusOK || json.Unmarshal(resumeRes.Body.Bytes(), &resumed) != nil {
				t.Fatalf("placement resume: %d %s", resumeRes.Code, resumeRes.Body.String())
			}
			if !reflect.DeepEqual(findTargetOptions(resumed.Questions), opts) {
				t.Fatalf("placement resume changed option order: got %+v, want %+v", findTargetOptions(resumed.Questions), opts)
			}

			onboardRes := placementRequest(t, router, token, http.MethodGet, "/api/learner/onboarding", "")
			var onboard struct {
				Questions []placementQuestion `json:"questions"`
			}
			if onboardRes.Code != http.StatusOK || json.Unmarshal(onboardRes.Body.Bytes(), &onboard) != nil {
				t.Fatalf("onboarding status: %d %s", onboardRes.Code, onboardRes.Body.String())
			}
			if !reflect.DeepEqual(findTargetOptions(onboard.Questions), opts) {
				t.Fatalf("onboarding status changed placement option order: got %+v, want %+v", findTargetOptions(onboard.Questions), opts)
			}
		}

		correctSlot := -1
		var correctKey string
		for slot, opt := range opts {
			if expectedText[opt.OptionKey] != opt.Text {
				t.Fatalf("placement optionKey->text mismatch: %+v", opt)
			}
			if opt.Text == expectedText["B"] {
				correctSlot = slot
				correctKey = opt.OptionKey
			}
		}
		if correctSlot < 0 {
			t.Fatalf("placement session %s omitted correct option", started.SessionID)
		}
		posCounts[correctSlot]++

		if !gradedCorrect && correctSlot != 1 {
			answers := make(map[string]string, len(started.Questions))
			for _, q := range started.Questions {
				if q.ID == questionID {
					answers[q.ID] = correctKey
				} else if len(q.Options) > 0 {
					answers[q.ID] = q.Options[0].OptionKey
				}
			}
			body, _ := json.Marshal(map[string]any{"sessionId": started.SessionID, "answers": answers})
			submitRes := placementRequest(t, router, token, http.MethodPost, "/api/learner/placement/submit", string(body))
			if submitRes.Code != http.StatusOK {
				t.Fatalf("placement submit: want 200, got %d: %s", submitRes.Code, submitRes.Body.String())
			}
			var scored struct {
				CorrectCount int `json:"correctCount"`
			}
			if err := json.Unmarshal(submitRes.Body.Bytes(), &scored); err != nil {
				t.Fatal(err)
			}
			if len(started.Questions) == 1 && scored.CorrectCount != 1 {
				t.Fatalf("placement submit correct key %q from slot %d got correctCount=%d, want 1", correctKey, correctSlot, scored.CorrectCount)
			}
			if scored.CorrectCount < 1 {
				t.Fatalf("placement submit correct key %q from slot %d got correctCount=%d, want >= 1", correctKey, correctSlot, scored.CorrectCount)
			}
			gradedCorrect = true
		} else {
			if _, err := db.Exec(ctx, `UPDATE assessment.placement_test_session SET status='completed', completed_at=NOW() WHERE id=$1`, started.SessionID); err != nil {
				t.Fatal(err)
			}
		}
	}

	t.Logf("placement served correct-answer positions (N=%d): slot0=%d (%.1f%%) slot1=%d (%.1f%%) slot2=%d (%.1f%%) slot3=%d (%.1f%%)",
		numSessions,
		posCounts[0], float64(posCounts[0])*100/numSessions,
		posCounts[1], float64(posCounts[1])*100/numSessions,
		posCounts[2], float64(posCounts[2])*100/numSessions,
		posCounts[3], float64(posCounts[3])*100/numSessions,
	)

	minBound := int(float64(numSessions) * 0.15)
	maxBound := int(float64(numSessions) * 0.35)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("placement answer-position distribution out of uniform bounds: slot %d got %d/%d (%.1f%%), want [%d, %d] (15%%-35%%); full counts=%v",
				slot, count, numSessions, float64(count)*100/numSessions, minBound, maxBound, posCounts)
		}
	}
	if !gradedCorrect {
		t.Errorf("never observed correct option shifted off slot 1 to verify placement grading")
	}
}

func TestScenarioChoiceShuffleDistributionStabilityAndGrading(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:        &config.Config{CORSOrigins: []string{scenarioTestOrigin}},
		Logger:        testLogger(),
		SessionStore:  sessions,
		ScenarioStore: scenario.NewStore(db),
	})

	slug := "scenario-shuffle-" + newUUID(t)[:8]
	var scenarioID, stepID string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, title_ja, description_vi, difficulty, category, icon_emoji, estimated_min, active, sort_order)
		VALUES ($1, 'Scenario shuffle fixture', 'テスト', 'Mô tả', 'beginner', 'email', '📧', 3, true, -999) RETURNING id::text`, slug).Scan(&scenarioID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.user_scenario_attempt WHERE scenario_id=$1`, scenarioID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.business_scenario WHERE id=$1`, scenarioID)
	})
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi, situation_ja)
		VALUES ($1, 1, 'Chọn phản hồi tối ưu.', '最適な返答を選んでください。') RETURNING id::text`, scenarioID).Scan(&stepID); err != nil {
		t.Fatal(err)
	}
	expectedText := map[string]string{
		"A": "Optimal Choice A",
		"B": "Suboptimal Choice B",
		"C": "Suboptimal Choice C",
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded)
		VALUES
			($1, 'A', $2, '最適A', true, 'Tốt', 10),
			($1, 'B', $3, '普通B', false, 'Tạm', 3),
			($1, 'C', $4, '不適切C', false, 'Chưa ổn', 1)`,
		stepID, expectedText["A"], expectedText["B"], expectedText["C"]); err != nil {
		t.Fatal(err)
	}

	type servedChoice struct {
		ID        string `json:"id"`
		ChoiceKey string `json:"choiceKey"`
		TextVi    string `json:"textVi"`
	}
	fetchChoices := func(token string) []servedChoice {
		t.Helper()
		res := quizRequest(t, router, token, http.MethodGet, "/api/scenarios/"+scenarioID, "")
		if res.Code != http.StatusOK {
			t.Fatalf("GET scenario: want 200, got %d: %s", res.Code, res.Body.String())
		}
		var detail struct {
			Steps []struct {
				ID      string         `json:"id"`
				Choices []servedChoice `json:"choices"`
			} `json:"steps"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &detail); err != nil {
			t.Fatal(err)
		}
		if len(detail.Steps) != 1 || len(detail.Steps[0].Choices) != 3 {
			t.Fatalf("unexpected scenario steps: %+v", detail.Steps)
		}
		return detail.Steps[0].Choices
	}

	const numUsers = 300
	var posCounts [3]int
	var gradedToken string
	var gradedKey string

	for i := 0; i < numUsers; i++ {
		uid := newUUID(t)
		seedActiveUser(t, db, uid, "Scenario learner", fmt.Sprintf("sc-shuf-%s@example.com", uid[:8]), "")
		token := createLearnerSession(t, sessions, uid)
		choices := fetchChoices(token)
		if i == 0 {
			for retry := 0; retry < 3; retry++ {
				again := fetchChoices(token)
				if !reflect.DeepEqual(again, choices) {
					t.Fatalf("scenario refetch %d changed choice order: got %+v, want %+v", retry, again, choices)
				}
			}
		}
		optimalSlot := -1
		for slot, ch := range choices {
			if expectedText[ch.ChoiceKey] != ch.TextVi {
				t.Fatalf("scenario choiceKey->text mismatch: %+v", ch)
			}
			if ch.TextVi == expectedText["A"] {
				optimalSlot = slot
				if gradedToken == "" && slot != 0 {
					gradedToken = token
					gradedKey = ch.ChoiceKey
				}
			}
		}
		if optimalSlot < 0 {
			t.Fatalf("scenario missing optimal choice")
		}
		posCounts[optimalSlot]++
	}

	t.Logf("scenario served optimal-choice positions (N=%d): slot0=%d (%.1f%%) slot1=%d (%.1f%%) slot2=%d (%.1f%%)",
		numUsers,
		posCounts[0], float64(posCounts[0])*100/numUsers,
		posCounts[1], float64(posCounts[1])*100/numUsers,
		posCounts[2], float64(posCounts[2])*100/numUsers,
	)

	minBound := int(float64(numUsers) * 0.20)
	maxBound := int(float64(numUsers) * 0.47)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("scenario choice-position distribution out of uniform bounds: slot %d got %d/%d (%.1f%%), want [%d, %d] (20%%-47%%); full counts=%v",
				slot, count, numUsers, float64(count)*100/numUsers, minBound, maxBound, posCounts)
		}
	}

	if gradedToken != "" {
		ansRes := quizRequest(t, router, gradedToken, http.MethodPost, "/api/scenarios/steps/"+stepID+"/answer", fmt.Sprintf(`{"choiceKey":%q}`, gradedKey))
		if ansRes.Code != http.StatusOK {
			t.Fatalf("submit scenario choice %q: want 200, got %d: %s", gradedKey, ansRes.Code, ansRes.Body.String())
		}
		var result struct {
			IsOptimal     bool `json:"isOptimal"`
			PointsAwarded int  `json:"pointsAwarded"`
		}
		if err := json.Unmarshal(ansRes.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if !result.IsOptimal || result.PointsAwarded != 10 {
			t.Fatalf("scenario grading by choiceKey failed: got %+v, want isOptimal=true pointsAwarded=10", result)
		}
	}
}
