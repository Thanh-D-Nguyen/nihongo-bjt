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

type Deck = {
  id: string;
  ownerUserId: string | null;
  titleVi: string;
  titleJa: string | null;
  descriptionVi: string | null;
  descriptionJa: string | null;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { cards: number };
};

type ListResponse = { items: Deck[]; total: number; page: number; pageSize: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type Detail = Deck & { audit: AuditEntry[] };

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

function statusTone(status: string): "neutral" | "warning" | "danger" {
  if (status === "active") return "neutral";
  if (status === "draft") return "warning";
  return "danger";
}

export function FlashcardDecksAdminClient({
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
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived" | "draft">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Deck | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
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
  }, [debounced, statusFilter, visibilityFilter]);

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
      if (visibilityFilter !== "all") params.set("visibility", visibilityFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/flashcards/decks?${params.toString()}`);
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
  }, [debounced, statusFilter, visibilityFilter, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/flashcards/decks/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(d: Deck) {
    setSelected(d);
    setDetail(null);
    setTransitioning(null);
    setReason("");
    void loadDetail(d.id);
  }
  function closeDrawer() {
    setSelected(null);
    setDetail(null);
    setTransitioning(null);
  }

  async function submitTransition(next: "active" | "archived" | "draft") {
    if (!detail) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/flashcards/decks/${detail.id}/transition`, {
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

  function exportCsv() {
    if (!list) return;
    const header = ["id", "titleVi", "titleJa", "visibility", "status", "cards", "ownerUserId", "updatedAt"];
    const rows = list.items.map((it) => [
      it.id,
      it.titleVi,
      it.titleJa ?? "",
      it.visibility,
      it.status,
      String(it._count?.cards ?? 0),
      it.ownerUserId ?? "",
      it.updatedAt
    ]);
    downloadCsv(`flashcard-decks-${Date.now()}.csv`, header, rows);
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
          <select
            aria-label={t("filterVisibility")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setVisibilityFilter(e.target.value)}
            value={visibilityFilter}
          >
            <option value="all">{t("filterVisibilityAll")}</option>
            <option value="public">{t("visibility_public")}</option>
            <option value="private">{t("visibility_private")}</option>
            <option value="curated">{t("visibility_curated")}</option>
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
                <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colTitleJa")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colVisibility")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCards")}</AdminDataTableTh>
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
                    <span className="text-sm">{it.titleVi}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-sm text-gray-700">{it.titleJa ?? "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone="neutral">
                      {t(`visibility_${it.visibility}`) || it.visibility}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(it.status)}>
                      {t(`status_${it.status}`) || it.status}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-sm">{it._count?.cards ?? 0}</span>
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
                  {selected.visibility} · {selected.status}
                </div>
                <div className="text-lg font-semibold">{selected.titleVi}</div>
                {selected.titleJa ? <div className="text-sm text-gray-700">{selected.titleJa}</div> : null}
                <div className="mt-1 text-xs text-gray-500">
                  {t("colCards")}: {selected._count?.cards ?? 0}
                </div>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={closeDrawer} type="button">
                {t("close")}
              </button>
            </div>

            {detail == null ? (
              <div className="mt-4 text-sm text-gray-500">{common.loading}</div>
            ) : (
              <>
                {detail.descriptionVi || detail.descriptionJa ? (
                  <div className="mt-3 space-y-1 rounded border bg-gray-50 p-2 text-xs text-gray-700">
                    {detail.descriptionVi ? <div>VI: {detail.descriptionVi}</div> : null}
                    {detail.descriptionJa ? <div>JA: {detail.descriptionJa}</div> : null}
                  </div>
                ) : null}

                {canWrite ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.status !== "active" ? (
                      <button
                        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                        onClick={() => {
                          setTransitioning("active");
                          setReason("");
                        }}
                        type="button"
                      >
                        {t("approve")}
                      </button>
                    ) : null}
                    {detail.status !== "archived" ? (
                      <button
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                        onClick={() => {
                          setTransitioning("archived");
                          setReason("");
                        }}
                        type="button"
                      >
                        {t("reject")}
                      </button>
                    ) : null}
                    {detail.status !== "draft" ? (
                      <button
                        className="rounded border px-3 py-1 text-sm"
                        onClick={() => {
                          setTransitioning("draft");
                          setReason("");
                        }}
                        type="button"
                      >
                        {t("draft")}
                      </button>
                    ) : null}
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
