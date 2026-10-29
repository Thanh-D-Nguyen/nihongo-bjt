package loto

import "testing"

func TestSentenceLibraryIsCompleteEnoughToTeach(t *testing.T) {
	if SentenceLibrarySize() < 12 {
		t.Fatalf("library has %d sentences, want at least 12", SentenceLibrarySize())
	}
	for i, s := range sentenceLibrary {
		if s.TextJP == "" || s.Reading == "" || s.TextVI == "" || s.Level == "" || s.Grammar == "" || len(s.VocabItems) < 3 {
			t.Errorf("sentence %d is incomplete: %+v", i, s)
		}
		for _, v := range s.VocabItems {
			if v.WordJP == "" || v.Reading == "" || v.MeaningVI == "" {
				t.Errorf("sentence %d has an incomplete vocab item %+v", i, v)
			}
		}
	}
}

func TestSentenceForIsDeterministicAndRotatesBetweenConsecutiveDraws(t *testing.T) {
	first := SentenceFor(Loto6, "2026-10-26")
	again := SentenceFor(Loto6, "2026-10-26")
	if first.TextJP != again.TextJP {
		t.Fatal("the same draw must always get the same sentence")
	}
	next := SentenceFor(Loto6, "2026-10-29")
	if first.TextJP == next.TextJP {
		t.Fatalf("consecutive draws repeated %q", first.TextJP)
	}
	// Mutating the returned vocab must not corrupt the shared library.
	first.VocabItems[0].WordJP = "changed"
	if SentenceFor(Loto6, "2026-10-26").VocabItems[0].WordJP == "changed" {
		t.Fatal("SentenceFor must return a copy of the vocab slice")
	}
}
