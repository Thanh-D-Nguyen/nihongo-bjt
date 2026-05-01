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
  AdminStatusBadge,
  cn
} from "@nihongo-bjt/ui";
import {
  BATTLE_ABUSE_ACTIONS,
  BATTLE_ABUSE_KINDS,
  BATTLE_ABUSE_SEVERITIES,
  BATTLE_ABUSE_STATUSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type ReportSummary = {
  id: string;
  reporterId: string | null;
  subjectId: string;
  matchId: string | null;
  severity: "low" | "medium" | "high" | "critical";
  kind: string;
  status: "open" | "triaged" | "resolved" | "dismissed" | "escalated";
  actionTaken: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  actor: { id: string; displayName: string; email: string } | null;
};

type ReportDetail = ReportSummary & {
  description: string;
  evidence: Record<string, unknown>;
  resolutionNotes: string | null;
  resolvedById: string | null;
  priorAgainstSubject: Array<{
    id: string;
    status: string;
    severity: string;
    kind: string;
    actionTaken: string | null;
    createdAt: string;
  }>;
  audit: AuditEntry[];
};

type ListResponse = { items: ReportSummary[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;

function severityTone(severity: string): "danger" | "good" | "neutral" | "warning" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "neutral";
}

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "resolved") return "good";
  if (status === "escalated") return "danger";
  if (status === "open" || status === "triaged") return "warning";
  return "neutral";
}

function formatWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(
      locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN",
      { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" }
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BattleAbuseClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("battle.manage");
  const isReadOnly = perms != null && !canManage;

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [action, setAction] = useState<(typeof BATTLE_ABUSE_ACTIONS)[number]>("warning");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"resolve" | "escalate" | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, severityFilter, kindFilter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (!r.ok) {
          if (!cancelled) setPerms(new Set());
          return;
        }
        const body = (await r.json()) as MePayload;
        if (!cancelled) setPerms(permsFromMe(body));
      } catch {
        if (!cancelled) setPerms(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (kindFilter !== "all") params.set("kind", kindFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/battle/abuse?${params.toString()}`);
      if (!r.ok) {
        setList(null);
        setListError(t("errorLoad"));
        return;
      }
      setList((await r.json()) as ListResponse);
    } catch {
      setList(null);
      setListError(t("errorLoad"));
    } finally {
      setListLoading(false);
    }
  }, [statusFilter, severityFilter, kindFilter, page, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await adminApiFetch(`/api/admin/battle/abuse/${encodeURIComponent(id)}`);
        if (!r.ok) {
          setDetail(null);
          setDetailError(t("errorDetail"));
          return;
        }
        setDetail((await r.json()) as ReportDetail);
      } catch {
        setDetail(null);
        setDetailError(t("errorDetail"));
      } finally {
        setDetailLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const items = list?.items ?? [];
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    if (!list) return;
    downloadCsv(
      `battle-abuse-page-${list.page}.csv`,
      [t("colCreated"), t("colSeverity"), t("colKind"), t("colStatus"), t("colSubject"), t("colReporter"), t("colAction")],
      list.items.map((row) => [
        row.createdAt,
        row.severity,
        row.kind,
        row.status,
        row.subjectId,
        row.reporterId ?? "—",
        row.actionTaken ?? "—"
      ])
    );
  };

  const requireReason = (): string | null => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setToast({ kind: "err", text: t("reasonHint") });
      return null;
    }
    return trimmed;
  };

  const doResolve = async () => {
    if (!canManage || !detail) return;
    const r = requireReason();
    if (!r) return;
    if (notes.trim().length < 3) {
      setToast({ kind: "err", text: t("notesHint") });
      return;
    }
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/battle/abuse/${encodeURIComponent(detail.id)}/resolve`, {
        body: JSON.stringify({ action, notes: notes.trim(), reason: r }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setToast({ kind: "ok", text: t("successResolve") });
      setReason("");
      setNotes("");
      setConfirm(null);
      await loadDetail(detail.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  const doEscalate = async () => {
    if (!canManage || !detail) return;
    const r = requireReason();
    if (!r) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/battle/abuse/${encodeURIComponent(detail.id)}/escalate`, {
        body: JSON.stringify({ reason: r }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setToast({ kind: "ok", text: t("successEscalate") });
      setReason("");
      setConfirm(null);
      await loadDetail(detail.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        {t("moderatePermNotice")}
      </div>

      {isReadOnly ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      {toast ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          )}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}

      <AdminSection
        description={`${t("countLabel")}: ${total} ${common.records.toLowerCase()}`}
        title={t("title")}
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-[140px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterStatus")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              onChange={(e) => setStatusFilter(e.target.value)}
              value={statusFilter}
            >
              <option value="all">{t("filterStatusAll")}</option>
              {BATTLE_ABUSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[140px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterSeverity")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              onChange={(e) => setSeverityFilter(e.target.value)}
              value={severityFilter}
            >
              <option value="all">{t("filterSeverityAll")}</option>
              {BATTLE_ABUSE_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {t(`severity_${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[140px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterKind")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              onChange={(e) => setKindFilter(e.target.value)}
              value={kindFilter}
            >
              <option value="all">{t("filterKindAll")}</option>
              {BATTLE_ABUSE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kind_${k}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-end gap-2">
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => void loadList()}
              type="button"
            >
              {t("actionRefresh")}
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={exportCsv}
              type="button"
            >
              {t("actionExportCsv")}
            </button>
          </div>
        </div>

        {listLoading && !list ? (
          <p className="text-sm text-slate-600">{common.loading}</p>
        ) : listError ? (
          <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
        ) : items.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("emptyHint")}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colSeverity")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colKind")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colSubject")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colReporter")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAction")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {items.map((row) => (
                  <AdminDataTableRow
                    className={cn(
                      "cursor-pointer hover:bg-indigo-50/40",
                      selectedId === row.id && "bg-indigo-50/60"
                    )}
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <AdminDataTableTd>{formatWhen(row.createdAt, locale)}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={severityTone(row.severity)}>
                        {t(`severity_${row.severity}`) || row.severity}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{t(`kind_${row.kind}`) || row.kind}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>
                        {t(`status_${row.status}`) || row.status}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-[10px] text-slate-500">{row.subjectId.slice(0, 12)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-[10px] text-slate-500">
                        {row.reporterId ? row.reporterId.slice(0, 12) : "—"}
                      </span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.actionTaken ?? "—"}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")}: {list?.page ?? page} / {totalPages}
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

      {selectedId && detail ? (
        <AdminSection description={t("detailSelectHint")} title={t("detailHeading")}>
          {detailLoading ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : detailError ? (
            <AdminEmptyState title={common.error}>{detailError}</AdminEmptyState>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <AdminStatusBadge tone={severityTone(detail.severity)}>
                  {t(`severity_${detail.severity}`) || detail.severity}
                </AdminStatusBadge>
                <AdminStatusBadge tone={statusTone(detail.status)}>
                  {t(`status_${detail.status}`) || detail.status}
                </AdminStatusBadge>
                <span className="font-mono text-xs text-slate-600">{detail.id}</span>
                {canManage && detail.status !== "resolved" && detail.status !== "dismissed" ? (
                  <>
                    <button
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      onClick={() => setConfirm("resolve")}
                      type="button"
                    >
                      {t("actionResolve")}
                    </button>
                    {detail.status !== "escalated" ? (
                      <button
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        onClick={() => setConfirm("escalate")}
                        type="button"
                      >
                        {t("actionEscalate")}
                      </button>
                    ) : null}
                  </>
                ) : null}
                <button
                  className="ml-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setSelectedId(null)}
                  type="button"
                >
                  {t("close")}
                </button>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <dt className="text-slate-500">{t("colSubject")}</dt>
                <dd className="font-mono">{detail.subjectId}</dd>
                <dt className="text-slate-500">{t("colReporter")}</dt>
                <dd className="font-mono">{detail.reporterId ?? "—"}</dd>
                <dt className="text-slate-500">{t("colMatchId")}</dt>
                <dd className="font-mono">{detail.matchId ?? "—"}</dd>
                <dt className="text-slate-500">{t("colCreated")}</dt>
                <dd>{formatWhen(detail.createdAt, locale)}</dd>
                <dt className="text-slate-500">{t("colKind")}</dt>
                <dd>{t(`kind_${detail.kind}`) || detail.kind}</dd>
                <dt className="text-slate-500">{t("colAction")}</dt>
                <dd>{detail.actionTaken ?? "—"}</dd>
              </dl>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("descriptionHeading")}
                </h4>
                <p className="mt-1 whitespace-pre-wrap">{detail.description}</p>
                {Object.keys(detail.evidence ?? {}).length > 0 ? (
                  <>
                    <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("evidenceHeading")}
                    </h4>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-50 p-2 text-[10px]">
                      {JSON.stringify(detail.evidence, null, 2)}
                    </pre>
                  </>
                ) : null}
                {detail.resolutionNotes ? (
                  <>
                    <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("resolutionNotesHeading")}
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap">{detail.resolutionNotes}</p>
                  </>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("priorAgainstSubjectHeading")} ({detail.priorAgainstSubject.length})
                </h3>
                {detail.priorAgainstSubject.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("priorEmpty")}</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {detail.priorAgainstSubject.map((p) => (
                      <li key={p.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatWhen(p.createdAt, locale)}
                        </span>{" "}
                        <AdminStatusBadge tone={severityTone(p.severity)}>{p.severity}</AdminStatusBadge>{" "}
                        <span className="text-slate-600">{p.kind}</span>{" "}
                        <span className="text-slate-500">→ {p.status}</span>
                        {p.actionTaken ? <span className="ml-2 text-slate-600">[{p.actionTaken}]</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("detailAudit")}
                </h3>
                {detail.audit.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("detailAuditEmpty")}</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {detail.audit.map((a) => (
                      <li key={a.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatWhen(a.createdAt, locale)}
                        </span>{" "}
                        <span className="font-semibold text-slate-700">{a.action}</span>{" "}
                        <span className="text-slate-500">{a.actor?.displayName ?? a.actor?.email ?? "—"}</span>
                        {a.reason ? <p className="text-slate-600">{a.reason}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </AdminSection>
      ) : null}

      {confirm && detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">
              {confirm === "resolve" ? t("confirm_resolve_title") : t("confirm_escalate_title")}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {confirm === "resolve" ? t("confirm_resolve_message") : t("confirm_escalate_message")}
            </p>
            {confirm === "resolve" ? (
              <>
                <label className="mt-3 block text-sm">
                  <span className="block text-xs font-medium text-slate-600">{t("formAction")}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    onChange={(e) => setAction(e.target.value as typeof action)}
                    value={action}
                  >
                    {BATTLE_ABUSE_ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {t(`action_${a}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block text-sm">
                  <span className="block text-xs font-medium text-slate-600">{t("formNotes")}</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("notesPlaceholder")}
                    rows={3}
                    value={notes}
                  />
                  <span className="mt-1 block text-[10px] text-slate-400">{t("notesHint")}</span>
                </label>
              </>
            ) : null}
            <label className="mt-3 block text-sm">
              <span className="block text-xs font-medium text-slate-600">{t("reasonLabel")}</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={2}
                value={reason}
              />
              <span className="mt-1 block text-[10px] text-slate-400">{t("reasonHint")}</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setConfirm(null);
                  setReason("");
                  setNotes("");
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm",
                  confirm === "resolve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500",
                  mutating && "opacity-60"
                )}
                disabled={mutating}
                onClick={() => (confirm === "resolve" ? doResolve() : doEscalate())}
                type="button"
              >
                {mutating ? common.loading : t("confirmSubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
