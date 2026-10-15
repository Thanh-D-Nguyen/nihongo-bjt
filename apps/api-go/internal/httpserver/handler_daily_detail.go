package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

type dailyDetail struct {
	ID                string          `json:"id"`
	Title             string          `json:"title"`
	WidgetKind        string          `json:"widgetKind"`
	ContentDate       string          `json:"contentDate"`
	Locale            string          `json:"locale"`
	JapaneseText      *string         `json:"japaneseText"`
	ReadingText       *string         `json:"readingText"`
	ExplanationText   *string         `json:"explanationText"`
	BodyMD            *string         `json:"bodyMd"`
	SourceProvider    *string         `json:"sourceProvider"`
	SourceRef         *string         `json:"sourceRef"`
	LearningSafeguard json.RawMessage `json:"learningSafeguard,omitempty"`
}

func dailyItemDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, err := uuid.Parse(chi.URLParam(r, "id")); err != nil {
			writeJSONError(w, "invalid daily item id", http.StatusBadRequest)
			return
		}
		var item dailyDetail
		err := db.QueryRow(r.Context(), `SELECT id::text,title,widget_kind,content_date::text,locale,
			japanese_text,reading_text,explanation_text,body_md,source_provider,source_ref,
			COALESCE(payload->'learningSafeguard','null'::jsonb)
			FROM daily.daily_content_item WHERE id=$1 AND status='published'`, chi.URLParam(r, "id")).Scan(
			&item.ID, &item.Title, &item.WidgetKind, &item.ContentDate, &item.Locale,
			&item.JapaneseText, &item.ReadingText, &item.ExplanationText, &item.BodyMD,
			&item.SourceProvider, &item.SourceRef, &item.LearningSafeguard)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "daily item not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get daily content item", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if string(item.LearningSafeguard) == "null" {
			item.LearningSafeguard = nil
		}
		writeJSON(w, http.StatusOK, item)
	}
}

type dailySuggestedCard struct {
	FrontText string  `json:"frontText"`
	BackText  string  `json:"backText"`
	Reading   *string `json:"reading"`
}

type dailySuggestedQuiz struct {
	Prompt  string   `json:"prompt"`
	Options []string `json:"options"`
	Answer  string   `json:"answer"`
}

func dailyItemActionHandler(db *pgxpool.Pool, logger *slog.Logger, decks *flashcarddeck.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		itemID := chi.URLParam(r, "id")
		if _, err := uuid.Parse(itemID); err != nil {
			writeJSONError(w, "invalid daily item id", http.StatusBadRequest)
			return
		}
		action := chi.URLParam(r, "action")
		var req struct {
			UserID string `json:"userId"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		// Client-supplied userId is intentionally ignored; identity comes from the session.
		switch action {
		case "mark-useful":
			if err := recordDailyAction(r.Context(), db, identity.UserID, itemID, action, []byte(`{"useful":true}`)); err != nil {
				dailyActionError(w, logger, "mark daily content useful", err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"useful": true})
		case "quick-quiz":
			var quizJSON []byte
			var locale, japaneseText string
			if err := db.QueryRow(r.Context(), `SELECT i.locale,COALESCE(i.japanese_text,''),COALESCE(e.suggested_quiz,'{}'::jsonb)
				FROM daily.daily_content_item i LEFT JOIN daily.daily_learning_extraction e ON e.daily_content_item_id=i.id
				WHERE i.id=$1 AND i.status='published'`, itemID).Scan(&locale, &japaneseText, &quizJSON); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					writeJSONError(w, "daily quiz not found", http.StatusNotFound)
				} else {
					logger.Error("load daily quiz", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
				}
				return
			}
			var quiz dailySuggestedQuiz
			if err := json.Unmarshal(quizJSON, &quiz); err != nil {
				writeJSONError(w, "daily quiz unavailable", http.StatusUnprocessableEntity)
				return
			}
			if !validDailyQuiz(quiz) {
				if japaneseText == "" {
					writeJSONError(w, "daily quiz unavailable", http.StatusUnprocessableEntity)
					return
				}
				rows, err := db.Query(r.Context(), `SELECT japanese_text FROM daily.daily_content_item
					WHERE locale=$1 AND status='published' AND id<>$2 AND japanese_text IS NOT NULL AND japanese_text<>''
					ORDER BY content_date DESC,id LIMIT 12`, locale, itemID)
				if err != nil {
					logger.Error("load daily quiz choices", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				choices := map[string]bool{japaneseText: true}
				options := []string{japaneseText}
				for rows.Next() {
					var choice string
					if err := rows.Scan(&choice); err != nil {
						rows.Close()
						writeJSONError(w, "internal error", http.StatusInternalServerError)
						return
					}
					if !choices[choice] {
						choices[choice] = true
						options = append(options, choice)
					}
					if len(options) == 4 {
						break
					}
				}
				if err := rows.Err(); err != nil {
					rows.Close()
					logger.Error("iterate daily quiz choices", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				rows.Close()
				if len(options) < 2 {
					writeJSONError(w, "daily quiz unavailable", http.StatusUnprocessableEntity)
					return
				}
				rand.Shuffle(len(options), func(i, j int) { options[i], options[j] = options[j], options[i] })
				prompt := "Choose the Japanese phrase from today's lesson."
				if locale == "vi" {
					prompt = "Chọn câu tiếng Nhật trong nội dung hôm nay."
				} else if locale == "ja" {
					prompt = "今日のコンテンツにある日本語の表現を選んでください。"
				}
				quiz = dailySuggestedQuiz{Prompt: prompt, Options: options, Answer: japaneseText}
			}
			quizJSON, err := json.Marshal(quiz)
			if err != nil {
				writeJSONError(w, "daily quiz unavailable", http.StatusUnprocessableEntity)
				return
			}
			if err := recordDailyAction(r.Context(), db, identity.UserID, itemID, action, quizJSON); err != nil {
				dailyActionError(w, logger, "record daily quiz", err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"quiz": quiz})
		case "generate-flashcards":
			var cardsJSON []byte
			var title, japaneseText, backText string
			var readingText *string
			if err := db.QueryRow(r.Context(), `SELECT i.title,COALESCE(i.japanese_text,''),i.reading_text,
				COALESCE(NULLIF(i.explanation_text,''),NULLIF(i.body_md,''),i.title),COALESCE(e.suggested_flashcards,'[]'::jsonb)
				FROM daily.daily_content_item i LEFT JOIN daily.daily_learning_extraction e ON e.daily_content_item_id=i.id
				WHERE i.id=$1 AND i.status='published'`, itemID).Scan(&title, &japaneseText, &readingText, &backText, &cardsJSON); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					writeJSONError(w, "daily flashcards not found", http.StatusNotFound)
				} else {
					logger.Error("load daily flashcards", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
				}
				return
			}
			var cards []dailySuggestedCard
			if err := json.Unmarshal(cardsJSON, &cards); err != nil {
				writeJSONError(w, "daily flashcards unavailable", http.StatusUnprocessableEntity)
				return
			}
			if len(cards) == 0 && japaneseText != "" && backText != "" {
				cards = []dailySuggestedCard{{FrontText: japaneseText, BackText: backText, Reading: readingText}}
			}
			if len(cards) == 0 {
				writeJSONError(w, "daily flashcards unavailable", http.StatusUnprocessableEntity)
				return
			}
			deckCards := make([]flashcarddeck.DeckCardInput, 0, len(cards))
			for _, card := range cards {
				if strings.TrimSpace(card.FrontText) == "" || strings.TrimSpace(card.BackText) == "" {
					writeJSONError(w, "daily flashcards unavailable", http.StatusUnprocessableEntity)
					return
				}
				deckCards = append(deckCards, flashcarddeck.DeckCardInput{FrontText: card.FrontText, BackText: card.BackText, Reading: card.Reading})
			}
			deck, err := decks.CreateDeck(r.Context(), flashcarddeck.CreateDeckInput{
				UserID: identity.UserID, Name: "Cụm từ hằng ngày: " + title, Visibility: "private", Cards: deckCards,
			})
			if err != nil {
				logger.Error("create daily flashcards", "error", err)
				writeJSONError(w, "unable to create daily flashcards", http.StatusInternalServerError)
				return
			}
			actionPayload, err := json.Marshal(map[string]any{"deckId": deck.ID, "cardsCreated": deck.CardCount})
			if err != nil {
				writeJSONError(w, "unable to record daily flashcards", http.StatusInternalServerError)
				return
			}
			if err := recordDailyAction(r.Context(), db, identity.UserID, itemID, action, actionPayload); err != nil {
				dailyActionError(w, logger, "record generated daily flashcards", err)
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"deckId": deck.ID, "cardsCreated": deck.CardCount})
		default:
			writeJSONError(w, "unsupported daily action", http.StatusNotFound)
		}
	}
}

func validDailyQuiz(quiz dailySuggestedQuiz) bool {
	if strings.TrimSpace(quiz.Prompt) == "" || len(quiz.Options) < 2 || strings.TrimSpace(quiz.Answer) == "" {
		return false
	}
	seen := make(map[string]bool, len(quiz.Options))
	answerFound := false
	for _, option := range quiz.Options {
		option = strings.TrimSpace(option)
		if option == "" || seen[option] {
			return false
		}
		seen[option] = true
		answerFound = answerFound || option == quiz.Answer
	}
	return answerFound
}

func recordDailyAction(ctx context.Context, db *pgxpool.Pool, userID, itemID, action string, payload []byte) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`, userID, itemID+":"+action); err != nil {
		return err
	}
	if action == "mark-useful" {
		var alreadyMarked bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM daily.daily_user_action WHERE user_id=$1 AND daily_content_item_id=$2 AND action_type=$3)`, userID, itemID, action).Scan(&alreadyMarked); err != nil {
			return err
		}
		if alreadyMarked {
			return tx.Commit(ctx)
		}
	}
	result, err := tx.Exec(ctx, `INSERT INTO daily.daily_user_action (user_id,daily_content_item_id,action_type,payload,created_at)
		SELECT $1,id,$3,$4,NOW() FROM daily.daily_content_item WHERE id=$2 AND status='published'`, userID, itemID, action, payload)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return tx.Commit(ctx)
}

func dailyActionError(w http.ResponseWriter, logger *slog.Logger, operation string, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSONError(w, "daily item not found", http.StatusNotFound)
		return
	}
	logger.Error(operation, "error", err)
	writeJSONError(w, "internal error", http.StatusInternalServerError)
}
