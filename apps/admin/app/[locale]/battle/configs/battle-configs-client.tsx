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
  BATTLE_CONFIG_BOT_DIFFICULTIES,
  BATTLE_CONFIG_LEVELS,
  BATTLE_CONFIG_QUESTION_POOLS
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type BattleConfigSummary = {
  id: string;
  name: string;
  level: string;
  status: "draft" | "published" | "archived";
  questionCount: number;
  timePerQuestionSec: number;
  maxParticipants: number;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: BattleConfigSummary[];
  total: number;
  page: number;
  pageSize: number;
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

type ScoringRules = Record<string, unknown> & {
  correctPoints?: number;
  wrongPenalty?: number;
  speedBonusPerSec?: number;
  streakMultiplier?: number;
};

type BattleConfigDetail = BattleConfigSummary & {
  description: string | null;
  questionPoolKey: string;
  botDifficulties: string[];
  scoringRules: ScoringRules;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  audit: AuditEntry[];
};

type StatusFilter = "all" | "draft" | "published" | "archived";
type SortKey = "name" | "level" | "status" | "questionCount" | "timePerQuestionSec" | "updatedAt";

const PAGE_SIZE = 25;

type FormState = {
  name: string;
  description: string;
  level: string;
  questionPoolKey: string;
  questionCount: number;
  timePerQuestionSec: number;
  maxParticipants: number;
  botDifficulties: string[];
  correctPoints: string;
  wrongPenalty: string;
  speedBonusPerSec: string;
  streakMultiplier: string;
  scheduleStart: string;
  scheduleEnd: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  level: BATTLE_CONFIG_LEVELS[2] ?? "jlpt_n3",
  questionPoolKey: BATTLE_CONFIG_QUESTION_POOLS[0] ?? "bjt_questions_active",
  questionCount: 10,
  timePerQuestionSec: 30,
  maxParticipants: 2,
  botDifficulties: ["medium"],
  correctPoints: "10",
  wrongPenalty: "0",
  speedBonusPerSec: "0",
  streakMultiplier: "1",
  scheduleStart: "",
  scheduleEnd: ""
};

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "published") return "good";
  if (status === "archived") return "neutral";
  if (status === "draft") return "warning";
  return "neutral";
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatWhen(iso: string, locale: string): string {
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

function buildScoringRules(form: FormState): ScoringRules {
  const out: ScoringRules = {};
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const cp = num(form.correctPoints);
  const wp = num(form.wrongPenalty);
  const sb = num(form.speedBonusPerSec);
  const sm = num(form.streakMultiplier);
  if (cp !== undefined && Number.isFinite(cp)) out.correctPoints = cp;
  if (wp !== undefined && Number.isFinite(wp)) out.wrongPenalty = wp;
  if (sb !== undefined && Number.isFinite(sb)) out.speedBonusPerSec = sb;
  if (sm !== undefined && Number.isFinite(sm)) out.streakMultiplier = sm;
  return out;
}

function detailToForm(detail: BattleConfigDetail): FormState {
  const scoring = (detail.scoringRules ?? {}) as ScoringRules;
  const toIso = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16) : "");
  return {
    name: detail.name,
    description: detail.description ?? "",
    level: detail.level,
    questionPoolKey: detail.questionPoolKey,
    questionCount: detail.questionCount,
    timePerQuestionSec: detail.timePerQuestionSec,
    maxParticipants: detail.maxParticipants,
    botDifficulties: detail.botDifficulties,
    correctPoints: scoring.correctPoints != null ? String(scoring.correctPoints) : "",
    wrongPenalty: scoring.wrongPenalty != null ? String(scoring.wrongPenalty) : "",
    speedBonusPerSec: scoring.speedBonusPerSec != null ? String(scoring.speedBonusPerSec) : "",
    streakMultiplier: scoring.streakMultiplier != null ? String(scoring.streakMultiplier) : "",
    scheduleStart: toIso(detail.scheduleStart),
    scheduleEnd: toIso(detail.scheduleEnd)
  };
}

export function BattleConfigsClient({
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
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BattleConfigDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "publish" | "archive" | "duplicate" | "delete" }
    | null
  >(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, levelFilter]);

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
      if (levelFilter !== "all") params.set("level", levelFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/battle/configs?${params.toString()}`);
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
  }, [debouncedSearch, statusFilter, levelFilter, page, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const r = await adminApiFetch(`/api/admin/battle/configs/${encodeURIComponent(id)}`);
      if (!r.ok) {
        setDetail(null);
        setDetailError(t("errorDetail"));
        return;
      }
      setDetail((await r.json()) as BattleConfigDetail);
    } catch {
      setDetail(null);
      setDetailError(t("errorDetail"));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setEditing(false);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const sortedItems = useMemo(() => {
    if (!list) return [];
    return list.items.slice().sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "level") cmp = a.level.localeCompare(b.level);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "questionCount") cmp = a.questionCount - b.questionCount;
      else if (sortKey === "timePerQuestionSec") cmp = a.timePerQuestionSec - b.timePerQuestionSec;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortAsc ? cmp : -cmp;
    });
  }, [list, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "level" || key === "status");
    }
  };

  const exportCsv = () => {
    if (!list) return;
    downloadCsv(
      `battle-configs-page-${list.page}.csv`,
      [
        t("colName"),
        t("colLevel"),
        t("colStatus"),
        t("colQuestionCount"),
        t("colTimePerQuestion"),
        t("colMaxParticipants"),
        t("colPublishedAt"),
        t("colUpdated")
      ],
      list.items.map((row) => [
        row.name,
        row.level,
        row.status,
        String(row.questionCount),
        String(row.timePerQuestionSec),
        String(row.maxParticipants),
        row.publishedAt ?? "",
        row.updatedAt
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

  const validateForm = (state: FormState): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (state.name.trim().length < 2) errs.name = t("formErrName");
    if (state.questionCount < 5 || state.questionCount > 30) errs.questionCount = t("formErrQuestionCount");
    if (state.timePerQuestionSec < 10 || state.timePerQuestionSec > 120)
      errs.timePerQuestionSec = t("formErrTime");
    if (state.maxParticipants < 2 || state.maxParticipants > 8)
      errs.maxParticipants = t("formErrParticipants");
    if (state.botDifficulties.length === 0) errs.botDifficulties = t("formErrBotDifficulties");
    if (state.scheduleStart && state.scheduleEnd && new Date(state.scheduleEnd) <= new Date(state.scheduleStart))
      errs.scheduleEnd = t("formErrScheduleEnd");
    return errs;
  };

  const buildBody = (state: FormState, withReason: string) => ({
    botDifficulties: state.botDifficulties,
    description: state.description.trim() || undefined,
    level: state.level,
    maxParticipants: state.maxParticipants,
    name: state.name.trim(),
    questionCount: state.questionCount,
    questionPoolKey: state.questionPoolKey,
    reason: withReason,
    scheduleEnd: state.scheduleEnd ? new Date(state.scheduleEnd).toISOString() : null,
    scheduleStart: state.scheduleStart ? new Date(state.scheduleStart).toISOString() : null,
    scoringRules: buildScoringRules(state),
    timePerQuestionSec: state.timePerQuestionSec
  });

  const doCreate = async () => {
    if (!canManage) return;
    const r = requireReason();
    if (!r) return;
    const errs = validateForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      setToast({ kind: "err", text: t("errorValidation") });
      return;
    }
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/battle/configs`, {
        body: JSON.stringify(buildBody(form, r)),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!res.ok) {
        setToast({ kind: "err", text: t("errorMutation") });
        return;
      }
      const created = (await res.json()) as BattleConfigDetail;
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
    const r = requireReason();
    if (!r) return;
    const errs = validateForm(form);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      setToast({ kind: "err", text: t("errorValidation") });
      return;
    }
    setMutating(true);
    setToast(null);
    try {
      const res = await adminApiFetch(`/api/admin/battle/configs/${encodeURIComponent(detail.id)}`, {
        body: JSON.stringify(buildBody(form, r)),
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

  const doLifecycle = async (kind: "publish" | "archive" | "duplicate" | "delete") => {
    if (!canManage || !detail) return;
    const r = requireReason();
    if (!r) return;
    setMutating(true);
    setToast(null);
    try {
      const path =
        kind === "delete"
          ? `/api/admin/battle/configs/${encodeURIComponent(detail.id)}`
          : `/api/admin/battle/configs/${encodeURIComponent(detail.id)}/${kind}`;
      const res = await adminApiFetch(path, {
        body: JSON.stringify({ reason: r }),
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
      } else if (kind === "duplicate") {
        const created = (await res.json()) as BattleConfigDetail;
        setSelectedId(created.id);
        setToast({ kind: "ok", text: t("successDuplicate") });
      } else {
        setToast({ kind: "ok", text: t(kind === "publish" ? "successPublish" : "successArchive") });
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

  const startEdit = () => {
    if (!detail) return;
    setForm(detailToForm(detail));
    setFormErrors({});
    setEditing(true);
  };

  const startCreate = () => {
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setSelectedId(null);
    setCreating(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormErrors({});
  };

  const cancelCreate = () => {
    setCreating(false);
    setFormErrors({});
  };

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
          <label className="block min-w-[160px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterStatus")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">{t("filterStatusAll")}</option>
              <option value="draft">{t("statusDraft")}</option>
              <option value="published">{t("statusPublished")}</option>
              <option value="archived">{t("statusArchived")}</option>
            </select>
          </label>
          <label className="block min-w-[160px] text-sm">
            <span className="block text-xs font-medium text-slate-600">{t("filterLevel")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              onChange={(e) => setLevelFilter(e.target.value)}
              value={levelFilter}
            >
              <option value="all">{t("filterLevelAll")}</option>
              {BATTLE_CONFIG_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-1">
            <span className="block text-xs font-medium text-slate-600 pb-2">{t("sortLabel")}:</span>
            {(["name", "level", "status", "questionCount", "timePerQuestionSec", "updatedAt"] as SortKey[]).map((k) => (
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
                {t(`sortBy_${k}`) || k}
                {sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-end gap-2">
            {canManage ? (
              <button
                className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                onClick={startCreate}
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
        ) : sortedItems.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("emptyHint")}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLevel")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colQuestionCount")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTimePerQuestion")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colMaxParticipants")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {sortedItems.map((row) => (
                  <AdminDataTableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer hover:bg-indigo-50/40",
                      row.id === selectedId ? "bg-indigo-50" : undefined
                    )}
                  >
                    <AdminDataTableTd>
                      <button
                        className="text-left text-xs font-semibold text-indigo-700 hover:underline"
                        onClick={() => {
                          setCreating(false);
                          setSelectedId(row.id);
                        }}
                        type="button"
                      >
                        {row.name}
                      </button>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800">
                        {row.level}
                      </code>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>{t(`status_${row.status}`) || row.status}</AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.questionCount}</AdminDataTableTd>
                    <AdminDataTableTd>{row.timePerQuestionSec}s</AdminDataTableTd>
                    <AdminDataTableTd>{row.maxParticipants}</AdminDataTableTd>
                    <AdminDataTableTd>{formatDate(row.updatedAt, locale)}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")} {list?.page ?? 1} / {totalPages} · {total} {common.records.toLowerCase()}
              </span>
              <div className="flex gap-1">
                <button
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold disabled:opacity-50"
                  disabled={page <= 1 || listLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  type="button"
                >
                  {t("prevPage")}
                </button>
                <button
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold disabled:opacity-50"
                  disabled={page >= totalPages || listLoading}
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

      {creating ? (
        <AdminSection title={t("createHeading")} description={t("createSubtitle")}>
          <ConfigForm
            form={form}
            errors={formErrors}
            onChange={setForm}
            t={t}
          />
          <ReasonInput reason={reason} setReason={setReason} t={t} />
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={cancelCreate}
              type="button"
            >
              {t("cancel")}
            </button>
            <button
              className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              disabled={mutating || reason.trim().length < 3}
              onClick={doCreate}
              type="button"
            >
              {t("createSubmit")}
            </button>
          </div>
        </AdminSection>
      ) : null}

      {selectedId ? (
        <AdminSection
          description={detail?.description ?? undefined}
          title={`${t("detailHeading")} — ${detail?.name ?? selectedId.slice(0, 8)}`}
        >
          {detailLoading ? (
            <p className="text-sm text-slate-600">{common.loading}</p>
          ) : detailError || !detail ? (
            <p className="text-sm text-rose-700">{detailError ?? common.error}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  <AdminStatusBadge tone={statusTone(detail.status)}>
                    {t(`status_${detail.status}`) || detail.status}
                  </AdminStatusBadge>
                  <span>
                    {t("colLevel")}: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">{detail.level}</code>
                  </span>
                  <span>
                    {t("colQuestionCount")}: {detail.questionCount}
                  </span>
                  <span>
                    {t("colTimePerQuestion")}: {detail.timePerQuestionSec}s
                  </span>
                  <span>
                    {t("colMaxParticipants")}: {detail.maxParticipants}
                  </span>
                  <span>
                    {t("colPublishedAt")}: {formatDate(detail.publishedAt, locale)}
                  </span>
                  <span>
                    {t("colUpdated")}: {formatDate(detail.updatedAt, locale)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && !editing ? (
                    <>
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={startEdit}
                        type="button"
                      >
                        {t("actionEdit")}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setConfirm({ kind: "duplicate" })}
                        type="button"
                      >
                        {t("actionDuplicate")}
                      </button>
                      {detail.status === "draft" ? (
                        <button
                          className="rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                          onClick={() => setConfirm({ kind: "publish" })}
                          type="button"
                        >
                          {t("actionPublish")}
                        </button>
                      ) : null}
                      {detail.status !== "archived" ? (
                        <button
                          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                          onClick={() => setConfirm({ kind: "archive" })}
                          type="button"
                        >
                          {t("actionArchive")}
                        </button>
                      ) : null}
                      {detail.status === "draft" ? (
                        <button
                          className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          onClick={() => setConfirm({ kind: "delete" })}
                          type="button"
                        >
                          {t("actionDelete")}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setSelectedId(null)}
                    type="button"
                  >
                    {t("close")}
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-800">{t("editHeading")}</h4>
                  <ConfigForm form={form} errors={formErrors} onChange={setForm} t={t} />
                  <ReasonInput reason={reason} setReason={setReason} t={t} />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={cancelEdit}
                      type="button"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      disabled={mutating || reason.trim().length < 3}
                      onClick={doPatch}
                      type="button"
                    >
                      {t("editSubmit")}
                    </button>
                  </div>
                </div>
              ) : (
                <DetailReadOnly detail={detail} t={t} />
              )}

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("detailAudit")}</h4>
                {detail.audit.length === 0 ? (
                  <p className="text-xs text-slate-600">{t("detailAuditEmpty")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.audit.map((entry) => (
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
      ) : !creating ? (
        <AdminSection title={t("detailHeading")}>
          <p className="text-sm text-slate-600">{t("detailSelectHint")}</p>
        </AdminSection>
      ) : null}

      {confirm && detail ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{t(`confirm_${confirm.kind}_title`)}</h3>
            <p className="mt-2 text-sm text-slate-700">
              {(t(`confirm_${confirm.kind}_message`) || "").replace("{name}", detail.name)}
            </p>
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-700">
                {t("reasonLabel")}
                <textarea
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm"
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("reasonPlaceholder")}
                  rows={2}
                  value={reason}
                />
              </label>
              <p className="mt-1 text-[11px] text-slate-500">{t("reasonHint")}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setConfirm(null)}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-md border border-indigo-500 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                disabled={mutating || reason.trim().length < 3}
                onClick={() => void doLifecycle(confirm.kind)}
                type="button"
              >
                {t("confirmSubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReasonInput({
  reason,
  setReason,
  t
}: {
  reason: string;
  setReason: (v: string) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs font-medium text-slate-700">
        {t("reasonLabel")}
        <textarea
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          rows={2}
          value={reason}
        />
      </label>
      <p className="mt-1 text-[11px] text-slate-500">{t("reasonHint")}</p>
    </div>
  );
}

function DetailReadOnly({
  detail,
  t
}: {
  detail: BattleConfigDetail;
  t: (k: string) => string;
}) {
  const scoring = detail.scoringRules ?? {};
  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("blockBasics")}</h5>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{t("colQuestionPool")}</dt>
            <dd>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{detail.questionPoolKey}</code>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{t("colBotDifficulties")}</dt>
            <dd className="flex flex-wrap gap-1">
              {detail.botDifficulties.map((d) => (
                <code key={d} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
                  {d}
                </code>
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{t("colScheduleStart")}</dt>
            <dd>{detail.scheduleStart ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{t("colScheduleEnd")}</dt>
            <dd>{detail.scheduleEnd ?? "—"}</dd>
          </div>
        </dl>
      </div>
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("blockScoring")}</h5>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">correctPoints</dt>
            <dd>{scoring.correctPoints ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">wrongPenalty</dt>
            <dd>{scoring.wrongPenalty ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">speedBonusPerSec</dt>
            <dd>{scoring.speedBonusPerSec ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">streakMultiplier</dt>
            <dd>{scoring.streakMultiplier ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ConfigForm({
  form,
  errors,
  onChange,
  t
}: {
  form: FormState;
  errors: Record<string, string>;
  onChange: (next: FormState) => void;
  t: (k: string) => string;
}) {
  const upd = (patch: Partial<FormState>) => onChange({ ...form, ...patch });
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label={t("formName")} error={errors.name}>
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          maxLength={120}
          onChange={(e) => upd({ name: e.target.value })}
          value={form.name}
        />
      </Field>
      <Field label={t("formLevel")}>
        <select
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ level: e.target.value })}
          value={form.level}
        >
          {BATTLE_CONFIG_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("formDescription")} className="md:col-span-2">
        <textarea
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          maxLength={2000}
          onChange={(e) => upd({ description: e.target.value })}
          rows={2}
          value={form.description}
        />
      </Field>
      <Field label={t("formQuestionPool")}>
        <select
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ questionPoolKey: e.target.value })}
          value={form.questionPoolKey}
        >
          {BATTLE_CONFIG_QUESTION_POOLS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("formBotDifficulties")} error={errors.botDifficulties}>
        <div className="flex flex-wrap gap-2">
          {BATTLE_CONFIG_BOT_DIFFICULTIES.map((d) => {
            const checked = form.botDifficulties.includes(d);
            return (
              <label key={d} className="inline-flex items-center gap-1 text-xs">
                <input
                  checked={checked}
                  onChange={(e) =>
                    upd({
                      botDifficulties: e.target.checked
                        ? [...form.botDifficulties, d]
                        : form.botDifficulties.filter((x) => x !== d)
                    })
                  }
                  type="checkbox"
                />
                {d}
              </label>
            );
          })}
        </div>
      </Field>
      <Field label={t("formQuestionCount")} error={errors.questionCount}>
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          max={30}
          min={5}
          onChange={(e) => upd({ questionCount: Number(e.target.value) })}
          type="number"
          value={form.questionCount}
        />
      </Field>
      <Field label={t("formTimePerQuestion")} error={errors.timePerQuestionSec}>
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          max={120}
          min={10}
          onChange={(e) => upd({ timePerQuestionSec: Number(e.target.value) })}
          type="number"
          value={form.timePerQuestionSec}
        />
      </Field>
      <Field label={t("formMaxParticipants")} error={errors.maxParticipants}>
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          max={8}
          min={2}
          onChange={(e) => upd({ maxParticipants: Number(e.target.value) })}
          type="number"
          value={form.maxParticipants}
        />
      </Field>
      <Field label={t("formScheduleStart")}>
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ scheduleStart: e.target.value })}
          type="datetime-local"
          value={form.scheduleStart}
        />
      </Field>
      <Field label={t("formScheduleEnd")} error={errors.scheduleEnd}>
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ scheduleEnd: e.target.value })}
          type="datetime-local"
          value={form.scheduleEnd}
        />
      </Field>
      <Field label="correctPoints">
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ correctPoints: e.target.value })}
          placeholder="10"
          type="number"
          value={form.correctPoints}
        />
      </Field>
      <Field label="wrongPenalty">
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ wrongPenalty: e.target.value })}
          placeholder="0"
          type="number"
          value={form.wrongPenalty}
        />
      </Field>
      <Field label="speedBonusPerSec">
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onChange={(e) => upd({ speedBonusPerSec: e.target.value })}
          placeholder="0"
          step="0.1"
          type="number"
          value={form.speedBonusPerSec}
        />
      </Field>
      <Field label="streakMultiplier">
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          max={5}
          min={1}
          onChange={(e) => upd({ streakMultiplier: e.target.value })}
          placeholder="1"
          step="0.1"
          type="number"
          value={form.streakMultiplier}
        />
      </Field>
    </div>
  );
}

function Field({
  children,
  className,
  error,
  label
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  label: string;
}) {
  return (
    <label className={cn("block text-xs", className)}>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-[11px] text-rose-700">{error}</span> : null}
    </label>
  );
}
