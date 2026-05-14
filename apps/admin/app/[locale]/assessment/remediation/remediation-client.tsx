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
import { ASSESSMENT_BJT_LEVELS } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import { AdminAutoFill } from "@/app/_components/admin-auto-fill";
import { useFormErrors, parseApiError, validateFields, validators } from "@/lib/form-errors";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

const RECOMMENDED_TYPES = ["lesson", "deck", "card", "quiz_template", "url"] as const;

type Rule = {
  id: string;
  name: string;
  description: string | null;
  topicSkillTag: string;
  level: string;
  thresholdFailedCount: number;
  thresholdWindowQuestions: number;
  recommendedContentType: string;
  recommendedContentId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuditEntry = { id: string; action: string; createdAt: string; reason: string | null; actor: { id: string; displayName: string; email: string } | null };
type Trigger = { id: string; ruleId: string; userId: string; observedFailedCount: number; observedWindow: number; createdAt: string; rule?: { id: string; name: string; topicSkillTag: string; level: string; recommendedContentType: string; recommendedContentId: string } | null };
type RuleDetail = Rule & { audit: AuditEntry[]; recentTriggers: Trigger[] };

type RuleListResponse = { items: Rule[]; total: number; page: number; pageSize: number };
type TriggerListResponse = { items: Trigger[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;

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

type FormState = {
  name: string; description: string; topicSkillTag: string; level: string;
  thresholdFailedCount: number; thresholdWindowQuestions: number;
  recommendedContentType: string; recommendedContentId: string;
};
const DEFAULT_FORM: FormState = {
  name: "", description: "", topicSkillTag: "", level: ASSESSMENT_BJT_LEVELS[2] ?? "BJT-J3",
  thresholdFailedCount: 3, thresholdWindowQuestions: 10,
  recommendedContentType: "lesson", recommendedContentId: ""
};

type ConfirmAction = "enable" | "disable" | "delete" | null;

export function RemediationAdminClient({ common, labels, locale }: { common: CommonLabels; labels: Labels; locale: string }) {
  const t = (k: string) => labels[k] ?? k;
  const [tab, setTab] = useState<"rules" | "triggers">("rules");
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canManage = perms != null && perms.has("assessment.manage");

  const [rules, setRules] = useState<RuleListResponse | null>(null);
  const [triggers, setTriggers] = useState<TriggerListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [tRuleId, setTRuleId] = useState("");
  const [tUserId, setTUserId] = useState("");
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [tPage, setTPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RuleDetail | null>(null);
  const [showForm, setShowForm] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

  useEffect(() => { const h = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(h); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, topicFilter, levelFilter, activeFilter]);
  useEffect(() => { setTPage(1); }, [tRuleId, tUserId, tFrom, tTo]);

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

  const loadRules = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (topicFilter.trim()) params.set("topicSkillTag", topicFilter.trim());
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (activeFilter !== "all") params.set("active", activeFilter);
      params.set("page", String(page)); params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/assessment/remediation/rules?${params.toString()}`);
      if (!r.ok) { setListError(common.error); setRules(null); return; }
      setListError(null); setRules((await r.json()) as RuleListResponse);
    } catch { setListError(common.error); }
  }, [debounced, topicFilter, levelFilter, activeFilter, page, common.error]);

  const loadTriggers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tRuleId.trim()) params.set("ruleId", tRuleId.trim());
      if (tUserId.trim()) params.set("userId", tUserId.trim());
      if (tFrom) params.set("from", new Date(tFrom).toISOString());
      if (tTo) params.set("to", new Date(tTo).toISOString());
      params.set("page", String(tPage)); params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/assessment/remediation/triggers?${params.toString()}`);
      if (!r.ok) { setListError(common.error); setTriggers(null); return; }
      setListError(null); setTriggers((await r.json()) as TriggerListResponse);
    } catch { setListError(common.error); }
  }, [tRuleId, tUserId, tFrom, tTo, tPage, common.error]);

  useEffect(() => { if (tab === "rules") void loadRules(); }, [tab, loadRules]);
  useEffect(() => { if (tab === "triggers") void loadTriggers(); }, [tab, loadTriggers]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/assessment/remediation/rules/${id}`);
    if (!r.ok) { setDetail(null); return; }
    setDetail((await r.json()) as RuleDetail);
  }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  function openCreate() { setForm(DEFAULT_FORM); setReason(""); setShowForm("create"); }
  function openEdit() {
    if (!detail) return;
    setForm({ name: detail.name, description: detail.description ?? "", topicSkillTag: detail.topicSkillTag, level: detail.level, thresholdFailedCount: detail.thresholdFailedCount, thresholdWindowQuestions: detail.thresholdWindowQuestions, recommendedContentType: detail.recommendedContentType, recommendedContentId: detail.recommendedContentId });
    setReason(""); setShowForm("edit");
  }

  async function submitForm() {
    if (!canManage) return;
    fe.clearAll();
    const errs = validateFields({
      name: { value: form.name, rules: [validators.required(t("nameRequired"))] },
      topicSkillTag: { value: form.topicSkillTag, rules: [validators.required(t("topicRequired"))] },
      recommendedContentId: { value: form.recommendedContentId, rules: [validators.required(t("contentIdRequired"))] },
      reason: { value: reason, rules: [validators.required(t("reasonRequired")), validators.minLength(3, t("reasonRequired"))] },
    });
    if (form.thresholdFailedCount > form.thresholdWindowQuestions) errs.thresholdFailedCount = t("thresholdInvalid");
    if (Object.keys(errs).length > 0) { fe.setFieldErrors(errs); return; }
    setMutating(true);
    try {
      const body = { ...form, name: form.name.trim(), description: form.description.trim() || null, topicSkillTag: form.topicSkillTag.trim(), recommendedContentId: form.recommendedContentId.trim(), reason: reason.trim() };
      const url = showForm === "create" ? "/api/admin/assessment/remediation/rules" : `/api/admin/assessment/remediation/rules/${detail?.id}`;
      const method = showForm === "create" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("saveFailed"));
        fe.setFieldErrors(parsed.fieldErrors);
        if (parsed.message) fe.setFormError(parsed.message);
        else toast.error(t("saveFailed"));
        return;
      }
      const next = (await r.json()) as RuleDetail;
      setShowForm(null); toast.success(t("saveOk"));
      void loadRules(); setSelectedId(next.id);
    } finally { setMutating(false); }
  }

  async function submitConfirm() {
    if (!canManage || !detail || !confirm) return;
    if (reason.trim().length < 3) { fe.setFieldError("reason", t("reasonRequired")); return; }
    setMutating(true);
    try {
      const url = confirm === "delete" ? `/api/admin/assessment/remediation/rules/${detail.id}` : `/api/admin/assessment/remediation/rules/${detail.id}/${confirm}`;
      const method = confirm === "delete" ? "DELETE" : "POST";
      const r = await adminApiFetch(url, { method, body: JSON.stringify({ reason: reason.trim() }) });
      if (!r.ok) { const parsed = await parseApiError(r, t(`${confirm}Failed`)); toast.error(parsed.message || t(`${confirm}Failed`)); return; }
      toast.success(t(`${confirm}Ok`));
      setConfirm(null); setReason("");
      if (confirm === "delete") setSelectedId(null);
      void loadRules(); if (selectedId) void loadDetail(selectedId);
    } finally { setMutating(false); }
  }

  function exportRulesCsv() {
    if (!rules) return;
    const header = ["id","name","topicSkillTag","level","failedCount","window","contentType","contentId","active","updatedAt"];
    const rows = rules.items.map((it) => [it.id, it.name, it.topicSkillTag, it.level, String(it.thresholdFailedCount), String(it.thresholdWindowQuestions), it.recommendedContentType, it.recommendedContentId, String(it.active), it.updatedAt]);
    downloadCsv(`assessment-remediation-rules-${Date.now()}.csv`, header, rows);
  }
  function exportTriggersCsv() {
    if (!triggers) return;
    const header = ["id","ruleId","ruleName","userId","observedFailedCount","observedWindow","createdAt"];
    const rows = triggers.items.map((it) => [it.id, it.ruleId, it.rule?.name ?? "", it.userId, String(it.observedFailedCount), String(it.observedWindow), it.createdAt]);
    downloadCsv(`assessment-remediation-triggers-${Date.now()}.csv`, header, rows);
  }

  const pageCount = rules ? Math.max(1, Math.ceil(rules.total / rules.pageSize)) : 1;
  const tPageCount = triggers ? Math.max(1, Math.ceil(triggers.total / triggers.pageSize)) : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />
      {!canManage && perms != null ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("readOnlyBanner")}</div> : null}

      <div className="flex gap-2 border-b border-slate-200">
        <button className={cn("rounded-t px-4 py-2 text-sm font-medium", tab === "rules" ? "bg-slate-900 text-white" : "text-slate-600")} onClick={() => setTab("rules")} type="button">{t("tabRules")}</button>
        <button className={cn("rounded-t px-4 py-2 text-sm font-medium", tab === "triggers" ? "bg-slate-900 text-white" : "text-slate-600")} onClick={() => setTab("triggers")} type="button">{t("tabTriggers")}</button>
      </div>

      {tab === "rules" ? (
        <>
          <AdminSection>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterSearch")}</span><input className="w-64 rounded border border-slate-300 px-3 py-2 text-sm" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} /></label>
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterTopic")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="vocab.verb" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} /></label>
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterLevel")}</span>
                <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                  <option value="all">{t("filterAll")}</option>{ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterActive")}</span>
                <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                  <option value="all">{t("filterAll")}</option><option value="true">{t("active")}</option><option value="false">{t("inactive")}</option>
                </select>
              </label>
              <button className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={exportRulesCsv} type="button">{t("exportCsv")}</button>
              {canManage ? <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">{t("create")}</button> : null}
            </div>
          </AdminSection>

          <AdminSection>
            {listError ? <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
              : !rules ? <AdminEmptyState title={common.loading}>{common.loading}</AdminEmptyState>
              : rules.items.length === 0 ? <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
              : (
                <>
                  <AdminDataTable>
                    <AdminDataTableHead><AdminDataTableRow>
                      <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colTopic")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colLevel")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colThreshold")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colContent")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colActive")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                    </AdminDataTableRow></AdminDataTableHead>
                    <AdminDataTableBody>
                      {rules.items.map((it) => (
                        <AdminDataTableRow className="cursor-pointer hover:bg-slate-50" key={it.id} onClick={() => setSelectedId(it.id)}>
                          <AdminDataTableTd><div className="font-medium">{it.name}</div></AdminDataTableTd>
                          <AdminDataTableTd className="font-mono text-xs">{it.topicSkillTag}</AdminDataTableTd>
                          <AdminDataTableTd>{it.level}</AdminDataTableTd>
                          <AdminDataTableTd>{it.thresholdFailedCount}/{it.thresholdWindowQuestions}</AdminDataTableTd>
                          <AdminDataTableTd className="text-xs">{it.recommendedContentType}</AdminDataTableTd>
                          <AdminDataTableTd><AdminStatusBadge tone={it.active ? "good" : "neutral"}>{it.active ? t("active") : t("inactive")}</AdminStatusBadge></AdminDataTableTd>
                          <AdminDataTableTd className="text-xs text-slate-500">{fmtWhen(it.updatedAt, locale)}</AdminDataTableTd>
                        </AdminDataTableRow>
                      ))}
                    </AdminDataTableBody>
                  </AdminDataTable>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>{common.records}: {rules.total}</span>
                    <div className="flex gap-2">
                      <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">‹</button>
                      <span>{page} / {pageCount}</span>
                      <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} type="button">›</button>
                    </div>
                  </div>
                </>
              )}
          </AdminSection>
        </>
      ) : (
        <>
          <AdminSection>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterRule")}</span><input className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs" placeholder="rule uuid" value={tRuleId} onChange={(e) => setTRuleId(e.target.value)} /></label>
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterUser")}</span><input className="w-72 rounded border border-slate-300 px-3 py-2 font-mono text-xs" placeholder="user uuid" value={tUserId} onChange={(e) => setTUserId(e.target.value)} /></label>
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterFrom")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" type="datetime-local" value={tFrom} onChange={(e) => setTFrom(e.target.value)} /></label>
              <label className="flex flex-col text-xs"><span className="mb-1 font-medium text-slate-600">{t("filterTo")}</span><input className="rounded border border-slate-300 px-3 py-2 text-sm" type="datetime-local" value={tTo} onChange={(e) => setTTo(e.target.value)} /></label>
              <button className="ml-auto rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={exportTriggersCsv} type="button">{t("exportCsv")}</button>
            </div>
          </AdminSection>

          <AdminSection>
            {listError ? <AdminEmptyState title={common.error}>{listError}</AdminEmptyState>
              : !triggers ? <AdminEmptyState title={common.loading}>{common.loading}</AdminEmptyState>
              : triggers.items.length === 0 ? <AdminEmptyState title={common.empty}>{common.empty}</AdminEmptyState>
              : (
                <>
                  <AdminDataTable>
                    <AdminDataTableHead><AdminDataTableRow>
                      <AdminDataTableTh>{t("colWhen")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colRule")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colUser")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colObserved")}</AdminDataTableTh>
                      <AdminDataTableTh>{t("colContent")}</AdminDataTableTh>
                    </AdminDataTableRow></AdminDataTableHead>
                    <AdminDataTableBody>
                      {triggers.items.map((it) => (
                        <AdminDataTableRow key={it.id}>
                          <AdminDataTableTd className="text-xs text-slate-500">{fmtWhen(it.createdAt, locale)}</AdminDataTableTd>
                          <AdminDataTableTd>{it.rule?.name ?? it.ruleId.slice(0, 8)}</AdminDataTableTd>
                          <AdminDataTableTd className="font-mono text-xs">{it.userId.slice(0, 8)}</AdminDataTableTd>
                          <AdminDataTableTd>{it.observedFailedCount}/{it.observedWindow}</AdminDataTableTd>
                          <AdminDataTableTd className="text-xs">{it.rule?.recommendedContentType ?? "—"}</AdminDataTableTd>
                        </AdminDataTableRow>
                      ))}
                    </AdminDataTableBody>
                  </AdminDataTable>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>{common.records}: {triggers.total}</span>
                    <div className="flex gap-2">
                      <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={tPage <= 1} onClick={() => setTPage((p) => Math.max(1, p - 1))} type="button">‹</button>
                      <span>{tPage} / {tPageCount}</span>
                      <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={tPage >= tPageCount} onClick={() => setTPage((p) => Math.min(tPageCount, p + 1))} type="button">›</button>
                    </div>
                  </div>
                </>
              )}
          </AdminSection>
        </>
      )}

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30" onClick={() => setSelectedId(null)}>
          <div className="flex w-full max-w-3xl flex-col overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 font-mono">{detail.topicSkillTag} · {detail.level}</div>
                <h2 className="text-lg font-semibold">{detail.name}</h2>
              </div>
              <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => setSelectedId(null)} type="button">{t("close")}</button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <AdminStatusBadge tone={detail.active ? "good" : "neutral"}>{detail.active ? t("active") : t("inactive")}</AdminStatusBadge>
                <span className="text-slate-600">{t("threshold")}: {detail.thresholdFailedCount}/{detail.thresholdWindowQuestions}</span>
                <span className="text-slate-600">{t("content")}: {detail.recommendedContentType} · <span className="font-mono text-xs">{detail.recommendedContentId.slice(0, 12)}</span></span>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={openEdit} type="button">{t("edit")}</button>
                  {detail.active
                    ? <button className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("disable"); }} type="button">{t("disable")}</button>
                    : <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("enable"); }} type="button">{t("enable")}</button>}
                  <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => { setReason(""); fe.clearFieldError("reason"); setConfirm("delete"); }} type="button">{t("delete")}</button>
                </div>
              ) : null}
              {detail.description ? <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.description}</p> : null}
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("recentTriggers")}</h3>
                <ul className="space-y-1">
                  {detail.recentTriggers.map((tr) => (
                    <li className="flex items-center justify-between rounded border border-slate-200 p-2 text-xs" key={tr.id}>
                      <span><span className="font-mono">{tr.userId.slice(0, 8)}</span> · {tr.observedFailedCount}/{tr.observedWindow}</span>
                      <span className="text-slate-500">{fmtWhen(tr.createdAt, locale)}</span>
                    </li>
                  ))}
                  {detail.recentTriggers.length === 0 ? <li className="text-xs text-slate-500">{common.empty}</li> : null}
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

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">{showForm === "create" ? t("createHeading") : t("editHeading")}</h2>
            <div className="mb-3 flex items-center justify-between">
              <FormError message={fe.errors.form} className="flex-1" />
              <AdminAutoFill
                formType="remediation"
                onFill={(fields) => {
                  const f = fields as Partial<FormState>;
                  setForm((prev) => ({
                    ...prev,
                    ...(f.name !== undefined && { name: String(f.name) }),
                    ...(f.description !== undefined && { description: String(f.description) }),
                    ...(f.topicSkillTag !== undefined && { topicSkillTag: String(f.topicSkillTag) }),
                    ...(f.level !== undefined && { level: String(f.level) }),
                    ...(f.thresholdFailedCount !== undefined && { thresholdFailedCount: Number(f.thresholdFailedCount) }),
                    ...(f.thresholdWindowQuestions !== undefined && { thresholdWindowQuestions: Number(f.thresholdWindowQuestions) }),
                    ...(f.recommendedContentType !== undefined && { recommendedContentType: String(f.recommendedContentType) }),
                    ...(f.recommendedContentId !== undefined && { recommendedContentId: String(f.recommendedContentId) }),
                  }));
                }}
                labels={{ button: t("autoFill") || "Auto Fill" }}
                disabled={mutating}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formName")} <span className="text-red-500">*</span></span><input className={cn("rounded border px-3 py-2", fe.fieldError("name") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); fe.clearFieldError("name"); }} />{fe.fieldError("name") && <p className="text-xs text-red-600">{fe.fieldError("name")}</p>}</label>
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formDescription")}</span><textarea className="rounded border border-slate-300 px-3 py-2" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formTopic")} <span className="text-red-500">*</span></span><input className={cn("rounded border px-3 py-2", fe.fieldError("topicSkillTag") ? "border-red-400 bg-red-50/50" : "border-slate-300")} placeholder="vocab.verb" value={form.topicSkillTag} onChange={(e) => { setForm({ ...form, topicSkillTag: e.target.value }); fe.clearFieldError("topicSkillTag"); }} />{fe.fieldError("topicSkillTag") && <p className="text-xs text-red-600">{fe.fieldError("topicSkillTag")}</p>}</label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formLevel")}</span>
                <select className="rounded border border-slate-300 px-3 py-2" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  {ASSESSMENT_BJT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formFailedCount")}</span><input type="number" min={1} max={50} className={cn("rounded border px-3 py-2", fe.fieldError("thresholdFailedCount") ? "border-red-400 bg-red-50/50" : "border-slate-300")} value={form.thresholdFailedCount} onChange={(e) => { setForm({ ...form, thresholdFailedCount: Number(e.target.value) }); fe.clearFieldError("thresholdFailedCount"); }} />{fe.fieldError("thresholdFailedCount") && <p className="text-xs text-red-600">{fe.fieldError("thresholdFailedCount")}</p>}</label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formWindow")}</span><input type="number" min={1} max={500} className="rounded border border-slate-300 px-3 py-2" value={form.thresholdWindowQuestions} onChange={(e) => setForm({ ...form, thresholdWindowQuestions: Number(e.target.value) })} /></label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formContentType")}</span>
                <select className="rounded border border-slate-300 px-3 py-2" value={form.recommendedContentType} onChange={(e) => setForm({ ...form, recommendedContentType: e.target.value })}>
                  {RECOMMENDED_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1"><span className="text-xs font-medium text-slate-600">{t("formContentId")} <span className="text-red-500">*</span></span><input className={cn("rounded border px-3 py-2 font-mono text-xs", fe.fieldError("recommendedContentId") ? "border-red-400 bg-red-50/50" : "border-slate-300")} placeholder="uuid…" value={form.recommendedContentId} onChange={(e) => { setForm({ ...form, recommendedContentId: e.target.value }); fe.clearFieldError("recommendedContentId"); }} />{fe.fieldError("recommendedContentId") && <p className="text-xs text-red-600">{fe.fieldError("recommendedContentId")}</p>}</label>
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
