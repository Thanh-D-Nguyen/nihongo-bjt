import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { ComebackExperienceService } from "./comeback-experience.service.js";

/**
 * Cron job that runs daily at 10:00 (Asia/Ho_Chi_Minh) to identify users
 * who qualify for a comeback experience. Could trigger push notifications
 * via SmartNotificationService in future integration.
 */
@Injectable()
export class ComebackExperienceCron {
  private readonly logger = new Logger(ComebackExperienceCron.name);

  constructor(
    @Inject(ComebackExperienceService)
    private readonly comeback: ComebackExperienceService,
  ) {}

  @Cron("0 10 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleDailyCheck() {
    try {
      const plans = await this.comeback.findEligibleUsers(50);
      this.logger.log(
        `Comeback check: ${plans.length} eligible users (mild=${plans.filter((p) => p.tier === "mild").length}, ` +
          `serious=${plans.filter((p) => p.tier === "serious").length}, ` +
          `churned=${plans.filter((p) => p.tier === "churned").length})`,
      );
    } catch (e) {
      this.logger.error("Comeback cron failed", e as Error);
    }
  }
}
