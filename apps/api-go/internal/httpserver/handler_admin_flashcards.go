package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A12: Admin Flashcards — Decks + Variants + Styles (15 routes) ────────
// Contracts derived from NestJS flashcards-admin.controller.ts,
// flashcard-styles-admin.controller.ts, flashcards-admin.repository.ts,
// flashcard-styles.service.ts.
// DB tables: learning.deck, learning.flashcard_variant, learning.flashcard_style,
// ops.admin_audit_log.

// ── Decks ───────────────────────────────────────────────────────────────────

// adminFlashcardDecksListHandler implements GET /api/admin/flashcards/decks.
func adminFlashcardDecksListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 50)
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		visibility := r.URL.Query().Get("visibility")
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 200 {
			pageSize = 50
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" && status != "all" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if visibility != "" && visibility != "all" {
			whereParts = append(whereParts, fmt.Sprintf("visibility = $%d", argIdx))
			args = append(args, visibility)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(title_vi ILIKE $%[1]d OR title_ja ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.deck "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT d.id, d.owner_user_id, d.title_vi, d.title_ja, d.status, d.visibility,
  (SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count,
  d.created_at, d.updated_at
FROM learning.deck d %s ORDER BY d.updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list flashcard decks", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Deck struct {
			ID          string  `json:"id"`
			OwnerUserID *string `json:"ownerUserId"`
			TitleVi     string  `json:"titleVi"`
			TitleJa     *string `json:"titleJa"`
			Status      string  `json:"status"`
			Visibility  string  `json:"visibility"`
			CardCount   int     `json:"cardCount"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}
		var items []Deck
		for rows.Next() {
			var d Deck
			var ca, ua time.Time
			if rows.Scan(&d.ID, &d.OwnerUserID, &d.TitleVi, &d.TitleJa, &d.Status, &d.Visibility, &d.CardCount, &ca, &ua) == nil {
				d.CreatedAt = ca.UTC().Format(time.RFC3339)
				d.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, d)
			}
		}
		if items == nil {
			items = []Deck{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
		})
	}
}

// adminFlashcardDeckGenerateHandler implements POST /api/admin/flashcards/decks/generate.
func adminFlashcardDeckGenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			TitleVi    string `json:"titleVi"`
			TitleJa    string `json:"titleJa"`
			JLPTLevel  string `json:"jlptLevel"`
			MaxCards   int    `json:"maxCards"`
			SourceType string `json:"sourceType"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.TitleVi == "" {
			writeJSONError(w, "titleVi required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin generate flashcard deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO learning.deck
(title_vi, title_ja, status, visibility, created_at, updated_at)
VALUES ($1,NULLIF($2,''),'draft','private',NOW(),NOW()) RETURNING id`,
			req.TitleVi, req.TitleJa).Scan(&id)
		if err != nil {
			logger.Error("generate flashcard deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "titleVi": req.TitleVi})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('admin.flashcards.deck.generated',$1,$2,'learning.deck','auto_generate',$3,NOW())`,
			identity.ActorID, id, afterJSON); err != nil {
			logger.Error("audit generated flashcard deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit generated flashcard deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "draft"})
	}
}

// adminFlashcardDeckDetailHandler implements GET /api/admin/flashcards/decks/{id}.
func adminFlashcardDeckDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "decks", 1)
		if id == "" {
			writeJSONError(w, "deck id required", http.StatusBadRequest)
			return
		}
		type DeckDetail struct {
			ID            string            `json:"id"`
			OwnerUserID   *string           `json:"ownerUserId"`
			TitleVi       string            `json:"titleVi"`
			TitleJa       *string           `json:"titleJa"`
			DescriptionVi *string           `json:"descriptionVi"`
			DescriptionJa *string           `json:"descriptionJa"`
			Status        string            `json:"status"`
			Visibility    string            `json:"visibility"`
			CardCount     int               `json:"cardCount"`
			CreatedAt     string            `json:"createdAt"`
			UpdatedAt     string            `json:"updatedAt"`
			Audit         []json.RawMessage `json:"audit"`
		}
		var d DeckDetail
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT d.id, d.owner_user_id, d.title_vi, d.title_ja, d.description_vi, d.description_ja, d.status, d.visibility,
(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count,
d.created_at, d.updated_at
FROM learning.deck d WHERE d.id=$1`, id).Scan(&d.ID, &d.OwnerUserID, &d.TitleVi, &d.TitleJa, &d.DescriptionVi, &d.DescriptionJa, &d.Status, &d.Visibility, &d.CardCount, &ca, &ua)
		if err != nil {
			writeJSONError(w, "deck not found", http.StatusNotFound)
			return
		}
		d.CreatedAt = ca.UTC().Format(time.RFC3339)
		d.UpdatedAt = ua.UTC().Format(time.RFC3339)

		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='learning.deck'
ORDER BY created_at DESC LIMIT 30`, id)
		d.Audit = []json.RawMessage{}
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var aca time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca) == nil {
					entry, _ := json.Marshal(map[string]any{
						"id": aid, "action": action, "actorId": actorID,
						"reason": reason, "before": before, "after": after,
						"createdAt": aca.UTC().Format(time.RFC3339),
					})
					d.Audit = append(d.Audit, entry)
				}
			}
			auditRows.Close()
		}
		writeJSON(w, http.StatusOK, d)
	}
}

// adminFlashcardDeckTransitionHandler implements POST /api/admin/flashcards/decks/{id}/transition.
func adminFlashcardDeckTransitionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "decks", 1)
		if id == "" {
			writeJSONError(w, "deck id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Next   string `json:"next"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Next != "active" && req.Next != "archived" && req.Next != "draft" {
			writeJSONError(w, "next must be active, archived, or draft", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin deck transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM learning.deck WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "deck not found", http.StatusNotFound)
			return
		}

		actionSuffix := "draft"
		if req.Next == "active" {
			actionSuffix = "approved"
		} else if req.Next == "archived" {
			actionSuffix = "rejected"
		}

		_, err = tx.Exec(r.Context(), "UPDATE learning.deck SET status=$1, updated_at=NOW() WHERE id=$2", req.Next, id)
		if err != nil {
			logger.Error("transition deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Next})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ($1,$2,$3,'learning.deck',$4,$5,$6,NOW())`,
			"admin.flashcards.deck."+actionSuffix, identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit deck transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit deck transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Next})
	}
}

// ── Variants ────────────────────────────────────────────────────────────────

// adminFlashcardVariantsListHandler implements GET /api/admin/flashcards/variants.
func adminFlashcardVariantsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 50)
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		sourceType := r.URL.Query().Get("sourceType")
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 200 {
			pageSize = 50
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" && status != "all" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if sourceType != "" && sourceType != "all" {
			whereParts = append(whereParts, fmt.Sprintf("source_type = $%d", argIdx))
			args = append(args, sourceType)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(front_text ILIKE $%[1]d OR back_text ILIKE $%[1]d OR reading ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.flashcard_variant "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count flashcard variants", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQ := fmt.Sprintf(`SELECT id, source_type, source_id, front_text, back_text, reading, status, created_at, updated_at
FROM learning.flashcard_variant %s ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list flashcard variants", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Variant struct {
			ID         string  `json:"id"`
			SourceType string  `json:"sourceType"`
			SourceID   string  `json:"sourceId"`
			FrontText  string  `json:"frontText"`
			BackText   string  `json:"backText"`
			Reading    *string `json:"reading,omitempty"`
			Status     string  `json:"status"`
			CreatedAt  string  `json:"createdAt"`
			UpdatedAt  string  `json:"updatedAt"`
		}
		var items []Variant
		for rows.Next() {
			var v Variant
			var ca, ua time.Time
			if err := rows.Scan(&v.ID, &v.SourceType, &v.SourceID, &v.FrontText, &v.BackText, &v.Reading, &v.Status, &ca, &ua); err != nil {
				logger.Error("scan flashcard variant", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			v.CreatedAt = ca.UTC().Format(time.RFC3339)
			v.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, v)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate flashcard variants", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Variant{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
		})
	}
}

// adminFlashcardVariantDetailHandler implements GET /api/admin/flashcards/variants/{id}.
func adminFlashcardVariantDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "variants", 1)
		if id == "" {
			writeJSONError(w, "variant id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid variant id", http.StatusBadRequest)
			return
		}
		type VariantDetail struct {
			ID                  string            `json:"id"`
			SourceType          string            `json:"sourceType"`
			SourceID            string            `json:"sourceId"`
			FrontText           string            `json:"frontText"`
			BackText            string            `json:"backText"`
			Reading             *string           `json:"reading,omitempty"`
			Status              string            `json:"status"`
			CreatedAt           string            `json:"createdAt"`
			UpdatedAt           string            `json:"updatedAt"`
			Audit               []json.RawMessage `json:"audit"`
			Canonical           json.RawMessage   `json:"canonical,omitempty"`
			CanonicalCandidates []json.RawMessage `json:"canonicalCandidates"`
			Examples            []json.RawMessage `json:"examples"`
			LexemeExamples      json.RawMessage   `json:"lexemeExamples"`
		}
		var vd VariantDetail
		vd.Audit = []json.RawMessage{}
		vd.CanonicalCandidates = []json.RawMessage{}
		vd.Examples = []json.RawMessage{}
		vd.LexemeExamples = json.RawMessage("[]")
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, source_type, source_id, front_text, back_text, reading, status, created_at, updated_at
FROM learning.flashcard_variant WHERE id=$1`, id).
			Scan(&vd.ID, &vd.SourceType, &vd.SourceID, &vd.FrontText, &vd.BackText, &vd.Reading, &vd.Status, &ca, &ua)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load flashcard variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		vd.CreatedAt = ca.UTC().Format(time.RFC3339)
		vd.UpdatedAt = ua.UTC().Format(time.RFC3339)

		// Audit log
		auditRows, err := db.Query(r.Context(), `SELECT l.id,l.action,l.actor_id,l.reason,l.before,l.after,l.created_at,a.display_name,a.email
FROM ops.admin_audit_log l LEFT JOIN authz.admin_actor a ON a.id=l.actor_id
WHERE l.target_id=$1 AND l.target_type='learning.flashcard_variant'
ORDER BY l.created_at DESC LIMIT 30`, id)
		if err != nil {
			logger.Error("list flashcard variant audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for auditRows.Next() {
			var aid, action, actorID string
			var reason, displayName, email *string
			var before, after json.RawMessage
			var aca time.Time
			if err := auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca, &displayName, &email); err != nil {
				auditRows.Close()
				logger.Error("scan flashcard variant audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			var actor any
			if displayName != nil && email != nil {
				actor = map[string]any{"id": actorID, "displayName": *displayName, "email": *email}
			}
			entry, err := json.Marshal(map[string]any{
				"id": aid, "action": action, "actorId": actorID, "actor": actor,
				"reason": reason, "before": before, "after": after,
				"createdAt": aca.UTC().Format(time.RFC3339),
			})
			if err != nil {
				auditRows.Close()
				logger.Error("encode flashcard variant audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			vd.Audit = append(vd.Audit, entry)
		}
		if err := auditRows.Err(); err != nil {
			auditRows.Close()
			logger.Error("iterate flashcard variant audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		auditRows.Close()

		// Canonical resolution
		if vd.SourceType == "lexeme" || vd.SourceType == "grammar" || vd.SourceType == "kanji" {
			var label string
			var queryErr error
			switch vd.SourceType {
			case "lexeme":
				queryErr = db.QueryRow(r.Context(), "SELECT COALESCE(reading, headword) FROM content.lexeme WHERE id=$1", vd.SourceID).Scan(&label)
			case "grammar":
				queryErr = db.QueryRow(r.Context(), "SELECT pattern FROM content.grammar_point WHERE id=$1", vd.SourceID).Scan(&label)
			case "kanji":
				queryErr = db.QueryRow(r.Context(), "SELECT character FROM content.kanji WHERE id=$1", vd.SourceID).Scan(&label)
			}
			if queryErr != nil && !errors.Is(queryErr, pgx.ErrNoRows) {
				logger.Error("resolve flashcard variant source", "error", queryErr)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if label != "" {
				vd.Canonical, err = json.Marshal(map[string]any{
					"label": label, "sourceId": vd.SourceID, "sourceType": vd.SourceType, "resolvedBy": "stored",
				})
				if err != nil {
					logger.Error("encode flashcard variant source", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
			}
		}
		if vd.SourceType == "lexeme" {
			err := db.QueryRow(r.Context(), `SELECT COALESCE(jsonb_agg(x.example ORDER BY x.position,x.source_key),'[]'::jsonb) FROM (
					SELECT ls.position,lse.source_example_key AS source_key,jsonb_build_object(
						'exampleSentenceId',es.id,'japaneseText',es.japanese_text,'linkId',lse.id,
						'reading',es.reading,'senseId',ls.id,'sensePosition',ls.position,
						'status',es.status,'translationVi',es.translation_vi) AS example
					FROM content.lexeme_sense ls JOIN content.lexeme_sense_example lse ON lse.sense_id=ls.id
					JOIN content.example_sentence es ON es.id=lse.example_sentence_id
					WHERE ls.lexeme_id=$1 ORDER BY ls.position,lse.source_example_key LIMIT 5
				) x`, vd.SourceID).Scan(&vd.LexemeExamples)
			if err != nil {
				logger.Error("load flashcard variant lexeme examples", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		writeJSON(w, http.StatusOK, vd)
	}
}

// adminFlashcardVariantPatchHandler implements PATCH /api/admin/flashcards/variants/{id}.
func adminFlashcardVariantPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "variants", 1)
		if id == "" {
			writeJSONError(w, "variant id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid variant id", http.StatusBadRequest)
			return
		}
		var req struct {
			FrontText *string         `json:"frontText"`
			BackText  *string         `json:"backText"`
			Reading   json.RawMessage `json:"reading"`
			Reason    string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}
		var reading *string
		if len(req.Reading) > 0 && strings.TrimSpace(string(req.Reading)) != "null" {
			var value string
			if err := json.Unmarshal(req.Reading, &value); err != nil {
				writeJSONError(w, "reading must be a string or null", http.StatusBadRequest)
				return
			}
			reading = &value
		}

		if req.FrontText != nil && strings.TrimSpace(*req.FrontText) == "" || req.BackText != nil && strings.TrimSpace(*req.BackText) == "" {
			writeJSONError(w, "frontText and backText cannot be blank", http.StatusBadRequest)
			return
		}
		// Lock the row so the audit snapshot matches the update.
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin patch flashcard variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		var beforeFront, beforeBack string
		var beforeReading *string
		err = tx.QueryRow(r.Context(), "SELECT front_text, back_text, reading FROM learning.flashcard_variant WHERE id=$1 FOR UPDATE", id).
			Scan(&beforeFront, &beforeBack, &beforeReading)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load flashcard variant for patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.FrontText != nil {
			setClauses = append(setClauses, "front_text = $"+itoa(argIdx))
			args = append(args, *req.FrontText)
			argIdx++
		}
		if req.BackText != nil {
			setClauses = append(setClauses, "back_text = $"+itoa(argIdx))
			args = append(args, *req.BackText)
			argIdx++
		}
		if len(req.Reading) > 0 {
			setClauses = append(setClauses, "reading = $"+itoa(argIdx))
			args = append(args, reading)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE learning.flashcard_variant SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := tx.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch flashcard variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, err := json.Marshal(map[string]any{"frontText": beforeFront, "backText": beforeBack, "reading": beforeReading})
		if err != nil {
			logger.Error("encode flashcard variant before state", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"frontText": beforeFront, "backText": beforeBack, "reading": beforeReading}
		if req.FrontText != nil {
			after["frontText"] = *req.FrontText
		}
		if req.BackText != nil {
			after["backText"] = *req.BackText
		}
		if len(req.Reading) > 0 {
			after["reading"] = reading
		}
		afterJSON, err := json.Marshal(after)
		if err != nil {
			logger.Error("encode flashcard variant after state", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('admin.flashcards.variant.updated',$1,$2,'learning.flashcard_variant',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit flashcard variant patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit flashcard variant patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminFlashcardVariantTransitionHandler implements POST /api/admin/flashcards/variants/{id}/transition.
func adminFlashcardVariantTransitionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "variants", 1)
		if id == "" {
			writeJSONError(w, "variant id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid variant id", http.StatusBadRequest)
			return
		}
		var req struct {
			Next   string `json:"next"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Next != "active" && req.Next != "archived" && req.Next != "draft" {
			writeJSONError(w, "next must be active, archived, or draft", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin transition flashcard variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM learning.flashcard_variant WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load flashcard variant for transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		actionSuffix := "drafted"
		if req.Next == "active" {
			actionSuffix = "published"
		} else if req.Next == "archived" {
			actionSuffix = "archived"
		}

		_, err = tx.Exec(r.Context(), "UPDATE learning.flashcard_variant SET status=$1, updated_at=NOW() WHERE id=$2", req.Next, id)
		if err != nil {
			logger.Error("transition variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Next})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ($1,$2,$3,'learning.flashcard_variant',$4,$5,$6,NOW())`,
			"admin.flashcards.variant."+actionSuffix, identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit flashcard variant transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit flashcard variant transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Next})
	}
}

// adminFlashcardVariantSourcePatchHandler implements PATCH /api/admin/flashcards/variants/{id}/source.
func adminFlashcardVariantSourcePatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "variants", 1)
		if id == "" {
			writeJSONError(w, "variant id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid variant id", http.StatusBadRequest)
			return
		}
		var req struct {
			SourceID   string `json:"sourceId"`
			SourceType string `json:"sourceType"`
			Reason     string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.SourceType != "lexeme" && req.SourceType != "grammar" && req.SourceType != "kanji" {
			writeJSONError(w, "sourceType must be lexeme, grammar, or kanji", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(req.SourceID); err != nil {
			writeJSONError(w, "invalid source id", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin remap flashcard variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		// Verify source exists
		var sourceExists bool
		var sourceErr error
		switch req.SourceType {
		case "lexeme":
			sourceErr = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.lexeme WHERE id=$1 AND status='active')", req.SourceID).Scan(&sourceExists)
		case "grammar":
			sourceErr = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.grammar_point WHERE id=$1 AND status='active')", req.SourceID).Scan(&sourceExists)
		case "kanji":
			sourceErr = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.kanji WHERE id=$1 AND status='active')", req.SourceID).Scan(&sourceExists)
		}
		if sourceErr != nil {
			logger.Error("verify flashcard variant source", "error", sourceErr)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !sourceExists {
			writeJSONError(w, req.SourceType+" source not found", http.StatusNotFound)
			return
		}

		var beforeSourceID, beforeSourceType string
		err = tx.QueryRow(r.Context(), "SELECT source_id, source_type FROM learning.flashcard_variant WHERE id=$1 FOR UPDATE", id).
			Scan(&beforeSourceID, &beforeSourceType)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load flashcard variant for source remap", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		_, err = tx.Exec(r.Context(), "UPDATE learning.flashcard_variant SET source_id=$1, source_type=$2, updated_at=NOW() WHERE id=$3",
			req.SourceID, req.SourceType, id)
		if err != nil {
			logger.Error("patch variant source", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"sourceId": beforeSourceID, "sourceType": beforeSourceType})
		afterJSON, _ := json.Marshal(map[string]any{"sourceId": req.SourceID, "sourceType": req.SourceType})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('admin.flashcards.variant.source_remapped',$1,$2,'learning.flashcard_variant',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit flashcard variant source remap", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit flashcard variant source remap", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "sourceId": req.SourceID, "sourceType": req.SourceType})
	}
}

// ── Styles ──────────────────────────────────────────────────────────────────

// adminFlashcardStylesListHandler implements GET /api/admin/flashcards/styles.
func adminFlashcardStylesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		tier := r.URL.Query().Get("tier")
		q := r.URL.Query().Get("q")

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if tier != "" {
			whereParts = append(whereParts, fmt.Sprintf("tier = $%d", argIdx))
			args = append(args, tier)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(slug ILIKE $%[1]d OR name_key ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		rows, err := db.Query(r.Context(), `SELECT id, slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status, created_at, updated_at
FROM learning.flashcard_style `+whereClause+` ORDER BY sort_order ASC, created_at ASC`, args...)
		if err != nil {
			logger.Error("list flashcard styles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Style struct {
			ID             string          `json:"id"`
			Slug           string          `json:"slug"`
			NameKey        string          `json:"nameKey"`
			DescriptionKey *string         `json:"descriptionKey,omitempty"`
			ThumbnailURL   *string         `json:"thumbnailUrl,omitempty"`
			Config         json.RawMessage `json:"config"`
			Tier           string          `json:"tier"`
			SortOrder      int             `json:"sortOrder"`
			Status         string          `json:"status"`
			CreatedAt      string          `json:"createdAt"`
			UpdatedAt      string          `json:"updatedAt"`
		}
		var items []Style
		for rows.Next() {
			var s Style
			var ca, ua time.Time
			if err := rows.Scan(&s.ID, &s.Slug, &s.NameKey, &s.DescriptionKey, &s.ThumbnailURL, &s.Config, &s.Tier, &s.SortOrder, &s.Status, &ca, &ua); err != nil {
				logger.Error("scan flashcard style", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			s.CreatedAt = ca.UTC().Format(time.RFC3339)
			s.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, s)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate flashcard styles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Style{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminFlashcardStylesAdoptionHandler implements GET /api/admin/flashcards/styles/analytics/adoption.
func adminFlashcardStylesAdoptionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT fs.id, fs.slug, fs.name_key, COUNT(DISTINCT up.id) as user_count
FROM learning.flashcard_style fs
LEFT JOIN profile.user_profile up ON up.flashcard_style_slug = fs.slug
GROUP BY fs.id, fs.slug, fs.name_key
ORDER BY user_count DESC`)
		if err != nil {
			logger.Error("flashcard styles adoption", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Adoption struct {
			ID        string `json:"id"`
			Slug      string `json:"slug"`
			NameKey   string `json:"nameKey"`
			UserCount int    `json:"userCount"`
		}
		var items []Adoption
		for rows.Next() {
			var a Adoption
			if err := rows.Scan(&a.ID, &a.Slug, &a.NameKey, &a.UserCount); err != nil {
				logger.Error("scan flashcard style adoption", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			items = append(items, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate flashcard style adoption", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Adoption{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminFlashcardStyleDetailHandler implements GET /api/admin/flashcards/styles/{id}.
func adminFlashcardStyleDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "styles", 1)
		if id == "" {
			writeJSONError(w, "style id required", http.StatusBadRequest)
			return
		}
		type Style struct {
			ID             string          `json:"id"`
			Slug           string          `json:"slug"`
			NameKey        string          `json:"nameKey"`
			DescriptionKey *string         `json:"descriptionKey,omitempty"`
			ThumbnailURL   *string         `json:"thumbnailUrl,omitempty"`
			Config         json.RawMessage `json:"config"`
			Tier           string          `json:"tier"`
			SortOrder      int             `json:"sortOrder"`
			Status         string          `json:"status"`
			CreatedAt      string          `json:"createdAt"`
			UpdatedAt      string          `json:"updatedAt"`
		}
		var s Style
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status, created_at, updated_at
FROM learning.flashcard_style WHERE id=$1`, id).
			Scan(&s.ID, &s.Slug, &s.NameKey, &s.DescriptionKey, &s.ThumbnailURL, &s.Config, &s.Tier, &s.SortOrder, &s.Status, &ca, &ua)
		if err != nil {
			writeJSONError(w, "flashcard style not found", http.StatusNotFound)
			return
		}
		s.CreatedAt = ca.UTC().Format(time.RFC3339)
		s.UpdatedAt = ua.UTC().Format(time.RFC3339)
		writeJSON(w, http.StatusOK, s)
	}
}

var flashcardStyleHexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
var flashcardStyleBackground = regexp.MustCompile(`(?i)^(#[0-9a-f]{6}|linear-gradient\([^;{}]+\))$`)

func validateFlashcardStyleConfig(raw json.RawMessage) error {
	var config map[string]json.RawMessage
	if len(raw) == 0 || json.Unmarshal(raw, &config) != nil || config == nil {
		return fmt.Errorf("config must be an object")
	}
	colors := []string{"accent", "accentForeground", "border", "contentSurface", "controlBackground", "controlForeground", "focusRing", "foreground", "mutedForeground"}
	allowed := map[string]bool{"background": true, "overlay": true, "borderRadius": true, "flipAnimation": true, "fontFamily": true, "shadow": true}
	for _, key := range colors {
		allowed[key] = true
	}
	for key := range config {
		if !allowed[key] {
			return fmt.Errorf("unknown config field %q", key)
		}
	}
	values := map[string]string{}
	for _, key := range append(colors, "background") {
		var value string
		if err := json.Unmarshal(config[key], &value); err != nil || value == "" {
			return fmt.Errorf("config.%s is required", key)
		}
		if key == "background" {
			if !flashcardStyleBackground.MatchString(value) {
				return fmt.Errorf("config.background is invalid")
			}
		} else if !flashcardStyleHexColor.MatchString(value) {
			return fmt.Errorf("config.%s must be a six-digit hex color", key)
		}
		values[key] = value
	}
	if value, ok := config["overlay"]; ok {
		var color string
		if json.Unmarshal(value, &color) != nil || !flashcardStyleHexColor.MatchString(color) {
			return fmt.Errorf("config.overlay must be a six-digit hex color")
		}
	}
	for key, limit := range map[string]int{"borderRadius": 32, "fontFamily": 160, "shadow": 240} {
		if value, ok := config[key]; ok {
			var text string
			if json.Unmarshal(value, &text) != nil || len(text) > limit {
				return fmt.Errorf("config.%s is invalid", key)
			}
		}
	}
	if value, ok := config["flipAnimation"]; ok {
		var animation string
		if json.Unmarshal(value, &animation) != nil || (animation != "rotateX" && animation != "rotateY") {
			return fmt.Errorf("config.flipAnimation is invalid")
		}
	}
	pairs := []struct {
		foreground, background string
		minimum                float64
	}{{"foreground", "contentSurface", 4.5}, {"mutedForeground", "contentSurface", 4.5}, {"accentForeground", "accent", 4.5}, {"controlForeground", "controlBackground", 4.5}, {"border", "contentSurface", 3}, {"focusRing", "contentSurface", 3}}
	luminance := func(color string) float64 {
		value, _ := strconv.ParseUint(color[1:], 16, 24)
		channel := func(shift uint) float64 {
			v := float64((value>>shift)&255) / 255
			if v <= 0.04045 {
				return v / 12.92
			}
			return math.Pow((v+0.055)/1.055, 2.4)
		}
		return 0.2126*channel(16) + 0.7152*channel(8) + 0.0722*channel(0)
	}
	for _, pair := range pairs {
		l1, l2 := luminance(values[pair.foreground]), luminance(values[pair.background])
		if l1 < l2 {
			l1, l2 = l2, l1
		}
		if (l1+0.05)/(l2+0.05) < pair.minimum {
			return fmt.Errorf("config contrast %s/%s is insufficient", pair.foreground, pair.background)
		}
	}
	return nil
}

// adminFlashcardStyleCreateHandler implements POST /api/admin/flashcards/styles.
func adminFlashcardStyleCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug           string          `json:"slug"`
			NameKey        string          `json:"nameKey"`
			DescriptionKey *string         `json:"descriptionKey"`
			ThumbnailURL   *string         `json:"thumbnailUrl"`
			Config         json.RawMessage `json:"config"`
			Tier           string          `json:"tier"`
			SortOrder      *int            `json:"sortOrder"`
			Status         *string         `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Slug = strings.TrimSpace(req.Slug)
		req.NameKey = strings.TrimSpace(req.NameKey)
		if req.Slug == "" || req.NameKey == "" {
			writeJSONError(w, "slug and nameKey required", http.StatusBadRequest)
			return
		}
		tier := strings.TrimSpace(req.Tier)
		if tier == "" {
			tier = "free"
		}
		if tier != "free" && tier != "premium" && tier != "exclusive" {
			writeJSONError(w, "tier must be free, premium, or exclusive", http.StatusBadRequest)
			return
		}
		sortOrder := 0
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}
		status := "draft"
		if req.Status != nil {
			status = strings.TrimSpace(*req.Status)
		}
		if status != "draft" && status != "active" && status != "archived" {
			writeJSONError(w, "status must be draft, active, or archived", http.StatusBadRequest)
			return
		}
		config := req.Config
		if len(config) == 0 {
			writeJSONError(w, "valid theme config required", http.StatusBadRequest)
			return
		}
		if err := validateFlashcardStyleConfig(config); err != nil {
			writeJSONError(w, "invalid theme config", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO learning.flashcard_style
(slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id`,
			req.Slug, req.NameKey, req.DescriptionKey, req.ThumbnailURL, config, tier, sortOrder, status).Scan(&id)
		if err != nil {
			logger.Error("create flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "slug": req.Slug})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('flashcard_style.create',$1,$2,'flashcard_style',NULL,$3,NOW())`,
			identity.ActorID, id, afterJSON); err != nil {
			logger.Error("audit create flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "slug": req.Slug, "status": status})
	}
}

// adminFlashcardStylePatchHandler implements PATCH /api/admin/flashcards/styles/{id}.
func adminFlashcardStylePatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "styles", 1)
		if id == "" {
			writeJSONError(w, "style id required", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if tier, ok := req["tier"]; ok {
			value, valid := tier.(string)
			if !valid || (value != "free" && value != "premium" && value != "exclusive") {
				writeJSONError(w, "tier must be free, premium, or exclusive", http.StatusBadRequest)
				return
			}
		}
		if status, ok := req["status"]; ok {
			value, valid := status.(string)
			if !valid || (value != "draft" && value != "active" && value != "archived") {
				writeJSONError(w, "status must be draft, active, or archived", http.StatusBadRequest)
				return
			}
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin patch flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		// Get before state
		var beforeJSON json.RawMessage
		if err := tx.QueryRow(r.Context(), `SELECT row_to_json(t) FROM (SELECT id, slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status FROM learning.flashcard_style WHERE id=$1 FOR UPDATE) t`, id).Scan(&beforeJSON); err != nil {
			writeJSONError(w, "flashcard style not found", http.StatusNotFound)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"slug": "slug", "nameKey": "name_key", "descriptionKey": "description_key",
			"thumbnailUrl": "thumbnail_url", "tier": "tier", "sortOrder": "sort_order", "status": "status",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}
		if cfg, ok := req["config"]; ok {
			cfgJSON, _ := json.Marshal(cfg)
			if err := validateFlashcardStyleConfig(cfgJSON); err != nil {
				writeJSONError(w, "invalid theme config", http.StatusBadRequest)
				return
			}
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, cfgJSON)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE learning.flashcard_style SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := tx.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(req)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('flashcard_style.update',$1,$2,'flashcard_style',NULL,$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON); err != nil {
			logger.Error("audit patch flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit patch flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminFlashcardStyleTransitionHandler implements POST /api/admin/flashcards/styles/{id}/transition.
func adminFlashcardStyleTransitionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "styles", 1)
		if id == "" {
			writeJSONError(w, "style id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Status string `json:"status"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Status != "draft" && req.Status != "active" && req.Status != "archived" {
			writeJSONError(w, "status must be draft, active, or archived", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin flashcard style transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM learning.flashcard_style WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "flashcard style not found", http.StatusNotFound)
			return
		}

		_, err = tx.Exec(r.Context(), "UPDATE learning.flashcard_style SET status=$1, updated_at=NOW() WHERE id=$2", req.Status, id)
		if err != nil {
			logger.Error("transition flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Status})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('flashcard_style.transition',$1,$2,'flashcard_style',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit flashcard style transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit flashcard style transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Status})
	}
}
