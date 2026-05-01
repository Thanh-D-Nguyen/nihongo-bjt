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
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Locale = "vi" | "ja" | "en";
const LOCALES: Locale[] = ["vi", "ja", "en"];

type LocaleStatus = "translated" | "missing" | "empty";

type Summary = {
  id: string;
  namespace: string;
  key: string;
  description: string | null;
  values: Record<Locale, string | null>;
  status: Record<Locale, LocaleStatus>;
  complete: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
  before: unknown;
  after: unknown;
};

type Detail = Summary & { audit: AuditEntry[] };

type Pending = {
  total: number;
  pending: number;
  complete: number;
  namespaces: { namespace: string; pending: number; total: number }[];
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

const PAGE_SIZE = 50;

export function I18nAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("admin.content.write");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [namespace, setNamespace] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "untranslated" | "complete">("all");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editLocale, setEditLocale] = useState<Locale | null>(null);
  const [editValue, setEditValue] = useState("");
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, namespace, statusFilter]);

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
      if (namespace) params.set("namespace", namespace);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/i18n/keys?${params.toString()}`);
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
  }, [debounced, namespace, statusFilter, page, common.error]);

  const loadPending = useCallback(async () => {
    try {
      const r = await adminApiFetch("/api/admin/i18n/pending");
      if (!r.ok) return;
      setPending((await r.json()) as Pending);
    } catch {
      // ignore — KPI is best-effort
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/i18n/keys/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(item: Summary) {
    setSelected(item);
    setDetail(null);
    setEditLocale(null);
    setEditValue("");
    setReason("");
    void loadDetail(item.id);
  }

  function closeDrawer() {
    setSelected(null);
    setDetail(null);
    setEditLocale(null);
  }

  function startEdit(loc: Locale) {
    if (!canWrite || !detail) return;
    setEditLocale(loc);
    setEditValue(detail.values[loc] ?? "");
    setReason("");
  }

  async function submitEdit() {
    if (!detail || !editLocale) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/i18n/keys/${detail.id}/translation`, {
        body: JSON.stringify({ locale: editLocale, reason: reason.trim(), value: editValue }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: t("updateFailed") });
        return;
      }
      const body = (await r.json()) as Detail;
      setDetail(body);
      setEditLocale(null);
      setReason("");
      setToast({ kind: "ok", text: t("updateOk") });
      void loadList();
      void loadPending();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["namespace", "key", "vi", "ja", "en", "complete", "updatedAt"];
    const rows = list.items.map((it) => [
      it.namespace,
      it.key,
      it.values.vi ?? "",
      it.values.ja ?? "",
      it.values.en ?? "",
      String(it.complete),
      it.updatedAt
    ]);
    downloadCsv(`i18n-keys-${Date.now()}.csv`, header, rows);
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      {pending ? (
        <AdminSection>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="text-xs uppercase tracking-wide text-amber-700">{t("kpiPending")}</div>
              <div className="mt-1 text-2xl font-semibold text-amber-900">{pending.pending.toLocaleString()}</div>
              <div className="text-xs text-amber-800">{t("kpiPendingHint")}</div>
            </div>
            <div className="rounded-md border bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{t("kpiComplete")}</div>
              <div className="mt-1 text-2xl font-semibold">{pending.complete.toLocaleString()}</div>
              <div className="text-xs text-gray-500">/ {pending.total.toLocaleString()} {t("kpiTotalKeys")}</div>
            </div>
            <div className="rounded-md border bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">{t("kpiTopPending")}</div>
              <ul className="mt-1 max-h-20 overflow-auto text-sm">
                {pending.namespaces.slice(0, 5).map((n) => (
                  <li key={n.namespace} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-xs">{n.namespace}</span>
                    <span className="text-amber-700">{n.pending}</span>
                  </li>
                ))}
                {pending.namespaces.length === 0 ? (
                  <li className="text-xs text-gray-400">{common.empty}</li>
                ) : null}
              </ul>
            </div>
          </div>
        </AdminSection>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label={t("filterSearch")}
            className="min-w-[260px] flex-1 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
          <input
            aria-label={t("filterNamespace")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setNamespace(e.target.value)}
            placeholder={t("filterNamespace")}
            value={namespace}
          />
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value as "all" | "untranslated" | "complete")}
            value={statusFilter}
          >
            <option value="all">{t("filterStatusAll")}</option>
            <option value="untranslated">{t("filterStatusUntranslated")}</option>
            <option value="complete">{t("filterStatusComplete")}</option>
          </select>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
            {t("actionExportCsv")}
          </button>
        </div>
      </AdminSection>

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
                <AdminDataTableTh>{t("colNamespace")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colKey")}</AdminDataTableTh>
                {LOCALES.map((loc) => (
                  <AdminDataTableTh key={loc}>{loc.toUpperCase()}</AdminDataTableTh>
                ))}
                <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
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
                    <span className="font-mono text-xs text-gray-600">{item.namespace}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{item.key}</span>
                  </AdminDataTableTd>
                  {LOCALES.map((loc) => {
                    const status = item.status[loc];
                    const tone =
                      status === "translated" ? "neutral" : status === "empty" ? "warning" : "danger";
                    const label =
                      status === "translated" ? "✓" : status === "empty" ? "∅" : "✗";
                    return (
                      <AdminDataTableTd key={loc}>
                        <AdminStatusBadge tone={tone}>{label}</AdminStatusBadge>
                      </AdminDataTableTd>
                    );
                  })}
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">
                      {new Date(item.updatedAt).toLocaleString()}
                    </span>
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
        <div
          aria-modal
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={closeDrawer}
          role="dialog"
        >
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{selected.namespace}</div>
                <div className="font-mono text-base font-semibold">{selected.key}</div>
                {selected.description ? (
                  <div className="mt-1 text-xs text-gray-600">{selected.description}</div>
                ) : null}
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={closeDrawer} type="button">
                {t("close")}
              </button>
            </div>

            {detail == null ? (
              <div className="mt-4 text-sm text-gray-500">{common.loading}</div>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {LOCALES.map((loc) => {
                    const status = detail.status[loc];
                    const value = detail.values[loc] ?? "";
                    const isEditing = editLocale === loc;
                    return (
                      <div key={loc} className="rounded border p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs uppercase">{loc}</span>
                            <AdminStatusBadge
                              tone={
                                status === "translated"
                                  ? "neutral"
                                  : status === "empty"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {t(`status_${status}`)}
                            </AdminStatusBadge>
                          </div>
                          {canWrite && !isEditing ? (
                            <button
                              className="rounded border px-2 py-0.5 text-xs"
                              onClick={() => startEdit(loc)}
                              type="button"
                            >
                              {t("edit")}
                            </button>
                          ) : null}
                        </div>
                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              className="w-full rounded border px-2 py-1 text-sm"
                              onChange={(e) => setEditValue(e.target.value)}
                              rows={3}
                              value={editValue}
                            />
                            <input
                              className="w-full rounded border px-2 py-1 text-sm"
                              onChange={(e) => setReason(e.target.value)}
                              placeholder={t("reasonPlaceholder")}
                              value={reason}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded border px-3 py-1 text-sm"
                                onClick={() => setEditLocale(null)}
                                type="button"
                              >
                                {t("cancel")}
                              </button>
                              <button
                                className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                                disabled={mutating}
                                onClick={() => void submitEdit()}
                                type="button"
                              >
                                {t("save")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 whitespace-pre-wrap text-sm">
                            {value || <span className="text-gray-400">—</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-semibold">{t("auditTitle")}</h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    {detail.audit.length === 0 ? (
                      <li className="text-gray-400">{common.empty}</li>
                    ) : (
                      detail.audit.map((a) => (
                        <li key={a.id} className="rounded border bg-gray-50 px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{a.action}</span>
                            <span className="text-gray-500">
                              {new Date(a.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {a.actor ? (
                            <div className="text-gray-600">
                              {a.actor.displayName} ({a.actor.email})
                            </div>
                          ) : null}
                          {a.reason ? <div className="text-gray-600">— {a.reason}</div> : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`}
          role="status"
          onAnimationEnd={() => setToast(null)}
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
