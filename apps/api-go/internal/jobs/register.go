package jobs

import "fmt"

// RegisterAll registers every migrated cron job on the scheduler.
// It is the single wiring point between handler implementations and
// the cron infrastructure, keeping schedule definitions co-located
// with their migration metadata.
func RegisterAll(s *Scheduler, h *Handlers) error {
	// --- Asia/Ho_Chi_Minh (ICT, UTC+7) jobs ---

	if err := s.Register("comeback_experience", "0 0 10 * * *", h.ComebackExperience); err != nil {
		return fmt.Errorf("register comeback_experience: %w", err)
	}

	if err := s.Register("magazine_generation", "0 30 5 * * *", h.MagazineGeneration); err != nil {
		return fmt.Errorf("register magazine_generation: %w", err)
	}

	if err := s.Register("push_notification_daily_kanji", "0 0 7 * * *", h.PushNotificationDailyKanji); err != nil {
		return fmt.Errorf("register push_notification_daily_kanji: %w", err)
	}

	if err := s.Register("smart_notification_pet_care", "0 0 18 * * *", h.SmartNotificationPetCare); err != nil {
		return fmt.Errorf("register smart_notification_pet_care: %w", err)
	}

	if err := s.Register("smart_notification_streak_save_early", "0 0 20 * * *", h.SmartNotificationStreakSave); err != nil {
		return fmt.Errorf("register smart_notification_streak_save_early: %w", err)
	}

	if err := s.Register("smart_notification_streak_save_last", "0 0 22 * * *", h.SmartNotificationStreakSave); err != nil {
		return fmt.Errorf("register smart_notification_streak_save_last: %w", err)
	}

	if err := s.Register("smart_notification_study_slot", "0 0 * * * *", h.SmartNotificationStudySlot); err != nil {
		return fmt.Errorf("register smart_notification_study_slot: %w", err)
	}

	// --- Asia/Tokyo (JST, UTC+9) jobs ---

	if err := s.RegisterWithTimezone("loto_autopilot_loto6", "0,30 21-23 * * 1,4", "Asia/Tokyo", h.LotoAutopilotLoto6); err != nil {
		return fmt.Errorf("register loto_autopilot_loto6: %w", err)
	}

	if err := s.RegisterWithTimezone("loto_autopilot_loto7", "0,30 21-23 * * 5", "Asia/Tokyo", h.LotoAutopilotLoto7); err != nil {
		return fmt.Errorf("register loto_autopilot_loto7: %w", err)
	}

	if err := s.RegisterWithTimezone("loto_autopilot_catchup", "15 6 * * *", "Asia/Tokyo", h.LotoAutopilotCatchup); err != nil {
		return fmt.Errorf("register loto_autopilot_catchup: %w", err)
	}

	return nil
}