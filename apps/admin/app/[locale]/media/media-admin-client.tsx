"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection,
  AdminSelect,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Asset = {
  id: string;
  objectKey: string;
  mimeType: string;
  byteSize: number | null;
  provider: string;
  rightsStatus: string;
  status: string;
  license: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { items: Asset[]; total: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  actor?: { id: string; displayName: string; email: string } | null;
};

type Detail = Asset & {
  sourceUrl: string | null;
  provenance: Record<string, unknown> | null;
  accessibility: Record<string, unknown> | null;
  checksumSha256: string | null;
  cardLinkCount: number;
  audit: AuditEntry[];
};

const PAGE_SIZE = 25;
const RIGHTS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  cleared: "good",
  pending_review: "warning",
  blocked: "danger"
};
const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  active: "good",
  deleted: "danger"
};

function fmtBytes(n: number | null): string {
  if (n == null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
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
function jsonStringify(v: unknown): string {
  if (v == null) return "";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
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

export function MediaAdminClient({
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
  const canWrite = perms != null && (perms.has("admin.content.write") || perms.has("iam.manage"));
  const isViewerOnly = perms != null && !canWrite;

  const [list, setList] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mimeFilter, setMimeFilter] = useState<"all" | "image" | "audio" | "video">("all");
  const [rightsFilter, setRightsFilter] = useState<"all" | "pending_review" | "cleared" | "blocked">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deleted">("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editLicense, setEditLicense] = useState("");
  const [editRights, setEditRights] = useState<"" | "pending_review" | "cleared" | "blocked">("");
  const [editSourceUrl, setEditSourceUrl] = useState("");
  const [editProvenance, setEditProvenance] = useState("");
  const [editAccessibility, setEditAccessibility] = useState("");
  const [editReason, setEditReason] = useState("");
  const [mutating, setMutating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch, mimeFilter, rightsFilter, statusFilter]);

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
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (mimeFilter !== "all") params.set("mimeType", mimeFilter);
      if (rightsFilter !== "all") params.set("rightsStatus", rightsFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await adminApiFetch(`/api/admin/media?${params.toString()}`);
      if (!r.ok) {
        setList(null);
        setError(t("errorLoad"));
        return;
      }
      setList((await r.json()) as ListResponse);
    } catch {
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, mimeFilter, rightsFilter, statusFilter, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetail(null);
      setDetailError(null);
      const r = await adminApiFetch(`/api/admin/media/${id}`);
      if (!r.ok) {
        setDetailError(t("errorDetail"));
        return;
      }
      const d = (await r.json()) as Detail;
      setDetail(d);
      setEditLicense(d.license ?? "");
      setEditRights("");
      setEditSourceUrl(d.sourceUrl ?? "");
      setEditProvenance(jsonStringify(d.provenance));
      setEditAccessibility(jsonStringify(d.accessibility));
      setEditReason("");
      setDeleteReason("");
    },
    [t]
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = list?.items ?? [];

  const kpis = useMemo(() => {
    const items = pageRows;
    const active = items.filter((i) => i.status === "active").length;
    const pending = items.filter((i) => i.rightsStatus === "pending_review").length;
    const blocked = items.filter((i) => i.rightsStatus === "blocked").length;
    return { active, pending, blocked };
  }, [pageRows]);

  function exportCsv() {
    const items = pageRows;
    const header = [
      "id",
      "objectKey",
      "mimeType",
      "byteSize",
      "rightsStatus",
      "status",
      "license",
      "provider",
      "createdAt",
      "updatedAt"
    ];
    const rows = items.map((a) => [
      a.id,
      a.objectKey,
      a.mimeType,
      a.byteSize == null ? "" : String(a.byteSize),
      a.rightsStatus,
      a.status,
      a.license ?? "",
      a.provider,
      a.createdAt,
      a.updatedAt
    ]);
    downloadCsv(`media-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  }

  async function submitMetadata() {
    if (!detail || !canWrite) return;
    if (editReason.trim().length < 3) {
      setToast({ kind: "err", text: t("metadataReason") });
      return;
    }
    let provenance: Record<string, unknown> | null | undefined;
    let accessibility: Record<string, unknown> | null | undefined;
    try {
      provenance = editProvenance.trim() === "" ? null : (JSON.parse(editProvenance) as Record<string, unknown>);
    } catch {
      setToast({ kind: "err", text: `${t("drawerProvenance")}: ${t("metadataInvalidJson")}` });
      return;
    }
    try {
      accessibility =
        editAccessibility.trim() === "" ? null : (JSON.parse(editAccessibility) as Record<string, unknown>);
    } catch {
      setToast({ kind: "err", text: `${t("drawerAccessibility")}: ${t("metadataInvalidJson")}` });
      return;
    }
    const body: Record<string, unknown> = { reason: editReason.trim() };
    if (editLicense.trim().length > 0) body.license = editLicense.trim();
    if (editRights !== "") body.rightsStatus = editRights;
    body.sourceUrl = editSourceUrl.trim() === "" ? null : editSourceUrl.trim();
    body.provenance = provenance;
    body.accessibility = accessibility;
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/media/${detail.id}/metadata`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        const txt = await r.text();
        setToast({ kind: "err", text: txt || t("errorSave") });
        return;
      }
      setToast({ kind: "ok", text: t("successSave") });
      setEditOpen(false);
      await loadDetail(detail.id);
      void loadList();
    } catch {
      setToast({ kind: "err", text: t("errorSave") });
    } finally {
      setMutating(false);
    }
  }

  async function submitDelete() {
    if (!detail || !canWrite) return;
    if (deleteReason.trim().length < 3) {
      setToast({ kind: "err", text: t("deleteReason") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/media/${detail.id}`, {
        body: JSON.stringify({ reason: deleteReason.trim() }),
        headers: { "content-type": "application/json" },
        method: "DELETE"
      });
      if (!r.ok) {
        const txt = await r.text();
        setToast({ kind: "err", text: txt || t("errorDelete") });
        return;
      }
      setToast({ kind: "ok", text: t("successDelete") });
      setDeleteOpen(false);
      await loadDetail(detail.id);
      void loadList();
    } catch {
      setToast({ kind: "err", text: t("errorDelete") });
    } finally {
      setMutating(false);
    }
  }

  function thumb(_a: Asset): string | null {
    // Thumbnail preview requires a signed admin GET URL endpoint (partial_schema_pending).
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        actions={
          <button
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => exportCsv()}
            type="button"
          >
            {t("exportCsv")}
          </button>
        }
        description={t("subtitle")}
        title={t("title")}
      />

      {isViewerOnly ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t("viewerBanner")}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpiCard label={t("kpiTotal")} value={total} />
        <AdminKpiCard label={t("kpiActive")} tone="good" value={kpis.active} />
        <AdminKpiCard label={t("kpiPendingReview")} tone="warning" value={kpis.pending} />
        <AdminKpiCard label={t("kpiBlocked")} tone="danger" value={kpis.blocked} />
      </div>

      <AdminFilterBar>
        <input
          className="min-h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm md:w-72"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("filterSearch")}
          type="search"
          value={search}
        />
        <label className="flex flex-col text-xs text-slate-600">
          {t("filterMime")}
          <AdminSelect onChange={(e) => setMimeFilter(e.target.value as "all" | "image" | "audio" | "video")} value={mimeFilter}>
            <option value="all">{t("filterMimeAll")}</option>
            <option value="image">{t("filterMimeImage")}</option>
            <option value="audio">{t("filterMimeAudio")}</option>
            <option value="video">{t("filterMimeVideo")}</option>
          </AdminSelect>
        </label>
        <label className="flex flex-col text-xs text-slate-600">
          {t("filterRights")}
          <AdminSelect
            onChange={(e) => setRightsFilter(e.target.value as "all" | "pending_review" | "cleared" | "blocked")}
            value={rightsFilter}
          >
            <option value="all">{t("filterRightsAll")}</option>
            <option value="pending_review">{t("filterRightsPending")}</option>
            <option value="cleared">{t("filterRightsCleared")}</option>
            <option value="blocked">{t("filterRightsBlocked")}</option>
          </AdminSelect>
        </label>
        <label className="flex flex-col text-xs text-slate-600">
          {t("filterStatus")}
          <AdminSelect onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "deleted")} value={statusFilter}>
            <option value="all">{t("filterStatusAll")}</option>
            <option value="active">{t("filterStatusActive")}</option>
            <option value="deleted">{t("filterStatusDeleted")}</option>
          </AdminSelect>
        </label>
        <button
          className="ml-auto inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            setSearch("");
            setMimeFilter("all");
            setRightsFilter("all");
            setStatusFilter("all");
          }}
          type="button"
        >
          {t("filterClear")}
        </button>
      </AdminFilterBar>

      <AdminSection
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              {t("previousPage")}
            </button>
            <span>
              {t("pageOf").replace("{page}", String(page)).replace("{total}", String(totalPages))}
            </span>
            <button
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              {t("nextPage")}
            </button>
          </div>
        }
        title={`${t("tableTitle")} (${total})`}
      >
        {error ? (
          <AdminEmptyState title={common.error}>{error}</AdminEmptyState>
        ) : loading && pageRows.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{common.loading}</div>
        ) : pageRows.length === 0 ? (
          <AdminEmptyState title={t("empty")} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colKey")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colMime")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colSize")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colRights")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colLicense")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreatedAt")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {pageRows.map((a) => (
                <AdminDataTableRow
                  className="cursor-pointer hover:bg-slate-50"
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                >
                  <AdminDataTableTd>
                    <div className="flex items-center gap-2">
                      {thumb(a) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="h-8 w-8 shrink-0 rounded border border-slate-200 object-cover"
                          loading="lazy"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                          src={thumb(a)!}
                        />
                      ) : (
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
                          {a.mimeType.split("/")[0]?.slice(0, 4) ?? "file"}
                        </span>
                      )}
                      <span className="break-all font-mono text-xs">{a.objectKey}</span>
                    </div>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{a.mimeType}</AdminDataTableTd>
                  <AdminDataTableTd>{fmtBytes(a.byteSize)}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={RIGHTS_TONE[a.rightsStatus] ?? "neutral"}>{a.rightsStatus}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-slate-600">{a.license ?? "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-slate-500">{fmtDate(a.createdAt, locale)}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {selectedId ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-stretch justify-end bg-slate-900/40"
          onClick={(e) => {
            if (e.currentTarget === e.target) setSelectedId(null);
          }}
          role="dialog"
        >
          <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-950">{t("drawerTitle")}</h2>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedId(null)}
                type="button"
              >
                ✕
              </button>
            </div>
            {detailError ? (
              <div className="p-4">
                <AdminEmptyState title={common.error}>{detailError}</AdminEmptyState>
              </div>
            ) : !detail ? (
              <div className="p-8 text-center text-sm text-slate-500">{common.loading}</div>
            ) : (
              <div className="space-y-4 p-4">
                <p className="text-xs text-slate-500">{t("previewUnsupported")}</p>

                <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerObjectKey")}</dt>
                    <dd className="break-all font-mono text-xs">{detail.objectKey}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerMime")}</dt>
                    <dd>{detail.mimeType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerSize")}</dt>
                    <dd>{fmtBytes(detail.byteSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerProvider")}</dt>
                    <dd>{detail.provider}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerOwner")}</dt>
                    <dd className="font-mono text-xs">{detail.ownerUserId ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerCreated")}</dt>
                    <dd>{fmtDate(detail.createdAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerUpdated")}</dt>
                    <dd>{fmtDate(detail.updatedAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerRights")}</dt>
                    <dd>
                      <AdminStatusBadge tone={RIGHTS_TONE[detail.rightsStatus] ?? "neutral"}>{detail.rightsStatus}</AdminStatusBadge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerLicense")}</dt>
                    <dd>{detail.license ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerSourceUrl")}</dt>
                    <dd className="break-all">
                      {detail.sourceUrl ? (
                        <a className="text-emerald-700 underline" href={detail.sourceUrl} rel="noreferrer noopener" target="_blank">
                          {detail.sourceUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-slate-500">{t("drawerCardLinkCount")}</dt>
                    <dd>{detail.cardLinkCount}</dd>
                  </div>
                </dl>

                {detail.provenance ? (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">{t("drawerProvenance")}</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-slate-900 p-2 text-xs text-slate-100">
                      {jsonStringify(detail.provenance)}
                    </pre>
                  </details>
                ) : null}
                {detail.accessibility ? (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">{t("drawerAccessibility")}</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-slate-900 p-2 text-xs text-slate-100">
                      {jsonStringify(detail.accessibility)}
                    </pre>
                  </details>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  {canWrite ? (
                    <>
                      <button
                        className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                        onClick={() => setEditOpen(true)}
                        type="button"
                      >
                        {t("editMetadata")}
                      </button>
                      {detail.status !== "deleted" ? (
                        <button
                          className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                          onClick={() => setDeleteOpen(true)}
                          type="button"
                        >
                          {t("softDelete")}
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
                          {t("softDeleted")}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>

                <AdminSection title={t("drawerAuditTitle")}>
                  {detail.audit.length === 0 ? (
                    <p className="text-sm text-slate-500">{t("drawerAuditEmpty")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.audit.slice(0, 25).map((a) => (
                        <li className="rounded-md border border-slate-200 bg-white p-2 text-xs" key={a.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono">{a.action}</span>
                            <span className="text-slate-500">{fmtDate(a.createdAt, locale)}</span>
                          </div>
                          <div className="text-slate-600">
                            {a.actor?.displayName ?? a.actor?.email ?? "—"}
                            {a.reason ? <> · {a.reason}</> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </AdminSection>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Edit metadata modal */}
      {editOpen && detail ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 p-4">
              <h3 className="text-base font-semibold text-slate-950">{t("metadataModalTitle")}</h3>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("metadataLicense")}</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5"
                  onChange={(e) => setEditLicense(e.target.value)}
                  placeholder={t("metadataLicensePlaceholder")}
                  type="text"
                  value={editLicense}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("metadataRightsStatus")}</span>
                <AdminSelect
                  className="mt-1 w-full"
                  onChange={(e) => setEditRights(e.target.value as "" | "pending_review" | "cleared" | "blocked")}
                  value={editRights}
                >
                  <option value="">—</option>
                  <option value="pending_review">pending_review</option>
                  <option value="cleared">cleared</option>
                  <option value="blocked">blocked</option>
                </AdminSelect>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("metadataSourceUrl")}</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  onChange={(e) => setEditSourceUrl(e.target.value)}
                  type="url"
                  value={editSourceUrl}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("metadataProvenance")}</span>
                <textarea
                  className="mt-1 h-24 w-full rounded-md border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  onChange={(e) => setEditProvenance(e.target.value)}
                  placeholder='{"source":"unsplash","attribution":"@user"}'
                  value={editProvenance}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("metadataAccessibility")}</span>
                <textarea
                  className="mt-1 h-20 w-full rounded-md border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  onChange={(e) => setEditAccessibility(e.target.value)}
                  placeholder='{"alt":"Mt. Fuji at sunrise"}'
                  value={editAccessibility}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("metadataReason")}</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5"
                  minLength={3}
                  onChange={(e) => setEditReason(e.target.value)}
                  type="text"
                  value={editReason}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setEditOpen(false)}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={mutating || editReason.trim().length < 3}
                onClick={() => void submitMetadata()}
                type="button"
              >
                {mutating ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete confirm modal */}
      {deleteOpen && detail ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 p-4">
              <h3 className="text-base font-semibold text-slate-950">{t("deleteModalTitle")}</h3>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p className="text-slate-600">{t("deleteModalBody")}</p>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">{t("deleteReason")}</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5"
                  minLength={3}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  type="text"
                  value={deleteReason}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setDeleteOpen(false)}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={mutating || deleteReason.trim().length < 3}
                onClick={() => void submitDelete()}
                type="button"
              >
                {mutating ? t("saving") : t("deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${
            toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
          onAnimationEnd={() => setToast(null)}
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
