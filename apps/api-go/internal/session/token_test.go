package session

import (
	"strings"
	"testing"
)

func TestGenerateToken_LengthAndUniqueness(t *testing.T) {
	raw1, digest1, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if len(raw1) != DigestHexLen {
		t.Errorf("raw token length = %d, want %d", len(raw1), DigestHexLen)
	}
	if len(digest1) != DigestHexLen {
		t.Errorf("digest length = %d, want %d", len(digest1), DigestHexLen)
	}
	if raw1 == digest1 {
		t.Error("raw token must differ from its digest")
	}

	raw2, digest2, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken second call: %v", err)
	}
	if raw1 == raw2 || digest1 == digest2 {
		t.Error("consecutive tokens must be unique")
	}
}

func TestHashToken_Deterministic(t *testing.T) {
	raw := strings.Repeat("ab", 32) // 64 hex chars
	d1 := HashToken(raw)
	d2 := HashToken(raw)
	if d1 != d2 {
		t.Errorf("HashToken not deterministic: %q vs %q", d1, d2)
	}
	if len(d1) != DigestHexLen {
		t.Errorf("digest length = %d, want %d", len(d1), DigestHexLen)
	}
}

func TestValidateRawToken_Valid(t *testing.T) {
	valid := strings.Repeat("0123456789abcdef", 4) // exactly 64 lowercase hex
	if err := ValidateRawToken(valid); err != nil {
		t.Errorf("expected valid token, got error: %v", err)
	}
}

func TestValidateRawToken_InvalidLength(t *testing.T) {
	cases := []struct {
		name  string
		token string
	}{
		{"empty", ""},
		{"too_short_32", strings.Repeat("a", 32)},
		{"too_long_128", strings.Repeat("a", 128)},
		{"one_char", "a"},
		{"63_chars", strings.Repeat("a", 63)},
		{"65_chars", strings.Repeat("a", 65)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateRawToken(tc.token); err == nil {
				t.Errorf("expected error for length %d, got nil", len(tc.token))
			}
		})
	}
}

func TestValidateRawToken_InvalidCharacters(t *testing.T) {
	cases := []struct {
		name  string
		token string
	}{
		{"uppercase_A", strings.Repeat("A", 64)},
		{"mixed_case", strings.Repeat("aB", 32)},
		{"non_hex_g", strings.Repeat("g", 64)},
		{"spaces", strings.Repeat(" ", 64)},
		{"null_bytes", strings.Repeat("\x00", 64)},
		{"special_chars", strings.Repeat("!", 64)},
		{"one_bad_char", strings.Repeat("a", 63) + "Z"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateRawToken(tc.token); err == nil {
				t.Errorf("expected error for %s, got nil", tc.name)
			}
		})
	}
}
