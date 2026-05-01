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
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import {
  type CommonLabels,
  type Labels,
  buildT,
  downloadCsv,
  loadAdminPermissions
} from "../../../_components/admin-client-utils";

type Flag = {
  key: string;
  description: string | null;
  enabled: boolean;
  killSwitch: boolean;
  scope: string | null;
  rules: Record<string, unknown> | null;
  updatedAt: string;
};
type FlagAudit = {
  id: string;
  flagKey: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: string;
  actor: { id: string; displayName: string | null; email: string | null } | null;
};
type HistoryResponse = { flag: Flag; audits: FlagAudit[] };

const HIGH_RISK = ["auth.", "billing.", "monetization.", "security.", "rate_limit.", "killswitch."];

function isHighRisk(key: string, killSwitch: boolean) {
  if (killSwitch) return true;
  return HIGH_RISK.some((p) => key.startsWith(p));
}

export function OpsFeatureFlagsClient({
  common,
  labels,
  killSwitchOnly = false
}: {
  common: CommonLabels;
  labels: Labels;
  killSwitchOnly?: boolean;
}) {
  const t = buildT(labels);
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");

  const [list, setList] = useState<Flag[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");

  const [editFlag, setEditFlag] = useState<Flag | null>(null);
  const [editEnabled, setEditEnabled] = useState(false);
  const [editKillSwitch, setEditKillSwitch] = useState(false);
  const [editRollout, setEditRollout] = useState<string>("");
  const [editSchedule, setEditSchedule] = useState<string>("");
  const [editReason, setEditReason] = useState("");
  const [editConfirmKey, setEditConfirmKey] = useState("");

  const [historyFlag, setHistoryFlag] = useState<Flag | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);

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
      const url = killSwitchOnly
        ? "/api/admin/operations/kill-switches"
        : "/api/admin/operations/feature-flags";
      const r = await adminApiFetch(url);
      if (!r.ok) {
        setListError(common.error);
        setList(null);
        return;
      }
      setListError(null);
      setList((await r.json()) as Flag[]);
    } catch {
      setListError(common.error);
    }
  }, [common.error, killSwitchOnly]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const scopes = useMemo(() => {
    if (!list) return [];
    return Array.from(new Set(list.map((f) => f.scope ?? "").filter(Boolean))).sort();
  }, [list]);

  const filtered = useMemo(() => {
    if (!list) return null;
    let out = list;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (f) => f.key.toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q)
      );
    }
    if (scope) out = out.filter((f) => (f.scope ?? "") === scope);
    if (enabledFilter) {
      const want = enabledFilter === "on";
      out = out.filter((f) => f.enabled === want);
    }
    return out;
  }, [list, search, scope, enabledFilter]);

  function openEdit(flag: Flag) {
    setEditFlag(flag);
    setEditEnabled(flag.enabled);
    setEditKillSwitch(flag.killSwitch);
    const rolloutPercent =
      flag.rules && typeof flag.rules.rolloutPercent === "number"
        ? String(flag.rules.rolloutPercent)
        : "";
    setEditRollout(rolloutPercent);
    const sched =
      flag.rules && flag.rules.rolloutSchedule
        ? JSON.stringify(flag.rules.rolloutSchedule, null, 2)
        : "";
    setEditSchedule(sched);
    setEditReason("");
    setEditConfirmKey("");
  }

  function openToggle(flag: Flag) {
    openEdit(flag);
    setEditEnabled(!flag.enabled);
  }

  async function openHistory(flag: Flag) {
    setHistoryFlag(flag);
    setHistory(null);
    const r = await adminApiFetch(
      `/api/admin/operations/feature-flags/${encodeURIComponent(flag.key)}/history?limit=50`
    );
    if (!r.ok) return;
    setHistory((await r.json()) as HistoryResponse);
  }

  async function submitEdit() {
    if (!editFlag) return;
    if (editReason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    const highRisk = isHighRisk(editFlag.key, editKillSwitch);
    if (highRisk && editConfirmKey !== editFlag.key) {
      setToast({ kind: "err", text: t("highRiskMismatch") });
      return;
    }
    let rules: Record<string, unknown> | undefined;
    const rolloutNum = editRollout.trim() ? Number(editRollout) : undefined;
    if (rolloutNum != null && !Number.isFinite(rolloutNum)) {
      setToast({ kind: "err", text: t("updateFailed") });
      return;
    }
    if (editSchedule.trim()) {
      try {
        const parsed = JSON.parse(editSchedule);
        rules = { ...(rules ?? {}), rolloutSchedule: parsed };
      } catch {
        setToast({ kind: "err", text: t("updateFailed") });
        return;
      }
    }
    if (rolloutNum != null) rules = { ...(rules ?? {}), rolloutPercent: rolloutNum };

    setMutating(true);
    try {
      const url = editKillSwitch || editFlag.killSwitch
        ? `/api/admin/operations/kill-switches/${encodeURIComponent(editFlag.key)}`
        : `/api/admin/operations/feature-flags/${encodeURIComponent(editFlag.key)}`;
      const r = await adminApiFetch(url, {
        body: JSON.stringify({
          confirmation: highRisk ? editConfirmKey : undefined,
          enabled: editEnabled,
          killSwitch: editKillSwitch,
          reason: editReason.trim(),
          rules
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        const text = await r.text();
        setToast({ kind: "err", text: text || t("updateFailed") });
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
      setEditFlag(null);
      void loadList();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!filtered) return;
    const header = ["key", "description", "enabled", "killSwitch", "scope", "updatedAt"];
    const rows = filtered.map((f) => [
      f.key,
      f.description ?? "",
      String(f.enabled),
      String(f.killSwitch),
      f.scope ?? "",
      f.updatedAt
    ]);
    downloadCsv(`ops-feature-flags-${Date.now()}.csv`, header, rows);
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}
      {killSwitchOnly && t("danger") ? (
        <div className="rounded-md border-2 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-900">
          {t("danger")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap items-end gap-2">
          <input
            aria-label={t("filterSearch")}
            className="w-72 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("filterSearch")}
            value={search}
          />
          {!killSwitchOnly ? (
            <select
              aria-label={t("filterScope")}
              className="rounded border px-2 py-1 text-sm"
              onChange={(e) => setScope(e.target.value)}
              value={scope}
            >
              <option value="">{t("filterScopeAll")}</option>
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label={t("filterEnabled") || t("filterStatus")}
            className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setEnabledFilter(e.target.value)}
            value={enabledFilter}
          >
            <option value="">{t("filterEnabledAll") || t("filterStatusAll")}</option>
            <option value="on">{t("enabledOn") || "on"}</option>
            <option value="off">{t("enabledOff") || "off"}</option>
          </select>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadList()} type="button">
            {t("actionRefresh")}
          </button>
          {!killSwitchOnly ? (
            <button className="rounded border px-3 py-1 text-sm" onClick={exportCsv} type="button">
              {t("actionExportCsv")}
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
        {filtered == null ? (
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        ) : filtered.length === 0 ? (
          <AdminEmptyState title={common.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{t("colKey")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colDescription")}</AdminDataTableTh>
                <AdminDataTableTh>{t("colEnabled")}</AdminDataTableTh>
                {!killSwitchOnly ? <AdminDataTableTh>{t("colKillSwitch")}</AdminDataTableTh> : null}
                {!killSwitchOnly ? <AdminDataTableTh>{t("colScope")}</AdminDataTableTh> : null}
                <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                <AdminDataTableTh></AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {filtered.map((f) => (
                <AdminDataTableRow key={f.key}>
                  <AdminDataTableTd>
                    <span className="font-mono text-xs">{f.key}</span>
                    {isHighRisk(f.key, f.killSwitch) ? (
                      <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-semibold uppercase text-red-700">
                        high-risk
                      </span>
                    ) : null}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs">{f.description ?? "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={f.enabled ? "good" : "neutral"}>
                      {f.enabled ? t("enabledOn") : t("enabledOff")}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  {!killSwitchOnly ? (
                    <AdminDataTableTd>
                      {f.killSwitch ? (
                        <AdminStatusBadge tone="danger">{t("killSwitchYes")}</AdminStatusBadge>
                      ) : (
                        "—"
                      )}
                    </AdminDataTableTd>
                  ) : null}
                  {!killSwitchOnly ? (
                    <AdminDataTableTd>
                      <span className="text-xs">{f.scope ?? "—"}</span>
                    </AdminDataTableTd>
                  ) : null}
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(f.updatedAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <div className="flex flex-wrap gap-1">
                      {canWrite ? (
                        <>
                          <button
                            className="rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                            onClick={() => openToggle(f)}
                            type="button"
                          >
                            {t("actionToggle")}
                          </button>
                          {!killSwitchOnly ? (
                            <button
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => openEdit(f)}
                              type="button"
                            >
                              {t("actionEdit")}
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      <button
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => void openHistory(f)}
                        type="button"
                      >
                        {t("actionHistory")}
                      </button>
                    </div>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {editFlag ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setEditFlag(null)} role="dialog">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{editFlag.key}</div>
                <div className="text-base font-semibold">
                  {killSwitchOnly ? t("drawerToggleTitle") : t("drawerEditTitle")}
                </div>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setEditFlag(null)} type="button">
                {t("close")}
              </button>
            </div>

            {killSwitchOnly && (editFlag.description || true) ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <div className="font-semibold">{t("blastRadiusTitle")}</div>
                <div>{editFlag.description ?? t("blastRadiusUnknown")}</div>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} type="checkbox" />
                <span>{t("fieldEnabled")}</span>
              </label>
              {!killSwitchOnly ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={editKillSwitch}
                    onChange={(e) => setEditKillSwitch(e.target.checked)}
                    type="checkbox"
                  />
                  <span>{t("fieldKillSwitch")}</span>
                </label>
              ) : null}

              {!killSwitchOnly ? (
                <>
                  <label className="block text-xs font-semibold uppercase text-gray-600">
                    {t("fieldRollout")}
                  </label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    inputMode="numeric"
                    onChange={(e) => setEditRollout(e.target.value)}
                    placeholder="0..100"
                    value={editRollout}
                  />
                  <label className="block text-xs font-semibold uppercase text-gray-600">
                    {t("fieldRolloutSchedule")}
                  </label>
                  <textarea
                    className="h-32 w-full rounded border px-2 py-1 font-mono text-xs"
                    onChange={(e) => setEditSchedule(e.target.value)}
                    placeholder='{"phases":[{"at":"2025-01-01T00:00:00Z","percent":10}]}'
                    value={editSchedule}
                  />
                </>
              ) : null}

              {killSwitchOnly ? (
                <>
                  <label className="block text-xs font-semibold uppercase text-gray-600">
                    {t("typedConfirmLabel")}
                  </label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    onChange={(e) => setEditConfirmKey(e.target.value)}
                    placeholder={editFlag.key}
                    value={editConfirmKey}
                  />
                  {editConfirmKey && editConfirmKey !== editFlag.key ? (
                    <div className="text-xs text-red-700">{t("typedConfirmMismatch")}</div>
                  ) : null}
                </>
              ) : isHighRisk(editFlag.key, editKillSwitch) ? (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                  <div className="font-semibold">{t("highRiskNotice")}</div>
                  <label className="mt-2 block text-xs font-semibold uppercase">
                    {t("highRiskConfirmField")}
                  </label>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    onChange={(e) => setEditConfirmKey(e.target.value)}
                    placeholder={editFlag.key}
                    value={editConfirmKey}
                  />
                  {editConfirmKey && editConfirmKey !== editFlag.key ? (
                    <div className="text-xs text-red-700">{t("highRiskMismatch")}</div>
                  ) : null}
                </div>
              ) : null}

              <label className="block text-xs font-semibold uppercase text-gray-600">{t("reason")}</label>
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                onChange={(e) => setEditReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                value={editReason}
              />

              <div className="flex justify-end gap-2">
                <button className="rounded border px-3 py-1 text-sm" onClick={() => setEditFlag(null)} type="button">
                  {t("cancel")}
                </button>
                <button
                  className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                  disabled={mutating}
                  onClick={() => void submitEdit()}
                  type="button"
                >
                  {t("confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {historyFlag ? (
        <div aria-modal className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setHistoryFlag(null)} role="dialog">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-gray-500">{historyFlag.key}</div>
                <div className="text-base font-semibold">{t("drawerHistoryTitle")}</div>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setHistoryFlag(null)} type="button">
                {t("close")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {history == null ? (
                <div className="text-sm text-gray-500">{common.loading}</div>
              ) : history.audits.length === 0 ? (
                <div className="text-sm text-gray-400">{t("auditEmpty")}</div>
              ) : (
                history.audits.map((a) => (
                  <div key={a.id} className="rounded border bg-gray-50 px-2 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700">{new Date(a.createdAt).toLocaleString()}</span>
                      {a.actor ? (
                        <span className="text-gray-500">
                          {a.actor.displayName ?? a.actor.email ?? a.actor.id}
                        </span>
                      ) : null}
                    </div>
                    {a.reason ? <div className="mt-1 text-gray-700">{a.reason}</div> : null}
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                      {JSON.stringify({ before: a.before, after: a.after }, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
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
