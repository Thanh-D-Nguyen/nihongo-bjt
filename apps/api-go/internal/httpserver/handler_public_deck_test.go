package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

func TestPublicSharedDeckPreviewMatchesLearnerTokenContract(t *testing.T) {
	db := testPool(t)
	store := flashcarddeck.NewStore(db)
	userID, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	reading := "おつかれさまです"
	cards := make([]flashcarddeck.DeckCardInput, 6)
	for i := range cards {
		cards[i] = flashcarddeck.DeckCardInput{
			FrontText: fmt.Sprintf("共有カード%d", i+1),
			BackText:  fmt.Sprintf("private-answer-%d", i+1),
			Reading:   &reading,
		}
	}
	description := "Description visible on the public preview"
	japaneseTitle := "共有テスト"
	deck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{
		UserID:      userID,
		Name:        "Shared preview fixture",
		TitleJa:     &japaneseTitle,
		Description: &description,
		Cards:       cards,
	})
	if err != nil {
		t.Fatalf("create disposable shared deck: %v", err)
	}
	descriptionJa := "共有テストの説明"
	if _, err := db.Exec(context.Background(), `UPDATE learning.deck SET description_ja=$2 WHERE id=$1`, deck.ID, descriptionJa); err != nil {
		t.Fatalf("add Japanese preview description: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1 AND card_id IN (SELECT id FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$2)`, userID, deck.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deck.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1`, deck.ID)
	})
	token, err := store.ShareDeck(context.Background(), userID, deck.ID)
	if err != nil || token == nil || *token == "" {
		t.Fatalf("share disposable deck: token=%v err=%v", token, err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/public/decks/"+*token, nil)
	response := httptest.NewRecorder()
	getPublicDeckHandler(store, testLogger()).ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("public shared deck must resolve to preview: status=%d body=%s", response.Code, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("public preview must not be cached: Cache-Control=%q", response.Header().Get("Cache-Control"))
	}

	var body struct {
		TitleVi       string `json:"titleVi"`
		TitleJa       string `json:"titleJa"`
		DescriptionVi string `json:"descriptionVi"`
		DescriptionJa string `json:"descriptionJa"`
		CardCount     int    `json:"cardCount"`
		CloneCount    int    `json:"cloneCount"`
		SampleCards   []struct {
			FrontText string  `json:"frontText"`
			Reading   *string `json:"reading"`
		} `json:"sampleCards"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode public preview: %v body=%s", err, response.Body.String())
	}
	if body.TitleVi != deck.Name || body.TitleJa != japaneseTitle || body.DescriptionVi != description || body.DescriptionJa != descriptionJa || body.CardCount != 6 || body.CloneCount != 0 || len(body.SampleCards) != 5 {
		t.Fatalf("public preview does not match screen contract: %+v", body)
	}
	for i, sample := range body.SampleCards {
		if sample.FrontText != fmt.Sprintf("共有カード%d", i+1) || sample.Reading == nil || *sample.Reading != reading {
			t.Fatalf("sample card %d missing front/reading: %+v", i, sample)
		}
	}
	if strings.Contains(response.Body.String(), "private-answer") || strings.Contains(response.Body.String(), "ownerUserId") || strings.Contains(response.Body.String(), "shareToken") {
		t.Fatalf("public preview leaked a private answer or owner field: %s", response.Body.String())
	}

	if err := store.UnshareDeck(context.Background(), userID, deck.ID); err != nil {
		t.Fatalf("unshare disposable deck: %v", err)
	}
	revoked := httptest.NewRecorder()
	getPublicDeckHandler(store, testLogger()).ServeHTTP(revoked, request)
	if revoked.Code != http.StatusNotFound {
		t.Fatalf("unshared token must stop resolving immediately: status=%d body=%s", revoked.Code, revoked.Body.String())
	}
	if revoked.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("revoked preview must not be cached: Cache-Control=%q", revoked.Header().Get("Cache-Control"))
	}
	unknown := httptest.NewRecorder()
	getPublicDeckHandler(store, testLogger()).ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/api/public/decks/not-a-real-token", nil))
	if unknown.Code != http.StatusNotFound {
		t.Fatalf("unknown token must not resolve: status=%d body=%s", unknown.Code, unknown.Body.String())
	}
	if _, err := db.Exec(context.Background(), `UPDATE learning.deck SET share_token=$2, status='archived' WHERE id=$1`, deck.ID, *token); err != nil {
		t.Fatalf("archive disposable deck: %v", err)
	}
	archived := httptest.NewRecorder()
	getPublicDeckHandler(store, testLogger()).ServeHTTP(archived, request)
	if archived.Code != http.StatusNotFound {
		t.Fatalf("archived token must not resolve: status=%d body=%s", archived.Code, archived.Body.String())
	}
}
