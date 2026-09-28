// Package credential provides first-party Argon2id password hashing and verification
// for new Go-native credentials. This is NOT a Keycloak legacy verifier.
package credential

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Algorithm identifier stored in encoded records.
const algorithmID = "argon2id"

// Default parameters for new hashes. Conservative starting values;
// production should benchmark on Oracle A1 per canonical spec.
const (
	DefaultMemoryKiB   = 64 * 1024 // 64 MiB
	DefaultIterations  = 3
	DefaultParallelism = 2
	DefaultSaltLen     = 16
	DefaultHashLen     = 32
)

// Parameter bounds to prevent DoS via oversized hash requests.
// Caps are aligned to ~3× default budget (<=128MiB, <=6 rounds, <=4 lanes)
// to allow modest tuning while bounding worst-case cost on ARM64 targets.
const (
	MaxMemoryKiB   = 128 * 1024 // 128 MiB
	MaxIterations  = 6
	MaxParallelism = 4
	MaxHashLen     = 64
	MaxSaltLen     = 64
	MaxEncodedLen  = 512
	MaxPasswordLen = 1024 // bytes; rejects unbounded attacker input before work
)

var (
	ErrMalformedRecord = errors.New("credential: malformed record")
	ErrUnsupportedAlgo = errors.New("credential: unsupported algorithm")
	ErrInvalidParams   = errors.New("credential: invalid parameters")
	ErrMismatch        = errors.New("credential: password mismatch")
	ErrPasswordTooLong = errors.New("credential: password exceeds max length")
)

// Params holds Argon2id hashing parameters.
type Params struct {
	MemoryKiB   uint32
	Iterations  uint32
	Parallelism uint8
	SaltLen     int
	HashLen     uint32
}

// DefaultParams returns recommended parameters for new hashes.
func DefaultParams() Params {
	return Params{
		MemoryKiB:   DefaultMemoryKiB,
		Iterations:  DefaultIterations,
		Parallelism: DefaultParallelism,
		SaltLen:     DefaultSaltLen,
		HashLen:     DefaultHashLen,
	}
}

// Validate checks parameter bounds. Returns ErrInvalidParams if out of range.
func (p Params) Validate() error {
	if p.MemoryKiB == 0 || p.MemoryKiB > MaxMemoryKiB {
		return fmt.Errorf("%w: memory_kib %d out of range [1, %d]", ErrInvalidParams, p.MemoryKiB, MaxMemoryKiB)
	}
	if p.Iterations == 0 || p.Iterations > MaxIterations {
		return fmt.Errorf("%w: iterations %d out of range [1, %d]", ErrInvalidParams, p.Iterations, MaxIterations)
	}
	if p.Parallelism == 0 || p.Parallelism > MaxParallelism {
		return fmt.Errorf("%w: parallelism %d out of range [1, %d]", ErrInvalidParams, p.Parallelism, MaxParallelism)
	}
	if p.SaltLen <= 0 || p.SaltLen > MaxSaltLen {
		return fmt.Errorf("%w: salt_len %d out of range [1, %d]", ErrInvalidParams, p.SaltLen, MaxSaltLen)
	}
	if p.HashLen == 0 || p.HashLen > MaxHashLen {
		return fmt.Errorf("%w: hash_len %d out of range [1, %d]", ErrInvalidParams, p.HashLen, MaxHashLen)
	}
	return nil
}

// Hash generates an Argon2id hash of the password with random salt and returns
// a self-describing encoded string: $argon2id$v=<ver>$m=<mem>,t=<iter>,p=<par>$<salt_b64>$<hash_b64>
// Rejects passwords longer than MaxPasswordLen before any allocation or work.
func Hash(password []byte, p Params) (string, error) {
	if len(password) > MaxPasswordLen {
		return "", ErrPasswordTooLong
	}
	if err := p.Validate(); err != nil {
		return "", err
	}

	salt := make([]byte, p.SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("credential: generate salt: %w", err)
	}

	hash := argon2.IDKey(password, salt, p.Iterations, p.MemoryKiB, p.Parallelism, p.HashLen)

	saltB64 := base64.RawStdEncoding.EncodeToString(salt)
	hashB64 := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf("$%s$v=%d$m=%d,t=%d,p=%d$%s$%s",
		algorithmID, argon2.Version, p.MemoryKiB, p.Iterations, p.Parallelism, saltB64, hashB64)
	return encoded, nil
}

// Verify compares a password against an encoded hash record using constant-time
// comparison. Returns nil on match, ErrMismatch on wrong password, or other
// errors for malformed/unsupported records. Rejects oversized passwords before work.
func Verify(password []byte, encoded string) error {
	if len(password) > MaxPasswordLen {
		return ErrPasswordTooLong
	}
	p, salt, expectedHash, err := Decode(encoded)
	if err != nil {
		return err
	}

	computed := argon2.IDKey(password, salt, p.Iterations, p.MemoryKiB, p.Parallelism, uint32(len(expectedHash)))

	if subtle.ConstantTimeCompare(computed, expectedHash) != 1 {
		return ErrMismatch
	}
	return nil
}

// Decode parses a self-describing encoded hash string into its components.
// Validates algorithm, version, and parameter bounds.
func Decode(encoded string) (Params, []byte, []byte, error) {
	if len(encoded) > MaxEncodedLen {
		return Params{}, nil, nil, fmt.Errorf("%w: record exceeds max length", ErrMalformedRecord)
	}

	parts := strings.Split(encoded, "$")
	// Expected: ["", "argon2id", "v=19", "m=65536,t=3,p=2", "<salt>", "<hash>"]
	if len(parts) != 6 || parts[0] != "" {
		return Params{}, nil, nil, fmt.Errorf("%w: expected 6 dollar-separated segments", ErrMalformedRecord)
	}

	if parts[1] != algorithmID {
		return Params{}, nil, nil, fmt.Errorf("%w: got %q, want %q", ErrUnsupportedAlgo, parts[1], algorithmID)
	}

	version, err := parseVersion(parts[2])
	if err != nil {
		return Params{}, nil, nil, err
	}
	if version != argon2.Version {
		return Params{}, nil, nil, fmt.Errorf("%w: version %d, want %d", ErrUnsupportedAlgo, version, argon2.Version)
	}

	p, err := parseParams(parts[3])
	if err != nil {
		return Params{}, nil, nil, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return Params{}, nil, nil, fmt.Errorf("%w: invalid salt encoding: %v", ErrMalformedRecord, err)
	}
	if len(salt) == 0 {
		return Params{}, nil, nil, fmt.Errorf("%w: empty salt", ErrMalformedRecord)
	}

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return Params{}, nil, nil, fmt.Errorf("%w: invalid hash encoding: %v", ErrMalformedRecord, err)
	}
	if len(hash) == 0 {
		return Params{}, nil, nil, fmt.Errorf("%w: empty hash", ErrMalformedRecord)
	}

	// Derive SaltLen/HashLen from actual decoded bytes; PHC format does not store them.
	p.SaltLen = len(salt)
	p.HashLen = uint32(len(hash))
	if err := p.Validate(); err != nil {
		return Params{}, nil, nil, err
	}

	return p, salt, hash, nil
}

func parseVersion(s string) (uint32, error) {
	if !strings.HasPrefix(s, "v=") {
		return 0, fmt.Errorf("%w: missing v= prefix in version segment", ErrMalformedRecord)
	}
	v, err := strconv.ParseUint(s[2:], 10, 32)
	if err != nil {
		return 0, fmt.Errorf("%w: invalid version number: %v", ErrMalformedRecord, err)
	}
	return uint32(v), nil
}

func parseParams(s string) (Params, error) {
	var p Params
	seen := map[string]bool{}
	for _, kv := range strings.Split(s, ",") {
		eq := strings.IndexByte(kv, '=')
		if eq < 0 {
			return Params{}, fmt.Errorf("%w: missing '=' in param segment %q", ErrMalformedRecord, kv)
		}
		key, val := kv[:eq], kv[eq+1:]
		if key == "" {
			return Params{}, fmt.Errorf("%w: empty param key", ErrMalformedRecord)
		}
		if seen[key] {
			return Params{}, fmt.Errorf("%w: duplicate param key %q", ErrMalformedRecord, key)
		}
		seen[key] = true

		n, err := strconv.ParseUint(val, 10, 64)
		if err != nil {
			return Params{}, fmt.Errorf("%w: invalid param value %q=%q: %v", ErrMalformedRecord, key, val, err)
		}

		switch key {
		case "m":
			if n > uint64(MaxMemoryKiB) {
				return Params{}, fmt.Errorf("%w: memory_kib %d exceeds max %d", ErrInvalidParams, n, MaxMemoryKiB)
			}
			p.MemoryKiB = uint32(n)
		case "t":
			if n > uint64(MaxIterations) {
				return Params{}, fmt.Errorf("%w: iterations %d exceeds max %d", ErrInvalidParams, n, MaxIterations)
			}
			p.Iterations = uint32(n)
		case "p":
			if n > uint64(MaxParallelism) {
				return Params{}, fmt.Errorf("%w: parallelism %d exceeds max %d", ErrInvalidParams, n, MaxParallelism)
			}
			p.Parallelism = uint8(n)
		default:
			return Params{}, fmt.Errorf("%w: unknown param key %q", ErrMalformedRecord, key)
		}
	}
	if p.MemoryKiB == 0 || p.Iterations == 0 || p.Parallelism == 0 {
		return Params{}, fmt.Errorf("%w: missing required params (m,t,p)", ErrMalformedRecord)
	}
	return p, nil
}
