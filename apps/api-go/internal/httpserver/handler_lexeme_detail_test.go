package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGetLexemeDetailReturnsCanonicalSensesAndExamples(t *testing.T) {
	db := testPool(t)
	lexemeID := newUUID(t)
	var sentenceID string
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme
		(id, headword, status, created_at, updated_at) VALUES ($1, '詳細テスト', 'active', NOW(), NOW())`, lexemeID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO content.example_sentence
		(japanese_text, reading, translation_vi, status, updated_at)
		VALUES ('詳細の例文です。', 'しょうさいのれいぶんです。', 'Đây là câu ví dụ chi tiết.', 'active', NOW()) RETURNING id::text`).Scan(&sentenceID); err != nil {
		t.Fatal(err)
	}
	var senseID string
	if err := db.QueryRow(context.Background(), `INSERT INTO content.lexeme_sense
		(lexeme_id, position, part_of_speech, meaning_vi) VALUES ($1, 1, 'noun', 'nghĩa kiểm thử') RETURNING id::text`, lexemeID).Scan(&senseID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme_sense_example
		(sense_id, example_sentence_id, source_example_key) VALUES ($1, $2, 'detail-fixture')`, senseID, sentenceID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id = $1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.example_sentence WHERE id = $1`, sentenceID)
	})

	config := db.Config()
	config.MaxConns = 1
	singleConnDB, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(singleConnDB.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/content/lexemes/"+lexemeID, nil).WithContext(ctx)
	getLexemeDetailHandler(singleConnDB, testLogger()).ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var got struct {
		Senses []struct {
			ID           string `json:"id"`
			Position     int    `json:"position"`
			MeaningVi    string `json:"meaningVi"`
			PartOfSpeech string `json:"partOfSpeech"`
			ExampleLinks []struct {
				ExampleSentence *struct {
					ID            string `json:"id"`
					JapaneseText  string `json:"japaneseText"`
					Reading       string `json:"reading"`
					TranslationVi string `json:"translationVi"`
				} `json:"exampleSentence"`
			} `json:"exampleLinks"`
		} `json:"senses"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got.Senses) != 1 {
		t.Fatalf("senses=%d; want 1 (body=%s)", len(got.Senses), response.Body.String())
	}
	sense := got.Senses[0]
	if sense.ID != senseID || sense.Position != 1 || sense.MeaningVi != "nghĩa kiểm thử" || sense.PartOfSpeech != "noun" {
		t.Fatalf("sense=%+v; want canonical fields", sense)
	}
	if len(sense.ExampleLinks) != 1 || sense.ExampleLinks[0].ExampleSentence == nil {
		t.Fatalf("example links=%+v; want linked sentence", sense.ExampleLinks)
	}
	example := sense.ExampleLinks[0].ExampleSentence
	if example.ID != sentenceID || example.JapaneseText != "詳細の例文です。" || example.Reading != "しょうさいのれいぶんです。" || example.TranslationVi != "Đây là câu ví dụ chi tiết." {
		t.Fatalf("example=%+v; want canonical sentence", example)
	}
}
