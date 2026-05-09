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
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import {
  LexemeExamplesSubrow,
  type LexemeExampleLabels,
  type LexemeExampleRow
} from "../../_components/lexeme-examples-subrow";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Variant = {
  id: string;
  sourceType: string;
  sourceId: string;
  frontText: string;
  backText: string;
  reading: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { items: Variant[]; total: number; page: number; pageSize: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type CanonicalSource = {
  label: string;
  resolvedBy?: string;
  sourceId: string;
  sourceType: "grammar" | "kanji" | "lexeme";
};

type ExampleRow = {
  id: string;
  japaneseText: string;
  reading: string | null;
  status?: string;
  translationVi: string | null;
};

type Detail = Variant & {
  audit: AuditEntry[];
  canonical: CanonicalSource | null;
  canonicalCandidates: CanonicalSource[];
  examples: ExampleRow[];
  lexemeExamples: LexemeExampleRow[];
};

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

function statusTone(status: string): "neutral" | "warning" | "danger" {
  if (status === "active") return "neutral";
  if (status === "draft") return "warning";
  return "danger";
}

export function FlashcardVariantsAdminClient({
  common,
  labels,
  lexemeExampleLabels
}: {
  common: CommonLabels;
  labels: Labels;
  lexemeExampleLabels: LexemeExampleLabels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("admin.content.write");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived" | "draft">("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Variant | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editForm, setEditForm] = useState<{ frontText: string; backText: string; reading: string } | null>(
    null
  );
  const [sourceForm, setSourceForm] = useState<{
    sourceId: string;
    sourceType: "grammar" | "kanji" | "lexeme";
  } | null>(null);
  const [transitioning, setTransitioning] = useState<"active" | "archived" | "draft" | null>(null);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, statusFilter, sourceTypeFilter]);

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
      if (sourceTypeFilter) params.set("sourceType", sourceTypeFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/flashcards/variants?${params.toString()}`);
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
  }, [debounced, statusFilter, sourceTypeFilter, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/flashcards/variants/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(v: Variant) {
    setSelected(v);
    setDetail(null);
    setEditForm(null);
    setSourceForm(null);
    setTransitioning(null);
    setReason("");
    void loadDetail(v.id);
  }
  function closeDrawer() {
    setSelected(null);
    setDetail(null);
    setEditForm(null);
    setSourceForm(null);
    setTransitioning(null);
  }

  function startEdit() {
    if (!canWrite || !detail) return;
    setEditForm({
      backText: detail.backText,
      frontText: detail.frontText,
      reading: detail.reading ?? ""
    });
    setTransitioning(null);
    setReason("");
  }

  async function submitEdit() {
    if (!detail || !editForm) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/flashcards/variants/${detail.id}`, {
        body: JSON.stringify({
          backText: editForm.backText,
          frontText: editForm.frontText,
          reading: editForm.reading || null,
          reason: reason.trim()
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: t("updateFailed") });
        return;
      }
      setDetail((await r.json()) as Detail);
      setEditForm(null);
      setReason("");
      setToast({ kind: "ok", text: t("updateOk") });
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  async function submitTransition(next: "active" | "archived" | "draft") {
    if (!detail) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/flashcards/variants/${detail.id}/transition`, {
        body: JSON.stringify({ next, reason: reason.trim() }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: t("transitionFailed") });
        return;
      }
      setDetail((await r.json()) as Detail);
      setTransitioning(null);
      setReason("");
      setToast({ kind: "ok", text: t("transitionOk") });
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function startSourceRemap(candidate?: CanonicalSource) {
    if (!canWrite || !detail) return;
    setSourceForm({
      sourceId: candidate?.sourceId ?? detail.canonical?.sourceId ?? detail.sourceId,
      sourceType: candidate?.sourceType ?? detail.canonical?.sourceType ?? "lexeme"
    });
    setEditForm(null);
    setTransitioning(null);
    setReason("");
  }

  async function submitSourceRemap() {
    if (!detail || !sourceForm) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/flashcards/variants/${detail.id}/source`, {
        body: JSON.stringify({
          reason: reason.trim(),
          sourceId: sourceForm.sourceId.trim(),
          sourceType: sourceForm.sourceType
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: t("sourceRemapFailed") });
        return;
      }
      setDetail((await r.json()) as Detail);
      setSourceForm(null);
      setReason("");
      setToast({ kind: "ok", text: t("sourceRemapOk") });
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "sourceType", "sourceId", "frontText", "backText", "reading", "status", "updatedAt"];
    const rows = list.items.map((it) => [
      it.id,
      it.sourceType,
      it.sourceId,
      it.frontText,
      it.backText,
      it.reading ?? "",
      it.status,
      it.updatedAt
    ]);
    downloadCsv(`flashcard-variants-${Date.now()}.csv`, header, rows);
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

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label={t("filterSearch")}
            className="min-w-[260px] flex-1 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "archived" | "draft")
            }
            value={statusFilter}
          >
            <option value="all">{t("filterStatusAll")}</option>
            <option value="active">{t("status_active")}</option>
            <option value="draft">{t("status_draft")}</option>
            <option value="archived">{t("status_archived")}</option>
          </select>
          <input
            aria-label={t("filterSourceType")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            placeholder={t("filterSourceType")}
            value={sourceTypeFilter}
          />
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
                <AdminDataTableTh>{t("colFront")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colBack")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colReading")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colSource")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((it) => (
                <AdminDataTableRow
                  key={it.id}
                  className="cursor-pointer hover:bg-indigo-50/40"
                  onClick={() => openDrawer(it)}
                >
                  <AdminDataTableTd>
                    <span className="text-sm">{it.frontText}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-sm text-gray-700">{it.backText}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{it.reading ?? "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{it.sourceType}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(it.status)}>
                      {t(`status_${it.status}`) || it.status}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">
                      {new Date(it.updatedAt).toLocaleString()}
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
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {selected.sourceType}
                </div>
                <div className="text-lg font-semibold">{selected.frontText}</div>
                <div className="text-sm text-gray-700">{selected.backText}</div>
                {selected.reading ? (
                  <div className="text-xs text-gray-500">{selected.reading}</div>
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
                {canWrite ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded border px-3 py-1 text-sm"
                      onClick={startEdit}
                      type="button"
                    >
                      {t("edit")}
                    </button>
                    {detail.status !== "active" ? (
                      <button
                        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                        onClick={() => {
                          setTransitioning("active");
                          setEditForm(null);
                          setReason("");
                        }}
                        type="button"
                      >
                        {t("publish")}
                      </button>
                    ) : null}
                    {detail.status !== "archived" ? (
                      <button
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                        onClick={() => {
                          setTransitioning("archived");
                          setEditForm(null);
                          setReason("");
                        }}
                        type="button"
                      >
                        {t("archive")}
                      </button>
                    ) : null}
                    {detail.status !== "draft" ? (
                      <button
                        className="rounded border px-3 py-1 text-sm"
                        onClick={() => {
                          setTransitioning("draft");
                          setEditForm(null);
                          setReason("");
                        }}
                        type="button"
                      >
                        {t("draft")}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {editForm ? (
                  <div className="mt-4 space-y-2 rounded border p-3">
                    <div>
                      <label className="block text-xs font-medium uppercase text-gray-500">
                        {t("colFront")}
                      </label>
                      <input
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, frontText: e.target.value } : prev))
                        }
                        value={editForm.frontText}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase text-gray-500">
                        {t("colBack")}
                      </label>
                      <textarea
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, backText: e.target.value } : prev))
                        }
                        rows={3}
                        value={editForm.backText}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase text-gray-500">
                        {t("colReading")}
                      </label>
                      <input
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, reading: e.target.value } : prev))
                        }
                        value={editForm.reading}
                      />
                    </div>
                    <input
                      className="w-full rounded border px-2 py-1 text-sm"
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t("reasonPlaceholder")}
                      value={reason}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded border px-3 py-1 text-sm"
                        onClick={() => setEditForm(null)}
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
                ) : null}

                {transitioning ? (
                  <div className="mt-4 space-y-2 rounded border p-3">
                    <div className="text-sm font-semibold">
                      {t(`confirm_${transitioning}`)}
                    </div>
                    <input
                      className="w-full rounded border px-2 py-1 text-sm"
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t("reasonPlaceholder")}
                      value={reason}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded border px-3 py-1 text-sm"
                        onClick={() => setTransitioning(null)}
                        type="button"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                        disabled={mutating}
                        onClick={() => void submitTransition(transitioning)}
                        type="button"
                      >
                        {t("confirm")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("sourcePanelTitle")}</h3>
                      {detail.canonical == null ? (
                        <p className="mt-1 text-xs text-amber-800">{t("storedSourceNeedsRemap")}</p>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <button
                        className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
                        onClick={() => startSourceRemap()}
                        type="button"
                      >
                        {t("sourceManualTitle")}
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded border border-slate-200 bg-white p-2">
                      <div className="font-medium text-slate-600">{t("sourceStored")}</div>
                      <div className="mt-1 font-mono text-slate-900">
                        {detail.sourceType} / {detail.sourceId}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-2">
                      <div className="font-medium text-slate-600">{t("sourceResolved")}</div>
                      {detail.canonical ? (
                        <div className="mt-1 space-y-0.5">
                          <div className="font-medium text-slate-900">{detail.canonical.label}</div>
                          <div className="font-mono text-slate-600">
                            {detail.canonical.sourceType} / {detail.canonical.sourceId}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-slate-500">{t("sourceNoCandidates")}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("sourceCandidates")}
                    </div>
                    {detail.canonicalCandidates.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">{t("sourceNoCandidates")}</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detail.canonicalCandidates.map((candidate) => (
                          <button
                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-800 shadow-sm hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60"
                            disabled={!canWrite}
                            key={`${candidate.sourceType}:${candidate.sourceId}`}
                            onClick={() => startSourceRemap(candidate)}
                            type="button"
                          >
                            <span className="block font-medium">{candidate.label}</span>
                            <span className="font-mono text-[11px] text-slate-500">{candidate.sourceType}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {sourceForm ? (
                    <div className="space-y-2 rounded border border-indigo-200 bg-white p-3">
                      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">{t("sourceType")}</span>
                          <select
                            className="mt-1 w-full rounded border px-2 py-1 text-sm"
                            onChange={(e) =>
                              setSourceForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      sourceType: e.target.value as "grammar" | "kanji" | "lexeme"
                                    }
                                  : prev
                              )
                            }
                            value={sourceForm.sourceType}
                          >
                            <option value="lexeme">{t("sourceTypeLexeme")}</option>
                            <option value="grammar">{t("sourceTypeGrammar")}</option>
                            <option value="kanji">{t("sourceTypeKanji")}</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">{t("sourceId")}</span>
                          <input
                            className="mt-1 w-full rounded border px-2 py-1 text-sm"
                            onChange={(e) =>
                              setSourceForm((prev) => (prev ? { ...prev, sourceId: e.target.value } : prev))
                            }
                            placeholder={t("sourceIdPlaceholder")}
                            value={sourceForm.sourceId}
                          />
                        </label>
                      </div>
                      <input
                        className="w-full rounded border px-2 py-1 text-sm"
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t("reasonPlaceholder")}
                        value={reason}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded border px-3 py-1 text-sm"
                          onClick={() => setSourceForm(null)}
                          type="button"
                        >
                          {t("cancel")}
                        </button>
                        <button
                          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                          disabled={mutating}
                          onClick={() => void submitSourceRemap()}
                          type="button"
                        >
                          {t("sourceRemap")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("examplesTitle")}
                    </div>
                    {detail.examples.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">{t("examplesEmpty")}</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {detail.examples.map((example) => (
                          <li
                            className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                            key={example.id}
                          >
                            <p className="font-medium text-slate-900">{example.japaneseText}</p>
                            {example.reading ? <p className="text-slate-500">{example.reading}</p> : null}
                            {example.translationVi ? <p className="text-slate-700">{example.translationVi}</p> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {detail.canonical?.sourceType === "lexeme" ? (
                    <div className="rounded border border-indigo-100 bg-white p-2">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("manageLexemeExamples")}
                      </div>
                      <LexemeExamplesSubrow
                        examples={detail.lexemeExamples}
                        headword={detail.canonical.label}
                        labels={lexemeExampleLabels}
                        lexemeId={detail.canonical.sourceId}
                        onChanged={() => loadDetail(detail.id)}
                      />
                    </div>
                  ) : null}
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
