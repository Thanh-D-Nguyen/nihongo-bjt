package magazine

// Pick chooses the pool entry to publish next.
//
// recent lists the keys already published, most recent first. An entry that
// never appears in recent is preferred; seed (the date ordinal) picks among
// those deterministically so a re-run for the same day gives the same answer.
// When every entry has been used, the least recently used one is returned and
// repeat is true so the caller can warn that the pool is too small.
//
// pool must not be empty.
func Pick(pool []Entry, recent []string, seed int) (entry Entry, repeat bool) {
	rank := make(map[string]int, len(recent))
	for i, key := range recent {
		if _, seen := rank[key]; !seen {
			rank[key] = i
		}
	}

	var unused []Entry
	oldest, oldestRank := pool[0], -1
	for _, e := range pool {
		r, used := rank[e.Key]
		if !used {
			unused = append(unused, e)
			continue
		}
		if r > oldestRank {
			oldest, oldestRank = e, r
		}
	}
	if len(unused) > 0 {
		return unused[(seed%len(unused)+len(unused))%len(unused)], false
	}
	return oldest, true
}
