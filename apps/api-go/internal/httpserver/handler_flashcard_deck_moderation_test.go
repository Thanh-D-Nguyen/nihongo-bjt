package httpserver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

func TestDeckModerationReportAndBlockAuthor(t *testing.T) {
	db := testPool(t)
	viewer, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	author := newUUID(t)
	seedActiveUser(t, db, author, "Reported author", fmt.Sprintf("moderation-%s@example.test", author), "")
	var deckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck(owner_user_id,title_vi,visibility,status,updated_at) VALUES ($1,'Report fixture','public','active',NOW()) RETURNING id::text`, author).Scan(&deckID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.deck_report WHERE reporter_user_id=$1`, viewer)
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.deck_author_block WHERE blocker_user_id=$1`, viewer)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	})
	store := flashcarddeck.NewStore(db)
	for _, reason := range []string{"spam", "spam"} {
		if err := store.ReportDeck(context.Background(), viewer, deckID, reason); err != nil {
			t.Fatalf("report: %v", err)
		}
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.deck_report WHERE reporter_user_id=$1 AND deck_id=$2 AND reason='spam' AND status='pending'`, viewer, deckID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("report count=%d err=%v", count, err)
	}
	if err := store.BlockDeckAuthor(context.Background(), viewer, deckID); err != nil {
		t.Fatalf("block: %v", err)
	}
	if err := store.BlockDeckAuthor(context.Background(), viewer, deckID); err != nil {
		t.Fatalf("repeat block: %v", err)
	}
	decks, err := store.ListDecks(context.Background(), viewer, 200)
	if err != nil {
		t.Fatal(err)
	}
	for _, deck := range decks {
		if deck.ID == deckID {
			t.Fatal("blocked author still shown")
		}
	}
	if _, err := store.GetDeck(context.Background(), viewer, deckID); !errors.Is(err, flashcarddeck.ErrNotFound) {
		t.Fatalf("blocked deck detail err=%v want not found", err)
	}
	if _, err := store.GetDeck(context.Background(), author, deckID); err != nil {
		t.Fatalf("author cannot access owned deck: %v", err)
	}
}

func TestDeckModerationHandlersValidateIdentityAndReason(t *testing.T) {
	db := testPool(t)
	store := flashcarddeck.NewStore(db)
	report := reportDeckHandler(store, testLogger())
	block := blockDeckAuthorHandler(store, testLogger())
	for _, handler := range []http.Handler{report, block} {
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/flashcards/decks/"+newUUID(t)+"/report", strings.NewReader(`{"reason":"spam"}`)))
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous request status=%d", rr.Code)
		}
	}
	viewer, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	path := "/api/flashcards/decks/" + newUUID(t) + "/report"
	for _, body := range []string{`{"reason":""}`, `{"reason":"other reason"}`, `{"reason":"spam","extra":true}`} {
		rr := httptest.NewRecorder()
		report.ServeHTTP(rr, deckRequestAsUser(t, db, viewer, http.MethodPost, path, body))
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("bad reason/body=%s status=%d", body, rr.Code)
		}
	}
	rr := httptest.NewRecorder()
	report.ServeHTTP(rr, deckRequestAsUser(t, db, viewer, http.MethodPost, path, `{"reason":"spam"}`))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("unknown deck status=%d", rr.Code)
	}
}

func TestDeckModerationRejectsOwnAndPrivateDecks(t *testing.T) {
	db := testPool(t)
	viewer, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	other := newUUID(t)
	seedActiveUser(t, db, other, "Private deck author", fmt.Sprintf("private-%s@example.test", other), "")
	for _, tc := range []struct {
		name, owner, visibility string
	}{
		{name: "own public deck", owner: viewer, visibility: "public"},
		{name: "another user's private deck", owner: other, visibility: "private"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var deckID string
			if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck(owner_user_id,title_vi,visibility,status,updated_at) VALUES ($1,'Moderation negative fixture',$2,'active',NOW()) RETURNING id::text`, tc.owner, tc.visibility).Scan(&deckID); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID) })
			store := flashcarddeck.NewStore(db)
			if err := store.ReportDeck(context.Background(), viewer, deckID, "spam"); !errors.Is(err, flashcarddeck.ErrNotFound) {
				t.Fatalf("ReportDeck error = %v; want not found", err)
			}
			if err := store.BlockDeckAuthor(context.Background(), viewer, deckID); !errors.Is(err, flashcarddeck.ErrNotFound) {
				t.Fatalf("BlockDeckAuthor error = %v; want not found", err)
			}
		})
	}
}
