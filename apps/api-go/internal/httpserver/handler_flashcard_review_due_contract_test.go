package httpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardreview"
)

func TestDueFlashcardsIncludeCanonicalCardContent(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Due review fixture", "due-review-"+userID+"@example.test", "")
	sourceID, _ := insertCardgenLexeme(t, db)
	var cardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.flashcard_variant
		(source_type,source_id,front_text,back_text,reading,status,updated_at)
		VALUES ('lexeme',$1,'会議','cuộc họp','かいぎ','active',NOW()) RETURNING id::text`, sourceID).Scan(&cardID); err != nil {
		t.Fatalf("insert review card fixture: %v", err)
	}
	var deckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (owner_user_id,title_vi,status,visibility,updated_at)
		VALUES ($1,'Review fixture','active','private',NOW()) RETURNING id::text`, userID).Scan(&deckID); err != nil {
		t.Fatalf("insert review deck fixture: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.deck_card (deck_id,card_id,position) VALUES ($1,$2,0)`, deckID, cardID); err != nil {
		t.Fatalf("link review card fixture: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, cardID)
	defer db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, userID)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.user_flashcard (user_id,card_id,updated_at) VALUES ($1,$2,NOW())`, userID, cardID); err != nil {
		t.Fatalf("insert due card fixture: %v", err)
	}
	cards, err := flashcardreview.NewStore(db).GetDueFlashcards(context.Background(), userID, 10)
	if err != nil {
		t.Fatalf("get due cards: %v", err)
	}
	if len(cards) != 1 || cards[0].Card.ID != cardID || cards[0].Card.FrontText != "会議" || cards[0].Card.BackText != "cuộc họp" || cards[0].Card.Reading != "かいぎ" {
		t.Fatalf("due cards omit canonical content: %+v", cards)
	}
	previousDueAt := cards[0].DueAt
	reviewedAt := time.Now()
	if err := flashcardreview.NewStore(db).SubmitReview(context.Background(), userID, flashcardreview.ReviewInput{
		UserFlashcardID: cards[0].ID,
		Rating:          "good",
		ReviewedAt:      reviewedAt,
	}); err != nil {
		t.Fatalf("submit review: %v", err)
	}
	var eventPrevious, eventNext time.Time
	if err := db.QueryRow(context.Background(), `SELECT previous_due_at,next_due_at FROM learning.review_event WHERE user_flashcard_id=$1`, cards[0].ID).Scan(&eventPrevious, &eventNext); err != nil {
		t.Fatalf("read saved review event: %v", err)
	}
	if !eventPrevious.Equal(previousDueAt) || !eventNext.After(reviewedAt) {
		t.Fatalf("review event due times previous=%s next=%s", eventPrevious, eventNext)
	}
}

func TestFlashcardReviewHandlersRejectAnonymousAndInvalidRating(t *testing.T) {
	db := testPool(t)
	due := httptest.NewRecorder()
	getDueFlashcardsHandler(flashcardreview.NewStore(db), testLogger()).ServeHTTP(due, httptest.NewRequest(http.MethodGet, "/api/flashcards/reviews/due", nil))
	if due.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous due status=%d body=%s", due.Code, due.Body.String())
	}
	_, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/flashcards/reviews/fixture", `{"rating":"invalid"}`)
	rr := httptest.NewRecorder()
	submitReviewHandler(flashcardreview.NewStore(db), testLogger()).ServeHTTP(rr, req.WithContext(req.Context()))
	if rr.Code != http.StatusBadRequest || !strings.Contains(rr.Body.String(), "invalid rating") {
		t.Fatalf("invalid rating status=%d body=%s", rr.Code, rr.Body.String())
	}
}
