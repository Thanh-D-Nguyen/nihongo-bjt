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
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type MatchSummary = {
  id: string;
  userId: string;
  roomCode: string;
  mode: string;
  botKey: string | null;
  status: "in_progress" | "completed" | "abandoned";
  userScore: number;
  opponentScore: number;
  maxRounds: number;
  currentRoundIndex: number;
  startedAt: string;
  completedAt: string | null;
  abandonedReason: string | null;
  _count: { rounds: number };
};

type Round = {
  id: string;
  roundIndex: number;
  questionId: string;
  userOptionKey: string | null;
  userCorrect: boolean | null;
  userResponseMs: number | null;
  botOptionKey: string | null;
  botCorrect: boolean | null;
  botResponseMs: number | null;
  decidedAt: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  actor: { id: string; displayName: string; email: string } | null;
};

type MatchDetail = MatchSummary & {
  rounds: Round[];
  audit: AuditEntry[];
};

type ListResponse = {
  items: MatchSummary[];
  total: number;
  page: number;
  pageSize: number;
};

type StatusFilter = "all" | "in_progress" | "completed" | "abandoned";

const PAGE_SIZE = 25;

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "completed") return "good";
  if (status === "abandoned") return "danger";
  if (status === "in_progress") return "warning";
  return "neutral";
}

function formatWhen(iso: string | null, locale: string): string {
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

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
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

export function BattleMatchesClient({
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
  const canManage = perms != null && perms.has("battle.manage");
  const isReadOnly = perms != null && !canManage;

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [debouncedUserId, setDebouncedUserId] = useState("");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"abort" | "rerun" | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    const h = setTimeout(() => setDebouncedUserId(userIdFilter.trim()), 300);
    return () => clearTimeout(h);
  }, [userIdFilter]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, debouncedUserId]);

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

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedUserId) params.set("userId", debouncedUserId);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/battle/matches?${params.toString()}`);
      if (!r.ok) {
        setList(null);
        setListError(t("errorLoad"));
        return;
      }
      setList((await r.json()) as ListResponse);
    } catch {
      setList(null);
      setListError(t("errorLoad"));
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, statusFilter, debouncedUserId, page, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await adminApiFetch(`/api/admin/battle/matches/${encodeURIComponent(id)}`);
        if (!r.ok) {
          setDetail(null);
          setDetailError(t("errorDetail"));
          return;
        }
        setDetail((await r.json()) as MatchDetail);
      } catch {
        setDetail(null);
        setDetailError(t("errorDetail"));
      } finally {
        setDetailLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const items = useMemo(() => list?.items ?? [], [list]);

  const exportCsv = () => {
    if (!list) return;
    downloadCsv(
      `battle-matches-page-${list.page}.csv`,
      [t("colId"), t("colUser"), t("colMode"), t("colRoom"), t("colStatus"), t("colScore"), t("colRounds"), t("colStarted")],
      list.items.map((row) => [
        row.id,
        row.userId,
        row.mode,
        row.roomCode,
        row.status,
        `${row.userScore} - ${row.opponentScore}`,
        `${row.currentRoundIndex}/${row.maxRounds}`,
        row.startedAt
      ])
    );
  };

  const refresh = () => {
    void loadList();
    if (selectedId) void loadDetail(selectedId);
  };

  const requireReason = (): string | null => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setToast({ kind: "err", text: t("reasonHint") });
      return null;
    }
    return trimmed;
  };

  const doAction = async (kind: "abort" | "rerun") => {
    if (!canManage || !detail) return;
    const r = requireReason();
    if (!r) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(
        `/api/admin/battle/matches/${encodeURIComponent(detail.id)}/${kind}`,
        {
          body: JSON.stringify({ reason: r }),
          headers: { "content-type": "application/json" },
          method: "POST"
        }
      );
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setReason("");
      setConfirm(null);
      setToast({
        kind: "ok",
        text: kind === "abort" ? t("successAbort") : t("successRerun")
      });
      if (kind === "rerun") {
        const created = (await res.json()) as MatchDetail;
        setSelectedId(created.id);
      } else {
        await loadDetail(detail.id);
      }
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          <label className="block flex-1 min-w-[200px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("searchPlaceholder")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              type="search"
              value={search}
            />
          </label>
          <label className="block min-w-[160px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterStatus")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">{t("filterStatusAll")}</option>
              <option value="in_progress">{t("status_in_progress")}</option>
              <option value="completed">{t("status_completed")}</option>
              <option value="abandoned">{t("status_abandoned")}</option>
            </select>
          </label>
          <label className="block min-w-[200px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterUserId")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setUserIdFilter(e.target.value)}
              placeholder="UUID"
              type="search"
              value={userIdFilter}
            />
          </label>
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
        ) : items.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("emptyHint")}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colId")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colMode")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colRoom")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colScore")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colRounds")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStarted")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {items.map((row) => (
                  <AdminDataTableRow
                    className={cn(
                      "cursor-pointer hover:bg-indigo-50/40",
                      selectedId === row.id && "bg-indigo-50/60"
                    )}
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <AdminDataTableTd>
                      <span className="font-mono text-[10px] text-slate-500">{row.id.slice(0, 8)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-[10px] text-slate-500">{row.userId.slice(0, 8)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.mode}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-mono text-xs">{row.roomCode}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>
                        {t(`status_${row.status}`) || row.status}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      {row.userScore} – {row.opponentScore}
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      {row.currentRoundIndex} / {row.maxRounds}
                    </AdminDataTableTd>
                    <AdminDataTableTd>{formatWhen(row.startedAt, locale)}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")}: {list?.page ?? page} / {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  {t("prevPage")}
                </button>
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page >= totalPages}
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
          description={t("detailSelectHint")}
          title={t("detailHeading")}
        >
          {detailLoading && !detail ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : detailError ? (
            <AdminEmptyState title={common.error}>{detailError}</AdminEmptyState>
          ) : detail ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <AdminStatusBadge tone={statusTone(detail.status)}>
                  {t(`status_${detail.status}`) || detail.status}
                </AdminStatusBadge>
                <span className="font-mono text-xs text-slate-600">{detail.id}</span>
                {canManage && detail.status === "in_progress" ? (
                  <button
                    className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    onClick={() => setConfirm("abort")}
                    type="button"
                  >
                    {t("actionAbort")}
                  </button>
                ) : null}
                {canManage && detail.status !== "in_progress" ? (
                  <button
                    className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    onClick={() => setConfirm("rerun")}
                    type="button"
                  >
                    {t("actionRerun")}
                  </button>
                ) : null}
                <button
                  className="ml-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setSelectedId(null)}
                  type="button"
                >
                  {t("close")}
                </button>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
                <dt className="text-slate-500">{t("colUser")}</dt>
                <dd className="font-mono">{detail.userId}</dd>
                <dt className="text-slate-500">{t("colMode")}</dt>
                <dd>{detail.mode}</dd>
                <dt className="text-slate-500">{t("colBotKey")}</dt>
                <dd>{detail.botKey ?? "—"}</dd>
                <dt className="text-slate-500">{t("colRoom")}</dt>
                <dd className="font-mono">{detail.roomCode}</dd>
                <dt className="text-slate-500">{t("colScore")}</dt>
                <dd>
                  {detail.userScore} – {detail.opponentScore}
                </dd>
                <dt className="text-slate-500">{t("colRounds")}</dt>
                <dd>
                  {detail.currentRoundIndex} / {detail.maxRounds}
                </dd>
                <dt className="text-slate-500">{t("colStarted")}</dt>
                <dd>{formatWhen(detail.startedAt, locale)}</dd>
                <dt className="text-slate-500">{t("colCompleted")}</dt>
                <dd>{formatWhen(detail.completedAt, locale)}</dd>
                {detail.abandonedReason ? (
                  <>
                    <dt className="text-slate-500">{t("colAbandonedReason")}</dt>
                    <dd>{detail.abandonedReason}</dd>
                  </>
                ) : null}
              </dl>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("roundsHeading")}
                </h3>
                {detail.rounds.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("roundsEmpty")}</p>
                ) : (
                  <AdminDataTable>
                    <AdminDataTableHead>
                      <AdminDataTableRow>
                        <AdminDataTableTh>#</AdminDataTableTh>
                        <AdminDataTableTh>{t("roundUserAns")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("roundUserMs")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("roundBotAns")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("roundBotMs")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("roundDecided")}</AdminDataTableTh>
                      </AdminDataTableRow>
                    </AdminDataTableHead>
                    <AdminDataTableBody>
                      {detail.rounds.map((rnd) => (
                        <AdminDataTableRow key={rnd.id}>
                          <AdminDataTableTd>{rnd.roundIndex + 1}</AdminDataTableTd>
                          <AdminDataTableTd>
                            {rnd.userOptionKey ?? "—"}
                            {rnd.userCorrect != null ? (
                              <span className={rnd.userCorrect ? "ml-1 text-emerald-600" : "ml-1 text-rose-600"}>
                                {rnd.userCorrect ? "✓" : "✗"}
                              </span>
                            ) : null}
                          </AdminDataTableTd>
                          <AdminDataTableTd>{rnd.userResponseMs ?? "—"}</AdminDataTableTd>
                          <AdminDataTableTd>
                            {rnd.botOptionKey ?? "—"}
                            {rnd.botCorrect != null ? (
                              <span className={rnd.botCorrect ? "ml-1 text-emerald-600" : "ml-1 text-rose-600"}>
                                {rnd.botCorrect ? "✓" : "✗"}
                              </span>
                            ) : null}
                          </AdminDataTableTd>
                          <AdminDataTableTd>{rnd.botResponseMs ?? "—"}</AdminDataTableTd>
                          <AdminDataTableTd>{formatWhen(rnd.decidedAt, locale)}</AdminDataTableTd>
                        </AdminDataTableRow>
                      ))}
                    </AdminDataTableBody>
                  </AdminDataTable>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("detailAudit")}
                </h3>
                {detail.audit.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("detailAuditEmpty")}</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {detail.audit.map((a) => (
                      <li key={a.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatWhen(a.createdAt, locale)}
                        </span>{" "}
                        <span className="font-semibold text-slate-700">{a.action}</span>{" "}
                        <span className="text-slate-500">{a.actor?.displayName ?? a.actor?.email ?? "—"}</span>
                        {a.reason ? <p className="text-slate-600">{a.reason}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </AdminSection>
      ) : null}

      {confirm && detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">
              {confirm === "abort" ? t("confirm_abort_title") : t("confirm_rerun_title")}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {confirm === "abort" ? t("confirm_abort_message") : t("confirm_rerun_message")}
            </p>
            <label className="mt-3 block text-sm">
              <span className="block text-xs font-medium text-slate-600">{t("reasonLabel")}</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={3}
                value={reason}
              />
              <span className="mt-1 block text-[10px] text-slate-400">{t("reasonHint")}</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setConfirm(null);
                  setReason("");
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm",
                  confirm === "abort" ? "bg-rose-600 hover:bg-rose-500" : "bg-indigo-600 hover:bg-indigo-500",
                  mutating && "opacity-60"
                )}
                disabled={mutating}
                onClick={() => doAction(confirm)}
                type="button"
              >
                {mutating ? common.loading : t("confirmSubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
