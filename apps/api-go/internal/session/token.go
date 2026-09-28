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
