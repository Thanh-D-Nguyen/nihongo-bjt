package httpserver

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/shiballm"
)

func companionChatAuthenticatedRequest(t *testing.T, db *pgxpool.Pool, body string) *http.Request {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Companion chat fixture", fmt.Sprintf("companion-chat-%s@example.test", userID), "")
	store := session.NewStore(db)
	token := createLearnerSession(t, store, userID)
	req := httptest.NewRequest(http.MethodPost, "/api/companion/chat", strings.NewReader(body))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	req.Header.Set("Content-Type", "application/json")
	var authenticated *http.Request
	guard := authn.LearnerGuard(store, authn.DefaultGuardConfig(testLogger()))
	rr := httptest.NewRecorder()
	guard(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { authenticated = r })).ServeHTTP(rr, req)
	if authenticated == nil {
		t.Fatalf("authenticate companion chat fixture: %d %s", rr.Code, rr.Body.String())
	}
	return authenticated
}

func TestCompanionChatRequiresIdentity(t *testing.T) {
	svc := shiballm.NewService(shiballm.Config{BaseURL: "http://127.0.0.1:1/v1", Model: "m"})
	req := httptest.NewRequest(http.MethodPost, "/api/companion/chat", strings.NewReader(`{"message":"hi"}`))
	rr := httptest.NewRecorder()
	postCompanionChatHandler(svc, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s, want 401", rr.Code, rr.Body.String())
	}
}

// TestCompanionChatRouterEnforcesAuthAndCSRF drives the real router
// (AC1): the route must sit behind the learner session guard and the
// CSRF origin guard, not just check identity inside the handler.
func TestCompanionChatRouterEnforcesAuthAndCSRF(t *testing.T) {
	db := testPool(t)
	router := NewRouter(Dependencies{
		Config:       &config.Config{Port: "4001", CORSOrigins: []string{"https://app.example.com"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: session.NewStore(db),
		Version:      "test",
	})
	post := func(cookie, origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/companion/chat", strings.NewReader(`{"message":"hi"}`))
		req.Header.Set("Content-Type", "application/json")
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if cookie != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: cookie})
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr
	}

	// Anonymous requests are rejected by the learner guard.
	if rr := post("", "https://app.example.com"); rr.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d body=%s, want 401", rr.Code, rr.Body.String())
	}

	// A valid session with a cross-site Origin is rejected by CSRF.
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Companion router fixture", fmt.Sprintf("companion-router-%s@example.test", userID), "")
	token := createLearnerSession(t, session.NewStore(db), userID)
	if rr := post(token, "https://evil.example.com"); rr.Code != http.StatusForbidden {
		t.Fatalf("cross-origin status=%d body=%s, want 403", rr.Code, rr.Body.String())
	}

	// Same-origin with a valid session reaches the handler, which
	// reports the LLM as not configured under the default config.
	rr := post(token, "https://app.example.com")
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("same-origin status=%d body=%s, want 503", rr.Code, rr.Body.String())
	}
	var got struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil || got.Code != companionChatCodeNotConfigured {
		t.Fatalf("body=%s code=%q err=%v", rr.Body.String(), got.Code, err)
	}
}

func TestCompanionChatNotConfigured(t *testing.T) {
	db := testPool(t)
	svc := shiballm.NewService(shiballm.Config{})
	req := companionChatAuthenticatedRequest(t, db, `{"message":"こんにちは","locale":"ja"}`)
	rr := httptest.NewRecorder()
	postCompanionChatHandler(svc, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d body=%s, want 503", rr.Code, rr.Body.String())
	}
	var got struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil || got.Code != companionChatCodeNotConfigured {
		t.Fatalf("body=%s code=%q err=%v", rr.Body.String(), got.Code, err)
	}
}

func TestCompanionChatReturnsLLMReply(t *testing.T) {
	db := testPool(t)
	var upstreamMessages []shiballm.Message
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []shiballm.Message `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		upstreamMessages = body.Messages
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"「ありがとうございます」が丁寧な言い方です。"}}]}`))
	}))
	defer upstream.Close()

	svc := shiballm.NewService(shiballm.Config{
		BaseURL: upstream.URL + "/v1",
		Model:   "qwen2.5:7b",
		Timeout: 5 * time.Second,
	})
	payload := `{"message":"教えてください","locale":"ja","history":[{"role":"user","content":"「ありがとう」の丁寧な言い方は？"},{"role":"assistant","content":"考えてみよう！"}]}`
	req := companionChatAuthenticatedRequest(t, db, payload)
	rr := httptest.NewRecorder()
	postCompanionChatHandler(svc, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s, want 200", rr.Code, rr.Body.String())
	}
	var got companionChatResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Reply != "「ありがとうございます」が丁寧な言い方です。" || got.Model != "qwen2.5:7b" || got.Provider != "shiba-llm" {
		t.Fatalf("response = %+v", got)
	}
	if len(upstreamMessages) != 4 || upstreamMessages[0].Role != "system" {
		t.Fatalf("upstream messages = %+v, want system + 2 history + user", upstreamMessages)
	}
}

func TestCompanionChatInvalidAndUpstreamFailure(t *testing.T) {
	db := testPool(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer upstream.Close()
	svc := shiballm.NewService(shiballm.Config{
		BaseURL: upstream.URL + "/v1",
		Model:   "m",
		Timeout: 5 * time.Second,
	})
	handler := postCompanionChatHandler(svc, testLogger())

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, companionChatAuthenticatedRequest(t, db, `{"message":"   "}`))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("empty message status=%d body=%s, want 400", rr.Code, rr.Body.String())
	}

	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, companionChatAuthenticatedRequest(t, db, `{"message":"こんにちは"}`))
	if rr.Code != http.StatusBadGateway {
		t.Fatalf("upstream failure status=%d body=%s, want 502", rr.Code, rr.Body.String())
	}
	var got struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil || got.Code != companionChatCodeUpstream {
		t.Fatalf("body=%s code=%q err=%v", rr.Body.String(), got.Code, err)
	}
}
