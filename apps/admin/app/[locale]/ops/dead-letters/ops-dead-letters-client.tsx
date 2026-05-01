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
import {
  type CommonLabels,
  type Labels,
  buildT,
  downloadCsv,
  loadAdminPermissions
} from "../../../_components/admin-client-utils";

type DlqRow = {
  id: string;
  source: string;
  queueName: string | null;
  eventType: string | null;
  status: string;
  retryCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
type ListResponse = { items: DlqRow[]; total: number };

type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
  actor: { id: string; displayName: string | null; email: string | null } | null;
};
type Detail = DlqRow & { payload: unknown; audit: AuditEntry[] };

const PAGE_SIZE = 50;
const WRITE_PERMS = ["iam.manage"];

function statusTone(s: string): "neutral" | "good" | "warning" | "danger" {
  if (s === "resolved") return "good";
  if (s === "open") return "warning";
  if (s === "discarded") return "neutral";
  return "danger";
}

export function OpsDeadLettersClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = buildT(labels);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && WRITE_PERMS.some((p) => perms.has(p));

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<DlqRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [action, setAction] = useState<"retry" | "discard" | null>(null);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"retry" | "discard" | null>(null);
  const [bulkReason, setBulkReason] = useState("");

  useEffect(() => {
    let cancel = false;
    void loadAdminPermissions().then((p) => {
      if (!cancel) setPerms(p);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (queueFilter.trim()) params.set("queueName", queueFilter.trim());
      if (sourceFilter.trim()) params.set("source", sourceFilter.trim());
      if (searchText.trim()) params.set("q", searchText.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/operations/dead-letter-queue?${params.toString()}`);
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
  }, [statusFilter, queueFilter, sourceFilter, searchText, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setPage(1);
  }, [statusFilter, queueFilter, sourceFilter, searchText]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/operations/dead-letter-queue/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(row: DlqRow) {
    setSelected(row);
    setDetail(null);
    setAction(null);
    setReason("");
    void loadDetail(row.id);
  }
  function closeDrawer() {
    setSelected(null);
    setDetail(null);
  }

  async function submit() {
    if (!selected || !action) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const body = JSON.stringify({ reason: reason.trim() });
      let url = "";
      if (action === "retry") {
        url = `/api/admin/operations/dead-letter-queue/${selected.id}/retry`;
      } else {
        // discard via existing PATCH /:id with status=discarded
        url = `/api/admin/operations/dead-letter-queue/${selected.id}`;
      }
      const r = await adminApiFetch(url, {
        body:
          action === "discard"
            ? JSON.stringify({ reason: reason.trim(), status: "discarded" })
            : body,
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        const text = await r.text();
        setToast({ kind: "err", text: text || t("updateFailed") });
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
      void loadList();
      void loadDetail(selected.id);
      setAction(null);
      setReason("");
    } finally {
      setMutating(false);
    }
  }

  async function submitBulk() {
    if (!bulkAction || selectedIds.size === 0) return;
    if (bulkReason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/operations/dead-letter-queue/bulk`, {
        body: JSON.stringify({
          action: bulkAction,
          ids: [...selectedIds],
          reason: bulkReason.trim()
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        const text = await r.text();
        setToast({ kind: "err", text: text || t("updateFailed") });
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
      setSelectedIds(new Set());
      setBulkAction(null);
      setBulkReason("");
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "source", "queueName", "eventType", "status", "retryCount", "errorCode", "createdAt"];
    const rows = list.items.map((it) => [
      it.id,
      it.source,
      it.queueName ?? "",
      it.eventType ?? "",
      it.status,
      String(it.retryCount),
      it.errorCode ?? "",
      it.createdAt
    ]);
    downloadCsv(`ops-dead-letters-${Date.now()}.csv`, header, rows);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const counts = useMemo(() => {
    if (!list) return null;
    const c: Record<string, number> = { open: 0, failed: 0, resolved: 0, discarded: 0 };
    for (const it of list.items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [list]);

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">{t("filterStatusAll")}</option>
            <option value="open">{t("statusOpen")}</option>
            <option value="failed">{t("statusFailed")}</option>
            <option value="resolved">{t("statusResolved")}</option>
            <option value="discarded">{t("statusDiscarded")}</option>
          </select>
          <input
            aria-label={t("filterQueue")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setQueueFilter(e.target.value)}
            placeholder={t("filterQueue")}
            value={queueFilter}
          />
          <input
            aria-label={t("filterSource")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setSourceFilter(e.target.value)}
            placeholder={t("filterSource")}
            value={sourceFilter}
          />
          <input
            aria-label={t("filterSearch")}
            className="w-72 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("filterSearch")}
            value={searchText}
          />
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
            {t("actionExportCsv")}
          </button>
          {counts ? (
            <div className="ml-auto flex gap-2 text-xs">
              <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">
                {t("statusOpen")}: {counts.open}
              </span>
              <span className="rounded bg-red-100 px-2 py-1 text-red-900">
                {t("statusFailed")}: {counts.failed}
              </span>
              <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">
                {t("statusResolved")}: {counts.resolved}
              </span>
              <span className="rounded bg-slate-100 px-2 py-1">
                {t("statusDiscarded")}: {counts.discarded}
              </span>
            </div>
          ) : null}
        </div>
      </AdminSection>

      {canWrite && selectedIds.size > 0 ? (
        <AdminSection>
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-sm">
              {t("bulkConfirm").replace("{count}", String(selectedIds.size))}
            </span>
            <button
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
              onClick={() => setBulkAction("retry")}
              type="button"
            >
              {t("actionBulkRetry")}
            </button>
            <button
              className="rounded bg-red-600 px-3 py-1 text-sm text-white"
              onClick={() => setBulkAction("discard")}
              type="button"
            >
              {t("actionBulkDiscard")}
            </button>
            <button
              className="rounded border px-3 py-1 text-sm"
              onClick={() => {
                setSelectedIds(new Set());
                setBulkAction(null);
                setBulkReason("");
              }}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
          {bulkAction ? (
            <div className={`mt-2 rounded border p-3 ${bulkAction === "discard" ? "border-red-300 bg-red-50" : "bg-white"}`}>
              <label className="block text-xs font-semibold uppercase text-gray-600">{t("reason")}</label>
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                value={bulkReason}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button className="rounded border px-3 py-1 text-sm" onClick={() => setBulkAction(null)} type="button">
                  {t("cancel")}
                </button>
                <button
                  className={`rounded px-3 py-1 text-sm text-white disabled:opacity-50 ${bulkAction === "discard" ? "bg-red-700" : "bg-indigo-600"}`}
                  disabled={mutating}
                  onClick={() => void submitBulk()}
                  type="button"
                >
                  {t("confirm")}
                </button>
              </div>
            </div>
          ) : null}
        </AdminSection>
      ) : null}

      {listError ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {listError}
        </div>
      ) : null}

      <AdminSection>
        {list == null ? (
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        ) : list.items.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {canWrite ? <AdminDataTableTh /> : null}
                <AdminDataTableTh>{t("colId")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colSource")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colQueue")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colEventType")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colRetry")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colError")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((item) => (
                <AdminDataTableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-indigo-50/40"
                  onClick={() => openDrawer(item)}
                >
                  {canWrite ? (
                    <AdminDataTableTd onClick={(e) => e.stopPropagation()}>
                      <input
                        aria-label={`select ${item.id}`}
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        type="checkbox"
                      />
                    </AdminDataTableTd>
                  ) : null}
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{item.id.slice(0, 8)}…</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{item.source}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{item.queueName ?? "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{item.eventType ?? "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{item.retryCount}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="line-clamp-1 max-w-xs text-xs text-red-700">{item.errorCode ?? ""} {item.errorMessage ?? ""}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
        {list && list.total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              className="rounded border px-2 py-1 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              ‹
            </button>
            <span className="text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              className="rounded border px-2 py-1 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              ›
            </button>
          </div>
        ) : null}
      </AdminSection>

      {selected ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeDrawer} role="dialog">
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{t("colId")}: {selected.id}</div>
                <div className="text-base font-semibold">{t("drawerTitle")}</div>
                <AdminStatusBadge tone={statusTone(selected.status)}>{selected.status}</AdminStatusBadge>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={closeDrawer} type="button">
                {t("close")}
              </button>
            </div>

            {detail == null ? (
              <div className="mt-4 text-sm text-gray-500">{common.loading}</div>
            ) : (
              <div className="mt-4 space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-500">{t("colSource")}</dt>
                  <dd>{detail.source}</dd>
                  <dt className="text-gray-500">{t("colQueue")}</dt>
                  <dd className="font-mono text-xs">{detail.queueName ?? "—"}</dd>
                  <dt className="text-gray-500">{t("colEventType")}</dt>
                  <dd className="font-mono text-xs">{detail.eventType ?? "—"}</dd>
                  <dt className="text-gray-500">{t("colRetry")}</dt>
                  <dd>{detail.retryCount}</dd>
                  <dt className="text-gray-500">{t("colCreated")}</dt>
                  <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                </dl>

                {detail.errorMessage || detail.errorCode ? (
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-xs">
                    <div className="mb-1 font-semibold uppercase tracking-wide text-red-700">
                      {t("errorTraceTitle")}
                    </div>
                    <div className="font-mono text-xs text-red-900">
                      {detail.errorCode ? <div>{detail.errorCode}</div> : null}
                      {detail.errorMessage ? <pre className="whitespace-pre-wrap break-words">{detail.errorMessage}</pre> : null}
                    </div>
                  </div>
                ) : null}

                <div className="rounded border bg-gray-50 p-2 text-xs">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">
                    {t("payloadTitle")}
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(detail.payload ?? {}, null, 2)}
                  </pre>
                </div>

                {canWrite && (selected.status === "open" || selected.status === "failed") ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                      onClick={() => setAction("retry")}
                      type="button"
                    >
                      {t("actionRetry")}
                    </button>
                    <button
                      className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                      onClick={() => setAction("discard")}
                      type="button"
                    >
                      {t("actionDiscard")}
                    </button>
                  </div>
                ) : null}

                {action ? (
                  <div className={`rounded border p-3 ${action === "discard" ? "border-red-300 bg-red-50" : "bg-white"}`}>
                    {action === "discard" ? (
                      <div className="mb-2 rounded border border-red-300 bg-red-100 p-2 text-xs text-red-900">
                        {t("discardWarning")}
                      </div>
                    ) : null}
                    <label className="block text-xs font-semibold uppercase text-gray-600">{t("reason")}</label>
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t("reasonPlaceholder")}
                      value={reason}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button className="rounded border px-3 py-1 text-sm" onClick={() => setAction(null)} type="button">
                        {t("cancel")}
                      </button>
                      <button
                        className={`rounded px-3 py-1 text-sm text-white disabled:opacity-50 ${action === "discard" ? "bg-red-700" : "bg-indigo-600"}`}
                        disabled={mutating}
                        onClick={() => void submit()}
                        type="button"
                      >
                        {t("confirm")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-2">
                  <h3 className="text-sm font-semibold">{t("auditTitle")}</h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    {detail.audit.length === 0 ? (
                      <li className="text-gray-400">{common.empty}</li>
                    ) : (
                      detail.audit.map((a) => (
                        <li key={a.id} className="rounded border bg-gray-50 px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{a.action}</span>
                            <span className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
                          </div>
                          {a.actor ? (
                            <div className="text-gray-600">
                              {a.actor.displayName ?? a.actor.email ?? a.actor.id}
                            </div>
                          ) : null}
                          {a.reason ? <div className="text-gray-700">{a.reason}</div> : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`}
          role="status"
        >
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
