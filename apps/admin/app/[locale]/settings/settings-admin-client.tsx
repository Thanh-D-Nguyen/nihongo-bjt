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

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type Flag = {
  key: string;
  description: string | null;
  enabled: boolean;
  killSwitch: boolean;
  scope: string;
  rules: unknown;
  createdAt: string;
  updatedAt: string;
};

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

/* High-risk patterns must mirror backend `HIGH_RISK_FLAG_KEY_PATTERNS` in
 * apps/api/src/operations/operations.controller.ts. UI guard is for UX only —
 * backend always re-validates. */
const HIGH_RISK_PATTERNS: RegExp[] = [
  /^monetization\./i,
  /^billing\./i,
  /^auth\./i,
  /^security\./i,
  /rate[_.-]?limit/i,
  /kill[_.-]?switch/i
];
function isHighRisk(flag: Flag): boolean {
  if (flag.killSwitch) return true;
  return HIGH_RISK_PATTERNS.some((re) => re.test(flag.key));
}

function namespaceOf(key: string): string {
  const idx = key.indexOf(".");
  return idx > 0 ? key.slice(0, idx) : "_root";
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

export function SettingsAdminClient({
  common,
  labels
}: {
  common: CommonLabels;
  labels: Labels;
}) {
  const t = (k: string) => labels[k] ?? k;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");

  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<Flag | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [rulesText, setRulesText] = useState<string>("{}");
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string>("");
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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

  const loadFlags = useCallback(async () => {
    try {
      const r = await adminApiFetch("/api/admin/operations/feature-flags");
      if (!r.ok) {
        setListError(common.error);
        setFlags(null);
        return;
      }
      setListError(null);
      setFlags((await r.json()) as Flag[]);
    } catch {
      setListError(common.error);
    }
  }, [common.error]);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = new Map<string, Flag[]>();
    if (!flags) return out;
    for (const f of flags) {
      if (q && !f.key.toLowerCase().includes(q) && !(f.description ?? "").toLowerCase().includes(q)) {
        continue;
      }
      const ns = namespaceOf(f.key);
      const cur = out.get(ns) ?? [];
      cur.push(f);
      out.set(ns, cur);
    }
    for (const [, list] of out) list.sort((a, b) => a.key.localeCompare(b.key));
    return new Map(Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b)));
  }, [flags, search]);

  function openEditor(flag: Flag) {
    if (!canWrite) return;
    setEditing(flag);
    setEnabled(flag.enabled);
    setKillSwitch(flag.killSwitch);
    setRulesText(JSON.stringify(flag.rules ?? {}, null, 2));
    setRulesError(null);
    setReason("");
    setConfirmation("");
  }

  function toggleCollapsed(ns: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  }

  async function submitEdit() {
    if (!editing) return;
    let rulesParsed: Record<string, unknown> | undefined;
    if (rulesText.trim().length > 0) {
      try {
        const parsed = JSON.parse(rulesText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setRulesError(t("rulesMustBeObject"));
          return;
        }
        rulesParsed = parsed as Record<string, unknown>;
      } catch {
        setRulesError(t("rulesInvalidJson"));
        return;
      }
    }
    setRulesError(null);
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: t("reasonRequired") });
      return;
    }
    const highRisk = isHighRisk(editing) || killSwitch;
    if (highRisk && confirmation !== editing.key) {
      setToast({ kind: "err", text: t("confirmationMismatch") });
      return;
    }
    setMutating(true);
    try {
      const r = await adminApiFetch(`/api/admin/operations/feature-flags/${encodeURIComponent(editing.key)}`, {
        body: JSON.stringify({
          confirmation: highRisk ? editing.key : undefined,
          enabled,
          killSwitch,
          reason: reason.trim(),
          rules: rulesParsed
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === "high_risk_confirmation_required") {
          setToast({ kind: "err", text: t("confirmationRequired") });
        } else {
          setToast({ kind: "err", text: t("updateFailed") });
        }
        return;
      }
      setToast({ kind: "ok", text: t("updateOk") });
      setEditing(null);
      void loadFlags();
    } finally {
      setMutating(false);
    }
  }

  function exportCsv() {
    if (!flags) return;
    const header = ["key", "namespace", "enabled", "killSwitch", "scope", "description", "updatedAt"];
    const rows = flags.map((f) => [
      f.key,
      namespaceOf(f.key),
      String(f.enabled),
      String(f.killSwitch),
      f.scope,
      f.description ?? "",
      f.updatedAt
    ]);
    downloadCsv(`settings-${Date.now()}.csv`, header, rows);
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} description={t("subtitle")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("readOnlyNotice")}
        </div>
      ) : null}

      <AdminSection>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label={t("filterSearch")}
            className="min-w-[260px] flex-1 rounded border px-2 py-1 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            value={search}
          />
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void loadFlags()} type="button">
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

      {flags == null ? (
        <AdminSection>
          <div className="p-3 text-sm text-gray-500">{common.loading}</div>
        </AdminSection>
      ) : flags.length === 0 ? (
        <AdminSection>
          <AdminEmptyState title={common.empty} />
        </AdminSection>
      ) : (
        Array.from(grouped.entries()).map(([ns, items]) => {
          const isCollapsed = collapsed.has(ns);
          return (
            <AdminSection key={ns}>
              <button
                className="flex w-full items-center justify-between rounded text-left"
                onClick={() => toggleCollapsed(ns)}
                type="button"
              >
                <h3 className="font-mono text-sm font-semibold">
                  {ns} <span className="text-gray-400">({items.length})</span>
                </h3>
                <span aria-hidden className="text-xs text-gray-500">
                  {isCollapsed ? "▸" : "▾"}
                </span>
              </button>
              {!isCollapsed ? (
                <div className="mt-2">
                  <AdminDataTable>
                    <AdminDataTableHead>
                      <AdminDataTableRow>
                        <AdminDataTableTh>{t("colKey")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("colEnabled")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("colKillSwitch")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("colDescription")}</AdminDataTableTh>
                        <AdminDataTableTh>{t("colUpdated")}</AdminDataTableTh>
                        <AdminDataTableTh>&nbsp;</AdminDataTableTh>
                      </AdminDataTableRow>
                    </AdminDataTableHead>
                    <AdminDataTableBody>
                      {items.map((f) => (
                        <AdminDataTableRow key={f.key}>
                          <AdminDataTableTd>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{f.key}</span>
                              {isHighRisk(f) ? (
                                <AdminStatusBadge tone="danger">{t("highRiskBadge")}</AdminStatusBadge>
                              ) : null}
                            </div>
                          </AdminDataTableTd>
                          <AdminDataTableTd>
                            <AdminStatusBadge tone={f.enabled ? "neutral" : "warning"}>
                              {f.enabled ? t("status_enabled") : t("status_disabled")}
                            </AdminStatusBadge>
                          </AdminDataTableTd>
                          <AdminDataTableTd>
                            {f.killSwitch ? (
                              <AdminStatusBadge tone="danger">{t("killSwitchOn")}</AdminStatusBadge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </AdminDataTableTd>
                          <AdminDataTableTd>
                            <span className="text-xs text-gray-700">{f.description ?? ""}</span>
                          </AdminDataTableTd>
                          <AdminDataTableTd>
                            <span className="text-xs text-gray-500">
                              {new Date(f.updatedAt).toLocaleString()}
                            </span>
                          </AdminDataTableTd>
                          <AdminDataTableTd>
                            {canWrite ? (
                              <button
                                className="rounded border px-2 py-0.5 text-xs"
                                onClick={() => openEditor(f)}
                                type="button"
                              >
                                {t("edit")}
                              </button>
                            ) : null}
                          </AdminDataTableTd>
                        </AdminDataTableRow>
                      ))}
                    </AdminDataTableBody>
                  </AdminDataTable>
                </div>
              ) : null}
            </AdminSection>
          );
        })
      )}

      {editing ? (
        <div
          aria-modal
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setEditing(null)}
          role="dialog"
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">{t("editHeading")}</div>
                <div className="font-mono text-base font-semibold">{editing.key}</div>
                {editing.description ? (
                  <div className="mt-1 text-xs text-gray-600">{editing.description}</div>
                ) : null}
              </div>
              <button
                className="rounded border px-2 py-1 text-sm"
                onClick={() => setEditing(null)}
                type="button"
              >
                {t("close")}
              </button>
            </div>

            {isHighRisk(editing) || killSwitch ? (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                <div className="font-semibold">{t("highRiskWarningTitle")}</div>
                <div className="mt-1">{t("highRiskWarningBody")}</div>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  type="checkbox"
                />
                <span>{t("fieldEnabled")}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={killSwitch}
                  onChange={(e) => setKillSwitch(e.target.checked)}
                  type="checkbox"
                />
                <span>{t("fieldKillSwitch")}</span>
              </label>
              <div>
                <label className="block text-xs font-medium uppercase text-gray-500">
                  {t("fieldRules")}
                </label>
                <textarea
                  className="mt-1 w-full rounded border p-2 font-mono text-xs"
                  onChange={(e) => setRulesText(e.target.value)}
                  rows={6}
                  value={rulesText}
                />
                {rulesError ? (
                  <div className="mt-1 text-xs text-red-600">{rulesError}</div>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium uppercase text-gray-500">
                  {t("fieldReason")}
                </label>
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("reasonPlaceholder")}
                  value={reason}
                />
              </div>
              {isHighRisk(editing) || killSwitch ? (
                <div>
                  <label className="block text-xs font-medium uppercase text-red-700">
                    {t("fieldConfirmation")}
                  </label>
                  <input
                    aria-describedby="confirmation-hint"
                    className="mt-1 w-full rounded border border-red-300 px-2 py-1 font-mono text-sm"
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder={editing.key}
                    value={confirmation}
                  />
                  <div className="mt-1 text-[11px] text-red-700" id="confirmation-hint">
                    {t("confirmationHint").replace("{key}", editing.key)}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setEditing(null)}
                type="button"
              >
                {t("cancel")}
              </button>
              <button
                className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                disabled={mutating}
                onClick={() => void submitEdit()}
                type="button"
              >
                {t("save")}
              </button>
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
