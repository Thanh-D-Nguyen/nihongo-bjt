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
  AdminToastContainer,
  cn,
  useAdminToast
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { parseApiError, useFormErrors } from "@/lib/form-errors";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Summary = {
  id: string;
  code: string;
  userId: string;
  user: { id: string; email: string | null; displayName: string };
  createdAt: string;
  abuseFlag: boolean;
  eventsLastHour: number;
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

type ReferralEvent = {
  id: string;
  kind: string;
  code: string;
  createdAt: string;
  payload: unknown;
  referrerUserId: string;
  referredUserId: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type Detail = Summary & { events: ReferralEvent[]; audit: AuditEntry[] };

const PAGE_SIZE = 25;

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

export function GrowthReferralsClient({
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
  const canManage = perms != null && perms.has("growth.manage");

  const [tab, setTab] = useState<"campaigns" | "user_codes">("user_codes");
  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, flaggedOnly]);

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
    if (tab !== "user_codes") return;
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (flaggedOnly) params.set("flagged", "true");
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/growth/referrals?${params.toString()}`);
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
  }, [tab, debounced, flaggedOnly, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/growth/referrals/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function submitRevoke() {
    if (!canManage || !confirmId) return;
    if (reason.trim().length < 3) {
      fe.setFieldError("reason", t("reasonRequired"));
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/referrals/${confirmId}/revoke`, {
        body: JSON.stringify({ reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("revokeFailed"));
        toast.error(parsed.form || t("revokeFailed"));
        return;
      }
      toast.success(t("revokeOk"));
      setConfirmId(null);
      setReason("");
      setSelectedId(null);
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "code", "userId", "userEmail", "createdAt", "eventsLastHour", "abuseFlag"];
    const rows = list.items.map((it) => [
      it.id,
      it.code,
      it.userId,
      it.user.email ?? "",
      it.createdAt,
      String(it.eventsLastHour),
      String(it.abuseFlag)
    ]);
    downloadCsv(`growth-referrals-${Date.now()}.csv`, header, rows);
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canManage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex gap-2 border-b text-sm">
          <button
            aria-current={tab === "campaigns" ? "page" : undefined}
            className={cn("px-3 py-2", tab === "campaigns" ? "border-b-2 border-indigo-600 font-semibold" : "")}
            onClick={() => setTab("campaigns")}
            type="button"
          >
            {t("tabCampaigns")}
          </button>
          <button
            aria-current={tab === "user_codes" ? "page" : undefined}
            className={cn(
              "px-3 py-2",
              tab === "user_codes" ? "border-b-2 border-indigo-600 font-semibold" : ""
            )}
            onClick={() => setTab("user_codes")}
            type="button"
          >
            {t("tabUserCodes")}
          </button>
        </div>
      </AdminSection>

      {tab === "campaigns" ? (
        <AdminSection>
          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold">{t("campaignsPartialHeading")}</p>
            <p className="mt-1 text-muted-foreground">{t("campaignsPartialBody")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <code>partial_schema_pending: referral_campaign</code>
            </p>
          </div>
        </AdminSection>
      ) : null}

      {tab === "user_codes" ? (
        <>
          <AdminSection>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label={t("searchPlaceholder")}
                className="min-w-[240px] flex-1 rounded border px-2 py-1 text-sm"
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                value={search}
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  checked={flaggedOnly}
                  onChange={(e) => setFlaggedOnly(e.target.checked)}
                  type="checkbox"
                />
                {t("filterFlaggedOnly")}
              </label>
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
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colCode")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colEventsLastHour")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAbuse")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colActions")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {list && list.items.length > 0 ? (
                  list.items.map((it) => (
                    <AdminDataTableRow
                      key={it.id}
                      className={cn("cursor-pointer", selectedId === it.id ? "bg-indigo-50" : "")}
                      onClick={() => setSelectedId(it.id)}
                    >
                      <AdminDataTableTd>
                        <code className="text-xs">{it.code}</code>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{it.user.displayName ?? it.user.email ?? it.userId}</AdminDataTableTd>
                      <AdminDataTableTd>{formatWhen(it.createdAt, locale)}</AdminDataTableTd>
                      <AdminDataTableTd>{it.eventsLastHour}</AdminDataTableTd>
                      <AdminDataTableTd>
                        {it.abuseFlag ? (
                          <AdminStatusBadge tone="danger">{t("abuseFlagged")}</AdminStatusBadge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        {canManage ? (
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(it.id);
                              setReason("");
                              fe.clearFieldError("reason");
                            }}
                            type="button"
                          >
                            {t("actionRevoke")}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </AdminDataTableTd>
                    </AdminDataTableRow>
                  ))
                ) : (
                  <AdminDataTableRow>
                    <AdminDataTableTd colSpan={6}>
                      <AdminEmptyState title={common.empty} />
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                )}
              </AdminDataTableBody>
            </AdminDataTable>
            {list ? (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>
                  {common.records}: {list.total}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    {t("prevPage")}
                  </button>
                  <span>
                    {t("pageLabel")} {page} / {totalPages}
                  </span>
                  <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    type="button"
                  >
                    {t("nextPage")}
                  </button>
                </div>
              </div>
            ) : null}
          </AdminSection>

          {detail ? (
            <AdminSection>
              <h3 className="text-lg font-semibold">
                <code>{detail.code}</code>
                {detail.abuseFlag ? (
                  <span className="ml-2">
                    <AdminStatusBadge tone="danger">{t("abuseFlagged")}</AdminStatusBadge>
                  </span>
                ) : null}
              </h3>
              <p className="text-sm">
                {t("colUser")}: {detail.user.displayName ?? detail.user.email ?? detail.userId}
              </p>
              <p className="text-sm">
                {t("colCreated")}: {formatWhen(detail.createdAt, locale)}
              </p>
              <p className="text-sm">
                {t("colEventsLastHour")}: {detail.eventsLastHour}
              </p>

              <h4 className="mt-3 text-sm font-semibold">{t("recentEvents")}</h4>
              {detail.events.length > 0 ? (
                <ul className="mt-1 space-y-1 text-xs">
                  {detail.events.slice(0, 20).map((ev) => (
                    <li key={ev.id} className="rounded border p-2">
                      <code>{ev.kind}</code> · {formatWhen(ev.createdAt, locale)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{common.empty}</p>
              )}

              <h4 className="mt-3 text-sm font-semibold">{t("detailAudit")}</h4>
              {detail.audit.length > 0 ? (
                <ul className="mt-1 space-y-1 text-xs">
                  {detail.audit.map((a) => (
                    <li key={a.id} className="rounded border p-2">
                      <code>{a.action}</code> · {formatWhen(a.createdAt, locale)}
                      {a.actor ? <> · {a.actor.displayName ?? a.actor.email}</> : null}
                      {a.reason ? <> · &ldquo;{a.reason}&rdquo;</> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t("detailAuditEmpty")}</p>
              )}
            </AdminSection>
          ) : null}

          {confirmId ? (
            <div
              aria-label={t("confirmHeading_revoke")}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
            >
              <div className="w-full max-w-md rounded bg-white p-4 shadow">
                <h4 className="text-lg font-semibold">{t("confirmHeading_revoke")}</h4>
                <p className="mt-1 text-sm">{t("confirmBody_revoke")}</p>
                <input
                  aria-label={t("formReason")}
                  className={cn("mt-3 w-full rounded border px-2 py-1 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")}
                  onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }}
                  placeholder={t("formReason")}
                  value={reason}
                />
                {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm"
                    onClick={() => {
                      setConfirmId(null);
                      setReason("");
                      fe.clearFieldError("reason");
                    }}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                    disabled={mutating}
                    onClick={() => void submitRevoke()}
                    type="button"
                  >
                    {t("confirmSubmit_revoke")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
