// Package session provides opaque session token generation and digest utilities.
package session

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

const (
	// TokenBytes is the number of random bytes in a session token (256 bits).
	TokenBytes = 32
	// DigestHexLen is the hex-encoded length of a SHA-256 digest.
	DigestHexLen = 64
)

// GenerateToken creates a cryptographically secure 256-bit opaque token
// and returns its SHA-256 hex digest. The raw token is returned exactly once;
// only the digest should be persisted.
func GenerateToken() (rawToken string, digest string, err error) {
	b := make([]byte, TokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("session: crypto/rand failed: %w", err)
	}
	raw := hex.EncodeToString(b)
	h := sha256.Sum256([]byte(raw))
	return raw, hex.EncodeToString(h[:]), nil
}

// HashToken computes the SHA-256 hex digest of a raw token string.
func HashToken(rawToken string) string {
	h := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(h[:])
}

// ValidateRawToken checks that the input is exactly 64 lowercase hex characters
// (a 32-byte token). Returns nil if valid, or an error describing the violation.
// This prevents unbounded hashing of attacker-controlled input in lookup paths.
func ValidateRawToken(raw string) error {
	if len(raw) != DigestHexLen {
		return fmt.Errorf("session: invalid token length %d", len(raw))
	}
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return fmt.Errorf("session: invalid token character at position %d", i)
		}
	}
	return nil
}
