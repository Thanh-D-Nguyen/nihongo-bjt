"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type Summary = {
  totalCards: number;
  dueNow: number;
  leeched: number;
  reviewsTotal: number;
  reviewsByRating: Record<string, number>;
  retentionPct: number;
  avgEaseFactor: number;
  avgLapses: number;
  avgIntervalDays: number;
  windowDays: number;
};

type RetentionPoint = { day: string; reviews: number; goodReviews: number; retentionPct: number };

type ProblemCard = {
  id: string;
  userId: string;
  card: {
    id: string;
    cardType: string;
    title: string;
  };
  state: string;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  repetitions: number;
  isLeech: boolean;
  dueAt: string | null;
  recent: { reviews: number; goodReviews: number; retentionPct: number };
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type CardDetail = {
  id: string;
  userId: string;
  cardType: string;
  state: string;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  repetitions: number;
  isLeech: boolean;
  dueAt: string | null;
  reviewedAt: string | null;
  card: { id: string; title: string; level: string | null };
  recentReviews: Array<{
    id: string;
    rating: string;
    reviewedAt: string;
    elapsedSec: number;
    intervalAfterDays: number;
  }>;
  audit: AuditEntry[];
};

const PAGE_SIZE = 25;

function tone(s: string): "danger" | "good" | "neutral" | "warning" {
  if (s === "leech" || s === "relearning") return "danger";
  if (s === "review") return "good";
  if (s === "graduated") return "neutral";
  return "warning";
}

export function LearningReviewAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("admin.content.write");

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (!r.ok) {
          if (!c) setPerms(new Set());
          return;
        }
        if (!c) setPerms(permsFromMe((await r.json()) as MePayload));
      } catch {
        if (!c) setPerms(new Set());
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const [windowDays, setWindowDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [retention, setRetention] = useState<RetentionPoint[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [s, r] = await Promise.all([
        adminApiFetch(`/api/admin/learning/review/summary?windowDays=${windowDays}`),
        adminApiFetch(`/api/admin/learning/review/retention-curve?windowDays=${windowDays}`)
      ]);
      if (s.ok) setSummary((await s.json()) as Summary);
      if (r.ok) setRetention(((await r.json()) as { points: RetentionPoint[] }).points ?? []);
    } finally {
      setOverviewLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const [problemList, setProblemList] = useState<{ items: ProblemCard[]; total: number } | null>(null);
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [minLapses, setMinLapses] = useState("3");
  const [maxRetention, setMaxRetention] = useState("70");
  const [leechedOnly, setLeechedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const loadProblems = useCallback(async () => {
    setProblemLoading(true);
    setProblemError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (minLapses.trim()) params.set("minLapses", minLapses.trim());
      if (maxRetention.trim()) params.set("maxRetention", maxRetention.trim());
      if (leechedOnly) params.set("leeched", "true");
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/learning/review/problem-cards?${params.toString()}`);
      if (!r.ok) {
        setProblemError(t("errorLoad"));
        return;
      }
      setProblemList((await r.json()) as { items: ProblemCard[]; total: number });
    } catch {
      setProblemError(t("errorLoad"));
    } finally {
      setProblemLoading(false);
    }
  }, [q, minLapses, maxRetention, leechedOnly, page, t]);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openCard = useCallback(async (id: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDetail(null);
    try {
      const r = await adminApiFetch(`/api/admin/learning/review/cards/${id}`);
      if (r.ok) setDetail((await r.json()) as CardDetail);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const submitForceReintroduce = async () => {
    if (!detail || reason.trim().length < 3) return;
    setSubmitting(true);
    try {
      const r = await adminApiFetch(`/api/admin/learning/review/cards/${detail.id}/force-reintroduce`, {
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (r.ok) {
        await openCard(detail.id);
        await loadProblems();
        setReasonModalOpen(false);
        setReason("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((problemList?.total ?? 0) / PAGE_SIZE));

  const reviewsByRating = useMemo(() => summary?.reviewsByRating ?? {}, [summary]);
  const maxReviewsInCurve = useMemo(
    () => (retention ?? []).reduce((m, p) => Math.max(m, p.reviews), 1),
    [retention]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")}>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-600">{t("filterWindow")}:</span>
          <select
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            onChange={(e) => setWindowDays(Number(e.target.value))}
            value={windowDays}
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={60}>60d</option>
            <option value={90}>90d</option>
          </select>
        </label>
      </AdminPageHeader>

      <AdminSection description={t("kpiDescription")} title={t("kpiTitle")}>
        {overviewLoading && !summary ? (
          <p className="text-sm text-slate-500">{common.loading}</p>
        ) : !summary ? (
          <AdminEmptyState title={common.error} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={t("kpiTotalCards")} value={summary.totalCards} />
            <Kpi label={t("kpiDueNow")} value={summary.dueNow} />
            <Kpi label={t("kpiLeeched")} value={summary.leeched} tone="danger" />
            <Kpi label={t("kpiReviews")} value={summary.reviewsTotal} />
            <Kpi
              label={t("kpiRetentionPct")}
              value={`${summary.retentionPct}%`}
              tone={summary.retentionPct < 70 ? "warning" : "good"}
            />
            <Kpi label={t("kpiAvgEase")} value={summary.avgEaseFactor.toFixed(2)} />
            <Kpi label={t("kpiAvgLapses")} value={summary.avgLapses.toFixed(2)} />
            <Kpi label={t("kpiAvgInterval")} value={`${summary.avgIntervalDays.toFixed(1)}d`} />
          </div>
        )}
        {summary ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {Object.entries(reviewsByRating).map(([rating, count]) => (
              <span key={rating} className="rounded bg-slate-100 px-2 py-1 font-mono">
                {rating}: {count}
              </span>
            ))}
          </div>
        ) : null}
      </AdminSection>

      <AdminSection description={t("retentionDescription")} title={t("retentionTitle")}>
        {retention.length === 0 ? (
          <p className="text-sm text-slate-500">{common.loading}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-1">
              {retention.map((p) => {
                const h = (p.reviews / maxReviewsInCurve) * 80;
                const ret = p.retentionPct;
                const color = ret >= 80 ? "bg-emerald-500" : ret >= 60 ? "bg-amber-400" : "bg-red-500";
                return (
                  <div
                    key={p.day}
                    className="flex flex-1 flex-col items-center gap-0.5"
                    title={`${p.day.slice(0, 10)} · ${p.reviews} reviews · ${ret}% retention`}
                  >
                    <div className="text-[9px] text-slate-500">{ret}%</div>
                    <div
                      className={`w-full rounded-t ${color}`}
                      style={{ height: `${Math.max(2, h)}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{retention[0]?.day.slice(5, 10) ?? ""}</span>
              <span>{retention[retention.length - 1]?.day.slice(5, 10) ?? ""}</span>
            </div>
          </div>
        )}
      </AdminSection>

      <AdminSection description={t("problemDescription")} title={t("problemTitle")}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterSearch")}</span>
            <input
              className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder={t("searchPlaceholder")}
              value={q}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterMinLapses")}</span>
            <input
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setMinLapses(e.target.value);
              }}
              type="number"
              value={minLapses}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterMaxRetention")}</span>
            <input
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setMaxRetention(e.target.value);
              }}
              type="number"
              value={maxRetention}
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              checked={leechedOnly}
              onChange={(e) => {
                setPage(1);
                setLeechedOnly(e.target.checked);
              }}
              type="checkbox"
            />
            <span className="font-medium text-slate-600">{t("filterLeechedOnly")}</span>
          </label>
          <button
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => void loadProblems()}
            type="button"
          >
            {t("actionRefresh")}
          </button>
        </div>

        {problemLoading && !problemList ? (
          <p className="text-sm text-slate-600">{common.loading}</p>
        ) : problemError ? (
          <AdminEmptyState title={common.error}>{problemError}</AdminEmptyState>
        ) : !problemList || problemList.items.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("emptyHint")}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colCardType")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colState")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLapses")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colInterval")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colRecentRetention")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {problemList.items.map((row) => (
                  <AdminDataTableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-indigo-50/40"
                    onClick={() => void openCard(row.id)}
                  >
                    <AdminDataTableTd>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase">
                        {row.card.cardType}
                      </span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-medium">{row.card.title}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-[10px] text-slate-500">{row.userId.slice(0, 12)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={tone(row.isLeech ? "leech" : row.state)}>
                        {row.isLeech ? "leech" : row.state}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.lapses}</AdminDataTableTd>
                    <AdminDataTableTd>{row.intervalDays}d</AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className={row.recent.retentionPct < 60 ? "font-semibold text-red-600" : ""}>
                        {row.recent.retentionPct}% · {row.recent.reviews}
                      </span>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")}: {page} / {totalPages} · {problemList.total} {common.records}
              </span>
              <div className="flex gap-1">
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  {t("prevPage")}
                </button>
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  type="button"
                >
                  {t("nextPage")}
                </button>
              </div>
            </div>
          </>
        )}
      </AdminSection>

      {drawerOpen ? (
        <div
          aria-modal
          className="fixed inset-0 z-40 flex"
          onClick={() => {
            setDrawerOpen(false);
            setDetail(null);
          }}
          role="dialog"
        >
          <div
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                {detail?.card.title ?? t("drawerTitleLoading")}
              </h2>
              <button
                className="text-sm text-slate-500"
                onClick={() => {
                  setDrawerOpen(false);
                  setDetail(null);
                }}
                type="button"
              >
                {t("close")}
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              {drawerLoading || !detail ? (
                <p className="text-sm text-slate-500">{common.loading}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge tone={tone(detail.isLeech ? "leech" : detail.state)}>
                      {detail.isLeech ? "leech" : detail.state}
                    </AdminStatusBadge>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase">
                      {detail.cardType}
                    </span>
                    {detail.card.level ? (
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] uppercase">
                        {detail.card.level}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <DetailField label={t("kpiAvgInterval")}>{detail.intervalDays}d</DetailField>
                    <DetailField label={t("kpiAvgEase")}>{detail.easeFactor.toFixed(2)}</DetailField>
                    <DetailField label={t("colLapses")}>{detail.lapses}</DetailField>
                    <DetailField label={t("colRepetitions")}>{detail.repetitions}</DetailField>
                    <DetailField label={t("colDueAt")}>
                      {detail.dueAt ? new Date(detail.dueAt).toLocaleString() : "—"}
                    </DetailField>
                    <DetailField label={t("colReviewedAt")}>
                      {detail.reviewedAt ? new Date(detail.reviewedAt).toLocaleString() : "—"}
                    </DetailField>
                  </div>

                  {canWrite ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <button
                        className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                        onClick={() => setReasonModalOpen(true)}
                        type="button"
                      >
                        {t("actionForceReintroduce")}
                      </button>
                      <p className="mt-2 text-[11px] text-amber-800">{t("forceReintroduceWarning")}</p>
                    </div>
                  ) : null}

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("recentReviewsTitle")}
                    </div>
                    {detail.recentReviews.length === 0 ? (
                      <div className="text-xs text-slate-500">{t("noRecentReviews")}</div>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {detail.recentReviews.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-baseline justify-between rounded border border-slate-200 px-2 py-1 text-xs"
                          >
                            <span className="font-mono">{r.rating}</span>
                            <span className="text-slate-500">
                              {new Date(r.reviewedAt).toLocaleString()} · {r.intervalAfterDays}d
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <AuditList audit={detail.audit} labels={labels} />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {reasonModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{t("confirmForceReintroduce")}</h3>
            <p className="text-xs text-slate-600">{t("forceReintroduceWarning")}</p>
            <textarea
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              minLength={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("promptReason")}
              rows={3}
              value={reason}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                onClick={() => {
                  setReasonModalOpen(false);
                  setReason("");
                }}
                type="button"
              >
                {t("formCancel")}
              </button>
              <button
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={submitting || reason.trim().length < 3}
                onClick={() => void submitForceReintroduce()}
                type="button"
              >
                {submitting ? t("formSubmitting") : t("formConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  tone: t,
  value
}: {
  label: string;
  tone?: "danger" | "good" | "warning";
  value: number | string;
}) {
  const cls =
    t === "danger"
      ? "text-red-700"
      : t === "warning"
        ? "text-amber-700"
        : t === "good"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function DetailField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function AuditList({ audit, labels }: { audit: AuditEntry[]; labels: Labels }) {
  const t = (k: string) => labels[k] ?? k;
  if (audit.length === 0) {
    return <div className="text-xs text-slate-500">{t("auditEmpty")}</div>;
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{t("auditTitle")}</div>
      <ul className="space-y-1.5">
        {audit.map((row) => (
          <li key={row.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono font-medium text-slate-700">{row.action}</span>
              <span className="text-[10px] text-slate-500">{new Date(row.createdAt).toLocaleString()}</span>
            </div>
            {row.actor ? (
              <div className="text-[10px] text-slate-500">
                {row.actor.displayName} ({row.actor.email})
              </div>
            ) : null}
            {row.reason ? <div className="mt-1 text-slate-700">"{row.reason}"</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
