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
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import {
  type CommonLabels,
  type Labels,
  buildT,
  downloadCsv,
  loadAdminPermissions
} from "../../../_components/admin-client-utils";

type Visibility = "private" | "team" | "audit_only";
type Note = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  targetId: string;
  before: { visibility?: Visibility } | null;
  after: { body?: string } | null;
  actor: { id: string; displayName: string | null; email: string | null } | null;
};
type ListResponse = { items: Note[]; total: number };

const PAGE_SIZE = 50;

function visTone(v: string): "neutral" | "good" | "warning" | "danger" {
  if (v === "private") return "neutral";
  if (v === "team") return "good";
  if (v === "audit_only") return "danger";
  return "neutral";
}

export function SupportNotesClient({ common, labels, locale }: { common: CommonLabels; labels: Labels; locale: string }) {
  const t = buildT(labels);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite =
    perms != null && (perms.has("support.user.write") || perms.has("support.user"));
  const canRead =
    perms != null &&
    (canWrite || perms.has("support.user.read") || perms.has("iam.manage"));
  const auditScope = perms != null && (perms.has("*") || perms.has("iam.manage"));

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [visFilter, setVisFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newVis, setNewVis] = useState<Visibility>("team");

  const [detail, setDetail] = useState<Note | null>(null);

  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    void loadAdminPermissions().then((p) => {
      if (!cancel) setPerms(p);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const loadList = useCallback(async () => {
    if (!canRead) return;
    try {
      const params = new URLSearchParams();
      if (userIdFilter.trim()) params.set("userId", userIdFilter.trim());
      if (createdByFilter.trim()) params.set("createdBy", createdByFilter.trim());
      if (visFilter) params.set("visibility", visFilter);
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      if (search.trim()) params.set("q", search.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/support/notes?${params.toString()}`);
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
  }, [canRead, userIdFilter, createdByFilter, visFilter, from, to, search, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setPage(1);
  }, [userIdFilter, createdByFilter, visFilter, from, to, search]);

  async function submitCreate() {
    if (newReason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    if (!newUserId.trim() || !newBody.trim()) {
      setToast({ kind: "err", text: t("createFailed") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/support/notes`, {
        body: JSON.stringify({
          body: newBody.trim(),
          reason: newReason.trim(),
          userId: newUserId.trim(),
          visibility: newVis
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!r.ok) {
        const text = await r.text();
        setToast({ kind: "err", text: text || t("createFailed") });
        return;
      }
      setToast({ kind: "ok", text: t("createOk") });
      setCreating(false);
      setNewUserId("");
      setNewBody("");
      setNewReason("");
      setNewVis("team");
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["createdAt", "userId", "actor", "visibility", "reason"];
    const rows = list.items.map((it) => [
      it.createdAt,
      it.targetId,
      it.actor?.displayName ?? it.actor?.email ?? it.actor?.id ?? "",
      (it.before?.visibility ?? "legacy") as string,
      it.reason ?? ""
    ]);
    downloadCsv(`support-notes-${Date.now()}.csv`, header, rows);
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      <div className="rounded border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
        {t("privacyNotice")}
      </div>
      {auditScope ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {t("auditScopeNotice")}
        </div>
      ) : null}
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label={t("filterUser")}
            className="w-64 rounded border px-2 py-1 text-sm"
            onChange={(e) => setUserIdFilter(e.target.value)}
            placeholder={t("filterUser")}
            value={userIdFilter}
          />
          <input
            aria-label={t("filterCreatedBy")}
            className="w-64 rounded border px-2 py-1 text-sm"
            onChange={(e) => setCreatedByFilter(e.target.value)}
            placeholder={t("filterCreatedBy")}
            value={createdByFilter}
          />
          <select
            aria-label={t("filterVisibility")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setVisFilter(e.target.value)}
            value={visFilter}
          >
            <option value="">{t("filterVisibilityAll")}</option>
            <option value="private">{t("visibility_private")}</option>
            <option value="team">{t("visibility_team")}</option>
            <option value="audit_only">{t("visibility_audit_only")}</option>
          </select>
          <label className="text-xs text-gray-600">
            {t("filterDateFrom")}
            <input className="ml-1 rounded border px-2 py-1 text-sm" onChange={(e) => setFrom(e.target.value)} type="date" value={from} />
          </label>
          <label className="text-xs text-gray-600">
            {t("filterDateTo")}
            <input className="ml-1 rounded border px-2 py-1 text-sm" onChange={(e) => setTo(e.target.value)} type="date" value={to} />
          </label>
          <input
            aria-label={t("filterSearch")}
            className="w-64 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("filterSearch")}
            value={search}
          />
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
            {t("actionExportCsv")}
          </button>
          {canWrite ? (
            <button className="rounded bg-indigo-600 px-3 py-1 text-sm text-white" onClick={() => setCreating(true)} type="button">
              {t("actionCreate")}
            </button>
          ) : null}
        </div>
      </AdminSection>

      {listError ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {listError}
        </div>
      ) : null}

      <AdminSection>
        {!canRead ? (
          <AdminEmptyState title={t("readOnlyNotice")} />
        ) : list == null ? (
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        ) : list.items.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colTime")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colActor")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colVisibility")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colReason")}</AdminDataTableTh>
                <AdminDataTableTh></AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((n) => {
                const v = n.before?.visibility ?? ("team" as Visibility);
                return (
                  <AdminDataTableRow key={n.id} className="cursor-pointer hover:bg-indigo-50/40" onClick={() => setDetail(n)}>
                    <AdminDataTableTd>
                      <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString()}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-xs">{n.targetId.slice(0, 8)}…</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-xs">{n.actor?.displayName ?? n.actor?.email ?? n.actor?.id ?? "—"}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={visTone(v)}>{t(`visibility_${v}`) || v}</AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="line-clamp-1 max-w-xs text-xs">{n.reason ?? ""}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd onClick={(e) => e.stopPropagation()}>
                      <Link
                        className="text-xs text-indigo-600 underline"
                        href={`/${locale}/users/360?userId=${encodeURIComponent(n.targetId)}`}
                      >
                        {t("actionOpenUser")}
                      </Link>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                );
              })}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
        {list && list.total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">‹</button>
            <span className="text-gray-600">{page} / {totalPages}</span>
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">›</button>
          </div>
        ) : null}
      </AdminSection>

      {creating ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setCreating(false)} role="dialog">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-base font-semibold">{t("drawerCreateTitle")}</div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setCreating(false)} type="button">
                {t("close")}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase">{t("fieldUserId")}</label>
              <input className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => setNewUserId(e.target.value)} value={newUserId} />
              <label className="block text-xs font-semibold uppercase">{t("fieldBody")}</label>
              <textarea className="h-32 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setNewBody(e.target.value)} value={newBody} />
              <label className="block text-xs font-semibold uppercase">{t("fieldVisibility")}</label>
              <select className="rounded border px-2 py-1 text-sm" onChange={(e) => setNewVis(e.target.value as Visibility)} value={newVis}>
                <option value="private">{t("visibility_private")}</option>
                <option value="team">{t("visibility_team")}</option>
                <option value="audit_only">{t("visibility_audit_only")}</option>
              </select>
              <label className="block text-xs font-semibold uppercase">{t("reason")}</label>
              <input className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => setNewReason(e.target.value)} placeholder={t("reasonPlaceholder")} value={newReason} />
              <div className="flex justify-end gap-2">
                <button className="rounded border px-3 py-1 text-sm" onClick={() => setCreating(false)} type="button">
                  {t("cancel")}
                </button>
                <button
                  className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                  disabled={mutating}
                  onClick={() => void submitCreate()}
                  type="button"
                >
                  {t("confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetail(null)} role="dialog">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-base font-semibold">{t("drawerDetailTitle")}</div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setDetail(null)} type="button">
                {t("close")}
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">{t("colTime")}</dt>
              <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
              <dt className="text-gray-500">{t("colUser")}</dt>
              <dd className="font-mono text-xs">{detail.targetId}</dd>
              <dt className="text-gray-500">{t("colActor")}</dt>
              <dd className="text-xs">{detail.actor?.displayName ?? detail.actor?.email ?? detail.actor?.id ?? "—"}</dd>
              <dt className="text-gray-500">{t("colVisibility")}</dt>
              <dd>
                <AdminStatusBadge tone={visTone((detail.before?.visibility ?? "team") as string)}>
                  {t(`visibility_${detail.before?.visibility ?? "team"}`) || (detail.before?.visibility ?? "team")}
                </AdminStatusBadge>
              </dd>
              <dt className="text-gray-500">{t("colReason")}</dt>
              <dd>{detail.reason ?? "—"}</dd>
            </dl>
            <pre className="mt-3 rounded border bg-gray-50 p-2 text-xs">
              {detail.after?.body ?? ""}
            </pre>
            <div className="mt-3">
              <Link
                className="text-sm text-indigo-600 underline"
                href={`/${locale}/users/360?userId=${encodeURIComponent(detail.targetId)}`}
              >
                {t("actionOpenUser")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`} role="status">
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">✕</button>
        </div>
      ) : null}
    </div>
  );
}
