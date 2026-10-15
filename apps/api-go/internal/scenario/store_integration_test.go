package scenario

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func scenarioTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; run with scripts/quality/with-test-db.sh")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestScenarioStoreUsesCanonicalActiveSchemaAndHidesAnswerKey(t *testing.T) {
	db := scenarioTestPool(t)
	ctx := context.Background()
	slug := fmt.Sprintf("audit-%d", time.Now().UnixNano())
	var scenarioID, stepID, choiceID, userID string
	err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, title_ja, description_vi, active)
		VALUES ($1, 'Tình huống kiểm thử', 'テスト', 'Mô tả', true) RETURNING id::text`, slug).Scan(&scenarioID)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, scenarioID) })
	var inactiveID, inactiveStepID string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, active) VALUES ($1, 'Ẩn', false) RETURNING id::text`, slug+"-inactive").Scan(&inactiveID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, inactiveID) })
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi) VALUES ($1, 1, 'Inactive') RETURNING id::text`, inactiveID).Scan(&inactiveStepID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi, is_optimal, points_awarded) VALUES ($1, 'A', 'Inactive option', true, 10)`, inactiveStepID); err != nil {
		t.Fatal(err)
	}
	var emptyID string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, active) VALUES ($1, 'Chưa có bước', true) RETURNING id::text`, slug+"-empty").Scan(&emptyID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, emptyID) })
	var noChoicesID string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, active) VALUES ($1, 'Thiếu lựa chọn', true) RETURNING id::text`, slug+"-no-choices").Scan(&noChoicesID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, noChoicesID) })
	if _, err := db.Exec(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi) VALUES ($1, 1, 'Không có lựa chọn')`, noChoicesID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi, situation_ja)
		VALUES ($1, 1, 'Chọn phản hồi', '返事を選ぶ') RETURNING id::text`, scenarioID).Scan(&stepID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi, text_ja, is_optimal, feedback_vi, points_awarded)
		VALUES ($1, 'A', 'Lựa chọn tốt', 'よい選択', true, 'Đúng', 10) RETURNING id::text`, stepID).Scan(&choiceID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&userID); err != nil {
		t.Fatal(err)
	}

	store := NewStore(db)
	list, err := store.ListScenarios(ctx)
	if err != nil {
		t.Fatalf("list active scenarios: %v", err)
	}
	found := false
	for _, row := range list {
		if row.ID == scenarioID {
			found = true
		}
		rowJSON, err := json.Marshal(row)
		if err != nil {
			t.Fatal(err)
		}
		if row.ID == scenarioID && !strings.Contains(string(rowJSON), `"titleVi":"Tình huống kiểm thử"`) {
			t.Fatalf("list row omitted the canonical learner fields: %s", rowJSON)
		}
		if row.ID == scenarioID && !strings.Contains(string(rowJSON), `"_count":{"steps":1,"attempts":0}`) {
			t.Fatalf("list row omitted Flutter count contract: %s", rowJSON)
		}
	}
	if !found {
		t.Fatalf("active scenario %s missing from list", scenarioID)
	}
	for _, row := range list {
		if row.ID == emptyID || row.ID == noChoicesID {
			t.Fatal("scenario without playable choices appeared in list")
		}
	}
	if _, err := store.GetScenario(ctx, emptyID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected unplayable scenario to be not found, got %v", err)
	}
	if _, err := store.GetScenario(ctx, noChoicesID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected scenario with an unanswered step to be not found, got %v", err)
	}

	detail, err := store.GetScenario(ctx, scenarioID)
	if err != nil {
		t.Fatalf("get active scenario: %v", err)
	}
	body, err := json.Marshal(detail)
	if err != nil {
		t.Fatal(err)
	}
	for _, leaked := range []string{`"isOptimal"`, `"pointsAwarded"`, `"feedbackVi"`} {
		if strings.Contains(string(body), leaked) {
			t.Fatalf("detail response leaks answer key field %s: %s", leaked, body)
		}
	}
	if !strings.Contains(string(body), `"titleVi":"Tình huống kiểm thử"`) {
		t.Fatalf("detail response omitted localized title: %s", body)
	}
	if _, err := store.SubmitStepAnswer(ctx, inactiveStepID, "A"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("inactive scenario exposed answer feedback: %v", err)
	}

	answer, err := store.SubmitStepAnswer(ctx, stepID, "A")
	if err != nil {
		t.Fatalf("submit correct choice: %v", err)
	}
	answerJSON, err := json.Marshal(answer)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(answerJSON), `"isOptimal":true`) || !strings.Contains(string(answerJSON), `"choiceKey":"A"`) {
		t.Fatalf("unexpected answer contract: %s", answerJSON)
	}

	var invalidRecords []ChoiceRecord
	if err := json.Unmarshal([]byte(`[{"stepOrder":1,"choiceKey":"A"},{"stepOrder":1,"choiceKey":"A"}]`), &invalidRecords); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range [][]ChoiceRecord{nil, invalidRecords} {
		if _, err := callScenarioCompletion(store, ctx, userID, scenarioID, invalid); err == nil || !strings.Contains(err.Error(), "invalid completion") {
			t.Fatalf("expected invalid completion to be rejected, got %v", err)
		}
	}
	var completion []ChoiceRecord
	if err := json.Unmarshal([]byte(`[{"stepOrder":1,"choiceKey":"A"}]`), &completion); err != nil {
		t.Fatal(err)
	}
	attempt, err := callScenarioCompletion(store, ctx, userID, scenarioID, completion)
	if err != nil {
		t.Fatalf("persist attempt: %v", err)
	}
	result := attempt.Elem()
	if result.FieldByName("TotalPoints").Int() != 10 || result.FieldByName("MaxPoints").Int() != 10 || result.FieldByName("ID").String() == "" {
		t.Fatalf("unexpected attempt result: %v", attempt)
	}
	var attempts int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM content.user_scenario_attempt WHERE user_id = $1 AND scenario_id = $2`, userID, scenarioID).Scan(&attempts); err != nil {
		t.Fatal(err)
	}
	if attempts != 1 {
		t.Fatalf("expected one persisted attempt, got %d", attempts)
	}
}

func callScenarioCompletion(store *Store, ctx context.Context, userID, scenarioID string, choices []ChoiceRecord) (reflect.Value, error) {
	results := reflect.ValueOf(store).MethodByName("CompleteScenario").Call([]reflect.Value{
		reflect.ValueOf(ctx), reflect.ValueOf(userID), reflect.ValueOf(scenarioID), reflect.ValueOf(choices),
	})
	if len(results) == 1 {
		if results[0].IsNil() {
			return reflect.Value{}, nil
		}
		return reflect.Value{}, results[0].Interface().(error)
	}
	if err, ok := results[1].Interface().(error); ok && err != nil {
		return reflect.Value{}, err
	}
	return results[0], nil
}

func TestScenarioCompletionMaxPointsUsesOptimalChoices(t *testing.T) {
	db := scenarioTestPool(t)
	ctx := context.Background()
	slug := fmt.Sprintf("audit-optimal-score-%d", time.Now().UnixNano())
	var scenarioID, stepID, optimalChoiceID, userID string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi) VALUES ($1, 'Optimal score test') RETURNING id::text`, slug).Scan(&scenarioID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, scenarioID) })
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi) VALUES ($1, 1, 'Choose') RETURNING id::text`, scenarioID).Scan(&stepID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi, is_optimal, points_awarded) VALUES ($1, 'A', 'Optimal', true, 10) RETURNING id::text`, stepID).Scan(&optimalChoiceID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi, is_optimal, points_awarded) VALUES ($1, 'B', 'Other optimal', true, 15), ($1, 'C', 'Non-optimal', false, 14)`, stepID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if _, err := callScenarioCompletion(NewStore(db), ctx, userID, scenarioID, []ChoiceRecord{{StepID: stepID, ChoiceID: optimalChoiceID}}); err != nil {
		t.Fatalf("complete scenario using optimal choice: %v", err)
	}
	var totalPoints, maxPoints int
	if err := db.QueryRow(ctx, `SELECT total_points, max_points FROM content.user_scenario_attempt WHERE user_id = $1 AND scenario_id = $2 ORDER BY completed_at DESC LIMIT 1`, userID, scenarioID).Scan(&totalPoints, &maxPoints); err != nil {
		t.Fatal(err)
	}
	if totalPoints != 10 || maxPoints != 15 {
		t.Fatalf("max points must use the best optimal choice per step: got total=%d max=%d, want total=10 max=15", totalPoints, maxPoints)
	}
}

func TestScenarioChoiceKeyMustBeUnique(t *testing.T) {
	db := scenarioTestPool(t)
	ctx := context.Background()
	slug := fmt.Sprintf("audit-choice-key-%d", time.Now().UnixNano())
	var scenarioID, stepID string
	if err := db.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi) VALUES ($1, 'Unique key test') RETURNING id::text`, slug).Scan(&scenarioID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.business_scenario WHERE id = $1`, scenarioID) })
	if err := db.QueryRow(ctx, `INSERT INTO content.scenario_step (scenario_id, step_order, situation_vi) VALUES ($1, 1, 'Choose') RETURNING id::text`, scenarioID).Scan(&stepID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi) VALUES ($1, 'A', 'First')`, stepID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.scenario_choice (step_id, choice_key, text_vi) VALUES ($1, 'A', 'Duplicate')`, stepID); err == nil {
		t.Fatal("database accepted duplicate scenario choice key")
	}
}
