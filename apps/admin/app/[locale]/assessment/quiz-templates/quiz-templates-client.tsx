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
  ASSESSMENT_BJT_SECTIONS,
  ASSESSMENT_BJT_SECTION_LABELS,
  ASSESSMENT_MOCK_EXAM_STATUSES,
  ASSESSMENT_QUESTION_DIFFICULTIES,
  ASSESSMENT_QUIZ_TEMPLATE_TYPES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import { AdminAutoFill } from "@/app/_components/admin-auto-fill";
import { useFormErrors, parseApiError, validateFields, validators } from "@/lib/form-errors";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Summary = {
  id: string;
  slug: string;
  titleVi: string | null;
  titleJa: string | null;
  type: string;
  status: string;
  level: string | null;
  timeLimitSeconds: number | null;
  description: string | null;
  blueprintMeta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type AuditEntry = { id: string; action: string; createdAt: string; reason: string | null; actor: { id: string; displayName: string; email: string } | null };
type Detail = Summary & {
  samplePreview: {
    difficultyAllocation?: Array<{ difficulty: string; target: number }>;
    difficultyTargets?: Array<{ difficulty: string; targetCount: number }>;
    questionCount?: number;
    timeLimitSec?: number;
    topicAllocation?: Array<{ target: number; topic: string }>;
    topicTargets?: Array<{ targetCount: number; topic: string }>;
    totalQuestions?: number;
  } | null;
  audit: AuditEntry[];
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = { draft: "warning", published: "good", archived: "neutral" };

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

type DifficultyMix = { difficulty: string; weight: number };
type TopicMix = { topic: string; weight: number };

type FormState = {
  slug: string; titleVi: string; titleJa: string; description: string;
  level: string; type: string;
  questionCount: number; timeLimitSec: number;
  sectionCoverage: string[];
  difficultyMix: DifficultyMix[]; topicMix: TopicMix[];
};
const DEFAULT_FORM: FormState = {
  slug: "", titleVi: "", titleJa: "", description: "",
  level: ASSESSMENT_BJT_LEVELS[2] ?? "BJT-J3",
  type: ASSESSMENT_QUIZ_TEMPLATE_TYPES[0] ?? "practice",
  questionCount: 10, timeLimitSec: 600,
  sectionCoverage: [],
  difficultyMix: [{ difficulty: "standard", weight: 1 }],
  topicMix: []
};

type ConfirmAction = "publish" | "archive" | "duplicate" | "delete" | null;

function previewQuestionCount(preview: Detail["samplePreview"]): number {
  return preview?.questionCount ?? preview?.totalQuestions ?? 0;
}

function previewDifficultyTargets(preview: Detail["samplePreview"]): Array<{ difficulty: string; targetCount: number }> {
  if (!preview) return [];
  if (Array.isArray(preview.difficultyTargets)) return preview.difficultyTargets;
  if (Array.isArray(preview.difficultyAllocation)) {
    return preview.difficultyAllocation.map((item) => ({
      difficulty: item.difficulty,
      targetCount: item.target
    }));
  }
  return [];
}

function previewTopicTargets(preview: Detail["samplePreview"]): Array<{ targetCount: number; topic: string }> {
  if (!preview) return [];
  if (Array.isArray(preview.topicTargets)) return preview.topicTargets;
  if (Array.isArray(preview.topicAllocation)) {
    return preview.topicAllocation.map((item) => ({
      targetCount: item.target,
      topic: item.topic
    }));
  }
  return [];
}

export function QuizTemplatesAdminClient({ common, labels, locale }: { common: CommonLabels; labels: Labels; locale: string }) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("assessment.manage");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [showForm, setShowForm] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

  useEffect(() => { const h = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(h); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, statusFilter, levelFilter, typeFilter]);

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
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("page", String(page)); params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/assessment/quiz-templates?${params.toString()}`);
      if (!r.ok) { setListError(common.error); setList(null); return; }
      setListError(null); setList((await r.json()) as ListResponse);
    } catch { setListError(common.error); }
  }, [debounced, statusFilter, levelFilter, typeFilter, page, common.error]);
  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/assessment/quiz-templates/${id}`);
    if (!r.ok) { setDetail(null); return; }
    setDetail((await r.json()) as Detail);
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  function openCreate() { setForm(DEFAULT_FORM); setReason(""); setShowForm("create"); }
  function openEdit() {
    if (!detail) return;
    const meta = (detail.blueprintMeta ?? {}) as Record<string, unknown>;
    const rules = (meta.generationRules ?? {}) as { questionCount?: number; timeLimitSec?: number; difficultyMix?: DifficultyMix[]; topicMix?: TopicMix[]; sectionCoverage?: string[] };
    setForm({
      slug: detail.slug,
      titleVi: detail.titleVi ?? "",
      titleJa: detail.titleJa ?? "",
      description: detail.description ?? "",
      level: detail.level ?? "BJT-J3",
      type: detail.type,
      questionCount: rules.questionCount ?? 10,
      timeLimitSec: rules.timeLimitSec ?? detail.timeLimitSeconds ?? 600,
      sectionCoverage: rules.sectionCoverage ?? [],
      difficultyMix: rules.difficultyMix ?? [{ difficulty: "standard", weight: 1 }],
      topicMix: rules.topicMix ?? []
    });
    setReason(""); setShowForm("edit");
  }

  async function submitForm() {
    if (!canManage) return;
    fe.clearAll();
    const errs = validateFields({
      slug: { value: form.slug, rules: [validators.required(t("slugRequired"))] },
      titleVi: { value: form.titleVi, rules: [validators.required(t("titleViRequired"))] },
      reason: { value: reason, rules: [validators.required(t("reasonRequired")), validators.minLength(3, t("reasonRequired"))] },
    });
    if (Object.keys(errs).length > 0) { fe.setFieldErrors(errs); return; }
    setMutating(true);
    try {
      const body = {
        slug: form.slug.trim(),
        titleVi: form.titleVi.trim(),
        titleJa: form.titleJa.trim() || undefined,
        description: form.description.trim() || undefined,
        level: form.level,
        type: form.type,
        generationRules: {
          questionCount: form.questionCount,
          timeLimitSec: form.timeLimitSec,
          sectionCoverage: form.sectionCoverage.length > 0 ? form.sectionCoverage : undefined,
          difficultyMix: form.difficultyMix,
          topicMix: form.topicMix
        },
        reason: reason.trim()
      };
      const url = showForm === "create" ? "/api/admin/assessment/quiz-templates" : `/api/admin/assessment/quiz-templates/${detail?.id}`;
      const method = showForm === "create" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("saveFailed"));
        fe.setFieldErrors(parsed.fieldErrors);
        if (parsed.message) fe.setFormError(parsed.message);
        else toast.error(t("saveFailed"));
        return;
      }
      const next = (await r.json()) as Detail;
      setShowForm(null); toast.success(t("saveOk"));
      void loadList(); setSelectedId(next.id);
    } finally { setMutating(false); }
  }

  async function submitConfirm() {
    if (!canManage || !detail || !confirm) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    setMutating(true);
    try {
      const url = confirm === "delete" ? `/api/admin/assessment/quiz-templates/${detail.id}` : `/api/admin/assessment/quiz-templates/${detail.id}/${confirm}`;
      const method = confirm === "delete" ? "DELETE" : "POST";
      const r = await adminApiFetch(url, { method, body: JSON.stringify({ reason: reason.trim() }) });
      if (!r.ok) { const parsed = await parseApiError(r, t(`${confirm}Failed`)); toast.error(parsed.message || t(`${confirm}Failed`)); return; }
      toast.success(t(`${confirm}Ok`));
      setConfirm(null); setReason("");
      if (confirm === "delete") setSelectedId(null);
      else if (confirm === "duplicate") { const next = (await r.json()) as Detail; setSelectedId(next.id); }
      void loadList(); if (selectedId) void loadDetail(selectedId);
    } finally { setMutating(false); }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id","slug","titleVi","type","level","status","timeLimitSeconds","createdAt","updatedAt"];
    const rows = list.items.map((it) => [it.id, it.slug, it.titleVi ?? "", it.type, it.level ?? "", it.status, String(it.timeLimitSeconds ?? ""), it.createdAt, it.updatedAt]);
    downloadCsv(`assessment-quiz-templates-${Date.now()}.csv`, header, rows);
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
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_MOCK_EXAM_STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterType")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_QUIZ_TEMPLATE_TYPES.map((s) => <option key={s} value={s}>{t(`type_${s}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterLevel")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="all">{t("filterAll")}</option>{ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <button className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={exportCsv} type="button">{t("exportCsv")}</button>
          {canManage ? <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">{t("create")}</button> : null}
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
                  <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colType")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLevel")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTime")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                </AdminDataTableRow></AdminDataTableHead>
                <AdminDataTableBody>
                  {list.items.map((it) => (
                    <AdminDataTableRow className="cursor-pointer hover:bg-slate-50" key={it.id} onClick={() => setSelectedId(it.id)}>
                      <AdminDataTableTd>
                        <div className="font-medium">{it.titleVi ?? it.slug}</div>
                        <div className="font-mono text-xs text-slate-500">{it.slug}</div>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{t(`type_${it.type}`)}</AdminDataTableTd>
                      <AdminDataTableTd>{it.level ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd><AdminStatusBadge tone={STATUS_TONE[it.status] ?? "neutral"}>{t(`status_${it.status}`)}</AdminStatusBadge></AdminDataTableTd>
                      <AdminDataTableTd>{it.timeLimitSeconds ? `${Math.round(it.timeLimitSeconds / 60)} min` : "—"}</AdminDataTableTd>
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
                <div className="text-xs uppercase tracking-wide text-slate-500">{detail.slug}</div>
                <h2 className="text-lg font-semibold">{detail.titleVi ?? detail.slug}</h2>
              </div>
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setSelectedId(null)} type="button">{t("close")}</button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <AdminStatusBadge tone={STATUS_TONE[detail.status] ?? "neutral"}>{t(`status_${detail.status}`)}</AdminStatusBadge>
                <span className="text-slate-600">{t(`type_${detail.type}`)}</span>
                <span className="text-slate-600">{detail.level ?? "—"}</span>
                <span className="text-slate-600">{detail.timeLimitSeconds ? `${Math.round(detail.timeLimitSeconds / 60)} min` : "—"}</span>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={openEdit} type="button">{t("edit")}</button>
                  {detail.status !== "published" ? <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("publish"); }} type="button">{t("publish")}</button> : null}
                  {detail.status !== "archived" ? <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("archive"); }} type="button">{t("archive")}</button> : null}
                  <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("duplicate"); }} type="button">{t("duplicate")}</button>
                  <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("delete"); }} type="button">{t("delete")}</button>
                </div>
              ) : null}
              {(() => {
                const meta = (detail.blueprintMeta ?? {}) as Record<string, unknown>;
                const rules = (meta.generationRules ?? {}) as { sectionCoverage?: string[] };
                const sections = rules.sectionCoverage ?? [];
                return sections.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t("sectionCoverageHeading")}</h3>
                    <div className="flex flex-wrap gap-2">
                      {sections.map((s) => (
                        <span key={s} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono">{s} <span className="text-slate-500">{ASSESSMENT_BJT_SECTION_LABELS[s] ?? ""}</span></span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {detail.samplePreview ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">{t("samplePreview")} ({previewQuestionCount(detail.samplePreview)} {t("questions")})</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-semibold">{t("difficultyMix")}</div>
                      <ul>{previewDifficultyTargets(detail.samplePreview).map((d) => <li key={d.difficulty}>{d.difficulty}: {d.targetCount}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-semibold">{t("topicMix")}</div>
                      <ul>{previewTopicTargets(detail.samplePreview).map((d) => <li key={d.topic}>{d.topic}: {d.targetCount}</li>)}</ul>
                      {previewTopicTargets(detail.samplePreview).length === 0 ? <span className="text-slate-500">{t("topicAuto")}</span> : null}
                    </div>
                  </div>
                </div>
              ) : null}
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

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">{showForm === "create" ? t("createHeading") : t("editHeading")}</h2>
            <div className="mb-3 flex items-center justify-between">
              <FormError message={fe.errors.form} className="flex-1" />
              <AdminAutoFill
                formType="quiz-template"
                onFill={(fields) => {
                  const f = fields as Partial<FormState>;
                  setForm((prev) => ({
                    ...prev,
                    ...(f.slug !== undefined && { slug: String(f.slug) }),
                    ...(f.titleVi !== undefined && { titleVi: String(f.titleVi) }),
                    ...(f.titleJa !== undefined && { titleJa: String(f.titleJa) }),
                    ...(f.description !== undefined && { description: String(f.description) }),
                    ...(f.level !== undefined && { level: String(f.level) }),
                    ...(f.type !== undefined && { type: String(f.type) }),
                    ...(f.questionCount !== undefined && { questionCount: Number(f.questionCount) }),
                    ...(f.timeLimitSec !== undefined && { timeLimitSec: Number(f.timeLimitSec) }),
                  }));
                }}
                labels={{ button: t("autoFill") || "Auto Fill" }}
                disabled={mutating}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formSlug")} <span className="text-red-500">*</span></span><input className={cn("rounded border px-3 py-2", fe.fieldError("slug") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={form.slug} onChange={(e) => { setForm({ ...form, slug: e.target.value }); fe.clearFieldError("slug"); }} />{fe.fieldError("slug") && <p className="text-xs text-red-600">{fe.fieldError("slug")}</p>}</label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTitleVi")} <span className="text-red-500">*</span></span><input className={cn("rounded border px-3 py-2", fe.fieldError("titleVi") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={form.titleVi} onChange={(e) => { setForm({ ...form, titleVi: e.target.value }); fe.clearFieldError("titleVi"); }} />{fe.fieldError("titleVi") && <p className="text-xs text-red-600">{fe.fieldError("titleVi")}</p>}</label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTitleJa")}</span><input className="rounded border border-slate-300 px-3 py-2" value={form.titleJa} onChange={(e) => setForm({ ...form, titleJa: e.target.value })} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formType")}</span>
                <select className="rounded border border-slate-300 px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {ASSESSMENT_QUIZ_TEMPLATE_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formLevel")}</span>
                <select className="rounded border border-slate-300 px-3 py-2" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  {ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formQuestionCount")}</span><input type="number" min={1} max={200} className="rounded border border-slate-300 px-3 py-2" value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTimeLimitSec")}</span><input type="number" min={60} max={36000} className="rounded border border-slate-300 px-3 py-2" value={form.timeLimitSec} onChange={(e) => setForm({ ...form, timeLimitSec: Number(e.target.value) })} /></label>
              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-slate-600">{t("formSectionCoverage")}</div>
                <div className="flex flex-wrap gap-2">
                  {ASSESSMENT_BJT_SECTIONS.map((sec) => (
                    <label key={sec} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={form.sectionCoverage.includes(sec)} onChange={(e) => {
                        const next = e.target.checked ? [...form.sectionCoverage, sec] : form.sectionCoverage.filter((s) => s !== sec);
                        setForm({ ...form, sectionCoverage: next });
                      }} />
                      <span className="font-mono">{sec}</span>
                      <span className="text-slate-500">{ASSESSMENT_BJT_SECTION_LABELS[sec] ?? ""}</span>
                    </label>
                  ))}
                </div>
                {form.sectionCoverage.length === 0 ? <p className="mt-1 text-xs text-slate-400">{t("sectionCoverageEmpty")}</p> : null}
              </div>
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formDescription")}</span><textarea className="rounded border border-slate-300 px-3 py-2" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-slate-600">{t("formDifficultyMix")}</div>
                {form.difficultyMix.map((d, idx) => (
                  <div className="mb-1 grid grid-cols-12 gap-2" key={idx}>
                    <select className="col-span-6 rounded border border-slate-300 px-2 py-1 text-xs" value={d.difficulty} onChange={(e) => setForm({ ...form, difficultyMix: form.difficultyMix.map((x, i) => i === idx ? { ...x, difficulty: e.target.value } : x) })}>
                      {ASSESSMENT_QUESTION_DIFFICULTIES.map((diff) => <option key={diff} value={diff}>{diff}</option>)}
                    </select>
                    <input type="number" step="0.1" min={0} max={1} className="col-span-5 rounded border border-slate-300 px-2 py-1 text-xs" value={d.weight} onChange={(e) => setForm({ ...form, difficultyMix: form.difficultyMix.map((x, i) => i === idx ? { ...x, weight: Number(e.target.value) } : x) })} />
                    <button type="button" className="col-span-1 rounded border border-red-300 text-xs text-red-600" onClick={() => setForm({ ...form, difficultyMix: form.difficultyMix.filter((_, i) => i !== idx) })}>×</button>
                  </div>
                ))}
                <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setForm({ ...form, difficultyMix: [...form.difficultyMix, { difficulty: "standard", weight: 0.5 }] })}>+ {t("addRow")}</button>
              </div>
              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-slate-600">{t("formTopicMix")} ({t("optional")})</div>
                {form.topicMix.map((d, idx) => (
                  <div className="mb-1 grid grid-cols-12 gap-2" key={idx}>
                    <input className="col-span-7 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="topic" value={d.topic} onChange={(e) => setForm({ ...form, topicMix: form.topicMix.map((x, i) => i === idx ? { ...x, topic: e.target.value } : x) })} />
                    <input type="number" step="0.1" min={0} max={1} className="col-span-4 rounded border border-slate-300 px-2 py-1 text-xs" value={d.weight} onChange={(e) => setForm({ ...form, topicMix: form.topicMix.map((x, i) => i === idx ? { ...x, weight: Number(e.target.value) } : x) })} />
                    <button type="button" className="col-span-1 rounded border border-red-300 text-xs text-red-600" onClick={() => setForm({ ...form, topicMix: form.topicMix.filter((_, i) => i !== idx) })}>×</button>
                  </div>
                ))}
                <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setForm({ ...form, topicMix: [...form.topicMix, { topic: "", weight: 0.5 }] })}>+ {t("addRow")}</button>
              </div>
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formReason")} <span className="text-red-500">*</span></span><input className={cn("rounded border px-3 py-2", fe.fieldError("reason") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} />{fe.fieldError("reason") && <p className="text-xs text-red-600">{fe.fieldError("reason")}</p>}</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setShowForm(null); fe.clearAll(); }} type="button">{t("cancel")}</button>
              <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={mutating} onClick={submitForm} type="button">{showForm === "create" ? t("createSubmit") : t("editSubmit")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">{t(`confirmHeading_${confirm}`)}</h2>
            <p className="mb-3 text-sm text-slate-600">{t(`confirmBody_${confirm}`)}</p>
            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-slate-600">{t("formReason")}</span><input className={cn("rounded border px-3 py-2 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")} value={reason} onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }} /></label>
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => { setConfirm(null); fe.clearFieldError("reason"); }} type="button">{t("cancel")}</button>
              <button className={cn("rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50", confirm === "delete" ? "bg-red-600" : "bg-slate-900")} disabled={mutating} onClick={submitConfirm} type="button">{t(`confirmSubmit_${confirm}`)}</button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
