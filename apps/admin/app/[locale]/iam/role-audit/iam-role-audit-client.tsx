"use client";

import {
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

type AuditEvent = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  actorId: string;
  actor: { id: string; displayName: string; email: string } | null;
};

type AuditResponse = {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
};

type AdminOption = { id: string; displayName: string; email: string };

const PAGE_SIZE = 50;

/** Common IAM/admin-actor audit actions used across the codebase. Free-form action filter still allowed. */
const ACTION_OPTIONS = [
  "admin.iam.role_assigned",
  "admin.iam.role_revoked",
  "admin.iam.actor_status_changed",
  "admin.role.created",
  "admin.role.updated",
  "admin.role.deleted",
  "admin.permission.linked",
  "admin.permission.unlinked"
];

function formatWhen(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      second: "2-digit",
      year: "numeric"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function actionTone(action: string): "danger" | "good" | "neutral" | "warning" {
  if (action.includes("revoked") || action.includes("deleted") || action.includes("disabled")) return "warning";
  if (action.includes("assigned") || action.includes("created") || action.includes("linked") || action.includes("active")) return "good";
  if (action.includes("error") || action.includes("denied")) return "danger";
  return "neutral";
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

/**
 * Convert a `datetime-local` input value (e.g. `2026-04-30T09:00`) to a UTC ISO string with seconds,
 * which matches the Zod `datetime()` validator on the backend. Empty input returns undefined.
 */
function localInputToIso(v: string): string | undefined {
  if (!v) return undefined;
  // datetime-local has no timezone — interpret as local, then ISO-stringify.
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function IamRoleAuditClient({
  common,
  labels,
  locale
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = (k: string) => labels[k] ?? k;

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [targetIdFilter, setTargetIdFilter] = useState<string>("");
  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");
  const [page, setPage] = useState(1);

  // Actor combobox source — admins list
  const [actors, setActors] = useState<AdminOption[]>([]);

  // Expanded metadata rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, actorFilter, targetIdFilter, fromInput, toInput]);

  // Load admin actors once for actor filter combobox (best effort).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/iam/admins?pageSize=100");
        if (!r.ok) return;
        const body = (await r.json()) as { items?: AdminOption[] };
        if (!cancelled) setActors(body.items ?? []);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (actorFilter !== "all") params.set("actorId", actorFilter);
    if (targetIdFilter.trim()) params.set("targetActorId", targetIdFilter.trim());
    const fromIso = localInputToIso(fromInput);
    const toIso = localInputToIso(toInput);
    if (fromIso) params.set("from", fromIso);
    if (toIso) params.set("to", toIso);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [debouncedSearch, actionFilter, actorFilter, targetIdFilter, fromInput, toInput, page]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApiFetch(`/api/admin/iam/role-audit?${buildQuery()}`);
      if (!r.ok) {
        setData(null);
        setError(t("errorLoad"));
        return;
      }
      const body = (await r.json()) as AuditResponse | AuditEvent[];
      // Backwards-compat: in case a deployment still returns an array.
      if (Array.isArray(body)) {
        setData({ items: body, page: 1, pageSize: body.length || PAGE_SIZE, total: body.length });
      } else {
        setData(body);
      }
    } catch {
      setData(null);
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setActionFilter("all");
    setActorFilter("all");
    setTargetIdFilter("");
    setFromInput("");
    setToInput("");
    setPage(1);
  };

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `iam-role-audit-page-${data.page}.csv`,
      [
        t("colWhen"),
        t("colActor"),
        t("colAction"),
        t("colTargetType"),
        t("colTargetId"),
        t("colReason")
      ],
      items.map((row) => [
        row.createdAt,
        row.actor?.displayName ?? row.actorId,
        row.action,
        row.targetType ?? "",
        row.targetId ?? "",
        row.reason ?? ""
      ])
    );
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isInitialLoading = data === null && loading;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (debouncedSearch) parts.push(`q="${debouncedSearch}"`);
    if (actionFilter !== "all") parts.push(`action=${actionFilter}`);
    if (actorFilter !== "all") {
      const a = actors.find((x) => x.id === actorFilter);
      parts.push(`actor=${a?.displayName ?? actorFilter.slice(0, 8)}`);
    }
    if (targetIdFilter.trim()) parts.push(`target=${targetIdFilter.slice(0, 8)}…`);
    if (fromInput) parts.push(`from=${fromInput}`);
    if (toInput) parts.push(`to=${toInput}`);
    return parts.join(" · ");
  }, [debouncedSearch, actionFilter, actorFilter, targetIdFilter, fromInput, toInput, actors]);

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        {t("readOnlyNotice")}
      </div>

      <AdminSection
        description={`${t("countLabel")}: ${total}${filterSummary ? ` · ${filterSummary}` : ""}`}
        title={t("title")}
      >
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("searchPlaceholder")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              type="search"
              value={search}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterAction")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setActionFilter(e.target.value)}
              value={actionFilter}
            >
              <option value="all">{t("filterActionAll")}</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterActor")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setActorFilter(e.target.value)}
              value={actorFilter}
            >
              <option value="all">{t("filterActorAll")}</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} ({a.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterTarget")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setTargetIdFilter(e.target.value)}
              placeholder={t("filterTargetPlaceholder")}
              type="search"
              value={targetIdFilter}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterFrom")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setFromInput(e.target.value)}
              type="datetime-local"
              value={fromInput}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterTo")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setToInput(e.target.value)}
              type="datetime-local"
              value={toInput}
            />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={resetFilters}
            type="button"
          >
            {t("emptyResetFilters")}
          </button>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => void loadData()}
              type="button"
            >
              {t("actionRefresh")}
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              disabled={items.length === 0}
              onClick={exportCsv}
              type="button"
            >
              {t("actionExportCsv")}
            </button>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="h-12 animate-pulse rounded-md bg-slate-100" key={i} />
            ))}
          </div>
        ) : error ? (
          <AdminEmptyState title={common.error}>{error}</AdminEmptyState>
        ) : items.length === 0 ? (
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
          <ol className="space-y-2">
            {items.map((event) => {
              const isOpen = expanded.has(event.id);
              return (
                <li
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                  key={event.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge tone={actionTone(event.action)}>
                          {event.action}
                        </AdminStatusBadge>
                        <span className="text-[11px] text-slate-500">
                          {formatWhen(event.createdAt, locale)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold">
                          {event.actor?.displayName ?? event.actorId.slice(0, 8)}
                        </span>{" "}
                        {event.actor ? (
                          <span className="text-slate-500">({event.actor.email})</span>
                        ) : null}
                        {event.targetType ? (
                          <>
                            {" "}
                            →{" "}
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800">
                              {event.targetType}
                            </code>
                          </>
                        ) : null}
                        {event.targetId ? (
                          <>
                            {" "}
                            <code
                              className="ml-1 font-mono text-[10px] text-slate-600"
                              title={event.targetId}
                            >
                              {event.targetId.slice(0, 8)}…
                            </code>
                          </>
                        ) : null}
                      </div>
                      {event.reason ? (
                        <p className="mt-1 text-xs italic text-slate-600">“{event.reason}”</p>
                      ) : null}
                    </div>
                    <button
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => toggleExpanded(event.id)}
                      type="button"
                    >
                      {isOpen ? t("actionCollapse") : t("actionExpand")}
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase text-slate-500">
                          {t("metadataBefore")}
                        </span>
                        <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[10px] leading-snug text-slate-700">
                          {event.before === null || event.before === undefined
                            ? "—"
                            : JSON.stringify(event.before, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase text-slate-500">
                          {t("metadataAfter")}
                        </span>
                        <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[10px] leading-snug text-slate-700">
                          {event.after === null || event.after === undefined
                            ? "—"
                            : JSON.stringify(event.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        <div
          className={cn(
            "mt-3 flex items-center justify-between text-xs text-slate-600",
            items.length === 0 ? "hidden" : undefined
          )}
        >
          <span>
            {t("pageLabel")} {data?.page ?? 1} / {totalPages} · {total} {t("recordsLabel")}
          </span>
          <div className="flex gap-1">
            <button
              className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              {t("prevPage")}
            </button>
            <button
              className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              {t("nextPage")}
            </button>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
