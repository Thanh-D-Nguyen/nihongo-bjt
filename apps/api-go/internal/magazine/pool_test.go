package magazine

import (
	"testing"
	"time"
)

func mustDate(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func TestEmbeddedPoolsAreWellFormed(t *testing.T) {
	pools, err := LoadPools()
	if err != nil {
		t.Fatalf("LoadPools: %v", err)
	}
	// Every pool, scheduled or not: unscheduled pools are validated now so
	// they are safe to schedule later.
	for kind, pool := range pools {
		if len(pool) == 0 {
			t.Fatalf("%s: empty pool", kind)
		}
		seen := map[string]bool{}
		titles := map[string]bool{}
		for _, e := range pool {
			if e.Key == "" || seen[e.Key] {
				t.Fatalf("%s: missing or duplicate key %q", kind, e.Key)
			}
			seen[e.Key] = true
			if e.TitleJp == "" || e.TitleVi == "" {
				t.Fatalf("%s/%s: missing title", kind, e.Key)
			}
			// The title is the fallback identity for rows written before pool
			// keys existed, so it must be unique within a pool.
			if titles[e.TitleVi] {
				t.Fatalf("%s/%s: duplicate titleVi %q", kind, e.Key, e.TitleVi)
			}
			titles[e.TitleVi] = true
			if len(e.ContentJSON) == 0 {
				t.Fatalf("%s/%s: missing contentJson", kind, e.Key)
			}
			for i, v := range e.VocabItems {
				if v.WordJp == "" || v.Reading == "" || v.MeaningVi == "" {
					t.Fatalf("%s/%s: vocab item %d has blank word/reading/meaning", kind, e.Key, i)
				}
			}
			for _, q := range e.Quizzes {
				if q.QuestionJp == "" || q.QuestionVi == "" || q.ExplanationJp == "" || q.ExplanationVi == "" {
					t.Fatalf("%s/%s: quiz %q has a blank question or explanation", kind, e.Key, q.QuestionJp)
				}
				found := false
				for _, o := range q.Options {
					if o == q.CorrectAnswer {
						found = true
					}
				}
				if !found {
					t.Fatalf("%s/%s: quiz answer %q not in options", kind, e.Key, q.CorrectAnswer)
				}
			}
		}
	}
}

func TestShouldGenerateFollowsSchedule(t *testing.T) {
	cases := []struct {
		kind string
		date string
		want bool
	}{
		{KindVocab, "2026-11-02", true},      // Monday
		{KindVocab, "2026-11-08", true},      // Sunday
		{KindBJTPhrase, "2026-11-02", true},  // Monday
		{KindBJTPhrase, "2026-11-07", false}, // Saturday
		{KindBJTPhrase, "2026-11-08", false}, // Sunday
	}
	for _, c := range cases {
		if got := ShouldGenerate(c.kind, mustDate(t, c.date)); got != c.want {
			t.Errorf("ShouldGenerate(%s,%s)=%v want %v", c.kind, c.date, got, c.want)
		}
	}
}

func TestWeatherIsNotScheduledWithoutSeasonalPool(t *testing.T) {
	for _, kind := range ScheduledKinds {
		if kind == KindWeather {
			t.Fatal("weather must stay unscheduled until a seasonal pool exists")
		}
	}
}
