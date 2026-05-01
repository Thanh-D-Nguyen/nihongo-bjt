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
  ASSESSMENT_MOCK_EXAM_STATUSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type SectionInput = { code: string; label: string; durationMin: number; questionCount: number };

type Summary = {
  id: string;
  slug: string;
  titleVi: string | null;
  titleJa: string | null;
  status: string;
  level: string | null;
  timeLimitSeconds: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { sections: number; sessions: number };
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type Detail = Summary & {
  blueprintMeta: Record<string, unknown> | null;
  audit: AuditEntry[];
  audienceEstimate: number;
  sections: Array<{ id: string; code: string; titleVi: string | null; titleJa: string | null; displayOrder: number; _count: { questions: number } }>;
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "good" | "warning" | "danger" | "neutral"> = {
  draft: "warning",
  published: "good",
  archived: "neutral"
};

function fmtWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric"
    }).format(new Date(iso));
  } catch { return iso; }
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
function permsFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) for (const link of r.role?.permissions ?? []) {
    const c = link.permission?.code; if (c) out.add(c);
  }
  return out;
}

type FormState = {
  slug: string; titleVi: string; titleJa: string; descriptionVi: string;
  level: string; timeLimitSeconds: number; sections: SectionInput[];
};
const DEFAULT_FORM: FormState = {
  slug: "", titleVi: "", titleJa: "", descriptionVi: "",
  level: ASSESSMENT_BJT_LEVELS[2] ?? "BJT-J3",
  timeLimitSeconds: 3600,
  sections: [{ code: "S1", label: "Reading", durationMin: 30, questionCount: 20 }]
};

type ConfirmAction = "publish" | "archive" | "duplicate" | "delete" | null;

export function MockExamsAdminClient({
  common, labels, locale
}: { common: CommonLabels; labels: Labels; locale: string }) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("assessment.manage");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const [showForm, setShowForm] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => { const h = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(h); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, statusFilter, levelFilter]);

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
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/assessment/mock-exams?${params.toString()}`);
      if (!r.ok) { setListError(common.error); setList(null); return; }
      setListError(null);
      setList((await r.json()) as ListResponse);
    } catch { setListError(common.error); }
  }, [debounced, statusFilter, levelFilter, page, common.error]);

  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/assessment/mock-exams/${id}`);
    if (!r.ok) { setDetail(null); return; }
    setDetail((await r.json()) as Detail);
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  function openCreate() {
    setForm(DEFAULT_FORM); setReason(""); setShowForm("create");
  }
  function openEdit() {
    if (!detail) return;
    setForm({
      slug: detail.slug,
      titleVi: detail.titleVi ?? "",
      titleJa: detail.titleJa ?? "",
      descriptionVi: detail.description ?? "",
      level: detail.level ?? "BJT-J3",
      timeLimitSeconds: detail.timeLimitSeconds ?? 3600,
      sections: detail.sections.map((s) => ({
        code: s.code,
        label: s.titleVi ?? s.code,
        durationMin: 0,
        questionCount: s._count.questions
      }))
    });
    setReason(""); setShowForm("edit");
  }

  async function submitForm() {
    if (!canManage) return;
    if (reason.trim().length < 3) { setToast({ kind: "err", text: t("reasonRequired") }); return; }
    setMutating(true);
    try {
      const totalTimeMin = form.sections.reduce((s, x) => s + (x.durationMin || 0), 0);
      const blueprintSections = form.sections.map((s) => ({
        code: s.code.trim() || `S${form.sections.indexOf(s) + 1}`,
        titleVi: (s.label.trim() || s.code) ?? "Section",
        type: "mixed",
        questionCount: s.questionCount,
        timeLimitSec: (s.durationMin || 0) * 60
      }));
      const body = {
        slug: form.slug.trim(),
        titleVi: form.titleVi.trim(),
        titleJa: form.titleJa.trim() || undefined,
        description: form.descriptionVi.trim() || undefined,
        level: form.level,
        timeLimitSeconds: form.timeLimitSeconds,
        blueprintMeta: { sections: blueprintSections, totalTimeMin },
        reason: reason.trim()
      };
      const url = showForm === "create"
        ? "/api/admin/assessment/mock-exams"
        : `/api/admin/assessment/mock-exams/${detail?.id}`;
      const method = showForm === "create" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const err = await r.text();
        setToast({ kind: "err", text: err || t("saveFailed") });
        return;
      }
      const next = (await r.json()) as Detail;
      setShowForm(null);
      setToast({ kind: "ok", text: t("saveOk") });
      void loadList();
      setSelectedId(next.id);
    } finally { setMutating(false); }
  }

  async function submitConfirm() {
    if (!canManage || !detail || !confirm) return;
    if (reason.trim().length < 3) { setToast({ kind: "err", text: t("reasonRequired") }); return; }
    setMutating(true);
    try {
      const url = confirm === "delete"
        ? `/api/admin/assessment/mock-exams/${detail.id}`
        : `/api/admin/assessment/mock-exams/${detail.id}/${confirm}`;
      const method = confirm === "delete" ? "DELETE" : "POST";
      const r = await adminApiFetch(url, { method, body: JSON.stringify({ reason: reason.trim() }) });
      if (!r.ok) {
        const err = await r.text();
        setToast({ kind: "err", text: err || t(`${confirm}Failed`) });
        return;
      }
      setToast({ kind: "ok", text: t(`${confirm}Ok`) });
      setConfirm(null); setReason("");
      if (confirm === "delete") setSelectedId(null);
      else if (confirm === "duplicate") {
        const next = (await r.json()) as Detail;
        setSelectedId(next.id);
      }
      void loadList();
      if (selectedId) void loadDetail(selectedId);
    } finally { setMutating(false); }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id","slug","titleVi","titleJa","status","level","timeLimitSeconds","sections","sessions","createdAt","updatedAt"];
    const rows = list.items.map((it) => [
      it.id, it.slug, it.titleVi ?? "", it.titleJa ?? "", it.status, it.level ?? "",
      String(it.timeLimitSeconds ?? ""), String(it._count.sections), String(it._count.sessions),
      it.createdAt, it.updatedAt
    ]);
    downloadCsv(`assessment-mock-exams-${Date.now()}.csv`, header, rows);
  }

  const pageCount = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />
      {!canManage && perms != null ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("readOnlyBanner")}</div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterSearch")}</span>
            <input className="w-64 rounded border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} value={search} />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterStatus")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter}>
              <option value="all">{t("filterAll")}</option>
              {ASSESSMENT_MOCK_EXAM_STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterLevel")}</span>
            <select className="rounded border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setLevelFilter(e.target.value)} value={levelFilter}>
              <option value="all">{t("filterAll")}</option>
              {ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <button className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={exportCsv} type="button">{t("exportCsv")}</button>
          {canManage ? (
            <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" onClick={openCreate} type="button">{t("create")}</button>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection>
        {listError ? <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
          : !list ? <AdminEmptyState title={common.loading}>{common.loading}</AdminEmptyState>
          : list.items.length === 0 ? <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
          : (
            <>
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colSlug")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colLevel")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colTime")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colSections")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colSessions")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {list.items.map((it) => (
                    <AdminDataTableRow className="cursor-pointer hover:bg-slate-50" key={it.id} onClick={() => setSelectedId(it.id)}>
                      <AdminDataTableTd>
                        <div className="font-medium">{it.titleVi ?? it.titleJa ?? it.slug}</div>
                        {it.titleJa ? <div className="text-xs text-slate-500">{it.titleJa}</div> : null}
                      </AdminDataTableTd>
                      <AdminDataTableTd className="font-mono text-xs">{it.slug}</AdminDataTableTd>
                      <AdminDataTableTd>{it.level ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd><AdminStatusBadge tone={STATUS_TONE[it.status] ?? "neutral"}>{t(`status_${it.status}`)}</AdminStatusBadge></AdminDataTableTd>
                      <AdminDataTableTd>{it.timeLimitSeconds ? `${Math.round(it.timeLimitSeconds / 60)} min` : "—"}</AdminDataTableTd>
                      <AdminDataTableTd>{it._count.sections}</AdminDataTableTd>
                      <AdminDataTableTd>{it._count.sessions}</AdminDataTableTd>
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
                <h2 className="text-lg font-semibold">{detail.titleVi ?? detail.titleJa ?? detail.slug}</h2>
              </div>
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setSelectedId(null)} type="button">{t("close")}</button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <AdminStatusBadge tone={STATUS_TONE[detail.status] ?? "neutral"}>{t(`status_${detail.status}`)}</AdminStatusBadge>
                <span className="text-slate-600">{detail.level ?? "—"}</span>
                <span className="text-slate-600">{detail.timeLimitSeconds ? `${Math.round(detail.timeLimitSeconds / 60)} min` : "—"}</span>
                <span className="text-slate-600">· {t("audienceEstimate")}: {detail.audienceEstimate}</span>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={openEdit} type="button">{t("edit")}</button>
                  {detail.status !== "published" ? (
                    <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); setConfirm("publish"); }} type="button">{t("publish")}</button>
                  ) : null}
                  {detail.status !== "archived" ? (
                    <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => { setReason(""); setConfirm("archive"); }} type="button">{t("archive")}</button>
                  ) : null}
                  <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => { setReason(""); setConfirm("duplicate"); }} type="button">{t("duplicate")}</button>
                  <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => { setReason(""); setConfirm("delete"); }} type="button">{t("delete")}</button>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("sectionsHeading")}</h3>
                <ul className="rounded border border-slate-200">
                  {detail.sections.map((s) => (
                    <li className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-b-0" key={s.id}>
                      <span><span className="font-mono text-xs text-slate-500">{s.code}</span> {s.titleVi}</span>
                      <span className="text-xs text-slate-500">{s._count.questions} q</span>
                    </li>
                  ))}
                  {detail.sections.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">{common.empty}</li> : null}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("auditHeading")}</h3>
                <ul className="space-y-2">
                  {detail.audit.map((a) => (
                    <li className="rounded border border-slate-200 p-3 text-xs" key={a.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{a.action}</span>
                        <span className="text-slate-500">{fmtWhen(a.createdAt, locale)}</span>
                      </div>
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formSlug")}</span><input className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setForm({ ...form, slug: e.target.value })} value={form.slug} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTitleVi")}</span><input className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setForm({ ...form, titleVi: e.target.value })} value={form.titleVi} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTitleJa")}</span><input className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setForm({ ...form, titleJa: e.target.value })} value={form.titleJa} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formLevel")}</span>
                <select className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setForm({ ...form, level: e.target.value })} value={form.level}>
                  {ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTimeLimit")} (s)</span><input type="number" min={300} max={36000} className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setForm({ ...form, timeLimitSeconds: Number(e.target.value) })} value={form.timeLimitSeconds} /></label>
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formDescription")}</span><textarea className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setForm({ ...form, descriptionVi: e.target.value })} rows={2} value={form.descriptionVi} /></label>

              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-slate-600">{t("formSections")}</div>
                <div className="space-y-2">
                  {form.sections.map((s, idx) => (
                    <div className="grid grid-cols-12 gap-2" key={idx}>
                      <input className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="code" value={s.code} onChange={(e) => setForm({ ...form, sections: form.sections.map((x, i) => i === idx ? { ...x, code: e.target.value } : x) })} />
                      <input className="col-span-5 rounded border border-slate-300 px-2 py-1 text-xs" placeholder="label" value={s.label} onChange={(e) => setForm({ ...form, sections: form.sections.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) })} />
                      <input className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={1} placeholder="min" value={s.durationMin} onChange={(e) => setForm({ ...form, sections: form.sections.map((x, i) => i === idx ? { ...x, durationMin: Number(e.target.value) } : x) })} />
                      <input className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" type="number" min={1} placeholder="qty" value={s.questionCount} onChange={(e) => setForm({ ...form, sections: form.sections.map((x, i) => i === idx ? { ...x, questionCount: Number(e.target.value) } : x) })} />
                      <button type="button" className="col-span-1 rounded border border-red-300 text-xs text-red-600" onClick={() => setForm({ ...form, sections: form.sections.filter((_, i) => i !== idx) })}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => setForm({ ...form, sections: [...form.sections, { code: `S${form.sections.length + 1}`, label: "", durationMin: 30, questionCount: 20 }] })}>+ {t("addSection")}</button>
              </div>
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formReason")}</span><input className="rounded border border-slate-300 px-3 py-2" onChange={(e) => setReason(e.target.value)} value={reason} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowForm(null)} type="button">{t("cancel")}</button>
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
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-600">{t("formReason")}</span>
              <input className="rounded border border-slate-300 px-3 py-2 text-sm" onChange={(e) => setReason(e.target.value)} value={reason} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setConfirm(null)} type="button">{t("cancel")}</button>
              <button className={cn("rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50", confirm === "delete" ? "bg-red-600" : "bg-slate-900")} disabled={mutating} onClick={submitConfirm} type="button">{t(`confirmSubmit_${confirm}`)}</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={cn("fixed bottom-6 right-6 rounded px-4 py-2 text-sm shadow-lg", toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white")} onAnimationEnd={() => setToast(null)}>
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">×</button>
        </div>
      ) : null}
    </div>
  );
}
