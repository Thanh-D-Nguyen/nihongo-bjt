package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
)

func TestKanjiDetailReturnsCanonicalExamples(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	fixtureID := newUUID(t)
	character := "測" + fixtureID[:4]
	if _, err := db.Exec(ctx, `INSERT INTO content.kanji (id, character, meaning_vi, status, created_at, updated_at)
		VALUES ($1, $2, 'temporary test fixture', 'active', NOW(), NOW())`, fixtureID, character); err != nil {
		t.Fatalf("create kanji fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, fixtureID) })
	if _, err := db.Exec(ctx, `INSERT INTO content.kanji_example (kanji_id, position, word, reading, meaning_vi, han_viet)
		VALUES ($1, 1, $2, 'そくご', 'temporary test example', 'Trắc Ngữ')`, fixtureID, character+"語"); err != nil {
		t.Fatalf("create kanji example fixture: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.kanji_component (kanji_id, position, character, han_viet)
		VALUES ($1, 1, '氵', 'Thủy')`, fixtureID); err != nil {
		t.Fatalf("create kanji component fixture: %v", err)
	}
	var id, wantWord, wantComponent string
	var wantReading, wantMeaning, wantHanViet *string
	var wantComponentHanViet *string
	err := db.QueryRow(context.Background(), `SELECT k.id::text, e.word, e.reading, e.meaning_vi, e.han_viet, c.character, c.han_viet
		FROM content.kanji k JOIN content.kanji_example e ON e.kanji_id=k.id
		JOIN content.kanji_component c ON c.kanji_id=k.id
		WHERE k.id=$1 AND k.status='active' ORDER BY e.position, c.position LIMIT 1`, fixtureID).
		Scan(&id, &wantWord, &wantReading, &wantMeaning, &wantHanViet, &wantComponent, &wantComponentHanViet)
	if err != nil {
		t.Fatalf("canonical kanji example data is required: %v", err)
	}
	w := httptest.NewRecorder()
	getKanjiDetailHandler(db, testLogger())(w, httptest.NewRequest("GET", fmt.Sprintf("/api/kanji/%s", id), nil))
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var got struct {
		Examples []struct {
			Word      string  `json:"word"`
			Reading   *string `json:"reading"`
			MeaningVi *string `json:"meaningVi"`
			HanViet   *string `json:"hanViet"`
		} `json:"examples"`
		Components []struct {
			Character string  `json:"character"`
			HanViet   *string `json:"hanViet"`
		} `json:"components"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got.Examples) == 0 || got.Examples[0].Word != wantWord || !sameString(got.Examples[0].Reading, wantReading) || !sameString(got.Examples[0].MeaningVi, wantMeaning) || !sameString(got.Examples[0].HanViet, wantHanViet) {
		t.Fatalf("canonical example missing/mismatched: got=%+v want=%q/%v/%v/%v", got.Examples, wantWord, wantReading, wantMeaning, wantHanViet)
	}
	if len(got.Components) == 0 || got.Components[0].Character != wantComponent || !sameString(got.Components[0].HanViet, wantComponentHanViet) {
		t.Fatalf("canonical component missing/mismatched: got=%+v want=%q/%v", got.Components, wantComponent, wantComponentHanViet)
	}
}

func sameString(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}
