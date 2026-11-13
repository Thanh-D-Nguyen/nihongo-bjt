package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/authn"
)

func adminFlashcardReportsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		if status == "" {
			status = "pending"
		}
		if status != "pending" && status != "resolved" && status != "dismissed" {
			writeJSONError(w, "invalid status", http.StatusBadRequest)
			return
		}
		page := queryInt(r, "page", 1)
		if page < 1 || page > 10000 {
			writeJSONError(w, "invalid page", http.StatusBadRequest)
			return
		}
		const pageSize = 50
		var total int
		if err := db.QueryRow(r.Context(), `SELECT COUNT(*) FROM ops.deck_report WHERE status=$1`, status).Scan(&total); err != nil {
			logger.Error("count deck reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		rows, err := db.Query(r.Context(), `SELECT r.id::text, r.deck_id::text, d.title_vi, d.title_ja,
			d.status, r.reason, r.status, r.created_at, r.reviewed_at, r.review_note
			FROM ops.deck_report r JOIN learning.deck d ON d.id=r.deck_id
			WHERE r.status=$1 ORDER BY r.created_at ASC, r.id ASC LIMIT $2 OFFSET $3`, status, pageSize, (page-1)*pageSize)
		if err != nil {
			logger.Error("list deck reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type item struct {
			ID         string     `json:"id"`
			DeckID     string     `json:"deckId"`
			TitleVi    string     `json:"titleVi"`
			TitleJa    *string    `json:"titleJa"`
			DeckStatus string     `json:"deckStatus"`
			Reason     string     `json:"reason"`
			Status     string     `json:"status"`
			CreatedAt  time.Time  `json:"createdAt"`
			ReviewedAt *time.Time `json:"reviewedAt"`
			ReviewNote *string    `json:"reviewNote"`
		}
		items := make([]item, 0)
		for rows.Next() {
			var x item
			if err := rows.Scan(&x.ID, &x.DeckID, &x.TitleVi, &x.TitleJa, &x.DeckStatus,
				&x.Reason, &x.Status, &x.CreatedAt, &x.ReviewedAt, &x.ReviewNote); err != nil {
				logger.Error("scan deck report", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			items = append(items, x)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate deck reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "page": page, "pageSize": pageSize})
	}
}

func adminFlashcardReportReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "reports", 1)
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid report id", http.StatusBadRequest)
			return
		}
		var input struct {
			Action string `json:"action"`
			Note   string `json:"note"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		input.Note = strings.TrimSpace(input.Note)
		if (input.Action != "remove" && input.Action != "dismiss") || len([]rune(input.Note)) < 3 || len([]rune(input.Note)) > 500 {
			writeJSONError(w, "action must be remove or dismiss; note length must be 3-500", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin deck report review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var deckID, beforeStatus string
		err = tx.QueryRow(r.Context(), `SELECT deck_id::text FROM ops.deck_report WHERE id=$1`, id).Scan(&deckID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "report not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("fetch deck report", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// All reviews for a deck lock the same row before any individual report.
		err = tx.QueryRow(r.Context(), `SELECT id::text FROM learning.deck WHERE id=$1 FOR UPDATE`, deckID).Scan(&deckID)
		if err != nil {
			logger.Error("lock reported deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		err = tx.QueryRow(r.Context(), `SELECT status FROM ops.deck_report WHERE id=$1 FOR UPDATE`, id).Scan(&beforeStatus)
		if err != nil {
			logger.Error("lock deck report", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if beforeStatus != "pending" {
			writeJSONError(w, "report already reviewed", http.StatusConflict)
			return
		}
		status := "dismissed"
		before, _ := json.Marshal(map[string]string{"status": beforeStatus})
		if input.Action == "remove" {
			status = "resolved"
			if _, err = tx.Exec(r.Context(), `UPDATE learning.deck SET status='archived', updated_at=NOW() WHERE id=$1`, deckID); err != nil {
				logger.Error("archive reported deck", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			after, _ := json.Marshal(map[string]string{"status": status, "action": input.Action, "deckId": deckID})
			_, err = tx.Exec(r.Context(), `WITH reviewed AS (
				UPDATE ops.deck_report SET status='resolved', reviewed_by=$2, reviewed_at=NOW(), review_note=$3
				WHERE deck_id=$1 AND status='pending' RETURNING id::text
			)
			INSERT INTO ops.admin_audit_log(action, actor_id, target_type, target_id, reason, before, after)
			SELECT 'admin.flashcards.report.removed', $2, 'ops.deck_report', id, $3, $4::jsonb, $5::jsonb FROM reviewed`,
				deckID, identity.ActorID, input.Note, before, after)
		} else {
			_, err = tx.Exec(r.Context(), `UPDATE ops.deck_report SET status=$1, reviewed_by=$2, reviewed_at=NOW(), review_note=$3 WHERE id=$4`, status, identity.ActorID, input.Note, id)
			if err == nil {
				after, _ := json.Marshal(map[string]string{"status": status, "action": input.Action, "deckId": deckID})
				_, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log(action, actor_id, target_type, target_id, reason, before, after)
					VALUES('admin.flashcards.report.dismissed',$1,'ops.deck_report',$2,$3,$4,$5)`, identity.ActorID, id, input.Note, before, after)
			}
		}
		if err != nil {
			logger.Error("audit deck report review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit deck report review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"id": id, "deckId": deckID, "status": status})
	}
}
