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

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  permissionCount: number;
  adminCount: number;
  createdAt: string;
};

type RoleDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  permissions: Array<{ code: string; description: string | null }>;
  admins: Array<{
    id: string;
    displayName: string;
    email: string;
    status: string;
    updatedAt: string;
  }>;
};

type RoleAudit = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  targetId: string | null;
  targetType: string | null;
  actor: { id: string; email: string; displayName: string } | null;
};

type SortKey = "code" | "permissionCount" | "adminCount";

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "active") return "good";
  if (status === "disabled" || status === "archived") return "warning";
  if (status === "deleted") return "danger";
  return "neutral";
}

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "vi-VN", {
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
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "vi-VN", {
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

/** Group permission codes by their dotted prefix, e.g. `admin.content.read` → `admin.content`. */
function groupPermissions(items: Array<{ code: string; description: string | null }>) {
  const groups = new Map<string, Array<{ code: string; description: string | null }>>();
  for (const p of items) {
    const idx = p.code.lastIndexOf(".");
    const prefix = idx === -1 ? "(misc)" : p.code.slice(0, idx);
    const arr = groups.get(prefix) ?? [];
    arr.push(p);
    groups.set(prefix, arr);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
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

export function IamRolesClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = (k: string) => labels[k] ?? k;

  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [audit, setAudit] = useState<RoleAudit[]>([]);

  // Initial list load
  useEffect(() => {
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const [rRoles, rAudit] = await Promise.all([
          adminApiFetch("/api/admin/iam/roles"),
          adminApiFetch("/api/admin/iam/role-audit?limit=100")
        ]);
        if (!rRoles.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data = (await rRoles.json()) as RoleRow[] | { items?: RoleRow[] };
        const list = Array.isArray(data) ? data : (data.items ?? []);
        // /iam/role-audit may return either legacy array or new paginated `{ items, total, ... }`.
        const auditData = rAudit.ok
          ? await (async () => {
              const body = (await rAudit.json()) as RoleAudit[] | { items?: RoleAudit[] };
              return Array.isArray(body) ? body : (body.items ?? []);
            })()
          : [];
        if (!cancelled) {
          setRows(list);
          setAudit(auditData);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch detail when selectedCode changes
  useEffect(() => {
    if (!selectedCode) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const r = await adminApiFetch(`/api/admin/iam/roles/${encodeURIComponent(selectedCode)}`);
        if (!r.ok) {
          if (!cancelled) {
            setDetail(null);
            setDetailLoading(false);
          }
          return;
        }
        const data = (await r.json()) as RoleDetail;
        if (!cancelled) {
          setDetail(data);
          setDetailLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
          setDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCode]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let out = rows.filter((row) => {
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        (row.description ?? "").toLowerCase().includes(q)
      );
    });
    out = out.slice().sort((a, b) => {
      let cmp: number;
      if (sortKey === "code") cmp = a.code.localeCompare(b.code);
      else if (sortKey === "permissionCount") cmp = a.permissionCount - b.permissionCount;
      else cmp = a.adminCount - b.adminCount;
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }, [rows, search, sortKey, sortAsc]);

  const relatedAudit = useMemo(() => {
    if (!detail) return [];
    return audit
      .filter((entry) => {
        if (!entry) return false;
        const tt = (entry.targetType ?? "").toLowerCase();
        const action = (entry.action ?? "").toLowerCase();
        if (tt.includes("role") || action.includes("role")) {
          // best-effort: surface if any field mentions code/id
          const blob = JSON.stringify(entry).toLowerCase();
          return blob.includes(detail.code.toLowerCase()) || blob.includes(detail.id.toLowerCase());
        }
        return false;
      })
      .slice(0, 30);
  }, [audit, detail]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc((v) => !v);
      } else {
        setSortKey(key);
        setSortAsc(true);
      }
    },
    [sortKey]
  );

  const exportCsv = () => {
    if (!detail) return;
    downloadCsv(
      `role-${detail.code}-permissions.csv`,
      [t("colCode") ?? "code", "description"],
      detail.permissions.map((p) => [p.code, p.description ?? ""])
    );
  };

  const isLoading = rows === null;
  const groupedPermissions = detail ? groupPermissions(detail.permissions) : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        {t("readOnlyNotice")}
      </div>

      <AdminSection
        description={`${t("countLabel")}: ${rows?.length ?? 0}`}
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
          <div className="flex items-end gap-1">
            <span className="block text-xs font-medium text-slate-600 pb-2">{t("sortLabel")}:</span>
            {(["code", "permissionCount", "adminCount"] as SortKey[]).map((k) => (
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
                  : k === "permissionCount"
                    ? t("sortByPermissions")
                    : t("sortByAdmins")}
                {sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-600">{common.loading}</p>
        ) : error ? (
          <AdminEmptyState title={common.error}>{common.error}</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("empty")}</AdminEmptyState>
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colCode")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colPermissions")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colAdmins")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
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
                        className="font-mono text-xs font-semibold text-indigo-700 hover:underline"
                        onClick={() => setSelectedCode(row.code)}
                        type="button"
                      >
                        {row.code}
                      </button>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.name}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>{row.status}</AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.permissionCount}</AdminDataTableTd>
                    <AdminDataTableTd>{row.adminCount}</AdminDataTableTd>
                    <AdminDataTableTd>{formatDate(row.createdAt, locale)}</AdminDataTableTd>
                  </AdminDataTableRow>
                );
              })}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {selectedCode ? (
        <AdminSection
          title={`${t("detailHeading")} — ${selectedCode}`}
          description={detail?.description ?? undefined}
        >
          {detailLoading ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : !detail ? (
            <p className="text-sm text-slate-600">{common.error}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  <AdminStatusBadge tone={statusTone(detail.status)}>{detail.status}</AdminStatusBadge>
                  <span>
                    {t("colPermissions")}: <strong>{detail.permissions.length}</strong>
                  </span>
                  <span>
                    {t("colAdmins")}: <strong>{detail.admins.length}</strong>
                  </span>
                  <span>
                    {t("colCreated")}: {formatDate(detail.createdAt, locale)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={exportCsv}
                    type="button"
                  >
                    {t("exportCsv")}
                  </button>
                  <button
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => setSelectedCode(null)}
                    type="button"
                  >
                    {t("close")}
                  </button>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailPermissions")}</h4>
                {detail.permissions.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("permissionsEmpty")}</p>
                ) : (
                  <div className="space-y-3">
                    {groupedPermissions.map(([prefix, perms]) => (
                      <div key={prefix}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("groupPrefix")}: {prefix} · {perms.length}
                        </div>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {perms.map((p) => (
                            <li key={p.code}>
                              <code
                                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-800"
                                title={p.description ?? undefined}
                              >
                                {p.code}
                              </code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailAdmins")}</h4>
                {detail.admins.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("adminEmpty")}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {detail.admins.map((a) => (
                      <li className="flex items-center justify-between gap-3 px-3 py-2 text-xs" key={a.id}>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">{a.displayName}</div>
                          <div className="truncate text-slate-500">{a.email}</div>
                        </div>
                        <AdminStatusBadge tone={statusTone(a.status)}>{a.status}</AdminStatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailAudit")}</h4>
                {relatedAudit.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("auditEmpty")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {relatedAudit.map((entry) => (
                      <li className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs" key={entry.id}>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-[11px] text-slate-700">{entry.action}</code>
                          <span className="text-slate-500">{formatWhen(entry.createdAt, locale)}</span>
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
    </div>
  );
}
