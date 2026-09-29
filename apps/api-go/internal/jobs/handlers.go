package jobs

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handlers holds all job handler functions and their dependencies.
type Handlers struct {
	db     *pgxpool.Pool
	logger *slog.Logger
	cfg    Config
}

// NewHandlers creates job handlers with the given dependencies.
func NewHandlers(db *pgxpool.Pool, logger *slog.Logger, cfg Config) *Handlers {
	return &Handlers{db: db, logger: logger, cfg: cfg}
}

// ComebackExperience checks for users eligible for comeback engagement.
// Migrated from: apps/api/src/gamification/comeback-experience.cron.ts
// Schedule: 0 10 * * * (Asia/Ho_Chi_Minh)
func (h *Handlers) ComebackExperience(ctx context.Context) (int, error) {
	// TODO(M10): Implement findEligibleUsers query against profile.user_profile
	// and gamification tables. NestJS calls comeback.findEligibleUsers(50).
	h.logger.DebugContext(ctx, "comeback_experience: stub — business logic pending")
	return 0, nil
}

// MagazineGeneration generates daily magazine content (vocab, weather, horoscope, BJT phrase).
// Migrated from: apps/api/src/magazine/magazine-generation.cron.ts
// Schedule: 30 5 * * * (Asia/Ho_Chi_Minh)
func (h *Handlers) MagazineGeneration(ctx context.Context) (int, error) {
	// TODO(M10): Implement generateForDate for each daily kind:
	// magazine_vocab, magazine_weather, magazine_horoscope, magazine_bjt_phrase
	h.logger.DebugContext(ctx, "magazine_generation: stub — business logic pending")
	return 0, nil
}

// LotoAutopilotLoto6 polls and publishes Loto6 results on draw days.
// Migrated from: apps/api/src/magazine/loto/loto-autopilot.cron.ts
// Schedule: 0,30 21-23 * * 1,4 (Asia/Tokyo)
func (h *Handlers) LotoAutopilotLoto6(ctx context.Context) (int, error) {
	if !h.cfg.LotoAutopilotEnabled {
		h.logger.DebugContext(ctx, "loto_autopilot_loto6: disabled by config")
		return 0, nil
	}
	// TODO(M10): Implement runAutopilotIfResultReady("loto6")
	h.logger.DebugContext(ctx, "loto_autopilot_loto6: stub — business logic pending")
	return 0, nil
}

// LotoAutopilotLoto7 polls and publishes Loto7 results on draw days.
// Migrated from: apps/api/src/magazine/loto/loto-autopilot.cron.ts
// Schedule: 0,30 21-23 * * 5 (Asia/Tokyo)
func (h *Handlers) LotoAutopilotLoto7(ctx context.Context) (int, error) {
	if !h.cfg.LotoAutopilotEnabled {
		h.logger.DebugContext(ctx, "loto_autopilot_loto7: disabled by config")
		return 0, nil
	}
	// TODO(M10): Implement runAutopilotIfResultReady("loto7")
	h.logger.DebugContext(ctx, "loto_autopilot_loto7: stub — business logic pending")
	return 0, nil
}

// LotoAutopilotCatchup recovers missed Loto results after downtime.
// Migrated from: apps/api/src/magazine/loto/loto-autopilot.cron.ts
// Schedule: 15 6 * * * (Asia/Tokyo)
func (h *Handlers) LotoAutopilotCatchup(ctx context.Context) (int, error) {
	if !h.cfg.LotoAutopilotEnabled {
		h.logger.DebugContext(ctx, "loto_autopilot_catchup: disabled by config")
		return 0, nil
	}
	// TODO(M10): Implement catchup tick for both loto6 and loto7
	h.logger.DebugContext(ctx, "loto_autopilot_catchup: stub — business logic pending")
	return 0, nil
}

// PushNotificationDailyKanji sends daily Kanji push notifications to all opted-in users.
// Migrated from: apps/api/src/notifications/push-notification.cron.ts
// Schedule: 0 7 * * * (Asia/Ho_Chi_Minh)
func (h *Handlers) PushNotificationDailyKanji(ctx context.Context) (int, error) {
	// TODO(M10): Implement sendDailyKanjiToAll against notification preferences
	// and push token tables.
	h.logger.DebugContext(ctx, "push_notification_daily_kanji: stub — business logic pending")
	return 0, nil
}

// SmartNotificationPetCare sends pet-care reminders to users with low happiness.
// Migrated from: apps/api/src/notifications/smart-notification.cron.ts
// Schedule: 0 18 * * * (Asia/Ho_Chi_Minh)
func (h *Handlers) SmartNotificationPetCare(ctx context.Context) (int, error) {
	// TODO(M10): Implement sendPetCareReminders (happiness < 30 threshold)
	h.logger.DebugContext(ctx, "smart_notification_pet_care: stub — business logic pending")
	return 0, nil
}

// SmartNotificationStreakSave sends streak-save warnings at 20:00 and 22:00.
// Migrated from: apps/api/src/notifications/smart-notification.cron.ts
// Schedule: 0 20 * * * and 0 22 * * * (Asia/Ho_Chi_Minh)
func (h *Handlers) SmartNotificationStreakSave(ctx context.Context) (int, error) {
	// TODO(M10): Implement sendStreakSaveReminders
	h.logger.DebugContext(ctx, "smart_notification_streak_save: stub — business logic pending")
	return 0, nil
}

// SmartNotificationStudySlot sends hourly study-slot reminders (currently a no-op stub in NestJS).
// Migrated from: apps/api/src/notifications/smart-notification.cron.ts
// Schedule: 0 * * * * (Asia/Ho_Chi_Minh)
func (h *Handlers) SmartNotificationStudySlot(ctx context.Context) (int, error) {
	// Stub: NestJS implementation currently skips this with r.skipped.
	h.logger.DebugContext(ctx, "smart_notification_study_slot: skipped (stub in NestJS)")
	return 0, nil
}

// --- Queue equivalents (stubs — no actual BullMQ processors found in NestJS source) ---

// RecommendationPipeline is the Go equivalent of the conceptual "recommendation" queue.
// No BullMQ processor was found; this is a placeholder for future async work.
func (h *Handlers) RecommendationPipeline(ctx context.Context) (int, error) {
	h.logger.DebugContext(ctx, "recommendation_pipeline: stub — no NestJS processor found")
	return 0, nil
}

// QuizRevengeMode is the Go equivalent of the conceptual "quiz/revenge-mode" queue.
func (h *Handlers) QuizRevengeMode(ctx context.Context) (int, error) {
	h.logger.DebugContext(ctx, "quiz_revenge_mode: stub — no NestJS processor found")
	return 0, nil
}

// OperationsSweep is the Go equivalent of the conceptual "operations" queue.
func (h *Handlers) OperationsSweep(ctx context.Context) (int, error) {
	h.logger.DebugContext(ctx, "operations_sweep: stub — no NestJS processor found")
	return 0, nil
}

// AnalyticsAdmin is the Go equivalent of the conceptual "analytics" queue.
func (h *Handlers) AnalyticsAdmin(ctx context.Context) (int, error) {
	h.logger.DebugContext(ctx, "analytics_admin: stub — no NestJS processor found")
	return 0, nil
}
