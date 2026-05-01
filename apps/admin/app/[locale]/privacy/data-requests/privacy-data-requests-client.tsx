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

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type RequestRow = {
  id: string;
  userId: string;
  kind: "export" | "delete";
  status: "pending" | "processing" | "completed" | "failed";
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
};
type ListResponse = { items: RequestRow[]; total: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  beforeState: unknown;
  afterState: unknown;
  actor: { id: string; displayName: string; email: string } | null;
};
type Detail = RequestRow & {
  resultPayload: Record<string, unknown> | null;
  audit: AuditEntry[];
};

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
function permsFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) {
    for (const link of r.role?.permissions ?? []) {
      const code = link.permission?.code;
      if (code) out.add(code);
    }
  }
  return out;
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

function statusTone(s: RequestRow["status"]): "neutral" | "good" | "warning" | "danger" {
  if (s === "completed") return "good";
  if (s === "processing") return "neutral";
  if (s === "failed") return "danger";
  return "warning";
}

const PAGE_SIZE = 50;

const WRITE_PERMS = ["iam.manage", "admin.privacy.write", "privacy.manage"];

export function PrivacyDataRequestsClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && WRITE_PERMS.some((p) => perms.has(p));

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "export" | "delete">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RequestRow["status"]>("all");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  type Action = "ack" | "fulfill" | "reject" | "erase" | null;
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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
      if (kindFilter !== "all") params.set("kind", kindFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/privacy/requests?${params.toString()}`);
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
  }, [kindFilter, statusFilter, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setPage(1);
  }, [kindFilter, statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/privacy/requests/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(item: RequestRow) {
    setSelected(item);
    setDetail(null);
    setAction(null);
    setReason("");
    setDownloadUrl("");
    setNotes("");
    setConfirmToken("");
    void loadDetail(item.id);
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
    if (action === "erase" && confirmToken.trim() !== selected.id) {
      setToast({ kind: "err", text: t("erasureConfirmMismatch") });
      return;
    }
    setMutating(true);
    try {
      let url = "";
      let method: "PATCH" | "POST" = "POST";
      let body: Record<string, unknown> = { reason: reason.trim() };
      if (action === "ack") {
        url = `/api/admin/privacy/requests/${selected.id}/acknowledge`;
        method = "PATCH";
      } else if (action === "fulfill") {
        url = `/api/admin/privacy/requests/${selected.id}/fulfill`;
        method = "POST";
        if (downloadUrl.trim()) body.downloadUrl = downloadUrl.trim();
        if (notes.trim()) body.notes = notes.trim();
      } else if (action === "reject") {
        url = `/api/admin/privacy/requests/${selected.id}/reject`;
        method = "POST";
      } else if (action === "erase") {
        url = `/api/admin/privacy/requests/${selected.id}/erasure-confirm`;
        method = "POST";
        body = { ...body, confirmationToken: confirmToken.trim() };
      }
      const r = await adminApiFetch(url, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method
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
      setDownloadUrl("");
      setNotes("");
      setConfirmToken("");
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "userId", "kind", "status", "lastError", "createdAt", "completedAt"];
    const rows = list.items.map((it) => [
      it.id,
      it.userId,
      it.kind,
      it.status,
      it.lastError ?? "",
      it.createdAt,
      it.completedAt ?? ""
    ]);
    downloadCsv(`privacy-requests-${Date.now()}.csv`, header, rows);
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const counts = useMemo(() => {
    if (!list) return null;
    const c = { pending: 0, processing: 0, completed: 0, failed: 0 } as Record<RequestRow["status"], number>;
    for (const it of list.items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [list]);

  const eraseGate = action === "erase";
  const ackAvailable = selected?.status === "pending";
  const fulfillAvailable = selected?.kind === "export" && (selected.status === "pending" || selected.status === "processing");
  const rejectAvailable = selected != null && selected.status !== "completed" && selected.status !== "failed";
  const eraseAvailable = selected?.kind === "delete" && selected.status !== "completed" && selected.status !== "failed";

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
            aria-label={t("filterKind")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setKindFilter(e.target.value as "all" | "export" | "delete")}
            value={kindFilter}
          >
            <option value="all">{t("filterKindAll")}</option>
            <option value="export">{t("kindExport")}</option>
            <option value="delete">{t("kindDelete")}</option>
          </select>
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value as "all" | RequestRow["status"])}
            value={statusFilter}
          >
            <option value="all">{t("filterStatusAll")}</option>
            <option value="pending">{t("statusPending")}</option>
            <option value="processing">{t("statusProcessing")}</option>
            <option value="completed">{t("statusCompleted")}</option>
            <option value="failed">{t("statusFailed")}</option>
          </select>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
            {t("actionExportCsv")}
          </button>
          {counts ? (
            <div className="ml-auto flex gap-2 text-xs">
              <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">{t("statusPending")}: {counts.pending}</span>
              <span className="rounded bg-slate-100 px-2 py-1">{t("statusProcessing")}: {counts.processing}</span>
              <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">{t("statusCompleted")}: {counts.completed}</span>
              <span className="rounded bg-red-100 px-2 py-1 text-red-900">{t("statusFailed")}: {counts.failed}</span>
            </div>
          ) : null}
        </div>
      </AdminSection>

      {listError ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{listError}</div>
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
                <AdminDataTableTh>{t("colId")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colKind")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCompleted")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((item) => (
                <AdminDataTableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-indigo-50/40"
                  onClick={() => openDrawer(item)}
                >
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{item.id.slice(0, 8)}…</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{item.userId.slice(0, 8)}…</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={item.kind === "delete" ? "danger" : "neutral"}>
                      {item.kind === "delete" ? t("kindDelete") : t("kindExport")}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(item.status)}>
                      {t(`status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">
                      {item.completedAt ? new Date(item.completedAt).toLocaleString() : "—"}
                    </span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}

        {list && list.total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">‹</button>
            <span className="text-gray-600">{page} / {totalPages}</span>
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">›</button>
          </div>
        ) : null}
      </AdminSection>

      {selected ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeDrawer} role="dialog">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{t("colId")}: {selected.id}</div>
                <div className="font-mono text-base font-semibold">
                  {selected.kind === "delete" ? t("kindDelete") : t("kindExport")}
                </div>
                <AdminStatusBadge tone={statusTone(selected.status)}>
                  {t(`status${selected.status.charAt(0).toUpperCase()}${selected.status.slice(1)}`)}
                </AdminStatusBadge>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={closeDrawer} type="button">{t("close")}</button>
            </div>

            {detail == null ? (
              <div className="mt-4 text-sm text-gray-500">{common.loading}</div>
            ) : (
              <div className="mt-4 space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-500">{t("colUser")}</dt>
                  <dd className="font-mono text-xs">{detail.userId}</dd>
                  <dt className="text-gray-500">{t("colCreated")}</dt>
                  <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                  <dt className="text-gray-500">{t("colCompleted")}</dt>
                  <dd>{detail.completedAt ? new Date(detail.completedAt).toLocaleString() : "—"}</dd>
                  {detail.lastError ? (
                    <>
                      <dt className="text-gray-500">{t("colLastError")}</dt>
                      <dd className="text-red-700">{detail.lastError}</dd>
                    </>
                  ) : null}
                </dl>

                {detail.resultPayload ? (
                  <div className="rounded border bg-gray-50 p-2 text-xs">
                    <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">{t("payload")}</div>
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(detail.resultPayload, null, 2)}</pre>
                  </div>
                ) : null}

                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    {ackAvailable ? (
                      <button className="rounded border px-3 py-1 text-sm" onClick={() => setAction("ack")} type="button">{t("actionAcknowledge")}</button>
                    ) : null}
                    {fulfillAvailable ? (
                      <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white" onClick={() => setAction("fulfill")} type="button">{t("actionFulfill")}</button>
                    ) : null}
                    {rejectAvailable ? (
                      <button className="rounded border px-3 py-1 text-sm" onClick={() => setAction("reject")} type="button">{t("actionReject")}</button>
                    ) : null}
                    {eraseAvailable ? (
                      <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={() => setAction("erase")} type="button">{t("actionErase")}</button>
                    ) : null}
                  </div>
                ) : null}

                {action ? (
                  <div className={`rounded border p-3 ${eraseGate ? "border-red-400 bg-red-50" : "bg-white"}`}>
                    {eraseGate ? (
                      <div className="mb-2 rounded border border-red-300 bg-red-100 p-2 text-xs text-red-900">
                        {t("erasureWarning")}
                      </div>
                    ) : null}
                    <label className="block text-xs font-semibold uppercase text-gray-600">{t("reason")}</label>
                    <input className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setReason(e.target.value)} value={reason} placeholder={t("reasonPlaceholder")} />
                    {action === "fulfill" ? (
                      <>
                        <label className="mt-2 block text-xs font-semibold uppercase text-gray-600">{t("downloadUrl")}</label>
                        <input className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setDownloadUrl(e.target.value)} value={downloadUrl} placeholder="https://…" />
                        <label className="mt-2 block text-xs font-semibold uppercase text-gray-600">{t("notes")}</label>
                        <textarea className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setNotes(e.target.value)} rows={2} value={notes} />
                      </>
                    ) : null}
                    {eraseGate ? (
                      <>
                        <label className="mt-2 block text-xs font-semibold uppercase text-red-800">{t("typeIdToConfirm")}</label>
                        <input className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs" onChange={(e) => setConfirmToken(e.target.value)} value={confirmToken} placeholder={selected.id} />
                      </>
                    ) : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <button className="rounded border px-3 py-1 text-sm" onClick={() => setAction(null)} type="button">{t("cancel")}</button>
                      <button className={`rounded px-3 py-1 text-sm text-white disabled:opacity-50 ${eraseGate ? "bg-red-700" : "bg-indigo-600"}`} disabled={mutating} onClick={() => void submit()} type="button">{t("confirm")}</button>
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
                          {a.actor ? <div className="text-gray-600">{a.actor.displayName} ({a.actor.email})</div> : null}
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
        <div className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`} role="status">
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">✕</button>
        </div>
      ) : null}
    </div>
  );
}
