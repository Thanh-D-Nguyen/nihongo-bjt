package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestBUG264DictionaryRejectsInvalidGlosses(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	prefix := "bug264-" + newUUID(t)
	cases := []struct{ name, gloss string }{
		{"english", "Sorry; I cannot provide a translation for this term."},
		{"vietnamese", "không có thông tin đủ để dịch chính xác"},
		{"vietnamese-alt", "Xin lỗi, tôi không thể cung cấp bản dịch chính xác."},
		{"mismatched-subject", "『きのこ』 có nghĩa là nấm, được sử dụng trong nhiều món ăn."},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			id, headword := newUUID(t), prefix+tc.name
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id, headword, short_meaning_vi, kanji_meaning_vi, status, updated_at) VALUES ($1,$2,$3,$3,'active',NOW())`, id, headword, tc.gloss); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, id) })
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme_sense (lexeme_id, position, meaning_vi) VALUES ($1,1,$2),($1,2,'nghĩa hợp lệ')`, id, tc.gloss); err != nil {
				t.Fatal(err)
			}
			list := httptest.NewRecorder()
			listLexemesHandler(db, testLogger()).ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/content/lexemes?q="+url.QueryEscape(headword), nil))
			if list.Code != http.StatusOK {
				t.Fatalf("list status=%d body=%s", list.Code, list.Body.String())
			}
			if strings.Contains(list.Body.String(), id) {
				t.Errorf("invalid dictionary entry remains visible: %s", list.Body.String())
			}
			detail := httptest.NewRecorder()
			getLexemeDetailHandler(db, testLogger()).ServeHTTP(detail, httptest.NewRequest(http.MethodGet, "/api/content/lexemes/"+id, nil))
			if detail.Code != http.StatusOK {
				t.Fatalf("detail status=%d body=%s", detail.Code, detail.Body.String())
			}
			var got struct {
				ShortMeaningVi *string `json:"shortMeaningVi"`
				KanjiMeaningVi *string `json:"kanjiMeaningVi"`
				Senses         []struct {
					MeaningVi string `json:"meaningVi"`
				} `json:"senses"`
			}
			if err := json.Unmarshal(detail.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.ShortMeaningVi != nil || got.KanjiMeaningVi != nil || len(got.Senses) != 1 || got.Senses[0].MeaningVi != "nghĩa hợp lệ" {
				t.Errorf("invalid dictionary gloss remains visible: %s", detail.Body.String())
			}
		})
	}
}

func TestBUG264DictionaryKeepsSensesIsolated(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	greeting, mushroom := newUUID(t), newUUID(t)
	for id, word := range map[string]string{greeting: "ありがとうございます。", mushroom: "きのこ"} {
		if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id,headword,status,updated_at) VALUES ($1,$2,'active',NOW())`, id, word); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, id) })
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme_sense (lexeme_id,position,meaning_vi) VALUES ($1,1,'cảm ơn'),($2,1,'『きのこ』 có nghĩa là nấm')`, greeting, mushroom); err != nil {
		t.Fatal(err)
	}
	for id, want := range map[string]string{greeting: "cảm ơn", mushroom: "nấm"} {
		response := httptest.NewRecorder()
		getLexemeDetailHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/content/lexemes/"+id, nil))
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), want) {
			t.Fatalf("canonical gloss missing: %s", response.Body.String())
		}
		if id == greeting && strings.Contains(response.Body.String(), "きのこ") {
			t.Fatalf("another lexeme's gloss leaked: %s", response.Body.String())
		}
	}
}

func TestDictionaryGlossKeepsLegitimateDefinitions(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	for _, tc := range []struct{ word, gloss string }{
		{"情報不足", "không đủ thông tin"},
		{"翻訳不可", "không thể dịch"},
		{"きのこ", "『きのこ』 có nghĩa là nấm"},
		{"比較", "so sánh với 『きのこ』"},
	} {
		t.Run(tc.word, func(t *testing.T) {
			id := newUUID(t)
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme
				(id, headword, short_meaning_vi, kanji_meaning_vi, status, updated_at)
				VALUES ($1,$2,$3,$3,'active',NOW())`, id, tc.word, tc.gloss); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, id) })
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme_sense
				(lexeme_id, position, meaning_vi) VALUES ($1,1,$2)`, id, tc.gloss); err != nil {
				t.Fatal(err)
			}
			response := httptest.NewRecorder()
			getLexemeDetailHandler(db, testLogger()).ServeHTTP(response,
				httptest.NewRequest(http.MethodGet, "/api/content/lexemes/"+id, nil))
			if response.Code != http.StatusOK {
				t.Fatalf("detail status=%d body=%s", response.Code, response.Body.String())
			}
			var got struct {
				ShortMeaningVi string `json:"shortMeaningVi"`
				KanjiMeaningVi string `json:"kanjiMeaningVi"`
				Senses         []struct {
					MeaningVi string `json:"meaningVi"`
				} `json:"senses"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.ShortMeaningVi != tc.gloss || got.KanjiMeaningVi != tc.gloss ||
				len(got.Senses) != 1 || got.Senses[0].MeaningVi != tc.gloss {
				t.Errorf("legitimate dictionary definition rejected: %s", response.Body.String())
			}
		})
	}
}

func TestBUG264DictionaryPaginatesUsableEntries(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	for _, rejected := range []int{1, 55} {
		t.Run(fmt.Sprintf("rejected-%d", rejected), func(t *testing.T) {
			prefix := "bug264-page-" + newUUID(t)
			t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE headword LIKE $1`, prefix+"%") })
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (headword,reading,short_meaning_vi,jlpt_level,status,updated_at)
    SELECT $1 || '-0-' || lpad(n::text,3,'0'),$1,'Sorry; I cannot provide a translation.','N5','active',NOW()
    FROM generate_series(1,$2::int) n`, prefix, rejected); err != nil {
				t.Fatal(err)
			}
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (headword,reading,short_meaning_vi,jlpt_level,status,updated_at)
    SELECT $1 || '-1-' || lpad(n::text,3,'0'),$1,'nghĩa hợp lệ','N5','active',NOW()
    FROM generate_series(1,61) n`, prefix); err != nil {
				t.Fatal(err)
			}
			if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (headword,reading,short_meaning_vi,jlpt_level,status,updated_at)
                VALUES ($1 || '-0-other-level',$1,'nghĩa hợp lệ','N4','active',NOW())`, prefix); err != nil {
				t.Fatal(err)
			}
			for _, page := range []struct{ limit, offset, want int }{{50, 0, 50}, {30, 0, 30}, {30, 30, 30}, {30, 60, 1}, {30, 61, 0}, {40, 0, 40}, {40, 40, 21}, {100, 0, 61}} {
				t.Run(fmt.Sprintf("limit-%d-offset-%d", page.limit, page.offset), func(t *testing.T) {
					response := httptest.NewRecorder()
					path := "/api/content/lexemes?q=" + url.QueryEscape(prefix) + fmt.Sprintf("&jlptLevel=N5&limit=%d&offset=%d", page.limit, page.offset)
					listLexemesHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
					if response.Code != http.StatusOK {
						t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
					}
					var got []struct {
						Headword string `json:"headword"`
					}
					if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
						t.Fatal(err)
					}
					if len(got) != page.want {
						t.Fatalf("usable dictionary pagination: got %d entries, want %d (limit=%d offset=%d)", len(got), page.want, page.limit, page.offset)
					}
					for i, item := range got {
						want := fmt.Sprintf("%s-1-%03d", prefix, page.offset+i+1)
						if item.Headword != want {
							t.Errorf("usable dictionary pagination: headword=%q want %q", item.Headword, want)
						}
					}
				})
			}
		})
	}
}

func TestBUG264DictionaryPaginationValidation(t *testing.T) {
	db := testPool(t)
	for _, query := range []string{"limit=0", "limit=-1", "limit=101", "limit=bad", "offset=-1", "offset=bad", "offset=99999999999999999999999999"} {
		t.Run(query, func(t *testing.T) {
			response := httptest.NewRecorder()
			listLexemesHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/content/lexemes?"+query, nil))
			if response.Code != http.StatusBadRequest {
				t.Errorf("dictionary pagination validation: status=%d want 400 for %s", response.Code, query)
			}
		})
	}
}
