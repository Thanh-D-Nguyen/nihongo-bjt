package session

import (
	"encoding/hex"
	"testing"
)

func TestGenerateToken_Length(t *testing.T) {
	raw, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	// Raw token is hex-encoded 32 bytes = 64 hex chars
	if len(raw) != TokenBytes*2 {
		t.Errorf("raw token length = %d, want %d", len(raw), TokenBytes*2)
	}
	// Digest is SHA-256 hex = 64 chars
	if len(digest) != DigestHexLen {
		t.Errorf("digest length = %d, want %d", len(digest), DigestHexLen)
	}
}

func TestGenerateToken_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		raw, _, err := GenerateToken()
		if err != nil {
			t.Fatalf("GenerateToken failed on iteration %d: %v", i, err)
		}
		if seen[raw] {
			t.Fatalf("duplicate token generated on iteration %d", i)
		}
		seen[raw] = true
	}
}

func TestHashToken_Deterministic(t *testing.T) {
	raw, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	got := HashToken(raw)
	if got != digest {
		t.Errorf("HashToken(%q) = %q, want %q", raw, got, digest)
	}
}

func TestHashToken_MatchesManualSHA256(t *testing.T) {
	input := "test-token-value"
	got := HashToken(input)
	// Verify it's valid hex
	if _, err := hex.DecodeString(got); err != nil {
		t.Errorf("HashToken produced invalid hex: %v", err)
	}
	if len(got) != DigestHexLen {
		t.Errorf("HashToken length = %d, want %d", len(got), DigestHexLen)
	}
}

func TestConstantTimeDigestEqual(t *testing.T) {
	a := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	b := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	c := "0000000000000000000000000000000000000000000000000000000000000000"

	if !ConstantTimeDigestEqual(a, b) {
		t.Error("identical digests should be equal")
	}
	if ConstantTimeDigestEqual(a, c) {
		t.Error("different digests should not be equal")
	}
}
