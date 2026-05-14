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
  AdminToastContainer,
  cn,
  useAdminToast
} from "@nihongo-bjt/ui";
import {
  CONTENT_ENRICHMENT_STATUSES,
  CONTENT_ENRICHMENT_TYPES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { parseApiError, useFormErrors } from "@/lib/form-errors";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type EnrichmentStatus = (typeof CONTENT_ENRICHMENT_STATUSES)[number];
type EnrichmentType = (typeof CONTENT_ENRICHMENT_TYPES)[number];

type RetryHistoryEntry = {
  attempt: number;
  at: string;
  by: string;
  reason: string;
  fromStatus: string;
};

type Provenance = {
  provider: string | null;
  license: string | null;
  source: string | null;
};

type Summary = {
  id: string;
  entityType: string;
  entityId: string;
  enrichmentType: EnrichmentType | string;
  priority: number;
  status: EnrichmentStatus | string;
  attempts: number;
  errorMessage: string | null;
  provenance: Provenance;
  inputSnapshot: unknown;
  result: unknown;
  retryHistory: RetryHistoryEntry[];
  cancelReason: string | null;
  lastAttemptedAt: string | null;
  processedAt: string | null;
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

type Detail = Summary & { audit: AuditEntry[] };

type ListResponse = {
  items: Summary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
};

const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  cancelled: "neutral",
  failed: "danger",
  queued: "neutral",
  running: "warning",
  succeeded: "good"
};

function fmtWhen(iso: string | null, locale: string): string {
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

export function ContentEnrichmentClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("admin.content.write");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<EnrichmentStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<EnrichmentType | "all">("all");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "retry" | "cancel" } | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [mutating, setMutating] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, statusFilter, typeFilter, entityIdFilter, providerFilter, fromDate, toDate]);

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
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (entityIdFilter) params.set("entityId", entityIdFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate).toISOString());
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/content/enrichment?${params.toString()}`);
      if (!r.ok) {
        setListError(common.error);
        setList(null);
        return;
      }
      setListError(null);
      setList((await r.json()) as ListResponse);
    } catch {
      setListError(common.error);
    }
  }, [debounced, statusFilter, typeFilter, entityIdFilter, providerFilter, fromDate, toDate, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/content/enrichment/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  function toggleRow(id: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitConfirm() {
    if (!confirm || !canWrite || !detail) return;
    if (reason.trim().length < 3) {
      fe.setFieldError("reason", t("reasonRequired"));
      return;
    }
    setMutating(true);
    try {
      const path =
        confirm.kind === "retry"
          ? `/api/admin/content/enrichment/${detail.id}/retry`
          : `/api/admin/content/enrichment/${detail.id}/cancel`;
      const r = await adminApiFetch(path, {
        body: JSON.stringify({ reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        const parsed = await parseApiError(r, t(`${confirm.kind}Failed`));
        toast.error(parsed.form || t(`${confirm.kind}Failed`));
        return;
      }
      toast.success(t(`${confirm.kind}Ok`));
      setConfirm(null);
      setReason("");
      void loadList();
      if (selectedId) void loadDetail(selectedId);
    } finally {
      setMutating(false);
    }
  }

  async function submitBulkRetry() {
    if (!canWrite) return;
    if (selectedRows.size === 0) {
      toast.error(t("selectAtLeastOne"));
      return;
    }
    if (bulkReason.trim().length < 3) {
      fe.setFieldError("bulkReason", t("reasonRequired"));
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch("/api/admin/content/enrichment/bulk-retry", {
        body: JSON.stringify({ jobIds: Array.from(selectedRows), reason: bulkReason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("bulkRetryFailed"));
        toast.error(parsed.form || t("bulkRetryFailed"));
        return;
      }
      const body = (await r.json()) as { retried: number; total: number };
      toast.success(
        `${t("bulkRetryOk")} (${body.retried}/${body.total})`
      );
      setBulkOpen(false);
      setBulkReason("");
      setSelectedRows(new Set());
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = [
      "id",
      "entityType",
      "entityId",
      "type",
      "status",
      "attempts",
      "provider",
      "license",
      "createdAt",
      "lastAttemptedAt",
      "errorMessage"
    ];
    const rows = list.items.map((it) => [
      it.id,
      it.entityType,
      it.entityId,
      String(it.enrichmentType),
      String(it.status),
      String(it.attempts),
      it.provenance.provider ?? "",
      it.provenance.license ?? "",
      it.createdAt,
      it.lastAttemptedAt ?? "",
      it.errorMessage ?? ""
    ]);
    downloadCsv(`content-enrichment-${Date.now()}.csv`, header, rows);
  }

  const pageCount = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  const statusCountsView = useMemo(() => list?.statusCounts ?? {}, [list]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

      {!canWrite && perms != null ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("readOnlyBanner")}
        </div>
      ) : null}

      <AdminSection>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {CONTENT_ENRICHMENT_STATUSES.map((s) => (
            <button
              key={s}
              className={cn(
                "rounded-lg border px-4 py-3 text-left transition",
                statusFilter === s
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              type="button"
            >
              <div className="text-xs uppercase tracking-wide opacity-70">{t(`status_${s}`)}</div>
              <div className="text-2xl font-semibold">{statusCountsView[s] ?? 0}</div>
            </button>
          ))}
        </div>
      </AdminSection>

      <AdminSection>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterSearch")}</span>
            <input
              className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              value={search}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterType")}</span>
            <select
              className="w-40 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => setTypeFilter(e.target.value as EnrichmentType | "all")}
              value={typeFilter}
            >
              <option value="all">{t("filterAll")}</option>
              {CONTENT_ENRICHMENT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`type_${tp}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterEntityId")}</span>
            <input
              className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs"
              onChange={(e) => setEntityIdFilter(e.target.value)}
              placeholder="uuid…"
              value={entityIdFilter}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterProvider")}</span>
            <input
              className="w-40 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => setProviderFilter(e.target.value)}
              value={providerFilter}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterFrom")}</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => setFromDate(e.target.value)}
              type="datetime-local"
              value={fromDate}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterTo")}</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => setToDate(e.target.value)}
              type="datetime-local"
              value={toDate}
            />
          </label>
          <div className="ml-auto flex gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              onClick={exportCsv}
              type="button"
            >
              {t("exportCsv")}
            </button>
            {canWrite ? (
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={selectedRows.size === 0}
                onClick={() => setBulkOpen(true)}
                type="button"
              >
                {t("bulkRetry")} ({selectedRows.size})
              </button>
            ) : null}
          </div>
        </div>
      </AdminSection>

      <AdminSection>
        {listError ? (
          <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
        ) : !list ? (
          <AdminEmptyState title={common.loading}>{common.loading}</AdminEmptyState>
        ) : list.items.length === 0 ? (
          <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh className="w-8">
                    <input
                      checked={list.items.every((it) => selectedRows.has(it.id)) && list.items.length > 0}
                      onChange={(e) => {
                        setSelectedRows((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) for (const it of list.items) next.add(it.id);
                          else for (const it of list.items) next.delete(it.id);
                          return next;
                        });
                      }}
                      type="checkbox"
                    />
                  </AdminDataTableTh>
                  <AdminDataTableTh>{t("colEntity")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colType")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAttempts")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colProvider")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colCreatedAt")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLastAttempted")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {list.items.map((it) => (
                  <AdminDataTableRow
                    className="cursor-pointer hover:bg-slate-50"
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                  >
                    <AdminDataTableTd onClick={(e) => e.stopPropagation()}>
                      <input
                        checked={selectedRows.has(it.id)}
                        disabled={!canWrite || !["failed", "cancelled"].includes(String(it.status))}
                        onChange={() => toggleRow(it.id)}
                        type="checkbox"
                      />
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <div className="text-sm font-medium">{it.entityType}</div>
                      <div className="font-mono text-xs text-slate-500">{it.entityId}</div>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{String(it.enrichmentType)}</code>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={STATUS_TONE[String(it.status)] ?? "neutral"}>
                        {t(`status_${it.status}`)}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{it.attempts}</AdminDataTableTd>
                    <AdminDataTableTd>
                      {it.provenance.provider ? (
                        <div>
                          <div className="text-sm">{it.provenance.provider}</div>
                          {it.provenance.license ? (
                            <div className="text-xs text-slate-500">{it.provenance.license}</div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </AdminDataTableTd>
                    <AdminDataTableTd>{fmtWhen(it.createdAt, locale)}</AdminDataTableTd>
                    <AdminDataTableTd>{fmtWhen(it.lastAttemptedAt, locale)}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>
                {common.records}: {list.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  type="button"
                >
                  ‹
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  type="button"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </AdminSection>

      {/* Detail drawer */}
      {selectedId ? (
        <div className="fixed inset-y-0 right-0 z-30 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
            <h3 className="text-sm font-semibold">{t("detailTitle")}</h3>
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
              }}
              type="button"
            >
              {t("close")}
            </button>
          </div>
          {!detail ? (
            <div className="p-6 text-sm text-slate-500">{common.loading}</div>
          ) : (
            <div className="space-y-5 p-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("colEntity")}>
                  <div>{detail.entityType}</div>
                  <div className="font-mono text-xs text-slate-500">{detail.entityId}</div>
                </Field>
                <Field label={t("colType")}>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {String(detail.enrichmentType)}
                  </code>
                </Field>
                <Field label={t("colStatus")}>
                  <AdminStatusBadge tone={STATUS_TONE[String(detail.status)] ?? "neutral"}>
                    {t(`status_${detail.status}`)}
                  </AdminStatusBadge>
                </Field>
                <Field label={t("colAttempts")}>{detail.attempts}</Field>
                <Field label={t("colCreatedAt")}>{fmtWhen(detail.createdAt, locale)}</Field>
                <Field label={t("colLastAttempted")}>{fmtWhen(detail.lastAttemptedAt, locale)}</Field>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("provenanceTitle")}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-slate-500">{t("provenanceProvider")}</dt>
                  <dd>{detail.provenance.provider ?? "—"}</dd>
                  <dt className="text-slate-500">{t("provenanceLicense")}</dt>
                  <dd>{detail.provenance.license ?? "—"}</dd>
                  <dt className="text-slate-500">{t("provenanceSource")}</dt>
                  <dd className="break-all">{detail.provenance.source ?? "—"}</dd>
                </dl>
                {!detail.provenance.provider ? (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    {t("provenanceMissingNotice")}
                  </div>
                ) : null}
              </div>

              {detail.errorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                    {t("errorTitle")}
                  </div>
                  <pre className="whitespace-pre-wrap break-all text-xs">{detail.errorMessage}</pre>
                </div>
              ) : null}

              {detail.cancelReason ? (
                <Field label={t("cancelReason")}>{detail.cancelReason}</Field>
              ) : null}

              <div className="grid grid-cols-1 gap-3">
                <CodeBlock label={t("inputSnapshot")} value={detail.inputSnapshot} />
                <CodeBlock label={t("outputSnapshot")} value={detail.result} />
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("retryHistoryTitle")}
                </div>
                {detail.retryHistory.length === 0 ? (
                  <div className="text-xs text-slate-500">{t("noRetries")}</div>
                ) : (
                  <ol className="space-y-1 text-xs">
                    {detail.retryHistory.map((h, i) => (
                      <li className="rounded border border-slate-200 px-2 py-1" key={i}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            #{h.attempt} — {h.fromStatus} → queued
                          </span>
                          <span className="text-slate-500">{fmtWhen(h.at, locale)}</span>
                        </div>
                        <div className="text-slate-600">{h.reason}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("auditTitle")}
                </div>
                {detail.audit.length === 0 ? (
                  <div className="text-xs text-slate-500">{t("noAudit")}</div>
                ) : (
                  <ol className="space-y-1 text-xs">
                    {detail.audit.map((a) => (
                      <li className="rounded border border-slate-200 px-2 py-1" key={a.id}>
                        <div className="flex justify-between">
                          <span className="font-mono">{a.action}</span>
                          <span className="text-slate-500">{fmtWhen(a.createdAt, locale)}</span>
                        </div>
                        <div className="text-slate-600">
                          {a.actor?.displayName ?? a.actor?.email ?? "—"}
                          {a.reason ? ` — ${a.reason}` : ""}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {canWrite ? (
                <div className="flex gap-2 border-t border-slate-200 pt-4">
                  <button
                    className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={!["failed", "cancelled"].includes(String(detail.status))}
                    onClick={() => { setConfirm({ kind: "retry" }); fe.clearFieldError("reason"); }}
                    type="button"
                  >
                    {t("retry")}
                  </button>
                  <button
                    className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={!["queued", "running"].includes(String(detail.status))}
                    onClick={() => { setConfirm({ kind: "cancel" }); fe.clearFieldError("reason"); }}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Confirm modal */}
      {confirm ? (
        <Modal
          confirmLabel={t(confirm.kind)}
          confirming={mutating}
          onCancel={() => {
            setConfirm(null);
            setReason("");
            fe.clearFieldError("reason");
          }}
          onConfirm={() => void submitConfirm()}
          title={t(`${confirm.kind}Title`)}
          tone={confirm.kind === "cancel" ? "danger" : "default"}
        >
          <textarea
            className={cn("w-full rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")}
            minLength={3}
            onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }}
            placeholder={t("reasonPlaceholder")}
            rows={3}
            value={reason}
          />
          {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
        </Modal>
      ) : null}

      {/* Bulk modal */}
      {bulkOpen ? (
        <Modal
          confirmLabel={t("bulkRetryConfirm")}
          confirming={mutating}
          onCancel={() => { setBulkOpen(false); fe.clearFieldError("bulkReason"); }}
          onConfirm={() => void submitBulkRetry()}
          title={t("bulkRetryTitle")}
        >
          <p className="mb-2 text-sm text-slate-600">
            {t("bulkRetryDesc").replace("{count}", String(selectedRows.size))}
          </p>
          <textarea
            className={cn("w-full rounded border px-3 py-2 text-sm", fe.fieldError("bulkReason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")}
            minLength={3}
            onChange={(e) => { setBulkReason(e.target.value); fe.clearFieldError("bulkReason"); }}
            placeholder={t("reasonPlaceholder")}
            rows={3}
            value={bulkReason}
          />
          {fe.fieldError("bulkReason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("bulkReason")}</p>}
        </Modal>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <pre className="max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Modal({
  title,
  children,
  confirmLabel,
  confirming,
  onCancel,
  onConfirm,
  tone
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-base font-semibold">{title}</h3>
        <div className="mb-4">{children}</div>
        <div className="flex justify-end gap-2">
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
          <button
            className={cn(
              "rounded px-3 py-2 text-sm text-white disabled:opacity-50",
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
            )}
            disabled={confirming}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
