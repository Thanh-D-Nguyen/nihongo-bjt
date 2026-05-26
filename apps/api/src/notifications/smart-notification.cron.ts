import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { SmartNotificationService } from "./smart-notification.service.js";

/**
 * Cron orchestrator for SmartNotificationService.
 *
 * Schedules (all in Asia/Ho_Chi_Minh local time):
 * - 18:00 — pet-care reminder (early-evening, before user wraps up the day)
 * - 20:00 — first streak-save warning
 * - 22:00 — second streak-save warning (last chance before midnight)
 *
 * Study-slot reminders run hourly but currently no-op (see service stub).
 */
@Injectable()
export class SmartNotificationCron {
  private readonly logger = new Logger(SmartNotificationCron.name);

  constructor(
    @Inject(SmartNotificationService)
    private readonly smart: SmartNotificationService,
  ) {}

  @Cron("0 18 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handlePetCareReminder() {
    try {
      const r = await this.smart.sendPetCareReminders();
      this.logger.log(
        `Pet-care reminder: ${r.sent}/${r.targets} pushed (happiness < 30).`,
      );
    } catch (e) {
      this.logger.error("Pet-care reminder cron failed", e as Error);
    }
  }

  @Cron("0 20 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleStreakSaveEarly() {
    try {
      const r = await this.smart.sendStreakSaveReminders();
      this.logger.log(
        `Streak-save (20:00): ${r.sent}/${r.targets} pushed.`,
      );
    } catch (e) {
      this.logger.error("Streak-save 20:00 cron failed", e as Error);
    }
  }

  @Cron("0 22 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleStreakSaveLast() {
    try {
      const r = await this.smart.sendStreakSaveReminders();
      this.logger.log(
        `Streak-save (22:00 last chance): ${r.sent}/${r.targets} pushed.`,
      );
    } catch (e) {
      this.logger.error("Streak-save 22:00 cron failed", e as Error);
    }
  }

  @Cron("0 * * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleStudySlotHourly() {
    try {
      const r = await this.smart.sendStudySlotReminders();
      if (r.skipped) {
        // Stub — log at debug level to avoid noise once per hour
        this.logger.debug(`Study-slot reminder skipped: ${r.skipped}`);
        return;
      }
      this.logger.log(`Study-slot reminder: ${r.sent}/${r.targets} pushed.`);
    } catch (e) {
      this.logger.error("Study-slot reminder cron failed", e as Error);
    }
  }
}
