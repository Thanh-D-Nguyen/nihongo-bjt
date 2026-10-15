package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func snapshotExerciseConfig(t *testing.T, db *pgxpool.Pool, exerciseType, placement string) ([]byte, bool, func()) {
	t.Helper()
	var before []byte
	err := db.QueryRow(context.Background(), `SELECT to_jsonb(c) FROM exercise.exercise_config c WHERE exercise_type=$1 AND placement=$2`, exerciseType, placement).Scan(&before)
	if err != nil && err != pgx.ErrNoRows {
		t.Fatal(err)
	}
	existed := err == nil
	restore := func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM exercise.exercise_config WHERE exercise_type=$1 AND placement=$2`, exerciseType, placement); err != nil {
			t.Errorf("remove exercise config fixture: %v", err)
			return
		}
		if existed {
			if _, err := db.Exec(context.Background(), `INSERT INTO exercise.exercise_config SELECT (jsonb_populate_record(NULL::exercise.exercise_config,$1::jsonb)).*`, string(before)); err != nil {
				t.Errorf("restore preexisting exercise config: %v", err)
			}
		}
	}
	t.Cleanup(restore)
	return before, existed, restore
}

func TestAdminExerciseAuditContracts(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
	})
	router := buildDailyRadarTestRouter(db)
	sessions := session.NewStore(db)
	request := func(method, path, body, origin string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
		req.Header.Set("Origin", origin)
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}

	create := request(http.MethodPost, "/api/admin/exercises", `{"exerciseType":"translation","sourceType":"lexeme","sourceId":"`+newUUID(t)+`","level":"N3","prompt":{"text":"fixture question"},"choices":[{"key":"A"}],"correctAnswer":{"key":"A"},"explanation":"fixture","difficulty":"medium","tags":["audit-fixture"]}`, "http://localhost:18081")
	if create.Code != http.StatusCreated {
		t.Fatalf("exercise create status=%d body=%s; want 201", create.Code, create.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("exercise create response=%s; want id", create.Body.String())
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, created.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE id=$1`, created.ID)
	})

	detail := request(http.MethodGet, "/api/admin/exercises/"+created.ID, "", "")
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"prompt":{"text":"fixture question"}`) || !strings.Contains(detail.Body.String(), `"tags":["audit-fixture"]`) {
		t.Fatalf("exercise detail status=%d body=%s; want persisted JSON and tags", detail.Code, detail.Body.String())
	}
	list := request(http.MethodGet, "/api/admin/exercises?type=translation&level=N3&page=1&pageSize=10", "", "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), created.ID) {
		t.Fatalf("exercise list status=%d body=%s; want fixture in filtered page", list.Code, list.Body.String())
	}

	var sessionID string
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise_session (user_id,session_type,exercise_type,exercise_ids,status,total_questions) VALUES ($1,'practice_tab','translation',$2,'completed',1) RETURNING id::text`, newUUID(t), []string{created.ID}).Scan(&sessionID); err != nil {
		t.Fatalf("seed analytics session: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_session WHERE id=$1`, sessionID)
	})
	if _, err := db.Exec(context.Background(), `INSERT INTO exercise.exercise_answer (session_id,exercise_id,user_answer,is_correct,time_spent_ms) VALUES ($1,$2,'{"key":"A"}',true,250)`, sessionID, created.ID); err != nil {
		t.Fatalf("seed analytics answer: %v", err)
	}
	analytics := request(http.MethodGet, "/api/admin/exercises/analytics/performance?type=translation&level=N3", "", "")
	if analytics.Code != http.StatusOK || !strings.Contains(analytics.Body.String(), `"totalAttempts":1`) || !strings.Contains(analytics.Body.String(), `"correctCount":1`) || !strings.Contains(analytics.Body.String(), `"accuracyRate":1`) {
		t.Fatalf("exercise analytics status=%d body=%s; want persisted attempt aggregate", analytics.Code, analytics.Body.String())
	}

	update := request(http.MethodPut, "/api/admin/exercises/"+created.ID, `{"prompt":{"text":"updated fixture"},"choices":[{"key":"B"}],"correctAnswer":{"key":"B"},"tags":["updated-fixture"]}`, "http://localhost:18081")
	if update.Code != http.StatusOK {
		t.Fatalf("exercise update status=%d body=%s; want 200", update.Code, update.Body.String())
	}
	detail = request(http.MethodGet, "/api/admin/exercises/"+created.ID, "", "")
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"prompt":{"text":"updated fixture"}`) || !strings.Contains(detail.Body.String(), `"tags":["updated-fixture"]`) {
		t.Fatalf("updated exercise detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	deleteExercise := request(http.MethodDelete, "/api/admin/exercises/"+created.ID, "", "http://localhost:18081")
	if deleteExercise.Code != http.StatusConflict {
		t.Fatalf("exercise delete with answer history status=%d body=%s; want 409", deleteExercise.Code, deleteExercise.Body.String())
	}
	var exerciseRows, answerRows, auditRows int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM exercise.exercise WHERE id=$1`, created.ID).Scan(&exerciseRows); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM exercise.exercise_answer WHERE exercise_id=$1`, created.ID).Scan(&answerRows); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action IN ('exercise.created','exercise.updated','exercise.deleted')`, actorID, created.ID).Scan(&auditRows); err != nil {
		t.Fatal(err)
	}
	if exerciseRows != 1 || answerRows != 1 || auditRows != 2 {
		t.Fatalf("exercise rows=%d answer rows=%d audit rows=%d; want exercise history preserved and no delete audit", exerciseRows, answerRows, auditRows)
	}
	deleteFixture := request(http.MethodPost, "/api/admin/exercises", `{"exerciseType":"translation","sourceType":"lexeme","sourceId":"`+newUUID(t)+`","prompt":{"text":"delete fixture"},"correctAnswer":{"text":"delete fixture"}}`, "http://localhost:18081")
	if deleteFixture.Code != http.StatusCreated {
		t.Fatalf("unanswered exercise create status=%d body=%s", deleteFixture.Code, deleteFixture.Body.String())
	}
	var deletable struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(deleteFixture.Body.Bytes(), &deletable); err != nil || deletable.ID == "" {
		t.Fatalf("unanswered exercise create body=%s", deleteFixture.Body.String())
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE id=$1`, deletable.ID)
	})
	deleteExercise = request(http.MethodDelete, "/api/admin/exercises/"+deletable.ID, "", "http://localhost:18081")
	if deleteExercise.Code != http.StatusOK {
		t.Fatalf("unanswered exercise delete status=%d body=%s; want 200", deleteExercise.Code, deleteExercise.Body.String())
	}

	configList := request(http.MethodGet, "/api/admin/exercises/config", "", "")
	if configList.Code != http.StatusOK || !strings.HasPrefix(configList.Body.String(), "[") {
		t.Fatalf("exercise config list status=%d body=%s; want JSON list", configList.Code, configList.Body.String())
	}
	configBefore, configExisted, restoreConfig := snapshotExerciseConfig(t, db, "meaning_match", "daily_hub")
	upsert := request(http.MethodPut, "/api/admin/exercises/config", `{"exerciseType":"meaning_match","placement":"daily_hub","displayOrder":17,"enabled":true,"minLevel":"N3","maxLevel":"N2","timeLimitSec":45,"pointsPerCorrect":8}`, "http://localhost:18081")
	if upsert.Code != http.StatusOK {
		t.Fatalf("exercise config upsert status=%d body=%s; want 200", upsert.Code, upsert.Body.String())
	}
	var config struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(upsert.Body.Bytes(), &config); err != nil || config.ID == "" {
		t.Fatalf("exercise config response=%s; want id", upsert.Body.String())
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_type='exercise_config' AND target_id=$2`, actorID, config.ID)
	})
	configList = request(http.MethodGet, "/api/admin/exercises/config", "", "")
	if configList.Code != http.StatusOK || !strings.Contains(configList.Body.String(), config.ID) || !strings.Contains(configList.Body.String(), `"displayOrder":17`) {
		t.Fatalf("persisted config list status=%d body=%s", configList.Code, configList.Body.String())
	}
	deleteConfig := request(http.MethodDelete, "/api/admin/exercises/config/"+config.ID, "", "http://localhost:18081")
	if deleteConfig.Code != http.StatusOK {
		t.Fatalf("exercise config delete status=%d body=%s; want 200", deleteConfig.Code, deleteConfig.Body.String())
	}
	restoreConfig()
	var configAfter []byte
	err := db.QueryRow(context.Background(), `SELECT to_jsonb(c) FROM exercise.exercise_config c WHERE exercise_type='meaning_match' AND placement='daily_hub'`).Scan(&configAfter)
	if configExisted && (err != nil || string(configBefore) != string(configAfter)) {
		t.Fatalf("exercise config delete fixture was not restored: err=%v before=%s after=%s", err, configBefore, configAfter)
	}
	if !configExisted && err != pgx.ErrNoRows {
		t.Fatalf("exercise config delete fixture was not cleaned: err=%v after=%s", err, configAfter)
	}
}

func TestAdminExerciseConfigValidatesSharedContract(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	sessions := session.NewStore(db)
	var sourceID = newUUID(t)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
		req.Header.Set("Origin", "http://localhost:18081")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	invalidConfig := request(http.MethodPut, "/api/admin/exercises/config", `{"exerciseType":"unknown","placement":"invalid","timeLimitSec":4,"pointsPerCorrect":0}`)
	if invalidConfig.Code != http.StatusBadRequest {
		t.Fatalf("invalid config status=%d body=%s; want 400", invalidConfig.Code, invalidConfig.Body.String())
	}
	invalidExercise := request(http.MethodPost, "/api/admin/exercises", `{"exerciseType":"unknown","sourceType":"invalid","sourceId":"`+sourceID+`","level":"N6","prompt":{"text":"invalid fixture"},"correctAnswer":{"key":"A"},"difficulty":"impossible"}`)
	if invalidExercise.Code != http.StatusBadRequest {
		t.Fatalf("invalid exercise status=%d body=%s; want 400", invalidExercise.Code, invalidExercise.Body.String())
	}
}

func TestAdminExerciseRejectsInvalidJSONShapes(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	sessions := session.NewStore(db)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
		req.Header.Set("Origin", "http://localhost:18081")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		buildDailyRadarTestRouter(db).ServeHTTP(res, req)
		return res
	}
	legacy := `{"exerciseType":"translation","sourceType":"lexeme","sourceId":"` + newUUID(t) + `","prompt":"{\"text\":\"shape fixture\"}","choices":[],"correctAnswer":"{\"key\":\"A\"}"}`
	for _, tc := range []struct{ field, good, bad string }{{"prompt", `"prompt":"{\"text\":\"shape fixture\"}"`, `"prompt":"null"`}, {"correctAnswer", `"correctAnswer":"{\"key\":\"A\"}"`, `"correctAnswer":"null"`}, {"choices", `"choices":[]`, `"choices":{}`}} {
		body := strings.Replace(legacy, tc.good, tc.bad, 1)
		res := request(http.MethodPost, "/api/admin/exercises", body)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("exercise create prompt shape status=%d body=%s for %s; want 400", res.Code, res.Body.String(), tc.field)
		}
	}
	base := `{"exerciseType":"translation","sourceType":"lexeme","sourceId":"` + newUUID(t) + `","prompt":{"text":"shape fixture"},"choices":[],"correctAnswer":{"key":"A"}}`
	created := request(http.MethodPost, "/api/admin/exercises", base)
	if created.Code != http.StatusCreated {
		t.Fatalf("valid shape fixture create status=%d body=%s request=%s", created.Code, created.Body.String(), base)
	}
	var fixture struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &fixture); err != nil || fixture.ID == "" {
		t.Fatalf("valid shape fixture response=%s", created.Body.String())
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2`, actorID, fixture.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE id=$1`, fixture.ID)
	})
	for _, tc := range []struct{ field, value string }{{"prompt", "null"}, {"correctAnswer", "null"}, {"choices", `{}`}} {
		res := request(http.MethodPut, "/api/admin/exercises/"+fixture.ID, `{"`+tc.field+`":`+tc.value+`}`)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("exercise update prompt shape status=%d body=%s for %s; want 400", res.Code, res.Body.String(), tc.field)
		}
	}
}

func TestAdminExerciseConfigDefaultsToSharedContract(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	sessions := session.NewStore(db)
	const exerciseType, placement = "cloze", "daily_hub"
	_, _, _ = snapshotExerciseConfig(t, db, exerciseType, placement)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 AND target_type='exercise_config'`, actorID)
	})
	req := httptest.NewRequest(http.MethodPut, "/api/admin/exercises/config", strings.NewReader(`{"exerciseType":"cloze","placement":"daily_hub"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("default config upsert status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var enabled bool
	var displayOrder, points int
	if err := db.QueryRow(context.Background(), `SELECT enabled,display_order,points_per_correct FROM exercise.exercise_config WHERE exercise_type=$1 AND placement=$2`, exerciseType, placement).Scan(&enabled, &displayOrder, &points); err != nil {
		t.Fatal(err)
	}
	if !enabled || displayOrder != 0 || points != 10 {
		t.Fatalf("config defaults enabled=%t displayOrder=%d points=%d; want true, 0, 10", enabled, displayOrder, points)
	}
}

func TestAdminExerciseDeletePreservesAnswerHistory(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	var exerciseID, sessionID string
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise (exercise_type,source_type,source_id,prompt,correct_answer) VALUES ('translation','lexeme',$1,'{"text":"preserve"}','{"key":"A"}') RETURNING id::text`, newUUID(t)).Scan(&exerciseID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise_session (user_id,session_type,exercise_type,exercise_ids,status,total_questions) VALUES ($1,'practice_tab','translation',$2,'completed',1) RETURNING id::text`, newUUID(t), []string{exerciseID}).Scan(&sessionID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO exercise.exercise_answer (session_id,exercise_id,user_answer,is_correct) VALUES ($1,$2,'{"key":"A"}',true)`, sessionID, exerciseID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_session WHERE id=$1`, sessionID)
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE id=$1`, exerciseID)
	})
	req := httptest.NewRequest(http.MethodDelete, "/api/admin/exercises/"+exerciseID, nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, session.NewStore(db), actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	res := httptest.NewRecorder()
	buildDailyRadarTestRouter(db).ServeHTTP(res, req)
	if res.Code != http.StatusConflict {
		t.Fatalf("exercise delete with answer history status=%d body=%s; want 409", res.Code, res.Body.String())
	}
	var exercises, answers, audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM exercise.exercise WHERE id=$1`, exerciseID).Scan(&exercises); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM exercise.exercise_answer WHERE exercise_id=$1`, exerciseID).Scan(&answers); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='exercise.deleted'`, actorID, exerciseID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if exercises != 1 || answers != 1 || audits != 0 {
		t.Fatalf("exercise rows=%d answer rows=%d delete audits=%d; want 1, 1, 0", exercises, answers, audits)
	}
}

func TestAdminExerciseWriteRequiresPermissionAndTrustedOrigin(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API reader", actorID+"@example.com")
	router := buildDailyRadarTestRouter(db)
	sessionToken := createAdminSession(t, session.NewStore(db), actorID)
	for _, tc := range []struct{ name, origin string }{{"roleless", "http://localhost:18081"}, {"untrusted-origin", "https://attacker.example"}} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name == "untrusted-origin" {
				grantDailyRadarWritePermission(t, db, actorID)
			}
			req := httptest.NewRequest(http.MethodPost, "/api/admin/exercises", strings.NewReader(`{"exerciseType":"audit_denied","sourceType":"lexeme","sourceId":"`+newUUID(t)+`","prompt":{"text":"blocked"},"correctAnswer":{"key":"A"}}`))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: sessionToken})
			req.Header.Set("Origin", tc.origin)
			req.Header.Set("Content-Type", "application/json")
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("roleless exercise create status=%d body=%s; want 403", res.Code, res.Body.String())
			}
			var count int
			if err := db.QueryRow(context.Background(), `SELECT count(*) FROM exercise.exercise WHERE exercise_type='audit_denied' AND prompt->>'text'='blocked'`).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if count != 0 {
				t.Fatalf("denied request persisted %d exercises", count)
			}
		})
	}
}

func TestAdminExerciseMissingIDsReturnNotFound(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	router := buildDailyRadarTestRouter(db)
	sessions := session.NewStore(db)
	for _, tc := range []struct{ method, path, body string }{
		{http.MethodGet, "/api/admin/exercises/00000000-0000-4000-8000-000000000000", ""},
		{http.MethodPut, "/api/admin/exercises/00000000-0000-4000-8000-000000000000", `{"prompt":{"text":"missing"}}`},
		{http.MethodDelete, "/api/admin/exercises/00000000-0000-4000-8000-000000000000", ""},
		{http.MethodDelete, "/api/admin/exercises/config/00000000-0000-4000-8000-000000000000", ""},
	} {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
		req.Header.Set("Origin", "http://localhost:18081")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusNotFound {
			if tc.method == http.MethodPut {
				t.Fatalf("missing exercise update status=%d body=%s; want 404", res.Code, res.Body.String())
			}
			t.Fatalf("missing %s %s status=%d body=%s; want 404", tc.method, tc.path, res.Code, res.Body.String())
		}
	}
}

func TestAdminExerciseAuditFailureRollsBack(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Exercise API writer", actorID+"@example.com")
	grantDailyRadarWritePermission(t, db, actorID)
	placement := "post_review"
	before, existed, _ := snapshotExerciseConfig(t, db, "meaning_match", placement)
	fn := "audit124_reject_exercise_" + strings.ReplaceAll(actorID, "-", "")
	trigger := "audit124_reject_exercise_audit_" + strings.ReplaceAll(actorID, "-", "")
	if _, err := db.Exec(context.Background(), `CREATE FUNCTION public.`+fn+`() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='exercise.config.upserted' AND NEW.target_type='exercise_config' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `CREATE TRIGGER `+trigger+` BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.`+fn+`() `); err != nil {
		_, _ = db.Exec(context.Background(), `DROP FUNCTION public.`+fn+`() `)
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DROP TRIGGER IF EXISTS `+trigger+` ON ops.admin_audit_log`)
		_, _ = db.Exec(context.Background(), `DROP FUNCTION IF EXISTS public.`+fn+`() `)
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='exercise_config' AND actor_id=$1`, actorID)
	})
	req := httptest.NewRequest(http.MethodPut, "/api/admin/exercises/config", strings.NewReader(`{"exerciseType":"meaning_match","placement":"`+placement+`","displayOrder":8,"enabled":true,"pointsPerCorrect":8}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, session.NewStore(db), actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	buildDailyRadarTestRouter(db).ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("exercise config upsert after audit failure=%d body=%s; want 500", res.Code, res.Body.String())
	}
	var after []byte
	err := db.QueryRow(context.Background(), `SELECT to_jsonb(c) FROM exercise.exercise_config c WHERE exercise_type='meaning_match' AND placement=$1`, placement).Scan(&after)
	if existed && (err != nil || string(before) != string(after)) {
		t.Fatalf("existing exercise config changed after failed audit: err=%v before=%s after=%s", err, before, after)
	}
	if !existed && err != pgx.ErrNoRows {
		t.Fatalf("failed audit left config row: err=%v after=%s", err, after)
	}
}
