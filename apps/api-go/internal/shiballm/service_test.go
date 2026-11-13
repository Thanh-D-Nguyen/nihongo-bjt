package shiballm

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kiokoto/nihongo-bjt/api-go/internal/authn"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestServiceReplyNotConfigured(t *testing.T) {
	svc := NewService(Config{})
	if svc.Configured() {
		t.Fatal("service without BaseURL must not be configured")
	}
	_, err := svc.Reply(context.Background(), "user-1", "vi", "こんにちは", nil)
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v, want ErrNotConfigured", err)
	}
}

func TestServiceReplyUsesPersonaAndHistory(t *testing.T) {
	var sent []Message
	transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var body struct {
			Messages []Message `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		sent = body.Messages
		return jsonResponse(200, `{"choices":[{"message":{"role":"assistant","content":"「ありがとうございます」が丁寧です。"}}]}`), nil
	})
	svc := NewService(Config{
		BaseURL:    "http://llm.local/v1",
		Model:      "qwen2.5:7b",
		Timeout:    5 * time.Second,
		HTTPClient: &http.Client{Transport: transport},
	})
	history := []Message{
		{Role: "user", Content: "「ありがとう」の丁寧な言い方は？"},
		{Role: "assistant", Content: "考えてみよう！"},
	}
	reply, err := svc.Reply(context.Background(), "user-1", "ja", "教えてください", history)
	if err != nil {
		t.Fatalf("Reply error: %v", err)
	}
	if reply.Text != "「ありがとうございます」が丁寧です。" || reply.Model != "qwen2.5:7b" {
		t.Fatalf("reply = %+v", reply)
	}
	if len(sent) != 4 {
		t.Fatalf("sent %d messages, want system+2 history+user", len(sent))
	}
	if sent[0].Role != "system" || !strings.Contains(sent[0].Content, "Shiba") {
		t.Fatalf("first message must be the Shiba persona system prompt, got %+v", sent[0])
	}
	if sent[1] != history[0] || sent[2] != history[1] {
		t.Fatalf("history not preserved in order: %+v", sent)
	}
	if sent[3].Role != "user" || sent[3].Content != "教えてください" {
		t.Fatalf("last message = %+v", sent[3])
	}
}

func TestValidateInputBounds(t *testing.T) {
	cases := []struct {
		name    string
		message string
		history []Message
		wantErr bool
	}{
		{"valid", "こんにちは", nil, false},
		{"empty", "   ", nil, true},
		{"too long", strings.Repeat("あ", MaxMessageRunes+1), nil, true},
		{"history too many", "hi", make([]Message, MaxHistoryTurns+1), true},
		{"bad role", "hi", []Message{{Role: "system", Content: "x"}}, true},
		{"history empty content", "hi", []Message{{Role: "user", Content: " "}}, true},
		{"history too long", "hi", []Message{{Role: "user", Content: strings.Repeat("a", MaxHistoryRunes+1)}}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Fill placeholder history entries with valid turns where needed.
			for i := range tc.history {
				if tc.history[i].Role == "" {
					tc.history[i] = Message{Role: "user", Content: "turn"}
				}
			}
			err := ValidateInput(tc.message, tc.history)
			if tc.wantErr && !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("err = %v, want ErrInvalidInput", err)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
		})
	}
}

func TestServiceRateLimit(t *testing.T) {
	transport := roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return jsonResponse(200, `{"choices":[{"message":{"content":"ok"}}]}`), nil
	})
	limiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit: 2, Window: time.Minute, TTL: 2 * time.Minute, MaxKeys: 100, EvictEvery: 10 * time.Second,
	})
	if err != nil {
		t.Fatalf("create limiter: %v", err)
	}
	defer limiter.Stop()
	svc := NewServiceWithLimiter(Config{
		BaseURL:    "http://llm.local/v1",
		Model:      "m",
		HTTPClient: &http.Client{Transport: transport},
	}, limiter)
	for i := 0; i < 2; i++ {
		if _, err := svc.Reply(context.Background(), "user-9", "vi", "hi", nil); err != nil {
			t.Fatalf("call %d error: %v", i, err)
		}
	}
	if _, err := svc.Reply(context.Background(), "user-9", "vi", "hi", nil); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("third call err = %v, want ErrRateLimited", err)
	}
	// A different learner is unaffected.
	if _, err := svc.Reply(context.Background(), "user-10", "vi", "hi", nil); err != nil {
		t.Fatalf("other learner error: %v", err)
	}
}
