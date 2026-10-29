package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/loto"
)

func TestRejectedLotoPredictionDisappearsFromTheLearnerHubAndComesBackOnApprove(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	base := 9700000 + int(time.Now().UnixNano()%1000)*40
	if _, _, err := loto.UpsertDraws(ctx, db, lotoHistory(base, 30, "1993-01-08"), "csv_import", ""); err != nil {
		t.Fatalf("seed history: %v", err)
	}
	jst := time.FixedZone("JST", 9*3600)
	target := time.Now().In(jst).AddDate(0, 0, 3).Format("2006-01-02")
	var runID, articleID string
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM daily.magazine_article WHERE widget_kind='magazine_loto7' AND content_date=$1::date`, target)
		if runID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM daily.loto_generation_run WHERE id=$1`, runID)
		}
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_draw WHERE game='loto7' AND draw_number >= $1 AND draw_number < $2`, base, base+40)
	})
	server, sessions := lotoPipelineServer(t, db, nil)
	_, session := lotoAdminActor(t, db, sessions)

	status, generated := lotoAdminCall(t, server, session, http.MethodPost, "/api/admin/magazine/loto/generate",
		fmt.Sprintf(`{"game":"loto7","targetDrawDate":%q,"setCount":1,"seed":"moderation"}`, target))
	if status != http.StatusOK {
		t.Fatalf("generate status=%d body=%v", status, generated)
	}
	runID = generated["id"].(string)
	setID := generated["sets"].([]any)[0].(map[string]any)["id"].(string)
	status, published := lotoAdminCall(t, server, session, http.MethodPost, "/api/admin/magazine/loto/publish", fmt.Sprintf(`{"runId":%q,"setIds":[%q]}`, runID, setID))
	if status != http.StatusOK {
		t.Fatalf("publish status=%d body=%v", status, published)
	}
	articleID = published["articleId"].(string)

	visible := func() bool {
		response := httptest.NewRecorder()
		lotoNextDrawHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/next-draw?game=loto7", nil))
		var got struct {
			NextDraw *struct {
				ID string `json:"id"`
			} `json:"nextDraw"`
		}
		if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &got) != nil {
			t.Fatalf("next draw status=%d body=%s", response.Code, response.Body.String())
		}
		return got.NextDraw != nil && got.NextDraw.ID == runID
	}
	if !visible() {
		t.Fatal("a freshly published run must be visible to learners")
	}
	if status, body := lotoAdminCall(t, server, session, http.MethodPut, "/api/admin/magazine/loto/predictions/"+articleID+"/reject", `{}`); status != http.StatusOK {
		t.Fatalf("reject status=%d body=%v", status, body)
	}
	if visible() {
		t.Fatal("a rejected prediction must disappear from /next-draw")
	}
	var runStatus string
	if err := db.QueryRow(ctx, `SELECT status FROM daily.loto_generation_run WHERE id=$1`, runID).Scan(&runStatus); err != nil || runStatus != "rejected" {
		t.Fatalf("run status=%q err=%v, want rejected", runStatus, err)
	}
	if status, body := lotoAdminCall(t, server, session, http.MethodPut, "/api/admin/magazine/loto/predictions/"+articleID+"/approve", `{}`); status != http.StatusOK {
		t.Fatalf("approve status=%d body=%v", status, body)
	}
	if !visible() {
		t.Fatal("an approved prediction must be visible again")
	}
}
