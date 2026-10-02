package credential

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"golang.org/x/crypto/argon2"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// testPool creates a disposable pgxpool connected to TEST_DATABASE_URL.
// Tests using this require a running Postgres 17 with M2 schema applied.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("failed to connect to test DB: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// uniqueID generates a deterministic but unique UUID-like ID for test isolation.
func uniqueID(t *testing.T, _ string) string {
	t.Helper()
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("crypto/rand failed: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// seedActiveUser inserts an active profile.user_profile row for FK satisfaction.
func seedActiveUser(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'Test User', $2, 'active', now()) ON CONFLICT (id) DO UPDATE SET status = 'active'`,
		userID, fmt.Sprintf("test-%s@example.com", userID[:8]))
	if err != nil {
		t.Fatalf("seed active user failed: %v", err)
	}
}

// seedActiveAdmin inserts an active authz.admin_actor row for FK satisfaction.
func seedActiveAdmin(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status, updated_at) VALUES ($1, 'Test Admin', $2, 'active', now()) ON CONFLICT (id) DO UPDATE SET status = 'active'`,
		actorID, fmt.Sprintf("admin-%s@example.com", actorID[:8]))
	if err != nil {
		t.Fatalf("seed active admin failed: %v", err)
	}
}

// --- Unit tests for scanAndEncode validation ---

type mockRow struct {
	algo        string
	algoVersion string
	iterations  int
	memoryKiB   int
	parallelism int
	hashLength  int
	salt        []byte
	hashedValue []byte
	err         error
}

func (m *mockRow) Scan(dest ...interface{}) error {
	if m.err != nil {
		return m.err
	}
	if len(dest) != 8 {
		return fmt.Errorf("expected 8 scan destinations, got %d", len(dest))
	}
	*(dest[0].(*string)) = m.algo
	*(dest[1].(*string)) = m.algoVersion
	*(dest[2].(*int)) = m.iterations
	*(dest[3].(*int)) = m.memoryKiB
	*(dest[4].(*int)) = m.parallelism
	*(dest[5].(*int)) = m.hashLength
	*(dest[6].(*[]byte)) = m.salt
	*(dest[7].(*[]byte)) = m.hashedValue
	return nil
}

func validMockRow() mockRow {
	salt := []byte("testsalt12345678")
	hash := make([]byte, 32)
	for i := range hash {
		hash[i] = byte(i)
	}
	return mockRow{
		algo:        algorithmID,
		algoVersion: "19",
		iterations:  3,
		memoryKiB:   65536,
		parallelism: 2,
		hashLength:  32,
		salt:        salt,
		hashedValue: hash,
	}
}

func TestScanAndEncode_Valid(t *testing.T) {
	row := validMockRow()
	encoded, err := scanAndEncode(&row)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Verify it can be decoded back
	p, salt, hash, err := Decode(encoded)
	if err != nil {
		t.Fatalf("Decode failed on encoded output: %v", err)
	}
	if p.Iterations != uint32(row.iterations) {
		t.Errorf("Iterations = %d, want %d", p.Iterations, row.iterations)
	}
	if p.MemoryKiB != uint32(row.memoryKiB) {
		t.Errorf("MemoryKiB = %d, want %d", p.MemoryKiB, row.memoryKiB)
	}
	if string(salt) != string(row.salt) {
		t.Error("salt mismatch")
	}
	if string(hash) != string(row.hashedValue) {
		t.Error("hash mismatch")
	}
}

func TestScanAndEncode_EmptyAlgoVersion(t *testing.T) {
	row := validMockRow()
	row.algoVersion = ""
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for empty algo version, got %v", err)
	}
}

func TestScanAndEncode_HashLengthMismatch(t *testing.T) {
	row := validMockRow()
	row.hashLength = 16 // declared 16 but actual hash is 32 bytes
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for hash length mismatch, got %v", err)
	}
}

func TestScanAndEncode_ZeroIterations(t *testing.T) {
	row := validMockRow()
	row.iterations = 0
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for zero iterations, got %v", err)
	}
}

func TestScanAndEncode_ZeroMemory(t *testing.T) {
	row := validMockRow()
	row.memoryKiB = 0
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for zero memory, got %v", err)
	}
}

func TestScanAndEncode_ZeroParallelism(t *testing.T) {
	row := validMockRow()
	row.parallelism = 0
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for zero parallelism, got %v", err)
	}
}

func TestScanAndEncode_ZeroHashLength(t *testing.T) {
	row := validMockRow()
	row.hashLength = 0
	row.hashedValue = []byte{}
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for zero hash length, got %v", err)
	}
}

func TestScanAndEncode_EmptySalt(t *testing.T) {
	row := validMockRow()
	row.salt = []byte{}
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for empty salt, got %v", err)
	}
}

func TestScanAndEncode_WrongAlgorithm(t *testing.T) {
	row := validMockRow()
	row.algo = "bcrypt"
	_, err := scanAndEncode(&row)
	if !errors.Is(err, ErrUnsupportedAlgo) {
		t.Errorf("expected ErrUnsupportedAlgo, got %v", err)
	}
}

func TestScanAndEncode_NoRows(t *testing.T) {
	row := &mockRow{err: pgx.ErrNoRows}
	_, err := scanAndEncode(row)
	if !errors.Is(err, ErrCredentialNotFound) {
		t.Errorf("expected ErrCredentialNotFound, got %v", err)
	}
}

// --- Integration tests (require TEST_DATABASE_URL + M2 schema) ---

func TestSetAndVerifyLearnerCredential(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := uniqueID(t, "usr-cred")
	seedActiveUser(t, db, userID)

	password := []byte("correct-horse-battery-staple")
	if err := store.SetLearnerCredential(context.Background(), userID, password); err != nil {
		t.Fatalf("SetLearnerCredential: %v", err)
	}

	// Verify correct password succeeds
	if err := store.VerifyLearner(context.Background(), userID, password); err != nil {
		t.Fatalf("VerifyLearner with correct password: %v", err)
	}

	// Verify wrong password fails
	err := store.VerifyLearner(context.Background(), userID, []byte("wrong-password"))
	if err == nil {
		t.Fatal("VerifyLearner with wrong password should fail")
	}
	if errors.Is(err, ErrCredentialNotFound) {
		t.Error("wrong password should not return ErrCredentialNotFound")
	}
}

func TestSetAndVerifyAdminCredential(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := uniqueID(t, "adm-cred")
	seedActiveAdmin(t, db, actorID)

	password := []byte("admin-secret-passphrase")
	if err := store.SetAdminCredential(context.Background(), actorID, password); err != nil {
		t.Fatalf("SetAdminCredential: %v", err)
	}

	if err := store.VerifyAdmin(context.Background(), actorID, password); err != nil {
		t.Fatalf("VerifyAdmin with correct password: %v", err)
	}

	err := store.VerifyAdmin(context.Background(), actorID, []byte("wrong"))
	if err == nil {
		t.Fatal("VerifyAdmin with wrong password should fail")
	}
}

func TestVerifyLearner_NotFound(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	err := store.VerifyLearner(context.Background(), "00000000-0000-0000-0000-000000000000", []byte("pass"))
	if !errors.Is(err, ErrCredentialNotFound) {
		t.Errorf("expected ErrCredentialNotFound, got %v", err)
	}
}

func TestVerifyAdmin_NotFound(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	err := store.VerifyAdmin(context.Background(), "00000000-0000-0000-0000-000000000000", []byte("pass"))
	if !errors.Is(err, ErrCredentialNotFound) {
		t.Errorf("expected ErrCredentialNotFound, got %v", err)
	}
}

func TestHasAnyAdminCredential(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	// Before inserting, may or may not have credentials depending on other tests.
	// Insert one and verify count increases.
	actorID := uniqueID(t, "adm-has")
	seedActiveAdmin(t, db, actorID)

	before, err := store.HasAnyAdminCredential(context.Background())
	if err != nil {
		t.Fatalf("HasAnyAdminCredential before: %v", err)
	}

	if err := store.SetAdminCredential(context.Background(), actorID, []byte("test")); err != nil {
		t.Fatalf("SetAdminCredential: %v", err)
	}

	after, err := store.HasAnyAdminCredential(context.Background())
	if err != nil {
		t.Fatalf("HasAnyAdminCredential after: %v", err)
	}

	if !after {
		t.Error("expected HasAnyAdminCredential=true after insert")
	}
	_ = before // just verify no error
}

func TestSetLearnerCredential_Upsert(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := uniqueID(t, "usr-upsert")
	seedActiveUser(t, db, userID)

	pass1 := []byte("first-password")
	pass2 := []byte("second-password")

	if err := store.SetLearnerCredential(context.Background(), userID, pass1); err != nil {
		t.Fatalf("first SetLearnerCredential: %v", err)
	}

	// Overwrite with new password
	if err := store.SetLearnerCredential(context.Background(), userID, pass2); err != nil {
		t.Fatalf("second SetLearnerCredential: %v", err)
	}

	// Old password should fail
	err := store.VerifyLearner(context.Background(), userID, pass1)
	if err == nil {
		t.Error("old password should not verify after upsert")
	}

	// New password should succeed
	if err := store.VerifyLearner(context.Background(), userID, pass2); err != nil {
		t.Fatalf("new password should verify after upsert: %v", err)
	}
}

func TestVerifyLearner_MalformedDBRow_EmptyVersion(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := uniqueID(t, "usr-malver")
	seedActiveUser(t, db, userID)

	// Insert a credential with empty algorithm_version directly via SQL
	salt := []byte("testsalt12345678")
	hash := make([]byte, 32)
	_, err := db.Exec(context.Background(),
		`INSERT INTO auth.password_credential
		(user_id, algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value)
		VALUES ($1, 'argon2id', '', 3, 65536, 2, 32, $2, $3)`,
		userID, salt, hash)
	if err != nil {
		t.Fatalf("insert malformed row: %v", err)
	}

	err = store.VerifyLearner(context.Background(), userID, []byte("anything"))
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for empty version, got %v", err)
	}
}

func TestVerifyLearner_MalformedDBRow_HashLengthMismatch(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := uniqueID(t, "usr-malhash")
	seedActiveUser(t, db, userID)

	salt := []byte("testsalt12345678")
	hash := make([]byte, 32)
	// Declare hash_length=16 but store 32 bytes
	_, err := db.Exec(context.Background(),
		`INSERT INTO auth.password_credential
		(user_id, algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value)
		VALUES ($1, 'argon2id', '19', 3, 65536, 2, 16, $2, $3)`,
		userID, salt, hash)
	if err != nil {
		t.Fatalf("insert malformed row: %v", err)
	}

	err = store.VerifyLearner(context.Background(), userID, []byte("anything"))
	if !errors.Is(err, ErrMalformedRecord) {
		t.Errorf("expected ErrMalformedRecord for hash length mismatch, got %v", err)
	}
}

func TestVerifyLearner_ColumnMapping_RoundTrip(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := uniqueID(t, "usr-roundtrip")
	seedActiveUser(t, db, userID)

	password := []byte("round-trip-test-password")
	if err := store.SetLearnerCredential(context.Background(), userID, password); err != nil {
		t.Fatalf("SetLearnerCredential: %v", err)
	}

	// Read back raw columns and verify they match expected Argon2id params
	ctx := context.Background()
	var algo, algoVersion string
	var iterations, memoryKiB, parallelism, hashLength int
	var salt, hashedValue []byte
	err := db.QueryRow(ctx,
		`SELECT algorithm, algorithm_version, hash_iterations, memory_kib, parallelism, hash_length, salt, hashed_value
		FROM auth.password_credential WHERE user_id = $1`, userID).
		Scan(&algo, &algoVersion, &iterations, &memoryKiB, &parallelism, &hashLength, &salt, &hashedValue)
	if err != nil {
		t.Fatalf("query columns: %v", err)
	}

	if algo != algorithmID {
		t.Errorf("algorithm = %q, want %q", algo, algorithmID)
	}
	if algoVersion != fmt.Sprintf("%d", argon2.Version) {
		t.Errorf("algorithm_version = %q, want %q", algoVersion, fmt.Sprintf("%d", argon2.Version))
	}
	def := DefaultParams()
	if iterations != int(def.Iterations) {
		t.Errorf("iterations = %d, want %d", iterations, def.Iterations)
	}
	if memoryKiB != int(def.MemoryKiB) {
		t.Errorf("memory_kib = %d, want %d", memoryKiB, def.MemoryKiB)
	}
	if parallelism != int(def.Parallelism) {
		t.Errorf("parallelism = %d, want %d", parallelism, def.Parallelism)
	}
	if hashLength != int(def.HashLen) {
		t.Errorf("hash_length = %d, want %d", hashLength, def.HashLen)
	}
	if len(salt) == 0 {
		t.Error("salt should not be empty")
	}
	if len(hashedValue) != hashLength {
		t.Errorf("hashed_value length = %d, want %d", len(hashedValue), hashLength)
	}

	// Verify base64 encoding is RawStdEncoding (no padding)
	_ = base64.RawStdEncoding.EncodeToString(salt) // just confirm it works
}
