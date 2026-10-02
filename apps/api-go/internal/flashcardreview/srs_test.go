package flashcardreview

import "testing"

// Characterization tests for the SM-2 style scheduler (existing behavior,
// written during the final quality review — not TDD). They pin the current
// contract so scheduling changes are deliberate and reviewed.
func TestComputeSRSNext(t *testing.T) {
	type out struct {
		state    string
		ease     float64
		interval int
		reps     int
		lapses   int
	}
	cases := []struct {
		name                 string
		state                string
		ease                 float64
		interval, reps, laps int
		rating               string
		want                 out
	}{
		{"again resets to learning, counts a lapse, lowers ease", "review", 2.5, 10, 5, 1, "again", out{"learning", 2.3, 0, 0, 2}},
		{"again never drops ease below 1.3", "review", 1.4, 3, 2, 0, "again", out{"learning", 1.3, 0, 0, 1}},
		{"hard grows interval by 1.2x", "review", 2.5, 10, 4, 0, "hard", out{"review", 2.35, 12, 5, 0}},
		{"hard on a new card schedules at least 1 day", "new", 2.5, 0, 0, 0, "hard", out{"new", 2.35, 1, 1, 0}},
		{"hard ease floor 1.3", "learning", 1.35, 2, 1, 0, "hard", out{"learning", 1.3, 2, 2, 0}},
		{"good on a new card is 1 day", "new", 2.5, 0, 0, 0, "good", out{"new", 2.5, 1, 1, 0}},
		{"good multiplies interval by ease (truncated)", "learning", 2.5, 3, 1, 0, "good", out{"learning", 2.5, 7, 2, 0}},
		{"third successful rep graduates to review", "learning", 2.5, 1, 2, 0, "good", out{"review", 2.5, 2, 3, 0}},
		{"easy on a new card is 4 days and graduates", "new", 2.5, 0, 0, 0, "easy", out{"review", 2.65, 4, 1, 0}},
		{"easy multiplies interval by ease*1.3", "review", 2.0, 10, 6, 1, "easy", out{"review", 2.15, 26, 7, 1}},
		{"unknown rating leaves the card unchanged", "review", 2.5, 10, 5, 1, "bogus", out{"review", 2.5, 10, 5, 1}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			state, ease, interval, reps, lapses := computeSRSNext(tc.state, tc.ease, tc.interval, tc.reps, tc.laps, tc.rating)
			got := out{state, ease, interval, reps, lapses}
			if got.state != tc.want.state || got.interval != tc.want.interval || got.reps != tc.want.reps ||
				got.lapses != tc.want.lapses || diff(got.ease, tc.want.ease) > 1e-9 {
				t.Fatalf("computeSRSNext(%q, %.2f, %d, %d, %d, %q) = %+v, want %+v",
					tc.state, tc.ease, tc.interval, tc.reps, tc.laps, tc.rating, got, tc.want)
			}
		})
	}
}

func diff(a, b float64) float64 {
	if a > b {
		return a - b
	}
	return b - a
}
