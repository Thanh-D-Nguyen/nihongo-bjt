package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func cardgenAuthenticatedRequest(t *testing.T, db *pgxpool.Pool, method, path, body string) (string, *http.Request) {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Cardgen fixture", fmt.Sprintf("cardgen-%s@example.test", userID), "")
	store := session.NewStore(db)
	token := createLearnerSession(t, store, userID)
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	var authenticated *http.Request
	guard := authn.LearnerGuard(store, authn.DefaultGuardConfig(testLogger()))
	rr := httptest.NewRecorder()
	guard(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { authenticated = r })).ServeHTTP(rr, req)
	if authenticated == nil {
		t.Fatalf("authenticate cardgen fixture: %d %s", rr.Code, rr.Body.String())
	}
	return userID, authenticated
}

func insertCardgenLexeme(t *testing.T, db *pgxpool.Pool) (activeID, draftID string) {
	t.Helper()
	activeID, draftID = newUUID(t), newUUID(t)
	_, err := db.Exec(context.Background(), `
		INSERT INTO content.lexeme (id, headword, reading, jlpt_level, short_meaning_vi, status, created_at, updated_at)
		VALUES ($1, '会議 cardgen fixture', 'かいぎ', 'N5', 'cuộc họp fixture', 'active', NOW(), NOW()),
		       ($2, '非公開 fixture', 'ひこうかい', 'N5', 'must not be generated', 'draft', NOW(), NOW())`, activeID, draftID)
	if err != nil {
		t.Fatalf("insert canonical cardgen fixtures: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id = ANY($1::uuid[])`, []string{activeID, draftID})
	})
	return activeID, draftID
}

func TestCardgenPreviewReturnsCanonicalSamples(t *testing.T) {
	db := testPool(t)
	activeID, _ := insertCardgenLexeme(t, db)
	_, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/cardgen/preview", `{"mode":"by_level","sourceType":"lexeme","level":"N5","direction":"jp_to_vn","count":5}`)
	before := countRows(t, db, "learning.deck")
	rr := httptest.NewRecorder()
	postCardgenPreviewHandler(db, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("preview status=%d body=%s", rr.Code, rr.Body.String())
	}
	var got struct {
		EstimatedCards int `json:"estimatedCards"`
		SampleCards    []struct {
			SourceID   string `json:"sourceId"`
			FrontText  string `json:"frontText"`
			BackText   string `json:"backText"`
			Reading    string `json:"reading"`
			SourceType string `json:"sourceType"`
		} `json:"sampleCards"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode preview contract: %v body=%s", err, rr.Body.String())
	}
	if got.EstimatedCards != 1 || len(got.SampleCards) != 1 {
		t.Fatalf("preview should contain exactly the active canonical sample, got %s", rr.Body.String())
	}
	card := got.SampleCards[0]
	if card.SourceID != activeID || card.SourceType != "lexeme" || card.FrontText != "会議 cardgen fixture" || card.BackText != "cuộc họp fixture" || card.Reading != "かいぎ" {
		t.Fatalf("preview did not preserve canonical card fields: %+v", card)
	}
	if after := countRows(t, db, "learning.deck"); after != before {
		t.Fatalf("preview wrote a deck: count before=%d after=%d", before, after)
	}
}

func TestCardgenPreviewAppliesRequestedDirection(t *testing.T) {
	db := testPool(t)
	insertCardgenLexeme(t, db)
	for _, test := range []struct {
		direction string
		front     string
		back      string
	}{
		{direction: "jp_to_vn", front: "会議 cardgen fixture", back: "cuộc họp fixture"},
		{direction: "vn_to_jp", front: "cuộc họp fixture", back: "会議 cardgen fixture"},
	} {
		t.Run(test.direction, func(t *testing.T) {
			body := fmt.Sprintf(`{"mode":"by_level","sourceType":"lexeme","level":"N5","direction":%q,"count":5}`, test.direction)
			_, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/cardgen/preview", body)
			rr := httptest.NewRecorder()
			postCardgenPreviewHandler(db, testLogger()).ServeHTTP(rr, req)
			if rr.Code != http.StatusOK {
				t.Fatalf("preview status=%d body=%s", rr.Code, rr.Body.String())
			}
			var got struct {
				SampleCards []generatedCard `json:"sampleCards"`
			}
			if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil || len(got.SampleCards) != 1 {
				t.Fatalf("decode preview cards: %v body=%s", err, rr.Body.String())
			}
			if got.SampleCards[0].FrontText != test.front || got.SampleCards[0].BackText != test.back {
				t.Fatalf("preview direction=%s got front=%q back=%q", test.direction, got.SampleCards[0].FrontText, got.SampleCards[0].BackText)
			}
		})
	}
}

func TestCardgenRejectsTrailingJSON(t *testing.T) {
	db := testPool(t)
	body := `{"mode":"by_level","sourceType":"lexeme","level":"N5","direction":"jp_to_vn","count":5} {"mode":"by_topic"}`
	_, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/cardgen/preview", body)
	rr := httptest.NewRecorder()
	postCardgenPreviewHandler(db, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("trailing JSON status=%d body=%s", rr.Code, rr.Body.String())
	}
}

func TestCardgenGeneratePersistsDeckCardsAndCompletedJob(t *testing.T) {
	db := testPool(t)
	activeID, _ := insertCardgenLexeme(t, db)
	userID, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/cardgen/generate", `{"mode":"by_level","sourceType":"lexeme","level":"N5","direction":"jp_to_vn","count":5}`)
	rr := httptest.NewRecorder()
	postCardgenGenerateHandler(db, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("generate status=%d body=%s", rr.Code, rr.Body.String())
	}
	var got struct {
		Job struct {
			ID             string `json:"id"`
			Status         string `json:"status"`
			CardsGenerated int    `json:"cardsGenerated"`
		} `json:"job"`
		Deck struct {
			ID string `json:"id"`
		} `json:"deck"`
		CardsGenerated int `json:"cardsGenerated"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode generate contract: %v body=%s", err, rr.Body.String())
	}
	if got.Job.ID == "" || got.Job.Status != "completed" || got.Job.CardsGenerated != 1 || got.Deck.ID == "" || got.CardsGenerated != 1 {
		t.Fatalf("generate response is not the UI contract: %s", rr.Body.String())
	}
	var deckOwner, visibility string
	var deckCards, userCards, jobs int
	if err := db.QueryRow(context.Background(), `SELECT owner_user_id::text, visibility FROM learning.deck WHERE id=$1`, got.Deck.ID).Scan(&deckOwner, &visibility); err != nil {
		t.Fatalf("read generated deck: %v", err)
	}
	if deckOwner != userID || visibility != "private" {
		t.Fatalf("generated deck owner=%s visibility=%s", deckOwner, visibility)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.deck_card dc JOIN learning.flashcard_variant fv ON fv.id=dc.card_id WHERE dc.deck_id=$1 AND fv.source_id=$2`, got.Deck.ID, activeID).Scan(&deckCards); err != nil {
		t.Fatalf("count generated deck cards: %v", err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.user_flashcard uf JOIN learning.flashcard_variant fv ON fv.id=uf.card_id WHERE uf.user_id=$1 AND fv.source_id=$2`, userID, activeID).Scan(&userCards); err != nil {
		t.Fatalf("count generated learner cards: %v", err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.flashcard_gen_job WHERE id=$1 AND user_id=$2 AND deck_id=$3 AND status='completed' AND cards_generated=1`, got.Job.ID, userID, got.Deck.ID).Scan(&jobs); err != nil {
		t.Fatalf("read generation job: %v", err)
	}
	if deckCards != 1 || userCards != 1 || jobs != 1 {
		t.Fatalf("persistence deck_cards=%d user_cards=%d jobs=%d", deckCards, userCards, jobs)
	}
}

func countRows(t *testing.T, db *pgxpool.Pool, table string) int {
	t.Helper()
	var count int
	if err := db.QueryRow(context.Background(), "SELECT COUNT(*) FROM "+table).Scan(&count); err != nil {
		t.Fatalf("count rows in %s: %v", table, err)
	}
	return count
}
