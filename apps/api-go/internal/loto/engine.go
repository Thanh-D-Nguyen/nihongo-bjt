package loto

import (
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"sort"
	"strings"
	"unicode"
)

// MinHistoryForHeuristics is the number of official draws required before the
// historical heuristics are used. Below it the generator falls back to a plain
// seeded uniform choice, which is statistically equivalent for every ticket.
const MinHistoryForHeuristics = 10

// Weights tune the heuristic. Each component is normalized to 0..1 per number.
type Weights struct {
	FrequencyHot   float64 `json:"frequencyHot"`
	FrequencyCold  float64 `json:"frequencyCold"`
	Overdue        float64 `json:"overdue"`
	RecentMomentum float64 `json:"recentMomentum"`
	PairAffinity   float64 `json:"pairAffinity"`
	WeatherBias    float64 `json:"weatherBias"`
	DreamTextBias  float64 `json:"dreamTextBias"`
	DateNumerology float64 `json:"dateNumerology"`
	RandomEntropy  float64 `json:"randomEntropy"`
}

// DefaultWeights are the learner-facing defaults.
var DefaultWeights = Weights{
	FrequencyHot: 0.24, FrequencyCold: 0.12, Overdue: 0.20, RecentMomentum: 0.18,
	PairAffinity: 0.16, RandomEntropy: 0.10,
}

// WithOverrides applies admin-supplied weights by JSON key. Values must be
// finite and within 0..1; keys this engine does not model (the admin UI also
// sends experimental ones such as gapPattern) are ignored.
func (w Weights) WithOverrides(overrides map[string]float64) (Weights, error) {
	for key, value := range overrides {
		if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value > 1 {
			return w, fmt.Errorf("%w: weight %s must be between 0 and 1", ErrInvalidInput, key)
		}
		switch key {
		case "frequencyHot":
			w.FrequencyHot = value
		case "frequencyCold":
			w.FrequencyCold = value
		case "overdue":
			w.Overdue = value
		case "recentMomentum":
			w.RecentMomentum = value
		case "pairAffinity":
			w.PairAffinity = value
		case "weatherBias":
			w.WeatherBias = value
		case "dreamTextBias":
			w.DreamTextBias = value
		case "dateNumerology":
			w.DateNumerology = value
		case "randomEntropy":
			w.RandomEntropy = value
		}
	}
	return w, nil
}

func (w Weights) structuralTotal() float64 {
	return w.FrequencyHot + w.FrequencyCold + w.Overdue + w.RecentMomentum + w.PairAffinity +
		w.WeatherBias + w.DreamTextBias + w.DateNumerology
}

// GenerateInput configures one generation run.
type GenerateInput struct {
	Game           Game
	TargetDateKey  string
	SetCount       int
	Seed           string
	Weights        map[string]float64
	WeatherText    string
	DreamText      string
	LuckyText      string
	PinnedNumbers  []int
	ExcludedNumber []int
}

// GeneratedSet is one reference combination with its explanation.
type GeneratedSet struct {
	Main        []int
	Bonus       []int
	Score       float64 // 0..1 heuristic ranking score, not a winning probability
	Explanation map[string]any
}

// Summary aggregates a draw history.
type Summary struct {
	Spec       Spec
	Draws      int
	Frequency  []int // index n-1 → appearances as a main number
	Recent     []int // appearances within the most recent RecentWindow draws
	Gap        []int // draws since the number last appeared (0 = latest draw)
	Hot        []int
	Cold       []int
	Overdue    []int
	pairs      map[[2]int]int
	sumSamples []int
}

// RecentWindow is the number of latest draws used for the "recent" signal.
const RecentWindow = 12

// SortDraws orders draws newest first.
func SortDraws(draws []Draw) []Draw {
	sorted := append([]Draw(nil), draws...)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].DateKey != sorted[j].DateKey {
			return sorted[i].DateKey > sorted[j].DateKey
		}
		return sorted[i].Number > sorted[j].Number
	})
	return sorted
}

// Summarize computes frequency, recency, gap and pair statistics. draws must be
// sorted newest first (see SortDraws).
func Summarize(spec Spec, draws []Draw) Summary {
	summary := Summary{
		Spec: spec, Draws: len(draws),
		Frequency: make([]int, spec.MaxNumber), Recent: make([]int, spec.MaxNumber), Gap: make([]int, spec.MaxNumber),
		pairs: make(map[[2]int]int),
	}
	seen := make([]bool, spec.MaxNumber)
	for n := range summary.Gap {
		summary.Gap[n] = len(draws)
	}
	for index, draw := range draws {
		sum := 0
		for i, n := range draw.Main {
			if n < 1 || n > spec.MaxNumber {
				continue
			}
			summary.Frequency[n-1]++
			if index < RecentWindow {
				summary.Recent[n-1]++
			}
			if !seen[n-1] {
				seen[n-1] = true
				summary.Gap[n-1] = index
			}
			sum += n
			for _, other := range draw.Main[i+1:] {
				a, b := n, other
				if a > b {
					a, b = b, a
				}
				summary.pairs[[2]int{a, b}]++
			}
		}
		summary.sumSamples = append(summary.sumSamples, sum)
	}
	numbers := make([]int, spec.MaxNumber)
	for i := range numbers {
		numbers[i] = i + 1
	}
	byFrequency := append([]int(nil), numbers...)
	sort.SliceStable(byFrequency, func(i, j int) bool {
		a, b := byFrequency[i], byFrequency[j]
		if summary.Frequency[a-1] != summary.Frequency[b-1] {
			return summary.Frequency[a-1] > summary.Frequency[b-1]
		}
		return a < b
	})
	summary.Hot = append([]int(nil), byFrequency[:spec.MainCount]...)
	cold := append([]int(nil), byFrequency[len(byFrequency)-spec.MainCount:]...)
	sort.SliceStable(cold, func(i, j int) bool {
		a, b := cold[i], cold[j]
		if summary.Frequency[a-1] != summary.Frequency[b-1] {
			return summary.Frequency[a-1] < summary.Frequency[b-1]
		}
		return a < b
	})
	summary.Cold = cold
	byGap := append([]int(nil), numbers...)
	sort.SliceStable(byGap, func(i, j int) bool {
		a, b := byGap[i], byGap[j]
		if summary.Gap[a-1] != summary.Gap[b-1] {
			return summary.Gap[a-1] > summary.Gap[b-1]
		}
		return a < b
	})
	summary.Overdue = append([]int(nil), byGap[:spec.MainCount]...)
	return summary
}

func normalize(values []int) []float64 {
	if len(values) == 0 {
		return nil
	}
	lo, hi := values[0], values[0]
	for _, v := range values {
		if v < lo {
			lo = v
		}
		if v > hi {
			hi = v
		}
	}
	span := float64(hi - lo)
	if span < 1 {
		span = 1
	}
	out := make([]float64, len(values))
	for i, v := range values {
		out[i] = float64(v-lo) / span
	}
	return out
}

func hashString(value string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(value))
	return h.Sum32()
}

func newRNG(seed string) *rand.Rand {
	return rand.New(rand.NewSource(int64(hashString(seed)) + 1))
}

// textNumbers maps free text (weather, dreams, lucky words) onto 1..max.
func textNumbers(text string, maxNumber int) []int {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	tokens := strings.FieldsFunc(strings.ToLower(text), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
	if len(tokens) == 0 {
		tokens = []string{text}
	}
	seen := map[int]struct{}{}
	out := make([]int, 0, 12)
	for _, token := range tokens {
		n := int(hashString(token)%uint32(maxNumber)) + 1
		if _, dup := seen[n]; !dup && len(out) < 12 {
			seen[n] = struct{}{}
			out = append(out, n)
		}
	}
	return out
}

// dateNumbers derives numerology numbers from the target date key.
func dateNumbers(dateKey string, maxNumber int) []int {
	digits := 0
	for _, r := range dateKey {
		if r >= '0' && r <= '9' {
			digits += int(r - '0')
		}
	}
	candidates := []int{digits}
	if len(dateKey) >= 10 {
		var day, month int
		_, _ = fmt.Sscanf(dateKey[8:10], "%d", &day)
		_, _ = fmt.Sscanf(dateKey[5:7], "%d", &month)
		candidates = append(candidates, day, month)
	}
	seen := map[int]struct{}{}
	out := []int{}
	for _, v := range candidates {
		if v <= 0 {
			continue
		}
		n := (v-1)%maxNumber + 1
		if _, dup := seen[n]; !dup {
			seen[n] = struct{}{}
			out = append(out, n)
		}
	}
	return out
}

func containsInt(values []int, target int) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

// passesShape rejects the extreme shapes real draws almost never produce:
// all-odd/all-even, all-low/all-high and sums outside the 10–90 percentile band.
func passesShape(spec Spec, numbers []int, sums []int) bool {
	odd, low, sum := 0, 0, 0
	for _, n := range numbers {
		if n%2 == 1 {
			odd++
		}
		if n <= spec.MaxNumber/2 {
			low++
		}
		sum += n
	}
	if odd == 0 || odd == spec.MainCount || low == 0 || low == spec.MainCount {
		return false
	}
	if len(sums) >= MinHistoryForHeuristics {
		sorted := append([]int(nil), sums...)
		sort.Ints(sorted)
		lowBand := sorted[len(sorted)/10]
		highBand := sorted[min(len(sorted)*9/10, len(sorted)-1)]
		if sum < lowBand || sum > highBand {
			return false
		}
	}
	return true
}

// Generate produces SetCount unique reference combinations. The result is a
// pure function of (input, draws): the same seed always yields the same sets.
func Generate(in GenerateInput, draws []Draw) ([]GeneratedSet, error) {
	if _, ok := ParseGame(string(in.Game)); !ok {
		return nil, fmt.Errorf("%w: game must be loto6 or loto7", ErrInvalidInput)
	}
	spec := SpecFor(in.Game)
	if in.SetCount < 1 || in.SetCount > 5 {
		return nil, fmt.Errorf("%w: setCount must be between 1 and 5", ErrInvalidInput)
	}
	if _, err := ParseDateKey(in.TargetDateKey); err != nil {
		return nil, err
	}
	weights, err := DefaultWeights.WithOverrides(in.Weights)
	if err != nil {
		return nil, err
	}
	excluded := map[int]struct{}{}
	for _, n := range in.ExcludedNumber {
		if n < 1 || n > spec.MaxNumber {
			return nil, fmt.Errorf("%w: excluded number %d is outside 1-%d", ErrInvalidInput, n, spec.MaxNumber)
		}
		excluded[n] = struct{}{}
	}
	pinned := make([]int, 0, len(in.PinnedNumbers))
	for _, n := range in.PinnedNumbers {
		if n < 1 || n > spec.MaxNumber {
			return nil, fmt.Errorf("%w: pinned number %d is outside 1-%d", ErrInvalidInput, n, spec.MaxNumber)
		}
		if _, bad := excluded[n]; bad {
			return nil, fmt.Errorf("%w: number %d is both pinned and excluded", ErrInvalidInput, n)
		}
		if !containsInt(pinned, n) {
			pinned = append(pinned, n)
		}
	}
	if len(pinned) >= spec.MainCount {
		return nil, fmt.Errorf("%w: pin fewer than %d numbers", ErrInvalidInput, spec.MainCount)
	}
	if spec.MaxNumber-len(excluded) < spec.MainCount {
		return nil, fmt.Errorf("%w: too many excluded numbers", ErrInvalidInput)
	}

	sorted := SortDraws(draws)
	rng := newRNG(fmt.Sprintf("%s:%s:%s", in.Seed, in.Game, in.TargetDateKey))
	if len(sorted) < MinHistoryForHeuristics {
		return rankUniform(generateUniform(spec, in, pinned, excluded, rng, map[string]struct{}{}, in.SetCount, "uniform_seeded")), nil
	}

	summary := Summarize(spec, sorted)
	hotNorm := normalize(summary.Frequency)
	coldNorm := make([]float64, len(hotNorm))
	for i, v := range hotNorm {
		coldNorm[i] = 1 - v
	}
	overdueNorm := normalize(summary.Gap)
	recentNorm := normalize(summary.Recent)
	weather := textNumbers(in.WeatherText, spec.MaxNumber)
	dream := textNumbers(in.DreamText+" "+in.LuckyText, spec.MaxNumber)
	dateBias := dateNumbers(in.TargetDateKey, spec.MaxNumber)

	structural := func(n int, selected []int) float64 {
		affinity := 0.0
		if len(selected) > 0 {
			for _, other := range selected {
				a, b := n, other
				if a > b {
					a, b = b, a
				}
				affinity += float64(summary.pairs[[2]int{a, b}])
			}
			affinity /= float64(len(selected) * len(sorted))
		}
		score := weights.FrequencyHot*hotNorm[n-1] + weights.FrequencyCold*coldNorm[n-1] +
			weights.Overdue*overdueNorm[n-1] + weights.RecentMomentum*recentNorm[n-1] + weights.PairAffinity*affinity
		if containsInt(weather, n) {
			score += weights.WeatherBias
		}
		if containsInt(dream, n) {
			score += weights.DreamTextBias
		}
		if containsInt(dateBias, n) {
			score += weights.DateNumerology
		}
		return score
	}

	type candidate struct {
		main  []int
		score float64
	}
	target := max(in.SetCount*8, 24)
	candidates := make([]candidate, 0, target)
	seenKeys := map[string]struct{}{}
	for attempts := 0; len(candidates) < target && attempts < 900; attempts++ {
		selected := append([]int(nil), pinned...)
		for len(selected) < spec.MainCount {
			type scoredNumber struct {
				n     int
				score float64
			}
			pool := make([]scoredNumber, 0, spec.MaxNumber)
			for n := 1; n <= spec.MaxNumber; n++ {
				if containsInt(selected, n) {
					continue
				}
				if _, bad := excluded[n]; bad {
					continue
				}
				pool = append(pool, scoredNumber{n: n, score: structural(n, selected) + weights.RandomEntropy*rng.Float64()})
			}
			sort.SliceStable(pool, func(i, j int) bool {
				if pool[i].score != pool[j].score {
					return pool[i].score > pool[j].score
				}
				return pool[i].n < pool[j].n
			})
			window := min(len(pool), 8+int(rng.Float64()*8))
			selected = append(selected, pool[int(rng.Float64()*float64(window))].n)
		}
		sort.Ints(selected)
		if !passesShape(spec, selected, summary.sumSamples) {
			continue
		}
		key := fmt.Sprint(selected)
		if _, dup := seenKeys[key]; dup {
			continue
		}
		seenKeys[key] = struct{}{}
		total := 0.0
		for _, n := range selected {
			others := make([]int, 0, len(selected)-1)
			for _, o := range selected {
				if o != n {
					others = append(others, o)
				}
			}
			total += structural(n, others)
		}
		candidates = append(candidates, candidate{main: selected, score: total})
	}
	if len(candidates) == 0 {
		return rankUniform(generateUniform(spec, in, pinned, excluded, rng, map[string]struct{}{}, in.SetCount, "uniform_seeded")), nil
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].score != candidates[j].score {
			return candidates[i].score > candidates[j].score
		}
		return fmt.Sprint(candidates[i].main) < fmt.Sprint(candidates[j].main)
	})
	if len(candidates) > in.SetCount {
		candidates = candidates[:in.SetCount]
	}
	ceiling := float64(spec.MainCount) * math.Max(weights.structuralTotal(), 0.0001)
	sets := make([]GeneratedSet, 0, len(candidates))
	for rank, c := range candidates {
		sets = append(sets, GeneratedSet{
			Main:  c.main,
			Bonus: []int{}, // bonus numbers are drawn by the operator, a learner never picks them
			Score: math.Round(math.Min(c.score/ceiling, 1)*10000) / 10000,
			Explanation: map[string]any{
				"mode":    "historical_heuristic",
				"rank":    rank + 1,
				"weights": weights,
				"shape":   shapeOf(spec, c.main),
				"numbers": numberTags(c.main, summary),
				"signals": map[string]any{
					"hotNumbers":     summary.Hot,
					"coldNumbers":    summary.Cold,
					"overdueNumbers": summary.Overdue,
					"weatherNumbers": weather,
					"dreamNumbers":   dream,
					"dateNumbers":    dateBias,
				},
				"historyDraws": len(sorted),
			},
		})
	}
	if missing := in.SetCount - len(sets); missing > 0 {
		// Tight pin/exclude constraints can leave fewer unique heuristic sets than requested.
		sets = append(sets, rankUniform(generateUniform(spec, in, pinned, excluded, rng, seenKeys, missing, "uniform_topup"))...)
		for i := range sets {
			sets[i].Explanation["rank"] = i + 1
		}
	}
	return sets, nil
}

// generateUniform draws seeded uniform combinations until want sets exist,
// skipping the combinations already in seen. It first insists on the odd/even
// and low/high shape filter, then relaxes it when constraints make that
// impossible, so a request is always filled.
func generateUniform(spec Spec, in GenerateInput, pinned []int, excluded map[int]struct{}, rng *rand.Rand, seen map[string]struct{}, want int, mode string) []GeneratedSet {
	sets := make([]GeneratedSet, 0, want)
	for _, requireShape := range []bool{true, false} {
		for attempts := 0; len(sets) < want && attempts < 600; attempts++ {
			selected := append([]int(nil), pinned...)
			for len(selected) < spec.MainCount {
				n := rng.Intn(spec.MaxNumber) + 1
				if _, bad := excluded[n]; bad || containsInt(selected, n) {
					continue
				}
				selected = append(selected, n)
			}
			sort.Ints(selected)
			if requireShape && !passesShape(spec, selected, nil) {
				continue
			}
			key := fmt.Sprint(selected)
			if _, dup := seen[key]; dup {
				continue
			}
			seen[key] = struct{}{}
			sets = append(sets, GeneratedSet{
				Main: selected, Bonus: []int{}, Score: 0.5,
				Explanation: map[string]any{
					"mode": mode, "shape": shapeOf(spec, selected),
					"note": "not enough official history for the heuristic; every combination is equally likely",
				},
			})
		}
	}
	return sets
}

func shapeOf(spec Spec, numbers []int) map[string]any {
	odd, low, sum, consecutive := 0, 0, 0, 0
	for i, n := range numbers {
		if n%2 == 1 {
			odd++
		}
		if n <= spec.MaxNumber/2 {
			low++
		}
		sum += n
		if i > 0 && numbers[i-1]+1 == n {
			consecutive++
		}
	}
	return map[string]any{"odd": odd, "even": len(numbers) - odd, "low": low, "high": len(numbers) - low, "sum": sum, "consecutivePairs": consecutive}
}

func numberTags(numbers []int, summary Summary) []map[string]any {
	out := make([]map[string]any, 0, len(numbers))
	for _, n := range numbers {
		tags := []string{}
		if containsInt(summary.Hot, n) {
			tags = append(tags, "hot")
		}
		if containsInt(summary.Cold, n) {
			tags = append(tags, "cold")
		}
		if containsInt(summary.Overdue, n) {
			tags = append(tags, "overdue")
		}
		if summary.Recent[n-1] >= 3 {
			tags = append(tags, "recent")
		}
		out = append(out, map[string]any{"number": n, "tags": tags, "count": summary.Frequency[n-1], "gap": summary.Gap[n-1]})
	}
	return out
}

// ErrNoHistory is returned by helpers that need at least one official draw.
var ErrNoHistory = errors.New("loto: no official draws available")

func rankUniform(sets []GeneratedSet) []GeneratedSet {
	for i := range sets {
		sets[i].Explanation["rank"] = i + 1
	}
	return sets
}
