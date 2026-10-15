package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type lessonDetailResponse struct {
	ID                   string          `json:"id"`
	Slug                 string          `json:"slug"`
	LevelCode            string          `json:"levelCode"`
	SortOrder            int             `json:"sortOrder"`
	TitleVi              string          `json:"titleVi"`
	TitleJa              string          `json:"titleJa"`
	DescriptionVi        *string         `json:"descriptionVi"`
	DescriptionJa        *string         `json:"descriptionJa"`
	WeekNumber           int             `json:"weekNumber"`
	UnitType             string          `json:"unitType"`
	UnitOrder            int             `json:"unitOrder"`
	EstimatedDurationMin int             `json:"estimatedDurationMin"`
	Difficulty           string          `json:"difficulty"`
	SkillTags            []string        `json:"skillTags"`
	BusinessTopics       []string        `json:"businessTopics"`
	ContentVersion       string          `json:"contentVersion"`
	LessonContent        json.RawMessage `json:"lessonContent"`
	PrevLesson           *lessonNav      `json:"prevLesson"`
	NextLesson           *lessonNav      `json:"nextLesson"`
	Contents             []lessonContent `json:"contents"`
	IsCompleted          bool            `json:"isCompleted"`
	CanSaveProgress      bool            `json:"canSaveProgress"`
}

type lessonNav struct {
	Slug      string `json:"slug"`
	TitleVi   string `json:"titleVi"`
	SortOrder int    `json:"sortOrder"`
}

type lessonContent struct {
	SortOrder   int             `json:"sortOrder"`
	ContentType string          `json:"contentType"`
	Content     json.RawMessage `json:"content"`
}

func getLessonDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := strings.TrimSpace(chi.URLParam(r, "slug"))
		if slug == "" || len(slug) > 80 {
			writeJSONError(w, "lesson not found", http.StatusNotFound)
			return
		}

		var userID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = &identity.UserID
		}
		var lesson lessonDetailResponse
		var previous, next []byte
		err := db.QueryRow(r.Context(), `
			SELECT l.id::text, l.slug, l.level_code, l.sort_order, l.title_vi, l.title_ja,
				l.description_vi, l.description_ja, l.week_number, l.unit_type, l.unit_order,
				l.estimated_duration_min, l.difficulty, l.skill_tags, l.business_topics,
				l.content_version, l.lesson_content,
				(SELECT jsonb_build_object('slug', p.slug, 'titleVi', p.title_vi, 'sortOrder', p.sort_order)
				 FROM curriculum.bjt_lesson p WHERE p.level_code=l.level_code AND p.sort_order<l.sort_order
				   AND p.status IN ('active','published') AND (p.published_at IS NULL OR p.published_at<=now())
				 ORDER BY p.sort_order DESC LIMIT 1),
				(SELECT jsonb_build_object('slug', n.slug, 'titleVi', n.title_vi, 'sortOrder', n.sort_order)
				 FROM curriculum.bjt_lesson n WHERE n.level_code=l.level_code AND n.sort_order>l.sort_order
				   AND n.status IN ('active','published') AND (n.published_at IS NULL OR n.published_at<=now())
				 ORDER BY n.sort_order ASC LIMIT 1),
				COALESCE($2::uuid IS NOT NULL AND EXISTS (
					SELECT 1 FROM curriculum.bjt_lesson_progress lp WHERE lp.user_id=$2::uuid AND lp.lesson_id=l.id
				), false)
			FROM curriculum.bjt_lesson l
			WHERE l.slug=$1 AND l.status IN ('active','published')
			  AND (l.published_at IS NULL OR l.published_at<=now())`, slug, userID).Scan(
			&lesson.ID, &lesson.Slug, &lesson.LevelCode, &lesson.SortOrder, &lesson.TitleVi, &lesson.TitleJa,
			&lesson.DescriptionVi, &lesson.DescriptionJa, &lesson.WeekNumber, &lesson.UnitType, &lesson.UnitOrder,
			&lesson.EstimatedDurationMin, &lesson.Difficulty, &lesson.SkillTags, &lesson.BusinessTopics,
			&lesson.ContentVersion, &lesson.LessonContent, &previous, &next, &lesson.IsCompleted)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "lesson not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get lesson detail", "slug", slug, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		lesson.CanSaveProgress = userID != nil
		if len(previous) > 0 && string(previous) != "null" {
			var nav lessonNav
			if err := json.Unmarshal(previous, &nav); err == nil {
				lesson.PrevLesson = &nav
			}
		}
		if len(next) > 0 && string(next) != "null" {
			var nav lessonNav
			if err := json.Unmarshal(next, &nav); err == nil {
				lesson.NextLesson = &nav
			}
		}
		lesson.Contents, err = queryLessonContents(r, db, lesson.ID)
		if err != nil {
			logger.Error("query lesson content", "slug", slug, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, lesson)
	}
}

func queryLessonContents(r *http.Request, db *pgxpool.Pool, lessonID string) ([]lessonContent, error) {
	rows, err := db.Query(r.Context(), `
		SELECT i.sort_order, i.content_type,
			CASE i.content_type
			WHEN 'vocabulary' THEN (SELECT jsonb_build_object(
				'id', x.id::text, 'headword', x.headword, 'reading', x.reading,
				'shortMeaningVi', x.short_meaning_vi,
				'senses', COALESCE((SELECT jsonb_agg(jsonb_build_object('meaningVi', s.meaning_vi, 'pos', s.part_of_speech) ORDER BY s.position)
					FROM content.lexeme_sense s WHERE s.lexeme_id=x.id), '[]'::jsonb))
				FROM content.lexeme x WHERE x.id=i.content_id AND x.status='active')
			WHEN 'kanji' THEN (SELECT jsonb_build_object(
				'id', x.id::text, 'character', x.character, 'meaningVi', x.meaning_vi,
				'onyomi', x.onyomi, 'kunyomi', x.kunyomi,
				'components', COALESCE((SELECT jsonb_agg(jsonb_build_object('component', c.character, 'meaningVi', c.han_viet) ORDER BY c.position)
					FROM content.kanji_component c WHERE c.kanji_id=x.id), '[]'::jsonb),
				'examples', COALESCE((SELECT jsonb_agg(jsonb_build_object('word', e.word, 'reading', e.reading, 'meaningVi', e.meaning_vi) ORDER BY e.position)
					FROM content.kanji_example e WHERE e.kanji_id=x.id), '[]'::jsonb))
				FROM content.kanji x WHERE x.id=i.content_id AND x.status='active')
			WHEN 'grammar' THEN (SELECT jsonb_build_object(
				'id', x.id::text, 'pattern', x.pattern, 'meaningVi', x.meaning_vi,
				'details', COALESCE((SELECT jsonb_agg(jsonb_build_object('explanationVi', d.explanation) ORDER BY d.position)
					FROM content.grammar_point_detail d WHERE d.grammar_point_id=x.id), '[]'::jsonb))
				FROM content.grammar_point x WHERE x.id=i.content_id AND x.status='active')
			ELSE NULL END AS content
		FROM curriculum.bjt_lesson_item i
		WHERE i.lesson_id=$1 AND i.content_type IN ('vocabulary','kanji','grammar')
		ORDER BY i.sort_order`, lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	contents := make([]lessonContent, 0)
	for rows.Next() {
		var item lessonContent
		if err := rows.Scan(&item.SortOrder, &item.ContentType, &item.Content); err != nil {
			return nil, err
		}
		if len(item.Content) == 0 || string(item.Content) == "null" {
			continue
		}
		contents = append(contents, item)
	}
	return contents, rows.Err()
}

func updateLessonProgressHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var request struct {
			Completed *bool `json:"completed"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&request); err != nil || request.Completed == nil {
			writeJSONError(w, "completed must be a boolean", http.StatusBadRequest)
			return
		}
		slug := chi.URLParam(r, "slug")
		if *request.Completed {
			tag, err := db.Exec(r.Context(), `
				INSERT INTO curriculum.bjt_lesson_progress (user_id, lesson_id)
				SELECT $1, l.id FROM curriculum.bjt_lesson l
				WHERE l.slug=$2 AND l.status IN ('active','published')
				  AND (l.published_at IS NULL OR l.published_at<=now())
				ON CONFLICT (user_id, lesson_id) DO NOTHING`, identity.UserID, slug)
			if err != nil {
				logger.Error("complete lesson", "user_id", identity.UserID, "slug", slug, "error", err)
				writeJSONError(w, "unable to save lesson progress", http.StatusInternalServerError)
				return
			}
			if tag.RowsAffected() == 0 {
				var exists bool
				if err := db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM curriculum.bjt_lesson_progress lp JOIN curriculum.bjt_lesson l ON l.id=lp.lesson_id WHERE lp.user_id=$1 AND l.slug=$2 AND l.status IN ('active','published') AND (l.published_at IS NULL OR l.published_at<=now()))`, identity.UserID, slug).Scan(&exists); err != nil || !exists {
					writeJSONError(w, "lesson not found", http.StatusNotFound)
					return
				}
			}
		} else {
			var exists bool
			err := db.QueryRow(r.Context(), `WITH lesson AS (
				SELECT id FROM curriculum.bjt_lesson
				WHERE slug=$2 AND status IN ('active','published')
				  AND (published_at IS NULL OR published_at<=now())
			), deleted AS (
				DELETE FROM curriculum.bjt_lesson_progress lp USING lesson
				WHERE lp.lesson_id=lesson.id AND lp.user_id=$1 RETURNING lp.lesson_id
			)
			SELECT EXISTS (SELECT 1 FROM lesson)`, identity.UserID, slug).Scan(&exists)
			if err != nil {
				logger.Error("uncomplete lesson", "user_id", identity.UserID, "slug", slug, "error", err)
				writeJSONError(w, "unable to save lesson progress", http.StatusInternalServerError)
				return
			}
			if !exists {
				writeJSONError(w, "lesson not found", http.StatusNotFound)
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]bool{"isCompleted": *request.Completed})
	}
}
