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
  cn
} from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Labels = Record<string, string>;

type CommonLabels = {
  empty: string;
  error: string;
  loading: string;
  records: string;
};

type PermissionRow = {
  id: string;
  code: string;
  group: string;
  description: string | null;
  roleCodes: string[];
  roleCount: number;
  adminCount: number;
  createdAt: string;
};

type PermissionDetail = {
  id: string;
  code: string;
  group: string;
  description: string | null;
  createdAt: string;
  roleCount: number;
  adminCount: number;
  roles: Array<{ id: string; code: string; name: string; description: string | null; status: string }>;
  admins: Array<{ id: string; displayName: string; email: string; status: string; viaRoleCodes: string[] }>;
  adminsTruncated: boolean;
};

type SortKey = "code" | "group" | "roleCount" | "adminCount";

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

export function IamPermissionsClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = (k: string) => labels[k] ?? k;

  const [rows, setRows] = useState<PermissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortAsc, setSortAsc] = useState(true);

  // Detail
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<PermissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(h);
  }, [search]);

  const loadList = useCallback(async () => {
    setError(null);
    try {
      const r = await adminApiFetch("/api/admin/iam/permissions");
      if (!r.ok) {
        setRows([]);
        setError(t("errorLoad"));
        return;
      }
      const data = (await r.json()) as PermissionRow[] | { items?: PermissionRow[] };
      setRows(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setRows([]);
      setError(t("errorLoad"));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (code: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await adminApiFetch(`/api/admin/iam/permissions/${encodeURIComponent(code)}`);
        if (!r.ok) {
          setDetail(null);
          setDetailError(t("errorDetail"));
          return;
        }
        const data = (await r.json()) as PermissionDetail;
        setDetail(data);
      } catch {
        setDetail(null);
        setDetailError(t("errorDetail"));
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedCode);
  }, [selectedCode, loadDetail]);

  const groups = useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map((r) => r.group))].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let out = rows.filter((row) => {
      if (groupFilter !== "all" && row.group !== groupFilter) return false;
      if (!debouncedSearch) return true;
      return (
        row.code.toLowerCase().includes(debouncedSearch) ||
        (row.description ?? "").toLowerCase().includes(debouncedSearch)
      );
    });
    out = out.slice().sort((a, b) => {
      let cmp: number;
      if (sortKey === "code") cmp = a.code.localeCompare(b.code);
      else if (sortKey === "group") cmp = a.group.localeCompare(b.group) || a.code.localeCompare(b.code);
      else if (sortKey === "roleCount") cmp = a.roleCount - b.roleCount;
      else cmp = a.adminCount - b.adminCount;
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }, [rows, debouncedSearch, groupFilter, sortKey, sortAsc]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortAsc((v) => !v);
      else {
        setSortKey(key);
        setSortAsc(key === "code" || key === "group");
      }
    },
    [sortKey]
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setGroupFilter("all");
  };

  const exportCsv = () => {
    downloadCsv(
      `permissions-catalog.csv`,
      [t("colCode"), t("colGroup"), t("colDescription"), t("colRoleCount"), t("colAdminCount"), "roleCodes"],
      filtered.map((row) => [
        row.code,
        row.group,
        row.description ?? "",
        String(row.roleCount),
        String(row.adminCount),
        row.roleCodes.join("|")
      ])
    );
  };

  const isLoading = rows === null;
  const totalLabel = `${t("countLabel")}: ${rows?.length ?? 0}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        {t("readOnlyNotice")}
      </div>

      <AdminSection description={totalLabel} title={t("title")}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[220px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("searchPlaceholder")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              type="search"
              value={search}
            />
          </label>
          <label className="block min-w-[180px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterGroup")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setGroupFilter(e.target.value)}
              value={groupFilter}
            >
              <option value="all">{t("filterGroupAll")}</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-1">
            <span className="block text-xs font-medium text-slate-600 pb-2">{t("sortLabel")}:</span>
            {(["code", "group", "roleCount", "adminCount"] as SortKey[]).map((k) => (
              <button
                key={k}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium",
                  sortKey === k
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                onClick={() => handleSort(k)}
                type="button"
              >
                {k === "code"
                  ? t("sortByCode")
                  : k === "group"
                    ? t("sortByGroup")
                    : k === "roleCount"
                      ? t("sortByRoleCount")
                      : t("sortByAdminCount")}
                {sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
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

        {isLoading ? (
          <p className="text-sm text-slate-600">{common.loading}</p>
        ) : error ? (
          <AdminEmptyState title={common.error}>{error}</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <AdminEmptyState title={t("empty")}>
            <button
              className="mt-2 inline-flex rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={resetFilters}
              type="button"
            >
              {t("emptyResetFilters")}
            </button>
          </AdminEmptyState>
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colCode")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colGroup")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colDescription")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colRoleCount")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colAdminCount")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {filtered.map((row) => {
                const isSelected = row.code === selectedCode;
                return (
                  <AdminDataTableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer hover:bg-indigo-50/40",
                      isSelected ? "bg-indigo-50" : undefined
                    )}
                  >
                    <AdminDataTableTd>
                      <button
                        className="text-left font-mono text-xs font-semibold text-indigo-700 hover:underline"
                        onClick={() => setSelectedCode(row.code)}
                        type="button"
                      >
                        {row.code}
                      </button>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800">
                        {row.group}
                      </code>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-xs text-slate-700">{row.description ?? "—"}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-xs font-semibold text-slate-800">{row.roleCount}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-xs font-semibold text-slate-800">{row.adminCount}</span>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                );
              })}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {selectedCode ? (
        <AdminSection
          description={detail?.description ?? undefined}
          title={`${t("detailHeading")} — ${detail?.code ?? selectedCode}`}
        >
          {detailLoading ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : detailError || !detail ? (
            <p className="text-sm text-rose-700">{detailError ?? common.error}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  <span>
                    {t("colGroup")}:{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                      {detail.group}
                    </code>
                  </span>
                  <span>
                    {t("colRoleCount")}: <strong>{detail.roleCount}</strong>
                  </span>
                  <span>
                    {t("colAdminCount")}: <strong>{detail.adminCount}</strong>
                  </span>
                </div>
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => setSelectedCode(null)}
                  type="button"
                >
                  {t("close")}
                </button>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailRoles")}</h4>
                {detail.roles.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("detailNoRoles")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detail.roles.map((r) => (
                      <Link
                        className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
                        href={`/${locale}/iam/roles?code=${encodeURIComponent(r.code)}`}
                        key={r.id}
                        title={r.description ?? r.name}
                      >
                        <code className="font-mono text-[11px]">{r.code}</code>
                        <span className="text-[10px] text-indigo-700/80">· {r.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">{t("detailAdmins")}</h4>
                  <Link
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                    href={`/${locale}/iam/admins`}
                  >
                    {t("openAdminsPage")} →
                  </Link>
                </div>
                {detail.admins.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("detailNoAdmins")}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                      {detail.admins.map((a) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                          key={a.id}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800">{a.displayName}</span>
                            <span className="ml-2 text-slate-600">{a.email}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-slate-500">{t("detailViaRole")}:</span>
                            {a.viaRoleCodes.map((c) => (
                              <code
                                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-800"
                                key={c}
                              >
                                {c}
                              </code>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {detail.adminsTruncated ? (
                      <p className="mt-2 text-[11px] text-amber-800">
                        {t("detailAdminsTruncated")}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </AdminSection>
      ) : null}
    </div>
  );
}
