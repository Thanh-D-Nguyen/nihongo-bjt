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
  downloadCsv,
  loadAdminPermissions
} from "../../../_components/admin-client-utils";

type SecurityEvent = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  actor: { id: string; displayName: string | null; email: string | null } | null;
  targetType: string | null;
  targetId: string | null;
  action: string;
  reason: string | null;
  createdAt: string;
  resolution: { state: "resolved" | "false_positive" | null; reason: string | null; at: string | null } | null;
};
type ListResponse = { items: SecurityEvent[]; total: number };
type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
  actor: { id: string; displayName: string | null; email: string | null } | null;
};
type Detail = SecurityEvent & {
  before: unknown;
  after: unknown;
  resolutions: AuditEntry[];
};

const PAGE_SIZE = 50;
const TYPE_OPTIONS = [
  "failed_login",
  "permission_denied",
  "suspicious_request",
  "rate_limit_exceeded",
  "privilege_escalation_attempt",
  "other"
] as const;
const SEVERITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

function severityTone(s: string): "neutral" | "good" | "warning" | "danger" {
  if (s === "low") return "neutral";
  if (s === "medium") return "warning";
  if (s === "high") return "danger";
  if (s === "critical") return "danger";
  return "neutral";
}

export function OpsSecurityClient({ common, labels }: { common: CommonLabels; labels: Labels }) {
  const t = buildT(labels);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");

  const [list, setList] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [action, setAction] = useState<"resolved" | "false_positive" | null>(null);
  const [reason, setReason] = useState("");
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
      if (typeFilter) params.set("type", typeFilter);
      if (sevFilter) params.set("severity", sevFilter);
      if (actorFilter.trim()) params.set("actorId", actorFilter.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      const r = await adminApiFetch(`/api/admin/operations/security/events?${params.toString()}`);
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
  }, [typeFilter, sevFilter, actorFilter, from, to, page, common.error]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    setPage(1);
  }, [typeFilter, sevFilter, actorFilter, from, to]);

  const loadDetail = useCallback(async (id: string) => {
    const r = await adminApiFetch(`/api/admin/operations/security/events/${id}`);
    if (!r.ok) {
      setDetail(null);
      return;
    }
    setDetail((await r.json()) as Detail);
  }, []);

  function openDrawer(row: SecurityEvent) {
    setSelected(row);
    setDetail(null);
    setAction(null);
    setReason("");
    void loadDetail(row.id);
  }

  async function submit() {
    if (!selected || !action) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(
        `/api/admin/operations/security/events/${selected.id}/resolve`,
        {
          body: JSON.stringify({ resolution: action, reason: reason.trim() }),
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
      void loadList();
      void loadDetail(selected.id);
      setAction(null);
      setReason("");
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!list) return;
    const header = ["id", "createdAt", "type", "severity", "action", "actorId", "targetType", "targetId", "reason"];
    const rows = list.items.map((it) => [
      it.id,
      it.createdAt,
      it.type,
      it.severity,
      it.action,
      it.actor?.id ?? "",
      it.targetType ?? "",
      it.targetId ?? "",
      it.reason ?? ""
    ]);
    downloadCsv(`ops-security-${Date.now()}.csv`, header, rows);
  }

  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <select
            aria-label={t("filterType")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setTypeFilter(e.target.value)}
            value={typeFilter}
          >
            <option value="">{t("filterTypeAll")}</option>
            {TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`type_${v}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("filterSeverity")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setSevFilter(e.target.value)}
            value={sevFilter}
          >
            <option value="">{t("filterSeverityAll")}</option>
            {SEVERITY_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`severity_${v}`)}
              </option>
            ))}
          </select>
          <input
            aria-label={t("filterActor")}
            className="w-64 rounded border px-2 py-1 text-sm"
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder={t("filterActor")}
            value={actorFilter}
          />
          <label className="text-xs text-gray-600">
            {t("filterDateFrom")}
            <input
              className="ml-1 rounded border px-2 py-1 text-sm"
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label className="text-xs text-gray-600">
            {t("filterDateTo")}
            <input
              className="ml-1 rounded border px-2 py-1 text-sm"
              onChange={(e) => setTo(e.target.value)}
              type="date"
              value={to}
            />
          </label>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
            {t("actionExportCsv")}
          </button>
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
                <AdminDataTableTh>{t("colTime")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colType")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colSeverity")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colActor")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colTarget")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colAction")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colReason")}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {list.items.map((it) => (
                <AdminDataTableRow
                  key={it.id}
                  className="cursor-pointer hover:bg-indigo-50/40"
                  onClick={() => openDrawer(it)}
                >
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(it.createdAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{t(`type_${it.type}`) || it.type}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={severityTone(it.severity)}>
                      {t(`severity_${it.severity}`) || it.severity}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">
                      {it.actor?.displayName ?? it.actor?.email ?? it.actor?.id ?? "—"}
                    </span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">
                      {it.targetType ? `${it.targetType}/${it.targetId ?? "?"}` : "—"}
                    </span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{it.action}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="line-clamp-1 max-w-xs text-xs">{it.reason ?? ""}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
        {list && list.total > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              className="rounded border px-2 py-1 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              ‹
            </button>
            <span className="text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              className="rounded border px-2 py-1 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              ›
            </button>
          </div>
        ) : null}
      </AdminSection>

      {selected ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)} role="dialog">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{selected.id}</div>
                <div className="text-base font-semibold">{t("drawerTitle")}</div>
                <AdminStatusBadge tone={severityTone(selected.severity)}>
                  {t(`severity_${selected.severity}`)}
                </AdminStatusBadge>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setSelected(null)} type="button">
                {t("close")}
              </button>
            </div>

            {detail == null ? (
              <div className="mt-4 text-sm text-gray-500">{common.loading}</div>
            ) : (
              <div className="mt-4 space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-500">{t("colTime")}</dt>
                  <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                  <dt className="text-gray-500">{t("colType")}</dt>
                  <dd>{t(`type_${detail.type}`) || detail.type}</dd>
                  <dt className="text-gray-500">{t("colActor")}</dt>
                  <dd className="font-mono text-xs">{detail.actor?.displayName ?? detail.actor?.email ?? detail.actor?.id ?? "—"}</dd>
                  <dt className="text-gray-500">{t("colTarget")}</dt>
                  <dd className="font-mono text-xs">{detail.targetType ? `${detail.targetType}/${detail.targetId ?? "?"}` : "—"}</dd>
                  <dt className="text-gray-500">{t("colAction")}</dt>
                  <dd className="font-mono text-xs">{detail.action}</dd>
                </dl>

                <div className="rounded border bg-gray-50 p-2 text-xs">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">
                    {t("contextTitle")}
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify({ before: detail.before, after: detail.after, reason: detail.reason }, null, 2)}
                  </pre>
                </div>

                {canWrite && !detail.resolution?.state ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                      onClick={() => setAction("resolved")}
                      type="button"
                    >
                      {t("actionResolve")}
                    </button>
                    <button
                      className="rounded bg-slate-600 px-3 py-1 text-sm text-white"
                      onClick={() => setAction("false_positive")}
                      type="button"
                    >
                      {t("actionFalsePositive")}
                    </button>
                  </div>
                ) : null}

                {action ? (
                  <div className="rounded border bg-white p-3">
                    <label className="block text-xs font-semibold uppercase text-gray-600">{t("reason")}</label>
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t("reasonPlaceholder")}
                      value={reason}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button className="rounded border px-3 py-1 text-sm" onClick={() => setAction(null)} type="button">
                        {t("cancel")}
                      </button>
                      <button
                        className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                        disabled={mutating}
                        onClick={() => void submit()}
                        type="button"
                      >
                        {t("confirm")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-2">
                  <h3 className="text-sm font-semibold">{t("resolutionTitle")}</h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    {detail.resolutions.length === 0 ? (
                      <li className="text-gray-400">{common.empty}</li>
                    ) : (
                      detail.resolutions.map((a) => (
                        <li key={a.id} className="rounded border bg-gray-50 px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{a.action}</span>
                            <span className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
                          </div>
                          {a.actor ? (
                            <div className="text-gray-600">{a.actor.displayName ?? a.actor.email ?? a.actor.id}</div>
                          ) : null}
                          {a.reason ? <div className="text-gray-700">{a.reason}</div> : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 rounded px-3 py-2 text-sm text-white shadow ${toast.kind === "ok" ? "bg-emerald-600" : "bg-red-600"}`}
          role="status"
        >
          {toast.text}
          <button className="ml-3 underline" onClick={() => setToast(null)} type="button">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
