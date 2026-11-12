package shiballm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestClientChatReturnsAssistantContent(t *testing.T) {
	var gotPath, gotAuth, gotCFID, gotCFSecret, gotModel string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotCFID = r.Header.Get("CF-Access-Client-Id")
		gotCFSecret = r.Header.Get("CF-Access-Client-Secret")
		var body struct {
			Model string `json:"model"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotModel = body.Model
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"こんにちは！一緒に勉強しよう。"}}]}`))
	}))
	defer srv.Close()

	client := NewClient(Config{
		BaseURL:              srv.URL + "/v1",
		APIKey:               "test-key",
		Model:                "qwen2.5:7b",
		Timeout:              5 * time.Second,
		CFAccessClientID:     "cf-id",
		CFAccessClientSecret: "cf-secret",
	})
	got, err := client.Chat(context.Background(), []Message{{Role: "user", Content: "こんにちは"}})
	if err != nil {
		t.Fatalf("Chat error: %v", err)
	}
	if got != "こんにちは！一緒に勉強しよう。" {
		t.Fatalf("reply = %q", got)
	}
	if gotPath != "/v1/chat/completions" {
		t.Fatalf("path = %q, want /v1/chat/completions", gotPath)
	}
	if gotAuth != "Bearer test-key" {
		t.Fatalf("Authorization = %q", gotAuth)
	}
	if gotCFID != "cf-id" || gotCFSecret != "cf-secret" {
		t.Fatalf("CF Access headers = %q / %q", gotCFID, gotCFSecret)
	}
	if gotModel != "qwen2.5:7b" {
		t.Fatalf("model = %q", gotModel)
	}
}

func TestClientChatUpstreamError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"secret upstream detail"}`))
	}))
	defer srv.Close()

	client := NewClient(Config{BaseURL: srv.URL + "/v1", Model: "m", Timeout: 5 * time.Second})
	_, err := client.Chat(context.Background(), []Message{{Role: "user", Content: "hi"}})
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("err = %v, want ErrUpstream", err)
	}
	if strings.Contains(err.Error(), "secret upstream detail") {
		t.Fatalf("error leaks upstream body: %v", err)
	}
}

func TestClientChatTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(300 * time.Millisecond)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"late"}}]}`))
	}))
	defer srv.Close()

	client := NewClient(Config{BaseURL: srv.URL + "/v1", Model: "m", Timeout: 50 * time.Millisecond})
	_, err := client.Chat(context.Background(), []Message{{Role: "user", Content: "hi"}})
	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("err = %v, want ErrTimeout", err)
	}
}

func TestClientChatDoesNotFollowRedirects(t *testing.T) {
	var targetHits int
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		targetHits++
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"redirected"}}]}`))
	}))
	defer target.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL+"/v1/chat/completions", http.StatusFound)
	}))
	defer srv.Close()

	// No injected HTTPClient: the production default must refuse to
	// follow the redirect, so credentials never reach the target.
	client := NewClient(Config{
		BaseURL:              srv.URL + "/v1",
		Model:                "m",
		Timeout:              5 * time.Second,
		CFAccessClientID:     "cf-id",
		CFAccessClientSecret: "cf-secret",
	})
	_, err := client.Chat(context.Background(), []Message{{Role: "user", Content: "hi"}})
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("err = %v, want ErrUpstream for a redirecting upstream", err)
	}
	if targetHits != 0 {
		t.Fatalf("redirect target was hit %d times; credentials would have leaked", targetHits)
	}
}

func TestClientChatCapsReplyLength(t *testing.T) {
	long := strings.Repeat("あ", MaxReplyRunes+500)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": long}}},
		})
	}))
	defer srv.Close()

	client := NewClient(Config{BaseURL: srv.URL + "/v1", Model: "m", Timeout: 5 * time.Second})
	got, err := client.Chat(context.Background(), []Message{{Role: "user", Content: "hi"}})
	if err != nil {
		t.Fatalf("Chat error: %v", err)
	}
	if n := len([]rune(got)); n != MaxReplyRunes {
		t.Fatalf("reply runes = %d, want capped at %d", n, MaxReplyRunes)
	}
}

func TestClientChatEmptyChoices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[]}`))
	}))
	defer srv.Close()

	client := NewClient(Config{BaseURL: srv.URL + "/v1", Model: "m", Timeout: 5 * time.Second})
	_, err := client.Chat(context.Background(), []Message{{Role: "user", Content: "hi"}})
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("err = %v, want ErrUpstream for empty choices", err)
	}
}
