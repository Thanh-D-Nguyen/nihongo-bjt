// Package httpserver provides the HTTP server, router, and health endpoints.
package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"gocloud.dev/blob"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authlink"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/exercisereview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardreview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardstyle"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/gamification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/quiztemplate"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/studyplan"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/scenario"
"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/notification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/onboarding"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/placement"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/privacy"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/realtime"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/redisx"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// Dependencies holds external dependencies required by the HTTP server.
type Dependencies struct {
	Config          *config.Config
	Logger          *slog.Logger
	DB              postgres.Pinger    // nil if not configured; readiness returns 503
	DBPool          *pgxpool.Pool      // concrete pool for handlers needing BeginTx/Query; nil if DB not configured
	Redis           redisx.Pinger      // nil if not configured; readiness reports not_configured
	SessionStore    *session.Store     // nil if DB not configured
	ProfileStore    *profile.Store     // nil if DB not configured
	RBACStore       *authz.Store       // nil if DB not configured
	CredentialStore *credential.Store  // nil if DB not configured
	RateLimiter     *authn.RateLimiter // nil disables login (fail closed in handler)
	MediaStore      *media.Store       // nil if DB not configured; media endpoints return 503
	MediaBucket     *blob.Bucket       // nil if media storage not configured; upload/stream return 503
	SearchClient    *search.Client     // nil if Meilisearch not configured; search endpoints return 503
	OnboardingStore   *onboarding.Store   // nil if DB not configured; onboarding endpoints return 503
	NotificationStore *notification.Store // nil if DB not configured; notification endpoints return 503
	PrivacyStore      *privacy.Store      // nil if DB not configured; privacy endpoints return 503
	AuthLinkStore       *authlink.Store       // nil if DB not configured; link/exchange returns 503
	PlacementStore      *placement.Store      // nil if DB not configured; placement endpoints return 503
	GamificationStore   *gamification.Store   // nil if DB not configured; gamification endpoints return 503
	ExerciseReviewStore   *exercisereview.Store   // nil if DB not configured; exercise review endpoints return 503
	FlashcardStyleStore   *flashcardstyle.Store   // nil if DB not configured; flashcard style endpoints return 503
	FlashcardReviewStore  *flashcardreview.Store  // nil if DB not configured; flashcard review endpoints return 503
	FlashcardDeckStore    *flashcarddeck.Store    // nil if DB not configured; flashcard deck endpoints return 503
	QuizTemplateStore     *quiztemplate.Store     // nil if DB not configured; quiz template endpoints return 503
	StudyPlanStore        *studyplan.Store        // nil if DB not configured; study plan endpoints return 503
CareerStore *career.Store // nil if DB not configured; career endpoints return 503
	ScenarioStore         *scenario.Store         // nil if DB not configured; scenario endpoints return 503
	Version               string
}

// NewRouter creates the chi router with all routes and middleware.
func NewRouter(deps Dependencies) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// NOTE: middleware.RealIP intentionally omitted. It trusts X-Forwarded-For /
	// X-Real-IP headers, which allows unauthenticated clients to spoof the IP
	// used for rate-limit keys unless the proxy boundary is cryptographically
	// enforced. Until Caddy (or equivalent) is proven as the sole ingress and
	// configured to overwrite these headers, we derive the peer IP directly
	// from r.RemoteAddr in the login handler (host only, no ephemeral port).
	// The account/email key dimension provides additional cardinality protection.
	r.Use(slogMiddleware(deps.Logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Health endpoints — no auth required.
	r.Get("/health/live", liveHandler())
	r.Get("/health/ready", readyHandler(deps))

	// Guard configuration.
	guardCfg := authn.DefaultGuardConfig(deps.Logger)
	csrfCfg := authn.CSRFConfig{
		Logger:         deps.Logger,
		TrustedOrigins: deps.Config.CORSOrigins,
	}

	// Learner auth routes — guarded by learner session cookie + CSRF for unsafe methods.
	if deps.SessionStore != nil && deps.ProfileStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)

		// M5: GET /api/auth/me returns full learner profile (session-guarded only).
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/auth/me", learnerGetMeHandler(deps.ProfileStore, deps.Logger))
		})

		// M5: PUT /api/auth/me updates learner profile (session + CSRF).
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Put("/api/auth/me", learnerUpdateMeHandler(deps.ProfileStore, deps.Logger))
		})

		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/auth/logout", learnerLogoutHandler(deps.SessionStore, deps.Logger, guardCfg.LearnerCookieName))
		})

		// P0-L1: /api/auth/profile aliases — contract-compatible envelope wrappers around profile store.
		// GET/POST return { profile: ... }; PUT validates and updates, returns envelope.
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/auth/profile", getAuthProfileHandler(deps.ProfileStore, deps.Logger))
			lr.Post("/api/auth/profile", syncAuthProfileHandler(deps.ProfileStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Put("/api/auth/profile", putAuthProfileHandler(deps.ProfileStore, deps.Logger))
		})
	}

	// Login routes — public but CSRF-protected and rate-limited. No session guard.
	// Routes are mounted whenever credential + profile/RBAC + session stores exist;
	// the handler itself fails closed (503) if RateLimiter is nil. This prevents
	// silently disabling abuse protection when a dependency is misconfigured.
	if deps.CredentialStore != nil && deps.ProfileStore != nil && deps.SessionStore != nil {
		r.Group(func(lr chi.Router) {
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/auth/login", learnerLoginHandler(
				deps.CredentialStore, deps.ProfileStore, deps.SessionStore,
				deps.RateLimiter, deps.Logger, deps.Config.CookieSecure,
			))
		})
	}
	if deps.CredentialStore != nil && deps.RBACStore != nil && deps.SessionStore != nil {
		r.Group(func(ar chi.Router) {
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/login", adminLoginHandler(
				deps.CredentialStore, deps.RBACStore, deps.SessionStore,
				deps.RateLimiter, deps.Logger, deps.Config.CookieSecure,
			))
		})
	}

	// Account lifecycle routes — public (register, forgot-password, reset-password) and
	// authenticated (change-password, disable, delete). CSRF-protected for unsafe methods.
	if deps.CredentialStore != nil && deps.ProfileStore != nil && deps.SessionStore != nil {
		r.Group(func(lr chi.Router) {
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/auth/register", registerHandler(
				deps.DBPool, deps.CredentialStore, deps.RateLimiter, deps.Logger,
			))
			lr.Post("/api/auth/forgot-password", forgotPasswordHandler(
				deps.DBPool, deps.RateLimiter, deps.Logger,
			))
			lr.Post("/api/auth/reset-password", resetPasswordHandler(
				deps.DBPool, deps.CredentialStore, deps.SessionStore, deps.RateLimiter, deps.Logger,
			))
			lr.Post("/api/auth/change-password", changePasswordHandler(
				deps.DBPool, deps.CredentialStore, deps.SessionStore, deps.RateLimiter, deps.Logger,
			))
			lr.Post("/api/auth/disable", disableAccountHandler(
				deps.DBPool, deps.SessionStore, deps.RateLimiter, deps.Logger,
			))
			lr.Post("/api/auth/delete", deleteAccountHandler(
				deps.DBPool, deps.SessionStore, deps.RateLimiter, deps.Logger,
			))
		})
	}

	// Admin auth routes — guarded by admin session cookie + CSRF for unsafe methods.
	if deps.SessionStore != nil && deps.RBACStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)

		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/session", adminSessionHandler(deps.RBACStore, deps.Logger))
		})

		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/logout", adminLogoutHandler(deps.SessionStore, deps.Logger, guardCfg.AdminCookieName))
		})

		// M6: Admin RBAC management routes — guarded by admin session + CSRF for unsafe methods.
		if deps.DBPool != nil && deps.CredentialStore != nil && deps.RBACStore != nil {
			r.Group(func(ar chi.Router) {
				ar.Use(adminGuard)
				ar.Get("/api/admin/actors", listActorsHandler(deps.DBPool, deps.Logger))
				ar.Get("/api/admin/roles", listRolesHandler(deps.DBPool, deps.Logger))
				ar.Get("/api/admin/permissions", listPermissionsHandler(deps.DBPool, deps.Logger))
			})
			r.Group(func(ar chi.Router) {
				ar.Use(adminGuard)
				ar.Use(authn.CSRFGuard(csrfCfg))
				ar.Post("/api/admin/actors", createActorHandler(
					deps.DBPool, deps.CredentialStore, deps.RateLimiter, deps.Logger,
				))
				ar.Put("/api/admin/actors/{id}/status", updateActorStatusHandler(deps.DBPool, deps.Logger))
				ar.Post("/api/admin/actors/{id}/roles", assignRoleHandler(deps.DBPool, deps.Logger))
				ar.Delete("/api/admin/actors/{id}/roles/{roleId}", removeRoleHandler(deps.DBPool, deps.Logger))
			})
		}

	}

	// M7: Media upload — authenticated (learner session + CSRF), rate-limited.
	if deps.DBPool != nil && deps.MediaStore != nil && deps.MediaBucket != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/media/upload", uploadMediaHandler(
				deps.MediaStore, deps.MediaBucket, deps.RateLimiter, deps.Logger,
			))
		})
	}

	// M7: Media metadata and streaming — public (no auth required).
	if deps.MediaStore != nil && deps.MediaBucket != nil {
		r.Get("/api/media/{id}", getMediaMetadataHandler(deps.MediaStore, deps.Logger))
		r.Get("/api/media/{id}/stream", streamMediaHandler(deps.MediaStore, deps.MediaBucket, deps.Logger))
	}

	// M12: Realtime WebSocket endpoints — battle and presence namespaces.
	if deps.SessionStore != nil {
		rtServer := realtime.NewServer(deps.SessionStore, deps.Logger)
		rtServer.Start()
		realtime.MountRoutes(r, deps.SessionStore, rtServer, csrfCfg)
	}

	// M9: Business write APIs — bookmarks, exercise sessions, quiz sessions.
	// All learner-facing write endpoints require session guard + CSRF for unsafe methods.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)

		// Bookmark list endpoints (GET — session guard only, no CSRF).
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/bookmarks/words", listBookmarksHandler(deps.DBPool, "lexeme", deps.Logger))
			lr.Get("/api/bookmarks/kanji", listBookmarksHandler(deps.DBPool, "kanji", deps.Logger))
			lr.Get("/api/bookmarks/grammar", listBookmarksHandler(deps.DBPool, "grammar", deps.Logger))
			lr.Get("/api/bookmarks/check/{type}/{id}", checkBookmarkHandler(deps.DBPool, deps.Logger))
		})

		// Bookmark toggle (POST — session + CSRF).
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/bookmarks/{type}/{id}", toggleBookmarkHandler(deps.DBPool, deps.Logger))
		})

		// Exercise session endpoints.
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/exercises/sessions", startExerciseSessionHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/exercises/sessions/{id}/answer", submitExerciseAnswerHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/exercises/sessions/{id}/complete", completeExerciseSessionHandler(deps.DBPool, deps.Logger))
		})

		// Quiz session endpoints.
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/quiz/start", startQuizSessionHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/quiz/session/{id}/answer", submitQuizAnswerHandler(deps.DBPool, deps.Logger))
		})
	}

	// M11: Stripe webhook — public endpoint, no auth guard. Signature verification only.
	if deps.DBPool != nil {
		r.Post("/api/webhooks/stripe", stripeWebhookHandler(deps.DBPool, deps.Config, deps.Logger))
	}

	// M11: Share image generation stub (deferred — see handler_webhook.go for rationale).
	r.Get("/api/share/image/{kind}", shareImageStubHandler(deps.Logger))

	// Public content endpoints — anonymous-safe stubs restoring NestJS parity.
	// These return empty/minimal responses so the learner home renders without
	// error banners for unauthenticated users. Full data-layer implementations
	// are deferred; these stubs satisfy the PUBLIC/OPTIONAL_AUTH contract.
	r.Get("/api/nhk-news", nhkNewsListHandler(deps.Logger))
	r.Get("/api/daily-radar/home", dailyRadarHomeHandler(deps.Logger))
	r.Get("/api/daily/home", dailyHomeHandler(deps.Logger))
	r.Get("/api/announcements", announcementsListHandler(deps.Logger))
	r.Post("/api/ads/decision", adsDecisionHandler(deps.Logger))
	// P0-L2: Announcement dismiss + ads impression/click — optional auth; CSRF for writes.
	r.Group(func(pr chi.Router) {
		pr.Use(authn.CSRFGuard(csrfCfg))
		pr.Post("/api/announcements/{id}/dismiss", announcementDismissHandler(deps.Logger))
		pr.Post("/api/ads/impression", adsImpressionHandler(deps.Logger))
		pr.Post("/api/ads/click", adsClickHandler(deps.Logger))
	})

	// M8: Search — learner session-guarded; reindex is admin-only.
	if deps.SearchClient != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/search", searchHandler(deps.SearchClient, deps.Logger))
		})
	}
	if deps.SearchClient != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/search/index", reindexHandler(deps.SearchClient, deps.Logger))
		})
	}

	// P1-A1.1: Admin Operations — System sub-domain (11 routes).
	// All require admin session guard; mutations also require CSRF.
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)

		// Read-only system status endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/system/health", adminOpsSystemHealthHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/system/queue-health", adminOpsQueueHealthHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/system/search-sync", adminOpsSearchSyncHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/system/release", adminOpsReleaseHandler(deps.Logger))
			ar.Get("/api/admin/operations/system/queue-health/actions", adminOpsQueueActionsHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/system/release/history", adminOpsReleaseHistoryHandler(deps.DBPool, deps.Logger))
		})

		// Mutating system control endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/operations/system/queue-health/pause", adminOpsQueuePauseHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/operations/system/queue-health/resume", adminOpsQueueResumeHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/operations/system/queue-health/drain", adminOpsQueueDrainHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/operations/system/release/mark-known-good", adminOpsReleaseMarkKnownGoodHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/operations/system/release/prepare-rollback", adminOpsReleasePrepareRollbackHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.2: Admin Operations — Broadcasts sub-domain (7 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only broadcast endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/broadcasts", adminOpsBroadcastsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/broadcasts/{id}", adminOpsBroadcastsGetHandler(deps.DBPool, deps.Logger))
		})
		// Mutating broadcast endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/broadcasts/audience/estimate", adminOpsBroadcastsEstimateHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/operations/broadcasts", adminOpsBroadcastsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/broadcasts/{id}", adminOpsBroadcastsUpdateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/broadcasts/{id}/schedule", adminOpsBroadcastsScheduleHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/broadcasts/{id}/cancel", adminOpsBroadcastsCancelHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.3: Admin Operations — Import Manifests sub-domain (6 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only import manifest endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/import-manifests", adminOpsImportManifestsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/import-manifests/{id}", adminOpsImportManifestsGetHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/import-manifests/{id}/history", adminOpsImportManifestsHistoryHandler(deps.DBPool, deps.Logger))
		})
		// Mutating import manifest endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/operations/import-manifests", adminOpsImportManifestsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/import-manifests/{id}", adminOpsImportManifestsUpdateHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/operations/import-manifests/{id}/run", adminOpsImportManifestsRunHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.4: Admin Operations — Dead Letter Queue sub-domain (5 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only dead letter endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/dead-letter-queue", adminOpsDeadLetterListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/dead-letter-queue/{id}", adminOpsDeadLetterGetHandler(deps.DBPool, deps.Logger))
		})
		// Mutating dead letter endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/dead-letter-queue/{id}/retry", adminOpsDeadLetterRetryHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/dead-letter-queue/{id}", adminOpsDeadLetterResolveHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/dead-letter-queue/bulk", adminOpsDeadLetterBulkHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.5: Admin Operations — Import Staging sub-domain (5 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only import staging endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/import-staging/errors", adminOpsImportStagingErrorsListHandler(deps.DBPool, deps.Logger))
		})
		// Mutating import staging endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/import-staging/errors/{id}/dead-letter", adminOpsImportStagingEscalateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/import-staging/errors/{id}/retry", adminOpsImportStagingRetryHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/import-staging/errors/{id}/discard", adminOpsImportStagingDiscardHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/operations/import-staging/errors/bulk", adminOpsImportStagingBulkHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.6: Admin Operations — Security sub-domain (4 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only security endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/security", adminOpsSecurityOverviewHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/security/events", adminOpsSecurityEventsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/security/events/{id}", adminOpsSecurityEventGetHandler(deps.DBPool, deps.Logger))
		})
		// Mutating security endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/security/events/{id}/resolve", adminOpsSecurityEventResolveHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L1: Onboarding preferences — learner session-guarded; CSRF for writes.
	if deps.OnboardingStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/recommendation/onboarding/preferences", getOnboardingPreferencesHandler(deps.OnboardingStore, deps.Logger))
			lr.Get("/api/recommendation/onboarding/status", getOnboardingStatusHandler(deps.OnboardingStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/recommendation/onboarding/skip", skipOnboardingHandler(deps.OnboardingStore, deps.Logger))
			lr.Post("/api/recommendation/onboarding/preferences", saveOnboardingPreferencesHandler(deps.OnboardingStore, deps.Logger))
		})
	}
	// P0-L1: Notification preferences — learner session-guarded; CSRF for writes.
	if deps.NotificationStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/learner/notification-preferences", getNotificationPreferencesHandler(deps.NotificationStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Put("/api/learner/notification-preferences", putNotificationPreferencesHandler(deps.NotificationStore, deps.Logger))
		})
	}
	// P0-L1: Privacy requests — learner session-guarded; CSRF for writes.
	if deps.PrivacyStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/learner/privacy/requests", listPrivacyRequestsHandler(deps.PrivacyStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/learner/privacy/requests", createPrivacyRequestHandler(deps.PrivacyStore, deps.Logger))
		})
	}
	// P0-L1: Auth link exchange — public (no session guard); CSRF-protected.
	if deps.AuthLinkStore != nil {
		r.Group(func(pr chi.Router) {
			pr.Use(authn.CSRFGuard(csrfCfg))
			pr.Post("/api/auth/link/exchange", exchangeLinkCodeHandler(deps.AuthLinkStore, deps.Logger))
		})
	}
	// P0-L1: Placement test — learner session-guarded; CSRF for writes.
	if deps.PlacementStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/learner/placement/start", startPlacementHandler(deps.PlacementStore, deps.Logger))
			lr.Post("/api/learner/placement/submit", submitPlacementHandler(deps.PlacementStore, deps.Logger))
		})
	}
	// P0-L3: Gamification — learner session-guarded; CSRF for writes.
	if deps.GamificationStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/gamification/streaks", getStreaksHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/leaderboards", listLeaderboardsHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/leaderboards/{id}", getLeaderboardHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/leaderboards/{id}/me", getMyRankHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/leaderboards/{id}/my-rank", getMyRankHandler(deps.GamificationStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/gamification/streaks/record", recordActivityHandler(deps.GamificationStore, deps.Logger))
		})
	}

	// P0-L5: Gamification achievements, focus, pet, events — learner session-guarded; CSRF for writes.
	if deps.GamificationStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/gamification/achievements", getAchievementDefinitionsHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/achievements/browse", browseAchievementsHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/achievements/me", getMyAchievementsHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/achievements/me/pending", getPendingAchievementsHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/focus/today", focusTodayHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/pet", getPetHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/pet/costumes", getPetCostumesHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/events", getActiveEventsHandler(deps.GamificationStore, deps.Logger))
			lr.Get("/api/gamification/events/{eventId}", getEventHandler(deps.GamificationStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/gamification/achievements/me/acknowledge", acknowledgeAchievementsHandler(deps.GamificationStore, deps.Logger))
			lr.Post("/api/gamification/focus/start", startFocusHandler(deps.GamificationStore, deps.Logger))
			lr.Post("/api/gamification/focus/end", endFocusHandler(deps.GamificationStore, deps.Logger))
			lr.Post("/api/gamification/pet/feed", feedPetHandler(deps.GamificationStore, deps.Logger))
			lr.Post("/api/gamification/pet/rename", renamePetHandler(deps.GamificationStore, deps.Logger))
			lr.Post("/api/gamification/events/{eventId}/join", joinEventHandler(deps.GamificationStore, deps.Logger))
		})
	}

	// P0-L4: Exercise review — learner session-guarded; CSRF for writes.
	if deps.ExerciseReviewStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/exercises/review/due", getDueReviewsHandler(deps.ExerciseReviewStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/exercises/review/{exerciseId}", reviewExerciseHandler(deps.ExerciseReviewStore, deps.Logger))
		})
	}

	// P0-L4: Flashcard styles — learner session-guarded; CSRF for writes.
	if deps.FlashcardStyleStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/flashcards/styles", listFlashcardStylesHandler(deps.FlashcardStyleStore, deps.Logger))
			lr.Get("/api/flashcards/styles/active", getActiveFlashcardStyleHandler(deps.FlashcardStyleStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Put("/api/flashcards/styles/active", setActiveFlashcardStyleHandler(deps.FlashcardStyleStore, deps.Logger))
		})
	}

	// P0-L4: Flashcard reviews — learner session-guarded; CSRF for writes.
	if deps.FlashcardReviewStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/flashcards/reviews/due", getDueFlashcardsHandler(deps.FlashcardReviewStore, deps.Logger))
			lr.Get("/api/flashcards/reviews/comeback-summary", getComebackSummaryHandler(deps.FlashcardReviewStore, deps.Logger))
			lr.Get("/api/flashcards/reviews/{userFlashcardId}/distractors", getDistractorsHandler(deps.FlashcardReviewStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/flashcards/reviews/batch", batchReviewHandler(deps.FlashcardReviewStore, deps.Logger))
			lr.Post("/api/flashcards/reviews/{userFlashcardId}", submitReviewHandler(deps.FlashcardReviewStore, deps.Logger))
		})
	}

	// P0-L4: Flashcard decks — learner session-guarded; CSRF for writes.
	if deps.FlashcardDeckStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/flashcards/decks", listDecksHandler(deps.FlashcardDeckStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/flashcards/decks", createDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Patch("/api/flashcards/decks/{deckId}", updateDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Delete("/api/flashcards/decks/{deckId}", archiveDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/decks/{deckId}/archive", archiveDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/decks/{deckId}/share", shareDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Delete("/api/flashcards/decks/{deckId}/share", unshareDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/decks/clone/{token}", cloneDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/decks/generate", generateDeckHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/decks/generate/preview", previewGenerateCountHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/cards/suggest", suggestCardsHandler(deps.FlashcardDeckStore, deps.Logger))
			lr.Post("/api/flashcards/cards/from-content", createCardFromContentHandler(deps.FlashcardDeckStore, deps.Logger))
		})
	}

	// P0-L5: Quiz templates — public routes (no auth required).
	if deps.QuizTemplateStore != nil {
		r.Get("/api/quiz/templates", listTemplatesHandler(deps.QuizTemplateStore, deps.Logger))
		r.Get("/api/quiz/templates/{id}", getTemplateHandler(deps.QuizTemplateStore, deps.Logger))
		r.Get("/api/quiz/templates/{id}/printable", getPrintableTemplateHandler(deps.QuizTemplateStore, deps.Logger))
	}

	// P0-L5: Revenge mode — learner session-guarded; CSRF for writes.
	if deps.QuizTemplateStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/quiz/revenge/queue", getRevengeQueueHandler(deps.QuizTemplateStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/quiz/revenge/answer", submitRevengeAnswerHandler(deps.QuizTemplateStore, deps.Logger))
		})
	}


	// P0-L5: Study plan — learner session-guarded; CSRF for writes.
	if deps.StudyPlanStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/gamification/study-plan/today", getTodayStudyPlanHandler(deps.StudyPlanStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/gamification/study-plan/progress", recordStudyProgressHandler(deps.StudyPlanStore, deps.Logger))
		})
	}

	// P0-L5: Daily Radar — public routes (no auth required).
	if deps.DBPool != nil {
		r.Get("/api/daily-radar/modules", listDailyRadarModulesHandler(deps.DBPool, deps.Logger))
		r.Get("/api/daily-radar/cards", listDailyRadarCardsHandler(deps.DBPool, deps.Logger))
		r.Get("/api/daily-radar/cards/{slug}", getDailyRadarCardBySlugHandler(deps.DBPool, deps.Logger))
	}

	// P0-L5: Announcements — dismiss (auth optional).
	if deps.DBPool != nil {
		r.Post("/api/announcements/{id}/dismiss", dismissAnnouncementHandler(deps.DBPool, deps.Logger))
	}


	// P0-L5: Scenarios — learner session-guarded; CSRF for writes.
	if deps.ScenarioStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/scenarios", listScenariosHandler(deps.ScenarioStore, deps.Logger))
			lr.Get("/api/scenarios/{scenarioId}", getScenarioHandler(deps.ScenarioStore, deps.Logger))
			lr.Get("/api/scenarios/{scenarioId}/attempts", getScenarioAttemptsHandler(deps.ScenarioStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/scenarios/steps/{stepId}/answer", submitStepAnswerHandler(deps.ScenarioStore, deps.Logger))
			lr.Post("/api/scenarios/{scenarioId}/complete", completeScenarioHandler(deps.ScenarioStore, deps.Logger))
		})
	}

	// P0-L5: Kanji — public routes (no auth required).
	if deps.DBPool != nil {
		r.Get("/api/kanji", listKanjiHandler(deps.DBPool, deps.Logger))
		r.Get("/api/kanji/search", searchKanjiHandler(deps.DBPool, deps.Logger))
		r.Get("/api/kanji/{id}", getKanjiDetailHandler(deps.DBPool, deps.Logger))
		r.Get("/api/kanji/{id}/stroke", getKanjiStrokeHandler(deps.DBPool, deps.Logger))
		r.Get("/api/kanji/words/{id}", getKanjiWordsHandler(deps.DBPool, deps.Logger))
		r.Get("/api/kanji/by-word/{wordId}", getKanjiByWordHandler(deps.DBPool, deps.Logger))
		r.Get("/api/content/kanji", listContentKanjiHandler(deps.DBPool, deps.Logger))
		r.Get("/api/content/kanji/{id}", getContentKanjiDetailHandler(deps.DBPool, deps.Logger))
	}

	// P0-L5: Monetization — mixed public/auth routes.
	if deps.DBPool != nil {
		r.Get("/api/learner/monetization/plans", listMonetizationPlansHandler(deps.DBPool, deps.Logger))
	}
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/learner/monetization/subscription", getSubscriptionHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/learner/monetization/checkout", checkoutMonetizationHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/learner/monetization/subscription/cancel", cancelSubscriptionHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5: Reading Assist — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/reading-assist/preferences", getReadingAssistPreferencesHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Put("/api/reading-assist/preferences", putReadingAssistPreferencesHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/reading-assist/analyze", analyzeReadingAssistHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/reading-assist/analytics", postReadingAssistAnalyticsHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/reading-assist/readings", postReadingAssistReadingsHandler(deps.DBPool, deps.Logger))
		})
	}


	// P0-L5: Career RPG — learner session-guarded; CSRF for writes.
	if deps.CareerStore != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/career/me", getCareerMeHandler(deps.CareerStore, deps.Logger))
			lr.Get("/api/career/ranks", listCareerRanksHandler(deps.CareerStore, deps.Logger))
			lr.Get("/api/career/inbox", getCareerInboxHandler(deps.CareerStore, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Patch("/api/career/me", updateCareerMeHandler(deps.CareerStore, deps.Logger))
			lr.Post("/api/career/clock-in", clockInHandler(deps.CareerStore, deps.Logger))
		})
	}

	// P0-L5: Story Arcs — learner session-guarded.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/story/arcs", listStoryArcsHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/story/arcs/{slug}", getStoryArcDetailHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5: Content Lexemes & Grammar — public routes.
	if deps.DBPool != nil {
		r.Get("/api/content/lexemes", listLexemesHandler(deps.DBPool, deps.Logger))
		r.Get("/api/content/lexemes/{id}", getLexemeDetailHandler(deps.DBPool, deps.Logger))
		r.Get("/api/content/grammar", listGrammarHandler(deps.DBPool, deps.Logger))
		r.Get("/api/content/grammar/{id}", getGrammarDetailHandler(deps.DBPool, deps.Logger))
	}

	// P0-L5: Gamification study-goal, login-bonus, mystery-box — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/gamification/study-goal", getStudyGoalHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/gamification/login-bonus", getLoginBonusHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/gamification/mystery-box/status", mysteryBoxStatusHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/gamification/study-goal", setStudyGoalHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/gamification/login-bonus/claim", claimLoginBonusHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/gamification/mystery-box/open", openMysteryBoxHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5: Share — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/learner/share/templates", shareTemplatesHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/learner/share/preview", sharePreviewHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/learner/share", createShareHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/learner/shares/pet-evolution", createPetEvolutionShareHandler(deps.DBPool, deps.Logger))
		})
	}


	// P0-L5: Magazine & Loto — mixed public/auth routes.
	if deps.DBPool != nil {
		r.Get("/api/magazine", listMagazineHandler(deps.DBPool, deps.Logger))
		r.Get("/api/magazine/today", getMagazineTodayHandler(deps.DBPool, deps.Logger))
		r.Get("/api/magazine/{slug}", getMagazineBySlugHandler(deps.DBPool, deps.Logger))
		r.Get("/api/magazine/loto/feed", lotoFeedHandler(deps.DBPool, deps.Logger))
		r.Get("/api/magazine/loto/next-draw", lotoNextDrawHandler(deps.DBPool, deps.Logger))
		r.Get("/api/magazine/loto/stats", lotoStatsHandler(deps.DBPool, deps.Logger))
	}
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/magazine/{slug}/read", markMagazineReadHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Analytics — public ingest, auth for reads.
	if deps.DBPool != nil {
		r.Post("/api/analytics/events", postAnalyticsEventsHandler(deps.DBPool, deps.Logger))
	}
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/analytics/learner", getAnalyticsLearnerHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/analytics", getAnalyticsHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/analytics/heatmap", getAnalyticsHeatmapHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Battle — mixed public/auth.
	if deps.DBPool != nil {
		r.Get("/api/battle/bots", getBattleBotsHandler(deps.DBPool, deps.Logger))
		r.Get("/api/battle/configs/available", getBattleConfigsAvailableHandler(deps.DBPool, deps.Logger))
	}
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/battle/chat/recent", getBattleChatRecentHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: CardGen — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/cardgen/generate", postCardgenGenerateHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/cardgen/preview", postCardgenPreviewHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Companion — learner session-guarded.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/companion/hint", getCompanionHintHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Exercises sessions/daily-progress — learner session-guarded.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/exercises/sessions/history", getExerciseSessionsHistoryHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/exercises/daily-progress", getExercisesDailyProgressHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Review (generic) — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/review", listReviewHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/review/next", getReviewNextHandler(deps.DBPool, deps.Logger))
			lr.Get("/api/review/{id}", getReviewDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/review", createReviewHandler(deps.DBPool, deps.Logger))
			lr.Patch("/api/review/{id}", updateReviewHandler(deps.DBPool, deps.Logger))
			lr.Delete("/api/review/{id}", deleteReviewHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Public shares/decks — no auth required.
	if deps.DBPool != nil {
		r.Get("/api/public/shares/{token}", getPublicShareHandler(deps.DBPool, deps.Logger))
		r.Get("/api/public/decks/{token}", getPublicDeckHandler(deps.DBPool, deps.Logger))
	}

	// P0-L5 Final Batch: Media search/proxy/presign/complete — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/media/search-images", postMediaSearchImagesHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/media/proxy-image", postMediaProxyImageHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/media/presign-upload", postMediaPresignUploadHandler(deps.DBPool, deps.Logger))
			lr.Post("/api/media/complete-upload", postMediaCompleteUploadHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Push notifications — learner session-guarded; CSRF for writes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Use(authn.CSRFGuard(csrfCfg))
			lr.Post("/api/notifications/push/subscribe", postPushSubscribeHandler(deps.DBPool, deps.Logger))
			lr.Delete("/api/notifications/push/subscribe", deletePushSubscribeHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Recommendation study-feed — learner session-guarded.
	if deps.DBPool != nil && deps.SessionStore != nil {
		learnerGuard := authn.LearnerGuard(deps.SessionStore, guardCfg)
		r.Group(func(lr chi.Router) {
			lr.Use(learnerGuard)
			lr.Get("/api/recommendation/study-feed", getStudyFeedHandler(deps.DBPool, deps.Logger))
		})
	}

	// P0-L5 Final Batch: Search suggest — public route.
	if deps.DBPool != nil {
		r.Get("/api/search/suggest", getSearchSuggestHandler(deps.DBPool, deps.Logger))
	}
	return r
}

// Server wraps the HTTP server with configuration.
type Server struct {
	httpServer *http.Server
	logger     *slog.Logger
}

// NewServer creates a new configured HTTP server.
func NewServer(deps Dependencies, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         ":" + deps.Config.Port,
			Handler:      handler,
			ReadTimeout:  deps.Config.ServerReadTimeout,
			WriteTimeout: deps.Config.ServerWriteTimeout,
			IdleTimeout:  deps.Config.ServerIdleTimeout,
		},
		logger: deps.Logger,
	}
}

// Start begins listening. It returns immediately; use Shutdown to stop.
func (s *Server) Start() error {
	s.logger.Info("HTTP server starting", "addr", s.httpServer.Addr)
	if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("http server: %w", err)
	}
	return nil
}

// Shutdown gracefully stops the server with the given context deadline.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("HTTP server shutting down")
	return s.httpServer.Shutdown(ctx)
}

func liveHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
		})
	}
}

func readyHandler(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		status := "ok"
		httpStatus := http.StatusOK
		checks := map[string]string{}

		// Check PostgreSQL (required)
		if deps.DB == nil {
			checks["postgres"] = "fail"
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
			deps.Logger.Error("readiness: postgres not configured")
		} else if err := postgres.Ping(ctx, deps.DB); err != nil {
			checks["postgres"] = "fail"
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
			deps.Logger.Error("readiness: postgres ping failed", "error", err)
		} else {
			checks["postgres"] = "ok"
		}

		// Check Redis (optional)
		if deps.Redis == nil {
			checks["redis"] = "not_configured"
		} else if err := redisx.Ping(ctx, deps.Redis); err != nil {
			checks["redis"] = "fail"
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
			deps.Logger.Error("readiness: redis ping failed", "error", err)
		} else {
			checks["redis"] = "ok"
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		resp := map[string]interface{}{
			"status": status,
			"checks": checks,
		}
		if deps.Version != "" {
			resp["version"] = deps.Version
		}
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func slogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			logger.LogAttrs(r.Context(), slog.LevelInfo, "request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", ww.Status()),
				slog.Duration("duration", time.Since(start)),
				slog.Int("bytes", ww.BytesWritten()),
			)
		})
	}
}
