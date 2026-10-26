package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"testing"
	"time"
)

func TestAdminOpsBJTDashboard(t *testing.T) {
	ctx := context.Background()
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@example.test", "BJT Dashboard Reader")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	token := createAdminSession(t, sessions, actorID)
	exec := func(t *testing.T, sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	type levelCount struct {
		Level string `json:"level"`
		Count int    `json:"count"`
	}
	call := func(t *testing.T) map[string]json.RawMessage {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/admin/operations/bjt/dashboard", nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("dashboard status=%d, want 200: %s", res.Code, res.Body.String())
		}
		var got map[string]json.RawMessage
		if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		return got
	}
	baseline := call(t)
	baselineCounts := map[string]int{}
	for _, key := range []string{"bjtTestsTotal", "bjtTestsActive", "bjtSessionsTotal", "bjtAttempts30d"} {
		var count int
		if err := json.Unmarshal(baseline[key], &count); err != nil {
			t.Fatal(err)
		}
		baselineCounts[key] = count
	}
	var baselineLevels []levelCount
	if err := json.Unmarshal(baseline["byLevel"], &baselineLevels); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name       string
		fixtures   bool
		nullLevel  bool
		noAttempts bool
	}{
		{name: "null_and_empty_levels", fixtures: true, nullLevel: true},
		{name: "published_and_30_day_window", fixtures: true},
		{name: "no_attempts", fixtures: true, noAttempts: true},
		{name: "no_new_data"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			testIDs := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
			t.Cleanup(func() {
				exec(t, `DELETE FROM assessment.quiz_session WHERE test_id=ANY($1::uuid[])`, testIDs)
				exec(t, `DELETE FROM assessment.bjt_mock_test WHERE id=ANY($1::uuid[])`, testIDs)
			})
			if tc.fixtures {
				exec(t, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,level,updated_at)
					VALUES ($1::uuid,$1::text,'Published','official','published','J2',now()),
					($2::uuid,$2::text,'Draft','practice','draft','',now()),
					($3::uuid,$3::text,'Legacy','practice','active','',now()),
					($4::uuid,$4::text,'Published two','practice','published','',now())`, testIDs[0], testIDs[1], testIDs[2], testIDs[3])
				if tc.nullLevel {
					exec(t, `UPDATE assessment.bjt_mock_test SET level=NULL WHERE id=$1`, testIDs[0])
				}
				offsets := []string{"-31 days", "-30 days 1 minute", "-1 day", "0 days", "1 day"}
				if tc.noAttempts {
					offsets = []string{"-31 days", "1 day"}
				}
				for _, offset := range offsets {
					exec(t, `INSERT INTO assessment.quiz_session (user_id,test_id,status,started_at,completed_at,estimated_score)
						VALUES ($1,$2,'completed',now()+$3::interval,now(),800)`, newUUID(t), testIDs[0], offset)
				}
				// Historical submissions must never become a pass-rate numerator.
				exec(t, `INSERT INTO assessment.quiz_session (user_id,test_id,status,started_at)
					VALUES ($1,$2,'submitted',now()-interval '90 days')`, newUUID(t), testIDs[0])
			}
			got := call(t)
			keys := []string{"generatedAt", "partial_schema_pending", "bjtTestsTotal", "bjtTestsActive", "bjtSessionsTotal", "bjtAttempts30d", "bjtPassRate30d", "byLevel"}
			if len(got) != len(keys) {
				t.Errorf("dashboard JSON keys=%v, want %v", got, keys)
			}
			for _, key := range keys {
				if _, ok := got[key]; !ok {
					t.Errorf("dashboard missing JSON key %s", key)
				}
			}
			wantCounts := map[string]int{"bjtTestsTotal": 0, "bjtTestsActive": 0, "bjtSessionsTotal": 0, "bjtAttempts30d": 0}
			wantLevels := []levelCount{}
			if tc.fixtures {
				wantCounts = map[string]int{"bjtTestsTotal": 4, "bjtTestsActive": 2, "bjtSessionsTotal": 6, "bjtAttempts30d": 3}
				if tc.noAttempts {
					wantCounts["bjtSessionsTotal"] = 3
					wantCounts["bjtAttempts30d"] = 0
				}
				wantLevels = []levelCount{{"J2", 1}, {"unknown", 3}}
				if tc.nullLevel {
					wantLevels = []levelCount{{"unknown", 4}}
				}
			}
			for key, want := range wantCounts {
				want += baselineCounts[key]
				var count int
				if err := json.Unmarshal(got[key], &count); err != nil || count != want {
					t.Errorf("dashboard %s=%s, want %d (decode: %v)", key, got[key], want, err)
				}
			}
			wantByLevel := map[string]int{}
			for _, level := range append(append([]levelCount{}, baselineLevels...), wantLevels...) {
				wantByLevel[level.Level] += level.Count
			}
			var levels []levelCount
			if err := json.Unmarshal(got["byLevel"], &levels); err != nil {
				t.Fatal(err)
			}
			byLevel := map[string]int{}
			for _, level := range levels {
				if _, duplicate := byLevel[level.Level]; duplicate {
					t.Errorf("dashboard duplicate level %q", level.Level)
				}
				byLevel[level.Level] = level.Count
			}
			if !reflect.DeepEqual(byLevel, wantByLevel) || string(got["byLevel"]) == "null" {
				t.Errorf("dashboard byLevel=%s, want %v", got["byLevel"], wantByLevel)
			}
			if string(got["bjtPassRate30d"]) != "null" {
				t.Errorf("dashboard bjtPassRate30d=%s, want null without canonical pass criteria", got["bjtPassRate30d"])
			}
			var pending []string
			if err := json.Unmarshal(got["partial_schema_pending"], &pending); err != nil || !slices.Contains(pending, "bjt_pass_rate_30d") || !slices.Contains(pending, "per_skill_pass_rate") || !slices.Contains(pending, "upcoming_exam_dates") {
				t.Errorf("dashboard pending=%s, want unavailable metrics (decode: %v)", got["partial_schema_pending"], err)
			}
			var generatedAt string
			if err := json.Unmarshal(got["generatedAt"], &generatedAt); err != nil {
				t.Fatal(err)
			}
			if _, err := time.Parse(time.RFC3339, generatedAt); err != nil {
				t.Errorf("dashboard generatedAt: %v", err)
			}
		})
	}
}
