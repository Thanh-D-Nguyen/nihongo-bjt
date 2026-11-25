// Package optionshuffle provides deterministic serve-time option shuffling.
package optionshuffle

import (
	"crypto/sha256"
	"math/rand/v2"
)

// Deterministic returns a deterministically Fisher-Yates shuffled copy of items
// driven by a SHA-256 + ChaCha8 PRNG seeded from seedParts.
//
// Callers must pass items in a canonical pre-shuffle order (for example SQL
// ORDER BY option_key) so repeated calls with the same seedParts always return
// the identical order without mutating the input slice.
func Deterministic[T any](items []T, seedParts ...string) []T {
	out := make([]T, len(items))
	copy(out, items)
	if len(out) <= 1 {
		return out
	}

	h := sha256.New()
	for i, part := range seedParts {
		if i > 0 {
			_, _ = h.Write([]byte{0})
		}
		_, _ = h.Write([]byte(part))
	}
	var seed [32]byte
	h.Sum(seed[:0])

	rng := rand.New(rand.NewChaCha8(seed))
	for i := len(out) - 1; i > 0; i-- {
		j := rng.IntN(i + 1)
		out[i], out[j] = out[j], out[i]
	}
	return out
}
