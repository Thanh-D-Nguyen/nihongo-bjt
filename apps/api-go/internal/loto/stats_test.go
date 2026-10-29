package loto

import (
	"math"
	"testing"
)

func TestCombinationsMatchOfficialOdds(t *testing.T) {
	if got := Combinations(43, 6); got != 6096454 {
		t.Fatalf("C(43,6) = %d, want 6096454", got)
	}
	if got := Combinations(37, 7); got != 10295472 {
		t.Fatalf("C(37,7) = %d, want 10295472", got)
	}
	if SpecFor(Loto6).TotalCombinations != 6096454 || SpecFor(Loto7).TotalCombinations != 10295472 {
		t.Fatal("specs must carry the total combination count")
	}
}

func TestHitProbabilitiesAreAValidDistributionWithTheExpectedMean(t *testing.T) {
	for _, game := range Games() {
		spec := SpecFor(game)
		probabilities := HitProbabilities(spec)
		total, mean := 0.0, 0.0
		for hits, p := range probabilities {
			total += p
			mean += float64(hits) * p
		}
		if math.Abs(total-1) > 1e-9 {
			t.Errorf("%s: probabilities sum to %v", game, total)
		}
		if math.Abs(mean-ExpectedHits(spec)) > 1e-9 {
			t.Errorf("%s: mean hits %v, want k*k/n = %v", game, mean, ExpectedHits(spec))
		}
	}
	if got := roundTo(ExpectedHits(SpecFor(Loto7)), 4); got != 1.3243 {
		t.Fatalf("Loto7 baseline = %v, want 1.3243", got)
	}
}

func TestMeasureAccuracyComparesWithChance(t *testing.T) {
	spec := SpecFor(Loto6)
	result := Draw{Game: Loto6, Number: 2149, Main: []int{2, 11, 15, 19, 24, 36}, Bonus: []int{27}}
	other := Draw{Game: Loto6, Number: 2148, Main: []int{1, 2, 3, 4, 5, 6}, Bonus: []int{7}}
	accuracy := MeasureAccuracy(spec, []PredictionSample{
		{Kind: "published", Main: []int{2, 11, 15, 30, 31, 32}, Result: result},
		{Kind: "backtest", Main: []int{8, 9, 10, 27, 28, 29}, Result: other},
	})
	if accuracy.Samples != 2 || accuracy.PublishedSamples != 1 || accuracy.BacktestSamples != 1 {
		t.Fatalf("sample accounting = %+v", accuracy)
	}
	if accuracy.AvgHits != 1.5 || accuracy.BestHits != 3 || accuracy.BestDrawNumber == nil || *accuracy.BestDrawNumber != 2149 {
		t.Fatalf("hits = %+v", accuracy)
	}
	if accuracy.Distribution[3] != 1 || accuracy.Distribution[0] != 1 {
		t.Fatalf("distribution = %v", accuracy.Distribution)
	}
	if accuracy.BaselineHits != 0.8372 || len(accuracy.ExpectedDistribution) != 7 {
		t.Fatalf("baseline=%v expected=%v", accuracy.BaselineHits, accuracy.ExpectedDistribution)
	}
	if empty := MeasureAccuracy(spec, nil); empty.Samples != 0 || empty.AvgHits != 0 || empty.BestDrawNumber != nil {
		t.Fatalf("empty accuracy = %+v", empty)
	}
}

func TestOddAndSumDistributions(t *testing.T) {
	spec := SpecFor(Loto6)
	draws := []Draw{
		{Main: []int{1, 3, 5, 2, 4, 6}},    // 3 odd, sum 21
		{Main: []int{1, 3, 5, 7, 9, 11}},   // 6 odd, sum 36
		{Main: []int{2, 4, 6, 8, 10, 12}},  // 0 odd, sum 42
		{Main: []int{43, 41, 40, 2, 4, 6}}, // 2 odd, sum 136
	}
	odd := OddDistribution(spec, draws)
	if odd[0] != 1 || odd[2] != 1 || odd[3] != 1 || odd[6] != 1 {
		t.Fatalf("odd distribution = %v", odd)
	}
	sum := SumDistribution(draws)
	if sum.Min != 21 || sum.Max != 136 || sum.Average != 58.75 {
		t.Fatalf("sum stat = %+v", sum)
	}
	if empty := SumDistribution(nil); empty != (SumStat{}) {
		t.Fatalf("empty sum = %+v", empty)
	}
}

func TestSummarizeWithoutHistoryInventsNoNumberLists(t *testing.T) {
	summary := Summarize(SpecFor(Loto6), nil)
	if len(summary.Hot) != 0 || len(summary.Cold) != 0 || len(summary.Overdue) != 0 {
		t.Fatalf("hot=%v cold=%v overdue=%v, want empty lists when there is no history", summary.Hot, summary.Cold, summary.Overdue)
	}
	if summary.Draws != 0 || len(summary.Frequency) != 43 {
		t.Fatalf("summary shape = %+v", summary)
	}
}
