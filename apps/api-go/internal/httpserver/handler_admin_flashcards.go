package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

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

		dataQ := fmt.Sprintf(`SELECT d.id, d.title_vi, d.title_ja, d.status, d.visibility,
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
			ID        string `json:"id"`
			TitleVi   string `json:"titleVi"`
			TitleJa   string `json:"titleJa"`
			Status    string `json:"status"`
			Visibility string `json:"visibility"`
			CardCount int    `json:"cardCount"`
			CreatedAt string `json:"createdAt"`
			UpdatedAt string `json:"updatedAt"`
		}
		var items []Deck
		for rows.Next() {
			var d Deck
			var ca, ua time.Time
			if rows.Scan(&d.ID, &d.TitleVi, &d.TitleJa, &d.Status, &d.Visibility, &d.CardCount, &ca, &ua) == nil {
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
		if req.MaxCards < 1 {
			req.MaxCards = 20
		}

		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO learning.deck
(title_vi, title_ja, status, visibility, source_type, jlpt_level, max_cards, created_at, updated_at)
VALUES ($1,$2,'draft','private',$3,$4,$5,NOW(),NOW()) RETURNING id`,
			req.TitleVi, req.TitleJa, req.SourceType, req.JLPTLevel, req.MaxCards).Scan(&id)
		if err != nil {
			logger.Error("generate flashcard deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "titleVi": req.TitleVi})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('admin.flashcards.deck.generated',$1,$2,'learning.deck','auto_generate',$3,NOW())`,
			identity.ActorID, id, afterJSON)

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
			ID         string            `json:"id"`
			TitleVi    string            `json:"titleVi"`
			TitleJa    string            `json:"titleJa"`
			Status     string            `json:"status"`
			Visibility string            `json:"visibility"`
			CardCount  int               `json:"cardCount"`
			CreatedAt  string            `json:"createdAt"`
			UpdatedAt  string            `json:"updatedAt"`
			Audit      []json.RawMessage `json:"audit"`
		}
		var d DeckDetail
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT d.id, d.title_vi, d.title_ja, d.status, d.visibility,
(SELECT COUNT(*) FROM learning.deck_card dc WHERE dc.deck_id = d.id) as card_count,
d.created_at, d.updated_at
FROM learning.deck d WHERE d.id=$1`, id).Scan(&d.ID, &d.TitleVi, &d.TitleJa, &d.Status, &d.Visibility, &d.CardCount, &ca, &ua)
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

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM learning.deck WHERE id=$1", id).Scan(&beforeStatus)
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

		_, err = db.Exec(r.Context(), "UPDATE learning.deck SET status=$1, updated_at=NOW() WHERE id=$2", req.Next, id)
		if err != nil {
			logger.Error("transition deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Next})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ($1,$2,$3,'learning.deck',$4,$5,$6,NOW())`,
			"admin.flashcards.deck."+actionSuffix, identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

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
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.flashcard_variant "+whereClause, args...).Scan(&total)

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
			if rows.Scan(&v.ID, &v.SourceType, &v.SourceID, &v.FrontText, &v.BackText, &v.Reading, &v.Status, &ca, &ua) == nil {
				v.CreatedAt = ca.UTC().Format(time.RFC3339)
				v.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, v)
			}
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
		}
		var vd VariantDetail
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, source_type, source_id, front_text, back_text, reading, status, created_at, updated_at
FROM learning.flashcard_variant WHERE id=$1`, id).
			Scan(&vd.ID, &vd.SourceType, &vd.SourceID, &vd.FrontText, &vd.BackText, &vd.Reading, &vd.Status, &ca, &ua)
		if err != nil {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}
		vd.CreatedAt = ca.UTC().Format(time.RFC3339)
		vd.UpdatedAt = ua.UTC().Format(time.RFC3339)

		// Audit log
		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='learning.flashcard_variant'
ORDER BY created_at DESC LIMIT 30`, id)
		vd.Audit = []json.RawMessage{}
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
					vd.Audit = append(vd.Audit, entry)
				}
			}
			auditRows.Close()
		}

		// Canonical resolution
		if vd.SourceType == "lexeme" || vd.SourceType == "grammar" || vd.SourceType == "kanji" {
			var label string
			switch vd.SourceType {
			case "lexeme":
				db.QueryRow(r.Context(), "SELECT COALESCE(reading, headword) FROM content.lexeme WHERE id=$1", vd.SourceID).Scan(&label)
			case "grammar":
				db.QueryRow(r.Context(), "SELECT pattern FROM content.grammar_point WHERE id=$1", vd.SourceID).Scan(&label)
			case "kanji":
				db.QueryRow(r.Context(), "SELECT character FROM content.kanji WHERE id=$1", vd.SourceID).Scan(&label)
			}
			if label != "" {
				vd.Canonical, _ = json.Marshal(map[string]any{
					"label": label, "sourceId": vd.SourceID, "sourceType": vd.SourceType, "resolvedBy": "stored",
				})
			}
		}
		vd.CanonicalCandidates = []json.RawMessage{}

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
		var req struct {
			FrontText *string `json:"frontText"`
			BackText  *string `json:"backText"`
			Reading   *string `json:"reading"`
			Reason    string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		// Get before state
		var beforeFront, beforeBack string
		var beforeReading *string
		err := db.QueryRow(r.Context(), "SELECT front_text, back_text, reading FROM learning.flashcard_variant WHERE id=$1", id).
			Scan(&beforeFront, &beforeBack, &beforeReading)
		if err != nil {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
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
		if req.Reading != nil {
			setClauses = append(setClauses, "reading = $"+itoa(argIdx))
			args = append(args, *req.Reading)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE learning.flashcard_variant SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch flashcard variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"frontText": beforeFront, "backText": beforeBack, "reading": beforeReading})
		afterJSON, _ := json.Marshal(map[string]any{"frontText": req.FrontText, "backText": req.BackText, "reading": req.Reading})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('admin.flashcards.variant.updated',$1,$2,'learning.flashcard_variant',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

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

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM learning.flashcard_variant WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}

		actionSuffix := "drafted"
		if req.Next == "active" {
			actionSuffix = "published"
		} else if req.Next == "archived" {
			actionSuffix = "archived"
		}

		_, err = db.Exec(r.Context(), "UPDATE learning.flashcard_variant SET status=$1, updated_at=NOW() WHERE id=$2", req.Next, id)
		if err != nil {
			logger.Error("transition variant", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Next})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ($1,$2,$3,'learning.flashcard_variant',$4,$5,$6,NOW())`,
			"admin.flashcards.variant."+actionSuffix, identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

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
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		// Verify source exists
		var sourceExists bool
		switch req.SourceType {
		case "lexeme":
			db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.lexeme WHERE id=$1 AND status='active')", req.SourceID).Scan(&sourceExists)
		case "grammar":
			db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.grammar_point WHERE id=$1 AND status='active')", req.SourceID).Scan(&sourceExists)
		case "kanji":
			db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.kanji WHERE id=$1 AND status='active')", req.SourceID).Scan(&sourceExists)
		}
		if !sourceExists {
			writeJSONError(w, req.SourceType+" source not found", http.StatusNotFound)
			return
		}

		var beforeSourceID, beforeSourceType string
		err := db.QueryRow(r.Context(), "SELECT source_id, source_type FROM learning.flashcard_variant WHERE id=$1", id).
			Scan(&beforeSourceID, &beforeSourceType)
		if err != nil {
			writeJSONError(w, "flashcard variant not found", http.StatusNotFound)
			return
		}

		_, err = db.Exec(r.Context(), "UPDATE learning.flashcard_variant SET source_id=$1, source_type=$2, updated_at=NOW() WHERE id=$3",
			req.SourceID, req.SourceType, id)
		if err != nil {
			logger.Error("patch variant source", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"sourceId": beforeSourceID, "sourceType": beforeSourceType})
		afterJSON, _ := json.Marshal(map[string]any{"sourceId": req.SourceID, "sourceType": req.SourceType})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('admin.flashcards.variant.source_remapped',$1,$2,'learning.flashcard_variant',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

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
			if rows.Scan(&s.ID, &s.Slug, &s.NameKey, &s.DescriptionKey, &s.ThumbnailURL, &s.Config, &s.Tier, &s.SortOrder, &s.Status, &ca, &ua) == nil {
				s.CreatedAt = ca.UTC().Format(time.RFC3339)
				s.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, s)
			}
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
		rows, err := db.Query(r.Context(), `SELECT fs.id, fs.slug, fs.name_key, COUNT(DISTINCT up.user_id) as user_count
FROM learning.flashcard_style fs
LEFT JOIN profile.reading_user_preference up ON up.user_id = fs.id
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
			if rows.Scan(&a.ID, &a.Slug, &a.NameKey, &a.UserCount) == nil {
				items = append(items, a)
			}
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
		if req.Slug == "" || req.NameKey == "" {
			writeJSONError(w, "slug and nameKey required", http.StatusBadRequest)
			return
		}
		sortOrder := 0
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}
		status := "draft"
		if req.Status != nil {
			status = *req.Status
		}
		config := req.Config
		if len(config) == 0 {
			config = []byte("{}")
		}

		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO learning.flashcard_style
(slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id`,
			req.Slug, req.NameKey, req.DescriptionKey, req.ThumbnailURL, config, req.Tier, sortOrder, status).Scan(&id)
		if err != nil {
			logger.Error("create flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "slug": req.Slug})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('flashcard_style.create',$1,$2,'flashcard_style',NULL,$3,NOW())`,
			identity.ActorID, id, afterJSON)

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

		// Get before state
		var beforeJSON json.RawMessage
		db.QueryRow(r.Context(), `SELECT row_to_json(t) FROM (SELECT id, slug, name_key, description_key, thumbnail_url, config, tier, sort_order, status FROM learning.flashcard_style WHERE id=$1) t`, id).Scan(&beforeJSON)
		if beforeJSON == nil {
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
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('flashcard_style.update',$1,$2,'flashcard_style',NULL,$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON)

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

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM learning.flashcard_style WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "flashcard style not found", http.StatusNotFound)
			return
		}

		_, err = db.Exec(r.Context(), "UPDATE learning.flashcard_style SET status=$1, updated_at=NOW() WHERE id=$2", req.Status, id)
		if err != nil {
			logger.Error("transition flashcard style", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Status})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('flashcard_style.transition',$1,$2,'flashcard_style',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Status})
	}
}