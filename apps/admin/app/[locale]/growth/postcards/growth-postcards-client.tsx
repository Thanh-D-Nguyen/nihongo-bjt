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
  GROWTH_POSTCARD_EVENT_KINDS,
  GROWTH_TEMPLATE_PRIVACY_CLASSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

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
};

const DEFAULT_FORM: FormState = {
  bodyTemplate: "",
  description: "",
  kind: "streak",
  name: "",
  noPiiVerified: false,
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

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
function permsFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) {
    for (const link of r.role?.permissions ?? []) {
      const code = link.permission?.code;
      if (code) out.add(code);
    }
  }
  return out;
}

function buildConfig(form: FormState) {
  return {
    bodyTemplate: form.bodyTemplate,
    description: form.description || undefined,
    name: form.name,
    noPiiVerified: form.noPiiVerified,
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
    description: d.config.description ?? "",
    kind: d.kind,
    name: d.config.name ?? d.name,
    noPiiVerified: d.config.noPiiVerified === true,
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
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
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
        setToast({ kind: "err", text: t("createFailed") });
        return;
      }
      const body = (await r.json()) as Detail;
      setToast({ kind: "ok", text: t("createOk") });
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
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
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
        setToast({ kind: "err", text: t("updateFailed") });
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
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
      setToast({ kind: "err", text: t("reasonRequired") });
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
          setToast({ kind: "err", text: t("publishBlockedNoPii") });
        } else {
          setToast({ kind: "err", text: t(`${kind}Failed`) });
        }
        return;
      }
      setToast({ kind: "ok", text: t(`${kind}Ok`) });
      setConfirm(null);
      setReason("");
      void loadList();
      void loadDetail(detail.id);
    } finally {
      setMutating(false);
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
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              {t("formSlug")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                pattern="[a-zA-Z0-9_\-]+"
                value={form.slug}
              />
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
              {t("formName")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                value={form.name}
              />
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
              <h4 className="text-sm font-semibold">{t("previewHeading")}</h4>
              <div className="mt-1 rounded border bg-slate-50 p-3 text-sm">
                {renderPreview(form.bodyTemplate, {
                  user_name: t("sampleUserName"),
                  streak_days: "30",
                  level: "N3",
                  score: "85"
                })}
              </div>
            </div>
            <label className="text-sm md:col-span-2">
              {t("formReason")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setReason(e.target.value)}
                value={reason}
              />
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
                  }}
                  type="button"
                >
                  {t("actionEdit")}
                </button>
                {!detail.active ? (
                  <button
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => setConfirm({ kind: "publish" })}
                    type="button"
                  >
                    {t("actionPublish")}
                  </button>
                ) : (
                  <button
                    className="rounded border px-2 py-1 text-xs"
                    onClick={() => setConfirm({ kind: "archive" })}
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
              className="mt-3 w-full rounded border px-2 py-1 text-sm"
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("formReason")}
              value={reason}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => {
                  setConfirm(null);
                  setReason("");
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

      {toast ? (
        <div
          aria-live="polite"
          className={cn(
            "fixed bottom-4 right-4 rounded p-3 text-sm shadow",
            toast.kind === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"
          )}
          role="status"
        >
          {toast.text}
          <button aria-label="dismiss" className="ml-2 underline" onClick={() => setToast(null)} type="button">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
