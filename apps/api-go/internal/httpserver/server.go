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

	// P1-A1.7: Admin Operations — Feature Flags sub-domain (3 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only feature flag endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/feature-flags", adminOpsFeatureFlagsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/operations/feature-flags/{key}/history", adminOpsFeatureFlagsHistoryHandler(deps.DBPool, deps.Logger))
		})
		// Mutating feature flag endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/feature-flags/{key}", adminOpsFeatureFlagsUpdateHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.8: Admin Operations — Kill Switches sub-domain (2 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only kill switch endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/kill-switches", adminOpsKillSwitchesListHandler(deps.DBPool, deps.Logger))
		})
		// Mutating kill switch endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/kill-switches/{key}", adminOpsKillSwitchesUpdateHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.9: Admin Operations — Search Rebuild sub-domain (2 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/operations/search-rebuild", adminOpsSearchRebuildHandler(deps.DBPool, deps.SearchClient, deps.Logger))
			ar.Post("/api/admin/operations/search-rebuild/partial", adminOpsSearchRebuildPartialHandler(deps.DBPool, deps.SearchClient, deps.Logger))
		})
	}

	// P1-A1.10: Admin Operations — Notifications sub-domain (1 route).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/notifications", adminOpsNotificationsHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.11: Admin Operations — Import Batches sub-domain (1 route).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/import-batches", adminOpsImportBatchesListHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A1.12: Admin Operations — BJT Dashboard sub-domain (1 route).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/operations/bjt/dashboard", adminOpsBJTDashboardHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A2.1: Admin Assessment — Mock Exams sub-domain (8 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only mock exam endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/assessment/mock-exams", adminAssessmentMockExamsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/assessment/mock-exams/{id}", adminAssessmentMockExamsDetailHandler(deps.DBPool, deps.Logger))
		})
		// Mutating mock exam endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/assessment/mock-exams", adminAssessmentMockExamsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/assessment/mock-exams/{id}", adminAssessmentMockExamsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/mock-exams/{id}/publish", adminAssessmentMockExamsPublishHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/mock-exams/{id}/archive", adminAssessmentMockExamsArchiveHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/mock-exams/{id}/duplicate", adminAssessmentMockExamsDuplicateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/assessment/mock-exams/{id}", adminAssessmentMockExamsDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A2.2: Admin Assessment — Question Bank sub-domain (7 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only question bank endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/assessment/question-bank", adminAssessmentQuestionBankListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/assessment/question-bank/{id}", adminAssessmentQuestionBankDetailHandler(deps.DBPool, deps.Logger))
		})
		// Mutating question bank endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/assessment/question-bank", adminAssessmentQuestionBankCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/assessment/question-bank/{id}", adminAssessmentQuestionBankPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/question-bank/bulk", adminAssessmentQuestionBankBulkHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/question-bank/{id}/suggest-edit", adminAssessmentQuestionBankSuggestEditHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/assessment/question-bank/{id}", adminAssessmentQuestionBankDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A2.3: Admin Assessment — Quiz Templates sub-domain (8 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only quiz template endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/assessment/quiz-templates", adminAssessmentQuizTemplatesListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/assessment/quiz-templates/{id}", adminAssessmentQuizTemplatesDetailHandler(deps.DBPool, deps.Logger))
		})
		// Mutating quiz template endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/assessment/quiz-templates", adminAssessmentQuizTemplatesCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/assessment/quiz-templates/{id}", adminAssessmentQuizTemplatesPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/quiz-templates/{id}/publish", adminAssessmentQuizTemplatesPublishHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/quiz-templates/{id}/archive", adminAssessmentQuizTemplatesArchiveHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/quiz-templates/{id}/duplicate", adminAssessmentQuizTemplatesDuplicateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/assessment/quiz-templates/{id}", adminAssessmentQuizTemplatesDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A2.4: Admin Assessment — Remediation Rules sub-domain (7 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only remediation rules endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/assessment/remediation/rules", adminAssessmentRemediationRulesListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/assessment/remediation/rules/{id}", adminAssessmentRemediationRulesDetailHandler(deps.DBPool, deps.Logger))
		})
		// Mutating remediation rules endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/assessment/remediation/rules", adminAssessmentRemediationRulesCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/assessment/remediation/rules/{id}", adminAssessmentRemediationRulesPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/remediation/rules/{id}/enable", adminAssessmentRemediationRulesEnableHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/assessment/remediation/rules/{id}/disable", adminAssessmentRemediationRulesDisableHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/assessment/remediation/rules/{id}", adminAssessmentRemediationRulesDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A3.1: Admin Growth — Campaigns sub-domain (10 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only campaign endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/growth/campaigns", adminGrowthCampaignsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/growth/campaigns/audience-estimate", adminGrowthCampaignsAudienceEstimateHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/growth/campaigns/{id}", adminGrowthCampaignsDetailHandler(deps.DBPool, deps.Logger))
		})
		// Mutating campaign endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/growth/campaigns", adminGrowthCampaignsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/growth/campaigns/{id}", adminGrowthCampaignsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/campaigns/{id}/schedule", adminGrowthCampaignsTransitionHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/campaigns/{id}/activate", adminGrowthCampaignsTransitionHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/campaigns/{id}/end", adminGrowthCampaignsTransitionHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/campaigns/{id}/archive", adminGrowthCampaignsTransitionHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/campaigns/{id}/duplicate", adminGrowthCampaignsDuplicateHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A3.2: Admin Growth — Postcards sub-domain (6 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only postcard endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/growth/postcards", adminGrowthPostcardsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/growth/postcards/{id}", adminGrowthPostcardsDetailHandler(deps.DBPool, deps.Logger))
		})
		// Mutating postcard endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/growth/postcards", adminGrowthPostcardsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/growth/postcards/{id}", adminGrowthPostcardsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/postcards/{id}/publish", adminGrowthPostcardsPublishHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/postcards/{id}/archive", adminGrowthPostcardsArchiveHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A3.3: Admin Growth — Social Templates & Events sub-domain (8 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		// Read-only social template endpoints.
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/growth/social/templates", adminGrowthSocialTemplatesListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/growth/social/templates/{id}", adminGrowthSocialTemplatesDetailHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/growth/social/events", adminGrowthSocialEventsListHandler(deps.DBPool, deps.Logger))
		})
		// Mutating social template endpoints (CSRF-protected).
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/growth/social/templates", adminGrowthSocialTemplatesCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/growth/social/templates/{id}", adminGrowthSocialTemplatesPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/social/templates/{id}/publish", adminGrowthSocialTemplatesPublishHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/social/templates/{id}/archive", adminGrowthSocialTemplatesArchiveHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/growth/social/events/{id}/moderate", adminGrowthSocialEventsModerateHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A3.4: Admin Growth — Referrals sub-domain (3 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/growth/referrals", adminGrowthReferralsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/growth/referrals/{id}", adminGrowthReferralsDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/growth/referrals/{id}/revoke", adminGrowthReferralsRevokeHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A4.1: Admin Battle — Abuse Reports sub-domain (4 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/battle/abuse", adminBattleAbuseListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/battle/abuse/{id}", adminBattleAbuseDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/battle/abuse/{id}/resolve", adminBattleAbuseResolveHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/abuse/{id}/escalate", adminBattleAbuseEscalateHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A4.2: Admin Battle — Bots sub-domain (8 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/battle/bots", adminBattleBotsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/battle/bots/{id}", adminBattleBotsDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/battle/bots", adminBattleBotsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/battle/bots/{id}", adminBattleBotsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/bots/{id}/enable", adminBattleBotsToggleHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/bots/{id}/disable", adminBattleBotsToggleHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/bots/{id}/archive", adminBattleBotsArchiveHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/battle/bots/{id}", adminBattleBotsDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A4.3: Admin Battle — Configs sub-domain (8 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/battle/configs", adminBattleConfigsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/battle/configs/{id}", adminBattleConfigsDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/battle/configs", adminBattleConfigsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/battle/configs/{id}", adminBattleConfigsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/configs/{id}/publish", adminBattleConfigsPublishHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/configs/{id}/archive", adminBattleConfigsArchiveHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/configs/{id}/duplicate", adminBattleConfigsDuplicateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/battle/configs/{id}", adminBattleConfigsDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A4.4: Admin Battle — Leaderboard + Matches + System Parameters (6 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/battle/leaderboard", adminBattleLeaderboardListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/battle/system-parameters", adminBattleSystemParametersHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/battle/matches", adminBattleMatchesListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/battle/matches/{id}", adminBattleMatchesDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/battle/matches/{id}/abort", adminBattleMatchesAbortHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/battle/matches/{id}/rerun", adminBattleMatchesRerunHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A5.1: Admin Monetization — Core sub-domain (7 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/monetization/overview", adminMonetizationOverviewHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/summary", adminMonetizationSummaryHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/analytics", adminMonetizationAnalyticsHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/audit", adminMonetizationAuditHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/plans", adminMonetizationPlansListHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/monetization/plans", adminMonetizationPlansCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/monetization/plans/{id}", adminMonetizationPlansPatchHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A5.2: Admin Monetization — Entitlements + Quotas sub-domain (11 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/monetization/entitlements", adminMonetizationEntitlementsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/quotas", adminMonetizationQuotasListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/quota-overrides", adminMonetizationQuotaOverridesListHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/monetization/entitlements", adminMonetizationEntitlementsCreateHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/plans/{planId}/entitlements", adminMonetizationPlanEntitlementLinkHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/monetization/plans/{planId}/entitlements/{entitlementId}", adminMonetizationPlanEntitlementUnlinkHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/quotas/policies", adminMonetizationQuotaPoliciesCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/monetization/quotas/policies/{id}", adminMonetizationQuotaPoliciesPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/quotas/plan-links", adminMonetizationQuotaPlanLinksCreateHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/quota-overrides", adminMonetizationQuotaOverridesCreateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/monetization/quota-overrides/{id}", adminMonetizationQuotaOverridesDeleteHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A5.3: Admin Monetization — Subscriptions + Coupons sub-domain (5 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/monetization/subscriptions", adminMonetizationSubscriptionsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/coupons", adminMonetizationCouponsListHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/monetization/subscriptions/{id}", adminMonetizationSubscriptionsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/coupons", adminMonetizationCouponsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/monetization/coupons/{id}", adminMonetizationCouponsPatchHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A5.4: Admin Monetization — Ads sub-domain (13 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/monetization/ads/overview", adminMonetizationAdsOverviewHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/ads/placements", adminMonetizationAdsPlacementsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/ads/campaigns", adminMonetizationAdsCampaignsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/ads/providers", adminMonetizationAdsProvidersListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/ads/rules", adminMonetizationAdsRulesListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/ads/performance", adminMonetizationAdsPerformanceHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/monetization/ads/audit", adminMonetizationAdsAuditHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/monetization/ads/placements", adminMonetizationAdsPlacementsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/monetization/ads/placements/{id}", adminMonetizationAdsPlacementsPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/ads/campaigns", adminMonetizationAdsCampaignsCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/monetization/ads/campaigns/{id}", adminMonetizationAdsCampaignsPatchHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/monetization/ads/providers/{key}", adminMonetizationAdsProvidersPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/monetization/ads/rules", adminMonetizationAdsRulesCreateHandler(deps.DBPool, deps.Logger))
		})
	}

	// P1-A6: Admin Analytics — 8 domains × 5 endpoints = 40 routes.
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)
		for _, domain := range analyticsDomains {
			domain := domain // capture loop variable
			r.Group(func(ar chi.Router) {
				ar.Use(adminGuard)
				ar.Get("/api/admin/analytics/"+domain+"/summary", adminAnalyticsSummaryHandler(deps.DBPool, deps.Logger))
				ar.Get("/api/admin/analytics/"+domain+"/timeseries", adminAnalyticsTimeseriesHandler(deps.DBPool, deps.Logger))
				ar.Get("/api/admin/analytics/"+domain+"/breakdown", adminAnalyticsBreakdownHandler(deps.DBPool, deps.Logger))
			})
			r.Group(func(ar chi.Router) {
				ar.Use(adminGuard)
				ar.Use(authn.CSRFGuard(csrfCfg))
				ar.Post("/api/admin/analytics/"+domain+"/export", adminAnalyticsExportHandler(deps.DBPool, deps.Logger))
				ar.Post("/api/admin/analytics/"+domain+"/refresh", adminAnalyticsRefreshHandler(deps.DBPool, deps.Logger))
			})
		}
	}

	// P1-A7: Admin Core — IAM + Users + Content + Support + Audit + I18n + ReadingAssist (38 routes).
	if deps.DBPool != nil && deps.SessionStore != nil {
		adminGuard := authn.AdminGuard(deps.SessionStore, guardCfg)

		// Session / Me / Module Contracts (3 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/session", adminSessionHandler(deps.RBACStore, deps.Logger))
			ar.Get("/api/admin/me", adminMeHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/module-contracts", adminModuleContractsHandler(deps.DBPool, deps.Logger))
		})

		// IAM: Roles (2 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/iam/roles", adminIamRolesListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/iam/roles/{code}", adminIamRoleDetailHandler(deps.DBPool, deps.Logger))
		})

		// IAM: Permissions (2 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/iam/permissions", adminIamPermissionsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/iam/permissions/{code}", adminIamPermissionDetailHandler(deps.DBPool, deps.Logger))
		})

		// IAM: Admins (4 read + 3 write = 7 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/iam/admins", adminIamAdminsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/iam/admins/{id}", adminIamAdminDetailHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/iam/role-audit", adminIamRoleAuditHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/iam/admins/{id}/roles", adminIamAdminAssignRoleHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/iam/admins/{id}/roles/{roleCode}", adminIamAdminRevokeRoleHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/iam/admins/{id}", adminIamAdminPatchHandler(deps.DBPool, deps.Logger))
		})

		// Content: Summary + Lexeme Examples (4 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/content/summary", adminContentSummaryHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/lexemes/{id}/examples", adminLexemeExamplesCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/lexemes/{id}/examples/{linkId}", adminLexemeExamplePatchHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/lexemes/{id}/examples/{linkId}", adminLexemeExampleDeleteHandler(deps.DBPool, deps.Logger))
		})

		// Content: CRUD (4 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/content", adminContentListHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/content", adminContentCreateHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/content/{type}/{id}/status", adminContentStatusPatchHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/content/{type}/{id}", adminContentPatchHandler(deps.DBPool, deps.Logger))
		})

		// Users: KPIs + List + Detail + Audit (4 read routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/users/kpis", adminUsersKpisHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/users", adminUsersListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/users/{id}", adminUserDetailHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/users/{id}/audit", adminUserAuditHandler(deps.DBPool, deps.Logger))
		})

		// Users: Write operations (5 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/users/{id}/status", adminUserStatusPatchHandler(deps.DBPool, deps.Logger))
			ar.Patch("/api/admin/users/{id}/plan", adminUserPlanPatchHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/users/{id}/support-notes", adminUserSupportNoteHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/users/invite", adminUserInviteHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/users", adminUserCreateHandler(deps.DBPool, deps.Logger))
		})

		// Audit (1 route)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/audit", adminAuditHandler(deps.DBPool, deps.Logger))
		})

		// Support Notes (2 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/support/notes", adminSupportNotesListHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Post("/api/admin/support/notes", adminSupportNotesCreateHandler(deps.DBPool, deps.Logger))
		})

		// Reading Assist Reports (1 route)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/reading-assist/reports", adminReadingAssistReportsHandler(deps.DBPool, deps.Logger))

		// P1-A8: Admin Learning — Paths + Competencies + Review (20 routes)
		ar.Get("/api/admin/learning/paths", adminLearningPathsListHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/paths", adminLearningPathCreateHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/paths/{id}", adminLearningPathDetailHandler(deps.DBPool, deps.Logger))
		ar.Patch("/api/admin/learning/paths/{id}", adminLearningPathPatchHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/paths/{id}/publish", adminLearningPathPublishHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/paths/{id}/archive", adminLearningPathArchiveHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/paths/{id}/duplicate", adminLearningPathDuplicateHandler(deps.DBPool, deps.Logger))
		ar.Delete("/api/admin/learning/paths/{id}", adminLearningPathDeleteHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/competencies", adminCompetenciesListHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/competencies", adminCompetencyCreateHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/competencies/{id}", adminCompetencyDetailHandler(deps.DBPool, deps.Logger))
		ar.Patch("/api/admin/learning/competencies/{id}", adminCompetencyPatchHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/competencies/{id}/publish", adminCompetencyPublishHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/competencies/{id}/archive", adminCompetencyArchiveHandler(deps.DBPool, deps.Logger))
		ar.Delete("/api/admin/learning/competencies/{id}", adminCompetencyDeleteHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/review/summary", adminLearningReviewSummaryHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/review/retention-curve", adminLearningReviewRetentionCurveHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/review/problem-cards", adminLearningReviewProblemCardsHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/learning/review/cards/{id}", adminLearningReviewCardDetailHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/learning/review/cards/{id}/force-reintroduce", adminLearningReviewForceReintroduceHandler(deps.DBPool, deps.Logger))

			// P1-A9: Admin Gamification — Streaks + Achievements + Tiers + Leaderboards + Pets (23 routes)
			ar.Get("/api/admin/gamification/streaks", adminStreakConfigsListHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/gamification/streaks", adminStreakConfigCreateHandler(deps.DBPool, deps.Logger))
			ar.Put("/api/admin/gamification/streaks/{id}", adminStreakConfigUpdateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/gamification/streaks/{id}", adminStreakConfigDeleteHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/achievements", adminAchievementsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/achievements/{id}", adminAchievementDetailHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/gamification/achievements", adminAchievementCreateHandler(deps.DBPool, deps.Logger))
			ar.Put("/api/admin/gamification/achievements/{id}", adminAchievementUpdateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/gamification/achievements/{id}", adminAchievementDeleteHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/achievements/{achievementId}/tiers", adminAchievementTiersListHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/gamification/achievements/{achievementId}/tiers", adminAchievementTierCreateHandler(deps.DBPool, deps.Logger))
			ar.Put("/api/admin/gamification/achievements/tiers/{id}", adminAchievementTierUpdateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/gamification/achievements/tiers/{id}", adminAchievementTierDeleteHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/leaderboards", adminLeaderboardsListHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/gamification/leaderboards", adminLeaderboardCreateHandler(deps.DBPool, deps.Logger))
			ar.Put("/api/admin/gamification/leaderboards/{id}", adminLeaderboardUpdateHandler(deps.DBPool, deps.Logger))
			ar.Delete("/api/admin/gamification/leaderboards/{id}", adminLeaderboardDeleteHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/pets", adminPetsListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/pets/stats", adminPetsStatsHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/gamification/pets/{id}", adminPetDetailHandler(deps.DBPool, deps.Logger))
			ar.Put("/api/admin/gamification/pets/{id}", adminPetUpdateHandler(deps.DBPool, deps.Logger))
			ar.Post("/api/admin/gamification/pets/{id}/reset", adminPetResetHandler(deps.DBPool, deps.Logger))

// P1-A10: Admin Ads — Overview + Placements + Campaigns + Providers + Rules + Performance + Audit (13 routes)
ar.Get("/api/admin/ads/overview", adminAdsOverviewHandler(deps.DBPool, deps.Logger))
ar.Get("/api/admin/ads/placements", adminAdsPlacementsListHandler(deps.DBPool, deps.Logger))
ar.Post("/api/admin/ads/placements", adminAdsPlacementCreateHandler(deps.DBPool, deps.Logger))
ar.Patch("/api/admin/ads/placements/{id}", adminAdsPlacementPatchHandler(deps.DBPool, deps.Logger))
ar.Get("/api/admin/ads/campaigns", adminAdsCampaignsListHandler(deps.DBPool, deps.Logger))
ar.Post("/api/admin/ads/campaigns", adminAdsCampaignCreateHandler(deps.DBPool, deps.Logger))
ar.Patch("/api/admin/ads/campaigns/{id}", adminAdsCampaignPatchHandler(deps.DBPool, deps.Logger))
ar.Get("/api/admin/ads/providers", adminAdsProvidersListHandler(deps.DBPool, deps.Logger))
ar.Patch("/api/admin/ads/providers/{key}", adminAdsProviderPatchHandler(deps.DBPool, deps.Logger))
ar.Get("/api/admin/ads/rules", adminAdsRulesListHandler(deps.DBPool, deps.Logger))
ar.Post("/api/admin/ads/rules", adminAdsRuleUpsertHandler(deps.DBPool, deps.Logger))
ar.Get("/api/admin/ads/performance", adminAdsPerformanceHandler(deps.DBPool, deps.Logger))
ar.Get("/api/admin/ads/audit", adminAdsAuditHandler(deps.DBPool, deps.Logger))

		// P1-A11: Admin Magazine + Loto — Articles + Predictions + Lab (16 routes)
		ar.Get("/api/admin/magazine", adminMagazineListHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/generate", adminMagazineGenerateHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/{id}/regenerate", adminMagazineRegenerateHandler(deps.DBPool, deps.Logger))
		ar.Delete("/api/admin/magazine/{id}", adminMagazineDeleteHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/magazine/loto/predictions", adminLotoPredictionsListHandler(deps.DBPool, deps.Logger))
		ar.Put("/api/admin/magazine/loto/predictions/{id}/approve", adminLotoPredictionApproveHandler(deps.DBPool, deps.Logger))
		ar.Put("/api/admin/magazine/loto/predictions/{id}/reject", adminLotoPredictionRejectHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/loto/predictions/results", adminLotoResultsInputHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/magazine/loto/predictions/analytics", adminLotoAnalyticsHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/magazine/loto/summary", adminLotoSummaryHandler(deps.DBPool, deps.Logger))
		ar.Get("/api/admin/magazine/loto/draws", adminLotoDrawsHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/loto/import-csv", adminLotoImportCSVHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/loto/sync", adminLotoSyncHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/loto/autopilot", adminLotoAutopilotHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/loto/generate", adminLotoGenerateHandler(deps.DBPool, deps.Logger))
		ar.Post("/api/admin/magazine/loto/publish", adminLotoPublishHandler(deps.DBPool, deps.Logger))
		})

		// I18n Admin (4 routes)
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Get("/api/admin/i18n/keys", adminI18nKeysListHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/i18n/pending", adminI18nPendingHandler(deps.DBPool, deps.Logger))
			ar.Get("/api/admin/i18n/keys/{id}", adminI18nKeyDetailHandler(deps.DBPool, deps.Logger))
		})
		r.Group(func(ar chi.Router) {
			ar.Use(adminGuard)
			ar.Use(authn.CSRFGuard(csrfCfg))
			ar.Patch("/api/admin/i18n/keys/{id}/translation", adminI18nTranslationPatchHandler(deps.DBPool, deps.Logger))
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
