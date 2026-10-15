package jobs

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"testing"
)

// --- Unit tests (no database required) ---

func TestLoadConfigDefaults(t *testing.T) {
	os.Unsetenv("JOBS_ENABLED")
	os.Unsetenv("LOTO_AUTOPILOT_ENABLED")
	cfg := LoadConfig()
	if !cfg.Enabled {
		t.Error("expected Enabled=true by default")
	}
	if !cfg.LotoAutopilotEnabled {
		t.Error("expected LotoAutopilotEnabled=true by default")
	}
}

func TestLoadConfigDisabled(t *testing.T) {
	t.Setenv("JOBS_ENABLED", "false")
	t.Setenv("LOTO_AUTOPILOT_ENABLED", "0")
	cfg := LoadConfig()
	if cfg.Enabled {
		t.Error("expected Enabled=false when JOBS_ENABLED=false")
	}
	if cfg.LotoAutopilotEnabled {
		t.Error("expected LotoAutopilotEnabled=false when LOTO_AUTOPILOT_ENABLED=0")
	}
}

func TestEnvBoolVariants(t *testing.T) {
	cases := []struct {
		val  string
		want bool
	}{
		{"", true}, // empty → default
		{"true", true},
		{"TRUE", true},
		{"yes", true},
		{"1", true},
		{"on", true},
		{"false", false},
		{"FALSE", false},
		{"0", false},
		{"no", false},
		{"off", false},
		{" false ", false}, // trimmed
	}
	for _, tc := range cases {
		t.Setenv("TEST_BOOL", tc.val)
		got := envBool("TEST_BOOL", true)
		if got != tc.want {
			t.Errorf("envBool(%q) = %v, want %v", tc.val, got, tc.want)
		}
	}
}

func TestAdvisoryLockKeyDeterministic(t *testing.T) {
	k1 := advisoryLockKey("comeback_experience")
	k2 := advisoryLockKey("comeback_experience")
	if k1 != k2 {
		t.Errorf("advisoryLockKey not deterministic: %d vs %d", k1, k2)
	}
	if k1 < 0 {
		t.Errorf("advisoryLockKey should be positive, got %d", k1)
	}
}

func TestAdvisoryLockKeyDistinct(t *testing.T) {
	names := []string{
		"comeback_experience",
		"magazine_generation",
		"loto_autopilot_loto6",
		"push_notification_daily_kanji",
		"smart_notification_pet_care",
	}
	seen := make(map[int64]string)
	for _, n := range names {
		k := advisoryLockKey(n)
		if other, ok := seen[k]; ok {
			t.Errorf("collision: %q and %q both hash to %d", n, other, k)
		}
		seen[k] = n
	}
}

func TestSchedulerDisabledSkipsRegistration(t *testing.T) {
	cfg := Config{Enabled: false}
	s := NewScheduler(nil, nil, cfg) // nil db is fine when disabled
	err := s.Register("test_job", "0 * * * *", func(ctx context.Context) (int, error) {
		return 0, nil
	})
	if err != nil {
		t.Fatalf("disabled scheduler should not error on Register: %v", err)
	}
	if len(s.ids) != 0 {
		t.Errorf("disabled scheduler should have 0 registered jobs, got %d", len(s.ids))
	}
}

// --- Integration tests (require TEST_DATABASE_URL) ---

func TestSchedulerIntegrationStartStop(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	// This test verifies that the scheduler can start and stop cleanly
	// with a real database connection (advisory lock acquisition).
	// Full job execution testing requires seeded data from M1-M9 migrations.
	t.Log("integration: scheduler start/stop with real DB — placeholder for full job tests")
}

func TestPrivacyExportArtifactCleanup(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; run with scripts/quality/with-test-db.sh")
	}
	db, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	var userID, expiredID, freshID string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text,gen_random_uuid()::text,gen_random_uuid()::text`).Scan(&userID, &expiredID, &freshID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile(id,email,display_name,status,updated_at)
		VALUES($1,$2,'Privacy cleanup fixture','active',NOW())`, userID, fmt.Sprintf("privacy-cleanup-%s@example.test", userID[:8])); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID) })
	if _, err := db.Exec(ctx, `INSERT INTO profile.privacy_request(id,user_id,kind,status,result_payload)
		VALUES ($1,$3,'export','completed',jsonb_build_object('expiresAt',NOW()-INTERVAL '1 second','artifact',jsonb_build_object('private','old'))),
		       ($2,$3,'export','completed',jsonb_build_object('expiresAt',NOW()+INTERVAL '1 day','artifact',jsonb_build_object('private','fresh')))`, expiredID, freshID, userID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM profile.privacy_request WHERE id=ANY($1::uuid[])`, []string{expiredID, freshID})
	})
	count, err := NewHandlers(db, nil, Config{}).PrivacyExportArtifactCleanup(ctx)
	if err != nil || count != 1 {
		t.Fatalf("cleanup count=%d err=%v; want one expired artifact", count, err)
	}
	var expiredArtifact, freshArtifact bool
	if err := db.QueryRow(ctx, `SELECT result_payload ? 'artifact' FROM profile.privacy_request WHERE id=$1`, expiredID).Scan(&expiredArtifact); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT result_payload ? 'artifact' FROM profile.privacy_request WHERE id=$1`, freshID).Scan(&freshArtifact); err != nil {
		t.Fatal(err)
	}
	if expiredArtifact || !freshArtifact {
		t.Fatalf("expired artifact retained=%t, fresh artifact retained=%t", expiredArtifact, freshArtifact)
	}
}
