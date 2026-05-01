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
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Labels = Record<string, string>;

type CommonLabels = {
  empty: string;
  error: string;
  loading: string;
  records: string;
};

type AdminListItem = {
  id: string;
  displayName: string;
  email: string;
  status: string;
  keycloakSubject: string | null;
  roleCodes: string[];
  createdAt: string;
  updatedAt: string;
};

type AdminListResponse = {
  items: AdminListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type RoleSummary = {
  id: string;
  code: string;
  name: string;
};

type AdminDetailRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissionCount: number;
  status: string;
  grantedAt: string;
};

type AdminAuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  targetId: string | null;
  targetType: string | null;
  before: unknown;
  after: unknown;
  actor: { id: string; displayName: string; email: string } | null;
};

type AdminDetail = {
  id: string;
  displayName: string;
  email: string;
  status: string;
  keycloakSubject: string | null;
  createdAt: string;
  updatedAt: string;
  roles: AdminDetailRole[];
  audit: AdminAuditEntry[];
};

type SortKey = "displayName" | "email" | "roleCount" | "updatedAt";

type StatusFilter = "all" | "active" | "disabled";

const PAGE_SIZE = 25;

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "active") return "good";
  if (status === "disabled" || status === "archived") return "warning";
  if (status === "deleted") return "danger";
  return "neutral";
}

function maskSubject(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length < 10) return "****";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatWhen(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(iso));
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

type MePayload = {
  roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
};

function permissionCodesFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) {
    for (const link of r.role?.permissions ?? []) {
      const code = link.permission?.code;
      if (code) out.add(code);
    }
  }
  return out;
}

export function IamAdminsClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = (k: string) => labels[k] ?? k;

  // Permission set drives UX gating. Backend re-enforces RBAC on every mutation.
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("iam.manage");

  // List state
  const [list, setList] = useState<AdminListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  // Sorting (client-side over current page)
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  // Roles (for filter and assign combobox)
  const [roles, setRoles] = useState<RoleSummary[]>([]);

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mutation state
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [assignRole, setAssignRole] = useState<string>("");
  const [reason, setReason] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<
    | { kind: "revoke"; roleCode: string; roleName: string }
    | { kind: "status"; nextStatus: "active" | "disabled" }
    | null
  >(null);

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  // Load permissions once
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
        if (!cancelled) setPerms(permissionCodesFromMe(body));
      } catch {
        if (!cancelled) setPerms(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load roles once for filter and assign combobox
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/iam/roles");
        if (!r.ok) return;
        const data = (await r.json()) as Array<{ id: string; code: string; name: string }>;
        if (!cancelled) {
          setRoles(data.map((x) => ({ code: x.code, id: x.id, name: x.name })));
        }
      } catch {
        // best-effort
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
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/iam/admins?${params.toString()}`);
      if (!r.ok) {
        setList(null);
        setListError(t("errorLoad"));
        return;
      }
      const data = (await r.json()) as AdminListResponse;
      setList(data);
    } catch {
      setList(null);
      setListError(t("errorLoad"));
    } finally {
      setListLoading(false);
    }
    // labels are stable per render; we intentionally exclude `t` to avoid re-running every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, roleFilter, statusFilter, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await adminApiFetch(`/api/admin/iam/admins/${encodeURIComponent(id)}`);
        if (!r.ok) {
          setDetail(null);
          setDetailError(t("errorDetail"));
          return;
        }
        const data = (await r.json()) as AdminDetail;
        setDetail(data);
      } catch {
        setDetail(null);
        setDetailError(t("errorDetail"));
      } finally {
        setDetailLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const sortedItems = useMemo(() => {
    if (!list) return [];
    return list.items.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === "displayName") cmp = a.displayName.localeCompare(b.displayName);
      else if (sortKey === "email") cmp = a.email.localeCompare(b.email);
      else if (sortKey === "roleCount") cmp = a.roleCodes.length - b.roleCodes.length;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortAsc ? cmp : -cmp;
    });
  }, [list, sortKey, sortAsc]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((v) => !v);
      } else {
        setSortKey(key);
        setSortAsc(key === "displayName" || key === "email");
      }
    },
    [sortKey]
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const exportCsv = () => {
    if (!list) return;
    downloadCsv(
      `admin-actors-page-${list.page}.csv`,
      [
        t("colDisplayName"),
        t("colEmail"),
        t("colStatus"),
        t("colRoleCount"),
        t("colRoles"),
        t("colKeycloak"),
        t("colCreated"),
        t("colUpdated")
      ],
      list.items.map((row) => [
        row.displayName,
        row.email,
        row.status,
        String(row.roleCodes.length),
        row.roleCodes.join("|"),
        maskSubject(row.keycloakSubject),
        row.createdAt,
        row.updatedAt
      ])
    );
  };

  const refresh = () => {
    void loadList();
    if (selectedId) void loadDetail(selectedId);
  };

  // Mutations
  const requireReason = useCallback((): string | null => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setToast({ kind: "err", text: t("reasonHint") });
      return null;
    }
    return trimmed;
  }, [reason, t]);

  const doAssignRole = async () => {
    if (!detail || !canManage) return;
    if (!assignRole) return;
    const r = requireReason();
    if (!r) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/iam/admins/${encodeURIComponent(detail.id)}/roles`, {
        body: JSON.stringify({ reason: r, roleCode: assignRole }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setAssignRole("");
      setReason("");
      setToast({ kind: "ok", text: t("successAssign") });
      await loadDetail(detail.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  const doRevokeRole = async (roleCode: string) => {
    if (!detail || !canManage) return;
    const r = requireReason();
    if (!r) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(
        `/api/admin/iam/admins/${encodeURIComponent(detail.id)}/roles/${encodeURIComponent(roleCode)}`,
        {
          body: JSON.stringify({ reason: r }),
          headers: { "content-type": "application/json" },
          method: "DELETE"
        }
      );
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setReason("");
      setToast({ kind: "ok", text: t("successRevoke") });
      await loadDetail(detail.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
      setPendingConfirm(null);
    }
  };

  const doPatchStatus = async (nextStatus: "active" | "disabled") => {
    if (!detail || !canManage) return;
    const r = requireReason();
    if (!r) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/iam/admins/${encodeURIComponent(detail.id)}`, {
        body: JSON.stringify({ reason: r, status: nextStatus }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setReason("");
      setToast({ kind: "ok", text: t("successStatus") });
      await loadDetail(detail.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
      setPendingConfirm(null);
    }
  };

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isReadOnly = perms != null && !canManage;

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

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
          <label className="block min-w-[200px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterRole")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setRoleFilter(e.target.value)}
              value={roleFilter}
            >
              <option value="all">{t("filterRoleAll")}</option>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[160px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterStatus")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">{t("filterStatusAll")}</option>
              <option value="active">{t("filterStatusActive")}</option>
              <option value="disabled">{t("filterStatusDisabled")}</option>
            </select>
          </label>
          <div className="flex items-end gap-1">
            <span className="block text-xs font-medium text-slate-600 pb-2">{t("sortLabel")}:</span>
            {(["displayName", "email", "roleCount", "updatedAt"] as SortKey[]).map((k) => (
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
                {k === "displayName"
                  ? t("sortByName")
                  : k === "email"
                    ? t("sortByEmail")
                    : k === "roleCount"
                      ? t("sortByRoleCount")
                      : t("sortByUpdated")}
                {sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-end gap-2">
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={refresh}
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
        ) : sortedItems.length === 0 ? (
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
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colDisplayName")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colEmail")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colRoles")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colKeycloak")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {sortedItems.map((row) => {
                  const isSelected = row.id === selectedId;
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
                          className="text-left text-xs font-semibold text-indigo-700 hover:underline"
                          onClick={() => setSelectedId(row.id)}
                          type="button"
                        >
                          {row.displayName}
                        </button>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <span className="font-mono text-xs text-slate-700">{row.email}</span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone={statusTone(row.status)}>{row.status}</AdminStatusBadge>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <div className="flex flex-wrap gap-1">
                          {row.roleCodes.length === 0 ? (
                            <span className="text-xs text-slate-500">—</span>
                          ) : (
                            row.roleCodes.map((code) => (
                              <code
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800"
                                key={code}
                              >
                                {code}
                              </code>
                            ))
                          )}
                        </div>
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        <span
                          className="font-mono text-[11px] text-slate-600"
                          title={t("keycloakMasked")}
                        >
                          {maskSubject(row.keycloakSubject)}
                        </span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{formatDate(row.updatedAt, locale)}</AdminDataTableTd>
                    </AdminDataTableRow>
                  );
                })}
              </AdminDataTableBody>
            </AdminDataTable>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")} {list?.page ?? 1} / {totalPages} · {total} {common.records.toLowerCase()}
              </span>
              <div className="flex gap-1">
                <button
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold disabled:opacity-50"
                  disabled={page <= 1 || listLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  {t("prevPage")}
                </button>
                <button
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold disabled:opacity-50"
                  disabled={page >= totalPages || listLoading}
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

      {selectedId ? (
        <AdminSection
          description={detail?.email ?? undefined}
          title={`${t("detailHeading")} — ${detail?.displayName ?? selectedId.slice(0, 8)}`}
        >
          {detailLoading ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : detailError || !detail ? (
            <p className="text-sm text-rose-700">{detailError ?? common.error}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  <AdminStatusBadge tone={statusTone(detail.status)}>{detail.status}</AdminStatusBadge>
                  <span>
                    {t("colKeycloak")}:{" "}
                    <code
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]"
                      title={t("keycloakMasked")}
                    >
                      {maskSubject(detail.keycloakSubject)}
                    </code>
                  </span>
                  <span>
                    {t("colCreated")}: {formatDate(detail.createdAt, locale)}
                  </span>
                  <span>
                    {t("colUpdated")}: {formatDate(detail.updatedAt, locale)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {canManage ? (
                    <button
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm",
                        detail.status === "active"
                          ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                          : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                      )}
                      disabled={mutating}
                      onClick={() =>
                        setPendingConfirm({
                          kind: "status",
                          nextStatus: detail.status === "active" ? "disabled" : "active"
                        })
                      }
                      type="button"
                    >
                      {detail.status === "active" ? t("actionDisable") : t("actionEnable")}
                    </button>
                  ) : null}
                  <button
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => setSelectedId(null)}
                    type="button"
                  >
                    {t("close")}
                  </button>
                </div>
              </div>

              {/* Reason input — required for any mutation. Single source of truth so audit always carries reason. */}
              {canManage ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="block text-xs font-medium text-slate-700">
                    {t("reasonLabel")}
                    <textarea
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      maxLength={500}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t("reasonPlaceholder")}
                      rows={2}
                      value={reason}
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500">{t("reasonHint")}</p>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailRoles")}</h4>
                {detail.roles.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("detailNoRoles")}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {detail.roles.map((r) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                        key={r.id}
                      >
                        <div className="min-w-0">
                          <code className="font-mono text-[11px] font-semibold text-slate-800">
                            {r.code}
                          </code>
                          <span className="ml-2 text-slate-600">{r.name}</span>
                          <span className="ml-2 text-slate-400">· {r.permissionCount} perms</span>
                        </div>
                        {canManage ? (
                          <button
                            className="rounded border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            disabled={mutating}
                            onClick={() =>
                              setPendingConfirm({
                                kind: "revoke",
                                roleCode: r.code,
                                roleName: r.name
                              })
                            }
                            type="button"
                          >
                            {t("actionRevokeRole")}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="block text-xs">
                      <span className="block text-xs font-medium text-slate-600">
                        {t("actionAssignRole")}
                      </span>
                      <select
                        className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        onChange={(e) => setAssignRole(e.target.value)}
                        value={assignRole}
                      >
                        <option value="">{t("actionAssignRolePlaceholder")}</option>
                        {roles
                          .filter((r) => !detail.roles.some((dr) => dr.code === r.code))
                          .map((r) => (
                            <option key={r.code} value={r.code}>
                              {r.code} — {r.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                      disabled={mutating || !assignRole || reason.trim().length < 3}
                      onClick={doAssignRole}
                      type="button"
                    >
                      {t("actionAssignSubmit")}
                    </button>
                  </div>
                ) : null}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailAudit")}</h4>
                {detail.audit.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("detailAuditEmpty")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.audit.map((entry) => (
                      <li
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                        key={entry.id}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-[11px] text-slate-700">{entry.action}</code>
                          <span className="text-slate-500">
                            {formatWhen(entry.createdAt, locale)}
                          </span>
                        </div>
                        {entry.actor ? (
                          <div className="text-[11px] text-slate-600">{entry.actor.email}</div>
                        ) : null}
                        {entry.reason ? (
                          <div className="mt-0.5 text-[11px] text-slate-700">{entry.reason}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </AdminSection>
      ) : (
        <AdminSection title={t("detailHeading")}>
          <p className="text-sm text-slate-600">{t("detailSelectHint")}</p>
        </AdminSection>
      )}

      {pendingConfirm && detail ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {pendingConfirm.kind === "revoke" ? t("confirmRevokeTitle") : t("confirmStatusTitle")}
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              {pendingConfirm.kind === "revoke"
                ? t("confirmRevokeMessage")
                    .replace("{role}", pendingConfirm.roleName)
                    .replace("{name}", detail.displayName)
                : pendingConfirm.nextStatus === "active"
                  ? t("confirmStatusEnableMessage").replace("{name}", detail.displayName)
                  : t("confirmStatusDisableMessage").replace("{name}", detail.displayName)}
            </p>
            <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {t("reasonLabel")}: <em>{reason.trim() || "—"}</em>
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setPendingConfirm(null)}
                type="button"
              >
                {t("confirmCancel")}
              </button>
              <button
                className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                disabled={mutating || reason.trim().length < 3}
                onClick={() => {
                  if (pendingConfirm.kind === "revoke") {
                    void doRevokeRole(pendingConfirm.roleCode);
                  } else {
                    void doPatchStatus(pendingConfirm.nextStatus);
                  }
                }}
                type="button"
              >
                {t("confirmSubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
