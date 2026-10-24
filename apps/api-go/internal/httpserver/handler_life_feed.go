package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/lifefeed"
)

// GET /api/life/feed?city=<city> returns published, reviewed and rights-cleared lessons.
// Keep 404 until editorial content is approved: sending only a date card would erase
// all built-in sample topics in the iOS client (it replaces samples atomically).
func lifeFeedHandler(db *pgxpool.Pool, logger *slog.Logger, now func() time.Time) http.HandlerFunc {
	weather := lifefeed.NewWeatherProvider(os.Getenv("MET_NORWAY_USER_AGENT"))
	return func(w http.ResponseWriter, r *http.Request) {
		city := r.URL.Query().Get("city")
		if !lifefeed.Cities[city] {
			writeJSONError(w, "unknown city", http.StatusBadRequest)
			return
		}
		if db == nil {
			writeJSONError(w, "life feed unavailable", http.StatusServiceUnavailable)
			return
		}
		current := now().In(lifefeed.JST)
		day := current.Format("2006-01-02")
		// shortcut: scan at most 16 reviewed candidates per topic; raise this only if editorial history justifies it.
		rows, err := db.Query(r.Context(), `SELECT candidate.card FROM
  unnest(ARRAY['weather','transit','shopping','news','food','culture','money','lottery']::text[]) WITH ORDINALITY AS topic_order(topic,position)
  CROSS JOIN LATERAL (
    SELECT card,updated_at,card_key FROM daily.life_lesson
    WHERE status='published' AND rights_status='cleared' AND topic=topic_order.topic
      AND (city_id IS NULL OR city_id=$1)
      AND valid_from<=$2::date AND valid_until>=$2::date AND source_expires_at>$3
      AND (topic_order.topic <> 'weather' OR card #>> '{lesson,source,licenseStatus}' = 'commercial')
    ORDER BY updated_at DESC, card_key LIMIT 16
  ) AS candidate
  ORDER BY topic_order.position, candidate.updated_at DESC, candidate.card_key`, city, day, current)
		if err != nil {
			logger.Error("query life feed", "error", err)
			writeJSONError(w, "life feed unavailable", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		cards := []lifefeed.Card{lifefeed.DateCard(current)}
		ids := map[string]bool{cards[0].ID: true}
		topics := map[string]bool{"date": true}
		for rows.Next() {
			var raw []byte
			if err = rows.Scan(&raw); err != nil {
				break
			}
			var card lifefeed.Card
			if err = json.Unmarshal(raw, &card); err != nil {
				logger.Warn("invalid published life card", "error", err)
				err = nil
				continue
			}
			if topics[card.Topic] || ids[card.ID] {
				continue
			}
			card, err = lifefeed.PreparePublishedCard(card, current)
			if err != nil {
				logger.Warn("skip invalid published life card", "error", err)
				err = nil
				continue
			}
			if card.Topic == "weather" && card.Lesson.Source.LicenseStatus != "commercial" {
				continue
			}
			ids[card.ID] = true
			topics[card.Topic] = true
			cards = append(cards, card)
			if len(cards) >= len(lifefeed.Topics) {
				break
			}
		}
		if err == nil {
			err = rows.Err()
		}
		if err != nil {
			logger.Error("read life feed", "error", err)
			writeJSONError(w, "life feed unavailable", http.StatusInternalServerError)
			return
		}
		rows.Close()
		if len(cards) == 1 {
			w.Header().Set("Cache-Control", "no-store")
			writeJSONError(w, "life feed has no reviewed content", http.StatusNotFound)
			return
		}
		if !topics["weather"] && weather.Enabled() {
			forecast, forecastErr := weather.Forecast(r.Context(), city, current)
			if forecastErr != nil {
				logger.Warn("MET Norway weather unavailable", "city", city, "error", forecastErr)
			} else {
				cards = append(cards[:1], append([]lifefeed.Card{forecast}, cards[1:]...)...)
			}
		}
		seconds := int(lifefeed.EndOfDay(current).Sub(current) / time.Second)
		for _, card := range cards {
			remaining := int(card.Lesson.Source.ExpiresAt.Sub(current) / time.Second)
			if remaining < seconds {
				seconds = remaining
			}
		}
		if seconds > 60 {
			seconds = 60
		}
		if seconds < 1 {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", seconds))
		}
		writeJSON(w, http.StatusOK, lifefeed.Feed{SchemaVersion: 1, GeneratedAt: current, CityID: city, Cards: cards})
	}
}

type lifeEditorInput struct {
	CityID     string        `json:"cityId"`
	ValidFrom  string        `json:"validFrom"`
	ValidUntil string        `json:"validUntil"`
	Card       lifefeed.Card `json:"card"`
}

func (in lifeEditorInput) validate() (time.Time, time.Time, error) {
	if in.CityID != "" && !lifefeed.Cities[in.CityID] {
		return time.Time{}, time.Time{}, errors.New("invalid city")
	}
	from, err := time.ParseInLocation("2006-01-02", in.ValidFrom, lifefeed.JST)
	if err != nil || from.Format("2006-01-02") != in.ValidFrom {
		return time.Time{}, time.Time{}, errors.New("invalid validFrom")
	}
	until, err := time.ParseInLocation("2006-01-02", in.ValidUntil, lifefeed.JST)
	if err != nil || until.Format("2006-01-02") != in.ValidUntil || until.Before(from) {
		return time.Time{}, time.Time{}, errors.New("invalid validUntil")
	}
	if err = lifefeed.ValidateCard(in.Card); err != nil {
		return time.Time{}, time.Time{}, err
	}
	if in.Card.Lesson.Source.ObservedAt.After(in.Card.Lesson.Source.FetchedAt) || in.Card.Lesson.Source.FetchedAt.After(time.Now().Add(time.Minute)) {
		return time.Time{}, time.Time{}, errors.New("invalid source observation time")
	}
	return from, until, nil
}
func decodeLifeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(target); err != nil {
		return err
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return errors.New("request must contain a single JSON object")
	}
	return nil
}
func lifeCityArg(city string) any {
	if city == "" {
		return nil
	}
	return city
}
func lifeURLArg(sourceURL string) any {
	if sourceURL == "" {
		return nil
	}
	return sourceURL
}

func lifeAdminListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id::text,card_key,topic,city_id,valid_from::text,valid_until::text,status,rights_status,reviewer_id::text,source_url,card FROM daily.life_lesson ORDER BY updated_at DESC LIMIT 100`)
		if err != nil {
			logger.Error("admin life list", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, key, topic, from, until, status, rights string
			var city, reviewer, url *string
			var card json.RawMessage
			if err = rows.Scan(&id, &key, &topic, &city, &from, &until, &status, &rights, &reviewer, &url, &card); err != nil {
				break
			}
			items = append(items, map[string]any{"id": id, "cardKey": key, "topic": topic, "cityId": city, "validFrom": from, "validUntil": until, "status": status, "rightsStatus": rights, "reviewerId": reviewer, "sourceUrl": url, "card": card})
		}
		if err == nil {
			err = rows.Err()
		}
		if err != nil {
			logger.Error("admin life scan", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		writeJSON(w, 200, map[string]any{"items": items})
	}
}
func lifeAdminUpsertHandler(db *pgxpool.Pool, logger *slog.Logger, update bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in lifeEditorInput
		if err := decodeLifeJSON(w, r, &in); err != nil {
			writeJSONError(w, "invalid JSON", 400)
			return
		}
		from, until, err := in.validate()
		if err != nil {
			writeJSONError(w, err.Error(), 400)
			return
		}
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", 401)
			return
		}
		raw, err := json.Marshal(in.Card)
		if err != nil {
			writeJSONError(w, "invalid card", 400)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		defer tx.Rollback(r.Context())
		id := uuid.NewString()
		action := "life_lesson.created"
		var previous []byte
		if update {
			id = chi.URLParam(r, "id")
			if _, err = uuid.Parse(id); err != nil {
				writeJSONError(w, "invalid id", 400)
				return
			}
			err = tx.QueryRow(r.Context(), `SELECT card FROM daily.life_lesson WHERE id=$1 FOR UPDATE`, id).Scan(&previous)
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "not found", 404)
				return
			}
			if err == nil {
				_, err = tx.Exec(r.Context(), `UPDATE daily.life_lesson SET card_key=$2,topic=$3,city_id=$4,valid_from=$5,valid_until=$6,status='draft',rights_status='unknown',reviewer_id=NULL,published_at=NULL,source_url=$7,card=$8,source_expires_at=$9,updated_at=NOW() WHERE id=$1`, id, in.Card.ID, in.Card.Topic, lifeCityArg(in.CityID), from, until, lifeURLArg(in.Card.Lesson.Source.URL), raw, in.Card.Lesson.Source.ExpiresAt)
			}
			action = "life_lesson.updated"
		} else {
			err = tx.QueryRow(r.Context(), `INSERT INTO daily.life_lesson(card_key,topic,city_id,valid_from,valid_until,source_url,card,source_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`, in.Card.ID, in.Card.Topic, lifeCityArg(in.CityID), from, until, lifeURLArg(in.Card.Lesson.Source.URL), raw, in.Card.Lesson.Source.ExpiresAt).Scan(&id)
		}
		if err != nil {
			logger.Warn("write life draft failed", "error", err)
			writeJSONError(w, "cannot save life draft; check unique card ID", 409)
			return
		}
		if err = writeLifeAudit(r.Context(), tx, identity.ActorID, id, action, previous, raw); err != nil {
			logger.Error("audit life draft", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			logger.Error("commit life draft", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		code := 201
		if update {
			code = 200
		}
		writeJSON(w, code, map[string]any{"id": id, "status": "draft", "rightsStatus": "unknown"})
	}
}
func writeLifeAudit(ctx context.Context, tx pgx.Tx, actorID, id, action string, before, after []byte) error {
	_, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log(action,actor_id,target_type,target_id,reason,before,after,created_at) VALUES($1,$2,'life_lesson',$3,$4,$5,$6,NOW())`, action, actorID, id, action, before, after)
	return err
}

// Review is the authenticated editor's explicit legal and Japanese-reading attestation.
// Only a reviewed and cleared record can be published. Editing revokes approval.
func lifeAdminReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid id", 400)
			return
		}
		var in struct {
			RightsStatus string `json:"rightsStatus"`
			Reason       string `json:"reason"`
		}
		if err := decodeLifeJSON(w, r, &in); err != nil || (in.RightsStatus != "cleared" && in.RightsStatus != "blocked") || len(strings.TrimSpace(in.Reason)) < 10 {
			writeJSONError(w, "rightsStatus and documented review reason required", 400)
			return
		}
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", 401)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		defer tx.Rollback(r.Context())
		var raw []byte
		var status string
		err = tx.QueryRow(r.Context(), `SELECT card,status FROM daily.life_lesson WHERE id=$1 FOR UPDATE`, id).Scan(&raw, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "not found", 404)
			return
		}
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		if status == "published" {
			writeJSONError(w, "edit the draft before another review", 409)
			return
		}
		var card lifefeed.Card
		if err = json.Unmarshal(raw, &card); err != nil {
			writeJSONError(w, "invalid card", 422)
			return
		}
		if err = lifefeed.ValidateCard(card); err != nil {
			writeJSONError(w, err.Error(), 422)
			return
		}
		status = "draft"
		if in.RightsStatus == "cleared" {
			status = "reviewed"
		}
		_, err = tx.Exec(r.Context(), `UPDATE daily.life_lesson SET status=$2,rights_status=$3,reviewer_id=$4,updated_at=NOW() WHERE id=$1`, id, status, in.RightsStatus, identity.ActorID)
		if err == nil {
			_, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log(action,actor_id,target_type,target_id,reason,after,created_at) VALUES('life_lesson.reviewed',$1,'life_lesson',$2,$3,$4,NOW())`, identity.ActorID, id, in.Reason, []byte(fmt.Sprintf(`{"rightsStatus":%q,"status":%q}`, in.RightsStatus, status)))
		}
		if err != nil {
			logger.Error("review life card", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		writeJSON(w, 200, map[string]any{"id": id, "status": status, "rightsStatus": in.RightsStatus})
	}
}
func lifeAdminPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid id", 400)
			return
		}
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", 401)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		defer tx.Rollback(r.Context())
		var raw []byte
		var status, rights string
		var from, until time.Time
		err = tx.QueryRow(r.Context(), `SELECT card,status,rights_status,valid_from,valid_until FROM daily.life_lesson WHERE id=$1 FOR UPDATE`, id).Scan(&raw, &status, &rights, &from, &until)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "not found", 404)
			return
		}
		if err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		if status != "reviewed" || rights != "cleared" {
			writeJSONError(w, "lesson requires completed rights and reading review", 409)
			return
		}
		var card lifefeed.Card
		if err = json.Unmarshal(raw, &card); err != nil {
			writeJSONError(w, "invalid stored lesson", 422)
			return
		}
		if _, err = lifefeed.PreparePublishedCard(card, time.Now()); err != nil {
			writeJSONError(w, err.Error(), 422)
			return
		}
		if card.Topic == "weather" && card.Lesson.Source.LicenseStatus != "commercial" {
			writeJSONError(w, "weather source requires commercial reuse rights", 422)
			return
		}
		if until.Before(from) {
			writeJSONError(w, "invalid period", 422)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE daily.life_lesson SET status='published',published_at=NOW(),updated_at=NOW() WHERE id=$1`, id)
		if err == nil {
			err = writeLifeAudit(r.Context(), tx, identity.ActorID, id, "life_lesson.published", nil, raw)
		}
		if err != nil {
			logger.Error("publish life card", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			writeJSONError(w, "internal error", 500)
			return
		}
		writeJSON(w, 200, map[string]any{"id": id, "status": "published"})
	}
}
