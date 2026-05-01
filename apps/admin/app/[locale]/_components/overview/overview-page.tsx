"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { loadOverviewBundle } from "@/lib/admin-overview-fetch";
import { mapAuditActionLabelI18nKey } from "@/lib/admin-overview-mappers";
import type { AdminAnalyticsExecutiveResponse, DateRangeKey } from "@/lib/admin-overview-types";
import { readClientAdminFeatureFlags } from "@/lib/admin-feature-flags";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

import { ActivityTrendChart } from "./activity-chart";
import { ExecutiveKpiGrid } from "./overview-kpis";
import { OverviewDashboardHeader, readRangeFromSearchParams } from "./overview-header";
import {
  ActionCenter,
  ContentOperationsPanel,
  LearningHealthPanel,
  ProductInsightsGrid,
  QuickActionsGrid,
  RecentAuditTable,
  SystemHealthPanel
} from "./overview-sections";

type Messages = {
  common: { empty: string; noChart: string; loading: string; error: string; deltaFormat: (pct: string) => string };
  d: Record<string, string>;
  overviewLegacy: { error: string; loading: string; notAvailable: string; subtitle: string; title: string };
};

function can(p: Set<string> | null, codes: string[]) {
  if (!p) {
    return true;
  }
  return codes.some((c) => p.has(c));
}

function resolveEnv(): "local" | "production" | "staging" {
  const v = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (v === "production") {
    return "production";
  }
  if (v === "preview") {
    return "staging";
  }
  const a = process.env.NEXT_PUBLIC_APP_ENV;
  if (a === "staging") {
    return "staging";
  }
  return "local";
}

function Inner({ locale, m }: { locale: "en" | "ja" | "vi"; m: Messages }) {
  const sp = useSearchParams();
  const rangeDays: DateRangeKey = readRangeFromSearchParams(sp);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadOverviewBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [permCount, setPermCount] = useState<number | null>(null);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const d = m.d;

  const load = useCallback(async () => {
    setLoading(true);
    let p: string[] | null = null;
    try {
      const me = await adminApiFetch("/api/admin/me");
      if (me.ok) {
        const body = (await me.json()) as MePayload;
        const codes = permsFromMe(body);
        p = [...codes];
        setPermCount(codes.size);
        setPerms(codes);
      }
    } catch {
      setPermCount(null);
      setPerms(null);
    }
    const loaded = await loadOverviewBundle({ days: rangeDays, permissions: p });
    setData(loaded);
    setLoading(false);
  }, [rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = data?.analytics as AdminAnalyticsExecutiveResponse | null;
  const lastUpdated = analytics?.executive?.kpi?.dataFreshness?.completedAt ?? analytics?.executive?.lastRollup?.completedAt ?? null;

  const kpiItems = useMemo(() => {
    if (!analytics?.executive?.kpi) {
      return [];
    }
    const k = analytics.executive.kpi;
    const prevTot = analytics.executive.previousMetricTotals;
    const fmtInt = (v: { available: boolean; value: number | null }) =>
      v.available && v.value != null ? v.value.toLocaleString() : m.overviewLegacy.notAvailable;
    const searchCur = Number(analytics.metricTotals["content.search_events"] ?? 0);
    const searchPrev = Number(prevTot["content.search_events"] ?? 0);
    const searchDr =
      searchPrev > 0 ? (searchCur - searchPrev) / searchPrev : searchPrev === 0 && searchCur > 0 ? 1 : null;
    const by = analytics.executive.mauDauWau?.byDay ?? [];
    const searchSpark = by.map((r) => r.searchEventsRollup);
    return [
      {
        deltaKey: "up" as const,
        formatValue: (x: (typeof k)["mau"]) => fmtInt(x),
        helper: d.kpi_mauHelp,
        href: `/${locale}/users`,
        kpi: k.mau,
        label: d.kpi_mau
      },
      {
        deltaKey: "up" as const,
        formatValue: (x: (typeof k)["newUsers"]) => fmtInt(x),
        helper: d.kpi_newHelp,
        href: `/${locale}/users`,
        kpi: k.newUsers,
        label: d.kpi_new
      },
      {
        deltaKey: "up" as const,
        formatValue: (x: (typeof k)["flashcardReviews"]) => fmtInt(x),
        helper: d.kpi_reviewsHelp,
        href: `/${locale}/decks`,
        kpi: k.flashcardReviews,
        label: d.kpi_reviews
      },
      {
        deltaKey: "up" as const,
        formatValue: (x: (typeof k)["bjtCompletions"]) => fmtInt(x),
        helper: d.kpi_quizHelp,
        href: `/${locale}/bjt`,
        kpi: k.bjtCompletions,
        label: d.kpi_quiz
      },
      {
        deltaKey: "up" as const,
        formatValue: () => searchCur.toLocaleString(),
        helper: d.kpi_searchHelp,
        href: `/${locale}/analytics/search`,
        kpi: {
          available: true,
          deltaRatio: searchDr,
          format: "int" as const,
          previous: searchPrev,
          sparkline: searchSpark,
          value: searchCur
        },
        label: d.kpi_search
      },
      {
        deltaKey: "up" as const,
        formatValue: () => analytics?.activeContentCount.toLocaleString() ?? "—",
        helper: d.kpi_contentHelp,
        href: `/${locale}/content`,
        kpi: {
          available: true,
          deltaRatio: null,
          format: "int" as const,
          previous: null,
          sparkline: null,
          value: analytics?.activeContentCount ?? 0
        },
        label: d.kpi_content
      }
    ];
  }, [analytics, d, m.overviewLegacy.notAvailable, locale]);

  const activityRows = useMemo(() => {
    const by = analytics?.executive?.mauDauWau?.byDay;
    if (!by?.length) {
      return [];
    }
    return by.map((r) => ({
      dau: r.dau,
      day: r.day,
      reviews: r.reviews,
      search: r.searchEventsRollup,
      sessions: r.bjtCompletions
    }));
  }, [analytics]);

  const actionItems = useMemo(() => {
    const ex = analytics?.executive;
    const insights = ex?.insights;
    const by = data?.contentLexeme?.byStatus;
    const review = by?.needs_review ?? 0;
    const out: Array<{ count: number; id: string; perm: string; route: string } | null> = [];
    if (review > 0 && can(perms, ["admin.content.read"])) {
      out.push({
        count: review,
        id: "contentReview",
        perm: "admin.content.read",
        route: `/${locale}/dictionary`
      });
    }
    if (insights?.freshnessStale) {
      out.push({
        count: 1,
        id: "rollup",
        perm: "viewer.analytics",
        route: `/${locale}/ops/feature-flags`
      });
    }
    if (insights?.searchZeroShare != null && insights.searchZeroShare > 0.2) {
      out.push({
        count: Math.round(insights.searchZeroShare * 100),
        id: "searchZero",
        perm: "viewer.analytics",
        route: `/${locale}/analytics/search`
      });
    }
    return out;
  }, [analytics?.executive, data?.contentLexeme?.byStatus, locale, perms]);

  const insightCards = useMemo(() => {
    const ex = analytics?.executive;
    if (!ex) {
      return [null, null, null, null, null];
    }
    const z = ex.insights?.searchZeroShare;
    return [
      z != null
        ? {
            body: d.insight_zeroBody.replace("{pct}", String(Math.round(z * 100))),
            id: "zero",
            title: d.insight_zeroTitle
          }
        : null,
      ex.insights?.freshnessStale
        ? { body: d.insight_rollupBody, id: "rollup", title: d.insight_rollupTitle }
        : null,
      ex.kpi.d7.value != null
        ? { body: d.insight_d7Body.replace("{pct}", String(Math.round(ex.kpi.d7.value * 100))), id: "d7", title: d.insight_d7Title }
        : null,
      null,
      null
    ];
  }, [analytics?.executive, d]);

  const searchRate = analytics?.executive?.kpi?.searchSuccessRate
    ? { available: analytics.executive.kpi.searchSuccessRate.available, value: analytics.executive.kpi.searchSuccessRate.value }
    : null;

  const flags = useMemo(() => readClientAdminFeatureFlags(), []);
  const showBattle = flags["adminNav.battle"] !== false;

  const quickActions = useMemo(() => {
    const b = `/${locale}`;
    return [
      can(perms, ["admin.content.write", "admin.content.read"])
        ? { href: `${b}/dictionary`, id: "lex", label: d.qa_lex }
        : null,
      can(perms, ["admin.content.read", "operator.import"]) ? { href: `${b}/import`, id: "imp", label: d.qa_import } : null,
      can(perms, ["admin.content.read"]) ? { href: `${b}/content/enrichment`, id: "enr", label: d.qa_enrich } : null,
      can(perms, ["viewer.audit"]) ? { href: `${b}/audit`, id: "aud", label: d.qa_audit } : null,
      can(perms, ["iam.manage"]) ? { href: `${b}/ops/feature-flags`, id: "ff", label: d.qa_ff } : null,
      can(perms, ["iam.manage", "admin.content.read"]) ? { href: `${b}/ops/dead-letters`, id: "dlq", label: d.qa_dlq } : null,
      can(perms, ["admin.monetization.read"])
        ? { href: `${b}/monetization`, id: "mon", label: d.qa_mon }
        : null,
      showBattle && can(perms, ["admin.content.read"]) ? { href: `${b}/battle/configs`, id: "bat", label: d.qa_battle } : null
    ];
  }, [d, locale, perms, showBattle]);

  const resolveAudit = useCallback(
    (raw: string) => {
      const key = mapAuditActionLabelI18nKey(raw);
      const label = d[key];
      return label && label.length > 0 ? label : raw;
    },
    [d]
  );

  const errorBanner = data?.analyticsError ? (
    <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-900">{m.overviewLegacy.error}</div>
  ) : null;
  const noAnalyticsPerms = data?.analyticsForbidden ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">{d.analyticsForbidden}</div>
  ) : null;

  const degraded = data?.partialDegradation;

  return (
    <div className="space-y-8">
      <OverviewDashboardHeader
        envName={resolveEnv()}
        lastUpdatedAt={lastUpdated}
        labels={{
          customScaffold: d.header_custom,
          customTooltip: d.header_customHint,
          dataFresh: d.header_dataFresh,
          envBadge: d.header_env,
          envLocal: d.env_local,
          envProd: d.env_prod,
          envStaging: d.env_staging,
          lastUpdated: d.header_lastUp,
          never: d.header_never,
          rbacBadge: d.header_rbac,
          refresh: d.header_refresh,
          subtitle: m.overviewLegacy.subtitle,
          title: m.overviewLegacy.title
        }}
        locale={locale}
        onRefresh={() => void load()}
        permissionCount={permCount}
        rangeDays={rangeDays}
      />

      {degraded ? <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">{d.degradedBanner}</div> : null}
      {errorBanner}
      {noAnalyticsPerms}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">{m.common.loading}</div>
      ) : null}

      {!loading && !data?.analyticsForbidden && analytics ? (
        <>
          <ExecutiveKpiGrid
            common={{ deltaFormat: m.common.deltaFormat, deltaNA: d.deltaNA }}
            items={kpiItems}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <ActivityTrendChart
                commonNoChart={m.common.noChart}
                data={activityRows}
                labels={{
                  dau: d.chart_dau,
                  review: d.chart_reviews,
                  search: d.chart_search,
                  seriesHint: d.chart_hint,
                  session: d.chart_sessions,
                  title: d.chart_title
                }}
                loading={false}
              />
            </div>
            <div className="space-y-6">
              <LearningHealthPanel
                basePath={`/${locale}`}
                labels={{
                  avgAccuracy: d.lh_accuracy,
                  avgAccuracyNA: d.lh_accuracyNA,
                  cta: d.lh_cta,
                  reviewCompletion: d.lh_reviewRate,
                  reviewCompletionNA: d.lh_reviewNA,
                  searchSuccess: d.lh_search,
                  streak: d.lh_streak,
                  streakNA: d.lh_streakNA,
                  studyMinutes: d.lh_minutes,
                  studyMinutesNA: d.lh_minutesNA,
                  title: d.lh_title
                }}
                searchRate={searchRate}
                studyUnavailable
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ContentOperationsPanel
              basePath={`/${locale}`}
              enrichmentLabel={d.content_enrichNA}
              importLabel={d.content_importNA}
              labels={{
                cardStatus: d.content_cardStatus,
                dictPublished: d.co_dict,
                draftQueue: d.co_draft,
                enrichmentPending: d.co_enrich,
                importJobs: d.co_import,
                mediaPending: d.co_media,
                open: d.co_open,
                searchSync: d.co_meili,
                subtitle: d.co_sub,
                title: d.co_title
              }}
              lexemeByStatus={data?.contentLexeme?.byStatus ?? null}
              meiliInsight={d.co_meiliHint}
              mediaLabel={d.co_mediaNA}
            />
            <div className="space-y-6">
              <SystemHealthPanel
                health={data?.health ?? null}
                healthError={data?.healthError ?? true}
                labels={{
                  backupNA: d.sys_backup,
                  degradedHint: d.sys_degraded,
                  health_degraded: d.health_degraded,
                  health_down: d.health_down,
                  health_healthy: d.health_healthy,
                  health_unknown: d.health_unknown,
                  hint: d.sys_hint,
                  openapiNA: d.sys_openapi,
                  row_api: d.sys_row_api,
                  row_db: d.sys_row_db,
                  row_keycloak: d.sys_row_kc,
                  row_meili: d.sys_row_meili,
                  row_redis: d.sys_row_redis,
                  row_storage: d.sys_row_storage,
                  row_worker: d.sys_row_worker,
                  title: d.sys_title
                }}
              />
              <ActionCenter
                items={actionItems}
                labels={{
                  countLabel: d.ac_count,
                  emptyEncourage: d.ac_empty,
                  open: d.ac_open,
                  perm: d.ac_perm,
                  task_contentReview: d.ac_t_review,
                  task_rollup: d.ac_t_rollup,
                  task_searchZero: d.ac_t_search,
                  title: d.ac_title
                }}
              />
            </div>
          </div>

          <ProductInsightsGrid
            cards={insightCards}
            labels={{ empty: d.ins_empty, title: d.ins_title }}
          />

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{d.qa_heading}</h2>
            <QuickActionsGrid actions={quickActions} />
          </div>

          <RecentAuditTable
            basePath={`/${locale}`}
            common={{ empty: m.common.empty }}
            labels={{
              colAction: d.audit_colAction,
              colActor: d.audit_colActor,
              colReason: d.audit_colReason,
              colSeverity: d.audit_colSev,
              colTarget: d.audit_colTarget,
              colTime: d.audit_colTime,
              forbidden: d.audit_forbidden,
              seeAll: d.audit_seeAll,
              title: d.audit_title
            }}
            resolveActionLabel={resolveAudit}
            rows={data?.auditForbidden ? null : (data?.audit ?? [])}
          />
        </>
      ) : null}
    </div>
  );
}

export function OverviewPageRoot({ locale, messages }: { locale: "en" | "ja" | "vi"; messages: Messages }) {
  return (
    <Suspense fallback={<div className="rounded-lg border border-slate-200 bg-white p-8 text-slate-600">{messages.common.loading}</div>}>
      <Inner key="ov" locale={locale} m={messages} />
    </Suspense>
  );
}
