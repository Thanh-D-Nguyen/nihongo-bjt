package loto

import (
	"math"
	"sort"
)

// NumberStat is one cell of the frequency lab.
type NumberStat struct {
	Number int `json:"number"`
	Count  int `json:"count"`
	Recent int `json:"recent"`
	Gap    int `json:"gap"`
}

// SumStat summarizes the distribution of main-number sums.
type SumStat struct {
	Min     int     `json:"min"`
	Max     int     `json:"max"`
	Average float64 `json:"average"`
	P10     int     `json:"p10"`
	P90     int     `json:"p90"`
}

// PredictionSample pairs one published/backtest reference set with the
// official draw it was compared against.
type PredictionSample struct {
	Kind       string // "published" | "backtest"
	DrawNumber int
	Main       []int
	Result     Draw
}

// Accuracy compares reference-set hits with pure chance.
type Accuracy struct {
	Samples              int       `json:"samples"`
	PublishedSamples     int       `json:"publishedSamples"`
	BacktestSamples      int       `json:"backtestSamples"`
	AvgHits              float64   `json:"avgHits"`
	BaselineHits         float64   `json:"baselineHits"`
	BestHits             int       `json:"bestHits"`
	BestDrawNumber       *int      `json:"bestDrawNumber"`
	BonusHits            int       `json:"bonusHits"`
	Distribution         []int     `json:"distribution"`
	ExpectedDistribution []float64 `json:"expectedDistribution"`
}

// ExpectedHits is the mean number of matches between a fixed k-combination and
// a random k-combination drawn from n numbers: k*k/n.
func ExpectedHits(spec Spec) float64 {
	return float64(spec.MainCount*spec.MainCount) / float64(spec.MaxNumber)
}

// HitProbabilities returns the hypergeometric probability of matching exactly
// 0..MainCount main numbers with a random ticket.
func HitProbabilities(spec Spec) []float64 {
	total := float64(Combinations(spec.MaxNumber, spec.MainCount))
	out := make([]float64, spec.MainCount+1)
	for hits := 0; hits <= spec.MainCount; hits++ {
		ways := float64(Combinations(spec.MainCount, hits)) * float64(Combinations(spec.MaxNumber-spec.MainCount, spec.MainCount-hits))
		out[hits] = ways / total
	}
	return out
}

// CountHits returns how many predicted numbers appear in the official main set.
func CountHits(predicted, actual []int) int {
	hits := 0
	for _, n := range predicted {
		if containsInt(actual, n) {
			hits++
		}
	}
	return hits
}

// BonusHit reports whether any predicted number equals an official bonus number.
func BonusHit(predicted, bonus []int) bool {
	for _, n := range bonus {
		if containsInt(predicted, n) {
			return true
		}
	}
	return false
}

// MeasureAccuracy summarizes samples against the chance baseline and the
// hypergeometric expectation.
func MeasureAccuracy(spec Spec, samples []PredictionSample) Accuracy {
	accuracy := Accuracy{
		BaselineHits:         roundTo(ExpectedHits(spec), 4),
		Distribution:         make([]int, spec.MainCount+1),
		ExpectedDistribution: make([]float64, spec.MainCount+1),
	}
	for i, p := range HitProbabilities(spec) {
		accuracy.ExpectedDistribution[i] = roundTo(p, 6)
	}
	totalHits := 0
	for _, sample := range samples {
		hits := min(CountHits(sample.Main, sample.Result.Main), spec.MainCount)
		accuracy.Samples++
		totalHits += hits
		accuracy.Distribution[hits]++
		if sample.Kind == "backtest" {
			accuracy.BacktestSamples++
		} else {
			accuracy.PublishedSamples++
		}
		if BonusHit(sample.Main, sample.Result.Bonus) {
			accuracy.BonusHits++
		}
		if hits > accuracy.BestHits || (hits == accuracy.BestHits && accuracy.BestDrawNumber == nil) {
			accuracy.BestHits = hits
			number := sample.Result.Number
			accuracy.BestDrawNumber = &number
		}
	}
	if accuracy.Samples > 0 {
		accuracy.AvgHits = roundTo(float64(totalHits)/float64(accuracy.Samples), 4)
	}
	return accuracy
}

// FrequencyTable flattens a Summary into per-number cells.
func FrequencyTable(summary Summary) []NumberStat {
	table := make([]NumberStat, summary.Spec.MaxNumber)
	for i := range table {
		table[i] = NumberStat{Number: i + 1, Count: summary.Frequency[i], Recent: summary.Recent[i], Gap: summary.Gap[i]}
	}
	return table
}

// OddDistribution counts draws by how many odd main numbers they contained
// (index = odd count, 0..MainCount).
func OddDistribution(spec Spec, draws []Draw) []int {
	out := make([]int, spec.MainCount+1)
	for _, draw := range draws {
		odd := 0
		for _, n := range draw.Main {
			if n%2 == 1 {
				odd++
			}
		}
		if odd <= spec.MainCount {
			out[odd]++
		}
	}
	return out
}

// SumDistribution summarizes the sums of the main numbers of every draw.
func SumDistribution(draws []Draw) SumStat {
	if len(draws) == 0 {
		return SumStat{}
	}
	sums := make([]int, 0, len(draws))
	total := 0
	for _, draw := range draws {
		sum := 0
		for _, n := range draw.Main {
			sum += n
		}
		sums = append(sums, sum)
		total += sum
	}
	sort.Ints(sums)
	return SumStat{
		Min: sums[0], Max: sums[len(sums)-1],
		Average: roundTo(float64(total)/float64(len(sums)), 2),
		P10:     sums[len(sums)/10], P90: sums[min(len(sums)*9/10, len(sums)-1)],
	}
}

func roundTo(value float64, places int) float64 {
	pow := math.Pow(10, float64(places))
	return math.Round(value*pow) / pow
}
