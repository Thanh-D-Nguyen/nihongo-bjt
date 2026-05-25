import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MagazineGenerationService } from "./magazine-generation.service.js";

@Injectable()
export class MagazineGenerationCron {
  private readonly logger = new Logger(MagazineGenerationCron.name);

  constructor(private readonly generation: MagazineGenerationService) {}

  /** Daily at 05:30 AM (Asia/Ho_Chi_Minh) — generate vocab, weather, horoscope, BJT phrase */
  @Cron("30 5 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleDailyGeneration() {
    this.logger.log("Starting daily magazine generation…");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyKinds = ["magazine_vocab", "magazine_weather", "magazine_horoscope", "magazine_bjt_phrase"];

    for (const kind of dailyKinds) {
      try {
        await this.generation.generateForDate(kind, today);
      } catch (e) {
        this.logger.error(`Failed to generate ${kind}`, e instanceof Error ? e.stack : e);
      }
    }

    this.logger.log("Daily magazine generation complete");
  }

  /** Monday + Thursday at 17:00 (Asia/Ho_Chi_Minh) — loto prediction */
  @Cron("0 17 * * 1,4", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleLotoGeneration() {
    this.logger.log("Starting loto prediction generation…");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.generation.generateForDate("magazine_loto", today);
      this.logger.log("Loto prediction generation complete");
    } catch (e) {
      this.logger.error("Failed to generate loto", e instanceof Error ? e.stack : e);
    }
  }
}
