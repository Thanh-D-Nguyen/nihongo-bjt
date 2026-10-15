package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminPetAndStreakRoutesEnforceContentPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("pet-streak-audit144-%s@example.test", actorID[:8]), "Pet Streak Admin")
	token := createAdminSession(t, sessions, actorID)
	petID, userID, streakID := newUUID(t), newUUID(t), newUUID(t)
	petName := "Audit pet " + petID[:8]
	streakName := "Audit streak " + streakID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.companion_pet
		(id,user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at)
		VALUES ($1,$2,$3,'adult',50,60,'neutral',4,NOW(),NOW())`, petID, userID, petName); err != nil {
		t.Fatalf("seed pet: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.streak_config
		(id,name,activity_type,min_actions_per_day,freezes_allowed,enabled,created_at,updated_at)
		VALUES ($1,$2,'review',2,1,true,NOW(),NOW())`, streakID, streakName); err != nil {
		t.Fatalf("seed streak: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, petID)
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.companion_pet WHERE id=$1`, petID)
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.streak_config WHERE id=$1`, streakID)
	})

	petPath := "/api/admin/gamification/pets/" + petID
	cases := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/admin/gamification/pets/stats", ""},
		{http.MethodGet, petPath, ""},
		{http.MethodPut, petPath, `{"stage":"teen","xp":80,"happiness":30,"name":"Updated pet"}`},
		{http.MethodPost, petPath + "/reset", ""},
		{http.MethodGet, "/api/admin/gamification/streaks", ""},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			anonymous := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(anonymous, httptest.NewRequest(tc.method, tc.path, nil))
			if anonymous.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", anonymous.Code, anonymous.Body.String())
			}
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			req.Header.Set("Origin", "http://localhost:3000")
			if tc.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			roleless := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(roleless, req)
			if roleless.Code != http.StatusForbidden {
				t.Fatalf("roleless status=%d body=%s; want 403", roleless.Code, roleless.Body.String())
			}
		})
	}

	grantAdminPermission(t, db, actorID, "admin.content.read")
	do := func(method, path, body string, origin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		if origin {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	for _, tc := range []struct{ method, path, body string }{
		{http.MethodPut, petPath, `{"xp":8}`},
		{http.MethodPost, petPath + "/reset", ""},
	} {
		if got := do(tc.method, tc.path, tc.body, true).Code; got != http.StatusForbidden {
			t.Fatalf("read-only Admin %s %s status=%d; want 403", tc.method, tc.path, got)
		}
	}
	missingOrigin := do(http.MethodPut, petPath, `{"xp":8}`, false)
	if missingOrigin.Code != http.StatusForbidden {
		t.Fatalf("missing-origin PUT status=%d body=%s; want 403", missingOrigin.Code, missingOrigin.Body.String())
	}
	grantAdminPermission(t, db, actorID, "admin.content.write")
	missingOrigin = do(http.MethodPut, petPath, `{"xp":8}`, false)
	if missingOrigin.Code != http.StatusForbidden {
		t.Fatalf("write-enabled Admin missing-origin PUT status=%d body=%s; want 403", missingOrigin.Code, missingOrigin.Body.String())
	}
	missingOriginReset := do(http.MethodPost, petPath+"/reset", "", false)
	if missingOriginReset.Code != http.StatusForbidden {
		t.Fatalf("write-enabled Admin missing-origin reset status=%d body=%s; want 403", missingOriginReset.Code, missingOriginReset.Body.String())
	}

	stats := do(http.MethodGet, "/api/admin/gamification/pets/stats", "", false)
	if stats.Code != http.StatusOK {
		t.Fatalf("stats status=%d body=%s", stats.Code, stats.Body.String())
	}
	var statsBody struct {
		Total   int `json:"total"`
		ByStage []struct {
			Stage string `json:"stage"`
			Count int    `json:"count"`
		} `json:"byStage"`
		AvgHappiness int `json:"avgHappiness"`
		AvgXP        int `json:"avgXp"`
	}
	if err := json.Unmarshal(stats.Body.Bytes(), &statsBody); err != nil || statsBody.Total < 1 {
		t.Fatalf("stats contract body=%s err=%v", stats.Body.String(), err)
	}
	var expectedTotal, expectedAdult, expectedHappiness, expectedXP int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*), COUNT(*) FILTER (WHERE stage='adult'),
		COALESCE(ROUND(AVG(happiness)),0)::int, COALESCE(ROUND(AVG(xp)),0)::int
		FROM gamification.companion_pet`).Scan(&expectedTotal, &expectedAdult, &expectedHappiness, &expectedXP); err != nil {
		t.Fatalf("read expected pet statistics: %v", err)
	}
	var adultCount int
	for _, stage := range statsBody.ByStage {
		if stage.Stage == "adult" {
			adultCount = stage.Count
		}
	}
	if statsBody.Total != expectedTotal || adultCount != expectedAdult || statsBody.AvgHappiness != expectedHappiness || statsBody.AvgXP != expectedXP {
		t.Fatalf("pet statistics=%+v adult=%d; want total=%d adult=%d happiness=%d xp=%d", statsBody, adultCount, expectedTotal, expectedAdult, expectedHappiness, expectedXP)
	}

	detail := do(http.MethodGet, petPath, "", false)
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"userId":"`+userID+`"`) {
		t.Fatalf("pet detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	missingDetail := do(http.MethodGet, "/api/admin/gamification/pets/"+newUUID(t), "", false)
	if missingDetail.Code != http.StatusNotFound {
		t.Fatalf("missing detail status=%d body=%s; want 404", missingDetail.Code, missingDetail.Body.String())
	}
	invalidUpdate := do(http.MethodPut, petPath, `{"stage":"invalid"}`, true)
	if invalidUpdate.Code != http.StatusBadRequest {
		t.Fatalf("invalid pet update status=%d body=%s; want 400", invalidUpdate.Code, invalidUpdate.Body.String())
	}
	invalidXP := do(http.MethodPut, petPath, `{"xp":-1}`, true)
	if invalidXP.Code != http.StatusBadRequest {
		t.Fatalf("negative XP update status=%d body=%s; want 400", invalidXP.Code, invalidXP.Body.String())
	}
	tooLargeXP := do(http.MethodPut, petPath, `{"xp":2147483648}`, true)
	if tooLargeXP.Code != http.StatusBadRequest {
		t.Fatalf("out-of-range XP update status=%d body=%s; want 400", tooLargeXP.Code, tooLargeXP.Body.String())
	}
	updated := do(http.MethodPut, petPath, `{"stage":"teen","xp":80,"happiness":30,"name":"Updated pet"}`, true)
	if updated.Code != http.StatusOK {
		t.Fatalf("pet update status=%d body=%s", updated.Code, updated.Body.String())
	}
	var stage, name, mood string
	var xp, happiness int
	if err := db.QueryRow(context.Background(), `SELECT stage,name,mood,xp,happiness FROM gamification.companion_pet WHERE id=$1`, petID).Scan(&stage, &name, &mood, &xp, &happiness); err != nil || stage != "teen" || name != "Updated pet" || mood != "sad" || xp != 80 || happiness != 30 {
		t.Fatalf("updated pet state=(%s,%s,%s,%d,%d) err=%v", stage, name, mood, xp, happiness, err)
	}
	var auditCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.gamification.pet.updated'`, petID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("pet update audit count=%d err=%v; want 1", auditCount, err)
	}
	missingUpdate := do(http.MethodPut, "/api/admin/gamification/pets/"+newUUID(t), `{"xp":8}`, true)
	if missingUpdate.Code != http.StatusNotFound {
		t.Fatalf("missing update status=%d body=%s; want 404", missingUpdate.Code, missingUpdate.Body.String())
	}

	reset := do(http.MethodPost, petPath+"/reset", "", true)
	if reset.Code != http.StatusOK {
		t.Fatalf("pet reset status=%d body=%s", reset.Code, reset.Body.String())
	}
	if err := db.QueryRow(context.Background(), `SELECT stage,xp,happiness,mood,total_feedings FROM gamification.companion_pet WHERE id=$1`, petID).Scan(&stage, &xp, &happiness, &mood, &auditCount); err != nil || stage != "egg" || xp != 0 || happiness != 100 || mood != "happy" || auditCount != 0 {
		t.Fatalf("reset pet state=(%s,%d,%d,%s,%d) err=%v", stage, xp, happiness, mood, auditCount, err)
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.gamification.pet.reset'`, petID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("pet reset audit count=%d err=%v; want 1", auditCount, err)
	}
	missingReset := do(http.MethodPost, "/api/admin/gamification/pets/"+newUUID(t)+"/reset", "", true)
	if missingReset.Code != http.StatusNotFound {
		t.Fatalf("missing reset status=%d body=%s; want 404", missingReset.Code, missingReset.Body.String())
	}

	streaks := do(http.MethodGet, "/api/admin/gamification/streaks", "", false)
	if streaks.Code != http.StatusOK || !strings.Contains(streaks.Body.String(), streakName) {
		t.Fatalf("streak list status=%d body=%s", streaks.Code, streaks.Body.String())
	}
}

func TestAdminPetAndStreakReadsReturnDatabaseErrors(t *testing.T) {
	db := testPool(t)
	db.Close()
	for _, tc := range []struct {
		name    string
		path    string
		handler http.HandlerFunc
	}{
		{"pet stats", "/api/admin/gamification/pets/stats", adminPetsStatsHandler(db, testLogger())},
		{"pet detail", "/api/admin/gamification/pets/" + newUUID(t), adminPetDetailHandler(db, testLogger())},
		{"streak list", "/api/admin/gamification/streaks", adminStreakConfigsListHandler(db, testLogger())},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			tc.handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, tc.path, nil))
			if response.Code != http.StatusInternalServerError {
				t.Fatalf("database failure status=%d body=%s; want 500", response.Code, response.Body.String())
			}
		})
	}
}

func TestAdminPetMutationsRollBackWhenAuditInsertFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID, petID, userID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@pet-audit-failure.example.test", "Pet Audit Failure")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.companion_pet
		(id,user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at)
		VALUES ($1,$2,'Audit rollback pet','adult',50,60,'neutral',4,NOW(),NOW())`, petID, userID); err != nil {
		t.Fatalf("seed pet: %v", err)
	}
	triggerName := "fail_pet_audit_" + strings.ReplaceAll(petID, "-", "")
	functionName := triggerName + "_fn"
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.target_type='gamification.companion_pet' AND NEW.target_id='%s' AND NEW.action IN ('admin.gamification.pet.updated','admin.gamification.pet.reset') THEN
		RAISE EXCEPTION 'injected pet audit failure';
	END IF;
	RETURN NEW;
END $$`, functionName, petID)); err != nil {
		t.Fatalf("create audit failure function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.%s()`, triggerName, functionName)); err != nil {
		t.Fatalf("create audit failure trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON ops.admin_audit_log`, triggerName))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS public.%s()`, functionName))
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, petID)
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.companion_pet WHERE id=$1`, petID)
	})

	for _, tc := range []struct{ method, path, body string }{
		{http.MethodPut, "/api/admin/gamification/pets/" + petID, `{"stage":"teen","xp":80,"happiness":30,"name":"Changed"}`},
		{http.MethodPost, "/api/admin/gamification/pets/" + petID + "/reset", ""},
	} {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		response := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(response, req)
		if response.Code != http.StatusInternalServerError {
			t.Fatalf("%s %s status=%d body=%s; want 500", tc.method, tc.path, response.Code, response.Body.String())
		}
		var stage, name, mood string
		var xp, happiness, feedings int
		if err := db.QueryRow(context.Background(), `SELECT name,stage,xp,happiness,mood,total_feedings FROM gamification.companion_pet WHERE id=$1`, petID).
			Scan(&name, &stage, &xp, &happiness, &mood, &feedings); err != nil {
			t.Fatalf("read pet after %s audit failure: %v", tc.method, err)
		}
		if name != "Audit rollback pet" || stage != "adult" || xp != 50 || happiness != 60 || mood != "neutral" || feedings != 4 {
			t.Fatalf("%s partially persisted despite failed audit: %q/%q/%d/%d/%q/%d", tc.method, name, stage, xp, happiness, mood, feedings)
		}
	}
}
