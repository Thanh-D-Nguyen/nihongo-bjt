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
  ASSESSMENT_BJT_LEVELS,
  ASSESSMENT_QUESTION_DIFFICULTIES,
  ASSESSMENT_QUESTION_STATUSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Option = { id: string; optionKey: string; text: string; isCorrect: boolean };

type Summary = {
  id: string;
  sectionId: string;
  prompt: string;
  scenario: string | null;
  skillTag: string;
  difficulty: string;
  tags: string[];
  status: string;
  remediationCardId: string | null;
  createdAt: string;
  updatedAt: string;
  section: { id: string; code: string; titleVi: string | null; test: { id: string; slug: string; titleVi: string | null; level: string | null; type: string } } | null;
  _count: { options: number; answers: number };
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

type Detail = Summary & {
  explanationVi: string | null;
  options: Option[];
  remediationCard: { id: string; sourceType: string; sourceId: string; frontText: string } | null;
  audit: AuditEntry[];
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  draft: "warning", published: "good", archived: "neutral", review: "warning"
};

function fmtWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch { return iso; }
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
function permsFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) for (const link of r.role?.permissions ?? []) {
    const c = link.permission?.code; if (c) out.add(c);
  }
  return out;
}

type BulkAction = "publish" | "archive" | "tag" | "untag";

export function QuestionBankAdminClient({ common, labels, locale }: { common: CommonLabels; labels: Labels; locale: string }) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("assessment.manage");
  const canReview = perms != null && (perms.has("assessment.review") || canManage);

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [showBulk, setShowBulk] = useState<BulkAction | null>(null);
  const [bulkTags, setBulkTags] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestField, setSuggestField] = useState<"prompt" | "explanationVi" | "tags" | "skillTag" | "difficulty">("prompt");
  const [suggestValue, setSuggestValue] = useState("");
  const [suggestRationale, setSuggestRationale] = useState("");
  const [showRemove, setShowRemove] = useState(false);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { const h = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(h); }, [search]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [debounced, statusFilter, levelFilter, difficultyFilter, topicFilter, tagFilter]);

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
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (difficultyFilter !== "all") params.set("difficulty", difficultyFilter);
      if (topicFilter.trim()) params.set("topic", topicFilter.trim());
      if (tagFilter.trim()) params.set("tags", tagFilter.trim());
      params.set("page", String(page)); params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/assessment/question-bank?${params.toString()}`);
      if (!r.ok) { setListError(common.error); setList(null); return; }
      setListError(null);
      setList((await r.json()) as ListResponse);
    } catch { setListError(common.error); }
  }, [debounced, statusFilter, levelFilter, difficultyFilter, topicFilter, tagFilter, page, common.error]);
  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/assessment/question-bank/${id}`);
    if (!r.ok) { setDetail(null); return; }
    setDetail((await r.json()) as Detail);
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submitBulk() {
    if (!canManage || !showBulk || selectedIds.size === 0) return;
    if (reason.trim().length < 3) { setToast({ kind: "err", text: t("reasonRequired") }); return; }
    if ((showBulk === "tag" || showBulk === "untag") && bulkTags.trim().length === 0) {
      setToast({ kind: "err", text: t("tagsRequired") }); return;
    }
    setMutating(true);
    try {
      const body: Record<string, unknown> = {
        action: showBulk,
        ids: Array.from(selectedIds),
        reason: reason.trim()
      };
      if (showBulk === "tag" || showBulk === "untag") {
        body.tags = bulkTags.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      }
      const r = await adminApiFetch("/api/admin/assessment/question-bank/bulk", {
        method: "POST", body: JSON.stringify(body)
      });
      if (!r.ok) { const err = await r.text(); setToast({ kind: "err", text: err || t("bulkFailed") }); return; }
      setToast({ kind: "ok", text: t("bulkOk") });
      setShowBulk(null); setReason(""); setBulkTags(""); setSelectedIds(new Set());
      void loadList();
    } finally { setMutating(false); }
  }

  async function submitSuggest() {
    if (!canReview || !detail) return;
    if (reason.trim().length < 3) { setToast({ kind: "err", text: t("reasonRequired") }); return; }
    if (suggestRationale.trim().length < 8) { setToast({ kind: "err", text: t("rationaleRequired") }); return; }
    setMutating(true);
    try {
      const proposed = suggestField === "tags"
        ? suggestValue.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
        : suggestValue;
      const r = await adminApiFetch(`/api/admin/assessment/question-bank/${detail.id}/suggest-edit`, {
        method: "POST",
        body: JSON.stringify({ field: suggestField, proposedValue: proposed, rationale: suggestRationale.trim(), reason: reason.trim() })
      });
      if (!r.ok) { const err = await r.text(); setToast({ kind: "err", text: err || t("suggestFailed") }); return; }
      setToast({ kind: "ok", text: t("suggestOk") });
      setShowSuggest(false); setReason(""); setSuggestRationale(""); setSuggestValue("");
      void loadDetail(detail.id);
    } finally { setMutating(false); }
  }

  async function submitRemove() {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) { setToast({ kind: "err", text: t("reasonRequired") }); return; }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/assessment/question-bank/${detail.id}`, {
        method: "DELETE", body: JSON.stringify({ reason: reason.trim() })
      });
      if (!r.ok) { const err = await r.text(); setToast({ kind: "err", text: err || t("removeFailed") }); return; }
      setToast({ kind: "ok", text: t("removeOk") });
      setShowRemove(false); setReason(""); setSelectedId(null);
      void loadList();
    } finally { setMutating(false); }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id","status","level","skillTag","difficulty","tags","prompt","sectionCode","testSlug","options","answers","updatedAt"];
    const rows = list.items.map((it) => [
      it.id, it.status, it.section?.test.level ?? "", it.skillTag, it.difficulty, it.tags.join("|"),
      it.prompt.slice(0, 200), it.section?.code ?? "", it.section?.test.slug ?? "",
      String(it._count.options), String(it._count.answers), it.updatedAt
    ]);
    downloadCsv(`assessment-questions-${Date.now()}.csv`, header, rows);
  }

  const pageCount = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />
      {!canManage && perms != null ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("readOnlyBanner")}</div> : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterSearch")}</span><input className="w-64 rounded border border-slate-300 px-3 py-2 text-sm" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterStatus")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_QUESTION_STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterLevel")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterDifficulty")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_QUESTION_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterTopic")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="vocab.verb" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} /></label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterTags")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="bjt,verb" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} /></label>
          <button className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={exportCsv} type="button">{t("exportCsv")}</button>
        </div>
      </AdminSection>

      {selectedIds.size > 0 ? (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded border border-slate-300 bg-slate-900 px-4 py-2 text-sm text-white">
          <span>{selectedIds.size} {t("selected")}</span>
          {canManage ? (
            <div className="flex gap-2">
              <button className="rounded bg-emerald-600 px-3 py-1 text-xs" onClick={() => { setReason(""); setShowBulk("publish"); }} type="button">{t("bulkPublish")}</button>
              <button className="rounded bg-slate-700 px-3 py-1 text-xs" onClick={() => { setReason(""); setShowBulk("archive"); }} type="button">{t("bulkArchive")}</button>
              <button className="rounded bg-slate-700 px-3 py-1 text-xs" onClick={() => { setReason(""); setBulkTags(""); setShowBulk("tag"); }} type="button">{t("bulkTag")}</button>
              <button className="rounded bg-slate-700 px-3 py-1 text-xs" onClick={() => { setReason(""); setBulkTags(""); setShowBulk("untag"); }} type="button">{t("bulkUntag")}</button>
              <button className="rounded border border-white/30 px-3 py-1 text-xs" onClick={() => setSelectedIds(new Set())} type="button">{t("clearSelection")}</button>
            </div>
          ) : null}
        </div>
      ) : null}

      <AdminSection>
        {listError ? <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
          : !list ? <AdminEmptyState title={common.loading}>{common.loading}</AdminEmptyState>
          : list.items.length === 0 ? <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
          : (
            <>
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh></AdminDataTableTh>
                    <AdminDataTableTh>{t("colPrompt")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colSkill")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colDifficulty")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colLevel")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colTags")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {list.items.map((it) => (
                    <AdminDataTableRow className="hover:bg-slate-50" key={it.id}>
                      <AdminDataTableTd><input type="checkbox" checked={selectedIds.has(it.id)} onChange={() => toggleRow(it.id)} /></AdminDataTableTd>
                      <AdminDataTableTd className="cursor-pointer" onClick={() => setSelectedId(it.id)}>
                        <div className="line-clamp-2 max-w-md text-sm">{it.prompt}</div>
                        <div className="text-xs text-slate-500">{it.section?.test.slug ?? "—"} · {it.section?.code ?? "—"}</div>
                      </AdminDataTableTd>
                      <AdminDataTableTd className="font-mono text-xs">{it.skillTag}</AdminDataTableTd>
                      <AdminDataTableTd>{it.difficulty}</AdminDataTableTd>
                      <AdminDataTableTd>{it.section?.test.level ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd><AdminStatusBadge tone={STATUS_TONE[it.status] ?? "neutral"}>{t(`status_${it.status}`)}</AdminStatusBadge></AdminDataTableTd>
                      <AdminDataTableTd className="text-xs">{it.tags.join(", ")}</AdminDataTableTd>
                      <AdminDataTableTd className="text-xs text-slate-500">{fmtWhen(it.updatedAt, locale)}</AdminDataTableTd>
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
                <div className="text-xs uppercase tracking-wide text-slate-500">{detail.section?.code ?? "—"} · {detail.section?.test.slug ?? "—"}</div>
                <h2 className="text-lg font-semibold">{detail.prompt.slice(0, 80)}…</h2>
              </div>
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setSelectedId(null)} type="button">{t("close")}</button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <AdminStatusBadge tone={STATUS_TONE[detail.status] ?? "neutral"}>{t(`status_${detail.status}`)}</AdminStatusBadge>
                <span className="text-slate-600">{detail.skillTag}</span>
                <span className="text-slate-600">{detail.difficulty}</span>
                <span className="text-slate-600">{detail.section?.test.level ?? "—"}</span>
              </div>
              {canReview ? (
                <div className="flex flex-wrap gap-2">
                  <button className="rounded bg-amber-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); setSuggestField("prompt"); setSuggestValue(detail.prompt); setSuggestRationale(""); setShowSuggest(true); }} type="button">{t("suggestEdit")}</button>
                  {canManage ? <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => { setReason(""); setShowRemove(true); }} type="button">{t("delete")}</button> : null}
                </div>
              ) : null}
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("promptHeading")}</h3>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap">{detail.prompt}</div>
                {detail.scenario ? <div className="mt-2 rounded border border-slate-200 p-3 text-xs italic text-slate-600 whitespace-pre-wrap">{detail.scenario}</div> : null}
                {detail.explanationVi ? <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs whitespace-pre-wrap">{detail.explanationVi}</div> : null}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("optionsHeading")}</h3>
                <ul className="space-y-1">
                  {detail.options.map((o) => (
                    <li className={cn("rounded border p-2 text-sm", o.isCorrect ? "border-emerald-300 bg-emerald-50" : "border-slate-200")} key={o.id}>
                      <span className="mr-2 font-mono font-bold">{o.optionKey}.</span>{o.text}
                      {o.isCorrect ? <span className="ml-2 text-xs text-emerald-700">✓</span> : null}
                    </li>
                  ))}
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

      {showBulk ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">{t(`bulkConfirm_${showBulk}`)}</h2>
            <p className="mb-3 text-sm text-slate-600">{selectedIds.size} {t("recordsAffected")}</p>
            {showBulk === "tag" || showBulk === "untag" ? (
              <label className="mb-2 flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formTags")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="bjt,verb" value={bulkTags} onChange={(e) => setBulkTags(e.target.value)} /></label>
            ) : null}
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowBulk(null)} type="button">{t("cancel")}</button>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitBulk} type="button">{t("submit")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showSuggest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">{t("suggestHeading")}</h2>
            <p className="mb-3 text-xs text-slate-600">{t("suggestNotice")}</p>
            <label className="mb-2 flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("suggestField")}</span>
              <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={suggestField} onChange={(e) => setSuggestField(e.target.value as typeof suggestField)}>
                <option value="prompt">prompt</option><option value="explanationVi">explanationVi</option><option value="tags">tags</option><option value="skillTag">skillTag</option><option value="difficulty">difficulty</option>
              </select>
            </label>
            <label className="mb-2 flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("suggestValue")}</span>
              <textarea className="rounded border border-slate-300 px-3 py-2 text-sm" rows={3} value={suggestValue} onChange={(e) => setSuggestValue(e.target.value)} />
            </label>
            <label className="mb-2 flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("suggestRationale")}</span><textarea className="rounded border border-slate-300 px-3 py-2 text-sm" rows={2} value={suggestRationale} onChange={(e) => setSuggestRationale(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowSuggest(false)} type="button">{t("cancel")}</button>
              <button className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitSuggest} type="button">{t("suggestSubmit")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">{t("removeHeading")}</h2>
            <p className="mb-3 text-sm text-slate-600">{t("removeBody")}</p>
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowRemove(false)} type="button">{t("cancel")}</button>
              <button className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitRemove} type="button">{t("removeSubmit")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={cn("fixed bottom-6 right-6 rounded px-4 py-2 text-sm shadow-lg", toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">×</button>
        </div>
      ) : null}
    </div>
  );
}
