package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAdminLotoFiveApiContracts(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@loto-audit.example.com", "Loto API Admin")
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	date := time.Now().UTC().AddDate(20, 0, 0).Format("2006-01-02")
	drawNumber := int(time.Now().Unix()%1000000) + 8000000
	partialDrawNumber := drawNumber + 1
	articleID := newUUID(t)
	var runIDs []string
	t.Cleanup(func() {
		for _, runID := range runIDs {
			_, _ = db.Exec(context.Background(), `DELETE FROM daily.loto_generation_run WHERE id=$1`, runID)
		}
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.loto_draw WHERE game='loto6' AND draw_number=$1`, drawNumber)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.loto_draw WHERE game='loto6' AND draw_number=$1`, partialDrawNumber)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE id=$1`, articleID)
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.admin_session WHERE actor_id=$1`, actorID)
	})
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.magazine_article
		(id,slug,widget_kind,content_date,locale,title_jp,title_vi,content_json,status,approval_status)
		VALUES ($1,$2,'magazine_loto6',$3,'vi','予想','Dự đoán',
		'{"sets":[{"mainNumbers":[1,2,3,4,5,6]}]}','published','approved')`,
		articleID, "loto-audit-"+articleID, date); err != nil {
		t.Fatalf("seed prediction article: %v", err)
	}
	do := func(method, path, body string, auth, origin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if auth {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if origin {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	t.Run("POST /api/admin/magazine/loto/generate", func(t *testing.T) {
		bad := do(http.MethodPost, "/api/admin/magazine/loto/generate", `{"game":"loto6","targetDrawDate":"x","setCount":1}`, true, true)
		if bad.Code != http.StatusBadRequest {
			t.Fatalf("short date status=%d body=%s; want 400", bad.Code, bad.Body.String())
		}
		badSuffix := do(http.MethodPost, "/api/admin/magazine/loto/generate", fmt.Sprintf(`{"game":"loto6","targetDrawDate":%q,"setCount":1}`, date+"garbage"), true, true)
		if badSuffix.Code != http.StatusBadRequest {
			t.Fatalf("malformed date suffix status=%d body=%s; want 400", badSuffix.Code, badSuffix.Body.String())
		}
		res := do(http.MethodPost, "/api/admin/magazine/loto/generate", fmt.Sprintf(`{"game":"loto6","targetDrawDate":%q,"setCount":2}`, date), true, true)
		var body struct {
			ID   string `json:"id"`
			Sets []struct {
				MainNumbers  []int `json:"mainNumbers"`
				BonusNumbers []int `json:"bonusNumbers"`
			} `json:"sets"`
			Game string `json:"game"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || body.ID == "" || body.Game != "loto6" || len(body.Sets) != 2 {
			t.Fatalf("generate status=%d body=%s", res.Code, res.Body.String())
		}
		runIDs = append(runIDs, body.ID)
		for _, set := range body.Sets {
			seen := make(map[int]bool)
			for _, number := range append(append([]int(nil), set.MainNumbers...), set.BonusNumbers...) {
				if number < 1 || number > 43 || seen[number] {
					t.Fatalf("generated Loto6 number out of range or repeated: main=%v bonus=%v", set.MainNumbers, set.BonusNumbers)
				}
				seen[number] = true
			}
		}
		var stored int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM daily.loto_generated_set WHERE run_id=$1`, body.ID).Scan(&stored); err != nil || stored != 2 {
			t.Fatalf("generated sets persisted=%d err=%v", stored, err)
		}
		var auditCount int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE action='loto.generation.created' AND target_id=$1 AND actor_id=$2`, body.ID, actorID).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("generation audit count=%d err=%v", auditCount, err)
		}
		loto7 := do(http.MethodPost, "/api/admin/magazine/loto/generate", fmt.Sprintf(`{"game":"loto7","targetDrawDate":%q,"setCount":1}`, date), true, true)
		var loto7Body struct {
			ID   string `json:"id"`
			Sets []struct {
				MainNumbers  []int `json:"mainNumbers"`
				BonusNumbers []int `json:"bonusNumbers"`
			} `json:"sets"`
		}
		if loto7.Code != http.StatusOK || json.Unmarshal(loto7.Body.Bytes(), &loto7Body) != nil || len(loto7Body.Sets) != 1 {
			t.Fatalf("Loto7 generate status=%d body=%s", loto7.Code, loto7.Body.String())
		}
		runIDs = append(runIDs, loto7Body.ID)
		set := loto7Body.Sets[0]
		seen := make(map[int]bool)
		for _, number := range append(append([]int(nil), set.MainNumbers...), set.BonusNumbers...) {
			if number < 1 || number > 37 || seen[number] {
				t.Fatalf("generated Loto7 number out of range or repeated: main=%v bonus=%v", set.MainNumbers, set.BonusNumbers)
			}
			seen[number] = true
		}
		tooMany := do(http.MethodPost, "/api/admin/magazine/loto/generate", fmt.Sprintf(`{"game":"loto6","targetDrawDate":%q,"setCount":6}`, date), true, true)
		if tooMany.Code != http.StatusBadRequest {
			t.Fatalf("excessive setCount status=%d; want 400", tooMany.Code)
		}
	})

	t.Run("POST /api/admin/magazine/loto/import-csv", func(t *testing.T) {
		csvText := fmt.Sprintf("%d,%s,1,2,3,4,5,6,7\n", drawNumber, date)
		res := do(http.MethodPost, "/api/admin/magazine/loto/import-csv", fmt.Sprintf(`{"game":"loto6","csvText":%q}`, csvText), true, true)
		var body struct {
			Created int `json:"created"`
			Updated int `json:"updated"`
			Total   int `json:"total"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || body.Created != 1 || body.Total != 1 {
			t.Fatalf("import status=%d body=%s", res.Code, res.Body.String())
		}
		var source string
		if err := db.QueryRow(context.Background(), `SELECT source_provider FROM daily.loto_draw WHERE game='loto6' AND draw_number=$1`, drawNumber).Scan(&source); err != nil || source != "csv_import" {
			t.Fatalf("import persistence source=%q err=%v", source, err)
		}
		var auditCount int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log a JOIN daily.loto_draw d ON a.target_id=d.id::text WHERE a.action='loto.csv.import' AND d.game='loto6' AND d.draw_number=$1 AND a.actor_id=$2`, drawNumber, actorID).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("CSV audit target is not the imported draw: count=%d err=%v", auditCount, err)
		}
		updateCSV := fmt.Sprintf("%d,%s,8,9,10,11,12,13,14\n", drawNumber, date)
		updated := do(http.MethodPost, "/api/admin/magazine/loto/import-csv", fmt.Sprintf(`{"game":"loto6","csvText":%q}`, updateCSV), true, true)
		var updateBody struct {
			Created int `json:"created"`
			Updated int `json:"updated"`
			Total   int `json:"total"`
		}
		if updated.Code != http.StatusOK || json.Unmarshal(updated.Body.Bytes(), &updateBody) != nil || updateBody.Created != 0 || updateBody.Updated != 1 || updateBody.Total != 1 {
			t.Fatalf("CSV upsert status=%d body=%s", updated.Code, updated.Body.String())
		}
		invalid := do(http.MethodPost, "/api/admin/magazine/loto/import-csv", `{"game":"loto6","csvText":"44,x,1"}`, true, true)
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("invalid CSV row status=%d body=%s; want 400", invalid.Code, invalid.Body.String())
		}
		badDate := fmt.Sprintf("%d,%sgarbage,1,2,3,4,5,6,7\n", partialDrawNumber, date)
		invalidDate := do(http.MethodPost, "/api/admin/magazine/loto/import-csv", fmt.Sprintf(`{"game":"loto6","csvText":%q}`, badDate), true, true)
		if invalidDate.Code != http.StatusBadRequest {
			t.Fatalf("CSV malformed date suffix status=%d; want 400", invalidDate.Code)
		}
		partial := fmt.Sprintf("%d,%s,1,2,3,4,5,6,7\n%d,x,1,2,3,4,5,6,7\n", partialDrawNumber, date, partialDrawNumber+1)
		atomic := do(http.MethodPost, "/api/admin/magazine/loto/import-csv", fmt.Sprintf(`{"game":"loto6","csvText":%q}`, partial), true, true)
		if atomic.Code != http.StatusBadRequest {
			t.Fatalf("partially invalid CSV status=%d; want 400", atomic.Code)
		}
		var partialCount int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM daily.loto_draw WHERE game='loto6' AND draw_number=$1`, partialDrawNumber).Scan(&partialCount); err != nil || partialCount != 0 {
			t.Fatalf("invalid CSV partial persistence count=%d err=%v", partialCount, err)
		}
	})

	t.Run("GET /api/admin/magazine/loto/predictions", func(t *testing.T) {
		anon := do(http.MethodGet, "/api/admin/magazine/loto/predictions?game=loto6", "", false, false)
		if anon.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous status=%d; want 401", anon.Code)
		}
		res := do(http.MethodGet, "/api/admin/magazine/loto/predictions?game=loto6&limit=1", "", true, false)
		var body struct {
			Data []struct {
				ID          string          `json:"id"`
				ContentJSON json.RawMessage `json:"contentJson"`
			} `json:"data"`
			Total int `json:"total"`
			Page  int `json:"page"`
			Limit int `json:"limit"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || body.Total < 1 || body.Page != 1 || body.Limit != 1 || len(body.Data) != 1 || body.Data[0].ID != articleID || len(body.Data[0].ContentJSON) == 0 {
			t.Fatalf("predictions status=%d body=%s", res.Code, res.Body.String())
		}
	})

	t.Run("POST /api/admin/magazine/loto/predictions/results", func(t *testing.T) {
		payload := fmt.Sprintf(`{"game":"loto6","drawNumber":%d,"drawDate":%q,"mainNumbers":[1,2,3,4,5,6],"bonusNumbers":[7]}`, drawNumber, date)
		noOrigin := do(http.MethodPost, "/api/admin/magazine/loto/predictions/results", payload, true, false)
		if noOrigin.Code != http.StatusForbidden {
			t.Fatalf("missing Origin status=%d; want 403", noOrigin.Code)
		}
		res := do(http.MethodPost, "/api/admin/magazine/loto/predictions/results", payload, true, true)
		var body struct {
			ID         string `json:"id"`
			DrawNumber int    `json:"drawNumber"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || body.ID == "" || body.DrawNumber != drawNumber {
			t.Fatalf("result status=%d body=%s", res.Code, res.Body.String())
		}
		duplicate := do(http.MethodPost, "/api/admin/magazine/loto/predictions/results", payload, true, true)
		var duplicateBody struct {
			ID string `json:"id"`
		}
		if duplicate.Code != http.StatusOK || json.Unmarshal(duplicate.Body.Bytes(), &duplicateBody) != nil || duplicateBody.ID != body.ID {
			t.Fatalf("idempotent result upsert status=%d body=%s initial=%s", duplicate.Code, duplicate.Body.String(), body.ID)
		}
		var resultCount, auditCount int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM daily.loto_draw WHERE game='loto6' AND draw_number=$1`, drawNumber).Scan(&resultCount); err != nil || resultCount != 1 {
			t.Fatalf("result rows=%d err=%v", resultCount, err)
		}
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE action='loto.result.input' AND target_id=$1 AND actor_id=$2`, body.ID, actorID).Scan(&auditCount); err != nil || auditCount != 2 {
			t.Fatalf("result audit rows=%d err=%v", auditCount, err)
		}
		shortDate := do(http.MethodPost, "/api/admin/magazine/loto/predictions/results", strings.Replace(payload, date, "x", 1), true, true)
		if shortDate.Code != http.StatusBadRequest {
			t.Fatalf("short date status=%d body=%s; want 400", shortDate.Code, shortDate.Body.String())
		}
		badDate := do(http.MethodPost, "/api/admin/magazine/loto/predictions/results", strings.Replace(payload, date, date+"garbage", 1), true, true)
		if badDate.Code != http.StatusBadRequest {
			t.Fatalf("malformed date suffix status=%d body=%s; want 400", badDate.Code, badDate.Body.String())
		}
	})

	t.Run("GET /api/admin/magazine/loto/predictions/analytics", func(t *testing.T) {
		res := do(http.MethodGet, "/api/admin/magazine/loto/predictions/analytics?game=loto6", "", true, false)
		var body struct {
			Game             string `json:"game"`
			TotalPredictions int    `json:"totalPredictions"`
			MatchedCount     int    `json:"matchedCount"`
			BestHit          int    `json:"bestHit"`
			BestDrawNumber   *int   `json:"bestDrawNumber"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || body.Game != "loto6" || body.TotalPredictions < 1 || body.MatchedCount < 1 || body.BestHit != 6 || body.BestDrawNumber == nil || *body.BestDrawNumber != drawNumber {
			t.Fatalf("analytics status=%d body=%s", res.Code, res.Body.String())
		}
		invalid := do(http.MethodGet, "/api/admin/magazine/loto/predictions/analytics?game=bad", "", true, false)
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("invalid game status=%d; want 400", invalid.Code)
		}
	})
}
