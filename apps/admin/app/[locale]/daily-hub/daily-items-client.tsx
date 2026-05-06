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
  DAILY_CONTENT_ITEM_STATUSES,
  DAILY_CONTENT_LOCALES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type Labels = Record<string, string>;
type CommonLabels = { empty: string; error: string; loading: string; records: string };

type DailyItemSummary = {
  id: string;
  contentDate: string;
  locale: string;
  widgetKind: string;
  level: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  publishAt: string | null;
  publishedAt: string | null;
  title: string | null;
  japaneseText: string | null;
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

type DailyItemDetail = DailyItemSummary & {
  bodyMd: string | null;
  readingText: string | null;
  explanationText: string | null;
  imageUrl: string | null;
  sourceProvider: string | null;
  sourceRef: string | null;
  payload: unknown;
  notes: string | null;
  extraction: unknown | null;
  engagement: Record<string, number>;
  _count: { actions: number };
  audit: AuditEntry[];
};

type WidgetConfig = {
  id: string;
  widgetKind: string;
  enabled: boolean;
  displayOrder: number;
  locale: string;
};

type ListResponse = {
  items: DailyItemSummary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
};

const PAGE_SIZE = 25;

type FormState = {
  contentDate: string;
  locale: string;
  widgetKind: string;
  title: string;
  bodyMd: string;
  japaneseText: string;
  readingText: string;
  explanationText: string;
  imageUrl: string;
  sourceProvider: string;
  sourceRef: string;
};

const EMPTY_FORM: FormState = {
  contentDate: new Date().toISOString().slice(0, 10),
  locale: "vi",
  widgetKind: "life_situation",
  title: "",
  bodyMd: "",
  japaneseText: "",
  readingText: "",
  explanationText: "",
  imageUrl: "",
  sourceProvider: "admin_seed",
  sourceRef: ""
};

type Tab = "items" | "configs";

function statusTone(s: string): "danger" | "good" | "neutral" | "warning" {
  if (s === "published") return "good";
  if (s === "scheduled") return "warning";
  if (s === "archived") return "neutral";
  return "warning";
}

const WIDGET_KIND_GROUPS = [
  { label: "Nổi bật", kinds: ["weather", "business_phrase", "seasonal_word"] },
  { label: "Cuộc sống Nhật Bản", kinds: ["life_situation", "life_housing", "life_banking", "life_tax"] },
  { label: "Tin tức & khác", kinds: ["time_greeting", "nhk_news"] }
] as const;

function widgetKindLabel(kind: string): string {
  const m: Record<string, string> = {
    weather: "🌤 Thời tiết",
    business_phrase: "💼 Công sở",
    seasonal_word: "🌸 Từ mùa",
    life_situation: "🚃 Đời sống",
    life_housing: "🏠 Thuê nhà",
    life_banking: "🏦 Ngân hàng",
    life_tax: "📋 Thuế & bảo hiểm",
    time_greeting: "⏰ Chào theo giờ",
    nhk_news: "📰 Tin NHK"
  };
  return m[kind] ?? kind;
}

export function DailyItemsAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
  locale: string;
}) {
  const t = useCallback((k: string) => labels[k] ?? k, [labels]);

  const [tab, setTab] = useState<Tab>("items");
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
        if (!c) setPerms(permsFromMe((await r.json()) as MePayload));
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
  const [status, setStatus] = useState<string>("all");
  const [localeFilter, setLocaleFilter] = useState<string>("all");
  const [widgetKindFilter, setWidgetKindFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detail, setDetail] = useState<DailyItemDetail | null>(null);
  const [editing, setEditing] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reasonModal, setReasonModal] = useState<{
    action: "schedule" | "publish" | "archive" | "delete";
    targetId: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (localeFilter !== "all") params.set("locale", localeFilter);
      if (widgetKindFilter !== "all") params.set("widgetKind", widgetKindFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/daily/items?${params.toString()}`);
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
  }, [status, localeFilter, widgetKindFilter, dateFrom, dateTo, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const items = data?.items ?? [];
  const counters = data?.statusCounts ?? {};

  const openDetail = useCallback(async (id: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setEditing(null);
    setDetail(null);
    try {
      const r = await adminApiFetch(`/api/admin/daily/items/${id}`);
      if (r.ok) setDetail((await r.json()) as DailyItemDetail);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const openCreate = () => {
    setDetail(null);
    setEditing("create");
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditing("edit");
    setForm({
      contentDate: detail.contentDate.slice(0, 10),
      locale: detail.locale,
      widgetKind: detail.widgetKind,
      title: detail.title ?? "",
      bodyMd: detail.bodyMd ?? "",
      japaneseText: detail.japaneseText ?? "",
      readingText: detail.readingText ?? "",
      explanationText: detail.explanationText ?? "",
      imageUrl: (detail as DailyItemDetail).imageUrl ?? "",
      sourceProvider: detail.sourceProvider ?? "",
      sourceRef: detail.sourceRef ?? ""
    });
    setFormError(null);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDetail(null);
    setEditing(null);
    setFormError(null);
  };

  const submitForm = async () => {
    if (!form.title.trim()) {
      setFormError(t("errorTitleRequired"));
      return;
    }
    const reasonText = window.prompt(t("promptReason") ?? "Reason");
    if (!reasonText || reasonText.trim().length < 3) {
      setFormError(t("errorReasonRequired"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        contentDate: form.contentDate,
        locale: form.locale,
        widgetKind: form.widgetKind,
        title: form.title.trim(),
        bodyMd: form.bodyMd || null,
        japaneseText: form.japaneseText || null,
        readingText: form.readingText || null,
        explanationText: form.explanationText || null,
        imageUrl: form.imageUrl || null,
        sourceProvider: form.sourceProvider || null,
        sourceRef: form.sourceRef || null,
        reason: reasonText.trim()
      };
      const url = editing === "create"
        ? "/api/admin/daily/items"
        : `/api/admin/daily/items/${detail?.id}`;
      const method = editing === "create" ? "POST" : "PATCH";
      const r = await adminApiFetch(url, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => null)) as { code?: string } | null;
        setFormError(err?.code ?? t("errorSave"));
        return;
      }
      const saved = (await r.json()) as DailyItemDetail;
      setDetail(saved);
      setEditing(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const submitTransition = async () => {
    if (!reasonModal || reason.trim().length < 3) return;
    if (reasonModal.action === "schedule" && !scheduledAt) return;
    setSubmitting(true);
    try {
      const { action, targetId } = reasonModal;
      const url = action === "delete"
        ? `/api/admin/daily/items/${targetId}`
        : `/api/admin/daily/items/${targetId}/${action}`;
      const method = action === "delete" ? "DELETE" : "POST";
      const body: Record<string, unknown> = { reason: reason.trim() };
      if (action === "schedule") body.scheduledAt = new Date(scheduledAt).toISOString();
      const r = await adminApiFetch(url, {
        body: JSON.stringify(body),
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
        setScheduledAt("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                className={cn("rounded px-3 py-1.5 font-medium transition-colors", tab === "items" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                onClick={() => setTab("items")}
                type="button"
              >{t("tabItems")}</button>
              <button
                className={cn("rounded px-3 py-1.5 font-medium transition-colors", tab === "configs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                onClick={() => setTab("configs")}
                type="button"
              >{t("tabConfigs")}</button>
            </div>
            {canWrite && tab === "items" ? (
              <button
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                onClick={openCreate}
                type="button"
              >
                {t("actionCreate")}
              </button>
            ) : null}
          </div>
        }
        description={t("subtitle")}
        title={t("title")}
      />

      {tab === "configs" ? (
        <ConfigsTab canWrite={canWrite} t={t} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...DAILY_CONTENT_ITEM_STATUSES].map((s) => (
          <div key={s} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{t(`status_${s}`)}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{counters[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <AdminSection description={t("filterDescription")} title={t("filterTitle")}>
        <div className="flex flex-wrap items-end gap-3">
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
              {DAILY_CONTENT_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterLocale")}</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setLocaleFilter(e.target.value);
              }}
              value={localeFilter}
            >
              <option value="all">{t("status_all")}</option>
              {DAILY_CONTENT_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterWidgetKind")}</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setWidgetKindFilter(e.target.value);
              }}
              value={widgetKindFilter}
            >
              <option value="all">{t("status_all")}</option>
              {WIDGET_KIND_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.kinds.map((w) => (
                    <option key={w} value={w}>{widgetKindLabel(w)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterDateFrom")}</span>
            <input
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-medium text-slate-600">{t("filterDateTo")}</span>
            <input
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
              type="date"
              value={dateTo}
            />
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
                  <AdminDataTableTh>{t("colDate")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colLocale")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colWidgetKind")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colJapanese")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
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
                      <span className="font-mono text-xs">{row.contentDate.slice(0, 10)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{row.locale}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-medium text-xs">{widgetKindLabel(row.widgetKind)}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-sm">{row.title ?? "—"}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="text-sm font-medium">{row.japaneseText ?? "—"}</span>
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={statusTone(row.status)}>
                        {t(`status_${row.status}`)}
                      </AdminStatusBadge>
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
                {editing === "create"
                  ? t("drawerTitleCreate")
                  : detail
                    ? `${detail.contentDate.slice(0, 10)} · ${detail.widgetKind}`
                    : t("drawerTitleLoading")}
              </h2>
              <button className="text-sm text-slate-500" onClick={closeDrawer} type="button">
                {t("close")}
              </button>
            </div>
            <div className="space-y-5 px-5 py-4">
              {drawerLoading ? <p className="text-sm text-slate-500">{common.loading}</p> : null}

              {editing && !drawerLoading ? (
                <div className="space-y-3">
                  {formError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {formError}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={t("formContentDate")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, contentDate: e.target.value })}
                        type="date"
                        value={form.contentDate}
                      />
                    </FormField>
                    <FormField label={t("formLocale")}>
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, locale: e.target.value })}
                        value={form.locale}
                      >
                        {DAILY_CONTENT_LOCALES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={t("formWidgetKind")}>
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, widgetKind: e.target.value })}
                        value={form.widgetKind}
                      >
                        {WIDGET_KIND_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.kinds.map((w) => (
                              <option key={w} value={w}>{widgetKindLabel(w)}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </FormField>
                    <FormField label={t("formTitle")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder={t("formTitlePlaceholder")}
                        value={form.title}
                      />
                    </FormField>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("formJapaneseSection")}</div>
                    <FormField label={t("formJapaneseText")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-medium"
                        onChange={(e) => setForm({ ...form, japaneseText: e.target.value })}
                        placeholder="日本語テキスト"
                        value={form.japaneseText}
                      />
                    </FormField>
                    <FormField label={t("formReadingText")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, readingText: e.target.value })}
                        placeholder="にほんごテキスト"
                        value={form.readingText}
                      />
                    </FormField>
                    <FormField label={t("formExplanation")}>
                      <textarea
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, explanationText: e.target.value })}
                        rows={2}
                        value={form.explanationText}
                      />
                    </FormField>
                    {form.japaneseText && (
                      <div className="rounded-md border border-indigo-100 bg-indigo-50 p-2.5 text-center">
                        <div className="text-lg font-bold text-slate-900">{form.japaneseText}</div>
                        {form.readingText && <div className="text-xs text-slate-500">{form.readingText}</div>}
                        {form.explanationText && <div className="mt-1 text-xs text-slate-600">{form.explanationText}</div>}
                      </div>
                    )}
                  </div>

                  <FormField label={t("formBodyMd")}>
                    <textarea
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
                      rows={3}
                      value={form.bodyMd}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={t("formSourceProvider")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, sourceProvider: e.target.value })}
                        value={form.sourceProvider}
                      />
                    </FormField>
                    <FormField label={t("formSourceRef")}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, sourceRef: e.target.value })}
                        value={form.sourceRef}
                      />
                    </FormField>
                    <FormField label={t("formImageUrl") ?? "Image URL"}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        placeholder="https://..."
                        value={form.imageUrl}
                      />
                      {form.imageUrl ? (
                        <img
                          alt="Preview"
                          className="mt-1.5 h-16 w-auto rounded-md border border-slate-200 object-cover"
                          src={form.imageUrl}
                        />
                      ) : null}
                    </FormField>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                      onClick={() => setEditing(null)}
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
                    <span className="font-mono text-xs text-slate-500">{detail.contentDate.slice(0, 10)}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase">
                      {detail.locale}
                    </span>
                    <span className="font-medium text-sm">{widgetKindLabel(detail.widgetKind)}</span>
                  </div>

                  {(detail.title ?? detail.japaneseText) ? (
                    <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3 space-y-1">
                      {detail.title && <div className="font-semibold text-sm text-slate-800">{detail.title}</div>}
                      {detail.japaneseText && <div className="text-lg font-bold text-slate-900">{detail.japaneseText}</div>}
                      {detail.readingText && <div className="text-xs text-slate-500">{detail.readingText}</div>}
                      {detail.explanationText && <div className="mt-1 text-xs text-slate-600">{detail.explanationText}</div>}
                    </div>
                  ) : null}

                  {detail.bodyMd && (
                    <DetailField label={t("formBodyMd")}>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">{detail.bodyMd}</div>
                    </DetailField>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <DetailField label={t("formSourceProvider")}>{detail.sourceProvider ?? "—"}</DetailField>
                    <DetailField label={t("formSourceRef")}>{detail.sourceRef ?? "—"}</DetailField>
                    <DetailField label={t("formImageUrl") ?? "Image URL"}>
                      {(detail as DailyItemDetail).imageUrl ? (
                        <div className="flex items-center gap-2">
                          <img alt="" className="h-8 w-auto rounded border border-slate-200" src={(detail as DailyItemDetail).imageUrl!} />
                          <span className="truncate text-xs">{(detail as DailyItemDetail).imageUrl}</span>
                        </div>
                      ) : "—"}
                    </DetailField>
                    <DetailField label={t("colPublishedAt")}>
                      {detail.publishedAt ? new Date(detail.publishedAt).toLocaleString() : "—"}
                    </DetailField>
                    <DetailField label={t("engagementActions")}>
                      {detail._count?.actions ?? 0}
                    </DetailField>
                  </div>
                  {Object.keys(detail.engagement ?? {}).length > 0 ? (
                    <DetailField label={t("engagementBreakdown")}>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {Object.entries(detail.engagement).map(([k, v]) => (
                          <span key={k} className="rounded bg-slate-100 px-2 py-0.5">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    </DetailField>
                  ) : null}
                  {detail.payload && Object.keys(detail.payload as Record<string, unknown>).length > 0 ? (
                    <DetailField label={t("formPayload")}>
                      <pre className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2 font-mono text-[10px]">
                        {JSON.stringify(detail.payload, null, 2)}
                      </pre>
                    </DetailField>
                  ) : null}
                  {detail.notes ? <DetailField label={t("formNotes")}>{detail.notes}</DetailField> : null}

                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        onClick={openEdit}
                        type="button"
                      >
                        {t("actionEdit")}
                      </button>
                      {detail.status === "draft" ? (
                        <button
                          className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          onClick={() => {
                            setScheduledAt(detail.publishAt ? detail.publishAt.slice(0, 16) : "");
                            setReasonModal({ action: "schedule", targetId: detail.id });
                          }}
                          type="button"
                        >
                          {t("actionSchedule")}
                        </button>
                      ) : null}
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
            {reasonModal.action === "schedule" ? (
              <FormField label={t("formScheduledAt")}>
                <input
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  onChange={(e) => setScheduledAt(e.target.value)}
                  type="datetime-local"
                  value={scheduledAt}
                />
              </FormField>
            ) : null}
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
                  setScheduledAt("");
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
                disabled={
                  submitting ||
                  reason.trim().length < 3 ||
                  (reasonModal.action === "schedule" && !scheduledAt)
                }
                onClick={() => void submitTransition()}
                type="button"
              >
                {submitting ? t("formSubmitting") : t("formConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
      )}
    </div>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
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
            {row.reason ? <div className="mt-1 text-slate-700">&quot;{row.reason}&quot;</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfigsTab({
  canWrite,
  t
}: {
  canWrite: boolean;
  t: (k: string) => string;
}) {
  const [configs, setConfigs] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApiFetch("/api/admin/daily/widgets?locale=vi");
      if (!r.ok) throw new Error("fetch failed");
      setConfigs((await r.json()) as WidgetConfig[]);
    } catch {
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (cfg: WidgetConfig) => {
    try {
      const r = await adminApiFetch(`/api/admin/daily/widgets/${cfg.id}`, {
        body: JSON.stringify({ enabled: !cfg.enabled }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) throw new Error("toggle failed");
      await load();
    } catch {
      setError(t("errorSave"));
    }
  };

  return (
    <AdminSection description={t("configsDescription")} title={t("configsTitle")}>
      {loading ? <p className="text-sm text-slate-500">{t("loading")}</p> : null}
      {error ? <AdminEmptyState title={error}>{error}</AdminEmptyState> : null}
      {!loading && !error && configs.length === 0 ? (
        <AdminEmptyState title={t("configsEmpty")}>{t("configsEmptyHint")}</AdminEmptyState>
      ) : null}
      {!loading && !error && configs.length > 0 ? (
        <AdminDataTable>
          <AdminDataTableHead>
            <AdminDataTableRow>
              <AdminDataTableTh>{t("configsColKind")}</AdminDataTableTh>
              <AdminDataTableTh>{t("configsColOrder")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
              {canWrite && <AdminDataTableTh>{t("configsColAction")}</AdminDataTableTh>}
            </AdminDataTableRow>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {configs.map((cfg) => (
              <AdminDataTableRow key={cfg.id}>
                <AdminDataTableTd>
                  <span className="font-medium text-sm">{widgetKindLabel(cfg.widgetKind)}</span>
                </AdminDataTableTd>
                <AdminDataTableTd>{cfg.displayOrder}</AdminDataTableTd>
                <AdminDataTableTd>
                  <AdminStatusBadge tone={cfg.enabled ? "good" : "warning"}>
                    {cfg.enabled ? t("configsEnabled") : t("configsDisabled")}
                  </AdminStatusBadge>
                </AdminDataTableTd>
                {canWrite && (
                  <AdminDataTableTd>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium transition-colors hover:bg-slate-100"
                      onClick={() => void toggle(cfg)}
                      type="button"
                    >
                      {cfg.enabled ? t("configsDisable") : t("configsEnable")}
                    </button>
                  </AdminDataTableTd>
                )}
              </AdminDataTableRow>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      ) : null}
    </AdminSection>
  );
}
