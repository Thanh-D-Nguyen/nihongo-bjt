package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type cardgenRequest struct {
	Mode       string `json:"mode"`
	SourceType string `json:"sourceType"`
	Level      string `json:"level"`
	Direction  string `json:"direction"`
	Count      int    `json:"count"`
	Topic      string `json:"topic"`
}

type generatedCard struct {
	SourceID   string `json:"sourceId"`
	SourceType string `json:"sourceType"`
	FrontText  string `json:"frontText"`
	BackText   string `json:"backText"`
	Reading    string `json:"reading,omitempty"`
}

func decodeCardgenRequest(w http.ResponseWriter, r *http.Request) (cardgenRequest, bool) {
	var req cardgenRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSONError(w, "invalid request body", http.StatusBadRequest)
		return req, false
	}
	var trailing any
	if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
		writeJSONError(w, "invalid request body", http.StatusBadRequest)
		return req, false
	}
	if req.Count < 1 || req.Count > 100 || (req.Mode != "by_level" && req.Mode != "by_topic" && req.Mode != "by_weak_area" && req.Mode != "daily_auto") || (req.Direction != "jp_to_vn" && req.Direction != "vn_to_jp" && req.Direction != "both") {
		writeJSONError(w, "invalid card generation options", http.StatusBadRequest)
		return req, false
	}
	if req.SourceType != "lexeme" && req.SourceType != "grammar" && req.SourceType != "kanji" {
		writeJSONError(w, "invalid card source", http.StatusBadRequest)
		return req, false
	}
	if (req.Mode == "by_level" || req.Mode == "daily_auto") && !validCardgenLevel(req.Level) {
		writeJSONError(w, "invalid JLPT level", http.StatusBadRequest)
		return req, false
	}
	if req.Mode == "by_topic" && strings.TrimSpace(req.Topic) == "" {
		writeJSONError(w, "topic is required", http.StatusBadRequest)
		return req, false
	}
	if len(req.Topic) > 120 {
		writeJSONError(w, "topic is too long", http.StatusBadRequest)
		return req, false
	}
	return req, true
}

func validCardgenLevel(level string) bool {
	switch level {
	case "N5", "N4", "N3", "N2", "N1":
		return true
	default:
		return false
	}
}

func postCardgenPreviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		req, ok := decodeCardgenRequest(w, r)
		if !ok {
			return
		}
		cards, err := loadCardgenCards(r, db, req, identity.UserID)
		if err != nil {
			logger.Error("cardgen preview", "error", err)
			writeJSONError(w, "unable to preview cards", http.StatusInternalServerError)
			return
		}
		applyCardgenDirection(cards, req.Direction)
		writeJSON(w, http.StatusOK, map[string]any{"estimatedCards": len(cards), "sampleCards": cards})
	}
}

func postCardgenGenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		req, ok := decodeCardgenRequest(w, r)
		if !ok {
			return
		}
		cards, err := loadCardgenCards(r, db, req, identity.UserID)
		if err != nil {
			logger.Error("cardgen select content", "error", err)
			writeJSONError(w, "unable to select cards", http.StatusInternalServerError)
			return
		}
		if len(cards) == 0 {
			writeJSONError(w, "no active cards match these options", http.StatusUnprocessableEntity)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("cardgen begin transaction", "error", err)
			writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		params, _ := json.Marshal(req)
		var jobID, deckID string
		if err = tx.QueryRow(r.Context(), `INSERT INTO learning.flashcard_gen_job
			(user_id, mode, status, params, started_at) VALUES ($1,$2,'running',$3,NOW()) RETURNING id::text`, identity.UserID, req.Mode, params).Scan(&jobID); err != nil {
			logger.Error("cardgen create job", "error", err)
			writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
			return
		}
		title := "Thẻ " + req.SourceType
		if req.Mode == "by_level" || req.Mode == "daily_auto" {
			title += " " + req.Level
		} else if req.Mode == "by_topic" {
			title += ": " + strings.TrimSpace(req.Topic)
		}
		if err = tx.QueryRow(r.Context(), `INSERT INTO learning.deck (owner_user_id,title_vi,visibility,status,updated_at)
			VALUES ($1,$2,'private','active',NOW()) RETURNING id::text`, identity.UserID, title).Scan(&deckID); err != nil {
			logger.Error("cardgen create deck", "error", err)
			writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
			return
		}
		applyCardgenDirection(cards, req.Direction)
		for i := range cards {
			card := &cards[i]
			var cardID string
			err = tx.QueryRow(r.Context(), `SELECT id::text FROM learning.flashcard_variant
				WHERE source_type=$1 AND source_id=$2 AND front_text=$3 AND back_text=$4 AND status='active' LIMIT 1`, card.SourceType, card.SourceID, card.FrontText, card.BackText).Scan(&cardID)
			if errors.Is(err, pgx.ErrNoRows) {
				err = tx.QueryRow(r.Context(), `INSERT INTO learning.flashcard_variant
					(source_type,source_id,front_text,back_text,reading,status,updated_at) VALUES ($1,$2,$3,$4,$5,'active',NOW()) RETURNING id::text`, card.SourceType, card.SourceID, card.FrontText, card.BackText, nullableString(card.Reading)).Scan(&cardID)
			}
			if err != nil {
				logger.Error("cardgen create card", "error", err)
				writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
				return
			}
			if _, err = tx.Exec(r.Context(), `INSERT INTO learning.deck_card (deck_id,card_id,position) VALUES ($1,$2,$3)`, deckID, cardID, i+1); err != nil {
				logger.Error("cardgen link card", "error", err)
				writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
				return
			}
			if _, err = tx.Exec(r.Context(), `INSERT INTO learning.user_flashcard (user_id,card_id,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (user_id,card_id) DO NOTHING`, identity.UserID, cardID); err != nil {
				logger.Error("cardgen enroll card", "error", err)
				writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
				return
			}
		}
		if _, err = tx.Exec(r.Context(), `UPDATE learning.flashcard_gen_job SET status='completed',cards_generated=$2,deck_id=$3,completed_at=NOW() WHERE id=$1`, jobID, len(cards), deckID); err != nil {
			logger.Error("cardgen complete job", "error", err)
			writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			logger.Error("cardgen commit", "error", err)
			writeJSONError(w, "unable to generate cards", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"job":  map[string]any{"id": jobID, "status": "completed", "cardsGenerated": len(cards)},
			"deck": map[string]string{"id": deckID}, "cardsGenerated": len(cards),
		})
	}
}

func applyCardgenDirection(cards []generatedCard, direction string) {
	for i := range cards {
		if direction == "vn_to_jp" || (direction == "both" && i%2 == 1) {
			cards[i].FrontText, cards[i].BackText = cards[i].BackText, cards[i].FrontText
		}
	}
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func loadCardgenCards(r *http.Request, db *pgxpool.Pool, req cardgenRequest, userID string) ([]generatedCard, error) {
	if req.Mode == "by_weak_area" {
		return loadWeakCardgenCards(r, db, req, userID)
	}
	selectSQL := ""
	filter := ""
	levelArg, topicArg := any(req.Level), any("%"+strings.TrimSpace(req.Topic)+"%")
	switch req.SourceType {
	case "lexeme":
		selectSQL = `SELECT id::text,'lexeme',headword,COALESCE(NULLIF(short_meaning_vi,''),NULLIF(kanji_meaning_vi,''),''),COALESCE(reading,'') FROM content.lexeme WHERE status='active'`
		if req.Mode == "by_level" || req.Mode == "daily_auto" {
			filter = " AND jlpt_level=$1"
		}
		if req.Mode == "by_topic" {
			filter = " AND (headword ILIKE $1 OR COALESCE(short_meaning_vi,'') ILIKE $1 OR COALESCE(kanji_meaning_vi,'') ILIKE $1)"
		}
	case "grammar":
		selectSQL = `SELECT id::text,'grammar',pattern,meaning_vi,'' FROM content.grammar_point WHERE status='active'`
		if req.Mode == "by_level" || req.Mode == "daily_auto" {
			filter = " AND jlpt_level=$1"
		}
		if req.Mode == "by_topic" {
			filter = " AND (COALESCE(category,'') ILIKE $1 OR pattern ILIKE $1 OR meaning_vi ILIKE $1)"
		}
	case "kanji":
		selectSQL = `SELECT id::text,'kanji',character,COALESCE(meaning_vi,''),COALESCE(NULLIF(onyomi,''),kunyomi,'') FROM content.kanji WHERE status='active'`
		if req.Mode == "by_level" || req.Mode == "daily_auto" {
			filter = " AND level=$1"
			levelArg = int(req.Level[1] - '0')
		}
		if req.Mode == "by_topic" {
			filter = " AND (character ILIKE $1 OR COALESCE(meaning_vi,'') ILIKE $1)"
		}
	}
	if req.Mode == "by_topic" {
		levelArg = topicArg
	}
	query := selectSQL + filter + " ORDER BY id LIMIT $2"
	rows, err := db.Query(r.Context(), query, levelArg, req.Count)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cards := make([]generatedCard, 0, req.Count)
	for rows.Next() {
		var card generatedCard
		if err := rows.Scan(&card.SourceID, &card.SourceType, &card.FrontText, &card.BackText, &card.Reading); err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}

func loadWeakCardgenCards(r *http.Request, db *pgxpool.Pool, req cardgenRequest, userID string) ([]generatedCard, error) {
	canonicalTable, canonicalJoin := "", ""
	switch req.SourceType {
	case "lexeme":
		canonicalTable, canonicalJoin = "content.lexeme", "c.status='active' AND c.id=fv.source_id"
	case "grammar":
		canonicalTable, canonicalJoin = "content.grammar_point", "c.status='active' AND c.id=fv.source_id"
	case "kanji":
		canonicalTable, canonicalJoin = "content.kanji", "c.status='active' AND c.id=fv.source_id"
	}
	query := fmt.Sprintf(`SELECT fv.source_id::text,fv.source_type,fv.front_text,fv.back_text,COALESCE(fv.reading,'')
		FROM learning.user_flashcard uf JOIN learning.flashcard_variant fv ON fv.id=uf.card_id
		JOIN %s c ON %s WHERE uf.user_id=$1 AND fv.source_type=$2 AND fv.status='active'
		AND (uf.state IN ('learning','relearning') OR uf.lapses>0) ORDER BY uf.lapses DESC,uf.due_at ASC LIMIT $3`, canonicalTable, canonicalJoin)
	rows, err := db.Query(r.Context(), query, userID, req.SourceType, req.Count)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cards := make([]generatedCard, 0, req.Count)
	for rows.Next() {
		var card generatedCard
		if err := rows.Scan(&card.SourceID, &card.SourceType, &card.FrontText, &card.BackText, &card.Reading); err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}
