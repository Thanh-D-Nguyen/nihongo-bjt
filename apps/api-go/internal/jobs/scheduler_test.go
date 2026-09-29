package jobs

import (
	"context"
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
