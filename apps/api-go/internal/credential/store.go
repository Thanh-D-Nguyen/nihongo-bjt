// Package credential provides first-party Argon2id password hashing, verification,
// and persistence against auth.password_credential and auth.admin_password_credential.
package credential

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

// ErrCredentialNotFound is returned when no credential row exists for the given user/actor.
var ErrCredentialNotFound = errors.New("credential: not found")

// Store provides credential read/write against PostgreSQL.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a credential store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// SetLearnerCredential hashes the password with current defaults and upserts
// into auth.password_credential. The encoded PHC string is decomposed into
// individual DB columns per M2 schema. Returns ErrPasswordTooLong if input
// exceeds MaxPasswordLen before any work.
func (s *Store) SetLearnerCredential(ctx context.Context, userID string, password []byte) error {
	encoded, err := Hash(password, DefaultParams())
	if err != nil {
		return fmt.Errorf("credential: hash learner: %w", err)
	}
	p, salt, hash, err := Decode(encoded)
	if err != nil {
		return fmt.Errorf("credential: decode learner: %w", err)
	}
	return s.upsertLearner(ctx, userID, p, salt, hash)
}

// SetAdminCredential hashes the password with current defaults and upserts
// into auth.admin_password_credential. Same decomposition as learner.
func (s *Store) SetAdminCredential(ctx context.Context, actorID string, password []byte) error {
	encoded, err := Hash(password, DefaultParams())
	if err != nil {
		return fmt.Errorf("credential: hash admin: %w", err)
	}
	p, salt, hash, err := Decode(encoded)
	if err != nil {
		return fmt.Errorf("credential: decode admin: %w", err)
	}
	return s.upsertAdmin(ctx, actorID, p, salt, hash)
}

// VerifyLearner loads the credential for userID, verifies the password, and returns nil on match.
// Returns ErrCredentialNotFound if no row exists, ErrMismatch on wrong password,
// or wrapped errors for malformed records / disabled accounts.
func (s *Store) VerifyLearner(ctx context.Context, userID string, password []byte) error {
	encoded, err := s.loadLearnerEncoded(ctx, userID)
	if err != nil {
		return err
	}
	if err := Verify(password, encoded); err != nil {
		return fmt.Errorf("credential: verify learner: %w", err)
	}
	return nil
}

// VerifyAdmin loads the credential for actorID, verifies the password, and returns nil on match.
func (s *Store) VerifyAdmin(ctx context.Context, actorID string, password []byte) error {
	encoded, err := s.loadAdminEncoded(ctx, actorID)
	if err != nil {
		return err
	}
	if err := Verify(password, encoded); err != nil {
		return fmt.Errorf("credential: verify admin: %w", err)
	}
	return nil
}

// HasAnyAdminCredential returns true if at least one admin_password_credential row exists.
// Used by bootstrap to refuse re-creation when an admin already has credentials.
func (s *Store) HasAnyAdminCredential(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var count int
	err := s.db.QueryRow(ctx, `SELECT count(*) FROM auth.admin_password_credential`).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("credential: count admin: %w", err)
	}
	return count > 0, nil
}

// SetLearnerCredentialTx hashes and stores a learner password credential within
// an existing transaction. This is required when the user profile row is created
// in the same transaction and not yet visible outside it (FK constraint).
func (s *Store) SetLearnerCredentialTx(ctx context.Context, tx pgx.Tx, userID string, password []byte) error {
	encoded, err := Hash(password, DefaultParams())
	if err != nil {
		return fmt.Errorf("credential: hash learner: %w", err)
	}
	p, salt, hash, err := Decode(encoded)
	if err != nil {
		return fmt.Errorf("credential: decode learner: %w", err)
	}
	return s.upsertLearnerTx(ctx, tx, userID, p, salt, hash)
}

func (s *Store) upsertLearnerTx(ctx context.Context, tx pgx.Tx, userID string, p Params, salt, hash []byte) error {
	const q = `INSERT INTO auth.password_credential
		(user_id, algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id) DO UPDATE SET
			algorithm = EXCLUDED.algorithm,
			algorithm_version = EXCLUDED.algorithm_version,
			hash_iterations = EXCLUDED.hash_iterations,
			memory_kib = EXCLUDED.memory_kib,
			parallelism = EXCLUDED.parallelism,
			hash_length = EXCLUDED.hash_length,
			salt = EXCLUDED.salt,
			hashed_value = EXCLUDED.hashed_value,
			updated_at = now()`
	_, err := tx.Exec(ctx, q,
		userID, algorithmID, fmt.Sprintf("%d", argon2.Version),
		int(p.Iterations), int(p.MemoryKiB), int(p.Parallelism), int(p.HashLen),
		salt, hash)
	if err != nil {
		return fmt.Errorf("credential: upsert learner tx: %w", err)
	}
	return nil
}

func (s *Store) upsertLearner(ctx context.Context, userID string, p Params, salt, hash []byte) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `INSERT INTO auth.password_credential
		(user_id, algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id) DO UPDATE SET
			algorithm = EXCLUDED.algorithm,
			algorithm_version = EXCLUDED.algorithm_version,
			hash_iterations = EXCLUDED.hash_iterations,
			memory_kib = EXCLUDED.memory_kib,
			parallelism = EXCLUDED.parallelism,
			hash_length = EXCLUDED.hash_length,
			salt = EXCLUDED.salt,
			hashed_value = EXCLUDED.hashed_value,
			updated_at = now()`
	_, err := s.db.Exec(ctx, q,
		userID, algorithmID, fmt.Sprintf("%d", argon2.Version),
		int(p.Iterations), int(p.MemoryKiB), int(p.Parallelism), int(p.HashLen),
		salt, hash)
	if err != nil {
		return fmt.Errorf("credential: upsert learner: %w", err)
	}
	return nil
}

// SetAdminCredentialTx hashes and stores an admin password credential within
// an existing transaction. This is required when the admin actor row is created
// in the same transaction and not yet visible outside it (FK constraint).
func (s *Store) SetAdminCredentialTx(ctx context.Context, tx pgx.Tx, actorID string, password []byte) error {
	encoded, err := Hash(password, DefaultParams())
	if err != nil {
		return fmt.Errorf("credential: hash admin: %w", err)
	}
	p, salt, hash, err := Decode(encoded)
	if err != nil {
		return fmt.Errorf("credential: decode admin: %w", err)
	}
	return s.upsertAdminTx(ctx, tx, actorID, p, salt, hash)
}

func (s *Store) upsertAdminTx(ctx context.Context, tx pgx.Tx, actorID string, p Params, salt, hash []byte) error {
	const q = `INSERT INTO auth.admin_password_credential
		(actor_id, algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
		ON CONFLICT (actor_id) DO UPDATE SET
			algorithm = EXCLUDED.algorithm,
			algorithm_version = EXCLUDED.algorithm_version,
			hash_iterations = EXCLUDED.hash_iterations,
			memory_kib = EXCLUDED.memory_kib,
			parallelism = EXCLUDED.parallelism,
			hash_length = EXCLUDED.hash_length,
			salt = EXCLUDED.salt,
			hashed_value = EXCLUDED.hashed_value,
			updated_at = now()`
	_, err := tx.Exec(ctx, q,
		actorID, algorithmID, fmt.Sprintf("%d", argon2.Version),
		int(p.Iterations), int(p.MemoryKiB), int(p.Parallelism), int(p.HashLen),
		salt, hash)
	if err != nil {
		return fmt.Errorf("credential: upsert admin tx: %w", err)
	}
	return nil
}

func (s *Store) upsertAdmin(ctx context.Context, actorID string, p Params, salt, hash []byte) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `INSERT INTO auth.admin_password_credential
		(actor_id, algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
		ON CONFLICT (actor_id) DO UPDATE SET
			algorithm = EXCLUDED.algorithm,
			algorithm_version = EXCLUDED.algorithm_version,
			hash_iterations = EXCLUDED.hash_iterations,
			memory_kib = EXCLUDED.memory_kib,
			parallelism = EXCLUDED.parallelism,
			hash_length = EXCLUDED.hash_length,
			salt = EXCLUDED.salt,
			hashed_value = EXCLUDED.hashed_value,
			updated_at = now()`
	_, err := s.db.Exec(ctx, q,
		actorID, algorithmID, fmt.Sprintf("%d", argon2.Version),
		int(p.Iterations), int(p.MemoryKiB), int(p.Parallelism), int(p.HashLen),
		salt, hash)
	if err != nil {
		return fmt.Errorf("credential: upsert admin: %w", err)
	}
	return nil
}

// loadLearnerEncoded reconstructs the PHC-encoded string from DB columns.
func (s *Store) loadLearnerEncoded(ctx context.Context, userID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `SELECT algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value
		FROM auth.password_credential WHERE user_id = $1`
	row := s.db.QueryRow(ctx, q, userID)
	return scanAndEncode(row)
}

// loadAdminEncoded reconstructs the PHC-encoded string from DB columns.
func (s *Store) loadAdminEncoded(ctx context.Context, actorID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	const q = `SELECT algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value
		FROM auth.admin_password_credential WHERE actor_id = $1`
	row := s.db.QueryRow(ctx, q, actorID)
	return scanAndEncode(row)
}

// scanAndEncode reads credential columns and reconstructs a PHC-encoded string
// compatible with Verify(). This bridges the columnar DB storage with the
// self-describing PHC format expected by the argon2 package.
func scanAndEncode(row pgx.Row) (string, error) {
	var algo, algoVersion string
	var iterations, memoryKiB, parallelism, hashLength int
	var salt, hashedValue []byte
	err := row.Scan(&algo, &algoVersion, &iterations, &memoryKiB, &parallelism, &hashLength, &salt, &hashedValue)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrCredentialNotFound
		}
		return "", fmt.Errorf("credential: load: %w", err)
	}
	if algo != algorithmID {
		return "", fmt.Errorf("%w: stored algorithm %q, want %q", ErrUnsupportedAlgo, algo, algorithmID)
	}
	// Reject empty or missing algorithm_version. M2 schema allows NULL but we
	// require an explicit version to prevent silent defaulting to a different
	// Argon2 version than what was used at hash time.
	if algoVersion == "" {
		return "", fmt.Errorf("%w: empty algorithm_version", ErrMalformedRecord)
	}
	// Validate hash_length consistency: declared column must match actual bytes.
	if len(hashedValue) != hashLength {
		return "", fmt.Errorf("%w: hash_length=%d but hashed_value has %d bytes",
			ErrMalformedRecord, hashLength, len(hashedValue))
	}
	// Reject non-positive parameters (corrupted or tampered rows).
	if iterations <= 0 || memoryKiB <= 0 || parallelism <= 0 || hashLength <= 0 {
		return "", fmt.Errorf("%w: non-positive params m=%d t=%d p=%d len=%d",
			ErrMalformedRecord, memoryKiB, iterations, parallelism, hashLength)
	}
	if len(salt) == 0 {
		return "", fmt.Errorf("%w: empty salt", ErrMalformedRecord)
	}
	// Reconstruct PHC: $argon2id$v=<ver>$m=<mem>,t=<iter>,p=<par>$<salt_b64>$<hash_b64>
	saltB64 := base64.RawStdEncoding.EncodeToString(salt)
	hashB64 := base64.RawStdEncoding.EncodeToString(hashedValue)
	encoded := fmt.Sprintf("$%s$v=%s$m=%d,t=%d,p=%d$%s$%s",
		algo, algoVersion, memoryKiB, iterations, parallelism, saltB64, hashB64)
	return encoded, nil
}
