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
import {
  BATTLE_BOT_DIFFICULTIES,
  BATTLE_BOT_STYLE_TOKENS,
  BATTLE_BOT_VOCAB_LEVELS
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import { AdminAutoFill } from "@/app/_components/admin-auto-fill";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type BotSummary = {
  avatarFallback: string;
  botKey: string;
  id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "disabled" | "archived";
  accuracyPct: number;
  minDelayMs: number;
  maxDelayMs: number;
  riveSrc: string | null;
  styleToken: "calm" | "focused" | "sharp";
  vocabularyLevel: string;
  createdAt: string;
  updatedAt: string;
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

type BotDetail = BotSummary & {
  audit: AuditEntry[];
  persona: string | null;
  riveArtboard: string;
  riveLicense: string | null;
  riveProvenance: Record<string, unknown>;
  riveStateMachine: string;
};

type ListResponse = { items: BotSummary[]; total: number; page: number; pageSize: number };

type FormState = {
  avatarFallback: string;
  botKey: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  persona: string;
  accuracyPct: number;
  minDelayMs: number;
  maxDelayMs: number;
  riveArtboard: string;
  riveLicense: string;
  riveProvenanceJson: string;
  riveSrc: string;
  riveStateMachine: string;
  styleToken: "calm" | "focused" | "sharp";
  vocabularyLevel: string;
};

const DEFAULT_FORM: FormState = {
  accuracyPct: 70,
  avatarFallback: "J3",
  botKey: "bot_j3_custom",
  difficulty: "medium",
  maxDelayMs: 4000,
  minDelayMs: 1500,
  name: "",
  persona: "",
  riveArtboard: "__default__",
  riveLicense: "",
  riveProvenanceJson: "{}",
  riveSrc: "",
  riveStateMachine: "__none__",
  styleToken: "focused",
  vocabularyLevel: BATTLE_BOT_VOCAB_LEVELS[2] ?? "jlpt_n3"
};

const PAGE_SIZE = 25;

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "active") return "good";
  if (status === "disabled") return "warning";
  return "neutral";
}

function formatWhen(iso: string, locale: string): string {
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

export function BattleBotsClient({
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
  const canManage = perms != null && perms.has("battle.manage");
  const isReadOnly = perms != null && !canManage;

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled" | "archived">(
    "all"
  );
  const [diffFilter, setDiffFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"enable" | "disable" | "archive" | "delete" | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, diffFilter]);

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
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (diffFilter !== "all") params.set("difficulty", diffFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/battle/bots?${params.toString()}`);
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
  }, [debouncedSearch, statusFilter, diffFilter, page, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await adminApiFetch(`/api/admin/battle/bots/${encodeURIComponent(id)}`);
        if (!r.ok) {
          setDetail(null);
          setDetailError(t("errorDetail"));
          return;
        }
        setDetail((await r.json()) as BotDetail);
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
      setEditing(false);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const items = list?.items ?? [];
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    if (!list) return;
    downloadCsv(
      `battle-bots-page-${list.page}.csv`,
      [
        t("colBotKey"),
        t("colName"),
        t("colDifficulty"),
        t("colStatus"),
        t("colAccuracy"),
        t("colDelay"),
        t("colVocab"),
        t("colRive"),
        t("colUpdated")
      ],
      list.items.map((row) => [
        row.botKey,
        row.name,
        row.difficulty,
        row.status,
        `${row.accuracyPct}%`,
        `${row.minDelayMs}-${row.maxDelayMs}ms`,
        row.vocabularyLevel,
        row.riveSrc ? "configured" : "fallback",
        row.updatedAt
      ])
    );
  };

  const refresh = () => {
    void loadList();
    if (selectedId) void loadDetail(selectedId);
  };

  const validateForm = (state: FormState, includeReason = true): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (includeReason && reason.trim().length < 3) errs.reason = t("reasonHint");
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(state.botKey.trim())) errs.botKey = t("formErrBotKey");
    if (state.name.trim().length < 2) errs.name = t("formErrName");
    if (state.avatarFallback.trim().length < 1) errs.avatarFallback = t("formErrAvatar");
    if (state.accuracyPct < 0 || state.accuracyPct > 100) errs.accuracyPct = t("formErrAccuracy");
    if (state.minDelayMs < 0 || state.minDelayMs > 60000) errs.minDelayMs = t("formErrDelay");
    if (state.maxDelayMs < 0 || state.maxDelayMs > 60000) errs.maxDelayMs = t("formErrDelay");
    if (state.maxDelayMs < state.minDelayMs) errs.maxDelayMs = t("formErrDelayOrder");
    if (state.riveArtboard.trim().length < 1) errs.riveArtboard = t("formErrRive");
    if (state.riveStateMachine.trim().length < 1) errs.riveStateMachine = t("formErrRive");
    try {
      const parsed = JSON.parse(state.riveProvenanceJson || "{}") as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        errs.riveProvenanceJson = t("formErrJson");
      }
    } catch {
      errs.riveProvenanceJson = t("formErrJson");
    }
    return errs;
  };

  const buildBody = (state: FormState, withReason: string) => ({
    accuracyPct: state.accuracyPct,
    avatarFallback: state.avatarFallback.trim(),
    botKey: state.botKey.trim(),
    difficulty: state.difficulty,
    maxDelayMs: state.maxDelayMs,
    minDelayMs: state.minDelayMs,
    name: state.name.trim(),
    persona: state.persona.trim() || null,
    reason: withReason,
    riveArtboard: state.riveArtboard.trim(),
    riveLicense: state.riveLicense.trim() || null,
    riveProvenance: JSON.parse(state.riveProvenanceJson || "{}") as Record<string, unknown>,
    riveSrc: state.riveSrc.trim() || null,
    riveStateMachine: state.riveStateMachine.trim(),
    styleToken: state.styleToken,
    vocabularyLevel: state.vocabularyLevel
  });

  const doCreate = async () => {
    if (!canManage) return;
    const errs = validateForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch("/api/admin/battle/bots", {
        body: JSON.stringify(buildBody(form, reason.trim())),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      const created = (await res.json()) as BotDetail;
      setToast({ kind: "ok", text: t("successCreate") });
      setReason("");
      setForm(DEFAULT_FORM);
      setCreating(false);
      setSelectedId(created.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  const doPatch = async () => {
    if (!canManage || !detail) return;
    const errs = validateForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/battle/bots/${encodeURIComponent(detail.id)}`, {
        body: JSON.stringify(buildBody(form, reason.trim())),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setToast({ kind: "ok", text: t("successUpdate") });
      setReason("");
      setEditing(false);
      await loadDetail(detail.id);
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  const doLifecycle = async (kind: "enable" | "disable" | "archive" | "delete") => {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) {
      setFormErrors({ reason: t("reasonHint") });
      return;
    }
    setFormErrors({});
    setMutating(true);
    setToast(null);
    try {
      const path =
        kind === "delete"
          ? `/api/admin/battle/bots/${encodeURIComponent(detail.id)}`
          : `/api/admin/battle/bots/${encodeURIComponent(detail.id)}/${kind}`;
      const res = await adminApiFetch(path, {
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { "content-type": "application/json" },
        method: kind === "delete" ? "DELETE" : "POST"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      setReason("");
      setConfirm(null);
      if (kind === "delete") {
        setSelectedId(null);
        setToast({ kind: "ok", text: t("successDelete") });
      } else {
        setToast({
          kind: "ok",
          text:
            kind === "enable"
              ? t("successEnable")
              : kind === "disable"
                ? t("successDisable")
                : t("successArchive")
        });
        await loadDetail(detail.id);
      }
      await loadList();
    } catch {
      setToast({ kind: "err", text: t("errorMutation") });
    } finally {
      setMutating(false);
    }
  };

  const detailToForm = (d: BotDetail): FormState => ({
    accuracyPct: d.accuracyPct,
    avatarFallback: d.avatarFallback,
    botKey: d.botKey,
    difficulty: d.difficulty,
    maxDelayMs: d.maxDelayMs,
    minDelayMs: d.minDelayMs,
    name: d.name,
    persona: d.persona ?? "",
    riveArtboard: d.riveArtboard,
    riveLicense: d.riveLicense ?? "",
    riveProvenanceJson: JSON.stringify(d.riveProvenance ?? {}, null, 2),
    riveSrc: d.riveSrc ?? "",
    riveStateMachine: d.riveStateMachine,
    styleToken: d.styleToken,
    vocabularyLevel: d.vocabularyLevel
  });

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
            <span className="block text-xs font-medium text-slate-600">
              {t("searchPlaceholder")}
            </span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              type="search"
              value={search}
            />
          </label>
          <label className="block min-w-[140px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterStatus")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              value={statusFilter}
            >
              <option value="all">{t("filterStatusAll")}</option>
              <option value="active">{t("status_active")}</option>
              <option value="disabled">{t("status_disabled")}</option>
              <option value="archived">{t("status_archived")}</option>
            </select>
          </label>
          <label className="block min-w-[140px] text-sm">
            <span className="block text-xs font-medium text-slate-600">
              {t("filterDifficulty")}
            </span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setDiffFilter(e.target.value as typeof diffFilter)}
              value={diffFilter}
            >
              <option value="all">{t("filterDifficultyAll")}</option>
              {BATTLE_BOT_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {t(`difficulty_${d}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-end gap-2">
            {canManage ? (
              <button
                className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                onClick={() => {
                  setForm(DEFAULT_FORM);
                  setFormErrors({});
                  setSelectedId(null);
                  setCreating(true);
                }}
                type="button"
              >
                {t("actionCreate")}
              </button>
            ) : null}
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
                  <AdminDataTableTh>{t("colBotKey")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colDifficulty")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colAccuracy")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colDelay")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colVocab")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colRive")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
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
                    <AdminDataTableTd className="font-mono text-xs">{row.botKey}</AdminDataTableTd>
                    <AdminDataTableTd>{row.name}</AdminDataTableTd>
                    <AdminDataTableTd>
                      {t(`difficulty_${row.difficulty}`) || row.difficulty}
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>
                        {t(`status_${row.status}`) || row.status}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.accuracyPct}%</AdminDataTableTd>
                    <AdminDataTableTd>
                      {row.minDelayMs}–{row.maxDelayMs} ms
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.vocabularyLevel}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={row.riveSrc ? "good" : "warning"}>
                        {row.riveSrc ? t("riveConfigured") : t("riveFallback")}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{formatWhen(row.updatedAt, locale)}</AdminDataTableTd>
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

      {selectedId && detail ? (
        <AdminSection description={t("detailSelectHint")} title={t("detailHeading")}>
          {detailLoading ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : detailError ? (
            <AdminEmptyState title={common.error}>{detailError}</AdminEmptyState>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <AdminStatusBadge tone={statusTone(detail.status)}>
                  {t(`status_${detail.status}`) || detail.status}
                </AdminStatusBadge>
                <span className="font-mono text-xs text-slate-600">{detail.id}</span>
                {canManage && !editing ? (
                  <>
                    <button
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setForm(detailToForm(detail));
                        setFormErrors({});
                        setEditing(true);
                      }}
                      type="button"
                    >
                      {t("actionEdit")}
                    </button>
                    {detail.status === "active" ? (
                      <button
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        onClick={() => { setFormErrors({}); setReason(""); setConfirm("disable"); }}
                        type="button"
                      >
                        {t("actionDisable")}
                      </button>
                    ) : null}
                    {detail.status === "disabled" ? (
                      <button
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        onClick={() => { setFormErrors({}); setReason(""); setConfirm("enable"); }}
                        type="button"
                      >
                        {t("actionEnable")}
                      </button>
                    ) : null}
                    {detail.status !== "archived" ? (
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => { setFormErrors({}); setReason(""); setConfirm("archive"); }}
                        type="button"
                      >
                        {t("actionArchive")}
                      </button>
                    ) : null}
                    {detail.status === "archived" ? (
                      <button
                        className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        onClick={() => { setFormErrors({}); setReason(""); setConfirm("delete"); }}
                        type="button"
                      >
                        {t("actionDelete")}
                      </button>
                    ) : null}
                  </>
                ) : null}
                <button
                  className="ml-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setSelectedId(null);
                    setEditing(false);
                  }}
                  type="button"
                >
                  {t("close")}
                </button>
              </div>

              {editing ? (
                <BotForm
                  errors={formErrors}
                  form={form}
                  reason={reason}
                  setForm={setForm}
                  setReason={setReason}
                  submitLabel={t("editSubmit")}
                  t={t}
                  onCancel={() => {
                    setEditing(false);
                    setFormErrors({});
                  }}
                  onClearFieldError={(f) => setFormErrors((p) => { const n = { ...p }; delete n[f]; return n; })}
                  onSubmit={() => void doPatch()}
                  mutating={mutating}
                />
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs">
                  <dt className="text-slate-500">{t("colName")}</dt>
                  <dd>{detail.name}</dd>
                  <dt className="text-slate-500">{t("colBotKey")}</dt>
                  <dd className="font-mono">{detail.botKey}</dd>
                  <dt className="text-slate-500">{t("colDifficulty")}</dt>
                  <dd>{t(`difficulty_${detail.difficulty}`) || detail.difficulty}</dd>
                  <dt className="text-slate-500">{t("colAccuracy")}</dt>
                  <dd>{detail.accuracyPct}%</dd>
                  <dt className="text-slate-500">{t("colDelay")}</dt>
                  <dd>
                    {detail.minDelayMs}–{detail.maxDelayMs} ms
                  </dd>
                  <dt className="text-slate-500">{t("colVocab")}</dt>
                  <dd>{detail.vocabularyLevel}</dd>
                  <dt className="text-slate-500">{t("formAvatar")}</dt>
                  <dd>{detail.avatarFallback}</dd>
                  <dt className="text-slate-500">{t("formStyleToken")}</dt>
                  <dd>{detail.styleToken}</dd>
                  <dt className="text-slate-500">{t("formRiveSrc")}</dt>
                  <dd className="break-all">{detail.riveSrc ?? "—"}</dd>
                  <dt className="text-slate-500">{t("formRiveArtboard")}</dt>
                  <dd>{detail.riveArtboard}</dd>
                  <dt className="text-slate-500">{t("formRiveStateMachine")}</dt>
                  <dd>{detail.riveStateMachine}</dd>
                  <dt className="text-slate-500">{t("formRiveLicense")}</dt>
                  <dd>{detail.riveLicense ?? "—"}</dd>
                  <dt className="text-slate-500">{t("formPersona")}</dt>
                  <dd className="whitespace-pre-wrap">{detail.persona ?? "—"}</dd>
                </dl>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("detailAudit")}
                </h3>
                {detail.audit.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("detailAuditEmpty")}</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {detail.audit.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1"
                      >
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatWhen(a.createdAt, locale)}
                        </span>{" "}
                        <span className="font-semibold text-slate-700">{a.action}</span>{" "}
                        <span className="text-slate-500">
                          {a.actor?.displayName ?? a.actor?.email ?? "—"}
                        </span>
                        {a.reason ? <p className="text-slate-600">{a.reason}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </AdminSection>
      ) : null}

      {creating ? (
        <AdminSection description={t("createSubtitle")} title={t("createHeading")}>
          <BotForm
            errors={formErrors}
            form={form}
            reason={reason}
            setForm={setForm}
            setReason={setReason}
            submitLabel={t("createSubmit")}
            t={t}
            onCancel={() => {
              setCreating(false);
              setFormErrors({});
            }}
            onClearFieldError={(f) => setFormErrors((p) => { const n = { ...p }; delete n[f]; return n; })}
            onSubmit={() => void doCreate()}
            mutating={mutating}
          />
        </AdminSection>
      ) : null}

      {confirm && detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold">{t(`confirm_${confirm}_title`)}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {t(`confirm_${confirm}_message`).replace("{name}", detail.name)}
            </p>
            <label className="mt-3 block text-sm">
              <span className="block text-xs font-medium text-slate-600">{t("reasonLabel")} <span className="text-red-500">*</span></span>
              <textarea
                className={cn("mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm", formErrors.reason ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-200")}
                onChange={(e) => { setReason(e.target.value); setFormErrors((p) => { const n = { ...p }; delete n.reason; return n; }); }}
                placeholder={t("reasonPlaceholder")}
                rows={3}
                value={reason}
              />
              {formErrors.reason ? <span className="mt-1 block text-xs text-red-600">{formErrors.reason}</span> : <span className="mt-1 block text-[10px] text-slate-400">{t("reasonHint")}</span>}
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setConfirm(null);
                  setReason("");
                  setFormErrors({});
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm",
                  confirm === "delete"
                    ? "bg-rose-600 hover:bg-rose-500"
                    : confirm === "disable" || confirm === "archive"
                      ? "bg-amber-600 hover:bg-amber-500"
                      : "bg-emerald-600 hover:bg-emerald-500",
                  mutating && "opacity-60"
                )}
                disabled={mutating}
                onClick={() => doLifecycle(confirm)}
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

function BotForm({
  errors,
  form,
  mutating,
  onCancel,
  onClearFieldError,
  onSubmit,
  reason,
  setForm,
  setReason,
  submitLabel,
  t
}: {
  errors: Record<string, string>;
  form: FormState;
  mutating: boolean;
  onCancel: () => void;
  onClearFieldError?: (f: string) => void;
  onSubmit: () => void;
  reason: string;
  setForm: (f: FormState) => void;
  setReason: (r: string) => void;
  submitLabel: string;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-end">
        <AdminAutoFill
          formType="battle-bot"
          onFill={(fields) => {
            const f = fields as Partial<FormState>;
            setForm({
              ...form,
              ...(f.botKey !== undefined && { botKey: String(f.botKey) }),
              ...(f.name !== undefined && { name: String(f.name) }),
              ...(f.difficulty !== undefined && { difficulty: f.difficulty as FormState["difficulty"] }),
              ...(f.persona !== undefined && { persona: String(f.persona) }),
              ...(f.accuracyPct !== undefined && { accuracyPct: Number(f.accuracyPct) }),
              ...(f.minDelayMs !== undefined && { minDelayMs: Number(f.minDelayMs) }),
              ...(f.maxDelayMs !== undefined && { maxDelayMs: Number(f.maxDelayMs) }),
              ...(f.avatarFallback !== undefined && { avatarFallback: String(f.avatarFallback) }),
              ...(f.styleToken !== undefined && { styleToken: f.styleToken as FormState["styleToken"] }),
              ...(f.vocabularyLevel !== undefined && { vocabularyLevel: String(f.vocabularyLevel) }),
              ...(f.riveSrc !== undefined && { riveSrc: String(f.riveSrc) }),
              ...(f.riveArtboard !== undefined && { riveArtboard: String(f.riveArtboard) }),
              ...(f.riveStateMachine !== undefined && { riveStateMachine: String(f.riveStateMachine) }),
              ...(f.riveLicense !== undefined && { riveLicense: String(f.riveLicense) }),
              ...(f.riveProvenanceJson !== undefined && { riveProvenanceJson: String(f.riveProvenanceJson) }),
            });
          }}
          labels={{ button: t("autoFill") || "Auto Fill" }}
          disabled={mutating}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formBotKey")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
            onChange={(e) => setForm({ ...form, botKey: e.target.value })}
            value={form.botKey}
          />
          {errors.botKey ? (
            <span className="text-[10px] text-rose-600">{errors.botKey}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formName")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            value={form.name}
          />
          {errors.name ? <span className="text-[10px] text-rose-600">{errors.name}</span> : null}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formDifficulty")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) =>
              setForm({ ...form, difficulty: e.target.value as FormState["difficulty"] })
            }
            value={form.difficulty}
          >
            {BATTLE_BOT_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t(`difficulty_${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formAccuracy")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            max={100}
            min={0}
            onChange={(e) => setForm({ ...form, accuracyPct: Number(e.target.value) })}
            type="number"
            value={form.accuracyPct}
          />
          {errors.accuracyPct ? (
            <span className="text-[10px] text-rose-600">{errors.accuracyPct}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formVocab")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, vocabularyLevel: e.target.value })}
            value={form.vocabularyLevel}
          >
            {BATTLE_BOT_VOCAB_LEVELS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formAvatar")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            maxLength={12}
            onChange={(e) => setForm({ ...form, avatarFallback: e.target.value })}
            value={form.avatarFallback}
          />
          {errors.avatarFallback ? (
            <span className="text-[10px] text-rose-600">{errors.avatarFallback}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formStyleToken")}</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) =>
              setForm({ ...form, styleToken: e.target.value as FormState["styleToken"] })
            }
            value={form.styleToken}
          >
            {BATTLE_BOT_STYLE_TOKENS.map((token) => (
              <option key={token} value={token}>
                {t(`style_${token}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formMinDelay")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            min={0}
            onChange={(e) => setForm({ ...form, minDelayMs: Number(e.target.value) })}
            type="number"
            value={form.minDelayMs}
          />
          {errors.minDelayMs ? (
            <span className="text-[10px] text-rose-600">{errors.minDelayMs}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formMaxDelay")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            min={0}
            onChange={(e) => setForm({ ...form, maxDelayMs: Number(e.target.value) })}
            type="number"
            value={form.maxDelayMs}
          />
          {errors.maxDelayMs ? (
            <span className="text-[10px] text-rose-600">{errors.maxDelayMs}</span>
          ) : null}
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-slate-600">{t("formRiveSrc")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, riveSrc: e.target.value })}
            placeholder="/assets/battle/bots/sakura.riv"
            value={form.riveSrc}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("formRiveArtboard")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, riveArtboard: e.target.value })}
            value={form.riveArtboard}
          />
          {errors.riveArtboard ? (
            <span className="text-[10px] text-rose-600">{errors.riveArtboard}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            {t("formRiveStateMachine")}
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, riveStateMachine: e.target.value })}
            value={form.riveStateMachine}
          />
          {errors.riveStateMachine ? (
            <span className="text-[10px] text-rose-600">{errors.riveStateMachine}</span>
          ) : null}
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-slate-600">{t("formRiveLicense")}</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, riveLicense: e.target.value })}
            value={form.riveLicense}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-slate-600">
            {t("formRiveProvenance")}
          </span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
            onChange={(e) => setForm({ ...form, riveProvenanceJson: e.target.value })}
            rows={4}
            value={form.riveProvenanceJson}
          />
          {errors.riveProvenanceJson ? (
            <span className="text-[10px] text-rose-600">{errors.riveProvenanceJson}</span>
          ) : null}
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">{t("formPersona")}</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          onChange={(e) => setForm({ ...form, persona: e.target.value })}
          rows={3}
          value={form.persona}
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">{t("reasonLabel")} <span className="text-red-500">*</span></span>
        <textarea
          className={cn("mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm", errors.reason ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-200")}
          onChange={(e) => { setReason(e.target.value); onClearFieldError?.("reason"); }}
          placeholder={t("reasonPlaceholder")}
          rows={2}
          value={reason}
        />
        {errors.reason ? <span className="mt-1 block text-xs text-red-600">{errors.reason}</span> : <span className="mt-1 block text-[10px] text-slate-400">{t("reasonHint")}</span>}
      </label>
      <div className="flex justify-end gap-2">
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
          type="button"
        >
          {t("cancel")}
        </button>
        <button
          className={cn(
            "rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500",
            mutating && "opacity-60"
          )}
          disabled={mutating}
          onClick={onSubmit}
          type="button"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
