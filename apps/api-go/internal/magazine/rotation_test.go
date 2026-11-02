package magazine

import "testing"

func entries(keys ...string) []Entry {
	out := make([]Entry, len(keys))
	for i, k := range keys {
		out[i] = Entry{Key: k}
	}
	return out
}

func TestPickPrefersUnusedEntryOverRecent(t *testing.T) {
	pool := entries("a", "b", "c")
	got, repeat := Pick(pool, []string{"a", "b"}, 7)
	if got.Key != "c" || repeat {
		t.Fatalf("Pick = %q repeat=%v, want c / false", got.Key, repeat)
	}
}

func TestPickNeverRepeatsWhileUnusedExists(t *testing.T) {
	pool := entries("a", "b", "c", "d")
	var recent []string
	for day := 0; day < len(pool); day++ {
		got, repeat := Pick(pool, recent, day)
		if repeat {
			t.Fatalf("day %d: unexpected repeat", day)
		}
		for _, k := range recent {
			if k == got.Key {
				t.Fatalf("day %d: %q repeated within the first %d picks", day, k, len(pool))
			}
		}
		recent = append([]string{got.Key}, recent...)
	}
}

func TestPickReusesLeastRecentlyUsedWhenPoolExhausted(t *testing.T) {
	pool := entries("a", "b", "c")
	// most recent first: c was used yesterday, b is the oldest (not pool[0]).
	got, repeat := Pick(pool, []string{"c", "a", "b"}, 0)
	if got.Key != "b" || !repeat {
		t.Fatalf("Pick = %q repeat=%v, want b / true", got.Key, repeat)
	}
}

func TestPickIgnoresHistoryKeysNotInPool(t *testing.T) {
	pool := entries("a", "b")
	got, repeat := Pick(pool, []string{"zzz", "a"}, 0)
	if got.Key != "b" || repeat {
		t.Fatalf("Pick = %q repeat=%v, want b / false", got.Key, repeat)
	}
}

func TestPickIsDeterministicForSameInputs(t *testing.T) {
	pool := entries("a", "b", "c", "d", "e")
	first, _ := Pick(pool, nil, 11)
	second, _ := Pick(pool, nil, 11)
	if first.Key != second.Key {
		t.Fatalf("not deterministic: %q vs %q", first.Key, second.Key)
	}
}

// Real history repeats keys; the first (most recent) occurrence decides how
// recently an entry was used.
func TestPickUsesMostRecentOccurrenceOfRepeatedKeys(t *testing.T) {
	pool := entries("a", "b", "c")
	// b was used yesterday and again 4 days ago; a 2 days ago; c 3 days ago.
	got, repeat := Pick(pool, []string{"b", "a", "c", "b"}, 0)
	if got.Key != "c" || !repeat {
		t.Fatalf("Pick = %q repeat=%v, want c / true", got.Key, repeat)
	}
}
