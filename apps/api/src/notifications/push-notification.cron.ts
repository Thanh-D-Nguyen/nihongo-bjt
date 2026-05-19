import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PushNotificationService } from "./push-notification.service.js";

@Injectable()
export class PushNotificationCron {
  private readonly logger = new Logger(PushNotificationCron.name);

  constructor(private readonly pushService: PushNotificationService) {}

  /** Run daily at 7:00 AM (Asia/Ho_Chi_Minh) */
  @Cron("0 7 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleDailyKanjiPush() {
    this.logger.log("Starting daily Kanji push notification job…");
    try {
      const result = await this.pushService.sendDailyKanjiToAll();
      this.logger.log(
        `Daily Kanji push done: ${result.total} sent, kanji=${(result as { kanji?: string }).kanji ?? "none"}`,
      );
    } catch (e) {
      this.logger.error("Daily Kanji push failed", e);
    }
  }
}
