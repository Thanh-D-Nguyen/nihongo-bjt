import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { LotoLabService } from "./loto-lab.service.js";
import type { LotoGame } from "./loto-types.js";

/**
 * Automated Loto pipeline with a retry window.
 *
 * Each official draw happens at 18:45 JST; thekyo publishes the result a few
 * hours later. We poll every 30 minutes from 21:00 to 23:30 JST on draw days:
 * download the CSV, and only once today's result has actually landed do we
 * import it, generate predictions for the next draw, and publish a single top
 * set. Until then each tick reports `waiting_result` and retries on the next
 * tick. Once published, later ticks in the same window are no-ops
 * (`already_done`). If the window ends without a result, nothing is published.
 *
 * Enabled by default; set LOTO_AUTOPILOT_ENABLED=false to disable.
 */
@Injectable()
export class LotoAutopilotCron {
  private readonly logger = new Logger(LotoAutopilotCron.name);

  constructor(
    @Inject(LotoLabService)
    private readonly loto: LotoLabService,
  ) {}

  private get enabled(): boolean {
    return process.env.LOTO_AUTOPILOT_ENABLED?.trim().toLowerCase() !== "false";
  }

  private async tick(game: LotoGame) {
    if (!this.enabled) return;
    try {
      const result = await this.loto.runAutopilotIfResultReady(game);
      if (result.status === "waiting_result") {
        this.logger.log(`[autopilot:${game}] result not published yet — will retry on next tick`);
      } else if (result.status === "published") {
        this.logger.log(`[autopilot:${game}] published ${result.publishedSlug} (${result.publishedSet?.join(", ")})`);
      }
      // "already_done" / "skipped_not_draw_day" → silent no-op
    } catch (e) {
      this.logger.error(`[autopilot:${game}] tick failed`, e instanceof Error ? e.stack : e);
    }
  }

  /** Loto6: drawn Mon & Thu 18:45 JST — retry every 30 min, 21:00–23:30 JST. */
  @Cron("0,30 21-23 * * 1,4", { timeZone: "Asia/Tokyo" })
  async handleLoto6() {
    await this.tick("loto6");
  }

  /** Loto7: drawn Fri 18:45 JST — retry every 30 min, 21:00–23:30 JST. */
  @Cron("0,30 21-23 * * 5", { timeZone: "Asia/Tokyo" })
  async handleLoto7() {
    await this.tick("loto7");
  }
}
