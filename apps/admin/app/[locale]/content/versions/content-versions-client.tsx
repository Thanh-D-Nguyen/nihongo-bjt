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
import { CONTENT_VERSION_STATUSES } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type VersionStatus = (typeof CONTENT_VERSION_STATUSES)[number];

type Summary = {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  changeSummary: string | null;
  authorUserId: string | null;
  status: VersionStatus | string;
  publishedAt: string | null;
  revertedFromVersionId: string | null;
  createdAt: string;
  title: string;
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type Detail = Summary & {
  snapshot: unknown;
  audit: AuditEntry[];
  author: { id: string; displayName: string; email: string } | null;
  currentPublishedVersionId: string | null;
};

type ListResponse = {
  items: Summary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
};

type LineDiffEntry = {
  op: "context" | "added" | "removed";
  fromLine: number | null;
  toLine: number | null;
  text: string;
};

type ObjectDiffEntry = {
  path: string;
  op: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

type DiffResponse = {
  from: Summary;
  to: Summary;
  diff: {
    json: ObjectDiffEntry[];
    text: { from: string; to: string; lines: LineDiffEntry[] };
  };
};

const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  draft: "warning",
  published: "good",
  superseded: "neutral"
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

type MePayload = {
  roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
};
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

export function ContentVersionsClient({
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
  const [statusFilter, setStatusFilter] = useState<VersionStatus | "all">("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [diffMode, setDiffMode] = useState<"unified" | "json">("unified");

  const [confirmRevert, setConfirmRevert] = useState(false);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, statusFilter, entityTypeFilter, entityIdFilter, authorFilter, fromDate, toDate]);

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
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (entityIdFilter) params.set("entityId", entityIdFilter);
      if (authorFilter) params.set("authorUserId", authorFilter);
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate).toISOString());
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/content/versions?${params.toString()}`);
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
  }, [debounced, statusFilter, entityTypeFilter, entityIdFilter, authorFilter, fromDate, toDate, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/content/versions/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  useEffect(() => {
    if (selectedId) {
      setDiff(null);
      void loadDetail(selectedId);
    } else {
      setDetail(null);
      setDiff(null);
    }
  }, [selectedId, loadDetail]);

  async function compareWithCurrent() {
    if (!detail) return;
    if (!detail.currentPublishedVersionId || detail.currentPublishedVersionId === detail.id) {
      setToast({ kind: "err", text: t("noCurrentToCompare") });
      return;
    }
    const params = new URLSearchParams({
      from: detail.id,
      to: detail.currentPublishedVersionId
    });
    const r = await adminApiFetch(`/api/admin/content/versions/diff?${params.toString()}`);
    if (!r.ok) {
      setToast({ kind: "err", text: common.error });
      return;
    }
    setDiff((await r.json()) as DiffResponse);
  }

  async function submitRevert() {
    if (!detail || !canWrite) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/content/versions/${detail.id}/revert`, {
        body: JSON.stringify({ reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        const errText = await r.text();
        setToast({ kind: "err", text: errText || t("revertFailed") });
        return;
      }
      const newVersion = (await r.json()) as Detail;
      setToast({ kind: "ok", text: t("revertOk") });
      setConfirmRevert(false);
      setReason("");
      void loadList();
      setSelectedId(newVersion.id);
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
      "version",
      "status",
      "title",
      "author",
      "publishedAt",
      "createdAt",
      "revertedFrom"
    ];
    const rows = list.items.map((it) => [
      it.id,
      it.entityType,
      it.entityId,
      String(it.versionNumber),
      String(it.status),
      it.title,
      it.authorUserId ?? "",
      it.publishedAt ?? "",
      it.createdAt,
      it.revertedFromVersionId ?? ""
    ]);
    downloadCsv(`content-versions-${Date.now()}.csv`, header, rows);
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CONTENT_VERSION_STATUSES.map((s) => (
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
            <span className="mb-1 font-medium text-slate-600">{t("filterEntityType")}</span>
            <input
              className="w-40 rounded border border-slate-300 px-3 py-2 text-sm"
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              placeholder="lexeme, kanji…"
              value={entityTypeFilter}
            />
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
            <span className="mb-1 font-medium text-slate-600">{t("filterAuthor")}</span>
            <input
              className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs"
              onChange={(e) => setAuthorFilter(e.target.value)}
              placeholder="uuid…"
              value={authorFilter}
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
          <button
            className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={exportCsv}
            type="button"
          >
            {t("exportCsv")}
          </button>
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
                  <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colEntityType")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colVersion")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAuthor")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colPublishedAt")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colCreatedAt")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {list.items.map((it) => (
                  <AdminDataTableRow
                    className="cursor-pointer hover:bg-slate-50"
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                  >
                    <AdminDataTableTd>
                      <div className="font-medium">{it.title}</div>
                      <div className="font-mono text-xs text-slate-500">{it.entityId}</div>
                      {it.changeSummary ? (
                        <div className="text-xs text-slate-500">{it.changeSummary}</div>
                      ) : null}
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{it.entityType}</code>
                    </AdminDataTableTd>
                    <AdminDataTableTd>v{it.versionNumber}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={STATUS_TONE[String(it.status)] ?? "neutral"}>
                        {t(`status_${it.status}`)}
                      </AdminStatusBadge>
                      {it.revertedFromVersionId ? (
                        <div className="mt-1 text-xs text-slate-500">{t("revertOf")}</div>
                      ) : null}
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-xs">{it.authorUserId ?? "—"}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{fmtWhen(it.publishedAt, locale)}</AdminDataTableTd>
                    <AdminDataTableTd>{fmtWhen(it.createdAt, locale)}</AdminDataTableTd>
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

      {/* Detail / Diff drawer */}
      {selectedId ? (
        <div className="fixed inset-y-0 right-0 z-30 w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
            <h3 className="text-sm font-semibold">{diff ? t("diffTitle") : t("detailTitle")}</h3>
            <div className="flex gap-2">
              {diff ? (
                <>
                  <button
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      diffMode === "unified"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300"
                    )}
                    onClick={() => setDiffMode("unified")}
                    type="button"
                  >
                    {t("diffUnified")}
                  </button>
                  <button
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      diffMode === "json"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300"
                    )}
                    onClick={() => setDiffMode("json")}
                    type="button"
                  >
                    {t("diffJson")}
                  </button>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() => setDiff(null)}
                    type="button"
                  >
                    {t("backToDetail")}
                  </button>
                </>
              ) : null}
              <button
                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                  setDiff(null);
                }}
                type="button"
              >
                {t("close")}
              </button>
            </div>
          </div>

          {!detail ? (
            <div className="p-6 text-sm text-slate-500">{common.loading}</div>
          ) : diff ? (
            <DiffView diff={diff} locale={locale} mode={diffMode} t={t} />
          ) : (
            <div className="space-y-5 p-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("colTitle")}>{detail.title}</Field>
                <Field label={t("colEntityType")}>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{detail.entityType}</code>
                </Field>
                <Field label={t("colEntityId")}>
                  <span className="font-mono text-xs">{detail.entityId}</span>
                </Field>
                <Field label={t("colVersion")}>v{detail.versionNumber}</Field>
                <Field label={t("colStatus")}>
                  <AdminStatusBadge tone={STATUS_TONE[String(detail.status)] ?? "neutral"}>
                    {t(`status_${detail.status}`)}
                  </AdminStatusBadge>
                </Field>
                <Field label={t("colAuthor")}>
                  {detail.author ? (
                    <div>
                      <div>{detail.author.displayName}</div>
                      <div className="text-xs text-slate-500">{detail.author.email}</div>
                    </div>
                  ) : (
                    <span className="font-mono text-xs">{detail.authorUserId ?? "—"}</span>
                  )}
                </Field>
                <Field label={t("colPublishedAt")}>{fmtWhen(detail.publishedAt, locale)}</Field>
                <Field label={t("colCreatedAt")}>{fmtWhen(detail.createdAt, locale)}</Field>
                {detail.revertedFromVersionId ? (
                  <Field label={t("revertedFromLabel")}>
                    <span className="font-mono text-xs">{detail.revertedFromVersionId}</span>
                  </Field>
                ) : null}
                {detail.changeSummary ? (
                  <Field label={t("changeSummaryLabel")}>{detail.changeSummary}</Field>
                ) : null}
              </div>

              <CodeBlock label={t("snapshotLabel")} value={detail.snapshot} />

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

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <button
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={
                    !detail.currentPublishedVersionId ||
                    detail.currentPublishedVersionId === detail.id
                  }
                  onClick={() => void compareWithCurrent()}
                  type="button"
                >
                  {t("compareCurrent")}
                </button>
                {canWrite ? (
                  <button
                    className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={detail.status === "published"}
                    onClick={() => setConfirmRevert(true)}
                    type="button"
                  >
                    {t("revert")}
                  </button>
                ) : null}
              </div>
              {detail.status === "published" ? (
                <div className="text-xs text-slate-500">{t("alreadyCurrentNotice")}</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {confirmRevert ? (
        <Modal
          confirmLabel={t("revertConfirm")}
          confirming={mutating}
          onCancel={() => {
            setConfirmRevert(false);
            setReason("");
          }}
          onConfirm={() => void submitRevert()}
          title={t("revertTitle")}
          tone="danger"
        >
          <p className="mb-2 text-sm text-slate-600">{t("revertDesc")}</p>
          <textarea
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            minLength={3}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            rows={3}
            value={reason}
          />
        </Modal>
      ) : null}

      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 rounded px-4 py-2 text-sm shadow-lg",
            toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DiffView({
  diff,
  mode,
  locale,
  t
}: {
  diff: DiffResponse;
  mode: "unified" | "json";
  locale: string;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-4 p-5 text-sm">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded border border-slate-200 p-2">
          <div className="font-semibold text-slate-500">{t("diffFromLabel")}</div>
          <div>v{diff.from.versionNumber} — {diff.from.title}</div>
          <div className="font-mono text-[10px] text-slate-500">{diff.from.id}</div>
          <div className="text-slate-500">{fmtWhen(diff.from.createdAt, locale)}</div>
        </div>
        <div className="rounded border border-slate-200 p-2">
          <div className="font-semibold text-slate-500">{t("diffToLabel")}</div>
          <div>v{diff.to.versionNumber} — {diff.to.title}</div>
          <div className="font-mono text-[10px] text-slate-500">{diff.to.id}</div>
          <div className="text-slate-500">{fmtWhen(diff.to.createdAt, locale)}</div>
        </div>
      </div>

      {mode === "unified" ? (
        <div className="overflow-auto rounded border border-slate-200 bg-slate-50 font-mono text-xs">
          {diff.diff.text.lines.length === 0 ? (
            <div className="p-3 text-slate-500">{t("noChanges")}</div>
          ) : (
            diff.diff.text.lines.map((l, i) => {
              const tone =
                l.op === "added"
                  ? "bg-emerald-50 text-emerald-900"
                  : l.op === "removed"
                  ? "bg-red-50 text-red-900"
                  : "";
              const sigil = l.op === "added" ? "+" : l.op === "removed" ? "-" : " ";
              return (
                <div className={cn("flex border-b border-slate-100 px-2 py-0.5", tone)} key={i}>
                  <span className="w-10 select-none text-right text-slate-400">
                    {l.fromLine ?? ""}
                  </span>
                  <span className="w-10 select-none text-right text-slate-400">
                    {l.toLine ?? ""}
                  </span>
                  <span className="ml-2 w-4 select-none">{sigil}</span>
                  <span className="ml-1 whitespace-pre-wrap break-all">{l.text}</span>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded border border-slate-200">
          {diff.diff.json.length === 0 ? (
            <div className="p-3 text-xs text-slate-500">{t("noChanges")}</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1 text-left">{t("diffPath")}</th>
                  <th className="px-2 py-1 text-left">{t("diffOp")}</th>
                  <th className="px-2 py-1 text-left">{t("diffBefore")}</th>
                  <th className="px-2 py-1 text-left">{t("diffAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {diff.diff.json.map((d, i) => (
                  <tr className="border-t border-slate-200" key={i}>
                    <td className="px-2 py-1 font-mono">{d.path}</td>
                    <td className="px-2 py-1">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5">{d.op}</code>
                    </td>
                    <td className="max-w-xs px-2 py-1 align-top">
                      <pre className="whitespace-pre-wrap break-all">
                        {d.before === undefined ? "" : JSON.stringify(d.before)}
                      </pre>
                    </td>
                    <td className="max-w-xs px-2 py-1 align-top">
                      <pre className="whitespace-pre-wrap break-all">
                        {d.after === undefined ? "" : JSON.stringify(d.after)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
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
      <pre className="max-h-72 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs">
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
