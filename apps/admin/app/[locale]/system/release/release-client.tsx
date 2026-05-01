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
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type ReleaseEvent = {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  actor: { id: string; displayName: string; email: string } | null;
  before: unknown;
  after: unknown;
};

type Labels = {
  title: string;
  description: string;
  refresh: string;
  loading: string;
  error: string;
  empty: string;
  markKnownGood: string;
  prepareRollback: string;
  versionLabel: string;
  versionPlaceholder: string;
  targetVersionLabel: string;
  confirmHelp: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  submit: string;
  noPermission: string;
  history: string;
  action: string;
  actor: string;
  reason: string;
  at: string;
};

export function ReleaseClient({ labels }: { labels: Labels }) {
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");
  const [history, setHistory] = useState<ReleaseEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  type Mode = "known_good" | "rollback";
  const [mode, setMode] = useState<Mode | null>(null);
  const [version, setVersion] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
        const j = (await r.json()) as MePayload;
        if (!cancelled) setPerms(permsFromMe(j));
      } catch {
        if (!cancelled) setPerms(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApiFetch("/api/admin/operations/system/release/history?limit=100");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setHistory((await r.json()) as ReleaseEvent[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!mode) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: labels.reasonLabel });
      return;
    }
    const requiredVersion = mode === "known_good" ? version : version;
    if (confirmText !== requiredVersion) {
      setToast({ kind: "err", text: labels.confirmHelp });
      return;
    }
    setSubmitting(true);
    try {
      const path = mode === "known_good"
        ? "/api/admin/operations/system/release/mark-known-good"
        : "/api/admin/operations/system/release/prepare-rollback";
      const body = mode === "known_good"
        ? { version, confirmation: confirmText, reason: reason.trim() }
        : { targetVersion: version, confirmation: confirmText, reason: reason.trim() };
      const r = await adminApiFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setToast({ kind: "ok", text: labels.submit });
      setMode(null);
      setVersion("");
      setConfirmText("");
      setReason("");
      void load();
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [mode, version, confirmText, reason, labels, load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={labels.title}
        description={labels.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium" onClick={() => void load()}>
              {labels.refresh}
            </button>
            {canWrite ? (
              <>
                <button type="button" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800" onClick={() => setMode("known_good")}>
                  {labels.markKnownGood}
                </button>
                <button type="button" className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800" onClick={() => setMode("rollback")}>
                  {labels.prepareRollback}
                </button>
              </>
            ) : null}
          </div>
        }
      />
      {!canWrite ? <p className="text-xs text-amber-700">{labels.noPermission}</p> : null}
      {toast ? (
        <div className={`rounded border px-3 py-2 text-sm ${toast.kind === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {toast.text}
        </div>
      ) : null}
      <AdminSection title={labels.history}>
        {loading && history.length === 0 ? (
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
        ) : error ? (
          <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
        ) : history.length === 0 ? (
          <AdminEmptyState title={labels.empty}>{labels.empty}</AdminEmptyState>
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{labels.action}</AdminDataTableTh>
                <AdminDataTableTh>{labels.actor}</AdminDataTableTh>
                <AdminDataTableTh>{labels.reason}</AdminDataTableTh>
                <AdminDataTableTh>{labels.at}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {history.map((e) => (
                <AdminDataTableRow key={e.id}>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={e.action.includes("rollback") ? "warning" : e.action.includes("known_good") ? "good" : "neutral"}>
                      {e.action}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{e.actor?.displayName ?? e.actor?.email ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>{e.reason ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>{new Date(e.createdAt).toLocaleString()}</AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {mode === "known_good" ? labels.markKnownGood : labels.prepareRollback}
            </h3>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-700">
                {mode === "known_good" ? labels.versionLabel : labels.targetVersionLabel}
              </span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                placeholder={labels.versionPlaceholder}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-amber-700">{labels.confirmHelp}</p>
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                placeholder={mode === "known_good" ? labels.versionLabel : labels.targetVersionLabel}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-700">{labels.reasonLabel}</span>
              <textarea
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                rows={3}
                placeholder={labels.reasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={() => { setMode(null); setVersion(""); setConfirmText(""); setReason(""); }} disabled={submitting}>
                {labels.cancel}
              </button>
              <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white" onClick={() => void submit()} disabled={submitting}>
                {labels.submit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { Labels as ReleaseLabels };
