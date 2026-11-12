package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/shiballm"
)

// shibaLLMConfig maps application config to the shiballm client
// config. A nil config yields a disabled (unconfigured) service.
func shibaLLMConfig(cfg *config.Config) shiballm.Config {
	if cfg == nil {
		return shiballm.Config{}
	}
	return shiballm.Config{
		BaseURL:              cfg.ShibaLLMBaseURL,
		APIKey:               cfg.ShibaLLMAPIKey,
		Model:                cfg.ShibaLLMModel,
		Timeout:              cfg.ShibaLLMTimeout,
		CFAccessClientID:     cfg.ShibaLLMCFAccessClientID,
		CFAccessClientSecret: cfg.ShibaLLMCFAccessClientSecret,
	}
}

// Stable machine-readable codes for the companion chat endpoint. The
// web client only distinguishes success from failure (it falls back to
// rule-based replies), but the codes keep logs and support precise.
const (
	companionChatCodeOK            = "OK"
	companionChatCodeNotConfigured = "SHIBA_LLM_NOT_CONFIGURED"
	companionChatCodeUpstream      = "SHIBA_LLM_UPSTREAM"
	companionChatCodeTimeout       = "SHIBA_LLM_TIMEOUT"
	companionChatCodeRateLimited   = "SHIBA_CHAT_RATE_LIMITED"
	companionChatCodeInvalid       = "SHIBA_CHAT_INVALID_INPUT"
)

type companionChatRequest struct {
	Message string             `json:"message"`
	History []shiballm.Message `json:"history"`
	Locale  string             `json:"locale"`
}

type companionChatResponse struct {
	Reply    string `json:"reply"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
}

func writeCompanionChatError(w http.ResponseWriter, status int, code string, msg string) {
	writeJSON(w, status, map[string]string{"error": msg, "code": code})
}

// postCompanionChatHandler implements POST /api/companion/chat.
//
// The route is learner-session guarded with CSRF origin checks (see
// server.go). The handler itself only needs the caller's identity for
// per-learner rate limiting and isolation; conversation turns arrive
// in the request body and are never persisted server-side.
func postCompanionChatHandler(svc *shiballm.Service, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if svc == nil || !svc.Configured() {
			writeCompanionChatError(w, http.StatusServiceUnavailable,
				companionChatCodeNotConfigured, "companion chat is not configured")
			return
		}
		var body companionChatRequest
		// Body bound: the largest valid payload is 21 turns x 2000 runes
		// (service bounds). At up to 6 bytes per rune as \uXXXX escapes
		// that is ~252 KB; 512 KB leaves headroom while staying bounded.
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&body); err != nil {
			writeCompanionChatError(w, http.StatusBadRequest,
				companionChatCodeInvalid, "invalid request body")
			return
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			writeCompanionChatError(w, http.StatusBadRequest,
				companionChatCodeInvalid, "invalid request body")
			return
		}
		locale := strings.TrimSpace(body.Locale)
		if locale != "vi" && locale != "ja" && locale != "en" {
			locale = "vi"
		}
		// A reply from a local model on modest hardware can take far
		// longer than the router-wide 30s middleware timeout and the
		// server's default write timeout. Detach the upstream call from
		// the middleware deadline (the service applies its own
		// configured timeout and per-learner rate limit, so the work
		// stays bounded even if the learner disconnects) and extend
		// this response's write deadline to match.
		if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(svc.Timeout() + 30*time.Second)); err != nil && logger != nil {
			// Non-fatal today (the middleware chain supports it), but
			// log so a future writer wrapper that breaks deadline
			// traversal is visible instead of silently truncating
			// slow replies at the server default.
			logger.Debug("companion chat: could not extend write deadline", "error", err)
		}
		reply, err := svc.Reply(context.WithoutCancel(r.Context()), identity.UserID, locale, body.Message, body.History)
		if err != nil {
			switch {
			case errors.Is(err, shiballm.ErrInvalidInput):
				writeCompanionChatError(w, http.StatusBadRequest,
					companionChatCodeInvalid, "invalid message or history")
			case errors.Is(err, shiballm.ErrRateLimited):
				writeCompanionChatError(w, http.StatusTooManyRequests,
					companionChatCodeRateLimited, "chat rate limit exceeded; please wait before sending more messages")
			case errors.Is(err, shiballm.ErrNotConfigured):
				writeCompanionChatError(w, http.StatusServiceUnavailable,
					companionChatCodeNotConfigured, "companion chat is not configured")
			case errors.Is(err, shiballm.ErrTimeout):
				if logger != nil {
					logger.Warn("companion chat upstream timeout", "user_id", identity.UserID)
				}
				writeCompanionChatError(w, http.StatusBadGateway,
					companionChatCodeTimeout, "the mentor is not responding right now; please try again")
			default:
				if logger != nil {
					logger.Warn("companion chat upstream failure", "user_id", identity.UserID, "error", err)
				}
				writeCompanionChatError(w, http.StatusBadGateway,
					companionChatCodeUpstream, "the mentor is unavailable right now; please try again")
			}
			return
		}
		writeJSON(w, http.StatusOK, companionChatResponse{
			Reply:    reply.Text,
			Model:    reply.Model,
			Provider: "shiba-llm",
		})
	}
}
