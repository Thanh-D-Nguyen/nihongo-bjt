package httpserver

import (
	"context"
	"fmt"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

// A share token is a bearer credential for preview and clone. Only the owner
// may read it back; other learners who can see a public deck must not receive
// the token or the owner's account ID.
func TestDeckShareTokenAndOwnerAreOwnerOnly(t *testing.T) {
	db := testPool(t)
	ownerID, viewerID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, ownerID, "Deck owner", fmt.Sprintf("deck-token-owner-%s@example.test", ownerID), "")
	seedActiveUser(t, db, viewerID, "Deck viewer", fmt.Sprintf("deck-token-viewer-%s@example.test", viewerID), "")
	var deckID string
	const token = "owner-only-share-token-fixture"
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (owner_user_id,title_vi,visibility,status,share_token,updated_at)
		VALUES ($1,'Public shared deck','public','active',$2,NOW()) RETURNING id::text`, ownerID, token).Scan(&deckID); err != nil {
		t.Fatalf("insert deck fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID) })
	store := flashcarddeck.NewStore(db)
	ctx := context.Background()

	owned, err := store.GetDeck(ctx, ownerID, deckID)
	if err != nil {
		t.Fatalf("owner detail: %v", err)
	}
	if owned.ShareToken == nil || *owned.ShareToken != token || owned.UserID == nil || *owned.UserID != ownerID {
		t.Fatalf("owner must keep the token and owner ID: %+v", owned.Deck)
	}
	foreign, err := store.GetDeck(ctx, viewerID, deckID)
	if err != nil {
		t.Fatalf("viewer detail: %v", err)
	}
	if foreign.ShareToken != nil || foreign.UserID != nil {
		t.Fatalf("non-owner detail leaked owner capability: token=%v owner=%v", foreign.ShareToken, foreign.UserID)
	}
	decks, err := store.ListDecks(ctx, viewerID, 200)
	if err != nil {
		t.Fatalf("viewer list: %v", err)
	}
	found := false
	for _, deck := range decks {
		if deck.ID != deckID {
			continue
		}
		found = true
		if deck.ShareToken != nil || deck.UserID != nil {
			t.Fatalf("non-owner list leaked owner capability: token=%v owner=%v", deck.ShareToken, deck.UserID)
		}
	}
	if !found {
		t.Fatal("public deck must remain listed for other learners")
	}
}
