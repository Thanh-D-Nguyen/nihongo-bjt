package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestAdminContentReadsRequireReadPermission(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-read.example.com", "Content Read Admin")
	token := createAdminSession(t, sessions, actorID)
	paths := []string{
		"/api/admin/content?type=lexeme&page=1&pageSize=1",
		"/api/admin/content/summary?type=lexeme",
	}
	for _, path := range paths {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous GET %s status=%d body=%s; want 401", path, res.Code, res.Body.String())
		}
	}
	for _, path := range paths {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("GET %s status=%d body=%s; want 403 without admin.content.read", path, res.Code, res.Body.String())
		}
	}

	grantAdminPermission(t, db, actorID, "admin.content.read")
	for _, path := range paths {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("GET %s status=%d body=%s; want 200 with admin.content.read", path, res.Code, res.Body.String())
		}
	}
}

func TestAdminContentWritesRequireWritePermission(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@content-write.example.com", "Content Write Admin")
	token := createAdminSession(t, sessions, actorID)
	paths := []string{
		"/api/admin/lexemes/00000000-0000-4000-8000-000000000001/examples",
		"/api/admin/content",
		"/api/admin/content/lexeme/00000000-0000-4000-8000-000000000001/status",
	}
	for i, path := range paths {
		method := http.MethodPost
		if i == 2 {
			method = http.MethodPatch
		}
		req := httptest.NewRequest(method, path, strings.NewReader(`{}`))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("roleless %s %s status=%d body=%s; want 403", method, path, res.Code, res.Body.String())
		}
	}
}

func TestAdminContentListFiltersLexemesByReading(t *testing.T) {
	db := testPool(t)
	reading := "audit-reading-" + newUUID(t)
	headword := "audit-headword-" + newUUID(t)
	shortMeaning := "fixture meaning for edit form"
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (headword, reading, short_meaning_vi, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, headword, reading, shortMeaning); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE headword=$1`, headword) })
	path := "/api/admin/content?" + url.Values{"type": {"lexeme"}, "reading": {reading}, "page": {"1"}, "pageSize": {"10"}}.Encode()
	recorder := httptest.NewRecorder()
	adminContentListHandler(db, testLogger()).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	var result struct {
		Items []struct {
			Headword       string `json:"headword"`
			Reading        string `json:"reading"`
			ShortMeaningVi string `json:"shortMeaningVi"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 || len(result.Items) != 1 || result.Items[0].Headword != headword || result.Items[0].Reading != reading || result.Items[0].ShortMeaningVi != shortMeaning {
		t.Fatalf("reading filter returned total=%d items=%+v; want only %s/%s", result.Total, result.Items, headword, reading)
	}
}

func TestAdminContentListReadingFilterDoesNotInterpolateInput(t *testing.T) {
	db := testPool(t)
	reading := `%'); DROP TABLE content.lexeme;--`
	path := "/api/admin/content?type=lexeme&reading=" + url.QueryEscape(reading) + "&page=1&pageSize=1"
	recorder := httptest.NewRecorder()
	adminContentListHandler(db, testLogger()).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s; want 200 for parameterized reading", recorder.Code, recorder.Body.String())
	}
	var result struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Total != 0 {
		t.Fatalf("unsafe reading filter unexpectedly matched %d records: %q", result.Total, reading)
	}
}

func TestAdminKanjiStrokeCountFiltersApplyToListAndSummary(t *testing.T) {
	db := testPool(t)
	lowID, highID := newUUID(t), newUUID(t)
	lowCharacter := "K" + strings.ReplaceAll(lowID, "-", "")[:7]
	highCharacter := "K" + strings.ReplaceAll(highID, "-", "")[:7]
	for _, item := range []struct {
		id, character string
		strokeCount   int
		level         int
	}{{lowID, lowCharacter, 9, 2}, {highID, highCharacter, 12, 3}} {
		if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji
			(id,character,stroke_count,level,status,created_at,updated_at) VALUES ($1,$2,$3,$4,'active',NOW(),NOW())`,
			item.id, item.character, item.strokeCount, item.level); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id IN ($1,$2)`, lowID, highID)
	})

	for _, tc := range []struct {
		name, param, value, wantCharacter string
		wantStrokeCount, wantTotal        int
	}{
		{name: "minimum", param: "strokeCountMin", value: "10", wantCharacter: highCharacter, wantStrokeCount: 12, wantTotal: 1},
		{name: "maximum", param: "strokeCountMax", value: "10", wantCharacter: lowCharacter, wantStrokeCount: 9, wantTotal: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			query := url.Values{"type": {"kanji"}, "page": {"1"}, "pageSize": {"20"}, tc.param: {tc.value}}
			path := "/api/admin/content?" + query.Encode()
			list := httptest.NewRecorder()
			adminContentListHandler(db, testLogger()).ServeHTTP(list, httptest.NewRequest(http.MethodGet, path, nil))
			if list.Code != http.StatusOK {
				t.Fatalf("list status=%d body=%s; want 200", list.Code, list.Body.String())
			}
			var result struct {
				Items []struct {
					Character   string `json:"character"`
					StrokeCount *int   `json:"strokeCount"`
				} `json:"items"`
				Total int `json:"total"`
			}
			if err := json.Unmarshal(list.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if result.Total != tc.wantTotal || len(result.Items) != 1 || result.Items[0].Character != tc.wantCharacter || result.Items[0].StrokeCount == nil || *result.Items[0].StrokeCount != tc.wantStrokeCount {
				t.Fatalf("list result total=%d items=%+v; want %s strokeCount=%d", result.Total, result.Items, tc.wantCharacter, tc.wantStrokeCount)
			}

			summary := httptest.NewRecorder()
			adminContentSummaryHandler(db, testLogger()).ServeHTTP(summary, httptest.NewRequest(http.MethodGet, "/api/admin/content/summary?"+query.Encode(), nil))
			var aggregate struct {
				ByLevel  map[string]int `json:"byLevel"`
				ByStatus map[string]int `json:"byStatus"`
				Total    int            `json:"total"`
			}
			if summary.Code != http.StatusOK {
				t.Fatalf("summary status=%d body=%s; want 200", summary.Code, summary.Body.String())
			}
			if err := json.Unmarshal(summary.Body.Bytes(), &aggregate); err != nil {
				t.Fatal(err)
			}
			if aggregate.Total != tc.wantTotal || aggregate.ByLevel[map[string]string{lowCharacter: "2", highCharacter: "3"}[tc.wantCharacter]] != tc.wantTotal || aggregate.ByStatus["active"] != tc.wantTotal {
				t.Fatalf("summary=%+v; want total/active/level=%d for %s", aggregate, tc.wantTotal, tc.wantCharacter)
			}
		})
	}
	for _, query := range []url.Values{
		{"type": {"kanji"}, "strokeCountMin": {"not-a-number"}},
		{"type": {"kanji"}, "strokeCountMax": {"201"}},
		{"type": {"kanji"}, "strokeCountMin": {"12"}, "strokeCountMax": {"9"}},
	} {
		for _, handler := range []http.HandlerFunc{adminContentListHandler(db, testLogger()), adminContentSummaryHandler(db, testLogger())} {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/admin/content?"+query.Encode(), nil))
			if response.Code != http.StatusBadRequest {
				t.Fatalf("query %s returned status=%d body=%s; want 400", query.Encode(), response.Code, response.Body.String())
			}
		}
	}
}
