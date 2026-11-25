package optionshuffle

import (
	"fmt"
	"reflect"
	"testing"
)

func TestDeterministicEdgeCasesAndImmutability(t *testing.T) {
	if got := Deterministic[string](nil, "s", "q"); got == nil || len(got) != 0 {
		t.Errorf("Deterministic(nil) = %#v, want empty non-nil slice", got)
	}
	if got := Deterministic([]string{"A"}, "s", "q"); !reflect.DeepEqual(got, []string{"A"}) {
		t.Errorf("Deterministic([A]) = %v, want [A]", got)
	}

	orig := []string{"A", "B", "C", "D"}
	shuffled := Deterministic(orig, "session-1", "question-1")
	if !reflect.DeepEqual(orig, []string{"A", "B", "C", "D"}) {
		t.Errorf("Deterministic mutated input slice: got %v", orig)
	}
	again := Deterministic(orig, "session-1", "question-1")
	if !reflect.DeepEqual(shuffled, again) {
		t.Errorf("Deterministic not stable for identical seeds: %v vs %v", shuffled, again)
	}
}

func TestDeterministicUniformDistribution(t *testing.T) {
	const numSeeds = 1000
	base := []string{"A", "B", "C", "D"}
	var posCounts [4]int

	for i := 0; i < numSeeds; i++ {
		got := Deterministic(base, fmt.Sprintf("session-%04d", i), "question-fixed")
		found := -1
		for idx, k := range got {
			if k == "B" {
				found = idx
				break
			}
		}
		if found < 0 {
			t.Fatalf("seed %d lost option B: %v", i, got)
		}
		posCounts[found]++
	}

	minBound := int(float64(numSeeds) * 0.18)
	maxBound := int(float64(numSeeds) * 0.32)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("Deterministic uniform check failed: slot %d got %d/%d, want [%d, %d]; counts=%v",
				slot, count, numSeeds, minBound, maxBound, posCounts)
		}
	}
}
