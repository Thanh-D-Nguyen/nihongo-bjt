// Package jobs provides background job scheduling and execution infrastructure.
package jobs

import (
	"os"
	"strings"
)

// Config holds configuration for the background jobs subsystem.
type Config struct {
	// Enabled controls whether the Go scheduler runs any jobs at all.
	// Set JOBS_ENABLED=false to disable during cutover from NestJS.
	Enabled bool

	// LotoAutopilotEnabled controls the Loto autopilot cron specifically.
	// Mirrors the NestJS LOTO_AUTOPILOT_ENABLED env var.
	LotoAutopilotEnabled bool
}

// LoadConfig reads job configuration from environment variables.
func LoadConfig() Config {
	return Config{
		Enabled:              envBool("JOBS_ENABLED", true),
		LotoAutopilotEnabled: envBool("LOTO_AUTOPILOT_ENABLED", true),
	}
}

// envBool reads a boolean from an environment variable.
// Recognizes "false", "0", "no", "off" (case-insensitive) as false.
// Empty or unset returns the default value.
func envBool(key string, defaultVal bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "false", "0", "no", "off":
		return false
	default:
		return true
	}
}
