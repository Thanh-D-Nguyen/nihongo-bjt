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
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import {
  type CommonLabels,
  type Labels,
  buildT,
  loadAdminPermissions
} from "../../../_components/admin-client-utils";

type Channel = "push" | "email" | "in_app";
type Status = "draft" | "scheduled" | "sent" | "cancelled";
type Broadcast = {
  id: string;
  title: string;
  body: string;
  channel: Channel;
  audience: Record<string, unknown> | null;
  scheduledAt: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
};
type ListResponse = { items: Broadcast[]; total: number };
type Detail = Broadcast & {
  events: Array<{
    id: string;
    action: string;
    reason: string | null;
    createdAt: string;
    actor: { id: string; displayName: string | null; email: string | null } | null;
  }>;
};

const PAGE_SIZE = 50;

function statusTone(s: Status): "neutral" | "good" | "warning" | "danger" {
  if (s === "draft") return "neutral";
  if (s === "scheduled") return "warning";
  if (s === "sent") return "good";
  return "danger";
}

function parseUserIds(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseCsvList(text: string): string[] | undefined {
  const arr = text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

export function OpsNotificationsClient({ common, labels }: { common: CommonLabels; labels: Labels }) {
  const t = buildT(labels);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);

  const [composing, setComposing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Channel>("in_app");
  const [scheduledAt, setScheduledAt] = useState("");
  const [audLocale, setAudLocale] = useState("");
  const [audPlan, setAudPlan] = useState("");
  const [audLevel, setAudLevel] = useState("");
  const [audCountry, setAudCountry] = useState("");
  const [audUserIds, setAudUserIds] = useState("");
  const [estimate, setEstimate] = useState<{
    estimatedRecipients: number;
    exact: boolean;
    note?: string | null;
  } | null>(null);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [reason, setReason] = useState("");
  const [pendingTransition, setPendingTransition] = useState<"schedule" | "cancel" | null>(null);

  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    void loadAdminPermissions().then((p) => {
      if (!cancel) setPerms(p);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/operations/broadcasts?${params.toString()}`);
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
  }, [statusFilter, channelFilter, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setPage(1);
  }, [statusFilter, channelFilter]);

  function reset() {
    setComposing(false);
    setEditId(null);
    setTitle("");
    setBody("");
    setChannel("in_app");
    setScheduledAt("");
    setAudLocale("");
    setAudPlan("");
    setAudLevel("");
    setAudCountry("");
    setAudUserIds("");
    setEstimate(null);
    setReason("");
  }

  function startCreate() {
    reset();
    setComposing(true);
  }

  async function openDetail(id: string) {
    const r = await adminApiFetch(`/api/admin/operations/broadcasts/${id}`);
    if (!r.ok) return;
    const det = (await r.json()) as Detail;
    setDetail(det);
  }

  function startEditFromDetail() {
    if (!detail) return;
    setEditId(detail.id);
    setTitle(detail.title ?? "");
    setBody(detail.body ?? "");
    setChannel((detail.channel ?? "in_app") as Channel);
    setScheduledAt(detail.scheduledAt ?? "");
    const aud = detail.audience ?? {};
    setAudLocale(Array.isArray(aud.locale) ? (aud.locale as string[]).join(",") : "");
    setAudPlan(Array.isArray(aud.plan) ? (aud.plan as string[]).join(",") : "");
    setAudLevel(Array.isArray(aud.level) ? (aud.level as string[]).join(",") : "");
    setAudCountry(Array.isArray(aud.country) ? (aud.country as string[]).join(",") : "");
    setAudUserIds(Array.isArray(aud.userIds) ? (aud.userIds as string[]).join("\n") : "");
    setComposing(true);
    setDetail(null);
  }

  function audienceObj() {
    return {
      country: parseCsvList(audCountry),
      level: parseCsvList(audLevel),
      locale: parseCsvList(audLocale),
      plan: parseCsvList(audPlan),
      userIds: audUserIds ? parseUserIds(audUserIds) : undefined
    };
  }

  async function runEstimate() {
    setEstimate(null);
    const r = await adminApiFetch(`/api/admin/operations/broadcasts/audience/estimate`, {
      body: JSON.stringify(audienceObj()),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    if (!r.ok) {
      setToast({ kind: "err", text: t("updateFailed") });
      return;
    }
    setEstimate((await r.json()) as typeof estimate);
  }

  async function submitCompose() {
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    if (!title.trim() || !body.trim()) {
      setToast({ kind: "err", text: t("updateFailed") });
      return;
    }
    setMutating(true);
    try {
      const audience = audienceObj();
      const payload = {
        audience,
        body: body.trim(),
        channel,
        reason: reason.trim(),
        scheduledAt: scheduledAt.trim() || undefined,
        title: title.trim()
      };
      const url = editId ? `/api/admin/operations/broadcasts/${editId}` : `/api/admin/operations/broadcasts`;
      const r = await adminApiFetch(url, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        const text = await r.text();
        setToast({ kind: "err", text: text || (editId ? t("updateFailed") : t("createFailed")) });
        return;
      }
      setToast({ kind: "ok", text: editId ? t("updateOk") : t("createOk") });
      reset();
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  async function submitTransition() {
    if (!detail || !pendingTransition) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(
        `/api/admin/operations/broadcasts/${detail.id}/${pendingTransition}`,
        {
          body: JSON.stringify({ reason: reason.trim() }),
          headers: { "content-type": "application/json" },
          method: "PATCH"
        }
      );
      if (!r.ok) {
        const text = await r.text();
        setToast({ kind: "err", text: text || t("updateFailed") });
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
      setPendingTransition(null);
      setReason("");
      setDetail(null);
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        {t("partialSchemaNotice")}
      </div>
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <select
            aria-label={t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">{t("filterStatusAll")}</option>
            <option value="draft">{t("statusDraft")}</option>
            <option value="scheduled">{t("statusScheduled")}</option>
            <option value="sent">{t("statusSent")}</option>
            <option value="cancelled">{t("statusCancelled")}</option>
          </select>
          <select
            aria-label={t("filterChannel")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setChannelFilter(e.target.value)}
            value={channelFilter}
          >
            <option value="">{t("filterChannelAll")}</option>
            <option value="push">{t("channel_push")}</option>
            <option value="email">{t("channel_email")}</option>
            <option value="in_app">{t("channel_in_app")}</option>
          </select>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          {canWrite ? (
            <button
              className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
              onClick={startCreate}
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
        {list == null ? (
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        ) : list.items.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colTitle")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colChannel")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colStatus")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colScheduled")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colCreated")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((it) => (
                <AdminDataTableRow
                  key={it.id}
                  className="cursor-pointer hover:bg-indigo-50/40"
                  onClick={() => void openDetail(it.id)}
                >
                  <AdminDataTableTd>{it.title}</AdminDataTableTd>
                  <AdminDataTableTd>{t(`channel_${it.channel}`)}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={statusTone(it.status)}>{t(`status${it.status[0].toUpperCase()}${it.status.slice(1)}`)}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs">{it.scheduledAt ? new Date(it.scheduledAt).toLocaleString() : "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(it.createdAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
        {list && list.total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">‹</button>
            <span className="text-gray-600">{page} / {totalPages}</span>
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">›</button>
          </div>
        ) : null}
      </AdminSection>

      {composing ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={reset} role="dialog">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-base font-semibold">
                {editId ? t("drawerEditTitle") : t("drawerCreateTitle")}
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={reset} type="button">
                {t("close")}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase">{t("fieldTitle")}</label>
              <input className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => setTitle(e.target.value)} value={title} />
              <label className="block text-xs font-semibold uppercase">{t("fieldBody")}</label>
              <textarea className="h-32 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setBody(e.target.value)} value={body} />
              <label className="block text-xs font-semibold uppercase">{t("fieldChannel")}</label>
              <select className="rounded border px-2 py-1 text-sm" onChange={(e) => setChannel(e.target.value as Channel)} value={channel}>
                <option value="push">{t("channel_push")}</option>
                <option value="email">{t("channel_email")}</option>
                <option value="in_app">{t("channel_in_app")}</option>
              </select>
              <label className="block text-xs font-semibold uppercase">{t("fieldScheduledAt")}</label>
              <input className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => setScheduledAt(e.target.value)} placeholder="2025-06-01T09:00:00Z" value={scheduledAt} />

              <div className="rounded border bg-gray-50 p-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="block font-semibold">{t("fieldAudienceLocale")}</span>
                    <input className="w-full rounded border px-2 py-1" onChange={(e) => setAudLocale(e.target.value)} placeholder="vi,ja,en" value={audLocale} />
                  </label>
                  <label>
                    <span className="block font-semibold">{t("fieldAudiencePlan")}</span>
                    <input className="w-full rounded border px-2 py-1" onChange={(e) => setAudPlan(e.target.value)} placeholder="free,plus,pro" value={audPlan} />
                  </label>
                  <label>
                    <span className="block font-semibold">{t("fieldAudienceLevel")}</span>
                    <input className="w-full rounded border px-2 py-1" onChange={(e) => setAudLevel(e.target.value)} placeholder="N5,N4" value={audLevel} />
                  </label>
                  <label>
                    <span className="block font-semibold">{t("fieldAudienceCountry")}</span>
                    <input className="w-full rounded border px-2 py-1" onChange={(e) => setAudCountry(e.target.value)} placeholder="VN,JP" value={audCountry} />
                  </label>
                </div>
                <label className="mt-2 block">
                  <span className="block font-semibold">{t("fieldAudienceUserIds")}</span>
                  <textarea className="h-24 w-full rounded border px-2 py-1 font-mono" onChange={(e) => setAudUserIds(e.target.value)} value={audUserIds} />
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button className="rounded border px-2 py-1" onClick={() => void runEstimate()} type="button">
                    {t("actionEstimate")}
                  </button>
                  {estimate ? (
                    <span>
                      {t("estimatedRecipients")}: <strong>{estimate.estimatedRecipients}</strong>{" "}
                      {estimate.exact ? t("estimatedExact") : t("estimatedApprox")}
                      {estimate.note ? ` — ${estimate.note}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>

              <label className="block text-xs font-semibold uppercase">{t("reason")}</label>
              <input className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} value={reason} />

              <div className="flex justify-end gap-2">
                <button className="rounded border px-3 py-1 text-sm" onClick={reset} type="button">
                  {t("cancel")}
                </button>
                <button
                  className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                  disabled={mutating}
                  onClick={() => void submitCompose()}
                  type="button"
                >
                  {t("confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetail(null)} role="dialog">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">{t("drawerDetailTitle")}</div>
                <AdminStatusBadge tone={statusTone(detail.status)}>
                  {t(`status${detail.status[0].toUpperCase()}${detail.status.slice(1)}`)}
                </AdminStatusBadge>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setDetail(null)} type="button">
                {t("close")}
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <strong>{t("fieldTitle")}:</strong> {detail.title}
              </div>
              <div>
                <strong>{t("fieldChannel")}:</strong> {t(`channel_${detail.channel}`)}
              </div>
              <div>
                <strong>{t("fieldScheduledAt")}:</strong>{" "}
                {detail.scheduledAt ? new Date(detail.scheduledAt).toLocaleString() : "—"}
              </div>
              <pre className="rounded border bg-gray-50 p-2 text-xs">{detail.body}</pre>
              <details>
                <summary className="cursor-pointer text-xs text-gray-500">audience JSON</summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded border bg-gray-50 p-2 text-xs">
                  {JSON.stringify(detail.audience ?? {}, null, 2)}
                </pre>
              </details>

              {canWrite && detail.status === "draft" ? (
                <div className="flex flex-wrap gap-2">
                  <button className="rounded border px-3 py-1 text-sm" onClick={startEditFromDetail} type="button">
                    {t("actionEdit")}
                  </button>
                  <button className="rounded bg-indigo-600 px-3 py-1 text-sm text-white" onClick={() => setPendingTransition("schedule")} type="button">
                    {t("actionSchedule")}
                  </button>
                  <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={() => setPendingTransition("cancel")} type="button">
                    {t("actionCancel")}
                  </button>
                </div>
              ) : null}
              {canWrite && detail.status === "scheduled" ? (
                <button className="rounded bg-red-600 px-3 py-1 text-sm text-white" onClick={() => setPendingTransition("cancel")} type="button">
                  {t("actionCancel")}
                </button>
              ) : null}

              {pendingTransition ? (
                <div className="rounded border bg-white p-3">
                  <label className="block text-xs font-semibold uppercase">{t("reason")}</label>
                  <input className="mt-1 w-full rounded border px-2 py-1 text-sm" onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} value={reason} />
                  <div className="mt-2 flex justify-end gap-2">
                    <button className="rounded border px-3 py-1 text-sm" onClick={() => setPendingTransition(null)} type="button">
                      {t("cancel")}
                    </button>
                    <button
                      className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                      disabled={mutating}
                      onClick={() => void submitTransition()}
                      type="button"
                    >
                      {t("confirm")}
                    </button>
                  </div>
                </div>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold">audit</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {detail.events.map((e) => (
                    <li key={e.id} className="rounded border bg-gray-50 px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">{e.action}</span>
                        <span className="text-gray-500">{new Date(e.createdAt).toLocaleString()}</span>
                      </div>
                      {e.actor ? (
                        <div className="text-gray-600">
                          {e.actor.displayName ?? e.actor.email ?? e.actor.id}
                        </div>
                      ) : null}
                      {e.reason ? <div className="text-gray-700">{e.reason}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`} role="status">
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">✕</button>
        </div>
      ) : null}
    </div>
  );
}
