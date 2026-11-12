package shiballm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

const defaultTimeout = 120 * time.Second

// Client talks to the configured OpenAI-compatible endpoint.
type Client struct {
	cfg  Config
	http *http.Client
}

// NewClient builds a client from cfg. The HTTP client is created once
// so connections to the home endpoint are reused across requests.
// Redirects are never followed: the request carries credentials
// (Authorization and Cloudflare Access service-token headers) that Go
// would copy to the redirect target, and a redirecting upstream could
// bounce the request — credentials included — to an arbitrary host.
func NewClient(cfg Config) *Client {
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: cfg.effectiveTimeout(),
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	return &Client{cfg: cfg, http: httpClient}
}

func (c *Client) timeout() time.Duration {
	return c.cfg.effectiveTimeout()
}

func (c *Client) endpoint() string {
	base := strings.TrimSuffix(strings.TrimSpace(c.cfg.BaseURL), "/")
	if strings.HasSuffix(base, "/chat/completions") {
		return base
	}
	return base + "/chat/completions"
}

type chatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream"`
	Temperature float64   `json:"temperature"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Chat sends messages to the upstream chat-completions endpoint and
// returns the assistant reply text. Upstream bodies and credentials are
// never included in returned errors.
func (c *Client) Chat(ctx context.Context, messages []Message) (string, error) {
	if !c.cfg.Enabled() {
		return "", ErrNotConfigured
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()

	payload, err := json.Marshal(chatRequest{
		Model:       c.cfg.Model,
		Messages:    messages,
		Stream:      false,
		Temperature: 0.7,
	})
	if err != nil {
		return "", fmt.Errorf("%w: encode request", ErrUpstream)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint(), bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("%w: build request", ErrUpstream)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if strings.TrimSpace(c.cfg.APIKey) != "" {
		req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	}
	if c.cfg.CFAccessClientID != "" && c.cfg.CFAccessClientSecret != "" {
		req.Header.Set("CF-Access-Client-Id", c.cfg.CFAccessClientID)
		req.Header.Set("CF-Access-Client-Secret", c.cfg.CFAccessClientSecret)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		if isTimeout(err) {
			return "", ErrTimeout
		}
		return "", fmt.Errorf("%w: %v", ErrUpstream, errKind(err))
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("%w: read response", ErrUpstream)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}
	var decoded chatResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", fmt.Errorf("%w: decode response", ErrUpstream)
	}
	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("%w: no choices in response", ErrUpstream)
	}
	text := strings.TrimSpace(decoded.Choices[0].Message.Content)
	if text == "" {
		return "", fmt.Errorf("%w: empty reply in response", ErrUpstream)
	}
	// Cap the reply at the history-turn bound: the web client echoes
	// assistant replies back as history turns, and an over-long reply
	// would make every later request fail validation.
	if utf8.RuneCountInString(text) > MaxReplyRunes {
		text = string([]rune(text)[:MaxReplyRunes])
	}
	return text, nil
}

func isTimeout(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	return false
}

// errKind classifies a transport error without echoing URLs or headers
// (which could carry credentials) into logs or API responses.
func errKind(err error) string {
	if isTimeout(err) {
		return "timeout"
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return "dns failure"
	}
	return "connection failure"
}
