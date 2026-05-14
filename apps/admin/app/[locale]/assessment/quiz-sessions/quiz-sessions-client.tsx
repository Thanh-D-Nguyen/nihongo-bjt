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
import { ASSESSMENT_QUIZ_SESSION_STATUSES } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { parseApiError, useFormErrors } from "@/lib/form-errors";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Summary = {
  id: string;
  userId: string;
  testId: string;
  status: string;
  currentQuestionNo: number | null;
  totalQuestions: number | null;
  correctCount: number | null;
  estimatedScore: number | null;
  estimatedBjtBand: string | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; slug: string; titleVi: string | null; type: string; level: string | null; timeLimitSeconds: number | null };
};

type AuditEntry = { id: string; action: string; createdAt: string; reason: string | null; actor: { id: string; displayName: string; email: string } | null };
type Answer = {
  id: string;
  questionId: string;
  selectedOptionKey: string | null;
  isCorrect: boolean | null;
  answeredAt: string;
  question: { id: string; prompt: string; skillTag: string; difficulty: string; sectionId: string; options: Array<{ optionKey: string; isCorrect: boolean; text: string }> };
};
type Detail = Summary & {
  answers: Answer[];
  audit: AuditEntry[];
  breakdown: { bySkill: Record<string, { correct: number; total: number }>; byDifficulty: Record<string, { correct: number; total: number }>; bySection: Record<string, { correct: number; total: number }> };
  expiresAt: string | null;
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  in_progress: "warning", completed: "good", abandoned: "neutral", expired: "danger"
};

function fmtWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try { return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)); }
  catch { return iso; }
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function QuizSessionsAdminClient({ common, labels, locale }: { common: CommonLabels; labels: Labels; locale: string }) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("assessment.manage");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState("");
  const [testFilter, setTestFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const [showAbort, setShowAbort] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendSeconds, setExtendSeconds] = useState(300);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

  useEffect(() => { const h = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(h); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, statusFilter, userFilter, testFilter, fromDate, toDate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (!r.ok) { if (!cancelled) setPerms(new Set()); return; }
        const body = (await r.json()) as MePayload;
        if (!cancelled) setPerms(permsFromMe(body));
      } catch { if (!cancelled) setPerms(new Set()); }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (userFilter.trim()) params.set("userId", userFilter.trim());
      if (testFilter.trim()) params.set("testId", testFilter.trim());
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) params.set("to", new Date(toDate).toISOString());
      params.set("page", String(page)); params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/assessment/quiz-sessions?${params.toString()}`);
      if (!r.ok) { setListError(common.error); setList(null); return; }
      setListError(null); setList((await r.json()) as ListResponse);
    } catch { setListError(common.error); }
  }, [debounced, statusFilter, userFilter, testFilter, fromDate, toDate, page, common.error]);
  useEffect(() => { void loadList(); }, [loadList]);

  useEffect(() => {
    if (!autoRefresh || statusFilter !== "in_progress") return;
    const h = setInterval(() => { void loadList(); }, 15000);
    return () => clearInterval(h);
  }, [autoRefresh, statusFilter, loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/assessment/quiz-sessions/${id}`);
    if (!r.ok) { setDetail(null); return; }
    setDetail((await r.json()) as Detail);
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  async function submitAbort() {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/assessment/quiz-sessions/${detail.id}/abort`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      if (!r.ok) { const parsed = await parseApiError(r, t("abortFailed")); toast.error(parsed.form || t("abortFailed")); return; }
      toast.success(t("abortOk")); setShowAbort(false); setReason("");
      void loadList(); void loadDetail(detail.id);
    } finally { setMutating(false); }
  }

  async function submitExtend() {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    if (extendSeconds < 30 || extendSeconds > 3600) { toast.error(t("extendOutOfRange")); return; }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/assessment/quiz-sessions/${detail.id}/extend-time`, { method: "POST", body: JSON.stringify({ addSeconds: extendSeconds, reason: reason.trim() }) });
      if (!r.ok) { const parsed = await parseApiError(r, t("extendFailed")); toast.error(parsed.form || t("extendFailed")); return; }
      toast.success(t("extendOk")); setShowExtend(false); setReason("");
      void loadList(); void loadDetail(detail.id);
    } finally { setMutating(false); }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id","userId","testId","testSlug","status","currentQ","totalQ","correct","estScore","band","startedAt","completedAt"];
    const rows = list.items.map((it) => [it.id, it.userId, it.testId, it.test.slug, it.status, String(it.currentQuestionNo ?? ""), String(it.totalQuestions ?? ""), String(it.correctCount ?? ""), String(it.estimatedScore ?? ""), it.estimatedBjtBand ?? "", it.startedAt, it.completedAt ?? ""]);
    downloadCsv(`assessment-quiz-sessions-${Date.now()}.csv`, header, rows);
  }

  const pageCount = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />
      {!canManage && perms != null ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("readOnlyBanner")}</div> : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterId")}</span><input className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs" placeholder="uuid…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterStatus")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_QUIZ_SESSION_STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterUser")}</span><input className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs" placeholder="user uuid" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} /></label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterTest")}</span><input className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs" placeholder="test uuid" value={testFilter} onChange={(e) => setTestFilter(e.target.value)} /></label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterFrom")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterTo")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} disabled={statusFilter !== "in_progress"} />{t("autoRefresh15s")}</label>
          <button className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={exportCsv} type="button">{t("exportCsv")}</button>
        </div>
      </AdminSection>

      <AdminSection>
        {listError ? <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
          : !list ? <AdminEmptyState title={common.loading}>{common.loading}</AdminEmptyState>
          : list.items.length === 0 ? <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
          : (
            <>
              <AdminDataTable>
                <AdminDataTableHead><AdminDataTableRow>
                  <AdminDataTableTh>{t("colId")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTest")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colProgress")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colScore")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colBand")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStarted")}</AdminDataTableTh>
                </AdminDataTableRow></AdminDataTableHead>
                <AdminDataTableBody>
                  {list.items.map((it) => (
                    <AdminDataTableRow className="cursor-pointer hover:bg-slate-50" key={it.id} onClick={() => setSelectedId(it.id)}>
                      <AdminDataTableTd className="font-mono text-xs">{it.id.slice(0, 8)}</AdminDataTableTd>
                      <AdminDataTableTd><div className="font-medium">{it.test.titleVi ?? it.test.slug}</div><div className="text-xs text-slate-500">{it.test.type} · {it.test.level ?? "—"}</div></AdminDataTableTd>
                      <AdminDataTableTd className="font-mono text-xs">{it.userId.slice(0, 8)}</AdminDataTableTd>
                      <AdminDataTableTd><AdminStatusBadge tone={STATUS_TONE[it.status] ?? "neutral"}>{t(`status_${it.status}`)}</AdminStatusBadge></AdminDataTableTd>
                      <AdminDataTableTd>{it.currentQuestionNo ?? 0}/{it.totalQuestions ?? 0}</AdminDataTableTd>
                      <AdminDataTableTd>{it.estimatedScore ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd>{it.estimatedBjtBand ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd className="text-xs text-slate-500">{fmtWhen(it.startedAt, locale)}</AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                <span>{common.records}: {list.total}</span>
                <div className="flex gap-2">
                  <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">‹</button>
                  <span>{page} / {pageCount}</span>
                  <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} type="button">›</button>
                </div>
              </div>
            </>
          )}
      </AdminSection>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30" onClick={() => setSelectedId(null)}>
          <div className="flex w-full max-w-3xl flex-col overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 font-mono">{detail.id}</div>
                <h2 className="text-lg font-semibold">{detail.test.titleVi ?? detail.test.slug}</h2>
              </div>
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setSelectedId(null)} type="button">{t("close")}</button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <AdminStatusBadge tone={STATUS_TONE[detail.status] ?? "neutral"}>{t(`status_${detail.status}`)}</AdminStatusBadge>
                <span className="text-slate-600">{detail.currentQuestionNo ?? 0}/{detail.totalQuestions ?? 0} q</span>
                <span className="text-slate-600">{detail.correctCount ?? 0} {t("correct")}</span>
                <span className="text-slate-600">{t("score")}: {detail.estimatedScore ?? "—"}</span>
                <span className="text-slate-600">{t("band")}: {detail.estimatedBjtBand ?? "—"}</span>
                {detail.expiresAt ? <span className="text-slate-600">{t("expiresAt")}: {fmtWhen(detail.expiresAt, locale)}</span> : null}
              </div>
              {canManage && detail.status === "in_progress" ? (
                <div className="flex flex-wrap gap-2">
                  <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); fe.clearFieldError("reason"); setShowAbort(true); }} type="button">{t("abort")}</button>
                  <button className="rounded bg-amber-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); fe.clearFieldError("reason"); setExtendSeconds(300); setShowExtend(true); }} type="button">{t("extendTime")}</button>
                </div>
              ) : null}
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("breakdownHeading")}</h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><div className="font-semibold">{t("bySkill")}</div>{Object.entries(detail.breakdown.bySkill).map(([k, v]) => <div key={k}>{k}: {v.correct}/{v.total}</div>)}</div>
                  <div><div className="font-semibold">{t("byDifficulty")}</div>{Object.entries(detail.breakdown.byDifficulty).map(([k, v]) => <div key={k}>{k}: {v.correct}/{v.total}</div>)}</div>
                  <div><div className="font-semibold">{t("bySection")}</div>{Object.entries(detail.breakdown.bySection).map(([k, v]) => <div key={k}>{k}: {v.correct}/{v.total}</div>)}</div>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("answersHeading")} ({detail.answers.length})</h3>
                <ul className="space-y-2">
                  {detail.answers.map((a, i) => (
                    <li className={cn("rounded border p-2 text-xs", a.isCorrect ? "border-emerald-200" : a.isCorrect === false ? "border-red-200" : "border-slate-200")} key={a.id}>
                      <div className="flex items-center justify-between"><span>Q{i + 1}: {a.question.skillTag} · {a.question.difficulty}</span><span className="text-slate-500">{fmtWhen(a.answeredAt, locale)}</span></div>
                      <div className="mt-1 line-clamp-2">{a.question.prompt}</div>
                      <div className="mt-1 text-slate-600">{t("selected")}: <span className="font-mono">{a.selectedOptionKey ?? "—"}</span> {a.isCorrect == null ? "" : a.isCorrect ? "✓" : "✗"}</div>
                    </li>
                  ))}
                  {detail.answers.length === 0 ? <li className="text-xs text-slate-500">{common.empty}</li> : null}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("auditHeading")}</h3>
                <ul className="space-y-2">
                  {detail.audit.map((a) => (
                    <li className="rounded border border-slate-200 p-3 text-xs" key={a.id}>
                      <div className="flex items-center justify-between"><span className="font-mono">{a.action}</span><span className="text-slate-500">{fmtWhen(a.createdAt, locale)}</span></div>
                      <div className="mt-1 text-slate-600">{a.actor?.displayName ?? a.actor?.email ?? "—"} · {a.reason ?? "—"}</div>
                    </li>
                  ))}
                  {detail.audit.length === 0 ? <li className="text-xs text-slate-500">{common.empty}</li> : null}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAbort ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">{t("abortHeading")}</h2>
            <p className="mb-3 text-sm text-slate-600">{t("abortBody")}</p>
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className={cn("rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} /></label>
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-4 flex justify-end gap-2"><button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowAbort(false); fe.clearFieldError("reason"); }} type="button">{t("cancel")}</button><button className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitAbort} type="button">{t("abortSubmit")}</button></div>
          </div>
        </div>
      ) : null}

      {showExtend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">{t("extendHeading")}</h2>
            <p className="mb-3 text-sm text-slate-600">{t("extendBody")}</p>
            <label className="mb-2 flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("extendSeconds")}</span><input type="number" min={30} max={3600} className="rounded border border-slate-300 px-3 py-2 text-sm" value={extendSeconds} onChange={(e) => setExtendSeconds(Number(e.target.value))} /></label>
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className={cn("rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} /></label>
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-4 flex justify-end gap-2"><button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowExtend(false); fe.clearFieldError("reason"); }} type="button">{t("cancel")}</button><button className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitExtend} type="button">{t("extendSubmit")}</button></div>
          </div>
        </div>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
