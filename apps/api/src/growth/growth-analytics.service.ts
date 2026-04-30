import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

type ReferralShareAnalytics = {
  funnel: {
    referralLinkViews: number;
    referralSignups: number;
    shareItemsCreated: number;
    shareItemsFromOptedInUsers: number;
  };
  integrity: {
    shareEventsWithoutOptIn: number;
  };
  privacyBoundary: {
    aggregateOnly: true;
    excludedFields: string[];
  };
  range: {
    days: number;
    end: Date;
    start: Date;
  };
  rates: {
    sharePerReferralSignup: number | null;
    signupFromReferralView: number | null;
  };
  seriesByDay: Array<{
    day: string;
    referralLinkViews: number;
    referralSignups: number;
    shareItemsCreated: number;
  }>;
};

@Injectable()
export class GrowthAnalyticsService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async referralShareFunnel(days: number): Promise<ReferralShareAnalytics> {
    const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 90) : 30;
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - safeDays);

    const [byName, optedInShareEvents, shareEventsWithoutOptIn, byDay] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ["eventName"],
        _count: { _all: true },
        where: {
          createdAt: { gte: start, lt: end },
          eventName: { in: ["referral_link_view", "referral_signup", "share_item_created"] }
        }
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        select count(*)::bigint as count
        from analytics.analytics_event e
        join profile.user_profile p on p.id = e.user_id
        where e.event_name = 'share_item_created'
          and e.created_at >= ${start}
          and e.created_at < ${end}
          and p.share_postcard_opt_in = true
      `,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        select count(*)::bigint as count
        from analytics.analytics_event e
        left join profile.user_profile p on p.id = e.user_id
        where e.event_name = 'share_item_created'
          and e.created_at >= ${start}
          and e.created_at < ${end}
          and coalesce(p.share_postcard_opt_in, false) = false
      `,
      this.prisma.$queryRaw<
        { day: string; referral_link_view: bigint; referral_signup: bigint; share_item_created: bigint }[]
      >`
        select
          (created_at at time zone 'UTC')::date::text as day,
          count(*) filter (where event_name = 'referral_link_view')::bigint as referral_link_view,
          count(*) filter (where event_name = 'referral_signup')::bigint as referral_signup,
          count(*) filter (where event_name = 'share_item_created')::bigint as share_item_created
        from analytics.analytics_event
        where created_at >= ${start}
          and created_at < ${end}
          and event_name in ('referral_link_view', 'referral_signup', 'share_item_created')
        group by 1
        order by 1 asc
      `
    ]);

    const counts = new Map<string, number>(
      byName.map((row) => [row.eventName, row._count._all])
    );

    const referralLinkViews = counts.get("referral_link_view") ?? 0;
    const referralSignups = counts.get("referral_signup") ?? 0;
    const shareItemsCreated = counts.get("share_item_created") ?? 0;
    const shareItemsFromOptedInUsers = Number(optedInShareEvents[0]?.count ?? 0n);
    const shareEventsWithoutOptInCount = Number(shareEventsWithoutOptIn[0]?.count ?? 0n);

    return {
      funnel: {
        referralLinkViews,
        referralSignups,
        shareItemsCreated,
        shareItemsFromOptedInUsers
      },
      integrity: {
        shareEventsWithoutOptIn: shareEventsWithoutOptInCount
      },
      privacyBoundary: {
        aggregateOnly: true,
        excludedFields: [
          "analytics_event.user_id",
          "analytics_event.anonymous_id",
          "analytics_event.session_id",
          "analytics_event.payload.publicToken",
          "analytics_event.payload.code"
        ]
      },
      range: { days: safeDays, end, start },
      rates: {
        sharePerReferralSignup:
          referralSignups > 0 ? Math.round((shareItemsCreated / referralSignups) * 10000) / 10000 : null,
        signupFromReferralView:
          referralLinkViews > 0 ? Math.round((referralSignups / referralLinkViews) * 10000) / 10000 : null
      },
      seriesByDay: byDay.map((row) => ({
        day: row.day,
        referralLinkViews: Number(row.referral_link_view),
        referralSignups: Number(row.referral_signup),
        shareItemsCreated: Number(row.share_item_created)
      }))
    };
  }
}
