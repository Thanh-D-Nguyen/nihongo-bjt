import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import {
  type AnalyticsBreakdownRow,
  type AnalyticsCommonFilter,
  type AnalyticsKpi,
  type AnalyticsTimeseriesPoint,
  buildKpi,
  dayBucketsBetween,
  resolveAnalyticsRange
} from "./analytics-admin.shared.js";

const DOMAIN = "content";

/**
 * Content analytics. Real metrics for active content inventory and engagement-by-type
 * (lexeme/kanji/grammar/example), plus card-link counts as a proxy for content engagement
 * until a dedicated content_impression rollup lands.
 */
@Injectable()
export class AnalyticsContentAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter) {
    const r = resolveAnalyticsRange(filter);
    const [lexemeActive, kanjiActive, grammarActive, exampleActive, cardLinks, cardLinksPrev, latestRun] =
      await Promise.all([
        this.prisma.lexeme.count({ where: { status: "active" } }),
        this.prisma.kanji.count({ where: { status: "active" } }),
        this.prisma.grammarPoint.count({ where: { status: "active" } }),
        this.prisma.exampleSentence.count({ where: { status: "active" } }),
        this.prisma.cardMediaLink.count({ where: { createdAt: { gte: r.from, lt: r.to } } }),
        this.prisma.cardMediaLink.count({
          where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } }
        }),
        this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } })
      ]);
    const total = lexemeActive + kanjiActive + grammarActive + exampleActive;

    return {
      domain: DOMAIN,
      filtersApplied: {},
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "content.lexeme,content.kanji,content.grammar_point,content.example_sentence",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "contentItemsActive", previous: null, value: total }),
        buildKpi({ format: "int", id: "lexemeActive", previous: null, value: lexemeActive }),
        buildKpi({ format: "int", id: "kanjiActive", previous: null, value: kanjiActive }),
        buildKpi({ format: "int", id: "grammarActive", previous: null, value: grammarActive }),
        buildKpi({ format: "int", id: "newCardLinks", previous: cardLinksPrev, value: cardLinks })
      ],
      notices: ["partial_schema_pending: per_content_impressions_and_completion_require_dedicated_rollup"],
      range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() }
    };
  }

  async timeseries(filter: AnalyticsCommonFilter & { metric: string; granularity: "day" | "hour" }) {
    const r = resolveAnalyticsRange(filter);
    if (filter.granularity !== "day") {
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        notice: "granularity_not_supported",
        series: [] as AnalyticsTimeseriesPoint[]
      };
    }
    const days = dayBucketsBetween(r.from, r.to);
    if (filter.metric === "card_links_created") {
      const rows = await this.prisma.cardMediaLink.findMany({
        select: { createdAt: true },
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const r0 of rows) {
        const k = r0.createdAt.toISOString().slice(0, 10);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => ({ t: d, value: m.get(d) ?? 0 }))
      };
    }
    if (filter.metric === "lexeme_added") {
      const rows = await this.prisma.lexeme.findMany({
        select: { createdAt: true },
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const r0 of rows) {
        const k = r0.createdAt.toISOString().slice(0, 10);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => ({ t: d, value: m.get(d) ?? 0 }))
      };
    }
    return {
      domain: DOMAIN,
      granularity: filter.granularity,
      metric: filter.metric,
      notice: "unknown_metric",
      series: [] as AnalyticsTimeseriesPoint[]
    };
  }

  async breakdown(filter: AnalyticsCommonFilter & { dimension: string; page: number; pageSize: number }) {
    if (filter.dimension === "by_type") {
      const [lex, kan, gra, exa] = await Promise.all([
        this.prisma.lexeme.count({ where: { status: "active" } }),
        this.prisma.kanji.count({ where: { status: "active" } }),
        this.prisma.grammarPoint.count({ where: { status: "active" } }),
        this.prisma.exampleSentence.count({ where: { status: "active" } })
      ]);
      const out: AnalyticsBreakdownRow[] = [
        { type: "lexeme", count: lex },
        { type: "kanji", count: kan },
        { type: "grammar", count: gra },
        { type: "example", count: exa }
      ];
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    if (filter.dimension === "by_lexeme_status") {
      const rows = await this.prisma.lexeme.groupBy({
        _count: { _all: true },
        by: ["status"]
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, status: r0.status }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    // top_engaged: top cards by media link count (proxy)
    const list = await this.prisma.cardMediaLink.groupBy({
      _count: { _all: true },
      by: ["cardId"],
      orderBy: { _count: { cardId: "desc" } },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize
    });
    const out: AnalyticsBreakdownRow[] = list.map((r0) => ({ cardId: r0.cardId, links: r0._count._all }));
    const totalRow = await this.prisma.cardMediaLink.groupBy({ _count: { _all: true }, by: ["cardId"] });
    return {
      dimension: filter.dimension || "top_engaged",
      domain: DOMAIN,
      page: filter.page,
      pageSize: filter.pageSize,
      rows: out,
      total: totalRow.length
    };
  }
}
