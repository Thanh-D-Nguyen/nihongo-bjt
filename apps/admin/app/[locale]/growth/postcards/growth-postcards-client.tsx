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
  GROWTH_POSTCARD_EVENT_KINDS,
  GROWTH_TEMPLATE_PRIVACY_CLASSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { useFormErrors, parseApiError, validateFields, validators } from "@/lib/form-errors";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import { AdminAutoFill } from "@/app/_components/admin-auto-fill";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Kind = (typeof GROWTH_POSTCARD_EVENT_KINDS)[number];
type PrivacyClass = (typeof GROWTH_TEMPLATE_PRIVACY_CLASSES)[number];

type Summary = {
  id: string;
  slug: string;
  kind: Kind;
  name: string;
  privacyClass: PrivacyClass;
  noPiiVerified: boolean;
  active: boolean;
  thumbnailKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { items: Summary[]; total: number; page: number; pageSize: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type Detail = Summary & {
  config: {
    name: string;
    description?: string;
    bodyTemplate: string;
    variables?: string[];
    privacyClass: PrivacyClass;
    noPiiVerified?: boolean;
    thumbnailKey?: string;
    surface: "postcard";
    [k: string]: unknown;
  };
  audit: AuditEntry[];
};

type FormState = {
  slug: string;
  kind: Kind;
  name: string;
  description: string;
  bodyTemplate: string;
  variables: string;
  thumbnailKey: string;
  privacyClass: PrivacyClass;
  noPiiVerified: boolean;
  brandBg: string;
  brandBgEnd: string;
  brandFg: string;
  brandAccent: string;
  pattern: string;
};

const DEFAULT_FORM: FormState = {
  bodyTemplate: "",
  brandAccent: "#38bdf8",
  brandBg: "#0f172a",
  brandBgEnd: "",
  brandFg: "#e2e8f0",
  description: "",
  kind: "streak",
  name: "",
  noPiiVerified: false,
  pattern: "none",
  privacyClass: "anonymized",
  slug: "",
  thumbnailKey: "",
  variables: ""
};

const PAGE_SIZE = 25;

function formatWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
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

function buildConfig(form: FormState) {
  return {
    bodyTemplate: form.bodyTemplate,
    brandAccent: form.brandAccent || undefined,
    brandBg: form.brandBg || undefined,
    brandBgEnd: form.brandBgEnd || undefined,
    brandFg: form.brandFg || undefined,
    description: form.description || undefined,
    name: form.name,
    noPiiVerified: form.noPiiVerified,
    pattern: form.pattern !== "none" ? form.pattern : undefined,
    privacyClass: form.privacyClass,
    surface: "postcard" as const,
    thumbnailKey: form.thumbnailKey || undefined,
    variables: form.variables
      ? form.variables.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined
  };
}

function detailToForm(d: Detail): FormState {
  return {
    bodyTemplate: d.config.bodyTemplate ?? "",
    brandAccent: (d.config as any).brandAccent ?? "#38bdf8",
    brandBg: (d.config as any).brandBg ?? "#0f172a",
    brandBgEnd: (d.config as any).brandBgEnd ?? "",
    brandFg: (d.config as any).brandFg ?? "#e2e8f0",
    description: d.config.description ?? "",
    kind: d.kind,
    name: d.config.name ?? d.name,
    noPiiVerified: d.config.noPiiVerified === true,
    pattern: (d.config as any).pattern ?? "none",
    privacyClass: d.config.privacyClass,
    slug: d.slug,
    thumbnailKey: d.config.thumbnailKey ?? "",
    variables: (d.config.variables ?? []).join(", ")
  };
}

function renderPreview(template: string, variables: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => variables[key] ?? `{${key}}`);
}

export function GrowthPostcardsClient({
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
  const canManage = perms != null && perms.has("growth.manage");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "archived">("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "publish" | "archive" } | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const toast = useAdminToast();
  const fe = useFormErrors();

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, kindFilter, statusFilter]);

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
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (kindFilter !== "all") params.set("kind", kindFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/growth/postcards?${params.toString()}`);
      if (!r.ok) {
        setListError(common.error);
        setList(null);
        return;
      }
      setListError(null);
      setList((await r.json()) as ListResponse);
    } catch {
      setListError(common.error);
    }
  }, [debounced, kindFilter, statusFilter, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/growth/postcards/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function submitCreate() {
    if (!canManage) return;
    fe.clearAll();
    const errs = validateFields([
      { field: "slug", value: form.slug, message: t("slugRequired"), validate: validators.required },
      { field: "name", value: form.name, message: t("nameRequired"), validate: validators.required },
      { field: "reason", value: reason, message: t("reasonRequired"), validate: validators.required },
      { field: "reason", value: reason, message: t("reasonRequired"), validate: validators.minLength(3) },
    ]);
    if (Object.keys(errs).length > 0) { fe.setFieldErrors(errs); return; }
    setMutating(true);
    try {
      const r = await adminApiFetch("/api/admin/growth/postcards", {
        body: JSON.stringify({
          config: buildConfig(form),
          kind: form.kind,
          reason: reason.trim(),
          slug: form.slug
        }),
        method: "POST"
      });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("createFailed"));
        fe.setFieldErrors(parsed.fields);
        if (parsed.form) fe.setFormError(parsed.form);
        else toast.error(t("createFailed"));
        return;
      }
      const body = (await r.json()) as Detail;
      toast.success(t("createOk"));
      setCreating(false);
      setForm(DEFAULT_FORM);
      setReason("");
      setSelectedId(body.id);
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  async function submitEdit() {
    if (!canManage || !detail) return;
    fe.clearAll();
    const errs = validateFields([
      { field: "slug", value: form.slug, message: t("slugRequired"), validate: validators.required },
      { field: "name", value: form.name, message: t("nameRequired"), validate: validators.required },
      { field: "reason", value: reason, message: t("reasonRequired"), validate: validators.required },
      { field: "reason", value: reason, message: t("reasonRequired"), validate: validators.minLength(3) },
    ]);
    if (Object.keys(errs).length > 0) { fe.setFieldErrors(errs); return; }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/postcards/${detail.id}`, {
        body: JSON.stringify({
          config: buildConfig(form),
          kind: form.kind,
          reason: reason.trim(),
          slug: form.slug
        }),
        method: "PATCH"
      });
      if (!r.ok) {
        const parsed = await parseApiError(r, t("updateFailed"));
        fe.setFieldErrors(parsed.fields);
        if (parsed.form) fe.setFormError(parsed.form);
        else toast.error(t("updateFailed"));
        return;
      }
      toast.success(t("updateOk"));
      setEditing(false);
      setReason("");
      void loadList();
      void loadDetail(detail.id);
    } finally {
      setMutating(false);
    }
  }

  async function submitTransition(kind: "publish" | "archive") {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) {
      fe.setFieldError("reason", t("reasonRequired"));
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/postcards/${detail.id}/${kind}`, {
        body: JSON.stringify({ reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === "public_template_requires_no_pii_verification") {
          toast.error(t("publishBlockedNoPii"));
        } else {
          toast.error(t(`${kind}Failed`));
        }
        return;
      }
      toast.success(t(`${kind}Ok`));
      setConfirm(null);
      setReason("");
      void loadList();
      void loadDetail(detail.id);
    } finally {
      setMutating(false);
    }
  }

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const r = await adminApiFetch("/api/admin/growth/share-template/preview", {
        method: "POST",
        body: JSON.stringify({
          headline: form.name || "Sample Headline",
          sub: form.description || "Sample subtitle",
          kind: form.kind,
          config: {
            brandBg: form.brandBg,
            brandBgEnd: form.brandBgEnd,
            brandFg: form.brandFg,
            brandAccent: form.brandAccent,
            badgeKey: "NihonGo BJT",
            pattern: form.pattern !== "none" ? form.pattern : undefined,
          },
        }),
      });
      if (!r.ok) {
        toast.error(t("previewFailed") || "Preview failed");
        return;
      }
      const body = await r.json() as { base64Png: string };
      setPreviewSrc(`data:image/png;base64,${body.base64Png}`);
    } catch {
      toast.error(t("previewFailed") || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "slug", "kind", "name", "privacyClass", "noPiiVerified", "active", "version", "updatedAt"];
    const rows = list.items.map((it) => [
      it.id,
      it.slug,
      it.kind,
      it.name,
      it.privacyClass,
      String(it.noPiiVerified),
      String(it.active),
      String(it.version),
      it.updatedAt
    ]);
    downloadCsv(`growth-postcards-${Date.now()}.csv`, header, rows);
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canManage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label={t("searchPlaceholder")}
            className="min-w-[240px] flex-1 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
          <select
            aria-label={t("filterKind")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setKindFilter(e.target.value as Kind | "all")}
            value={kindFilter}
          >
            <option value="all">{t("filterKindAll")}</option>
            {GROWTH_POSTCARD_EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind_${k}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value as "all" | "published" | "archived")}
            value={statusFilter}
          >
            <option value="all">{t("filterStatusAll")}</option>
            <option value="published">{t("status_published")}</option>
            <option value="archived">{t("status_archived")}</option>
          </select>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
            {t("actionExportCsv")}
          </button>
          {canManage ? (
            <button
              className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
              onClick={() => {
                setCreating(true);
                setEditing(false);
                setForm(DEFAULT_FORM);
                setReason("");
                setSelectedId(null);
                setPreviewSrc(null);
              }}
              type="button"
            >
              {t("actionCreate")}
            </button>
          ) : null}
        </div>
      </AdminSection>

      {listError ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {listError}
        </div>
      ) : null}

      <AdminSection>
        <AdminDataTable>
          <AdminDataTableHead>
            <AdminDataTableRow>
              <AdminDataTableTh>{t("colSlug")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colKind")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colPrivacyClass")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
            </AdminDataTableRow>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {list && list.items.length > 0 ? (
              list.items.map((it) => (
                <AdminDataTableRow
                  key={it.id}
                  className={cn("cursor-pointer", selectedId === it.id ? "bg-indigo-50" : "")}
                  onClick={() => {
                    setSelectedId(it.id);
                    setEditing(false);
                    setCreating(false);
                  }}
                >
                  <AdminDataTableTd>
                    <code className="text-xs">{it.slug}</code>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{t(`kind_${it.kind}`)}</AdminDataTableTd>
                  <AdminDataTableTd>{it.name}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={it.privacyClass === "public" ? "warning" : "neutral"}>
                      {t(`privacy_${it.privacyClass}`)}
                    </AdminStatusBadge>
                    {it.privacyClass === "public" && !it.noPiiVerified ? (
                      <span className="ml-1 text-xs text-amber-600">⚠ {t("noPiiPending")}</span>
                    ) : null}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={it.active ? "good" : "neutral"}>
                      {it.active ? t("status_published") : t("status_archived")}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{formatWhen(it.updatedAt, locale)}</AdminDataTableTd>
                </AdminDataTableRow>
              ))
            ) : (
              <AdminDataTableRow>
                <AdminDataTableTd colSpan={6}>
                  <AdminEmptyState title={common.empty} />
                </AdminDataTableTd>
              </AdminDataTableRow>
            )}
          </AdminDataTableBody>
        </AdminDataTable>
        {list ? (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>
              {common.records}: {list.total}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded border px-2 py-1 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                {t("prevPage")}
              </button>
              <span>
                {t("pageLabel")} {page} / {totalPages}
              </span>
              <button
                className="rounded border px-2 py-1 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                {t("nextPage")}
              </button>
            </div>
          </div>
        ) : null}
      </AdminSection>

      {creating || editing ? (
        <AdminSection>
          <h3 className="text-lg font-semibold">{creating ? t("createHeading") : t("editHeading")}</h3>
          <div className="mb-3 flex items-center justify-between">
            <FormError message={fe.errors.form} className="flex-1" />
            <AdminAutoFill
              formType="growth-postcard"
              onFill={(fields) => {
                const f = fields as Partial<FormState>;
                setForm((prev) => ({
                  ...prev,
                  ...(f.slug !== undefined && { slug: String(f.slug) }),
                  ...(f.kind !== undefined && { kind: f.kind as FormState["kind"] }),
                  ...(f.name !== undefined && { name: String(f.name) }),
                  ...(f.description !== undefined && { description: String(f.description) }),
                  ...(f.bodyTemplate !== undefined && { bodyTemplate: String(f.bodyTemplate) }),
                  ...(f.variables !== undefined && { variables: String(f.variables) }),
                  ...(f.thumbnailKey !== undefined && { thumbnailKey: String(f.thumbnailKey) }),
                  ...(f.privacyClass !== undefined && { privacyClass: f.privacyClass as FormState["privacyClass"] }),
                  ...(f.noPiiVerified !== undefined && { noPiiVerified: Boolean(f.noPiiVerified) }),
                  ...(f.brandBg !== undefined && { brandBg: String(f.brandBg) }),
                  ...(f.brandBgEnd !== undefined && { brandBgEnd: String(f.brandBgEnd) }),
                  ...(f.brandFg !== undefined && { brandFg: String(f.brandFg) }),
                  ...(f.brandAccent !== undefined && { brandAccent: String(f.brandAccent) }),
                  ...(f.pattern !== undefined && { pattern: String(f.pattern) }),
                }));
              }}
              labels={{ button: t("autoFill") || "Auto Fill" }}
              disabled={mutating}
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              {t("formSlug")} <span className="text-red-500">*</span>
              <input
                className={cn("mt-1 w-full rounded border px-2 py-1", fe.fieldError("slug") ? "border-red-400 bg-red-50/50" : "border-slate-300")}
                onChange={(e) => { setForm((f) => ({ ...f, slug: e.target.value })); fe.clearFieldError("slug"); }}
                pattern="[a-zA-Z0-9_\-]+"
                value={form.slug}
              />
              {fe.fieldError("slug") && <p className="text-xs text-red-600">{fe.fieldError("slug")}</p>}
            </label>
            <label className="text-sm">
              {t("formKind")}
              <select
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))}
                value={form.kind}
              >
                {GROWTH_POSTCARD_EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kind_${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              {t("formName")} <span className="text-red-500">*</span>
              <input
                className={cn("mt-1 w-full rounded border px-2 py-1", fe.fieldError("name") ? "border-red-400 bg-red-50/50" : "border-slate-300")}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); fe.clearFieldError("name"); }}
                value={form.name}
              />
              {fe.fieldError("name") && <p className="text-xs text-red-600">{fe.fieldError("name")}</p>}
            </label>
            <label className="text-sm md:col-span-2">
              {t("formDescription")}
              <textarea
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                value={form.description}
              />
            </label>
            <label className="text-sm md:col-span-2">
              {t("formBodyTemplate")}
              <textarea
                className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                rows={5}
                value={form.bodyTemplate}
              />
              <span className="text-xs text-muted-foreground">{t("bodyTemplateHint")}</span>
            </label>
            <label className="text-sm md:col-span-2">
              {t("formVariables")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))}
                placeholder="user_name, streak_days"
                value={form.variables}
              />
            </label>
            <label className="text-sm">
              {t("formThumbnailKey")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, thumbnailKey: e.target.value }))}
                value={form.thumbnailKey}
              />
            </label>
            <label className="text-sm">
              {t("formPrivacyClass")}
              <select
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, privacyClass: e.target.value as PrivacyClass }))}
                value={form.privacyClass}
                title={t("privacyClassTooltip")}
              >
                {GROWTH_TEMPLATE_PRIVACY_CLASSES.map((p) => (
                  <option key={p} value={p}>
                    {t(`privacy_${p}`)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">{t(`privacyDesc_${form.privacyClass}`)}</span>
            </label>
            {form.privacyClass === "public" ? (
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  checked={form.noPiiVerified}
                  onChange={(e) => setForm((f) => ({ ...f, noPiiVerified: e.target.checked }))}
                  type="checkbox"
                />
                <span>{t("noPiiCheckbox")}</span>
              </label>
            ) : null}
            <div className="md:col-span-2">
              <h4 className="mb-2 text-sm font-semibold">{t("brandColors") || "Brand Colors"}</h4>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <label className="text-sm">
                  {t("brandBgLabel") || "Background"}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-8 w-8 cursor-pointer rounded border p-0"
                      value={form.brandBg}
                      onChange={(e) => setForm((f) => ({ ...f, brandBg: e.target.value }))}
                    />
                    <span className="font-mono text-xs">{form.brandBg}</span>
                  </div>
                </label>
                <label className="text-sm">
                  {t("brandBgEndLabel") || "Gradient End"}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-8 w-8 cursor-pointer rounded border p-0"
                      value={form.brandBgEnd || "#000000"}
                      onChange={(e) => setForm((f) => ({ ...f, brandBgEnd: e.target.value }))}
                    />
                    <span className="font-mono text-xs">{form.brandBgEnd || "—"}</span>
                  </div>
                </label>
                <label className="text-sm">
                  {t("brandFgLabel") || "Text Color"}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-8 w-8 cursor-pointer rounded border p-0"
                      value={form.brandFg}
                      onChange={(e) => setForm((f) => ({ ...f, brandFg: e.target.value }))}
                    />
                    <span className="font-mono text-xs">{form.brandFg}</span>
                  </div>
                </label>
                <label className="text-sm">
                  {t("brandAccentLabel") || "Accent"}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      className="h-8 w-8 cursor-pointer rounded border p-0"
                      value={form.brandAccent}
                      onChange={(e) => setForm((f) => ({ ...f, brandAccent: e.target.value }))}
                    />
                    <span className="font-mono text-xs">{form.brandAccent}</span>
                  </div>
                </label>
              </div>
              <label className="mt-3 block text-sm">
                {t("patternLabel") || "Pattern"}
                <select
                  className="mt-1 w-full rounded border px-2 py-1 md:w-48"
                  value={form.pattern}
                  onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                >
                  <option value="none">{t("pattern_none") || "None"}</option>
                  <option value="dots">{t("pattern_dots") || "Dots"}</option>
                  <option value="waves">{t("pattern_waves") || "Waves"}</option>
                  <option value="grid">{t("pattern_grid") || "Grid"}</option>
                  <option value="stripes">{t("pattern_stripes") || "Stripes"}</option>
                </select>
              </label>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">{t("previewHeading")}</h4>
                <button
                  className="rounded border px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                  disabled={previewLoading || mutating}
                  onClick={() => void loadPreview()}
                  type="button"
                >
                  {previewLoading ? t("loading") || "Loading..." : t("actionPreview") || "Preview PNG"}
                </button>
              </div>
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Postcard preview"
                  className="mt-2 w-full max-w-[600px] rounded border shadow-sm"
                  style={{ aspectRatio: "1200/630" }}
                />
              ) : (
                <div className="mt-1 rounded border bg-slate-50 p-3 text-sm">
                  {renderPreview(form.bodyTemplate, {
                    user_name: t("sampleUserName") || "Learner",
                    streak_days: "30",
                    level: "N3",
                    score: "85"
                  })}
                </div>
              )}
            </div>
            <label className="text-sm md:col-span-2">
              {t("formReason")} <span className="text-red-500">*</span>
              <input
                className={cn("mt-1 w-full rounded border px-2 py-1", fe.fieldError("reason") ? "border-red-400 bg-red-50/50" : "border-slate-300")}
                onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }}
                value={reason}
              />
              {fe.fieldError("reason") && <p className="text-xs text-red-600">{fe.fieldError("reason")}</p>}
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              disabled={mutating}
              onClick={() => (creating ? void submitCreate() : void submitEdit())}
              type="button"
            >
              {creating ? t("createSubmit") : t("editSubmit")}
            </button>
            <button
              className="rounded border px-3 py-1 text-sm"
              onClick={() => {
                setCreating(false);
                setEditing(false);
                setReason("");
                setPreviewSrc(null);
                fe.clearAll();
              }}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
        </AdminSection>
      ) : null}

      {detail && !creating && !editing ? (
        <AdminSection>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{detail.name}</h3>
              <p className="text-sm text-muted-foreground">
                <code>{detail.slug}</code> · {t(`kind_${detail.kind}`)} · v{detail.version} ·{" "}
                <AdminStatusBadge tone={detail.privacyClass === "public" ? "warning" : "neutral"}>
                  {t(`privacy_${detail.privacyClass}`)}
                </AdminStatusBadge>
              </p>
              {detail.privacyClass === "public" && !detail.noPiiVerified ? (
                <p className="mt-1 text-xs text-amber-600">⚠ {t("noPiiPending")}</p>
              ) : null}
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-1">
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => {
                    setEditing(true);
                    setForm(detailToForm(detail));
                    setReason("");
                    setPreviewSrc(null);
                  }}
                  type="button"
                >
                  {t("actionEdit")}
                </button>
                {!detail.active ? (
                  <button
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => { fe.clearFieldError("reason"); setConfirm({ kind: "publish" }); }}
                    type="button"
                  >
                    {t("actionPublish")}
                  </button>
                ) : (
                  <button
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => { fe.clearFieldError("reason"); setConfirm({ kind: "archive" }); }}
                    type="button"
                  >
                    {t("actionArchive")}
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {detail.config.description ? (
            <p className="mt-2 text-sm">{detail.config.description}</p>
          ) : null}
          <details className="mt-2 text-sm">
            <summary>{t("bodyTemplate")}</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{detail.config.bodyTemplate}</pre>
          </details>
          <h4 className="mt-3 text-sm font-semibold">{t("detailAudit")}</h4>
          {detail.audit.length > 0 ? (
            <ul className="mt-1 space-y-1 text-xs">
              {detail.audit.map((a) => (
                <li key={a.id} className="rounded border p-2">
                  <code>{a.action}</code> · {formatWhen(a.createdAt, locale)}
                  {a.actor ? <> · {a.actor.displayName ?? a.actor.email}</> : null}
                  {a.reason ? <> · &ldquo;{a.reason}&rdquo;</> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{t("detailAuditEmpty")}</p>
          )}
        </AdminSection>
      ) : null}

      {confirm ? (
        <div
          aria-label={t(`confirmHeading_${confirm.kind}`)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded bg-white p-4 shadow">
            <h4 className="text-lg font-semibold">{t(`confirmHeading_${confirm.kind}`)}</h4>
            <p className="mt-1 text-sm">{t(`confirmBody_${confirm.kind}`)}</p>
            <input
              aria-label={t("formReason")}
              className={cn("mt-3 w-full rounded border px-2 py-1 text-sm", fe.fieldError("reason") ? "border-red-400 bg-red-50/50 text-red-900" : "border-slate-300")}
              onChange={(e) => { setReason(e.target.value); fe.clearFieldError("reason"); }}
              placeholder={t("formReason")}
              value={reason}
            />
            {fe.fieldError("reason") && <p className="mt-1 text-xs text-red-600">{fe.fieldError("reason")}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => {
                  setConfirm(null);
                  setReason("");
                  fe.clearFieldError("reason");
                }}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                disabled={mutating}
                onClick={() => void submitTransition(confirm.kind)}
                type="button"
              >
                {t(`confirmSubmit_${confirm.kind}`)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}
