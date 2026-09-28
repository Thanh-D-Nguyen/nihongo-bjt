package credential

import (
	"errors"
	"strings"
	"testing"
)

func TestHashAndVerify_CorrectPassword(t *testing.T) {
	pw := []byte("correct-horse-battery-staple")
	encoded, err := Hash(pw, DefaultParams())
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if err := Verify(pw, encoded); err != nil {
		t.Errorf("Verify correct password failed: %v", err)
	}
}

func TestVerify_WrongPassword(t *testing.T) {
	encoded, err := Hash([]byte("right-password"), DefaultParams())
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	err = Verify([]byte("wrong-password"), encoded)
	if !errors.Is(err, ErrMismatch) {
		t.Errorf("expected ErrMismatch, got %v", err)
	}
}

func TestHash_UniqueSalts(t *testing.T) {
	pw := []byte("same-password")
	p := DefaultParams()
	h1, err := Hash(pw, p)
	if err != nil {
		t.Fatalf("Hash 1: %v", err)
	}
	h2, err := Hash(pw, p)
	if err != nil {
		t.Fatalf("Hash 2: %v", err)
	}
	if h1 == h2 {
		t.Error("two hashes of same password must differ (random salt)")
	}
	if err := Verify(pw, h1); err != nil {
		t.Errorf("verify h1: %v", err)
	}
	if err := Verify(pw, h2); err != nil {
		t.Errorf("verify h2: %v", err)
	}
}

func TestHash_PasswordTooLong(t *testing.T) {
	pw := make([]byte, MaxPasswordLen+1)
	for i := range pw {
		pw[i] = 'A'
	}
	_, err := Hash(pw, DefaultParams())
	if !errors.Is(err, ErrPasswordTooLong) {
		t.Errorf("expected ErrPasswordTooLong, got %v", err)
	}
}

func TestVerify_PasswordTooLong(t *testing.T) {
	// First create a valid hash with a short password
	encoded, err := Hash([]byte("short"), DefaultParams())
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	// Now try to verify with an oversized password
	longPw := make([]byte, MaxPasswordLen+1)
	for i := range longPw {
		longPw[i] = 'B'
	}
	err = Verify(longPw, encoded)
	if !errors.Is(err, ErrPasswordTooLong) {
		t.Errorf("expected ErrPasswordTooLong for oversized verify input, got %v", err)
	}
}

func TestHash_MaxPasswordLenAccepted(t *testing.T) {
	pw := make([]byte, MaxPasswordLen)
	for i := range pw {
		pw[i] = 'C'
	}
	encoded, err := Hash(pw, DefaultParams())
	if err != nil {
		t.Fatalf("Hash at max length should succeed: %v", err)
	}
	if err := Verify(pw, encoded); err != nil {
		t.Errorf("Verify at max length should succeed: %v", err)
	}
}

func TestDecode_MalformedRecords(t *testing.T) {
	cases := []struct {
		name    string
		encoded string
		wantErr error
	}{
		{"empty", "", ErrMalformedRecord},
		{"too_few_segments", "$argon2id$v=19$m=65536,t=3,p=2$salt", ErrMalformedRecord},
		{"wrong_algo", "$bcrypt$v=19$m=65536,t=3,p=2$c2FsdA$aGFzaA", ErrUnsupportedAlgo},
		{"bad_version_prefix", "$argon2id$x=19$m=65536,t=3,p=2$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"unsupported_version", "$argon2id$v=99$m=65536,t=3,p=2$c2FsdA$aGFzaA", ErrUnsupportedAlgo},
		{"missing_param_key", "$argon2id$v=19$m=65536,t=3$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"zero_memory", "$argon2id$v=19$m=0,t=3,p=2$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"oversized_memory", "$argon2id$v=19$m=2097152,t=3,p=2$c2FsdA$aGFzaA", ErrInvalidParams},
		{"zero_iterations", "$argon2id$v=19$m=65536,t=0,p=2$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"zero_parallelism", "$argon2id$v=19$m=65536,t=3,p=0$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"empty_salt", "$argon2id$v=19$m=65536,t=3,p=2$$aGFzaA", ErrMalformedRecord},
		{"empty_hash", "$argon2id$v=19$m=65536,t=3,p=2$c2FsdA$", ErrMalformedRecord},
		{"invalid_base64_salt", "$argon2id$v=19$m=65536,t=3,p=2$!!!$aGFzaA", ErrMalformedRecord},
		{"invalid_base64_hash", "$argon2id$v=19$m=65536,t=3,p=2$c2FsdA$!!!", ErrMalformedRecord},
		{"exceeds_max_len", "$argon2id$v=19$m=65536,t=3,p=2$" + strings.Repeat("A", 2000) + "$hash", ErrMalformedRecord},
		{"parallelism_overflow_uint8", "$argon2id$v=19$m=65536,t=3,p=257$c2FsdA$aGFzaA", ErrInvalidParams},
		{"duplicate_param_key", "$argon2id$v=19$m=65536,t=3,p=2,m=65536$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"unknown_param_key", "$argon2id$v=19$m=65536,t=3,p=2,x=1$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"missing_equals_in_param", "$argon2id$v=19$m65536,t=3,p=2$c2FsdA$aGFzaA", ErrMalformedRecord},
		{"empty_param_key", "$argon2id$v=19$=65536,t=3,p=2$c2FsdA$aGFzaA", ErrMalformedRecord},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, _, err := Decode(tc.encoded)
			if err == nil {
				t.Fatalf("expected error %v, got nil", tc.wantErr)
			}
			if !errors.Is(err, tc.wantErr) {
				t.Errorf("expected errors.Is(err, %v), got %v", tc.wantErr, err)
			}
		})
	}
}

func TestVerify_MalformedReturnsError(t *testing.T) {
	err := Verify([]byte("pw"), "not-a-valid-hash")
	if err == nil {
		t.Fatal("expected error for malformed record")
	}
	if errors.Is(err, ErrMismatch) {
		t.Error("malformed record should not return ErrMismatch")
	}
}

func TestParamsValidate_Bounds(t *testing.T) {
	base := DefaultParams()

	bad := base
	bad.MemoryKiB = 0
	if err := bad.Validate(); !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams for zero memory, got %v", err)
	}

	bad = base
	bad.MemoryKiB = MaxMemoryKiB + 1
	if err := bad.Validate(); !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams for oversized memory, got %v", err)
	}

	bad = base
	bad.Iterations = MaxIterations + 1
	if err := bad.Validate(); !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams for oversized iterations, got %v", err)
	}

	bad = base
	bad.Parallelism = MaxParallelism + 1
	if err := bad.Validate(); !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams for oversized parallelism, got %v", err)
	}

	bad = base
	bad.SaltLen = 0
	if err := bad.Validate(); !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams for zero salt len, got %v", err)
	}

	bad = base
	bad.HashLen = MaxHashLen + 1
	if err := bad.Validate(); !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams for oversized hash len, got %v", err)
	}
}

func TestDefaultParams_Valid(t *testing.T) {
	if err := DefaultParams().Validate(); err != nil {
		t.Errorf("default params should be valid: %v", err)
	}
}

func TestHash_SelfDescribingFormat(t *testing.T) {
	encoded, err := Hash([]byte("test"), DefaultParams())
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if !strings.HasPrefix(encoded, "$argon2id$") {
		t.Errorf("encoded hash should start with $argon2id$, got %q", encoded)
	}
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 {
		t.Errorf("expected 6 dollar-separated segments, got %d", len(parts))
	}
}

func TestHash_RejectsInvalidParams(t *testing.T) {
	bad := DefaultParams()
	bad.MemoryKiB = 0
	_, err := Hash([]byte("pw"), bad)
	if !errors.Is(err, ErrInvalidParams) {
		t.Errorf("expected ErrInvalidParams from Hash with bad params, got %v", err)
	}
}
