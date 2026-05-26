import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MagazineGenerationService } from "./magazine-generation.service.js";

@Injectable()
export class MagazineGenerationCron {
  private readonly logger = new Logger(MagazineGenerationCron.name);

  constructor(
    @Inject(MagazineGenerationService)
    private readonly generation: MagazineGenerationService,
  ) {}

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

  /** Monday + Thursday at 18:30 (Asia/Ho_Chi_Minh) — Loto6 learning article after Japan draw window */
  @Cron("30 18 * * 1,4", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleLoto6Generation() {
    this.logger.log("Starting Loto6 magazine generation…");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.generation.generateForDate("magazine_loto6", today);
      this.logger.log("Loto6 magazine generation complete");
    } catch (e) {
      this.logger.error("Failed to generate Loto6", e instanceof Error ? e.stack : e);
    }
  }

  /** Friday at 18:30 (Asia/Ho_Chi_Minh) — Loto7 learning article after Japan draw window */
  @Cron("30 18 * * 5", { timeZone: "Asia/Ho_Chi_Minh" })
  async handleLoto7Generation() {
    this.logger.log("Starting Loto7 magazine generation…");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.generation.generateForDate("magazine_loto7", today);
      this.logger.log("Loto7 magazine generation complete");
    } catch (e) {
      this.logger.error("Failed to generate Loto7", e instanceof Error ? e.stack : e);
    }
  }
}
