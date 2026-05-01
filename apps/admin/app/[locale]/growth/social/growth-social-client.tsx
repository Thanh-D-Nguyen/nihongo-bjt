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
  GROWTH_SOCIAL_TEMPLATE_KINDS,
  GROWTH_TEMPLATE_PRIVACY_CLASSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;
type Kind = (typeof GROWTH_SOCIAL_TEMPLATE_KINDS)[number];
type PrivacyClass = (typeof GROWTH_TEMPLATE_PRIVACY_CLASSES)[number];

type TemplateSummary = {
  id: string;
  slug: string;
  kind: Kind;
  name: string;
  privacyClass: PrivacyClass;
  noPiiVerified: boolean;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type TemplateListResponse = { items: TemplateSummary[]; total: number; page: number; pageSize: number };

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
};

type TemplateDetail = TemplateSummary & {
  config: {
    name: string;
    description?: string;
    bodyTemplate: string;
    privacyClass: PrivacyClass;
    noPiiVerified?: boolean;
    surface: "social";
    [k: string]: unknown;
  };
  audit: AuditEntry[];
};

type ShareEvent = {
  id: string;
  publicToken: string;
  kind: string;
  hidden: boolean;
  expiresAt: string | null;
  createdAt: string;
  template: { id: string; kind: string; slug: string } | null;
  user: { id: string; displayName: string };
  summaryPreview: { headline?: string; sub?: string };
};
type EventListResponse = { items: ShareEvent[]; total: number; page: number; pageSize: number };

type FormState = {
  slug: string;
  kind: Kind;
  name: string;
  description: string;
  bodyTemplate: string;
  privacyClass: PrivacyClass;
  noPiiVerified: boolean;
};
const DEFAULT_FORM: FormState = {
  bodyTemplate: "",
  description: "",
  kind: "social_link",
  name: "",
  noPiiVerified: false,
  privacyClass: "anonymized",
  slug: ""
};

const PAGE_SIZE = 25;

function formatWhen(iso: string | null, locale: string) {
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
    surface: "social" as const
  };
}

function detailToForm(d: TemplateDetail): FormState {
  return {
    bodyTemplate: d.config.bodyTemplate ?? "",
    description: d.config.description ?? "",
    kind: d.kind,
    name: d.config.name ?? d.name,
    noPiiVerified: d.config.noPiiVerified === true,
    privacyClass: d.config.privacyClass,
    slug: d.slug
  };
}

export function GrowthSocialClient({
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

  const [tab, setTab] = useState<"templates" | "events">("templates");

  // Templates state
  const [templates, setTemplates] = useState<TemplateListResponse | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);
  const [tplSearch, setTplSearch] = useState("");
  const [tplDebounced, setTplDebounced] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "archived">("all");
  const [tplPage, setTplPage] = useState(1);
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
  const [tplDetail, setTplDetail] = useState<TemplateDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [reason, setReason] = useState("");
  const [confirmTpl, setConfirmTpl] = useState<{ kind: "publish" | "archive" } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Events state
  const [events, setEvents] = useState<EventListResponse | null>(null);
  const [evHidden, setEvHidden] = useState<"all" | "active" | "hidden">("all");
  const [evPage, setEvPage] = useState(1);
  const [moderate, setModerate] = useState<{
    eventId: string;
    action: "dismiss" | "hide_from_public" | "report_to_legal";
  } | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setTplDebounced(tplSearch.trim()), 300);
    return () => clearTimeout(h);
  }, [tplSearch]);
  useEffect(() => {
    setTplPage(1);
  }, [tplDebounced, kindFilter, statusFilter]);
  useEffect(() => {
    setEvPage(1);
  }, [evHidden]);

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

  const loadTemplates = useCallback(async () => {
    if (tab !== "templates") return;
    try {
      const params = new URLSearchParams();
      if (tplDebounced) params.set("q", tplDebounced);
      if (kindFilter !== "all") params.set("kind", kindFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(tplPage));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/growth/social/templates?${params.toString()}`);
      if (!r.ok) {
        setTplError(common.error);
        setTemplates(null);
        return;
      }
      setTplError(null);
      setTemplates((await r.json()) as TemplateListResponse);
    } catch {
      setTplError(common.error);
    }
  }, [tab, tplDebounced, kindFilter, statusFilter, tplPage, common.error]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const loadTplDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/growth/social/templates/${id}`);
    if (!r.ok) {
      setTplDetail(null);
      return;
    }
    setTplDetail((await r.json()) as TemplateDetail);
  }, []);

  useEffect(() => {
    if (selectedTplId) void loadTplDetail(selectedTplId);
    else setTplDetail(null);
  }, [selectedTplId, loadTplDetail]);

  const loadEvents = useCallback(async () => {
    if (tab !== "events") return;
    const params = new URLSearchParams();
    if (evHidden !== "all") params.set("hidden", evHidden);
    params.set("page", String(evPage));
    params.set("pageSize", String(PAGE_SIZE));
    const r = await adminApiFetch(`/api/admin/growth/social/events?${params.toString()}`);
    if (!r.ok) {
      setEvents(null);
      return;
    }
    setEvents((await r.json()) as EventListResponse);
  }, [tab, evHidden, evPage]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function submitCreate() {
    if (!canManage) return;
    if (reason.trim().length < 3) return setToast({ kind: "err", text: t("reasonRequired") });
    setMutating(true);
    try {
      const r = await adminApiFetch("/api/admin/growth/social/templates", {
        body: JSON.stringify({
          config: buildConfig(form),
          kind: form.kind,
          reason: reason.trim(),
          slug: form.slug
        }),
        method: "POST"
      });
      if (!r.ok) return setToast({ kind: "err", text: t("createFailed") });
      const body = (await r.json()) as TemplateDetail;
      setToast({ kind: "ok", text: t("createOk") });
      setCreating(false);
      setForm(DEFAULT_FORM);
      setReason("");
      setSelectedTplId(body.id);
      void loadTemplates();
    } finally {
      setMutating(false);
    }
  }

  async function submitEdit() {
    if (!canManage || !tplDetail) return;
    if (reason.trim().length < 3) return setToast({ kind: "err", text: t("reasonRequired") });
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/social/templates/${tplDetail.id}`, {
        body: JSON.stringify({
          config: buildConfig(form),
          kind: form.kind,
          reason: reason.trim(),
          slug: form.slug
        }),
        method: "PATCH"
      });
      if (!r.ok) return setToast({ kind: "err", text: t("updateFailed") });
      setToast({ kind: "ok", text: t("updateOk") });
      setEditing(false);
      setReason("");
      void loadTemplates();
      void loadTplDetail(tplDetail.id);
    } finally {
      setMutating(false);
    }
  }

  async function submitTplTransition(kind: "publish" | "archive") {
    if (!canManage || !tplDetail) return;
    if (reason.trim().length < 3) return setToast({ kind: "err", text: t("reasonRequired") });
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/social/templates/${tplDetail.id}/${kind}`, {
        body: JSON.stringify({ reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === "public_template_requires_no_pii_verification") {
          return setToast({ kind: "err", text: t("publishBlockedNoPii") });
        }
        return setToast({ kind: "err", text: t(`${kind}Failed`) });
      }
      setToast({ kind: "ok", text: t(`${kind}Ok`) });
      setConfirmTpl(null);
      setReason("");
      void loadTemplates();
      void loadTplDetail(tplDetail.id);
    } finally {
      setMutating(false);
    }
  }

  async function submitModerate() {
    if (!canManage || !moderate) return;
    if (reason.trim().length < 3) return setToast({ kind: "err", text: t("reasonRequired") });
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/social/events/${moderate.eventId}/moderate`, {
        body: JSON.stringify({ action: moderate.action, reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) return setToast({ kind: "err", text: t("moderateFailed") });
      setToast({ kind: "ok", text: t("moderateOk") });
      setModerate(null);
      setReason("");
      void loadEvents();
    } finally {
      setMutating(false);
    }
  }

  const tplTotalPages = templates ? Math.max(1, Math.ceil(templates.total / PAGE_SIZE)) : 1;
  const evTotalPages = events ? Math.max(1, Math.ceil(events.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canManage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex gap-2 border-b text-sm">
          <button
            aria-current={tab === "templates" ? "page" : undefined}
            className={cn("px-3 py-2", tab === "templates" ? "border-b-2 border-indigo-600 font-semibold" : "")}
            onClick={() => setTab("templates")}
            type="button"
          >
            {t("tabTemplates")}
          </button>
          <button
            aria-current={tab === "events" ? "page" : undefined}
            className={cn("px-3 py-2", tab === "events" ? "border-b-2 border-indigo-600 font-semibold" : "")}
            onClick={() => setTab("events")}
            type="button"
          >
            {t("tabEvents")}
          </button>
        </div>
      </AdminSection>

      {tab === "templates" ? (
        <>
          <AdminSection>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label={t("searchPlaceholder")}
                className="min-w-[240px] flex-1 rounded border px-2 py-1 text-sm"
                onChange={(e) => setTplSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                value={tplSearch}
              />
              <select
                aria-label={t("filterKind")}
                className="rounded border px-2 py-1 text-sm"
                onChange={(e) => setKindFilter(e.target.value as Kind | "all")}
                value={kindFilter}
              >
                <option value="all">{t("filterKindAll")}</option>
                {GROWTH_SOCIAL_TEMPLATE_KINDS.map((k) => (
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
              <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadTemplates()} type="button">
                {t("actionRefresh")}
              </button>
              {canManage ? (
                <button
                  className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                  onClick={() => {
                    setCreating(true);
                    setEditing(false);
                    setForm(DEFAULT_FORM);
                    setReason("");
                    setSelectedTplId(null);
                  }}
                  type="button"
                >
                  {t("actionCreate")}
                </button>
              ) : null}
            </div>
          </AdminSection>

          {tplError ? (
            <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              {tplError}
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
                {templates && templates.items.length > 0 ? (
                  templates.items.map((it) => (
                    <AdminDataTableRow
                      key={it.id}
                      className={cn("cursor-pointer", selectedTplId === it.id ? "bg-indigo-50" : "")}
                      onClick={() => {
                        setSelectedTplId(it.id);
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
            {templates ? (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>
                  {common.records}: {templates.total}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={tplPage <= 1}
                    onClick={() => setTplPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    {t("prevPage")}
                  </button>
                  <span>
                    {t("pageLabel")} {tplPage} / {tplTotalPages}
                  </span>
                  <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={tplPage >= tplTotalPages}
                    onClick={() => setTplPage((p) => p + 1)}
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
                    {GROWTH_SOCIAL_TEMPLATE_KINDS.map((k) => (
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
                </label>
                <label className="text-sm">
                  {t("formPrivacyClass")}
                  <select
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(e) => setForm((f) => ({ ...f, privacyClass: e.target.value as PrivacyClass }))}
                    value={form.privacyClass}
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

          {tplDetail && !creating && !editing ? (
            <AdminSection>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{tplDetail.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    <code>{tplDetail.slug}</code> · {t(`kind_${tplDetail.kind}`)} · v{tplDetail.version} ·{" "}
                    <AdminStatusBadge tone={tplDetail.privacyClass === "public" ? "warning" : "neutral"}>
                      {t(`privacy_${tplDetail.privacyClass}`)}
                    </AdminStatusBadge>
                  </p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => {
                        setEditing(true);
                        setForm(detailToForm(tplDetail));
                        setReason("");
                      }}
                      type="button"
                    >
                      {t("actionEdit")}
                    </button>
                    {!tplDetail.active ? (
                      <button
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => setConfirmTpl({ kind: "publish" })}
                        type="button"
                      >
                        {t("actionPublish")}
                      </button>
                    ) : (
                      <button
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => setConfirmTpl({ kind: "archive" })}
                        type="button"
                      >
                        {t("actionArchive")}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              {tplDetail.config.description ? (
                <p className="mt-2 text-sm">{tplDetail.config.description}</p>
              ) : null}
              <details className="mt-2 text-sm">
                <summary>{t("bodyTemplate")}</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">
                  {tplDetail.config.bodyTemplate}
                </pre>
              </details>
              <h4 className="mt-3 text-sm font-semibold">{t("detailAudit")}</h4>
              {tplDetail.audit.length > 0 ? (
                <ul className="mt-1 space-y-1 text-xs">
                  {tplDetail.audit.map((a) => (
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

          {confirmTpl ? (
            <div
              aria-label={t(`confirmHeading_${confirmTpl.kind}`)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
            >
              <div className="w-full max-w-md rounded bg-white p-4 shadow">
                <h4 className="text-lg font-semibold">{t(`confirmHeading_${confirmTpl.kind}`)}</h4>
                <p className="mt-1 text-sm">{t(`confirmBody_${confirmTpl.kind}`)}</p>
                <input
                  className="mt-3 w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("formReason")}
                  value={reason}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm"
                    onClick={() => {
                      setConfirmTpl(null);
                      setReason("");
                    }}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                    disabled={mutating}
                    onClick={() => void submitTplTransition(confirmTpl.kind)}
                    type="button"
                  >
                    {t(`confirmSubmit_${confirmTpl.kind}`)}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "events" ? (
        <>
          <AdminSection>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={t("filterHidden")}
                className="rounded border px-2 py-1 text-sm"
                onChange={(e) => setEvHidden(e.target.value as "all" | "active" | "hidden")}
                value={evHidden}
              >
                <option value="all">{t("filterHiddenAll")}</option>
                <option value="active">{t("filterHiddenActive")}</option>
                <option value="hidden">{t("filterHiddenHidden")}</option>
              </select>
              <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadEvents()} type="button">
                {t("actionRefresh")}
              </button>
            </div>
          </AdminSection>
          <AdminSection>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("colToken")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colKind")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colTemplate")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colPreview")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colHidden")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("colActions")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {events && events.items.length > 0 ? (
                  events.items.map((ev) => (
                    <AdminDataTableRow key={ev.id}>
                      <AdminDataTableTd>
                        <code className="text-xs">{ev.publicToken.slice(0, 12)}…</code>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{ev.kind}</AdminDataTableTd>
                      <AdminDataTableTd>{ev.template?.slug ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd>
                        {ev.summaryPreview.headline ? (
                          <span className="text-xs">{ev.summaryPreview.headline}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("previewRedacted")}</span>
                        )}
                      </AdminDataTableTd>
                      <AdminDataTableTd>{formatWhen(ev.createdAt, locale)}</AdminDataTableTd>
                      <AdminDataTableTd>
                        {ev.hidden ? (
                          <AdminStatusBadge tone="neutral">{t("status_hidden")}</AdminStatusBadge>
                        ) : (
                          <AdminStatusBadge tone="good">{t("status_active")}</AdminStatusBadge>
                        )}
                      </AdminDataTableTd>
                      <AdminDataTableTd>
                        {canManage ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => {
                                setModerate({ action: "dismiss", eventId: ev.id });
                                setReason("");
                              }}
                              type="button"
                            >
                              {t("actionDismiss")}
                            </button>
                            <button
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => {
                                setModerate({ action: "hide_from_public", eventId: ev.id });
                                setReason("");
                              }}
                              type="button"
                            >
                              {t("actionHide")}
                            </button>
                            <button
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => {
                                setModerate({ action: "report_to_legal", eventId: ev.id });
                                setReason("");
                              }}
                              type="button"
                            >
                              {t("actionReport")}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </AdminDataTableTd>
                    </AdminDataTableRow>
                  ))
                ) : (
                  <AdminDataTableRow>
                    <AdminDataTableTd colSpan={7}>
                      <AdminEmptyState title={common.empty} />
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                )}
              </AdminDataTableBody>
            </AdminDataTable>
            {events ? (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>
                  {common.records}: {events.total}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={evPage <= 1}
                    onClick={() => setEvPage((p) => Math.max(1, p - 1))}
                    type="button"
                  >
                    {t("prevPage")}
                  </button>
                  <span>
                    {t("pageLabel")} {evPage} / {evTotalPages}
                  </span>
                  <button
                    className="rounded border px-2 py-1 disabled:opacity-50"
                    disabled={evPage >= evTotalPages}
                    onClick={() => setEvPage((p) => p + 1)}
                    type="button"
                  >
                    {t("nextPage")}
                  </button>
                </div>
              </div>
            ) : null}
          </AdminSection>

          {moderate ? (
            <div
              aria-label={t(`moderateHeading_${moderate.action}`)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
            >
              <div className="w-full max-w-md rounded bg-white p-4 shadow">
                <h4 className="text-lg font-semibold">{t(`moderateHeading_${moderate.action}`)}</h4>
                <p className="mt-1 text-sm">{t(`moderateBody_${moderate.action}`)}</p>
                <input
                  className="mt-3 w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("formReason")}
                  value={reason}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm"
                    onClick={() => {
                      setModerate(null);
                      setReason("");
                    }}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                    disabled={mutating}
                    onClick={() => void submitModerate()}
                    type="button"
                  >
                    {t("moderateSubmit")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
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
