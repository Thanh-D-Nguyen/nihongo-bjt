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
import { COMPETENCY_LEVELS, COMPETENCY_STATUSES } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { useFormErrors, parseApiError, validateFields, validators } from "@/lib/form-errors";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type CompetencySummary = {
  id: string;
  code: string;
  titleVi: string;
  titleJa: string | null;
  level: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type CompetencyDetail = CompetencySummary & {
  descriptionVi: string | null;
  audit: AuditEntry[];
};

type ListResponse = {
  items: CompetencySummary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
};

const PAGE_SIZE = 25;

type FormState = {
  code: string;
  titleVi: string;
  titleJa: string;
  descriptionVi: string;
  level: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  titleVi: "",
  titleJa: "",
  descriptionVi: "",
  level: "intermediate"
};

function statusTone(s: string): "danger" | "good" | "neutral" | "warning" {
  if (s === "published") return "good";
  if (s === "archived") return "neutral";
  return "warning";
}

export function CompetenciesAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);

  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("admin.content.write");

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const r = await adminApiFetch("/api/admin/me");
        if (!r.ok) {
          if (!c) setPerms(new Set());
          return;
        }
        const body = (await r.json()) as MePayload;
        if (!c) setPerms(permsFromMe(body));
      } catch {
        if (!c) setPerms(new Set());
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detail, setDetail] = useState<CompetencyDetail | null>(null);
  const [editing, setEditing] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const fe = useFormErrors();
  const [submitting, setSubmitting] = useState(false);
  const toast = useAdminToast();

  const [reasonModal, setReasonModal] = useState<{ action: "publish" | "archive" | "delete"; targetId: string } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (level !== "all") params.set("level", level);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/learning/competencies?${params.toString()}`);
      if (!r.ok) {
        setData(null);
        setError(t("errorLoad"));
        return;
      }
      setData((await r.json()) as ListResponse);
    } catch {
      setData(null);
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [q, status, level, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const items = data?.items ?? [];
  const counters = data?.statusCounts ?? {};

  const openDetail = useCallback(async (id: string) => {
    setDrawerLoading(true);
    setDrawerOpen(true);
    setEditing(null);
    setDetail(null);
    try {
      const r = await adminApiFetch(`/api/admin/learning/competencies/${id}`);
      if (r.ok) setDetail((await r.json()) as CompetencyDetail);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const openCreate = () => {
    setDetail(null);
    setEditing("create");
    setForm(EMPTY_FORM);
    fe.clearAll();
    setDrawerOpen(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditing("edit");
    setForm({
      code: detail.code,
      descriptionVi: detail.descriptionVi ?? "",
      level: detail.level,
      titleJa: detail.titleJa ?? "",
      titleVi: detail.titleVi
    });
    fe.clearAll();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDetail(null);
    setEditing(null);
    fe.clearAll();
  };

  const submitForm = async () => {
    fe.clearAll();
    const errs = validateFields([
      { field: "code", value: form.code, message: t("errorCodeRequired"), validate: validators.required },
      { field: "titleVi", value: form.titleVi, message: t("errorTitleViRequired"), validate: validators.required },
    ]);
    if (Object.keys(errs).length > 0) { fe.setFieldErrors(errs); return; }

    const reasonText = window.prompt(t("promptReason") ?? "Reason");
    if (!reasonText || reasonText.trim().length < 3) {
      fe.setFormError(t("errorReasonRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim(),
        descriptionVi: form.descriptionVi || null,
        level: form.level,
        reason: reasonText.trim(),
        titleJa: form.titleJa || null,
        titleVi: form.titleVi.trim()
      };
      const url = editing === "create"
        ? "/api/admin/learning/competencies"
        : `/api/admin/learning/competencies/${detail?.id}`;
      const method = editing === "create" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method
      });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("errorSave"));
        fe.setFieldErrors(parsed.fields);
        if (parsed.form) fe.setFormError(parsed.form);
        else toast.error(t("errorSave"));
        return;
      }
      const saved = (await r.json()) as CompetencyDetail;
      setDetail(saved);
      setEditing(null);
      toast.success(t("saved"));
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const submitTransition = async () => {
    if (!reasonModal || reason.trim().length < 3) return;
    setSubmitting(true);
    try {
      const { action, targetId } = reasonModal;
      const url = action === "delete"
        ? `/api/admin/learning/competencies/${targetId}`
        : `/api/admin/learning/competencies/${targetId}/${action}`;
      const method = action === "delete" ? "DELETE" : "POST";
      const r = await adminApiFetch(url, {
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { "content-type": "application/json" },
        method
      });
      if (r.ok) {
        await load();
        if (action === "delete") {
          closeDrawer();
        } else if (detail?.id === targetId) {
          await openDetail(targetId);
        }
        setReasonModal(null);
        setReason("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")}>
        {canWrite ? (
          <button
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            onClick={openCreate}
            type="button"
          >
            {t("actionCreate")}
          </button>
        ) : null}
      </AdminPageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...COMPETENCY_STATUSES].map((s) => (
          <div key={s} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{t(`status_${s}`)}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{counters[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <AdminSection description={t("filterDescription")} title={t("filterTitle")}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterSearch")}</span>
            <input
              className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder={t("searchPlaceholder")}
              value={q}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterStatus")}</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              value={status}
            >
              <option value="all">{t("status_all")}</option>
              {COMPETENCY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterLevel")}</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setLevel(e.target.value);
              }}
              value={level}
            >
              <option value="all">{t("status_all")}</option>
              {COMPETENCY_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </AdminSection>

      <AdminSection description={`${t("countLabel")}: ${data?.total ?? 0}`} title={t("listTitle")}>
        {loading && !data ? (
          <p className="text-sm text-slate-600">{common.loading}</p>
        ) : error ? (
          <AdminEmptyState title={common.error}>{error}</AdminEmptyState>
        ) : items.length === 0 ? (
          <AdminEmptyState title={t("empty")}>{t("emptyHint")}</AdminEmptyState>
        ) : (
          <>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colCode")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLevel")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colUpdatedAt")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {items.map((row) => (
                  <AdminDataTableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-indigo-50/40"
                    onClick={() => void openDetail(row.id)}
                  >
                    <AdminDataTableTd>
                      <span className="font-mono text-xs text-slate-700">{row.code}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-medium">{row.titleVi}</span>
                      {row.titleJa ? (
                        <div className="text-xs text-slate-500">{row.titleJa}</div>
                      ) : null}
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.level}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>
                        {t(`status_${row.status}`)}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-xs text-slate-500">
                        {new Date(row.updatedAt).toLocaleString()}
                      </span>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {t("pageLabel")}: {data?.page ?? page} / {totalPages}
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

      {drawerOpen ? (
        <div aria-modal className="fixed inset-0 z-40 flex" onClick={closeDrawer} role="dialog">
          <div
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                {editing === "create" ? t("drawerTitleCreate") : detail?.titleVi ?? t("drawerTitleLoading")}
              </h2>
              <button className="text-sm text-slate-500" onClick={closeDrawer} type="button">
                {t("close")}
              </button>
            </div>
            <div className="space-y-5 px-5 py-4">
              {drawerLoading ? <p className="text-sm text-slate-500">{common.loading}</p> : null}

              {editing && !drawerLoading ? (
                <div className="space-y-3">
                  <FormError message={fe.errors.form} className="mb-3" />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={<>{t("formCode")} <span className="text-red-500">*</span></>}>
                      <input
                        className={cn("w-full rounded-md px-2 py-1.5 text-sm", fe.fieldError("code") ? "border border-red-400 bg-red-50/50" : "border border-slate-300")}
                        onChange={(e) => { fe.clearFieldError("code"); setForm({ ...form, code: e.target.value.toUpperCase() }); }}
                        value={form.code}
                      />
                      {fe.fieldError("code") && <p className="text-xs text-red-600">{fe.fieldError("code")}</p>}
                    </FormField>
                    <FormField label={t("formLevel")}>
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, level: e.target.value })}
                        value={form.level}
                      >
                        {COMPETENCY_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={<>{t("formTitleVi")} <span className="text-red-500">*</span></>}>
                      <input
                        className={cn("w-full rounded-md px-2 py-1.5 text-sm", fe.fieldError("titleVi") ? "border border-red-400 bg-red-50/50" : "border border-slate-300")}
                        onChange={(e) => { fe.clearFieldError("titleVi"); setForm({ ...form, titleVi: e.target.value }); }}
                        value={form.titleVi}
                      />
                      {fe.fieldError("titleVi") && <p className="text-xs text-red-600">{fe.fieldError("titleVi")}</p>}
                    </FormField>
                    <FormField label={t("formTitleJa")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, titleJa: e.target.value })}
                        value={form.titleJa}
                      />
                    </FormField>
                  </div>
                  <FormField label={t("formDescriptionVi")}>
                    <textarea
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      onChange={(e) => setForm({ ...form, descriptionVi: e.target.value })}
                      rows={3}
                      value={form.descriptionVi}
                    />
                  </FormField>
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                      onClick={() => { fe.clearAll(); setEditing(null); }}
                      type="button"
                    >
                      {t("formCancel")}
                    </button>
                    <button
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={submitting}
                      onClick={() => void submitForm()}
                      type="button"
                    >
                      {submitting ? t("formSubmitting") : t("formSave")}
                    </button>
                  </div>
                </div>
              ) : null}

              {!editing && detail && !drawerLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AdminStatusBadge tone={statusTone(detail.status)}>
                      {t(`status_${detail.status}`)}
                    </AdminStatusBadge>
                    <span className="font-mono text-xs text-slate-500">{detail.code}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      {detail.level}
                    </span>
                  </div>
                  {detail.titleJa ? (
                    <DetailField label={t("formTitleJa")}>{detail.titleJa}</DetailField>
                  ) : null}
                  {detail.descriptionVi ? (
                    <DetailField label={t("formDescriptionVi")}>
                      <p className="whitespace-pre-wrap text-sm">{detail.descriptionVi}</p>
                    </DetailField>
                  ) : null}
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        onClick={openEdit}
                        type="button"
                      >
                        {t("actionEdit")}
                      </button>
                      {detail.status !== "published" && detail.status !== "archived" ? (
                        <button
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          onClick={() => setReasonModal({ action: "publish", targetId: detail.id })}
                          type="button"
                        >
                          {t("actionPublish")}
                        </button>
                      ) : null}
                      {detail.status !== "archived" ? (
                        <button
                          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                          onClick={() => setReasonModal({ action: "archive", targetId: detail.id })}
                          type="button"
                        >
                          {t("actionArchive")}
                        </button>
                      ) : null}
                      {detail.status === "draft" ? (
                        <button
                          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          onClick={() => setReasonModal({ action: "delete", targetId: detail.id })}
                          type="button"
                        >
                          {t("actionDelete")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <AuditList audit={detail.audit} labels={labels} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {reasonModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {t(`confirm_${reasonModal.action}`)}
            </h3>
            <textarea
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              minLength={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("promptReason")}
              rows={3}
              value={reason}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                onClick={() => {
                  setReasonModal(null);
                  setReason("");
                }}
                type="button"
              >
                {t("formCancel")}
              </button>
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50",
                  reasonModal.action === "delete" ? "bg-red-600" : "bg-indigo-600"
                )}
                disabled={submitting || reason.trim().length < 3}
                onClick={() => void submitTransition()}
                type="button"
              >
                {submitting ? t("formSubmitting") : t("formConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: React.ReactNode }) {
  return (
    <label className="flex flex-col text-xs">
      <span className="mb-1 font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DetailField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function AuditList({ audit, labels }: { audit: AuditEntry[]; labels: Labels }) {
  const t = (k: string) => labels[k] ?? k;
  if (audit.length === 0) {
    return <div className="text-xs text-slate-500">{t("auditEmpty")}</div>;
  }
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{t("auditTitle")}</div>
      <ul className="space-y-1.5">
        {audit.map((row) => (
          <li key={row.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono font-medium text-slate-700">{row.action}</span>
              <span className="text-[10px] text-slate-500">{new Date(row.createdAt).toLocaleString()}</span>
            </div>
            {row.actor ? (
              <div className="text-[10px] text-slate-500">
                {row.actor.displayName} ({row.actor.email})
              </div>
            ) : null}
            {row.reason ? <div className="mt-1 text-slate-700">"{row.reason}"</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
