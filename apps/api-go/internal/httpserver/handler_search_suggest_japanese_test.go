package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestSearchSuggestJapaneseMatching(t *testing.T) {
	db := testPool(t)
	router := audit159Wave11Router(t)
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	_, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id, headword, reading, status, created_at, updated_at)
		VALUES ($1, '会議', 'かいぎ', 'active', now(), now()),
		($2, 'WEB会議用品', 'うぇぶかいぎようひん', 'active', now(), now()),
		($3, '会議室', 'かいぎしつ', 'active', now(), now()),
		($4, 'コーヒー', 'コーヒー', 'active', now(), now()),
		($5, '海', 'かい', 'active', now(), now()),
		($6, 'ニュース', 'ニュース', 'active', now(), now()),
		($7, '京都', 'きょうと', 'active', now(), now())`, ids[0], ids[1], ids[2], ids[3], ids[4], ids[5], ids[6])
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=ANY($1::uuid[])`, ids); err != nil {
			t.Error(err)
		}
	})
	for _, query := range []string{"会議", "かいぎ", "カイギ", "kaigi"} {
		t.Run(query, func(t *testing.T) {
			res := audit159Wave11Get(t, router, "/api/search/suggest?q="+url.QueryEscape(query)+"&limit=6")
			var got []struct {
				Title string `json:"title"`
			}
			if res.Code != http.StatusOK {
				t.Fatalf("query %q status=%d body=%s", query, res.Code, res.Body.String())
			}
			if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if len(got) == 0 || got[0].Title != "会議" {
				t.Errorf("query %q suggestions=%+v, want 会議 first", query, got)
			}
		})
	}
	res := audit159Wave11Get(t, router, "/api/search/suggest?q=koohii&limit=6")
	if !strings.Contains(res.Body.String(), "コーヒー") {
		t.Errorf("query koohii suggestions=%s, want コーヒー", res.Body.String())
	}
	res = audit159Wave11Get(t, router, "/api/search/suggest?q=nyuusu&limit=6")
	if !strings.Contains(res.Body.String(), "ニュース") {
		t.Errorf("query nyuusu suggestions=%s, want ニュース", res.Body.String())
	}
	res = audit159Wave11Get(t, router, "/api/search/suggest?q=kaig&limit=1")
	if !strings.Contains(res.Body.String(), "会議") {
		t.Errorf("query kaig suggestions=%s, want 会議", res.Body.String())
	}
	res = audit159Wave11Get(t, router, "/api/search/suggest?q=ky&limit=6")
	if !strings.Contains(res.Body.String(), "京都") {
		t.Errorf("query ky suggestions=%s, want 京都", res.Body.String())
	}
}

func TestSuggestionKanaIncrementalRomaji(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"matcha", "まっちゃ"},
		{"kaig", "かい"},
		{"ky", ""},
	} {
		got, _, _ := suggestionKana(tc.input)
		if got != tc.want {
			t.Errorf("suggestionKana(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
