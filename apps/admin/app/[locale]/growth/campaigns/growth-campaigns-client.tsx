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
  GROWTH_CAMPAIGN_CHANNELS,
  GROWTH_CAMPAIGN_STATUSES
} from "@nihongo-bjt/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Status = (typeof GROWTH_CAMPAIGN_STATUSES)[number];
type Channel = (typeof GROWTH_CAMPAIGN_CHANNELS)[number];

type Summary = {
  id: string;
  name: string;
  status: Status;
  channel: Channel;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: Summary[];
  total: number;
  page: number;
  pageSize: number;
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
  description: string | null;
  contentBody: string | null;
  audience: Record<string, unknown>;
  cta: Record<string, unknown>;
  trackingUtm: Record<string, unknown>;
  ethicsWarnings: string[];
  audit: AuditEntry[];
};

type FormState = {
  name: string;
  description: string;
  channel: Channel;
  contentBody: string;
  audienceLocale: string;
  audiencePlan: string;
  audienceLevel: string;
  audienceCountry: string;
  ctaLabel: string;
  ctaUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  scheduleStart: string;
  scheduleEnd: string;
};

const DEFAULT_FORM: FormState = {
  audienceCountry: "",
  audienceLevel: "",
  audienceLocale: "",
  audiencePlan: "",
  channel: "in_app",
  contentBody: "",
  ctaLabel: "",
  ctaUrl: "",
  description: "",
  name: "",
  scheduleEnd: "",
  scheduleStart: "",
  utmCampaign: "",
  utmMedium: "",
  utmSource: ""
};

const STATUS_TONE: Record<Status, "danger" | "good" | "neutral" | "warning"> = {
  active: "good",
  archived: "neutral",
  draft: "warning",
  ended: "neutral",
  scheduled: "warning"
};

const PAGE_SIZE = 25;

type StatusFilter = Status | "all";
type ChannelFilter = Channel | "all";

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

function buildBody(form: FormState) {
  return {
    audience: {
      country: form.audienceCountry || undefined,
      level: form.audienceLevel || undefined,
      locale: form.audienceLocale || undefined,
      plan: form.audiencePlan || undefined
    },
    channel: form.channel,
    contentBody: form.contentBody || undefined,
    cta: { label: form.ctaLabel || undefined, url: form.ctaUrl || undefined },
    description: form.description || undefined,
    name: form.name,
    scheduleEnd: form.scheduleEnd ? new Date(form.scheduleEnd).toISOString() : null,
    scheduleStart: form.scheduleStart ? new Date(form.scheduleStart).toISOString() : null,
    trackingUtm: {
      campaign: form.utmCampaign || undefined,
      medium: form.utmMedium || undefined,
      source: form.utmSource || undefined
    }
  };
}

function detailToForm(d: Detail): FormState {
  const a = (d.audience ?? {}) as Record<string, string>;
  const c = (d.cta ?? {}) as Record<string, string>;
  const u = (d.trackingUtm ?? {}) as Record<string, string>;
  const toIso = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 16) : "");
  return {
    audienceCountry: a.country ?? "",
    audienceLevel: a.level ?? "",
    audienceLocale: a.locale ?? "",
    audiencePlan: a.plan ?? "",
    channel: d.channel,
    contentBody: d.contentBody ?? "",
    ctaLabel: c.label ?? "",
    ctaUrl: c.url ?? "",
    description: d.description ?? "",
    name: d.name,
    scheduleEnd: toIso(d.scheduleEnd),
    scheduleStart: toIso(d.scheduleStart),
    utmCampaign: u.campaign ?? "",
    utmMedium: u.medium ?? "",
    utmSource: u.source ?? ""
  };
}

export function GrowthCampaignsClient({
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
  const [listLoading, setListLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "schedule" | "activate" | "end" | "archive" | "duplicate" }
    | null
  >(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [audienceEstimate, setAudienceEstimate] = useState<number | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, statusFilter, channelFilter]);

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
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (channelFilter !== "all") params.set("channel", channelFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/growth/campaigns?${params.toString()}`);
      if (!r.ok) {
        setList(null);
        setListError(common.error);
        return;
      }
      setList((await r.json()) as ListResponse);
    } catch {
      setListError(common.error);
    } finally {
      setListLoading(false);
    }
  }, [debounced, statusFilter, channelFilter, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/campaigns/${id}`);
      if (!r.ok) {
        setDetail(null);
        return;
      }
      setDetail((await r.json()) as Detail);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  // Audience estimate (debounced)
  useEffect(() => {
    if (!creating && !editing) return;
    const h = setTimeout(async () => {
      const params = new URLSearchParams();
      if (form.audienceLocale) params.set("locale", form.audienceLocale);
      if (form.audienceLevel) params.set("level", form.audienceLevel);
      if (form.audiencePlan) params.set("plan", form.audiencePlan);
      if (form.audienceCountry) params.set("country", form.audienceCountry);
      try {
        const r = await adminApiFetch(`/api/admin/growth/campaigns/audience-estimate?${params.toString()}`);
        if (r.ok) {
          const body = (await r.json()) as { total: number };
          setAudienceEstimate(body.total);
        }
      } catch {
        setAudienceEstimate(null);
      }
    }, 400);
    return () => clearTimeout(h);
  }, [creating, editing, form.audienceLocale, form.audienceLevel, form.audiencePlan, form.audienceCountry]);

  const ethicsWarnings = useMemo(() => {
    const text = `${form.name}\n${form.description}\n${form.contentBody}`;
    const out: string[] = [];
    if (/\bshame\b/i.test(text)) out.push(t("ethicsWarnShame"));
    if (/lose\s+your\s+streak/i.test(text)) out.push(t("ethicsWarnStreakShame"));
    if (/limited\s+time\s+offer\s+ending\s+in\s+\d+\s*(seconds?|minutes?)/i.test(text))
      out.push(t("ethicsWarnUrgency"));
    return out;
  }, [form.name, form.description, form.contentBody, t]);

  async function submitCreate() {
    if (!canManage) return;
    if (!form.name.trim() || form.name.trim().length < 2) {
      setToast({ kind: "err", text: t("formErrName") });
      return;
    }
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch("/api/admin/growth/campaigns", {
        body: JSON.stringify({ ...buildBody(form), reason: reason.trim() }),
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
      const r = await adminApiFetch(`/api/admin/growth/campaigns/${detail.id}`, {
        body: JSON.stringify({ ...buildBody(form), reason: reason.trim() }),
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

  async function submitTransition(kind: "schedule" | "activate" | "end" | "archive" | "duplicate") {
    if (!canManage || !detail) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/growth/campaigns/${detail.id}/${kind}`, {
        body: JSON.stringify({ reason: reason.trim() }),
        method: "POST"
      });
      if (!r.ok) {
        setToast({ kind: "err", text: t(`${kind}Failed`) });
        return;
      }
      const body = (await r.json()) as Detail;
      setToast({ kind: "ok", text: t(`${kind}Ok`) });
      setConfirm(null);
      setReason("");
      if (kind === "duplicate") setSelectedId(body.id);
      void loadList();
      void loadDetail(body.id);
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "name", "status", "channel", "scheduleStart", "scheduleEnd", "updatedAt"];
    const rows = list.items.map((it) => [
      it.id,
      it.name,
      it.status,
      it.channel,
      it.scheduleStart ?? "",
      it.scheduleEnd ?? "",
      it.updatedAt
    ]);
    downloadCsv(`growth-campaigns-${Date.now()}.csv`, header, rows);
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
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            value={statusFilter}
          >
            <option value="all">{t("filterStatusAll")}</option>
            {GROWTH_CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status_${s}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("filterChannel")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
            value={channelFilter}
          >
            <option value="all">{t("filterChannelAll")}</option>
            {GROWTH_CAMPAIGN_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`channel_${c}`)}
              </option>
            ))}
          </select>
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={() => void loadList()}
            type="button"
          >
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
              <AdminDataTableTh>{t("colName")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colChannel")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colScheduleStart")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colScheduleEnd")}</AdminDataTableTh>
              <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
            </AdminDataTableRow>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {listLoading && !list ? (
              <AdminDataTableRow>
                <AdminDataTableTd colSpan={6}>{common.loading}</AdminDataTableTd>
              </AdminDataTableRow>
            ) : list && list.items.length > 0 ? (
              list.items.map((it) => (
                <AdminDataTableRow
                  key={it.id}
                  className={cn(
                    "cursor-pointer",
                    selectedId === it.id ? "bg-indigo-50" : ""
                  )}
                  onClick={() => {
                    setSelectedId(it.id);
                    setEditing(false);
                    setCreating(false);
                  }}
                >
                  <AdminDataTableTd>{it.name}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={STATUS_TONE[it.status]}>{t(`status_${it.status}`)}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{t(`channel_${it.channel}`)}</AdminDataTableTd>
                  <AdminDataTableTd>{formatWhen(it.scheduleStart, locale)}</AdminDataTableTd>
                  <AdminDataTableTd>{formatWhen(it.scheduleEnd, locale)}</AdminDataTableTd>
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
          {ethicsWarnings.length > 0 ? (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              <strong>{t("ethicsWarningsHeading")}</strong>
              <ul className="ml-4 list-disc">
                {ethicsWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              {t("formName")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                value={form.name}
              />
            </label>
            <label className="text-sm">
              {t("formChannel")}
              <select
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as Channel }))}
                value={form.channel}
              >
                {GROWTH_CAMPAIGN_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {t(`channel_${c}`)}
                  </option>
                ))}
              </select>
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
              {t("formContentBody")}
              <textarea
                className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                onChange={(e) => setForm((f) => ({ ...f, contentBody: e.target.value }))}
                rows={6}
                value={form.contentBody}
              />
            </label>
            <fieldset className="rounded border p-2 md:col-span-2">
              <legend className="text-sm font-semibold">{t("blockAudience")}</legend>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-xs">
                  {t("formAudienceLocale")}
                  <input
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(e) => setForm((f) => ({ ...f, audienceLocale: e.target.value }))}
                    placeholder="vi"
                    value={form.audienceLocale}
                  />
                </label>
                <label className="text-xs">
                  {t("formAudiencePlan")}
                  <input
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(e) => setForm((f) => ({ ...f, audiencePlan: e.target.value }))}
                    placeholder="free"
                    value={form.audiencePlan}
                  />
                </label>
                <label className="text-xs">
                  {t("formAudienceLevel")}
                  <input
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(e) => setForm((f) => ({ ...f, audienceLevel: e.target.value }))}
                    placeholder="N3"
                    value={form.audienceLevel}
                  />
                </label>
                <label className="text-xs">
                  {t("formAudienceCountry")}
                  <input
                    className="mt-1 w-full rounded border px-2 py-1"
                    onChange={(e) => setForm((f) => ({ ...f, audienceCountry: e.target.value }))}
                    placeholder="JP"
                    value={form.audienceCountry}
                  />
                </label>
              </div>
              {audienceEstimate != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("audienceEstimate")}: {audienceEstimate.toLocaleString()}
                </p>
              ) : null}
            </fieldset>
            <fieldset className="rounded border p-2 md:col-span-2">
              <legend className="text-sm font-semibold">{t("blockCta")}</legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  aria-label={t("formCtaLabel")}
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                  placeholder={t("formCtaLabel")}
                  value={form.ctaLabel}
                />
                <input
                  aria-label={t("formCtaUrl")}
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                  placeholder="https://"
                  value={form.ctaUrl}
                />
              </div>
            </fieldset>
            <fieldset className="rounded border p-2 md:col-span-2">
              <legend className="text-sm font-semibold">{t("blockUtm")}</legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  aria-label="utm_source"
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, utmSource: e.target.value }))}
                  placeholder="utm_source"
                  value={form.utmSource}
                />
                <input
                  aria-label="utm_medium"
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, utmMedium: e.target.value }))}
                  placeholder="utm_medium"
                  value={form.utmMedium}
                />
                <input
                  aria-label="utm_campaign"
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, utmCampaign: e.target.value }))}
                  placeholder="utm_campaign"
                  value={form.utmCampaign}
                />
              </div>
            </fieldset>
            <label className="text-sm">
              {t("formScheduleStart")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, scheduleStart: e.target.value }))}
                type="datetime-local"
                value={form.scheduleStart}
              />
            </label>
            <label className="text-sm">
              {t("formScheduleEnd")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                onChange={(e) => setForm((f) => ({ ...f, scheduleEnd: e.target.value }))}
                type="datetime-local"
                value={form.scheduleEnd}
              />
            </label>
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
                <AdminStatusBadge tone={STATUS_TONE[detail.status]}>{t(`status_${detail.status}`)}</AdminStatusBadge>{" "}
                · {t(`channel_${detail.channel}`)}
              </p>
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
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setConfirm({ kind: "schedule" })}
                  type="button"
                >
                  {t("actionSchedule")}
                </button>
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setConfirm({ kind: "activate" })}
                  type="button"
                >
                  {t("actionActivate")}
                </button>
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setConfirm({ kind: "end" })}
                  type="button"
                >
                  {t("actionEnd")}
                </button>
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setConfirm({ kind: "archive" })}
                  type="button"
                >
                  {t("actionArchive")}
                </button>
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setConfirm({ kind: "duplicate" })}
                  type="button"
                >
                  {t("actionDuplicate")}
                </button>
              </div>
            ) : null}
          </div>
          {detail.ethicsWarnings.length > 0 ? (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              <strong>{t("ethicsWarningsHeading")}</strong>
              <ul className="ml-4 list-disc">
                {detail.ethicsWarnings.map((w, i) => (
                  <li key={`${w}-${i}`}>
                    <code>{w}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detail.description ? <p className="mt-2 text-sm">{detail.description}</p> : null}
          {detail.contentBody ? (
            <details className="mt-2 text-sm">
              <summary>{t("contentBody")}</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">
                {detail.contentBody}
              </pre>
            </details>
          ) : null}

          <h4 className="mt-3 text-sm font-semibold">{t("detailAudit")}</h4>
          {detail.audit.length > 0 ? (
            <ul className="mt-1 space-y-1 text-xs">
              {detail.audit.map((a) => (
                <li key={a.id} className="rounded border p-2">
                  <code>{a.action}</code>
                  {" · "}
                  <span>{formatWhen(a.createdAt, locale)}</span>
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

      {detailLoading ? <p className="text-xs text-muted-foreground">{common.loading}</p> : null}

      {toast ? (
        <div
          aria-live="polite"
          className={cn(
            "fixed bottom-4 right-4 rounded p-3 text-sm shadow",
            toast.kind === "ok" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"
          )}
          role="status"
          onAnimationEnd={() => setToast(null)}
        >
          {toast.text}
          <button
            aria-label="dismiss"
            className="ml-2 underline"
            onClick={() => setToast(null)}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
