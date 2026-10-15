package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminDailyRadarModulesListReturnsClientContract(t *testing.T) {
	db := testPool(t)
	moduleKey := "audit-module-list-20261007"
	var moduleID string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
		VALUES($1,'Module list fixture','監査','Fixture description','daily','reading','draft',true,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/daily-radar/modules?limit=100&q="+moduleKey+"&status=draft", nil)
	adminDailyRadarModulesListHandler(db, testLogger()).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	var result struct {
		Items    []map[string]any `json:"items"`
		PageSize int              `json:"pageSize"`
		Total    int              `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 || len(result.Items) != 1 || result.PageSize != 100 {
		t.Fatalf("unexpected filtered module page: %+v", result)
	}
	item := result.Items[0]
	if item["id"] != moduleID || item["moduleKey"] != moduleKey || item["titleVi"] != "Module list fixture" || item["category"] != "daily" {
		t.Fatalf("module row does not match client contract: %+v", item)
	}
}
