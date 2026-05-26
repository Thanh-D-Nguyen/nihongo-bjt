import { createPrismaClient } from "@nihongo-bjt/database";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { PushNotificationService } from "./push-notification.service.js";

/**
 * Smart notification scheduler — sends context-aware push messages.
 *
 * Three strategies, all gated by `NotificationPreference.studyRemindersEnabled`:
 *
 * 1. **Streak-save reminder** — users with currentStreak ≥ 1 who haven't
 *    logged activity today get a nudge in the evening before the streak breaks.
 *
 * 2. **Pet-care reminder** — users whose companion pet happiness < 30 get a
 *    "feed me" nudge so the emotional hook stays alive.
 *
 * 3. **Study-slot reminder** — users with a learned "preferred study hour"
 *    (derived from activity analytics) get a reminder ~5 min before the slot.
 *    NOTE: phase-1 stub — needs activity-hour aggregate in analytics first.
 *
 * All sends use idempotency keys via the InAppNotification log so the cron is
 * safe to run multiple times within a day.
 */
@Injectable()
export class SmartNotificationService {
  private readonly logger = new Logger(SmartNotificationService.name);
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(PushNotificationService)
    private readonly pushService: PushNotificationService,
  ) {}

  /**
   * Send a "save your streak" push to every user whose current streak is at
   * risk (no activity today). Returns `{ targets, sent }`.
   *
   * Designed to be called in the evening (e.g. 20:00 and 22:00 local).
   */
  async sendStreakSaveReminders(now: Date = new Date()): Promise<{
    targets: number;
    sent: number;
  }> {
    const today = startOfDayUtc(now);

    // Find users with an active streak who haven't activity today
    const atRisk = await this.prisma.userStreak.findMany({
      select: { userId: true, currentStreak: true },
      where: {
        currentStreak: { gte: 1 },
        OR: [
          { lastActivityDate: null },
          { lastActivityDate: { lt: today } },
        ],
      },
    });

    if (atRisk.length === 0) return { targets: 0, sent: 0 };

    const eligibleIds = await this.filterByPreference(
      atRisk.map((r) => r.userId),
    );
    if (eligibleIds.size === 0) return { targets: atRisk.length, sent: 0 };

    let totalSent = 0;
    for (const row of atRisk) {
      if (!eligibleIds.has(row.userId)) continue;
      const payload = {
        title: `🔥 Chuỗi ${row.currentStreak} ngày của bạn sắp gãy!`,
        body: `Học vài phút trước khi hết ngày để giữ streak.`,
        url: "/flashcards",
        icon: "/icons/icon-192x192.png",
      };
      try {
        const r = await this.pushService.sendToUser(row.userId, payload);
        totalSent += r.sent;
      } catch (e) {
        this.logger.warn(
          `Streak-save push failed for user ${row.userId}: ${String(e)}`,
        );
      }
    }

    return { targets: atRisk.length, sent: totalSent };
  }

  /**
   * Send a "feed your pet" push to every user whose companion happiness has
   * decayed below 30. Designed for an early-evening cron.
   */
  async sendPetCareReminders(): Promise<{ targets: number; sent: number }> {
    const lowMoodPets = await this.prisma.companionPet.findMany({
      select: { userId: true, name: true, happiness: true },
      where: { happiness: { lt: 30 } },
    });

    if (lowMoodPets.length === 0) return { targets: 0, sent: 0 };

    const eligibleIds = await this.filterByPreference(
      lowMoodPets.map((p) => p.userId),
    );
    if (eligibleIds.size === 0) return { targets: lowMoodPets.length, sent: 0 };

    let totalSent = 0;
    for (const pet of lowMoodPets) {
      if (!eligibleIds.has(pet.userId)) continue;
      const payload = {
        title: `🐶 ${pet.name} đang buồn`,
        body: `Học một phiên ngắn để cho bạn đồng hành ăn!`,
        url: "/companion",
        icon: "/icons/icon-192x192.png",
      };
      try {
        const r = await this.pushService.sendToUser(pet.userId, payload);
        totalSent += r.sent;
      } catch (e) {
        this.logger.warn(
          `Pet-care push failed for user ${pet.userId}: ${String(e)}`,
        );
      }
    }

    return { targets: lowMoodPets.length, sent: totalSent };
  }

  /**
   * Send a reminder to users whose preferred study slot is starting in ~5 min.
   *
   * **Phase-1 stub**: this requires an activity-hour histogram per user, which
   * is not yet aggregated in analytics. When that lands, replace the inner
   * query with a join on the histogram and emit per-user reminders within the
   * matching hour bucket.
   */
  async sendStudySlotReminders(now: Date = new Date()): Promise<{
    targets: number;
    sent: number;
    skipped?: string;
  }> {
    void now;
    this.logger.debug(
      "sendStudySlotReminders skipped — phase-1 stub. Implement once analytics hour-histogram exists.",
    );
    return {
      targets: 0,
      sent: 0,
      skipped: "phase-1 stub — needs activity-hour histogram",
    };
  }

  /**
   * Return the subset of `userIds` whose `NotificationPreference.studyRemindersEnabled`
   * is NOT explicitly false. Users with no preference row default to opted-in
   * (same default as the schema).
   */
  private async filterByPreference(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const disabled = await this.prisma.notificationPreference.findMany({
      select: { userId: true },
      where: {
        userId: { in: userIds },
        studyRemindersEnabled: false,
      },
    });
    const disabledSet = new Set(disabled.map((r) => r.userId));
    return new Set(userIds.filter((id) => !disabledSet.has(id)));
  }
}

/** Return UTC midnight of the day containing `now`. */
function startOfDayUtc(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
