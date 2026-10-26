package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestLevelLessonsCountEmbeddedContent(t *testing.T) {
	db := testPool(t)
	id := newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson
 (id,level_code,sort_order,slug,title_vi,title_ja,lesson_content,status,updated_at)
 VALUES ($1,'J5',1900000001,$2,'Embedded lesson','挨拶',
 '{"schemaVersion":"1","vocabulary":[{},{}],"grammar":[{}],"activities":[{}]}'::jsonb,'published',now())`, id, id)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id=$1`, id); err != nil {
			t.Error(err)
		}
	})
	r := chi.NewRouter()
	r.Get("/api/levels/{code}/lessons", levelLessonsHandler(db, testLogger()))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels/J5/lessons", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("list lessons: %d %s", rr.Code, rr.Body.String())
	}
	var lessons []struct {
		ID                                                  string
		VocabCount, GrammarCount, KanjiCount, ActivityCount int
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &lessons); err != nil {
		t.Fatal(err)
	}
	for _, lesson := range lessons {
		if lesson.ID == id {
			if lesson.VocabCount != 2 || lesson.GrammarCount != 1 || lesson.KanjiCount != 0 || lesson.ActivityCount != 1 {
				t.Fatalf("embedded lesson counts must match displayed content: %+v", lesson)
			}
			return
		}
	}
	t.Fatal("embedded lesson missing")
}

func TestLevelListIncludesPublicLessonAvailability(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	var existing int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM curriculum.bjt_lesson WHERE level_code='J1+' AND status IN ('active','published') AND (published_at IS NULL OR published_at<=now())`).Scan(&existing); err != nil {
		t.Fatal(err)
	}
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	t.Cleanup(func() {
		for _, id := range ids {
			if _, err := db.Exec(ctx, `DELETE FROM curriculum.bjt_lesson WHERE id=$1`, id); err != nil {
				t.Error(err)
			}
		}
	})
	for i, status := range []string{"published", "active", "draft", "published"} {
		_, err := db.Exec(ctx, `INSERT INTO curriculum.bjt_lesson (id,level_code,sort_order,slug,title_vi,title_ja,status,published_at,updated_at)
   VALUES ($1,'J1+',$2,$3,'Availability','公開状態',$4,CASE WHEN $5 THEN now()+interval '1 day' ELSE NULL END,now())`, ids[i], 1900000011+i, ids[i], status, i == 3)
		if err != nil {
			t.Fatal(err)
		}
	}
	rr := httptest.NewRecorder()
	levelListHandler(db, testLogger()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("list levels: %d %s", rr.Code, rr.Body.String())
	}
	var levels []struct {
		Code                                 string
		VocabCount, KanjiCount, GrammarCount int
		PublishedLessonCount                 *int
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &levels); err != nil {
		t.Fatal(err)
	}
	for _, level := range levels {
		if level.Code == "J1+" {
			if level.PublishedLessonCount == nil || *level.PublishedLessonCount != existing+2 || level.VocabCount+level.KanjiCount+level.GrammarCount != 0 {
				t.Fatalf("public lesson availability must include active/published lessons but exclude draft/future lessons: %+v", level)
			}
			return
		}
	}
	t.Fatal("J1+ level missing")
}
