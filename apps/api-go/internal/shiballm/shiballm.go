// Package shiballm connects the Shiba companion chat to a self-hosted,
// OpenAI-compatible chat completions endpoint (Ollama, llama.cpp server,
// or any compatible runtime), typically reached through a Cloudflare
// Tunnel protected by an Access service token.
//
// The package is deliberately transport-only plus a thin service layer:
// it owns input validation, the Shiba persona prompt, per-learner rate
// limiting and upstream error mapping. Persistence is out of scope — the
// web client sends the recent conversation turns with each request, so
// no conversation data is stored server-side and learners stay isolated
// by their authenticated session.
package shiballm

import (
	"errors"
	"net/http"
	"strings"
	"time"
)

// Message is one chat turn in OpenAI chat-completions shape.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Config configures the upstream LLM endpoint. BaseURL empty disables
// the integration (the service reports ErrNotConfigured).
type Config struct {
	// BaseURL is the OpenAI-compatible base, e.g.
	// "https://llm.example.com/v1" or "http://127.0.0.1:11434/v1".
	// A trailing "/chat/completions" is tolerated and stripped.
	BaseURL string
	// APIKey, when set, is sent as "Authorization: Bearer <key>".
	APIKey string
	// Model is the upstream model name sent with every request.
	Model string
	// Timeout bounds a single upstream call. Zero means 120s.
	Timeout time.Duration
	// CFAccessClientID / CFAccessClientSecret, when both set, are sent
	// as Cloudflare Access service-token headers.
	CFAccessClientID     string
	CFAccessClientSecret string
	// HTTPClient overrides the default HTTP client (tests).
	HTTPClient *http.Client
}

// Enabled reports whether the integration is fully configured: an
// endpoint alone is not enough — a model must be named too, otherwise
// requests would fail upstream with an empty model.
func (c Config) Enabled() bool {
	return strings.TrimSpace(c.BaseURL) != "" && strings.TrimSpace(c.Model) != ""
}

// effectiveTimeout resolves the per-request upstream timeout.
func (c Config) effectiveTimeout() time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return defaultTimeout
}

// Errors mapped to stable API error codes by the HTTP handler. Upstream
// response bodies and credentials are never wrapped into these errors.
var (
	ErrNotConfigured = errors.New("shiballm: endpoint not configured")
	ErrUpstream      = errors.New("shiballm: upstream request failed")
	ErrTimeout       = errors.New("shiballm: upstream timed out")
	ErrRateLimited   = errors.New("shiballm: rate limited")
	ErrInvalidInput  = errors.New("shiballm: invalid input")
)

// Reply is a generated assistant reply plus the model that produced it.
type Reply struct {
	Text  string
	Model string
}
