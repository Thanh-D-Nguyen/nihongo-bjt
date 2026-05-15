import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly prisma = createPrismaClient();

  constructor() {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(
        "mailto:support@nihongo-bjt.com",
        vapidPublic,
        vapidPrivate,
      );
    } else {
      this.logger.warn("VAPID keys not set — push notifications disabled");
    }
  }

  /** Subscribe a user to push notifications */
  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId, endpoint: subscription.endpoint },
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500),
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  /** Unsubscribe */
  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  /** Send push to a specific user */
  async sendToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; icon?: string },
  ) {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          )
          .catch(async (err: { statusCode?: number }) => {
            // 410 Gone = subscription expired, clean up
            if (err.statusCode === 410) {
              await this.prisma.pushSubscription
                .delete({ where: { id: sub.id } })
                .catch(() => {});
            }
            throw err;
          }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    return { sent, failed };
  }

  /** Send daily kanji/vocab notification to ALL subscribed users */
  async sendDailyKanjiToAll() {
    const count = await this.prisma.kanji.count({
      where: { status: "active" },
    });
    if (count === 0) {
      this.logger.warn("No kanji available for daily push");
      return { total: 0 };
    }
    const skip = Math.floor(Math.random() * count);
    const kanji = await this.prisma.kanji.findFirst({
      where: { status: "active" },
      skip,
    });
    if (!kanji) return { total: 0 };

    const title = `漢字: ${kanji.character}`;
    const body = `${kanji.onyomi ?? ""} · ${kanji.meaningVi ?? kanji.character}`;
    const payload = {
      title,
      body,
      url: "/daily",
      icon: "/icons/icon-192x192.png",
    };

    // Get all distinct user IDs with subscriptions
    const users = await this.prisma.pushSubscription.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });

    let totalSent = 0;
    for (const { userId } of users) {
      try {
        const r = await this.sendToUser(userId, payload);
        totalSent += r.sent;
      } catch (e) {
        this.logger.warn(`Push failed for user ${userId}: ${e}`);
      }
    }
    return { total: totalSent, kanji: kanji.character };
  }
}
