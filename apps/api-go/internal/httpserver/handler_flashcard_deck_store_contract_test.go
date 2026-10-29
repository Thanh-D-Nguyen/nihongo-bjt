package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardreview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestLearnerDeckListReadsCanonicalDecks(t *testing.T) {
	db := testPool(t)
	userID, req := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	otherUserID := newUUID(t)
	seedActiveUser(t, db, otherUserID, "Another learner", fmt.Sprintf("deck-list-%s@example.test", otherUserID), "")
	var deckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (owner_user_id,title_vi,description_vi,visibility,status,updated_at)
		VALUES ($1,'Deck fixture','Fixture description','private','active',NOW()) RETURNING id::text`, userID).Scan(&deckID); err != nil {
		t.Fatalf("insert canonical deck fixture: %v", err)
	}
	var publicDeckID, hiddenDeckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (title_vi,visibility,status,updated_at)
		VALUES ('Public deck fixture','public','active',NOW()) RETURNING id::text`).Scan(&publicDeckID); err != nil {
		t.Fatalf("insert public deck fixture: %v", err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (owner_user_id,title_vi,visibility,status,updated_at)
		VALUES ($1,'Private deck fixture','private','active',NOW()) RETURNING id::text`, otherUserID).Scan(&hiddenDeckID); err != nil {
		t.Fatalf("insert private deck fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=ANY($1::uuid[])`, []string{deckID, publicDeckID, hiddenDeckID})
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1`, deckID)
	})
	rr := httptest.NewRecorder()
	listDecksHandler(flashcarddeck.NewStore(db), testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("list decks status=%d body=%s", rr.Code, rr.Body.String())
	}
	var decks []flashcarddeck.Deck
	if err := json.Unmarshal(rr.Body.Bytes(), &decks); err != nil {
		t.Fatalf("decode deck list: %v body=%s", err, rr.Body.String())
	}
	seen := map[string]bool{}
	for _, deck := range decks {
		seen[deck.ID] = true
	}
	if len(decks) != 2 || !seen[deckID] || !seen[publicDeckID] || seen[hiddenDeckID] {
		t.Fatalf("canonical learner deck missing from response: %+v", decks)
	}
	for _, deck := range decks {
		if deck.ID == deckID && (deck.Name != "Deck fixture" || deck.Description == nil || *deck.Description != "Fixture description") {
			t.Fatalf("owned deck metadata missing from response: %+v", deck)
		}
		if deck.ID == publicDeckID && deck.UserID != nil {
			t.Fatalf("ownerless public deck should be represented without a fake owner: %+v", deck)
		}
	}
}

func TestLearnerDeckCreateAndDetailMatchLibraryContract(t *testing.T) {
	db := testPool(t)
	body := fmt.Sprintf(`{"titleVi":"Bộ thử giao diện","titleJa":"UI test","descriptionVi":"Disposable","visibility":"private","cards":[{"frontText":"会社","backText":"công ty","reading":"かいしゃ"}]}`)
	userID, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/flashcards/decks", body)
	rr := httptest.NewRecorder()
	createDeckHandler(flashcarddeck.NewStore(db), testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", rr.Code, rr.Body.String())
	}
	var deck map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &deck); err != nil {
		t.Fatalf("decode created deck: %v", err)
	}
	deckID, _ := deck["id"].(string)
	if deckID == "" || deck["ownerUserId"] != userID || deck["titleVi"] != "Bộ thử giao diện" || deck["visibility"] != "private" {
		t.Fatalf("created deck does not match library contract: %#v", deck)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	getReq := deckRequestAsUser(t, db, userID, http.MethodGet, "/api/flashcards/decks/"+deckID, "")
	getRR := httptest.NewRecorder()
	getDeckHandler(flashcarddeck.NewStore(db), testLogger()).ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("get detail status=%d body=%s", getRR.Code, getRR.Body.String())
	}
	var detail struct {
		Cards []struct {
			Card struct {
				FrontText string `json:"frontText"`
				BackText  string `json:"backText"`
			} `json:"card"`
		} `json:"cards"`
	}
	if err := json.Unmarshal(getRR.Body.Bytes(), &detail); err != nil || len(detail.Cards) != 1 || detail.Cards[0].Card.FrontText != "会社" || detail.Cards[0].Card.BackText != "công ty" {
		t.Fatalf("deck detail card not persisted: detail=%+v err=%v body=%s", detail, err, getRR.Body.String())
	}
}

func TestLearnerDeckHandlersRejectAnonymousRequests(t *testing.T) {
	db := testPool(t)
	store := flashcarddeck.NewStore(db)
	logger := testLogger()
	cases := []struct {
		method, path string
		handler      http.Handler
	}{
		{http.MethodGet, "/api/flashcards/decks", listDecksHandler(store, logger)},
		{http.MethodPost, "/api/flashcards/decks", createDeckHandler(store, logger)},
		{http.MethodGet, "/api/flashcards/decks/" + newUUID(t), getDeckHandler(store, logger)},
		{http.MethodPost, "/api/flashcards/decks/generate/preview", previewGenerateCountHandler(store, logger)},
		{http.MethodPost, "/api/flashcards/decks/generate", generateDeckHandler(store, logger)},
		{http.MethodPost, "/api/flashcards/decks/" + newUUID(t) + "/archive", archiveDeckHandler(store, logger)},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			rr := httptest.NewRecorder()
			tc.handler.ServeHTTP(rr, httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{}`)))
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous request status=%d body=%s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestLearnerDeckGenerationFiltersCanonicalLevelAndDirection(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Deck generation fixture", fmt.Sprintf("deck-gen-%s@example.test", userID), "")
	n5ID, n4ID := newUUID(t), newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,'会社 filter fixture','かいしゃ','N5','công ty','active',NOW(),NOW()),($2,'経済 filter fixture','けいざい','N4','kinh tế','active',NOW(),NOW())`, n5ID, n4ID)
	if err != nil {
		t.Fatalf("insert canonical lexemes: %v", err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant (source_type,source_id,front_text,back_text,reading,status,updated_at)
		VALUES ('lexeme',$1,'会社','công ty','かいしゃ','active',NOW()),('lexeme',$2,'経済','kinh tế','けいざい','active',NOW())`, n5ID, n4ID)
	if err != nil {
		t.Fatalf("insert canonical variants: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE owner_user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_id = ANY($1::uuid[])`, []string{n5ID, n4ID})
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id = ANY($1::uuid[])`, []string{n5ID, n4ID})
	})
	store := flashcarddeck.NewStore(db)
	input := flashcarddeck.GenerateDeckInput{UserID: userID, Name: "N5 reverse", SourceTypes: []string{"lexeme"}, Levels: []string{"J5"}, Limit: 10, Direction: "vn_to_jp"}
	preview, err := store.PreviewGenerateCount(context.Background(), input)
	if err != nil || preview.AvailableCount != 1 {
		t.Fatalf("level-filtered preview=%+v err=%v", preview, err)
	}
	deck, err := store.GenerateDeck(context.Background(), input)
	if err != nil {
		t.Fatalf("generate deck: %v", err)
	}
	detail, err := store.GetDeck(context.Background(), userID, deck.ID)
	if err != nil || len(detail.Cards) != 1 {
		t.Fatalf("generated deck detail=%+v err=%v", detail, err)
	}
	card := detail.Cards[0].Card
	if card.FrontText != "công ty" || card.BackText != "会社" || card.SourceID != n5ID {
		t.Fatalf("generation did not filter level and reverse personal variant: %+v", card)
	}
}

func TestLearnerDeckGenerationCoversCanonicalVocabularyKanjiGrammar(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Deck all-content fixture", fmt.Sprintf("deck-all-%s@example.test", userID), "")
	lexemeID, grammarID, kanjiID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,jlpt_level,status,created_at,updated_at) VALUES ($1,'語彙 fixture','N5','active',NOW(),NOW())`, lexemeID); err != nil {
		t.Fatalf("insert lexeme: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at) VALUES ($1,'〜 fixture','ngữ pháp fixture','N5','active',NOW(),NOW())`, grammarID); err != nil {
		t.Fatalf("insert grammar point: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,meaning_vi,level,status,created_at,updated_at) VALUES ($1,'覑','kanji fixture',5,'active',NOW(),NOW())`, kanjiID); err != nil {
		t.Fatalf("insert kanji: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant (source_type,source_id,front_text,back_text,status,updated_at)
		VALUES ('lexeme',$1,'語彙','từ vựng','active',NOW()),('grammar',$2,'〜 fixture','ngữ pháp fixture','active',NOW()),('kanji',$3,'覑','kanji fixture','active',NOW())`, lexemeID, grammarID, kanjiID); err != nil {
		t.Fatalf("insert flashcard variants: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE owner_user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_id = ANY($1::uuid[])`, []string{lexemeID, grammarID, kanjiID})
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.grammar_point WHERE id=$1`, grammarID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, kanjiID)
	})
	store := flashcarddeck.NewStore(db)
	input := flashcarddeck.GenerateDeckInput{UserID: userID, Name: "All canonical content", SourceTypes: []string{"lexeme", "kanji", "grammar"}, Levels: []string{"J5"}, Limit: 10, Direction: "both"}
	preview, err := store.PreviewGenerateCount(context.Background(), input)
	if err != nil || preview.AvailableCount < 3 {
		t.Fatalf("all-content preview=%+v err=%v", preview, err)
	}
	deck, err := store.GenerateDeck(context.Background(), input)
	if err != nil || deck.CardCount != preview.AvailableCount {
		t.Fatalf("all-content generation deck=%+v err=%v", deck, err)
	}
	detail, err := store.GetDeck(context.Background(), userID, deck.ID)
	if err != nil || len(detail.Cards) != preview.AvailableCount {
		t.Fatalf("all-content detail cards=%d err=%v", len(detail.Cards), err)
	}
	seen := map[string]bool{}
	for _, row := range detail.Cards {
		seen[row.Card.SourceType] = true
		if row.Position%2 == 1 && row.Card.FrontText == "覑" {
			t.Fatalf("both direction did not reverse odd card position: %+v", row)
		}
	}
	for _, sourceType := range []string{"lexeme", "kanji", "grammar"} {
		if !seen[sourceType] {
			t.Fatalf("generated deck omitted %s canonical content: %+v", sourceType, seen)
		}
	}
}

func TestLearnerDeckGenerationCreatesCardsFromCanonicalContentWithoutCuratedVariants(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Deck canonical fixture", fmt.Sprintf("deck-canon-%s@example.test", userID), "")
	lexemeID, kanjiID := newUUID(t), newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,'経済 canonical fixture','けいざい','N4','kinh tế','active',NOW(),NOW())`, lexemeID); err != nil {
		t.Fatalf("insert canonical lexeme: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,meaning_vi,level,status,created_at,updated_at)
		VALUES ($1,'鬯','rượu tế fixture',4,'active',NOW(),NOW())`, kanjiID); err != nil {
		t.Fatalf("insert canonical kanji: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE owner_user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_id = ANY($1::uuid[])`, []string{lexemeID, kanjiID})
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, kanjiID)
	})
	store := flashcarddeck.NewStore(db)
	input := flashcarddeck.GenerateDeckInput{UserID: userID, Name: "N4 canonical", SourceTypes: []string{"lexeme", "kanji"}, Levels: []string{"J4"}, Limit: 500, Direction: "jp_to_vn"}
	preview, err := store.PreviewGenerateCount(context.Background(), input)
	if err != nil {
		t.Fatalf("canonical preview err=%v", err)
	}
	if preview.AvailableCount < 2 {
		t.Fatalf("canonical preview available=%d want>=2 without curated variants", preview.AvailableCount)
	}
	deck, err := store.GenerateDeck(context.Background(), input)
	if err != nil {
		t.Fatalf("canonical generate err=%v", err)
	}
	if deck.CardCount != preview.AvailableCount {
		t.Fatalf("canonical generate cards=%d want preview=%d", deck.CardCount, preview.AvailableCount)
	}
	detail, err := store.GetDeck(context.Background(), userID, deck.ID)
	if err != nil {
		t.Fatalf("canonical deck detail err=%v", err)
	}
	fronts := map[string]string{}
	for _, row := range detail.Cards {
		fronts[row.Card.SourceID] = row.Card.FrontText
	}
	if fronts[lexemeID] != "経済 canonical fixture" || fronts[kanjiID] != "鬯" {
		t.Fatalf("canonical generation cards missing fixture content: %+v", detail.Cards)
	}
}

func TestLearnerDeckGenerationRejectsEmptyPoolWithoutCreatingDeck(t *testing.T) {
	db := testPool(t)
	userID, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/flashcards/decks/generate", `{"name":"No match","sourceTypes":["bjt_vocabulary"],"levels":["J5"],"limit":10,"direction":"jp_to_vn"}`)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE owner_user_id=$1`, userID)
	})
	rr := httptest.NewRecorder()
	generateDeckHandler(flashcarddeck.NewStore(db), testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("empty pool generate status=%d want 422 body=%s", rr.Code, rr.Body.String())
	}
	var decks int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.deck WHERE owner_user_id=$1`, userID).Scan(&decks); err != nil || decks != 0 {
		t.Fatalf("empty pool created decks=%d err=%v", decks, err)
	}
}

func deckRequestAsUser(t *testing.T, db *pgxpool.Pool, userID, method, path, body string) *http.Request {
	t.Helper()
	store := session.NewStore(db)
	token := createLearnerSession(t, store, userID)
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	var authenticated *http.Request
	authn.LearnerGuard(store, authn.DefaultGuardConfig(testLogger()))(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		authenticated = r
	})).ServeHTTP(httptest.NewRecorder(), req)
	if authenticated == nil {
		t.Fatal("authenticate deck request")
	}
	return authenticated
}

func TestLearnerDeckStoreCRUDUsesCanonicalDeckTable(t *testing.T) {
	db := testPool(t)
	userID, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE owner_user_id=$1`, userID)
	store := flashcarddeck.NewStore(db)
	description := "Initial description"
	deck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: userID, Name: "Disposable deck", Description: &description})
	if err != nil {
		t.Fatalf("create deck: %v", err)
	}
	if _, err := store.CreateCardFromContent(context.Background(), flashcarddeck.CreateCardFromContentInput{UserID: newUUID(t), DeckID: deck.ID, SourceType: "lexeme", SourceID: newUUID(t), FrontText: "should not be linked", BackText: "forbidden"}); err != flashcarddeck.ErrNotOwner {
		t.Fatalf("another learner added a card to a private deck: err=%v", err)
	}
	name := "Updated disposable deck"
	updatedDescription := "Updated description"
	updated, err := store.UpdateDeck(context.Background(), userID, deck.ID, flashcarddeck.UpdateDeckInput{Name: &name, Description: &updatedDescription})
	if err != nil || updated.Name != name || updated.Description == nil || *updated.Description != updatedDescription {
		t.Fatalf("update deck: deck=%+v err=%v", updated, err)
	}
	token, err := store.ShareDeck(context.Background(), userID, deck.ID)
	if err != nil || token == nil || *token == "" {
		t.Fatalf("share deck: token=%v err=%v", token, err)
	}
	cloneOwnerID := newUUID(t)
	cloned, err := store.CloneDeck(context.Background(), cloneOwnerID, *token)
	if err != nil || cloned.Name != name+" (copy)" {
		t.Fatalf("clone deck: deck=%+v err=%v", cloned, err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, cloned.ID)
	if err := store.ArchiveDeck(context.Background(), cloneOwnerID, cloned.ID); err != nil {
		t.Fatalf("archive cloned deck: %v", err)
	}
	if err := store.UnshareDeck(context.Background(), userID, deck.ID); err != nil {
		t.Fatalf("unshare deck: %v", err)
	}
	decks, err := store.ListDecks(context.Background(), userID, 20)
	if err != nil || len(decks) != 1 || decks[0].ID != deck.ID || decks[0].Name != name {
		t.Fatalf("list canonical decks after CRUD: decks=%+v err=%v", decks, err)
	}
}

func TestLearnerDeckUpdateChangesCardTextWithoutMutatingCanonicalVariant(t *testing.T) {
	db := testPool(t)
	userID, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	lexemeID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,'会社 edit fixture','かいしゃ','N5','công ty','active',NOW(),NOW())`, lexemeID); err != nil {
		t.Fatalf("insert lexeme fixture: %v", err)
	}
	var canonicalCardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.flashcard_variant (source_type,source_id,front_text,back_text,reading,status,updated_at)
		VALUES ('lexeme',$1,'会社','công ty','かいしゃ','active',NOW()) RETURNING id::text`, lexemeID).Scan(&canonicalCardID); err != nil {
		t.Fatalf("insert canonical card: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE owner_user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
	})
	store := flashcarddeck.NewStore(db)
	deck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: userID, Name: "Editable deck", Cards: []flashcarddeck.DeckCardInput{{CardID: canonicalCardID, FrontText: "会社", BackText: "công ty", Reading: strPtr("かいしゃ")}}})
	if err != nil {
		t.Fatalf("create deck with canonical card: %v", err)
	}
	detail, err := store.GetDeck(context.Background(), userID, deck.ID)
	if err != nil || len(detail.Cards) != 1 {
		t.Fatalf("get deck before edit: detail=%+v err=%v", detail, err)
	}
	_, err = store.UpdateDeck(context.Background(), userID, deck.ID, flashcarddeck.UpdateDeckInput{Cards: &[]flashcarddeck.DeckCardInput{{CardID: canonicalCardID}}})
	if err != nil {
		t.Fatalf("sparse existing-card update should retain canonical content: %v", err)
	}
	detail, err = store.GetDeck(context.Background(), userID, deck.ID)
	if err != nil || len(detail.Cards) != 1 || detail.Cards[0].Card.ID != canonicalCardID || detail.Cards[0].Card.FrontText != "会社" || detail.Cards[0].Card.BackText != "công ty" {
		t.Fatalf("sparse update changed canonical card content: detail=%+v err=%v", detail, err)
	}
	updated, err := store.UpdateDeck(context.Background(), userID, deck.ID, flashcarddeck.UpdateDeckInput{Cards: &[]flashcarddeck.DeckCardInput{{CardID: detail.Cards[0].Card.ID, FrontText: "công ty", BackText: "会社", Reading: strPtr("かいしゃ")}}})
	if err != nil || updated.CardCount != 1 {
		t.Fatalf("update edited deck card: deck=%+v err=%v", updated, err)
	}
	detail, err = store.GetDeck(context.Background(), userID, deck.ID)
	if err != nil || len(detail.Cards) != 1 || detail.Cards[0].Card.FrontText != "công ty" || detail.Cards[0].Card.BackText != "会社" || detail.Cards[0].Card.ID == canonicalCardID {
		t.Fatalf("deck card text did not update as a personal copy: detail=%+v err=%v", detail, err)
	}
	var frontText, backText string
	if err := db.QueryRow(context.Background(), `SELECT front_text,back_text FROM learning.flashcard_variant WHERE id=$1`, canonicalCardID).Scan(&frontText, &backText); err != nil || frontText != "会社" || backText != "công ty" {
		t.Fatalf("editing deck mutated canonical card: front=%q back=%q err=%v", frontText, backText, err)
	}
}

func TestLearnerDeckRejectsAnotherUsersCustomCardID(t *testing.T) {
	db := testPool(t)
	ownerA := newUUID(t)
	ownerB := newUUID(t)
	seedActiveUser(t, db, ownerA, "Deck owner A", fmt.Sprintf("deck-owner-a-%s@example.test", ownerA), "")
	seedActiveUser(t, db, ownerB, "Deck owner B", fmt.Sprintf("deck-owner-b-%s@example.test", ownerB), "")
	store := flashcarddeck.NewStore(db)
	ownerADeck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: ownerA, Name: "Private source", Cards: []flashcarddeck.DeckCardInput{{FrontText: "private", BackText: "secret"}}})
	if err != nil {
		t.Fatalf("create private source deck: %v", err)
	}
	ownerBDeck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: ownerB, Name: "Target deck"})
	if err != nil {
		t.Fatalf("create target deck: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=ANY($1::uuid[])`, []string{ownerA, ownerB})
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=ANY($1::uuid[])`, []string{ownerADeck.ID, ownerBDeck.ID})
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=ANY($1::uuid[])`, []string{ownerADeck.ID, ownerBDeck.ID})
	})
	privateCardID := ownerADeck.ID
	var cardID string
	if err := db.QueryRow(context.Background(), `SELECT card_id::text FROM learning.deck_card WHERE deck_id=$1`, ownerADeck.ID).Scan(&cardID); err != nil {
		t.Fatalf("read private card id: %v", err)
	}
	suggestions, err := store.SuggestCards(context.Background(), flashcarddeck.SuggestCardsInput{Query: "secret"})
	if err != nil || len(suggestions) != 0 {
		t.Fatalf("card suggestions exposed a private custom card: cards=%+v err=%v", suggestions, err)
	}
	_, err = store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: ownerB, Name: "Invalid reference", Cards: []flashcarddeck.DeckCardInput{{CardID: cardID}}})
	if err != flashcarddeck.ErrNotOwner {
		t.Fatalf("another learner attached a private card in CreateDeck: err=%v (source deck %s)", err, privateCardID)
	}
	_, err = store.UpdateDeck(context.Background(), ownerB, ownerBDeck.ID, flashcarddeck.UpdateDeckInput{Cards: &[]flashcarddeck.DeckCardInput{{CardID: cardID}}})
	if err != flashcarddeck.ErrNotOwner {
		t.Fatalf("another learner attached a private card in UpdateDeck: err=%v", err)
	}
}

func TestCreateCardFromContentRequiresActiveCanonicalSource(t *testing.T) {
	db := testPool(t)
	userID, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	store := flashcarddeck.NewStore(db)
	deck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: userID, Name: "Content action deck"})
	if err != nil {
		t.Fatalf("create deck: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deck.ID)
	for _, sourceType := range []string{"custom", "lexeme"} {
		_, err := store.CreateCardFromContent(context.Background(), flashcarddeck.CreateCardFromContentInput{UserID: userID, DeckID: deck.ID, SourceType: sourceType, SourceID: newUUID(t), FrontText: "fake", BackText: "fake"})
		if err != flashcarddeck.ErrNotFound {
			t.Fatalf("CreateCardFromContent accepted source type %q with no canonical row: err=%v", sourceType, err)
		}
	}
	lexemeID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,jlpt_level,status,created_at,updated_at) VALUES ($1,'Draft source fixture','N5','draft',NOW(),NOW())`, lexemeID); err != nil {
		t.Fatalf("insert draft lexeme: %v", err)
	}
	_, err = store.CreateCardFromContent(context.Background(), flashcarddeck.CreateCardFromContentInput{UserID: userID, DeckID: deck.ID, SourceType: "lexeme", SourceID: lexemeID, FrontText: "Draft source fixture", BackText: "draft"})
	if err != flashcarddeck.ErrNotFound {
		t.Fatalf("CreateCardFromContent accepted inactive source: err=%v", err)
	}
	_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
	activeID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,jlpt_level,status,created_at,updated_at) VALUES ($1,'Active source fixture','N5','active',NOW(),NOW())`, activeID); err != nil {
		t.Fatalf("insert active lexeme: %v", err)
	}
	created, err := store.CreateCardFromContent(context.Background(), flashcarddeck.CreateCardFromContentInput{UserID: userID, DeckID: deck.ID, SourceType: "lexeme", SourceID: activeID, FrontText: "Active source fixture", BackText: "active"})
	if err != nil {
		t.Fatalf("CreateCardFromContent rejected active canonical source: %v", err)
	}
	if created.SourceType != "custom" || created.SourceID != deck.ID {
		t.Fatalf("content card should be personal to its deck: %+v", created)
	}
	suggestions, err := store.SuggestCards(context.Background(), flashcarddeck.SuggestCardsInput{Query: "Active source fixture", Limit: 20})
	if err != nil {
		t.Fatalf("suggest cards: %v", err)
	}
	for _, suggestion := range suggestions {
		if suggestion.VariantID == created.VariantID {
			t.Fatalf("personal card leaked into global suggestions: %+v", suggestion)
		}
	}
	badSourceReq := deckRequestAsUser(t, db, userID, http.MethodPost, "/api/flashcards/cards/from-content", fmt.Sprintf(`{"deckId":%q,"sourceType":"lexeme","sourceId":%q,"frontText":"missing","backText":"missing"}`, deck.ID, newUUID(t)))
	badSourceRR := httptest.NewRecorder()
	createCardFromContentHandler(store, testLogger()).ServeHTTP(badSourceRR, badSourceReq)
	if badSourceRR.Code != http.StatusNotFound {
		t.Fatalf("invalid canonical source response=%d body=%s", badSourceRR.Code, badSourceRR.Body.String())
	}
	_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_id=$1`, activeID)
	_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, activeID)
}

func TestRemovingDeckCardHidesItFromReviewAndPreservesHistory(t *testing.T) {
	db := testPool(t)
	userID, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	store := flashcarddeck.NewStore(db)
	deck, err := store.CreateDeck(context.Background(), flashcarddeck.CreateDeckInput{UserID: userID, Name: "Removable card deck", Cards: []flashcarddeck.DeckCardInput{{FrontText: "front", BackText: "back"}}})
	if err != nil {
		t.Fatalf("create deck: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deck.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1`, deck.ID)
	})
	cardStore := flashcardreview.NewStore(db)
	due, err := cardStore.GetDueFlashcards(context.Background(), userID, 10)
	if err != nil || len(due) != 1 {
		t.Fatalf("initial due cards=%d err=%v", len(due), err)
	}
	userFlashcardID := due[0].ID
	reviewedAt := time.Now().Add(-time.Hour)
	if err := cardStore.SubmitReview(context.Background(), userID, flashcardreview.ReviewInput{UserFlashcardID: userFlashcardID, Rating: "again", ReviewedAt: reviewedAt}); err != nil {
		t.Fatalf("record review history: %v", err)
	}
	empty := []flashcarddeck.DeckCardInput{}
	if _, err := store.UpdateDeck(context.Background(), userID, deck.ID, flashcarddeck.UpdateDeckInput{Cards: &empty}); err != nil {
		t.Fatalf("remove deck card: %v", err)
	}
	due, err = cardStore.GetDueFlashcards(context.Background(), userID, 10)
	if err != nil || len(due) != 0 {
		t.Fatalf("detached card remained in due review: cards=%+v err=%v", due, err)
	}
	var userCardCount, eventCount, activeVariantCount int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.user_flashcard WHERE user_id=$1`, userID).Scan(&userCardCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.review_event WHERE user_id=$1`, userID).Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1 AND status='active'`, deck.ID).Scan(&activeVariantCount); err != nil {
		t.Fatal(err)
	}
	if userCardCount != 1 || eventCount != 1 || activeVariantCount != 0 {
		t.Fatalf("removing card lost history or left an active orphan: userCards=%d events=%d activeVariants=%d", userCardCount, eventCount, activeVariantCount)
	}
	if err := store.ArchiveDeck(context.Background(), userID, deck.ID); err != nil {
		t.Fatalf("archive cardless deck: %v", err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.user_flashcard WHERE user_id=$1`, userID).Scan(&userCardCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.review_event WHERE user_id=$1`, userID).Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if userCardCount != 1 || eventCount != 1 {
		t.Fatalf("archive deleted SRS/review history: userCards=%d events=%d", userCardCount, eventCount)
	}
	if err := cardStore.SubmitReview(context.Background(), userID, flashcardreview.ReviewInput{UserFlashcardID: userFlashcardID, Rating: "good", ReviewedAt: time.Now()}); err != flashcardreview.ErrNotFound {
		t.Fatalf("detached card accepted a direct review: err=%v", err)
	}
}

func strPtr(value string) *string { return &value }
