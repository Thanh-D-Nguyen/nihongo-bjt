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
  FormError,
  cn,
  useAdminToast
} from "@nihongo-bjt/ui";
import {
  ASSESSMENT_BJT_LEVELS,
  ASSESSMENT_BJT_SECTION_LABELS,
  ASSESSMENT_QUESTION_DIFFICULTIES,
  ASSESSMENT_QUESTION_STATUSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import { AdminAutoFill } from "@/app/_components/admin-auto-fill";
import { useFormErrors, parseApiError, validateFields, validators } from "@/lib/form-errors";

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
  imageUrl: string | null;
  imageAlt: string | null;
  audioUrl: string | null;
  audioScript: string | null;
  qualityFlags: Record<string, unknown> | null;
  options: Option[];
  remediationCard: { id: string; sourceType: string; sourceId: string; frontText: string } | null;
  audit: AuditEntry[];
};

type SectionChoice = { id: string; code: string; titleVi: string | null; testSlug: string; testLevel: string | null };
type OptionInput = { optionKey: string; text: string; isCorrect: boolean };
type QuestionForm = {
  sectionId: string;
  prompt: string;
  scenario: string;
  explanationVi: string;
  skillTag: string;
  difficulty: string;
  tags: string;
  imageUrl: string;
  imageAlt: string;
  audioUrl: string;
  audioScript: string;
  options: OptionInput[];
};
const DEFAULT_OPTION_KEYS = ["A", "B", "C", "D"];
const DEFAULT_QUESTION_FORM: QuestionForm = {
  sectionId: "",
  prompt: "",
  scenario: "",
  explanationVi: "",
  skillTag: "",
  difficulty: "standard",
  tags: "",
  imageUrl: "",
  imageAlt: "",
  audioUrl: "",
  audioScript: "",
  options: DEFAULT_OPTION_KEYS.map((k, i) => ({ optionKey: k, text: "", isCorrect: i === 0 }))
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
  const [showForm, setShowForm] = useState<"create" | "edit" | null>(null);
  const [qForm, setQForm] = useState<QuestionForm>(DEFAULT_QUESTION_FORM);
  const [sections, setSections] = useState<SectionChoice[]>([]);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

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

  /* Load available sections from mock exams for the section picker */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/assessment/mock-exams?page=1&pageSize=50");
        if (!r.ok || cancelled) return;
        const body = (await r.json()) as { items: Array<{ id: string; slug: string; level: string | null; sections?: Array<{ id: string; code: string; titleVi: string | null }> }> };
        /* Fetch details for each exam to get sections */
        const allSections: SectionChoice[] = [];
        for (const exam of body.items) {
          const dr = await adminApiFetch(`/api/admin/assessment/mock-exams/${exam.id}`);
          if (dr.ok && !cancelled) {
            const d = (await dr.json()) as { sections: Array<{ id: string; code: string; titleVi: string | null }> };
            for (const s of d.sections) {
              allSections.push({ id: s.id, code: s.code, titleVi: s.titleVi, testSlug: exam.slug, testLevel: exam.level });
            }
          }
        }
        if (!cancelled) setSections(allSections);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, []);

  function openCreate() {
    setQForm(DEFAULT_QUESTION_FORM);
    setReason("");
    setShowForm("create");
  }
  function openEdit() {
    if (!detail) return;
    setQForm({
      sectionId: detail.sectionId,
      prompt: detail.prompt,
      scenario: detail.scenario ?? "",
      explanationVi: detail.explanationVi ?? "",
      skillTag: detail.skillTag,
      difficulty: detail.difficulty,
      tags: detail.tags.join(", "),
      imageUrl: detail.imageUrl ?? "",
      imageAlt: detail.imageAlt ?? "",
      audioUrl: detail.audioUrl ?? "",
      audioScript: detail.audioScript ?? "",
      options: detail.options.map((o) => ({ optionKey: o.optionKey, text: o.text, isCorrect: o.isCorrect }))
    });
    setReason("");
    setShowForm("edit");
  }

  async function submitQuestion() {
    if (!canManage) return;
    fe.clearAll();
    const correctCount = qForm.options.filter((o) => o.isCorrect).length;
    const emptyOption = qForm.options.some((o) => !o.text.trim());
    const errs = validateFields([
      { field: "sectionId", value: qForm.sectionId, message: t("sectionRequired"), validate: validators.required },
      { field: "prompt", value: qForm.prompt, message: t("promptRequired"), validate: validators.required },
      { field: "reason", value: reason, message: t("reasonRequired"), validate: validators.minLength(3) },
    ]);
    if (correctCount !== 1) errs.options = t("exactlyOneCorrect");
    if (emptyOption) errs.options = t("optionTextRequired");
    if (Object.keys(errs).length > 0) { fe.setFieldErrors(errs); return; }
    setMutating(true);
    try {
      const body: Record<string, unknown> = {
        sectionId: qForm.sectionId,
        prompt: qForm.prompt.trim(),
        scenario: qForm.scenario.trim() || null,
        explanationVi: qForm.explanationVi.trim(),
        skillTag: qForm.skillTag.trim() || "general",
        difficulty: qForm.difficulty,
        tags: qForm.tags.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
        imageUrl: qForm.imageUrl.trim() || null,
        imageAlt: qForm.imageAlt.trim() || null,
        audioUrl: qForm.audioUrl.trim() || null,
        audioScript: qForm.audioScript.trim() || null,
        options: qForm.options.map((o) => ({ optionKey: o.optionKey, text: o.text.trim(), isCorrect: o.isCorrect })),
        reason: reason.trim()
      };
      const url = showForm === "create" ? "/api/admin/assessment/question-bank" : `/api/admin/assessment/question-bank/${detail?.id}`;
      const method = showForm === "create" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("saveFailed"));
        fe.setFieldErrors(parsed.fields);
        if (parsed.form) fe.setFormError(parsed.form);
        else toast.error(t("saveFailed"));
        return;
      }
      const saved = (await r.json()) as { id: string };
      setShowForm(null);
      toast.success(t("saveOk"));
      void loadList();
      setSelectedId(saved.id);
    } finally { setMutating(false); }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submitBulk() {
    if (!canManage || !showBulk || selectedIds.size === 0) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    if ((showBulk === "tag" || showBulk === "untag") && bulkTags.trim().length === 0) {
      toast.error(t("tagsRequired")); return;
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
      if (!r.ok) { const parsed = await parseApiError(r, t("bulkFailed")); toast.error(parsed.form || t("bulkFailed")); return; }
      toast.success(t("bulkOk"));
      setShowBulk(null); setReason(""); setBulkTags(""); setSelectedIds(new Set());
      void loadList();
    } finally { setMutating(false); }
  }

  async function submitSuggest() {
    if (!canReview || !detail) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    if (suggestRationale.trim().length < 8) { fe.setFieldError("rationale", t("rationaleRequired")); return; }
    setMutating(true);
    try {
      const proposed = suggestField === "tags"
        ? suggestValue.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
        : suggestValue;
      const r = await adminApiFetch(`/api/admin/assessment/question-bank/${detail.id}/suggest-edit`, {
        method: "POST",
        body: JSON.stringify({ field: suggestField, proposedValue: proposed, rationale: suggestRationale.trim(), reason: reason.trim() })
      });
      if (!r.ok) { const parsed = await parseApiError(r, t("suggestFailed")); toast.error(parsed.form || t("suggestFailed")); return; }
      toast.success(t("suggestOk"));
      setShowSuggest(false); setReason(""); setSuggestRationale(""); setSuggestValue("");
      void loadDetail(detail.id);
    } finally { setMutating(false); }
  }

  async function submitRemove() {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/assessment/question-bank/${detail.id}`, {
        method: "DELETE", body: JSON.stringify({ reason: reason.trim() })
      });
      if (!r.ok) { const parsed = await parseApiError(r, t("removeFailed")); toast.error(parsed.form || t("removeFailed")); return; }
      toast.success(t("removeOk"));
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
          {canManage ? <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">{t("createQuestion")}</button> : null}
        </div>
      </AdminSection>

      {selectedIds.size > 0 ? (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded border border-slate-300 bg-slate-900 px-4 py-2 text-sm text-white">
          <span>{selectedIds.size} {t("selected")}</span>
          {canManage ? (
            <div className="flex gap-2">
              <button className="rounded bg-emerald-600 px-3 py-1 text-xs" onClick={() => { setReason(""); fe.clearFieldError("reason"); setShowBulk("publish"); }} type="button">{t("bulkPublish")}</button>
              <button className="rounded bg-slate-700 px-3 py-1 text-xs" onClick={() => { setReason(""); fe.clearFieldError("reason"); setShowBulk("archive"); }} type="button">{t("bulkArchive")}</button>
              <button className="rounded bg-slate-700 px-3 py-1 text-xs" onClick={() => { setReason(""); fe.clearFieldError("reason"); setBulkTags(""); setShowBulk("tag"); }} type="button">{t("bulkTag")}</button>
              <button className="rounded bg-slate-700 px-3 py-1 text-xs" onClick={() => { setReason(""); fe.clearFieldError("reason"); setBulkTags(""); setShowBulk("untag"); }} type="button">{t("bulkUntag")}</button>
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
              {detail.qualityFlags ? (() => {
                const qf = detail.qualityFlags;
                const bjtPart = qf.bjtPart as string | undefined;
                const bjtSection = qf.bjtSection as string | undefined;
                const businessSituation = qf.businessSituation as string | undefined;
                const stimulusKind = qf.stimulusKind as string | undefined;
                const hasAny = bjtPart || bjtSection || businessSituation || stimulusKind;
                return hasAny ? (
                  <div className="rounded border border-blue-100 bg-blue-50 p-3">
                    <h4 className="mb-1 text-xs font-semibold text-blue-800">{t("bjtMetadata")}</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-700">
                      {bjtPart ? <span><span className="font-medium">{t("bjtPart")}:</span> {bjtPart}</span> : null}
                      {bjtSection ? <span><span className="font-medium">{t("bjtSectionLabel")}:</span> {bjtSection} {ASSESSMENT_BJT_SECTION_LABELS[bjtSection] ? `(${ASSESSMENT_BJT_SECTION_LABELS[bjtSection]})` : ""}</span> : null}
                      {businessSituation ? <span><span className="font-medium">{t("businessSituation")}:</span> {businessSituation}</span> : null}
                      {stimulusKind ? <span><span className="font-medium">{t("stimulusKind")}:</span> {stimulusKind}</span> : null}
                    </div>
                  </div>
                ) : null;
              })() : null}
              {canReview ? (
                <div className="flex flex-wrap gap-2">
                  {canManage ? <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={openEdit} type="button">{t("editQuestion")}</button> : null}
                  <button className="rounded bg-amber-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); fe.clearFieldError("reason"); setSuggestField("prompt"); setSuggestValue(detail.prompt); setSuggestRationale(""); setShowSuggest(true); }} type="button">{t("suggestEdit")}</button>
                  {canManage ? <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => { setReason(""); fe.clearFieldError("reason"); setShowRemove(true); }} type="button">{t("delete")}</button> : null}
                </div>
              ) : null}
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("promptHeading")}</h3>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap">{detail.prompt}</div>
                {detail.scenario ? <div className="mt-2 rounded border border-slate-200 p-3 text-xs italic text-slate-600 whitespace-pre-wrap">{detail.scenario}</div> : null}
                {detail.explanationVi ? <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs whitespace-pre-wrap">{detail.explanationVi}</div> : null}
                {detail.imageUrl ? (
                  <div className="mt-2 rounded border border-slate-200 p-3">
                    <h4 className="mb-1 text-xs font-semibold text-slate-600">{t("imageHeading")}</h4>
                    <img src={detail.imageUrl} alt={detail.imageAlt ?? ""} className="max-h-48 rounded border border-slate-200" />
                    {detail.imageAlt ? <p className="mt-1 text-xs text-slate-500">{detail.imageAlt}</p> : null}
                  </div>
                ) : null}
                {detail.audioUrl ? (
                  <div className="mt-2 rounded border border-slate-200 p-3">
                    <h4 className="mb-1 text-xs font-semibold text-slate-600">{t("audioHeading")}</h4>
                    <audio controls src={detail.audioUrl} className="w-full" />
                  </div>
                ) : null}
                {detail.audioScript ? (
                  <div className="mt-2 rounded border border-violet-200 bg-violet-50 p-3 text-xs whitespace-pre-wrap">
                    <h4 className="mb-1 text-xs font-semibold text-violet-800">{t("audioScriptHeading")}</h4>
                    {detail.audioScript}
                  </div>
                ) : null}
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
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className={cn("rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} /></label>
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowBulk(null); fe.clearFieldError("reason"); }} type="button">{t("cancel")}</button>
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
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className={cn("rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} /></label>
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowSuggest(false); fe.clearFieldError("reason"); }} type="button">{t("cancel")}</button>
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
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className={cn("rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} /></label>
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowRemove(false); fe.clearFieldError("reason"); }} type="button">{t("cancel")}</button>
              <button className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitRemove} type="button">{t("removeSubmit")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">{showForm === "create" ? t("createHeading") : t("editHeading")}</h2>
            <div className="mb-3 flex items-center justify-between">
              <FormError message={fe.errors.form} className="flex-1" />
              <AdminAutoFill
                formType="question-bank"
                onFill={(fields) => {
                  const f = fields as Partial<QuestionForm>;
                  setQForm((prev) => ({
                    ...prev,
                    ...(f.sectionId !== undefined && { sectionId: String(f.sectionId) }),
                    ...(f.prompt !== undefined && { prompt: String(f.prompt) }),
                    ...(f.scenario !== undefined && { scenario: String(f.scenario) }),
                    ...(f.explanationVi !== undefined && { explanationVi: String(f.explanationVi) }),
                    ...(f.skillTag !== undefined && { skillTag: String(f.skillTag) }),
                    ...(f.difficulty !== undefined && { difficulty: String(f.difficulty) }),
                    ...(f.tags !== undefined && { tags: String(f.tags) }),
                    ...(f.imageUrl !== undefined && { imageUrl: String(f.imageUrl) }),
                    ...(f.imageAlt !== undefined && { imageAlt: String(f.imageAlt) }),
                    ...(f.audioUrl !== undefined && { audioUrl: String(f.audioUrl) }),
                    ...(f.audioScript !== undefined && { audioScript: String(f.audioScript) }),
                    ...(f.options !== undefined && Array.isArray(f.options) && { options: f.options }),
                  }));
                }}
                labels={{ button: t("autoFill") || "Auto Fill" }}
                disabled={mutating}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formSection")} <span className="text-red-500">*</span></span>
                <select className={cn("rounded border px-3 py-2", fe.fieldError("sectionId") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={qForm.sectionId} onChange={(e) => { setQForm({ ...qForm, sectionId: e.target.value }); fe.clearFieldError("sectionId"); }}>
                  <option value="">{t("selectSection")}</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.testSlug} / {s.code} {ASSESSMENT_BJT_SECTION_LABELS[s.code] ?? s.titleVi ?? ""} {s.testLevel ? `(${s.testLevel})` : ""}</option>
                  ))}
                </select>
                {fe.fieldError("sectionId") && <p className="text-xs text-red-600">{fe.fieldError("sectionId")}</p>}
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formPrompt")} <span className="text-red-500">*</span></span>
                <textarea className={cn("rounded border px-3 py-2", fe.fieldError("prompt") ? "border-red-400 bg-red-50/50" : "border-slate-300")} rows={3} value={qForm.prompt} onChange={(e) => { setQForm({ ...qForm, prompt: e.target.value }); fe.clearFieldError("prompt"); }} />
                {fe.fieldError("prompt") && <p className="text-xs text-red-600">{fe.fieldError("prompt")}</p>}
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formScenario")} ({t("optional")})</span>
                <textarea className="rounded border border-slate-300 px-3 py-2" rows={2} value={qForm.scenario} onChange={(e) => setQForm({ ...qForm, scenario: e.target.value })} />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formExplanation")}</span>
                <textarea className="rounded border border-slate-300 px-3 py-2" rows={2} value={qForm.explanationVi} onChange={(e) => setQForm({ ...qForm, explanationVi: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formSkillTag")}</span>
                <input className="rounded border border-slate-300 px-3 py-2" value={qForm.skillTag} onChange={(e) => setQForm({ ...qForm, skillTag: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formDifficultyField")}</span>
                <select className="rounded border border-slate-300 px-3 py-2" value={qForm.difficulty} onChange={(e) => setQForm({ ...qForm, difficulty: e.target.value })}>
                  {ASSESSMENT_QUESTION_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formTagsField")}</span>
                <input className="rounded border border-slate-300 px-3 py-2" placeholder="bjt, rc_integrated, ..." value={qForm.tags} onChange={(e) => setQForm({ ...qForm, tags: e.target.value })} />
              </label>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formImageUrl")} ({t("optional")})</span>
                <input className="rounded border border-slate-300 px-3 py-2" placeholder="https://..." value={qForm.imageUrl} onChange={(e) => setQForm({ ...qForm, imageUrl: e.target.value })} />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formImageAlt")} ({t("optional")})</span>
                <input className="rounded border border-slate-300 px-3 py-2" placeholder="Mô tả ảnh..." value={qForm.imageAlt} onChange={(e) => setQForm({ ...qForm, imageAlt: e.target.value })} />
              </label>
              {qForm.imageUrl.trim() ? (
                <div className="col-span-2">
                  <img src={qForm.imageUrl.trim()} alt={qForm.imageAlt || ""} className="max-h-32 rounded border border-slate-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ) : null}
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formAudioUrl")} ({t("optional")})</span>
                <input className="rounded border border-slate-300 px-3 py-2" placeholder="https://..." value={qForm.audioUrl} onChange={(e) => setQForm({ ...qForm, audioUrl: e.target.value })} />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formAudioScript")} ({t("optional")})</span>
                <textarea className="rounded border border-slate-300 px-3 py-2" rows={3} placeholder="Audio script / 音声スクリプト..." value={qForm.audioScript} onChange={(e) => setQForm({ ...qForm, audioScript: e.target.value })} />
              </label>

              <div className="col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">{t("formOptions")} ({qForm.options.length} {t("items")})</span>
                  {qForm.options.length < 8 ? (
                    <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => {
                      const nextKey = String.fromCharCode(65 + qForm.options.length);
                      setQForm({ ...qForm, options: [...qForm.options, { optionKey: nextKey, text: "", isCorrect: false }] });
                    }}>+ {t("addOption")}</button>
                  ) : null}
                </div>
                {fe.fieldError("options") && <p className="mb-2 text-xs text-red-600">{fe.fieldError("options")}</p>}
                <div className="space-y-2">
                  {qForm.options.map((opt, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input className="col-span-1 rounded border border-slate-300 px-2 py-1 text-center text-xs font-bold" value={opt.optionKey} onChange={(e) => setQForm({ ...qForm, options: qForm.options.map((o, i) => i === idx ? { ...o, optionKey: e.target.value } : o) })} />
                      <input className="col-span-8 rounded border border-slate-300 px-2 py-1 text-sm" placeholder={t("optionTextPlaceholder")} value={opt.text} onChange={(e) => setQForm({ ...qForm, options: qForm.options.map((o, i) => i === idx ? { ...o, text: e.target.value } : o) })} />
                      <label className="col-span-2 flex items-center gap-1 text-xs">
                        <input type="radio" name="correctOption" checked={opt.isCorrect} onChange={() => setQForm({ ...qForm, options: qForm.options.map((o, i) => ({ ...o, isCorrect: i === idx })) })} />
                        {t("correct")}
                      </label>
                      {qForm.options.length > 2 ? (
                        <button type="button" className="col-span-1 rounded border border-red-300 text-xs text-red-600" onClick={() => setQForm({ ...qForm, options: qForm.options.filter((_, i) => i !== idx) })}>×</button>
                      ) : <div className="col-span-1" />}
                    </div>
                  ))}
                </div>
              </div>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">{t("formReason")} <span className="text-red-500">*</span></span>
                <input className={cn("rounded border px-3 py-2", fe.fieldError("reason") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} />
                {fe.fieldError("reason") && <p className="text-xs text-red-600">{fe.fieldError("reason")}</p>}
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowForm(null); fe.clearAll(); }} type="button">{t("cancel")}</button>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitQuestion} type="button">{showForm === "create" ? t("createSubmit") : t("editSubmit")}</button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
