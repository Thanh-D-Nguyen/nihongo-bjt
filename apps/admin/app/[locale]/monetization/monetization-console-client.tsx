"use client";

import {
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
  cn
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe } from "@/app/_components/admin-client-utils";
import { SubscriptionsTab } from "./_components/subscriptions-tab";
import { EntitlementsTab } from "./_components/entitlements-tab";
import { QuotasTab } from "./_components/quotas-tab";
import { BillingEventsTab } from "./_components/billing-events-tab";
import { WebhookDlqTab } from "./_components/webhook-dlq-tab";
import { ProviderConfigTab } from "./_components/provider-config-tab";
import { RefundsTab } from "./_components/refunds-tab";

type MeResponse = {
  roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
};

type Common = { error: string; loading: string; records: string; status: string; updatedAt: string };
type Labels = {
  adsUxRule: string;
  adsWarning: string;
  analyticsEmpty: string;
  auditEmpty: string;
  cancel: string;
  billingNotConnected: string;
  chartPlanDist: string;
  convRate: string;
  couponCreate: string;
  ctas: { newPlan: string; refresh: string };
  desc: string;
  empty: string;
  enforcement?: { active: string; freeMode: string; toggleHint: string };
  kpiActiveSubs: string;
  kpiAds: string;
  kpiFree: string;
  kpiPastDue: string;
  kpiPaid: string;
  kpiQuotaWarn: string;
  kpiTotalUsers: string;
  kpiTrial: string;
  lastSync: string;
  noPermission: string;
  overviewFunnel: string;
  planActions: string;
  planConfigHint: string;
  primaryProvider: string;
  quotaMvpNote: string;
  reasonLabel: string;
  reasonRequired: string;
  save: string;
  subTotal: string;
  tab: Record<string, string>;
  taskDisabledAds: string;
  taskMissingEnt: string;
  title: string;
  trendSub: string;
};

const TAB_ORDER = [
  "overview",
  "plans",
  "entitlements",
  "quotas",
  "subscriptions",
  "billing-events",
  "refunds",
  "provider-config",
  "webhook-dlq"
] as const;
type TabId = (typeof TAB_ORDER)[number];

const CHART_COLORS = ["#4f46e5", "#059669", "#d97706", "#64748b", "#7c3aed", "#0d9488"];

function planTone(
  s: string
): "danger" | "good" | "neutral" | "warning" {
  if (s === "active" || s === "trialing" || s === "comped") {
    return "good";
  }
  if (s === "past_due") {
    return "danger";
  }
  if (s === "archived" || s === "canceled" || s === "expired") {
    return "neutral";
  }
  if (s === "draft") {
    return "warning";
  }
  return "neutral";
}

export function MonetizationConsoleClient({ common, labels, initialTab = "overview" }: { common: Common; labels: Labels; initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const [overview, setOverview] = useState<unknown>(null);
  const [overviewErr, setOverviewErr] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [planRows, setPlanRows] = useState<unknown[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<Record<string, unknown> | null>(null);
  const [editReason, setEditReason] = useState("");
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanSlug, setNewPlanSlug] = useState("");
  const [newPlanNameKey, setNewPlanNameKey] = useState("");
  const [newPlanStatus, setNewPlanStatus] = useState("draft");
  const [newPlanReason, setNewPlanReason] = useState("");

  const can = useCallback(
    (candidates: string[]) => {
      if (!perms) {
        return false;
      }
      return candidates.some((c) => perms.has(c));
    },
    [perms]
  );

  const canRead = can(["admin.monetization.read", "billing.overview.view", "revenue.analytics.view"]);
  const canManage = can(["admin.monetization.write", "billing.plan.manage"]);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const res = await adminApiFetch("/api/admin/me");
        if (res.ok && !c) {
          setPerms(permsFromMe((await res.json()) as MeResponse));
        } else if (!c) {
          setPerms(new Set());
        }
      } catch {
        if (!c) {
          setPerms(new Set());
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const loadOverview = useCallback(async () => {
    if (!canRead) {
      return;
    }
    setOverviewErr(null);
    try {
      const res = await adminApiFetch("/api/admin/monetization/overview");
      if (!res.ok) {
        setOverviewErr(common.error);
        return;
      }
      setOverview(await res.json());
      setLastSync(new Date().toISOString());
    } catch {
      setOverviewErr(common.error);
    }
  }, [canRead, common.error]);

  useEffect(() => {
    if (perms == null) {
      return;
    }
    void loadOverview();
  }, [perms, loadOverview]);

  const loadTab = useCallback(async () => {
    if (!canRead) {
      return;
    }
    setLoadErr(null);
    try {
      if (tab === "plans") {
        const r = await adminApiFetch("/api/admin/monetization/plans");
        setPlanRows(r.ok ? ((await r.json()) as unknown[]) : []);
        if (!r.ok) {
          setLoadErr(common.error);
        }
      }
    } catch {
      setLoadErr(common.error);
    }
  }, [canRead, common.error, tab]);

  useEffect(() => {
    if (perms == null) {
      return;
    }
    if (tab === "overview") {
      return;
    }
    void loadTab();
  }, [tab, perms, loadTab]);

  const distChart = useMemo(() => {
    const ov = overview as
      | { charts?: { planDistribution?: Array<{ count: number; planSlug: string; status: string }> } }
      | undefined;
    const rows = ov?.charts?.planDistribution ?? [];
    const bySlug: Record<string, number> = {};
    for (const r of rows) {
      bySlug[r.planSlug] = (bySlug[r.planSlug] ?? 0) + r.count;
    }
    return Object.entries(bySlug).map(([name, value]) => ({ name, value }));
  }, [overview]);

  const savePlan = async () => {
    if (!editPlan || !("id" in editPlan) || editReason.trim().length < 3) {
      return;
    }
    const id = String(editPlan.id);
    let config: Record<string, unknown> | undefined;
    try {
      if (typeof (editPlan as { configText?: string }).configText === "string" && (editPlan as { configText: string }).configText.trim()) {
        config = JSON.parse((editPlan as { configText: string }).configText) as Record<string, unknown>;
      }
    } catch {
      setLoadErr(common.error);
      return;
    }
    const body = {
      ...(config ? { config } : {}),
      nameKey: editPlan.nameKey,
      reason: editReason.trim(),
      sortOrder: editPlan.sortOrder,
      status: editPlan.status
    };
    const res = await adminApiFetch(`/api/admin/monetization/plans/${id}`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    if (res.ok) {
      setEditPlan(null);
      setEditReason("");
      void loadTab();
      void loadOverview();
    } else {
      setLoadErr(common.error);
    }
  };

  const createPlan = async () => {
    if (!newPlanSlug.trim() || !newPlanNameKey.trim() || newPlanReason.trim().length < 3) return;
    const res = await adminApiFetch("/api/admin/monetization/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newPlanSlug.trim(),
        nameKey: newPlanNameKey.trim(),
        status: newPlanStatus,
        reason: newPlanReason.trim(),
      }),
    });
    if (res.ok) {
      setShowCreatePlan(false);
      setNewPlanSlug(""); setNewPlanNameKey(""); setNewPlanStatus("draft"); setNewPlanReason("");
      void loadTab();
      void loadOverview();
    } else {
      setLoadErr(common.error);
    }
  };

  if (perms === null) {
    return (
      <div className="p-6 text-sm text-ink-muted">
        {common.loading}…
      </div>
    );
  }
  if (!canRead) {
    return (
      <AdminEmptyState title={labels.title}>
        {labels.noPermission}
      </AdminEmptyState>
    );
  }

  return (
    <div className="space-y-6 p-2 md:p-0">
      <AdminPageHeader
        description={labels.desc}
        title={labels.title}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink shadow-sm hover:border-indigo-200"
              onClick={() => {
                void loadOverview();
                void loadTab();
              }}
              type="button"
            >
              {labels.ctas.refresh}
            </button>
            {canManage && (
              <button
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                onClick={() => setShowCreatePlan(true)}
                type="button"
              >
                {labels.ctas.newPlan}
              </button>
            )}
          </div>
        }
      />
      {/* Enforcement mode badge */}
      {overview !== null && (
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            (overview as { enforcementEnabled?: boolean }).enforcementEnabled
              ? "bg-green-50 text-green-700 ring-1 ring-green-200"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          )}>
            <span className={cn("h-2 w-2 rounded-full", (overview as { enforcementEnabled?: boolean }).enforcementEnabled ? "bg-green-500" : "bg-amber-400")} />
            {(overview as { enforcementEnabled?: boolean }).enforcementEnabled ? (labels.enforcement?.active ?? "Enforcement Active") : (labels.enforcement?.freeMode ?? "Free Mode")}
          </span>
          <span className="text-xs text-ink-muted">{labels.enforcement?.toggleHint ?? "Toggle in Settings → Feature Flags"}</span>
        </div>
      )}
      {lastSync && <p className="text-xs text-ink-muted">{labels.lastSync}: {new Date(lastSync).toLocaleString()}</p>}

      <div className="flex flex-wrap gap-2">
        {TAB_ORDER.map((t) => (
          <button
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              tab === t
                ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-ink"
            )}
            key={t}
            onClick={() => setTab(t)}
            type="button"
          >
            {labels.tab[t]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {overviewErr && <p className="text-sm text-rose-600">{overviewErr}</p>}
          {overview == null && <p className="text-sm text-ink-muted">{common.loading}…</p>}
          {overview != null && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(() => {
                  const k = (overview as { kpis: Record<string, number | null> }).kpis;
                  return [
                    { label: labels.kpiTotalUsers, v: k.totalUsers },
                    { label: labels.kpiFree, v: k.freeUsersActiveOnFreePlan },
                    { label: labels.kpiPaid, v: k.paidUsersActive },
                    { label: labels.kpiTrial, v: k.trialUsers },
                    { label: labels.convRate, v: k.conversionRatePercent },
                    { label: labels.kpiActiveSubs, v: k.activeSubscriptions },
                    { label: labels.kpiPastDue, v: k.pastDueSubscriptions },
                    { label: labels.kpiQuotaWarn, v: k.quotaWarningUsers ?? "—" },
                    { label: labels.kpiAds, v: k.adsEnabledPlacements }
                  ];
                })().map((x) => (
                  <AdminKpiCard
                    className="min-h-[88px] justify-end"
                    key={x.label}
                    label={x.label}
                    value={x.v as number | string}
                  />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AdminSection title={labels.chartPlanDist}>
                  {distChart.length === 0 ? (
                    <AdminEmptyState title={common.records}>{common.records}</AdminEmptyState>
                  ) : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer height="100%" width="100%">
                        <BarChart data={distChart}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {distChart.map((d, i) => (
                              <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </AdminSection>
                <AdminSection title={labels.overviewFunnel}>
                  {(() => {
                    const c = (overview as { charts?: { paywallFunnel?: { checkoutSessions: number; paywallViews: number } } })
                      .charts?.paywallFunnel;
                    if (!c) {
                      return <p className="text-sm text-ink-muted">{common.records}</p>;
                    }
                    return (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border p-3">
                          {labels.overviewFunnel} — paywall
                          <p className="text-2xl font-semibold text-ink">{c.paywallViews}</p>
                        </div>
                        <div className="rounded-xl border p-3">
                          checkout
                          <p className="text-2xl font-semibold text-ink">{c.checkoutSessions}</p>
                        </div>
                      </div>
                    );
                  })()}
                </AdminSection>
              </div>
              <AdminSection title={labels.trendSub}>
                {(() => {
                  const t = (overview as { charts?: { subscriptionTrend: { count: number; day: string }[] } })?.charts
                    ?.subscriptionTrend;
                  if (!t || t.length === 0) {
                    return <p className="text-sm text-ink-muted">{common.records}</p>;
                  }
                  return (
                    <div className="h-48 w-full">
                      <ResponsiveContainer height="100%" width="100%">
                        <BarChart data={t.map((r) => ({ c: r.count, d: r.day }))}>
                          <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="c" fill="#6366f1" name="new subs" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </AdminSection>
              {(() => {
                const task = (overview as { tasks: Record<string, number | string[] | boolean> } | null)?.tasks;
                if (!task) {
                  return null;
                }
                return (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 text-sm text-ink">
                      <p className="font-medium">{labels.taskMissingEnt}</p>
                      <p className="mt-1 text-2xl font-semibold">{String(task.plansMissingEntitlementCount)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-ink">
                      <p className="font-medium">{labels.taskDisabledAds}</p>
                      <p className="mt-1 text-2xl font-semibold">{String(task.disabledAdPlacements)}</p>
                    </div>
                    <p className="text-xs text-ink-muted md:col-span-2">{labels.quotaMvpNote}</p>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {tab === "plans" && (
        <AdminSection title={labels.tab.plans}>
          {canManage && (
            <div className="flex justify-end">
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                onClick={() => setShowCreatePlan(true)}
                type="button"
              >
                {labels.ctas.newPlan}
              </button>
            </div>
          )}
          {loadErr && <p className="text-sm text-rose-600">{loadErr}</p>}
          {!planRows && <p className="text-sm text-ink-muted">{common.loading}…</p>}
          {planRows && planRows.length === 0 && (
            <AdminEmptyState title={labels.tab.plans}>{labels.empty}</AdminEmptyState>
          )}
          {planRows && planRows.length > 0 && (
            <div className="max-w-full overflow-x-auto">
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    {["nameKey", "slug", "status", "ent", "quotas", "subs", "updated", " "].map((h) => (
                      <AdminDataTableTh className="whitespace-nowrap" key={h}>
                        {h}
                      </AdminDataTableTh>
                    ))}
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {planRows.map((p) => {
                    const r = p as {
                      _count: { entitlements: number; planQuotas: number; subscriptions: number };
                      id: string;
                      nameKey: string;
                      slug: string;
                      status: string;
                      updatedAt: string;
                    };
                    return (
                      <AdminDataTableRow key={r.id}>
                        <AdminDataTableTd className="max-w-[180px] truncate text-xs" muted>
                          {r.nameKey}
                        </AdminDataTableTd>
                        <AdminDataTableTd className="text-xs font-mono">{r.slug}</AdminDataTableTd>
                        <AdminDataTableTd>
                          <AdminStatusBadge tone={planTone(r.status)}>{r.status}</AdminStatusBadge>
                        </AdminDataTableTd>
                        <AdminDataTableTd>{r._count.entitlements}</AdminDataTableTd>
                        <AdminDataTableTd>{r._count.planQuotas}</AdminDataTableTd>
                        <AdminDataTableTd>{r._count.subscriptions}</AdminDataTableTd>
                        <AdminDataTableTd className="text-xs">{new Date(r.updatedAt).toLocaleString()}</AdminDataTableTd>
                        <AdminDataTableTd>
                          {canManage && (
                            <button
                              className="text-indigo-600 text-xs"
                              onClick={() => {
                                const row = p as Record<string, unknown> & { config?: unknown; id: string };
                                setEditPlan({
                                  ...row,
                                  configText: JSON.stringify(row.config ?? {}, null, 2)
                                });
                                setEditReason("");
                              }}
                              type="button"
                            >
                              {labels.planActions}
                            </button>
                          )}
                        </AdminDataTableTd>
                      </AdminDataTableRow>
                    );
                  })}
                </AdminDataTableBody>
              </AdminDataTable>
            </div>
          )}
        </AdminSection>
      )}

      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-ink">{labels.planActions}</h3>
            <p className="mt-1 text-xs text-ink-muted">{labels.planConfigHint}</p>
            <label className="mt-2 block text-xs text-ink-muted">
              nameKey
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setEditPlan((p) => (p ? { ...p, nameKey: e.target.value } : p))}
                value={String(editPlan.nameKey ?? "")}
              />
            </label>
            <label className="mt-2 block text-xs text-ink-muted">
              status
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setEditPlan((p) => (p ? { ...p, status: e.target.value } : p))}
                value={String(editPlan.status ?? "active")}
              >
                {["draft", "active", "archived"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-xs text-ink-muted">
              config (JSON)
              <textarea
                className="mt-1 w-full min-h-[120px] rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                onChange={(e) => setEditPlan((p) => (p ? { ...p, configText: e.target.value } : p))}
                value={String((editPlan as { configText?: string }).configText ?? "{}")}
              />
            </label>
            <label className="mt-2 block text-xs text-rose-700">
              {labels.reasonLabel} *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setEditReason(e.target.value)}
                value={editReason}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                onClick={() => setEditPlan(null)}
                type="button"
              >
                {labels.cancel}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white"
                onClick={() => void savePlan()}
                type="button"
              >
                {labels.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreatePlan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-ink">{labels.ctas.newPlan}</h3>
            <label className="mt-3 block text-xs text-ink-muted">
              Slug *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setNewPlanSlug(e.target.value)}
                placeholder="e.g. premium-monthly"
                value={newPlanSlug}
              />
            </label>
            <label className="mt-2 block text-xs text-ink-muted">
              Name Key *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setNewPlanNameKey(e.target.value)}
                placeholder="e.g. plan.premium_monthly"
                value={newPlanNameKey}
              />
            </label>
            <label className="mt-2 block text-xs text-ink-muted">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setNewPlanStatus(e.target.value)}
                value={newPlanStatus}
              >
                {["draft", "active", "archived"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-xs text-rose-700">
              {labels.reasonLabel} *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={(e) => setNewPlanReason(e.target.value)}
                value={newPlanReason}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                onClick={() => setShowCreatePlan(false)}
                type="button"
              >
                {labels.cancel}
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={!newPlanSlug.trim() || !newPlanNameKey.trim() || newPlanReason.trim().length < 3}
                onClick={() => void createPlan()}
                type="button"
              >
                {labels.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "entitlements" && (
        <EntitlementsTab
          common={common}
          canRead={canRead}
          canManage={canManage}
          labels={labels as unknown as Record<string, string>}
          plans={(planRows ?? []).map((p) => { const r = p as { id: string; slug: string }; return { id: r.id, slug: r.slug }; })}
        />
      )}

      {tab === "quotas" && (
        <QuotasTab
          common={common}
          canRead={canRead}
          canManage={canManage}
          labels={labels as unknown as Record<string, string>}
          plans={(planRows ?? []).map((p) => { const r = p as { id: string; slug: string }; return { id: r.id, slug: r.slug }; })}
        />
      )}

      {tab === "subscriptions" && (
        <SubscriptionsTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string>} />
      )}

      {tab === "billing-events" && (
        <BillingEventsTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string>} />
      )}

      {tab === "refunds" && (
        <RefundsTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string>} />
      )}

      {tab === "provider-config" && (
        <ProviderConfigTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string>} />
      )}

      {tab === "webhook-dlq" && (
        <WebhookDlqTab common={common} canRead={canRead} canManage={canManage} labels={labels as unknown as Record<string, string>} />
      )}
    </div>
  );
}
