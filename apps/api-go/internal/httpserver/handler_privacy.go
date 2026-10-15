package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/privacy"
)

// Admin privacy request APIs use the profile.privacy_request schema, which is
// the same persisted store used by the learner privacy workflow.
func adminPrivacyRequestsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	type request struct {
		ID            string          `json:"id"`
		UserID        string          `json:"userId"`
		Kind          string          `json:"kind"`
		Status        string          `json:"status"`
		ResultPayload json.RawMessage `json:"resultPayload"`
		LastError     *string         `json:"lastError"`
		CreatedAt     time.Time       `json:"createdAt"`
		CompletedAt   *time.Time      `json:"completedAt"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		limit, offset := queryInt(r, "limit", 50), queryInt(r, "offset", 0)
		if limit < 1 || limit > 200 {
			limit = 50
		}
		if offset < 0 {
			offset = 0
		}
		kind, status := r.URL.Query().Get("kind"), r.URL.Query().Get("status")
		if kind != "" && kind != "export" && kind != "delete" {
			writeJSONError(w, "invalid kind", http.StatusBadRequest)
			return
		}
		if status != "" && status != "pending" && status != "processing" && status != "completed" && status != "failed" {
			writeJSONError(w, "invalid status", http.StatusBadRequest)
			return
		}
		where, args := []string{}, []any{}
		if kind != "" {
			args = append(args, kind)
			where = append(where, fmt.Sprintf("kind=$%d", len(args)))
		}
		if status != "" {
			args = append(args, status)
			where = append(where, fmt.Sprintf("status=$%d", len(args)))
		}
		clause := ""
		if len(where) != 0 {
			clause = " WHERE " + strings.Join(where, " AND ")
		}
		var total int
		if err := db.QueryRow(r.Context(), "SELECT count(*) FROM profile.privacy_request"+clause, args...).Scan(&total); err != nil {
			logger.Error("count admin privacy requests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		args = append(args, limit, offset)
		rows, err := db.Query(r.Context(), fmt.Sprintf(`SELECT id,user_id,kind,status,result_payload,last_error,created_at,completed_at FROM profile.privacy_request%s ORDER BY created_at DESC,id LIMIT $%d OFFSET $%d`, clause, len(args)-1, len(args)), args...)
		if err != nil {
			logger.Error("list admin privacy requests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := []request{}
		for rows.Next() {
			var item request
			if err := rows.Scan(&item.ID, &item.UserID, &item.Kind, &item.Status, &item.ResultPayload, &item.LastError, &item.CreatedAt, &item.CompletedAt); err != nil {
				logger.Error("scan admin privacy request", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			item.ResultPayload = redactPrivacyArtifact(item.ResultPayload)
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate admin privacy requests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "limit": limit, "offset": offset})
	}
}

func adminPrivacyRequestDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "requests", 1)
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid request id", http.StatusBadRequest)
			return
		}
		var item struct {
			ID            string          `json:"id"`
			UserID        string          `json:"userId"`
			Kind          string          `json:"kind"`
			Status        string          `json:"status"`
			ResultPayload json.RawMessage `json:"resultPayload"`
			LastError     *string         `json:"lastError"`
			CreatedAt     time.Time       `json:"createdAt"`
			CompletedAt   *time.Time      `json:"completedAt"`
			Audit         []any           `json:"audit"`
		}
		err := db.QueryRow(r.Context(), `SELECT id,user_id,kind,status,result_payload,last_error,created_at,completed_at FROM profile.privacy_request WHERE id=$1`, id).
			Scan(&item.ID, &item.UserID, &item.Kind, &item.Status, &item.ResultPayload, &item.LastError, &item.CreatedAt, &item.CompletedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "privacy request not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get admin privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		item.ResultPayload = redactPrivacyArtifact(item.ResultPayload)
		rows, err := db.Query(r.Context(), `SELECT l.id,l.action,l.actor_id,a.display_name,a.email,l.reason,l.before,l.after,l.created_at FROM ops.admin_audit_log l LEFT JOIN authz.admin_actor a ON a.id=l.actor_id WHERE l.target_id=$1 AND l.target_type='privacy.request' ORDER BY l.created_at DESC LIMIT 30`, id)
		if err != nil {
			logger.Error("get privacy request audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		item.Audit = []any{}
		for rows.Next() {
			var auditID, action, actorID string
			var name, email, reason *string
			var before, after json.RawMessage
			var created time.Time
			if err := rows.Scan(&auditID, &action, &actorID, &name, &email, &reason, &before, &after, &created); err != nil {
				rows.Close()
				logger.Error("scan privacy request audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			var actor any
			if name != nil || email != nil {
				actor = map[string]any{"id": actorID, "displayName": name, "email": email}
			}
			item.Audit = append(item.Audit, map[string]any{"id": auditID, "action": action, "actor": actor, "reason": reason, "beforeState": before, "afterState": after, "createdAt": created})
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			logger.Error("iterate privacy request audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		rows.Close()
		writeJSON(w, http.StatusOK, item)
	}
}

func redactPrivacyArtifact(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var payload map[string]json.RawMessage
	if json.Unmarshal(raw, &payload) != nil {
		return nil
	}
	delete(payload, "artifact")
	redacted, _ := json.Marshal(payload)
	return redacted
}

const privacyExportMaxBytes = 5 << 20

// shortcut: exports direct user_id-owned rows, capped at 1,000 rows/table and 5 MiB; add explicit ownership joins before supporting other ownership shapes.
func buildPrivacyExport(ctx context.Context, tx pgx.Tx, userID string) ([]byte, time.Time, error) {
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	var profile json.RawMessage
	if err := tx.QueryRow(ctx, `SELECT to_jsonb(p)-'keycloak_subject' FROM profile.user_profile p WHERE p.id=$1`, userID).Scan(&profile); err != nil {
		return nil, time.Time{}, err
	}
	data := map[string]json.RawMessage{}
	rows, err := tx.Query(ctx, `SELECT DISTINCT ns.nspname, rel.relname
		FROM pg_class rel
		JOIN pg_namespace ns ON ns.oid=rel.relnamespace
		JOIN pg_constraint fk ON fk.conrelid=rel.oid AND fk.contype='f' AND fk.confrelid='profile.user_profile'::regclass
		JOIN pg_attribute src ON src.attrelid=rel.oid AND src.attnum=ANY(fk.conkey) AND src.attname='user_id'
		WHERE rel.relkind IN ('r','p') AND ns.nspname NOT IN ('auth','authz','ops','admin','analytics')
		AND NOT (ns.nspname='profile' AND rel.relname='privacy_request')
		ORDER BY ns.nspname,rel.relname`)
	if err != nil {
		return nil, time.Time{}, err
	}
	type table struct{ schema, name string }
	tables := []table{}
	for rows.Next() {
		var item table
		if err := rows.Scan(&item.schema, &item.name); err != nil {
			rows.Close()
			return nil, time.Time{}, err
		}
		tables = append(tables, item)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, time.Time{}, err
	}
	for _, item := range tables {
		var records json.RawMessage
		query := `SELECT COALESCE(jsonb_agg(row_json),'[]'::jsonb) FROM (
			SELECT to_jsonb(t) AS row_json FROM ` + pgx.Identifier{item.schema, item.name}.Sanitize() + ` t WHERE t.user_id=$1 LIMIT 1001) owned`
		if err := tx.QueryRow(ctx, query, userID).Scan(&records); err != nil {
			return nil, time.Time{}, err
		}
		var recordCount []json.RawMessage
		if err := json.Unmarshal(records, &recordCount); err != nil {
			return nil, time.Time{}, err
		}
		if len(recordCount) > 1000 {
			return nil, time.Time{}, fmt.Errorf("privacy export row limit exceeded for %s.%s", item.schema, item.name)
		}
		data[item.schema+"."+item.name] = records
	}
	export, err := json.Marshal(map[string]any{
		"schemaVersion": 1,
		"generatedAt":   time.Now().UTC(),
		"expiresAt":     expiresAt,
		"profile":       profile,
		"data":          data,
	})
	if err != nil {
		return nil, time.Time{}, err
	}
	if len(export) > privacyExportMaxBytes {
		return nil, time.Time{}, fmt.Errorf("privacy export byte limit exceeded")
	}
	return export, expiresAt, nil
}

func learnerPrivacyExportDownloadHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "requests", 1)
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid request id", http.StatusBadRequest)
			return
		}
		var status string
		var raw json.RawMessage
		err := db.QueryRow(r.Context(), `SELECT status,result_payload FROM profile.privacy_request WHERE id=$1 AND user_id=$2 AND kind='export'`, id, identity.UserID).Scan(&status, &raw)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "privacy export not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read learner privacy export", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var payload struct {
			ExpiresAt time.Time       `json:"expiresAt"`
			Artifact  json.RawMessage `json:"artifact"`
		}
		if json.Unmarshal(raw, &payload) != nil || status != "completed" || len(payload.Artifact) == 0 {
			writeJSONError(w, "privacy export is not available", http.StatusNotFound)
			return
		}
		if !time.Now().Before(payload.ExpiresAt) {
			if _, err := db.Exec(r.Context(), `UPDATE profile.privacy_request SET result_payload=result_payload-'artifact' WHERE id=$1 AND user_id=$2`, id, identity.UserID); err != nil {
				logger.Error("expire learner privacy export", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSONError(w, "privacy export has expired", http.StatusGone)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="kotobaworks-export-`+id+`.json"`)
		w.Header().Set("Cache-Control", "private, no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(payload.Artifact)
	}
}

type adminPrivacyMutation struct {
	Reason            string  `json:"reason"`
	ConfirmationToken string  `json:"confirmationToken"`
	DownloadURL       *string `json:"downloadUrl"`
	Notes             *string `json:"notes"`
}

func mutateAdminPrivacyRequest(db *pgxpool.Pool, logger *slog.Logger, action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "requests", 1)
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid request id", http.StatusBadRequest)
			return
		}
		var req adminPrivacyMutation
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len([]rune(req.Reason)) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}
		if action == "erasure-confirm" && req.ConfirmationToken != id {
			writeJSONError(w, "confirmationToken must match request id", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin privacy mutation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(r.Context()) }()
		var kind, status, userID string
		err = tx.QueryRow(r.Context(), `SELECT kind,status,user_id FROM profile.privacy_request WHERE id=$1 FOR UPDATE`, id).Scan(&kind, &status, &userID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "privacy request not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read privacy request for mutation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		newStatus, auditAction := "", "privacy.request."
		beforeJSON, _ := json.Marshal(map[string]any{"status": status})
		after := map[string]any{"reason": req.Reason}
		var payload, lastError, completed any
		switch action {
		case "acknowledge":
			if status != "pending" {
				writeJSONError(w, "only pending requests can be acknowledged", http.StatusBadRequest)
				return
			}
			newStatus, auditAction = "processing", auditAction+"acknowledged"
			after["status"] = newStatus
		case "fulfill":
			if kind != "export" {
				writeJSONError(w, "only export requests can be fulfilled", http.StatusBadRequest)
				return
			}
			if status != "pending" && status != "processing" {
				writeJSONError(w, "only open requests can be fulfilled", http.StatusBadRequest)
				return
			}
			artifact, expiresAt, exportErr := buildPrivacyExport(r.Context(), tx, userID)
			if exportErr != nil {
				logger.Error("generate learner privacy export", "error", exportErr, "request_id", id)
				if strings.Contains(exportErr.Error(), "limit exceeded") {
					writeJSONError(w, "learner export exceeds the supported size", http.StatusRequestEntityTooLarge)
				} else {
					writeJSONError(w, "could not generate learner export", http.StatusInternalServerError)
				}
				return
			}
			p, _ := json.Marshal(map[string]any{"reason": req.Reason, "expiresAt": expiresAt, "artifact": json.RawMessage(artifact)})
			payload = p
			newStatus, auditAction = "completed", auditAction+"fulfilled"
			after["status"], after["expiresAt"] = newStatus, expiresAt
			completed = time.Now().UTC()
		case "reject":
			if status != "pending" && status != "processing" {
				writeJSONError(w, "only open requests can be rejected", http.StatusBadRequest)
				return
			}
			newStatus, auditAction = "failed", auditAction+"rejected"
			after["status"] = newStatus
		case "erasure-confirm":
			if kind != "delete" {
				writeJSONError(w, "only erasure (delete) requests can be confirmed", http.StatusBadRequest)
				return
			}
			if status != "pending" && status != "processing" {
				writeJSONError(w, "only open erasure requests can be confirmed", http.StatusBadRequest)
				return
			}
			// Preserve the request and its audit trail while removing its link to the
			// learner. The profile delete applies the schema's ON DELETE actions.
			if _, err = tx.Exec(r.Context(), `UPDATE profile.privacy_request SET user_id=gen_random_uuid() WHERE user_id=$1`, userID); err != nil {
				logger.Error("anonymize privacy requests for erasure", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			tag, deleteErr := tx.Exec(r.Context(), `DELETE FROM profile.user_profile WHERE id=$1`, userID)
			if deleteErr != nil {
				logger.Error("erase learner profile", "error", deleteErr)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if tag.RowsAffected() != 1 {
				writeJSONError(w, "learner profile not found", http.StatusConflict)
				return
			}
			newStatus, auditAction = "completed", "privacy.erasure.confirmed"
			after["status"], after["kind"], after["irreversible"] = newStatus, kind, true
		}
		afterJSON, _ := json.Marshal(after)
		if action == "acknowledge" {
			p := map[string]any{"reason": req.Reason}
			b, _ := json.Marshal(p)
			payload = b
		}
		if action == "reject" {
			lastError = req.Reason
		}
		if action == "erasure-confirm" {
			p := map[string]any{"reason": req.Reason, "irreversible": true}
			b, _ := json.Marshal(p)
			payload = b
			completed = time.Now()
		}
		_, err = tx.Exec(r.Context(), `UPDATE profile.privacy_request SET status=$1,result_payload=COALESCE($2,result_payload),last_error=COALESCE($3,last_error),completed_at=COALESCE($4,completed_at) WHERE id=$5`, newStatus, payload, lastError, completed, id)
		if err != nil {
			logger.Error("update admin privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log(action,actor_id,target_id,target_type,reason,before,after,created_at) VALUES($1,$2,$3,'privacy.request',$4,$5,$6,NOW())`, auditAction, identity.ActorID, id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit admin privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			logger.Error("commit admin privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		result := map[string]any{"id": id, "status": newStatus}
		if action == "erasure-confirm" {
			result["irreversible"] = true
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func adminPrivacyRequestAcknowledgeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return mutateAdminPrivacyRequest(db, logger, "acknowledge")
}
func adminPrivacyRequestFulfillHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return mutateAdminPrivacyRequest(db, logger, "fulfill")
}
func adminPrivacyRequestRejectHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return mutateAdminPrivacyRequest(db, logger, "reject")
}
func adminPrivacyErasureConfirmHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return mutateAdminPrivacyRequest(db, logger, "erasure-confirm")
}

// listPrivacyRequestsHandler implements GET /api/learner/privacy/requests.
func listPrivacyRequestsHandler(store *privacy.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		requests, err := store.ListRequests(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("list privacy requests", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for i := range requests {
			if requests[i].ResultPayload != nil {
				redacted := redactPrivacyArtifact(json.RawMessage(*requests[i].ResultPayload))
				value := string(redacted)
				requests[i].ResultPayload = &value
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "private, no-store")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(requests)
	}
}

// createPrivacyRequestBody is the JSON body for POST /api/learner/privacy/requests.
type createPrivacyRequestBody struct {
	Kind   string `json:"kind"`
	UserID string `json:"userId"` // accepted for old clients; identity always comes from the session
}

// createPrivacyRequestHandler implements POST /api/learner/privacy/requests.
func createPrivacyRequestHandler(store *privacy.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req createPrivacyRequestBody
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		switch req.Kind {
		case "", "export", "data_export":
			req.Kind = "export"
		case "delete", "account_deletion":
			req.Kind = "delete"
		default:
			writeJSONError(w, "invalid privacy request kind", http.StatusBadRequest)
			return
		}
		result, err := store.CreateRequest(r.Context(), identity.UserID, privacy.CreateInput{
			Kind: req.Kind,
		})
		if err != nil {
			logger.Error("create privacy request", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(result)
	}
}
