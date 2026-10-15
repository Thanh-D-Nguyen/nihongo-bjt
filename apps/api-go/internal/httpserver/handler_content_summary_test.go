package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestContentSummaryReturnsActiveCanonicalCounts(t *testing.T) {
	db := testPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var baseline struct {
		Lexemes int64
		Kanji   int64
		Grammar int64
	}
	if err := db.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM content.lexeme WHERE status='active'),
		(SELECT count(*) FROM content.kanji WHERE status='active'),
		(SELECT count(*) FROM content.grammar_point WHERE status='active')`).Scan(&baseline.Lexemes, &baseline.Kanji, &baseline.Grammar); err != nil {
		t.Fatal(err)
	}
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1 OR id=$2`, ids[0], ids[1])
		_, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1 OR id=$2`, ids[2], ids[3])
		_, _ = db.Exec(context.Background(), `DELETE FROM content.grammar_point WHERE id=$1 OR id=$2`, ids[4], ids[5])
	})
	fixtures := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO content.lexeme (id,headword,status,created_at,updated_at) VALUES ($1,'summary-active-lexeme','active',NOW(),NOW()), ($2,'summary-draft-lexeme','draft',NOW(),NOW())`, []any{ids[0], ids[1]}},
		{`INSERT INTO content.kanji (id,character,status,created_at,updated_at) VALUES ($1,'鿿','active',NOW(),NOW()), ($2,'鿾','draft',NOW(),NOW())`, []any{ids[2], ids[3]}},
		{`INSERT INTO content.grammar_point (id,pattern,meaning_vi,status,created_at,updated_at) VALUES ($1,'summary-active-grammar','fixture','active',NOW(),NOW()), ($2,'summary-draft-grammar','fixture','draft',NOW(),NOW())`, []any{ids[4], ids[5]}},
	}
	for _, fixture := range fixtures {
		if _, err := db.Exec(ctx, fixture.query, fixture.args...); err != nil {
			t.Fatalf("create disposable canonical content fixtures: %v", err)
		}
	}
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/content/summary", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var got struct {
		Lexemes int64 `json:"lexemes"`
		Kanji   int64 `json:"kanji"`
		Grammar int64 `json:"grammar"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode content summary: %v", err)
	}
	want := struct {
		Lexemes int64
		Kanji   int64
		Grammar int64
	}{baseline.Lexemes + 1, baseline.Kanji + 1, baseline.Grammar + 1}
	if got.Lexemes != want.Lexemes || got.Kanji != want.Kanji || got.Grammar != want.Grammar {
		t.Fatalf("summary=%+v, want active counts %+v (draft fixtures excluded)", got, want)
	}
}
