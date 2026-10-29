package loto

import (
	"fmt"
	"math/rand"
	"reflect"
	"sort"
	"testing"
)

func syntheticDraws(t *testing.T, game Game, count int) []Draw {
	t.Helper()
	spec := SpecFor(game)
	rng := rand.New(rand.NewSource(42))
	base, err := ParseDateKey("2024-01-01")
	if err != nil {
		t.Fatal(err)
	}
	draws := make([]Draw, 0, count)
	for i := 0; i < count; i++ {
		perm := rng.Perm(spec.MaxNumber)
		numbers := make([]int, 0, spec.MainCount+spec.BonusCount)
		for _, v := range perm[:spec.MainCount+spec.BonusCount] {
			numbers = append(numbers, v+1)
		}
		draw := Draw{
			Game: game, Number: i + 1, DateKey: base.AddDate(0, 0, i*3).Format(dateLayout),
			Main: numbers[:spec.MainCount], Bonus: numbers[spec.MainCount:],
		}
		if err := ValidateDraw(&draw); err != nil {
			t.Fatalf("synthetic draw invalid: %v", err)
		}
		draws = append(draws, draw)
	}
	return draws
}

func TestGenerateIsDeterministicPerSeedAndProducesValidUniqueSets(t *testing.T) {
	for _, game := range Games() {
		spec := SpecFor(game)
		draws := syntheticDraws(t, game, 80)
		in := GenerateInput{Game: game, TargetDateKey: "2026-11-02", SetCount: 3, Seed: "alpha"}
		first, err := Generate(in, draws)
		if err != nil {
			t.Fatalf("%s generate: %v", game, err)
		}
		second, err := Generate(in, draws)
		if err != nil || !reflect.DeepEqual(first, second) {
			t.Fatalf("%s: same seed must reproduce the same sets (err=%v)", game, err)
		}
		in.Seed = "beta"
		other, err := Generate(in, draws)
		if err != nil || reflect.DeepEqual(first, other) {
			t.Fatalf("%s: a different seed should change the sets (err=%v)", game, err)
		}
		if len(first) != 3 {
			t.Fatalf("%s: got %d sets, want 3", game, len(first))
		}
		seen := map[string]bool{}
		for _, set := range first {
			if len(set.Main) != spec.MainCount || !sort.IntsAreSorted(set.Main) || len(set.Bonus) != 0 {
				t.Fatalf("%s: malformed set %+v", game, set)
			}
			for _, n := range set.Main {
				if n < 1 || n > spec.MaxNumber {
					t.Fatalf("%s: number %d out of range", game, n)
				}
			}
			key := fmt.Sprint(set.Main)
			if seen[key] {
				t.Fatalf("%s: duplicate set %s", game, key)
			}
			seen[key] = true
			if set.Score < 0 || set.Score > 1 {
				t.Fatalf("%s: score %v outside 0..1", game, set.Score)
			}
			shape := set.Explanation["shape"].(map[string]any)
			if shape["odd"].(int) == 0 || shape["odd"].(int) == spec.MainCount {
				t.Fatalf("%s: set %v violates the odd/even shape filter", game, set.Main)
			}
			if set.Explanation["mode"] != "historical_heuristic" {
				t.Fatalf("%s: mode = %v", game, set.Explanation["mode"])
			}
		}
		for i := 1; i < len(first); i++ {
			if first[i-1].Score < first[i].Score {
				t.Fatalf("%s: sets must be ranked by descending score", game)
			}
		}
	}
}

func TestGenerateHonoursPinnedAndExcludedNumbers(t *testing.T) {
	draws := syntheticDraws(t, Loto6, 60)
	sets, err := Generate(GenerateInput{
		Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 2, Seed: "pin",
		PinnedNumbers: []int{7, 21}, ExcludedNumber: []int{1, 2, 3, 4, 5},
	}, draws)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	for _, set := range sets {
		if !containsInt(set.Main, 7) || !containsInt(set.Main, 21) {
			t.Fatalf("set %v lost a pinned number", set.Main)
		}
		for _, n := range []int{1, 2, 3, 4, 5} {
			if containsInt(set.Main, n) {
				t.Fatalf("set %v contains excluded %d", set.Main, n)
			}
		}
	}
}

func TestGenerateRejectsInvalidInput(t *testing.T) {
	draws := syntheticDraws(t, Loto6, 30)
	base := GenerateInput{Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 1}
	bad := map[string]GenerateInput{
		"unknown game":     {Game: "loto5", TargetDateKey: "2026-11-02", SetCount: 1},
		"zero sets":        {Game: Loto6, TargetDateKey: "2026-11-02"},
		"six sets":         {Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 6},
		"bad date":         {Game: Loto6, TargetDateKey: "02/11/2026", SetCount: 1},
		"pinned range":     {Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 1, PinnedNumbers: []int{44}},
		"pinned+excluded":  {Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 1, PinnedNumbers: []int{5}, ExcludedNumber: []int{5}},
		"too many pinned":  {Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 1, PinnedNumbers: []int{1, 2, 3, 4, 5, 6}},
		"negative weight":  {Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 1, Weights: map[string]float64{"overdue": -1}},
		"excluded too big": {Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 1, ExcludedNumber: seq(1, 40)},
	}
	for name, in := range bad {
		if _, err := Generate(in, draws); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	if _, err := Generate(base, draws); err != nil {
		t.Fatalf("baseline input must work: %v", err)
	}
	base.Weights = map[string]float64{"gapPattern": 0.1, "overdue": 0.3}
	if _, err := Generate(base, draws); err != nil {
		t.Fatalf("weights the engine does not model must be ignored, not rejected: %v", err)
	}
}

func seq(from, to int) []int {
	out := make([]int, 0, to-from+1)
	for i := from; i <= to; i++ {
		out = append(out, i)
	}
	return out
}

func TestGenerateFallsBackToSeededUniformWithoutEnoughHistory(t *testing.T) {
	draws := syntheticDraws(t, Loto7, MinHistoryForHeuristics-1)
	in := GenerateInput{Game: Loto7, TargetDateKey: "2026-10-30", SetCount: 2, Seed: "thin"}
	first, err := Generate(in, draws)
	if err != nil || len(first) != 2 {
		t.Fatalf("generate: %v sets=%d", err, len(first))
	}
	second, _ := Generate(in, draws)
	if !reflect.DeepEqual(first, second) {
		t.Fatal("fallback must still be deterministic for a seed")
	}
	for _, set := range first {
		if set.Explanation["mode"] != "uniform_seeded" || len(set.Main) != 7 {
			t.Fatalf("fallback set = %+v", set)
		}
	}
}

func TestSummarizeFindsHotColdAndOverdueNumbers(t *testing.T) {
	spec := SpecFor(Loto6)
	draws := SortDraws([]Draw{
		{Game: Loto6, Number: 1, DateKey: "2026-01-01", Main: []int{1, 2, 3, 4, 5, 6}},
		{Game: Loto6, Number: 2, DateKey: "2026-01-05", Main: []int{1, 2, 3, 7, 8, 9}},
		{Game: Loto6, Number: 3, DateKey: "2026-01-08", Main: []int{1, 2, 10, 11, 12, 13}},
	})
	summary := Summarize(spec, draws)
	if summary.Frequency[0] != 3 || summary.Frequency[2] != 2 || summary.Frequency[42] != 0 {
		t.Fatalf("frequency = %v", summary.Frequency)
	}
	if summary.Hot[0] != 1 || summary.Hot[1] != 2 {
		t.Fatalf("hot = %v, want 1 then 2", summary.Hot)
	}
	if summary.Gap[0] != 0 || summary.Gap[3] != 2 {
		t.Fatalf("gap(1)=%d gap(4)=%d, want 0 and 2", summary.Gap[0], summary.Gap[3])
	}
	if summary.Gap[42] != 3 {
		t.Fatalf("never-seen number gap = %d, want the history length 3", summary.Gap[42])
	}
	if len(summary.Cold) != 6 || summary.Frequency[summary.Cold[0]-1] != 0 {
		t.Fatalf("cold = %v", summary.Cold)
	}
	if len(summary.Overdue) != 6 || summary.Overdue[0] != 14 {
		t.Fatalf("overdue = %v, want never-seen numbers first (14 is the smallest)", summary.Overdue)
	}
}

func TestGenerateAlwaysFillsTheRequestedCountUnderTightConstraints(t *testing.T) {
	draws := syntheticDraws(t, Loto6, 60)
	// Pinning five numbers leaves a single free slot, so few heuristic sets exist.
	sets, err := Generate(GenerateInput{
		Game: Loto6, TargetDateKey: "2026-11-02", SetCount: 5, Seed: "tight",
		PinnedNumbers: []int{2, 4, 6, 8, 10}, ExcludedNumber: seq(14, 43),
	}, draws)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if len(sets) != 5 {
		t.Fatalf("got %d sets, want exactly 5", len(sets))
	}
	seen := map[string]bool{}
	for i, set := range sets {
		key := fmt.Sprint(set.Main)
		if seen[key] {
			t.Fatalf("duplicate set %s", key)
		}
		seen[key] = true
		if set.Explanation["rank"] != i+1 {
			t.Fatalf("set %d has rank %v", i, set.Explanation["rank"])
		}
		for _, n := range []int{2, 4, 6, 8, 10} {
			if !containsInt(set.Main, n) {
				t.Fatalf("set %v lost pinned %d", set.Main, n)
			}
		}
	}
}
