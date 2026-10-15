package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

func levelReadRateLimit(limiter *authn.RateLimiter, endpoint string, logger *slog.Logger, trustedProxyCIDRs []*net.IPNet, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if limiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		key := fmt.Sprintf("ip:levels:%s:%s", endpoint, authn.NormalizeClientIP(r.RemoteAddr, r.Header.Get("X-Forwarded-For"), trustedProxyCIDRs))
		allowed, err := limiter.Allow(key)
		if err != nil || !allowed {
			if err != nil && logger != nil {
				logger.Warn("rate limit public level read", "endpoint", endpoint, "error", err)
			}
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type bjtLevel struct {
	Code, NameJa, NameVi, NameEn                string
	ScoreMin, ScoreMax                          int
	JLPTEquiv                                   string
	DescriptionVi, DescriptionJa, DescriptionEn string
	Color                                       string
}

var bjtLevels = []bjtLevel{
	{"J5", "J5 — 初級前半", "J5 — Sơ cấp", "J5 — Lower beginner", 0, 199, "N5", "Giao tiếp cơ bản: chào hỏi, tự giới thiệu, đọc biển hiệu đơn giản tại nơi làm việc.", "基本的な挨拶、自己紹介、職場の簡単な表示の読解。", "Handle basic greetings and self-introductions, and read simple workplace signs.", "#22C55E"},
	{"J4", "J4 — 初級後半", "J4 — Sơ trung cấp", "J4 — Upper beginner", 200, 319, "N4", "Hội thoại đơn giản, hiểu chỉ thị cơ bản, đọc email ngắn, điền form đơn giản.", "簡単な会話、基本的な指示の理解、短いメール読解、簡単なフォーム記入。", "Manage simple conversations and instructions, read short emails, and complete basic forms.", "#3B82F6"},
	{"J3", "J3 — 中級前半", "J3 — Trung cấp", "J3 — Lower intermediate", 320, 419, "N3", "Đọc email business, hiểu hội thoại văn phòng thông thường, viết báo cáo ngắn.", "ビジネスメール読解、一般的なオフィス会話の理解、短い報告書の作成。", "Read business emails, follow routine office conversations, and write short reports.", "#8B5CF6"},
	{"J2", "J2 — 中級後半", "J2 — Trung cao cấp", "J2 — Upper intermediate", 420, 529, "N2", "Xử lý tình huống business phức tạp, đọc báo cáo, tham gia họp bằng tiếng Nhật.", "複雑なビジネス状況の対応、報告書読解、日本語での会議参加。", "Handle complex business situations, read reports, and participate in meetings in Japanese.", "#F59E0B"},
	{"J1", "J1 — 上級前半", "J1 — Cao cấp", "J1 — Advanced", 530, 599, "N1", "Thương lượng, thuyết trình, viết báo cáo phức tạp, hiểu văn bản pháp lý cơ bản.", "交渉、プレゼンテーション、複雑な報告書作成、基本的な法律文書の理解。", "Negotiate, present, write complex reports, and understand basic legal documents.", "#EF4444"},
	{"J1+", "J1+ — 上級後半", "J1+ — Cao cấp+", "J1+ — Advanced plus", 600, 800, ">N1", "Lãnh đạo meeting, xử lý xung đột, viết tài liệu chính thức, hiểu sắc thái ngôn ngữ tinh tế.", "会議のリード、紛争処理、公式文書作成、微妙な言語ニュアンスの理解。", "Lead meetings, resolve conflict, write formal documents, and understand subtle language nuances.", "#DC2626"},
}

func levelFilters(code string) ([]string, int, bool) {
	for _, level := range bjtLevels {
		if level.Code != code {
			continue
		}
		if code == "J1+" {
			// Canonical master data currently tops out at JLPT N1 / kanji level 1.
			// Do not duplicate N1 rows into the BJT level above N1.
			return []string{}, 0, true
		}
		kanji := map[string]int{"J5": 5, "J4": 4, "J3": 3, "J2": 2, "J1": 1, "J1+": 1}[code]
		return []string{strings.TrimPrefix(level.JLPTEquiv, ">")}, kanji, true
	}
	return nil, 0, false
}

func levelDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "code")))
		_, _, ok := levelFilters(code)
		if !ok {
			writeJSONError(w, "level not found", http.StatusNotFound)
			return
		}
		vocabulary, kanjiCount, grammar, err := levelCounts(r.Context(), db, code)
		if err != nil {
			logger.Error("get BJT level counts", "code", code, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for _, level := range bjtLevels {
			if level.Code == code {
				writeJSON(w, http.StatusOK, map[string]any{
					"code": level.Code, "nameJa": level.NameJa, "nameVi": level.NameVi, "nameEn": level.NameEn,
					"scoreMin": level.ScoreMin, "scoreMax": level.ScoreMax, "jlptEquiv": level.JLPTEquiv,
					"descriptionVi": level.DescriptionVi, "descriptionJa": level.DescriptionJa, "descriptionEn": level.DescriptionEn, "color": level.Color,
					"vocabCount": vocabulary, "kanjiCount": kanjiCount, "grammarCount": grammar,
				})
				return
			}
		}
	}
}

func levelCounts(ctx context.Context, db *pgxpool.Pool, code string) (int, int, int, error) {
	jlpt, kanji, ok := levelFilters(code)
	if !ok {
		return 0, 0, 0, nil
	}
	var vocabulary, kanjiCount, grammar int
	err := db.QueryRow(ctx, `SELECT
			(SELECT count(*) FROM content.lexeme WHERE status='active' AND string_to_array(jlpt_level, ',') && $1::text[]),
			(SELECT count(*) FROM content.kanji WHERE status='active' AND level=$2),
		(SELECT count(*) FROM content.grammar_point WHERE status='active' AND string_to_array(jlpt_level, ',') && $1::text[])`, jlpt, kanji).Scan(&vocabulary, &kanjiCount, &grammar)
	return vocabulary, kanjiCount, grammar, err
}

func levelListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		levels := make([]map[string]any, 0, len(bjtLevels))
		for _, level := range bjtLevels {
			vocabulary, kanji, grammar, err := levelCounts(r.Context(), db, level.Code)
			if err != nil {
				logger.Error("list BJT levels", "code", level.Code, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			levels = append(levels, map[string]any{
				"code": level.Code, "nameJa": level.NameJa, "nameVi": level.NameVi, "nameEn": level.NameEn,
				"scoreMin": level.ScoreMin, "scoreMax": level.ScoreMax, "jlptEquiv": level.JLPTEquiv,
				"descriptionVi": level.DescriptionVi, "descriptionJa": level.DescriptionJa, "descriptionEn": level.DescriptionEn, "color": level.Color,
				"vocabCount": vocabulary, "kanjiCount": kanji, "grammarCount": grammar,
			})
		}
		writeJSON(w, http.StatusOK, levels)
	}
}

func levelLessonsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "code")))
		if _, _, ok := levelFilters(code); !ok {
			writeJSONError(w, "level not found", http.StatusNotFound)
			return
		}
		var userID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = &identity.UserID
		}
		rows, err := db.Query(r.Context(), `SELECT l.id::text,l.slug,l.sort_order,l.title_vi,l.title_ja,l.description_vi,l.description_ja,
			l.week_number,l.unit_type,l.unit_order,l.estimated_duration_min,
			jsonb_array_length(CASE WHEN jsonb_typeof(l.lesson_content->'activities')='array' THEN l.lesson_content->'activities' ELSE '[]'::jsonb END),
			count(lx.id) FILTER (WHERE i.content_type='vocabulary'),count(kx.id) FILTER (WHERE i.content_type='kanji'),
			count(gx.id) FILTER (WHERE i.content_type='grammar'),
			COALESCE($2::uuid IS NOT NULL AND bool_or(p.lesson_id IS NOT NULL),false)
			FROM curriculum.bjt_lesson l LEFT JOIN curriculum.bjt_lesson_item i ON i.lesson_id=l.id
			LEFT JOIN content.lexeme lx ON i.content_type='vocabulary' AND lx.id=i.content_id AND lx.status='active'
			LEFT JOIN content.kanji kx ON i.content_type='kanji' AND kx.id=i.content_id AND kx.status='active'
			LEFT JOIN content.grammar_point gx ON i.content_type='grammar' AND gx.id=i.content_id AND gx.status='active'
			LEFT JOIN curriculum.bjt_lesson_progress p ON p.lesson_id=l.id AND p.user_id=$2::uuid
			WHERE l.level_code=$1 AND l.status IN ('active','published') AND (l.published_at IS NULL OR l.published_at<=now())
			GROUP BY l.id ORDER BY l.sort_order,l.week_number,l.unit_order`, code, userID)
		if err != nil {
			logger.Error("list BJT level lessons", "code", code, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		lessons := make([]map[string]any, 0)
		for rows.Next() {
			var id, slug, titleVi, titleJa, unitType string
			var descriptionVi, descriptionJa *string
			var sortOrder, weekNumber, unitOrder, duration, activities, vocab, kanji, grammar int
			var completed bool
			if err := rows.Scan(&id, &slug, &sortOrder, &titleVi, &titleJa, &descriptionVi, &descriptionJa, &weekNumber, &unitType, &unitOrder, &duration, &activities, &vocab, &kanji, &grammar, &completed); err != nil {
				logger.Error("scan BJT lesson summary", "code", code, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			lessons = append(lessons, map[string]any{"id": id, "slug": slug, "sortOrder": sortOrder, "titleVi": titleVi, "titleJa": titleJa,
				"descriptionVi": descriptionVi, "descriptionJa": descriptionJa, "weekNumber": weekNumber, "unitType": unitType, "unitOrder": unitOrder,
				"estimatedDurationMin": duration, "activityCount": activities, "vocabCount": vocab, "kanjiCount": kanji, "grammarCount": grammar, "isCompleted": completed})
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate BJT lesson summaries", "code", code, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, lessons)
	}
}

func levelReferenceHandler(db *pgxpool.Pool, logger *slog.Logger, kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := strings.ToUpper(strings.TrimSpace(chi.URLParam(r, "code")))
		jlpt, kanjiLevel, ok := levelFilters(code)
		if !ok {
			writeJSONError(w, "level not found", http.StatusNotFound)
			return
		}
		limit, offset, valid := levelPage(r)
		if !valid {
			writeJSONError(w, "invalid pagination", http.StatusBadRequest)
			return
		}
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		var sql string
		switch kind {
		case "vocabulary":
			sql = `SELECT jsonb_build_object('id',l.id,'headword',l.headword,'reading',l.reading,'shortMeaningVi',l.short_meaning_vi,'jlptLevel',l.jlpt_level,
					'senses',COALESCE((SELECT jsonb_agg(jsonb_build_object('meaningVi',s.meaning_vi,'pos',s.part_of_speech) ORDER BY s.position) FROM (SELECT * FROM content.lexeme_sense WHERE lexeme_id=l.id ORDER BY position LIMIT 3) s),'[]'::jsonb))
				FROM content.lexeme l WHERE l.status='active' AND string_to_array(l.jlpt_level, ',') && $1::text[]
				AND ($2='' OR l.headword ILIKE '%'||$2||'%' OR l.reading ILIKE '%'||$2||'%' OR l.short_meaning_vi ILIKE '%'||$2||'%') ORDER BY l.headword,l.id LIMIT $3 OFFSET $4`
		case "kanji":
			sql = `SELECT jsonb_build_object('id',k.id,'character',k.character,'meaningVi',k.meaning_vi,'onyomi',k.onyomi,'kunyomi',k.kunyomi,'level',k.level,
					'components',COALESCE((SELECT jsonb_agg(jsonb_build_object('component',c.character,'meaningVi',c.han_viet) ORDER BY c.position) FROM (SELECT * FROM content.kanji_component WHERE kanji_id=k.id ORDER BY position LIMIT 4) c),'[]'::jsonb),
					'examples',COALESCE((SELECT jsonb_agg(jsonb_build_object('word',e.word,'reading',e.reading,'meaningVi',e.meaning_vi) ORDER BY e.position) FROM (SELECT * FROM content.kanji_example WHERE kanji_id=k.id ORDER BY position LIMIT 4) e),'[]'::jsonb))
				FROM content.kanji k WHERE k.status='active' AND k.level=$1
				AND ($2='' OR k.character=$2 OR k.meaning_vi ILIKE '%'||$2||'%' OR k.onyomi ILIKE '%'||$2||'%' OR k.kunyomi ILIKE '%'||$2||'%') ORDER BY k.frequency NULLS LAST,k.character LIMIT $3 OFFSET $4`
		case "grammar":
			sql = `SELECT jsonb_build_object('id',g.id,'pattern',g.pattern,'meaningVi',g.meaning_vi,'jlptLevel',g.jlpt_level,
					'details',COALESCE((SELECT jsonb_agg(jsonb_build_object('explanationVi',d.explanation) ORDER BY d.position) FROM (SELECT * FROM content.grammar_point_detail WHERE grammar_point_id=g.id ORDER BY position LIMIT 2) d),'[]'::jsonb))
				FROM content.grammar_point g WHERE g.status='active' AND string_to_array(g.jlpt_level, ',') && $1::text[]
			AND ($2='' OR regexp_replace(g.pattern, '[[:space:]]+', ' ', 'g') ILIKE '%'||regexp_replace($2, '[[:space:]]+', ' ', 'g')||'%' OR g.meaning_vi ILIKE '%'||$2||'%') ORDER BY g.pattern,g.id LIMIT $3 OFFSET $4`
		default:
			writeJSONError(w, "not found", http.StatusNotFound)
			return
		}
		filter := any(jlpt)
		if kind == "kanji" {
			filter = kanjiLevel
		}
		rows, err := db.Query(r.Context(), sql, filter, q, limit, offset)
		if err != nil {
			logger.Error("list BJT level reference", "code", code, "kind", kind, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := make([]json.RawMessage, 0)
		for rows.Next() {
			var item json.RawMessage
			if err := rows.Scan(&item); err != nil {
				logger.Error("scan BJT level reference", "kind", kind, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate BJT level reference", "kind", kind, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func levelPage(r *http.Request) (int, int, bool) {
	limit, offset := 30, 0
	for key, target := range map[string]*int{"limit": &limit, "offset": &offset} {
		value := r.URL.Query().Get(key)
		if value == "" {
			continue
		}
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 || (key == "limit" && parsed > 50) {
			return 0, 0, false
		}
		*target = parsed
	}
	if limit == 0 {
		return 0, 0, false
	}
	return limit, offset, true
}
