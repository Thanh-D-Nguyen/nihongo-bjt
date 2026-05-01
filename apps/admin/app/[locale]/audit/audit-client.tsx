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
import { downloadCsv } from "@/app/_components/admin-client-utils";

interface AuditLog {
  action: string;
  actor: { id: string; displayName: string; email: string };
  after: unknown;
  before: unknown;
  createdAt: string;
  id: string;
  reason: string | null;
  targetId: string;
  targetType: string;
}

interface AuditResponse {
  items: AuditLog[];
  page: number;
  pageSize: number;
  total: number;
}

type Labels = Record<string, string>;
type CommonLabels = Record<string, string>;

const PAGE_SIZE = 25;

export function AuditClient({ common, labels }: { common?: CommonLabels; labels: Labels }) {
  const t = (k: string) => labels[k] ?? common?.[k] ?? k;

  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (search) params.set("q", search);
      if (actionFilter) params.set("action", actionFilter);
      if (targetTypeFilter) params.set("targetType", targetTypeFilter);

      const res = await adminApiFetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      if (Array.isArray(body)) {
        setData({ items: body as AuditLog[], total: (body as AuditLog[]).length, page: 1, pageSize: PAGE_SIZE });
      } else {
        setData(body as AuditResponse);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, targetTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const actions = [...new Set(data?.items.map((i) => i.action) ?? [])].sort();
  const targetTypes = [...new Set(data?.items.map((i) => i.targetType) ?? [])].sort();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void load();
  }

  function formatDiff(val: unknown): string {
    if (val == null) return "—";
    if (typeof val === "string") return val;
    return JSON.stringify(val, null, 2);
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />

      <AdminSection>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("search")}</label>
            <input
              type="text"
              className="w-full rounded border px-3 py-1.5 text-sm"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("colAction")}</label>
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("allActions")}</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("colTargetType")}</label>
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={targetTypeFilter}
              onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("allTargetTypes")}</option>
              {targetTypes.map((tt) => (
                <option key={tt} value={tt}>{tt}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded bg-primary px-4 py-1.5 text-sm text-white">
            {t("search")}
          </button>
          {data && data.items.length > 0 ? (
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                downloadCsv(
                  `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
                  [t("colTime"), t("colAction"), "Actor", "Email", t("colTargetType"), t("colTargetId"), t("colReason")],
                  data.items.map((log) => [
                    new Date(log.createdAt).toISOString(),
                    log.action,
                    log.actor?.displayName ?? "",
                    log.actor?.email ?? "",
                    log.targetType,
                    log.targetId,
                    log.reason ?? ""
                  ])
                );
              }}
            >
              {t("exportCsv")}
            </button>
          ) : null}
        </form>
      </AdminSection>

      {error ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {t("error")}
        </div>
      ) : null}

      {data && !loading ? (
        <div className="text-xs text-gray-500">{t("records")}: {data.total}</div>
      ) : null}

      <AdminSection>
        {loading && !data ? (
          <div className="p-4 text-sm text-gray-500">{t("loading")}</div>
        ) : data && data.items.length === 0 ? (
          <AdminEmptyState title={t("empty")} />
        ) : data ? (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colTime")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAction")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colActor")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTargetType")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTargetId")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colReason")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colDetail")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {data.items.map((log) => (
                  <AdminDataTableRow key={log.id}>
                    <AdminDataTableTd>
                      <span className="whitespace-nowrap text-xs font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone="neutral">{log.action}</AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <div className="text-sm font-medium">{log.actor?.displayName ?? "—"}</div>
                      <div className="text-xs text-gray-500">{log.actor?.email ?? ""}</div>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <code className="text-xs">{log.targetType}</code>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <code className="text-xs">{log.targetId.length > 20 ? `${log.targetId.slice(0, 8)}…` : log.targetId}</code>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-xs">{log.reason ?? "—"}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        {expanded === log.id ? t("collapse") : t("expand")}
                      </button>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            {expanded && data.items.find((l) => l.id === expanded) ? (
              <div className="mt-2 rounded border bg-gray-50 p-4 text-xs font-mono">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 font-semibold text-gray-700">{t("before")}</p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 border">
                      {formatDiff(data.items.find((l) => l.id === expanded)?.before)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-gray-700">{t("after")}</p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 border">
                      {formatDiff(data.items.find((l) => l.id === expanded)?.after)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-xs text-gray-500">
                {t("paginationRowsRange")
                  .replace("{from}", String((page - 1) * PAGE_SIZE + 1))
                  .replace("{to}", String(Math.min(page * PAGE_SIZE, data.total)))
                  .replace("{total}", String(data.total))}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                >
                  {t("paginationPrev")}
                </button>
                <span className="text-xs">
                  {t("paginationPageOf")
                    .replace("{current}", String(page))
                    .replace("{totalPages}", String(totalPages))}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                >
                  {t("paginationNext")}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </AdminSection>
    </div>
  );
}
