"use client";

import {
  AdminChartCard,
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
  AdminTaskCard,
  cn
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe } from "@/app/_components/admin-client-utils";

const CHART_COLORS = ["#4f46e5", "#059669", "#d97706", "#64748b", "#7c3aed"];

type MeResponse = {
  roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
};

type Common = {
  action: string;
  error: string;
  loading: string;
  records: string;
  status: string;
  updatedAt: string;
};

type AdsConsoleLabels = {
  audit: { action: string; empty: string; title: string };
  cancel: string;
  campaigns: Record<string, string>;
  charts: Record<string, string>;
  create: string;
  desc: string;
  disabled: string;
  edit: string;
  emptyData: string;
  enabled: string;
  error: string;
  kpi: Record<string, string>;
  loading: string;
  noPermission: string;
  performance: Record<string, string>;
  placements: Record<string, string>;
  privacyNote: string;
  providers: Record<string, string>;
  reasonLabel: string;
  reasonPlaceholder: string;
  refresh: string;
  rules: Record<string, string>;
  save: string;
  tasks: Record<string, string>;
  tabs: Record<string, string>;
  title: string;
};

const TAB_ORDER = [
  "overview",
  "placements",
  "campaigns",
  "providers",
  "rules",
  "performance",
  "audit"
] as const;
type TabId = (typeof TAB_ORDER)[number];

type AdsDrawerState =
  | { kind: "placement"; mode: "create" | "edit"; row: Record<string, unknown> }
  | { kind: "campaign"; mode: "create" | "edit"; row: Record<string, unknown> }
  | { kind: "provider"; row: Record<string, unknown> }
  | { kind: "rule"; row: Record<string, unknown> };

type OverviewApi = {
  activeCampaigns?: number;
  blocked7d?: number;
  chartCtrByPlacement?: { clicks: number; code: string; ctr: number; impressions: number }[];
  chartTrend?: { clicks: number; day: string; impressions: number }[];
  clicks7d?: number;
  ctr?: number;
  enabledPlacements?: number;
  impressions7d?: number;
  policyWarnings?: number;
  providersEnabled?: number;
  revenue?: { available: boolean; messageKey?: string };
  blockedByReason?: { count: number; reason: string }[];
};

type TasksApi = {
  campaignsEndingSoon: { endAt: string | null; id: string; name: string; status: string }[];
  disabledProviders: { enabled: boolean; key: string; type: string }[];
  placementsWithoutProvider: string[];
  policyWarnings: { id: string; name: string; policyStatus: string }[];
};

function pct(n: number) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  return `${(n * 100).toFixed(2)}%`;
}

export function AdsConsoleClient({ common, labels }: { common: Common; labels: AdsConsoleLabels }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [ov, setOv] = useState<OverviewApi | null>(null);
  const [tasks, setTasks] = useState<TasksApi | null>(null);
  const [placements, setPlacements] = useState<unknown[] | null>(null);
  const [campaigns, setCampaigns] = useState<unknown[] | null>(null);
  const [providers, setProviders] = useState<unknown[] | null>(null);
  const [rules, setRules] = useState<unknown[] | null>(null);
  const [perf, setPerf] = useState<unknown | null>(null);
  const [audit, setAudit] = useState<unknown[] | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [drawer, setDrawer] = useState<AdsDrawerState | null>(null);

  const can = useCallback(
    (candidates: string[]) => {
      if (!perms) {
        return false;
      }
      return candidates.some((c) => perms.has(c));
    },
    [perms]
  );
  const canRead = can([
    "admin.monetization.read",
    "ads.placement.view",
    "ads.campaign.view",
    "ads.provider.view",
    "ads.performance.view"
  ]);
  const canPlacements = can(["admin.monetization.write", "ads.placement.manage"]);
  const canCampaigns = can(["admin.monetization.write", "ads.campaign.manage"]);
  const canProviders = can(["admin.monetization.write", "ads.provider.manage"]);
  const canRules = can(["admin.monetization.write", "ads.rules.manage"]);
  const canAudit = can(["admin.monetization.read", "ads.audit.view", "viewer.audit"]);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const me = await adminApiFetch("/api/admin/me");
      if (me.ok) {
        setPerms(permsFromMe((await me.json()) as MeResponse));
      } else {
        setPerms(new Set());
      }
      const [oRes, pRes, cRes, prRes, rRes, pfRes, aRes] = await Promise.all([
        adminApiFetch("/api/admin/ads/overview?days=7"),
        adminApiFetch("/api/admin/ads/placements"),
        adminApiFetch("/api/admin/ads/campaigns"),
        adminApiFetch("/api/admin/ads/providers"),
        adminApiFetch("/api/admin/ads/rules"),
        adminApiFetch("/api/admin/ads/performance?days=7"),
        adminApiFetch("/api/admin/ads/audit?limit=80")
      ]);
      if (oRes.ok) {
        const o = (await oRes.json()) as { overview: OverviewApi; tasks: TasksApi };
        setOv(o.overview);
        setTasks(o.tasks);
      } else {
        setLoadErr(common.error);
      }
      if (pRes.ok) {
        setPlacements((await pRes.json()) as unknown[]);
      }
      if (cRes.ok) {
        setCampaigns((await cRes.json()) as unknown[]);
      }
      if (prRes.ok) {
        setProviders((await prRes.json()) as unknown[]);
      }
      if (rRes.ok) {
        setRules((await rRes.json()) as unknown[]);
      }
      if (pfRes.ok) {
        setPerf(await pfRes.json());
      }
      if (aRes.ok) {
        setAudit((await aRes.json()) as unknown[]);
      } else {
        setAudit(null);
      }
      setLastSync(new Date().toISOString());
    } catch {
      setPerms((prev) => prev ?? new Set());
      setLoadErr(common.error);
    }
  }, [common.error]);

  useEffect(() => {
    void load();
  }, [load]);

  const trendData = useMemo(
    () =>
      (ov?.chartTrend ?? []).map((d) => ({
        ...d,
        label: d.day
      })),
    [ov?.chartTrend]
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <AdminPageHeader description={labels.desc} title={labels.title} />

      {labels.privacyNote ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          {labels.privacyNote}
        </p>
      ) : null}

      {perms === null ? (
        <p className="text-sm text-slate-500">{labels.loading}</p>
      ) : !canRead ? (
        <AdminEmptyState title={labels.noPermission} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TAB_ORDER.map((id) => (
                <button
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  key={id}
                  onClick={() => setTab(id)}
                  type="button"
                >
                  {labels.tabs[id] ?? id}
                </button>
              ))}
            </div>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => void load()}
              type="button"
            >
              {labels.refresh}
            </button>
          </div>
          {lastSync ? (
            <p className="text-xs text-slate-500">
              {common.updatedAt}: {new Date(lastSync).toLocaleString()}
            </p>
          ) : null}
          {loadErr ? <p className="text-sm text-red-600">{labels.error}</p> : null}

          {tab === "overview" && ov && tasks ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AdminKpiCard
                  label={labels.kpi.enabledPlacements}
                  value={String(ov.enabledPlacements ?? 0)}
                />
                <AdminKpiCard label={labels.kpi.activeCampaigns} value={String(ov.activeCampaigns ?? 0)} />
                <AdminKpiCard label={labels.kpi.impressions7d} value={String(ov.impressions7d ?? 0)} />
                <AdminKpiCard label={labels.kpi.clicks7d} value={String(ov.clicks7d ?? 0)} />
                <AdminKpiCard label={labels.kpi.ctr} value={pct(ov.ctr ?? 0)} />
                <AdminKpiCard label={labels.kpi.blocked} value={String(ov.blocked7d ?? 0)} />
                <AdminKpiCard label={labels.kpi.policyWarnings} value={String(ov.policyWarnings ?? 0)} />
                <AdminKpiCard label={labels.kpi.providersOn} value={String(ov.providersEnabled ?? 0)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AdminChartCard
                  description={common.records}
                  title={labels.charts.trend}
                >
                  {trendData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer height="100%" width="100%">
                        <LineChart data={trendData}>
                          <XAxis dataKey="day" fontSize={11} tickLine={false} />
                          <YAxis fontSize={11} tickLine={false} />
                          <Tooltip />
                          <Line dataKey="impressions" dot={false} stroke={CHART_COLORS[0]!} strokeWidth={2} type="monotone" />
                          <Line dataKey="clicks" dot={false} stroke={CHART_COLORS[1]!} strokeWidth={2} type="monotone" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <AdminEmptyState title={labels.emptyData} />
                  )}
                </AdminChartCard>
                <AdminChartCard description={common.records} title={labels.charts.ctrPlacement}>
                  {ov.chartCtrByPlacement && ov.chartCtrByPlacement.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer height="100%" width="100%">
                        <BarChart data={ov.chartCtrByPlacement.slice(0, 10)}>
                          <XAxis dataKey="code" fontSize={10} tickLine={false} />
                          <YAxis fontSize={10} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="ctr" fill={CHART_COLORS[0]!} name="CTR" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <AdminEmptyState title={labels.emptyData} />
                  )}
                </AdminChartCard>
                <AdminChartCard description={common.records} title={labels.charts.blockedReason}>
                  {ov.blockedByReason && ov.blockedByReason.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer height="100%" width="100%">
                        <BarChart data={ov.blockedByReason.slice(0, 12)}>
                          <XAxis dataKey="reason" fontSize={9} interval={0} tickLine={false} />
                          <YAxis fontSize={10} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={CHART_COLORS[2]!} name="n" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <AdminEmptyState title={labels.emptyData} />
                  )}
                </AdminChartCard>
                <AdminChartCard description={labels.charts.revenueUnavailable} title={labels.charts.revenuePlaceholder}>
                  <AdminEmptyState title={ov.revenue?.available ? labels.emptyData : labels.charts.revenueUnavailable} />
                </AdminChartCard>
              </div>
              <AdminSection
                title={labels.tasks.title}
                description={labels.tasks.noProvider}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {tasks.placementsWithoutProvider.length > 0 ? (
                    <AdminTaskCard title={labels.tasks.noProvider}>
                      {tasks.placementsWithoutProvider.join(", ")}
                    </AdminTaskCard>
                  ) : null}
                  {tasks.campaignsEndingSoon.length > 0
                    ? tasks.campaignsEndingSoon.map((c) => (
                        <AdminTaskCard key={c.id} title={`${labels.tasks.endingSoon}: ${c.name}`}>
                          {c.endAt ? new Date(c.endAt).toLocaleDateString() : "—"}
                        </AdminTaskCard>
                      ))
                    : null}
                  {tasks.disabledProviders.length > 0
                    ? tasks.disabledProviders.map((p) => (
                        <AdminTaskCard key={p.key} title={`${labels.tasks.disabledProvider}: ${p.key}`}>
                          {p.type}
                        </AdminTaskCard>
                      ))
                    : null}
                  {tasks.policyWarnings.length > 0
                    ? tasks.policyWarnings.map((c) => (
                        <AdminTaskCard key={c.id} title={`${labels.tasks.policy}: ${c.name}`}>
                          {c.policyStatus}
                        </AdminTaskCard>
                      ))
                    : null}
                  {tasks.placementsWithoutProvider.length === 0 &&
                  tasks.campaignsEndingSoon.length === 0 &&
                  tasks.disabledProviders.length === 0 &&
                  tasks.policyWarnings.length === 0 ? (
                    <p className="text-sm text-slate-600">{labels.emptyData}</p>
                  ) : null}
                </div>
              </AdminSection>
            </div>
          ) : null}

          {tab === "placements" ? (
            <AdminSection title={labels.tabs.placements} description={labels.placements.campaigns}>
              <div className="mb-3 flex flex-wrap justify-end gap-2">
                {canPlacements ? (
                  <button
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
                    onClick={() => {
                      setReason("");
                      setDrawer({
                        kind: "placement",
                        mode: "create",
                        row: { active: true, code: "", config: {}, labelKey: "" }
                      });
                    }}
                    type="button"
                  >
                    {labels.create} placement
                  </button>
                ) : null}
              </div>
              {!placements ? (
                <p className="text-sm text-slate-500">{labels.loading}</p>
              ) : placements.length === 0 ? (
                <AdminEmptyState title={labels.emptyData} />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <AdminDataTable>
                    <AdsTableHead
                      className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur"
                      columns={[
                        labels.placements.code,
                        labels.placements.surface,
                        labels.placements.location,
                        common.status,
                        labels.placements.provider,
                        labels.placements.campaigns,
                        labels.placements.cap,
                        labels.placements.learningSafe,
                        labels.placements.impressions,
                        labels.placements.ctr,
                        common.updatedAt,
                        common.action
                      ]}
                    />
                    <AdminDataTableBody>
                      {placements.map((r) => {
                        const p = r as {
                          id: string;
                          code: string;
                          active: boolean;
                          config: Record<string, unknown> | null;
                          labelKey: string | null;
                          campaignCount?: number;
                          ctr?: number;
                          learningSafe?: boolean;
                          updatedAt: string;
                        };
                        const cfg = p.config ?? {};
                        return (
                          <AdminDataTableRow key={p.id}>
                            <AdminDataTableTd>
                              <span className="font-mono text-xs">{p.code}</span>
                            </AdminDataTableTd>
                            <AdminDataTableTd>{String(cfg.surface ?? "—")}</AdminDataTableTd>
                            <AdminDataTableTd>{String(cfg.location ?? "—")}</AdminDataTableTd>
                            <AdminDataTableTd>
                              <AdminStatusBadge tone={p.active ? "good" : "neutral"}>
                                {p.active ? labels.enabled : labels.disabled}
                              </AdminStatusBadge>
                            </AdminDataTableTd>
                            <AdminDataTableTd>{String(cfg.providerKey ?? "—")}</AdminDataTableTd>
                            <AdminDataTableTd>{p.campaignCount ?? 0}</AdminDataTableTd>
                            <AdminDataTableTd>{String(cfg.maxPerDay ?? "—")}</AdminDataTableTd>
                            <AdminDataTableTd>
                              <AdminStatusBadge tone={p.learningSafe !== false ? "good" : "warning"}>
                                {p.learningSafe !== false ? "safe" : "off"}
                              </AdminStatusBadge>
                            </AdminDataTableTd>
                            <AdminDataTableTd>{(p as { stats?: { impressions: number } }).stats?.impressions ?? 0}</AdminDataTableTd>
                            <AdminDataTableTd>{pct(p.ctr ?? 0)}</AdminDataTableTd>
                            <AdminDataTableTd className="whitespace-nowrap text-xs text-slate-500">
                              {new Date(p.updatedAt).toLocaleString()}
                            </AdminDataTableTd>
                            <AdminDataTableTd>
                              {canPlacements ? (
                                <button
                                  className="text-indigo-700 underline"
                                  onClick={() => {
                                    setReason("");
                                    setDrawer({
                                      kind: "placement",
                                      mode: "edit",
                                      row: {
                                        active: p.active,
                                        code: p.code,
                                        config: p.config,
                                        id: p.id,
                                        labelKey: p.labelKey ?? ""
                                      }
                                    });
                                  }}
                                  type="button"
                                >
                                  {labels.edit}
                                </button>
                              ) : null}
                            </AdminDataTableTd>
                          </AdminDataTableRow>
                        );
                      })}
                    </AdminDataTableBody>
                  </AdminDataTable>
                </div>
              )}
            </AdminSection>
          ) : null}

          {tab === "campaigns" ? (
            <AdminSection title={labels.tabs.campaigns} description={labels.campaigns.mediaNote}>
              {canCampaigns ? (
                <div className="mb-3 flex flex-wrap justify-end">
                  <button
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
                    onClick={() => {
                      setReason("");
                      setDrawer({
                        kind: "campaign",
                        mode: "create",
                        row: {
                          creativeType: "placeholder",
                          destinationUrl: "",
                          name: "",
                          placementCodes: "home_feed_inline",
                          policyStatus: "pending",
                          priority: 0,
                          providerKey: "local",
                          status: "draft",
                          targetLocale: "",
                          targetPlanSlug: ""
                        }
                      });
                    }}
                    type="button"
                  >
                    {labels.campaigns.createTitle}
                  </button>
                </div>
              ) : null}
              {!campaigns ? (
                <p className="text-sm text-slate-500">{labels.loading}</p>
              ) : campaigns.length === 0 ? (
                <AdminEmptyState title={labels.emptyData} />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <AdminDataTable>
                    <AdsTableHead
                      className="sticky top-0 z-10 bg-slate-50/95"
                      columns={[
                        labels.campaigns.name,
                        labels.campaigns.status,
                        labels.campaigns.provider,
                        labels.campaigns.placements,
                        labels.campaigns.start,
                        labels.campaigns.end,
                        labels.campaigns.policy,
                        common.updatedAt,
                        common.action
                      ]}
                    />
                    <AdminDataTableBody>
                      {campaigns.map((c) => {
                        const r = c as {
                          id: string;
                          name: string;
                          status: string;
                          providerKey: string;
                          placementCodes: string[];
                          startAt: string | null;
                          endAt: string | null;
                          policyStatus: string;
                          updatedAt: string;
                        };
                        return (
                          <AdminDataTableRow key={r.id}>
                            <AdminDataTableTd className="font-medium">{r.name}</AdminDataTableTd>
                            <AdminDataTableTd>
                              <AdminStatusBadge
                                tone={
                                  r.status === "active" ? "good" : r.status === "paused" ? "warning" : "neutral"
                                }
                              >
                                {r.status}
                              </AdminStatusBadge>
                            </AdminDataTableTd>
                            <AdminDataTableTd className="font-mono text-xs">{r.providerKey}</AdminDataTableTd>
                            <AdminDataTableTd className="max-w-[12rem] truncate text-xs">
                              {(r.placementCodes ?? []).join(", ")}
                            </AdminDataTableTd>
                            <AdminDataTableTd className="text-xs">
                              {r.startAt ? new Date(r.startAt).toLocaleString() : "—"}
                            </AdminDataTableTd>
                            <AdminDataTableTd className="text-xs">
                              {r.endAt ? new Date(r.endAt).toLocaleString() : "—"}
                            </AdminDataTableTd>
                            <AdminDataTableTd>
                              <AdminStatusBadge
                                tone={
                                  r.policyStatus === "ok"
                                    ? "good"
                                    : r.policyStatus === "warning"
                                      ? "warning"
                                      : "neutral"
                                }
                              >
                                {r.policyStatus}
                              </AdminStatusBadge>
                            </AdminDataTableTd>
                            <AdminDataTableTd className="whitespace-nowrap text-xs text-slate-500">
                              {new Date(r.updatedAt).toLocaleString()}
                            </AdminDataTableTd>
                            <AdminDataTableTd>
                              {canCampaigns ? (
                                <button
                                  className="text-indigo-700 underline"
                                  onClick={() => {
                                    setReason("");
                                    setDrawer({
                                      kind: "campaign",
                                      mode: "edit",
                                      row: { ...r, placementCodes: (r.placementCodes ?? []).join(",") }
                                    });
                                  }}
                                  type="button"
                                >
                                  {labels.edit}
                                </button>
                              ) : null}
                            </AdminDataTableTd>
                          </AdminDataTableRow>
                        );
                      })}
                    </AdminDataTableBody>
                  </AdminDataTable>
                </div>
              )}
            </AdminSection>
          ) : null}

          {tab === "providers" ? (
            <AdminSection title={labels.tabs.providers} description={labels.providers.configHint}>
              {!providers ? (
                <p className="text-sm text-slate-500">{labels.loading}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">{labels.providers.localLabel}</p>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <AdminDataTable>
                    <AdsTableHead
                      className="sticky top-0 z-10 bg-slate-50/95"
                      columns={[
                        labels.providers.key,
                        labels.providers.type,
                        common.status,
                        labels.enabled,
                        labels.providers.lastSync,
                        common.action
                      ]}
                    />
                      <AdminDataTableBody>
                        {providers.map((x) => {
                          const p = x as {
                            id: string;
                            key: string;
                            type: string;
                            status: string;
                            enabled: boolean;
                            lastSyncAt: string | null;
                            config: unknown;
                          };
                          return (
                            <AdminDataTableRow key={p.id}>
                              <AdminDataTableTd className="font-mono text-xs">{p.key}</AdminDataTableTd>
                              <AdminDataTableTd>{p.type}</AdminDataTableTd>
                              <AdminDataTableTd>{p.status}</AdminDataTableTd>
                              <AdminDataTableTd>
                                <AdminStatusBadge tone={p.enabled ? "good" : "neutral"}>
                                  {p.enabled ? labels.enabled : labels.disabled}
                                </AdminStatusBadge>
                              </AdminDataTableTd>
                              <AdminDataTableTd className="text-xs">
                                {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : "—"}
                              </AdminDataTableTd>
                              <AdminDataTableTd>
                                {canProviders ? (
                                  <button
                                    className="text-indigo-700 underline"
                                    onClick={() => {
                                      setReason("");
                                      setDrawer({ kind: "provider", row: p as unknown as Record<string, unknown> });
                                    }}
                                    type="button"
                                  >
                                    {labels.edit}
                                  </button>
                                ) : null}
                              </AdminDataTableTd>
                            </AdminDataTableRow>
                          );
                        })}
                      </AdminDataTableBody>
                    </AdminDataTable>
                  </div>
                </div>
              )}
            </AdminSection>
          ) : null}

          {tab === "rules" ? (
            <AdminSection title={labels.tabs.rules} description={labels.rules.hardRulesBody}>
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">{labels.rules.hardRulesTitle}</p>
              </div>
              {!rules ? (
                <p className="text-sm text-slate-500">{labels.loading}</p>
              ) : rules.length === 0 ? (
                <AdminEmptyState title={labels.emptyData} />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <AdminDataTable>
                    <AdsTableHead
                      className="sticky top-0 z-10 bg-slate-50/95"
                      columns={[
                        labels.rules.key,
                        labels.rules.enabled,
                        common.updatedAt,
                        common.action
                      ]}
                    />
                    <AdminDataTableBody>
                      {rules.map((x) => {
                        const r = x as { id: string; ruleKey: string; enabled: boolean; config: unknown; updatedAt: string };
                        return (
                          <AdminDataTableRow key={r.id}>
                            <AdminDataTableTd className="font-mono text-xs">{r.ruleKey}</AdminDataTableTd>
                            <AdminDataTableTd>
                              <AdminStatusBadge tone={r.enabled ? "good" : "neutral"}>
                                {r.enabled ? labels.enabled : labels.disabled}
                              </AdminStatusBadge>
                            </AdminDataTableTd>
                            <AdminDataTableTd className="whitespace-nowrap text-xs text-slate-500">
                              {new Date(r.updatedAt).toLocaleString()}
                            </AdminDataTableTd>
                            <AdminDataTableTd>
                              {canRules ? (
                                <button
                                  className="text-indigo-700 underline"
                                  onClick={() => {
                                    setReason("");
                                    setDrawer({ kind: "rule", row: r as unknown as Record<string, unknown> });
                                  }}
                                  type="button"
                                >
                                  {labels.edit}
                                </button>
                              ) : null}
                            </AdminDataTableTd>
                          </AdminDataTableRow>
                        );
                      })}
                    </AdminDataTableBody>
                  </AdminDataTable>
                </div>
              )}
            </AdminSection>
          ) : null}

          {tab === "performance" && perf && typeof perf === "object" ? (
            <AdminSection title={labels.performance.title} description={labels.performance.totals}>
              {(() => {
                const p = perf as {
                  revenue?: { available: boolean; messageKey?: string };
                  totals?: { blocked: number; clicks: number; ctr: number; impressions: number };
                  byPlacement?: { blocked: number; clicks: number; code: string; impressions: number }[];
                  byCampaign?: { blocked: number; clicks: number; id: string; impressions: number }[];
                  byLocale?: { locale: string; clicks: number; impressions: number }[];
                  byPlan?: { planSlug: string; clicks: number; impressions: number }[];
                  byDevice?: { device: string; clicks: number; impressions: number }[];
                  fillRate?: number | null;
                };
                return (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <AdminKpiCard
                        label={labels.kpi.impressions7d}
                        value={String(p.totals?.impressions ?? 0)}
                      />
                      <AdminKpiCard label={labels.kpi.clicks7d} value={String(p.totals?.clicks ?? 0)} />
                      <AdminKpiCard label={labels.kpi.ctr} value={pct(p.totals?.ctr ?? 0)} />
                      <AdminKpiCard label={labels.kpi.blocked} value={String(p.totals?.blocked ?? 0)} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {p.fillRate == null
                        ? labels.performance.fillRateEmpty
                        : `${labels.performance.fillRate}: ${p.fillRate}`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {p.revenue?.available ? common.records : labels.performance.revenueEmpty}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-800">{labels.performance.byPlacement}</h3>
                    <MiniTable
                      columns={[
                        labels.placements.code,
                        labels.placements.impressions,
                        "clk",
                        "CTR",
                        labels.kpi.blocked
                      ]}
                      rows={
                        p.byPlacement?.map((b) => [
                          b.code,
                          String(b.impressions),
                          String(b.clicks),
                          pct(b.impressions > 0 ? b.clicks / b.impressions : 0),
                          String(b.blocked)
                        ]) ?? []
                      }
                    />
                    <h3 className="text-sm font-semibold text-slate-800">{labels.performance.byLocale}</h3>
                    <MiniTable
                      columns={["Locale", "impr", "clk", "ctr"]}
                      rows={
                        p.byLocale?.map((b) => [
                          b.locale,
                          String(b.impressions),
                          String(b.clicks),
                          pct(b.impressions > 0 ? b.clicks / b.impressions : 0)
                        ]) ?? []
                      }
                    />
                    <h3 className="text-sm font-semibold text-slate-800">{labels.performance.byPlan}</h3>
                    <MiniTable
                      columns={["Plan", "impr", "clk", "ctr"]}
                      rows={
                        p.byPlan?.map((b) => [
                          b.planSlug,
                          String(b.impressions),
                          String(b.clicks),
                          pct(b.impressions > 0 ? b.clicks / b.impressions : 0)
                        ]) ?? []
                      }
                    />
                    <h3 className="text-sm font-semibold text-slate-800">{labels.performance.byDevice}</h3>
                    <MiniTable
                      columns={["Device", "impr", "clk", "ctr"]}
                      rows={
                        p.byDevice?.map((b) => [
                          b.device,
                          String(b.impressions),
                          String(b.clicks),
                          pct(b.impressions > 0 ? b.clicks / b.impressions : 0)
                        ]) ?? []
                      }
                    />
                    <h3 className="text-sm font-semibold text-slate-800">{labels.performance.byCampaign}</h3>
                    <MiniTable
                      columns={["id", "impr", "clk", "blocked"]}
                      rows={p.byCampaign?.map((b) => [b.id, String(b.impressions), String(b.clicks), String(b.blocked)]) ?? []}
                    />
                  </div>
                );
              })()}
            </AdminSection>
          ) : null}

          {tab === "audit" ? (
            <AdminSection title={labels.audit.title} description={common.records}>
              {!canAudit ? (
                <AdminEmptyState title={labels.noPermission} />
              ) : !audit ? (
                <p className="text-sm text-slate-500">{labels.loading}</p>
              ) : audit.length === 0 ? (
                <AdminEmptyState title={labels.audit.empty} />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <AdminDataTable>
                    <AdsTableHead
                      className="sticky top-0 z-10 bg-slate-50/95"
                      columns={[
                        labels.audit.action,
                        "target",
                        common.updatedAt,
                        labels.reasonLabel
                      ]}
                    />
                    <AdminDataTableBody>
                      {audit.map((row) => {
                        const a = row as {
                          id: string;
                          action: string;
                          targetType: string;
                          targetId: string;
                          createdAt: string;
                          reason: string | null;
                        };
                        return (
                          <AdminDataTableRow key={a.id}>
                            <AdminDataTableTd className="text-xs font-mono">{a.action}</AdminDataTableTd>
                            <AdminDataTableTd className="text-xs">
                              {a.targetType} / {a.targetId.slice(0, 8)}…
                            </AdminDataTableTd>
                            <AdminDataTableTd className="whitespace-nowrap text-xs text-slate-500">
                              {new Date(a.createdAt).toLocaleString()}
                            </AdminDataTableTd>
                            <AdminDataTableTd className="max-w-[20rem] truncate text-xs text-slate-500">
                              {a.reason ?? "—"}
                            </AdminDataTableTd>
                          </AdminDataTableRow>
                        );
                      })}
                    </AdminDataTableBody>
                  </AdminDataTable>
                </div>
              )}
            </AdminSection>
          ) : null}
        </>
      )}

      {drawer && (
        <AdsDrawer
          key={JSON.stringify(drawer)}
          canCampaigns={canCampaigns}
          canPlacements={canPlacements}
          canProviders={canProviders}
          canRules={canRules}
          common={common}
          drawer={drawer}
          labels={labels}
          onClose={() => setDrawer(null)}
          onDone={() => void load()}
          reason={reason}
          setReason={setReason}
        />
      )}
    </div>
  );
}

function AdsTableHead({ className, columns }: { className?: string; columns: string[] }) {
  return (
    <AdminDataTableHead className={className}>
      <AdminDataTableRow>
        {columns.map((h, i) => (
          <AdminDataTableTh className="whitespace-nowrap" key={i}>
            {h}
          </AdminDataTableTh>
        ))}
      </AdminDataTableRow>
    </AdminDataTableHead>
  );
}

function MiniTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">—</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((c, i) => (
              <th className="px-3 py-2 font-medium" key={i}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr className="border-t border-slate-100" key={i}>
              {r.map((c, j) => (
                <td className="px-3 py-1.5 font-mono text-slate-800" key={j}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdsDrawer({
  canCampaigns,
  canPlacements,
  canProviders,
  canRules,
  common,
  drawer,
  labels,
  onClose,
  onDone,
  reason,
  setReason
}: {
  canCampaigns: boolean;
  canPlacements: boolean;
  canProviders: boolean;
  canRules: boolean;
  common: Common;
  drawer: AdsDrawerState;
  labels: AdsConsoleLabels;
  onClose: () => void;
  onDone: () => void;
  reason: string;
  setReason: (s: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = drawer as any;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState(() => (d.row.code as string) ?? "");
  const [labelKey, setLabelKey] = useState(() => (d.row.labelKey as string) ?? "");
  const [active, setActive] = useState(() => Boolean(d.row.active));
  const [configText, setConfigText] = useState(() =>
    JSON.stringify(d.row.config && typeof d.row.config === "object" ? d.row.config : {}, null, 2)
  );
  const [cName, setCName] = useState(() => (d.row.name as string) ?? "");
  const [cStatus, setCStatus] = useState(() => (d.row.status as string) ?? "draft");
  const [cProvider, setCProvider] = useState(() => (d.row.providerKey as string) ?? "local");
  const [cPlacements, setCPlacements] = useState(() => String(d.row.placementCodes ?? ""));
  const [cPolicy, setCPolicy] = useState(() => (d.row.policyStatus as string) ?? "pending");
  const [pEnabled, setPEnabled] = useState(() => Boolean(d.row.enabled));
  const [pConfigText, setPConfigText] = useState(() => JSON.stringify(d.row.config ?? {}, null, 2));
  const [rConfigText, setRConfigText] = useState(() => JSON.stringify(d.row.config ?? {}, null, 2));
  const [rEnabled, setREnabled] = useState(() => Boolean(d.row.enabled));

  const submit = async () => {
    if (reason.trim().length < 3) {
      setErr(labels.reasonPlaceholder);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (d.kind === "placement" && canPlacements) {
        let config: Record<string, unknown> = {};
        try {
          config = JSON.parse(configText) as Record<string, unknown>;
        } catch {
          setErr("Invalid JSON");
          setSaving(false);
          return;
        }
        if (d.mode === "create") {
          const res = await adminApiFetch("/api/admin/ads/placements", {
            body: JSON.stringify({ active, code, config, labelKey: labelKey || null, reason: reason.trim() }),
            headers: { "content-type": "application/json" },
            method: "POST"
          });
          if (!res.ok) {
            setErr(await res.text());
            setSaving(false);
            return;
          }
        } else {
          const res = await adminApiFetch(`/api/admin/ads/placements/${d.row.id as string}`, {
            body: JSON.stringify({ active, code, config, labelKey: labelKey || null, reason: reason.trim() }),
            headers: { "content-type": "application/json" },
            method: "PATCH"
          });
          if (!res.ok) {
            setErr(await res.text());
            setSaving(false);
            return;
          }
        }
      } else if (d.kind === "campaign" && canCampaigns) {
        const codes = cPlacements
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        if (d.mode === "create") {
          const res = await adminApiFetch("/api/admin/ads/campaigns", {
            body: JSON.stringify({
              creativeType: "placeholder",
              name: cName,
              placementCodes: codes,
              policyStatus: cPolicy,
              providerKey: cProvider,
              reason: reason.trim(),
              status: cStatus
            }),
            headers: { "content-type": "application/json" },
            method: "POST"
          });
          if (!res.ok) {
            setErr(await res.text());
            setSaving(false);
            return;
          }
        } else {
          const res = await adminApiFetch(`/api/admin/ads/campaigns/${d.row.id as string}`, {
            body: JSON.stringify({
              name: cName,
              placementCodes: codes,
              policyStatus: cPolicy,
              providerKey: cProvider,
              reason: reason.trim(),
              status: cStatus
            }),
            headers: { "content-type": "application/json" },
            method: "PATCH"
          });
          if (!res.ok) {
            setErr(await res.text());
            setSaving(false);
            return;
          }
        }
      } else if (d.kind === "provider" && canProviders) {
        let config: Record<string, unknown> = {};
        try {
          config = JSON.parse(pConfigText) as Record<string, unknown>;
        } catch {
          setErr("Invalid JSON");
          setSaving(false);
          return;
        }
        const res = await adminApiFetch(`/api/admin/ads/providers/${d.row.key as string}`, {
          body: JSON.stringify({ config, enabled: pEnabled, reason: reason.trim() }),
          headers: { "content-type": "application/json" },
          method: "PATCH"
        });
        if (!res.ok) {
          setErr(await res.text());
          setSaving(false);
          return;
        }
      } else if (d.kind === "rule" && canRules) {
        let config: Record<string, unknown> = {};
        try {
          config = JSON.parse(rConfigText) as Record<string, unknown>;
        } catch {
          setErr("Invalid JSON");
          setSaving(false);
          return;
        }
        const res = await adminApiFetch("/api/admin/ads/rules", {
          body: JSON.stringify({
            config,
            enabled: rEnabled,
            reason: reason.trim(),
            ruleKey: d.row.ruleKey
          }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!res.ok) {
          setErr(await res.text());
          setSaving(false);
          return;
        }
      }
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 p-2 md:p-4">
      <div className="h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {d.kind === "placement"
              ? d.mode === "create"
                ? labels.placements.createTitle
                : labels.placements.editTitle
              : d.kind === "campaign"
                ? d.mode === "create"
                  ? labels.campaigns.createTitle
                  : labels.campaigns.editTitle
                : d.kind === "provider"
                  ? labels.providers.editTitle
                  : labels.rules.upsertTitle}
          </h2>
          <button className="text-slate-500" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        {d.kind === "placement" && canPlacements ? (
          <div className="space-y-2 text-sm">
            <label className="block text-slate-600">
              {labels.placements.code}
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono"
                onChange={(e) => setCode(e.target.value)}
                value={code}
              />
            </label>
            <label className="block text-slate-600">
              {labels.placements.displayName}
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                onChange={(e) => setLabelKey(e.target.value)}
                value={labelKey}
              />
            </label>
            <label className="flex items-center gap-2 text-slate-600">
              <input checked={active} onChange={(e) => setActive(e.target.checked)} type="checkbox" />
              {labels.enabled}
            </label>
            <label className="block text-slate-600">
              {labels.placements.jsonConfig}
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                onChange={(e) => setConfigText(e.target.value)}
                rows={10}
                value={configText}
              />
            </label>
          </div>
        ) : null}
        {d.kind === "campaign" && canCampaigns ? (
          <div className="space-y-2 text-sm">
            <label className="block text-slate-600">
              {labels.campaigns.name}
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                onChange={(e) => setCName(e.target.value)}
                value={cName}
              />
            </label>
            <label className="block text-slate-600">
              {labels.campaigns.status}
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                onChange={(e) => setCStatus(e.target.value)}
                value={cStatus}
              >
                {["draft", "active", "paused", "ended"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-slate-600">
              {labels.campaigns.provider}
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono"
                onChange={(e) => setCProvider(e.target.value)}
                value={cProvider}
              />
            </label>
            <label className="block text-slate-600">
              {labels.campaigns.placements} (comma)
              <input
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                onChange={(e) => setCPlacements(e.target.value)}
                value={cPlacements}
              />
            </label>
            <label className="block text-slate-600">
              {labels.campaigns.policy}
              <select
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
                onChange={(e) => setCPolicy(e.target.value)}
                value={cPolicy}
              >
                {["pending", "ok", "warning", "rejected"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {d.kind === "provider" && canProviders ? (
          <div className="space-y-2 text-sm">
            <p className="font-mono text-xs text-slate-700">{String(d.row.key)}</p>
            <label className="flex items-center gap-2 text-slate-600">
              <input checked={pEnabled} onChange={(e) => setPEnabled(e.target.checked)} type="checkbox" />
              {labels.enabled}
            </label>
            <label className="block text-slate-600">
              {labels.providers.configHint}
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                onChange={(e) => setPConfigText(e.target.value)}
                rows={8}
                value={pConfigText}
              />
            </label>
          </div>
        ) : null}
        {d.kind === "rule" && canRules ? (
          <div className="space-y-2 text-sm">
            <p className="font-mono text-xs text-slate-700">{String(d.row.ruleKey)}</p>
            <label className="flex items-center gap-2 text-slate-600">
              <input checked={rEnabled} onChange={(e) => setREnabled(e.target.checked)} type="checkbox" />
              {labels.rules.enabled}
            </label>
            <label className="block text-slate-600">
              {labels.rules.configJson}
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                onChange={(e) => setRConfigText(e.target.value)}
                rows={6}
                value={rConfigText}
              />
            </label>
          </div>
        ) : null}
        <label className="mt-4 block text-sm text-slate-600">
          {labels.reasonLabel} *
          <textarea
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            value={reason}
          />
        </label>
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={onClose} type="button">
            {labels.cancel}
          </button>
          <button
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={saving}
            onClick={() => void submit()}
            type="button"
          >
            {saving ? common.loading : labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}
