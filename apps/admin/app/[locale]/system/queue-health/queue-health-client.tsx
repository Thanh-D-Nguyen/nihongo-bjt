"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";

type QueueRow = {
  name: string;
  pendingApprox?: number;
  inProgress?: number;
  succeeded24h?: number;
  failed24h?: number;
  paused?: boolean;
};

type Snapshot = {
  generatedAt?: string;
  queues?: QueueRow[];
  deadLetters?: { total: number };
};

type AuditEntry = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
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
  pause: string;
  resume: string;
  drain: string;
  drainConfirmHelp: string;
  drainConfirmPlaceholder: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  submit: string;
  pending: string;
  inProgress: string;
  succeeded24h: string;
  failed24h: string;
  paused: string;
  noPermission: string;
  recentActions: string;
};

const WRITE_PERMS = ["iam.manage"];

export function QueueHealthClient({ labels }: { labels: Labels }) {
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && WRITE_PERMS.some((p) => perms.has(p));
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  type ActionState = { kind: "pause" | "resume" | "drain"; queueName: string };
  const [pending, setPending] = useState<ActionState | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
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
      const [r, h] = await Promise.all([
        adminApiFetch("/api/admin/operations/system/queue-health"),
        adminApiFetch("/api/admin/operations/system/queue-health/actions?limit=50")
      ]);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as Snapshot;
      setData(j);
      setError(null);
      if (h.ok) {
        setAudit((await h.json()) as AuditEntry[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  const submit = useCallback(async () => {
    if (!pending) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: labels.reasonLabel });
      return;
    }
    if (pending.kind === "drain" && confirmText !== pending.queueName) {
      setToast({ kind: "err", text: labels.drainConfirmHelp });
      return;
    }
    setSubmitting(true);
    try {
      const path = `/api/admin/operations/system/queue-health/${pending.kind}`;
      const body: Record<string, unknown> = { queueName: pending.queueName, reason: reason.trim() };
      if (pending.kind === "drain") body.confirmation = confirmText;
      const r = await adminApiFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setToast({ kind: "ok", text: labels.submit });
      setPending(null);
      setReason("");
      setConfirmText("");
      void load();
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [pending, reason, confirmText, labels, load]);

  const queues = useMemo(() => data?.queues ?? [], [data]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={labels.title}
        description={labels.description}
        actions={
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            onClick={() => void load()}
          >
            {labels.refresh}
          </button>
        }
      />
      {!canWrite ? <p className="text-xs text-amber-700">{labels.noPermission}</p> : null}
      {toast ? (
        <div className={`rounded border px-3 py-2 text-sm ${toast.kind === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {toast.text}
        </div>
      ) : null}
      {loading && !data ? (
        <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      ) : error && !data ? (
        <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
      ) : queues.length === 0 ? (
        <AdminEmptyState title={labels.empty}>{labels.empty}</AdminEmptyState>
      ) : (
        <AdminSection title={labels.title}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queues.map((q) => (
              <div key={q.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-950">{q.name}</h3>
                  {q.paused ? <AdminStatusBadge tone="warning">{labels.paused}</AdminStatusBadge> : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>{labels.pending}: <span className="font-mono text-slate-900">{q.pendingApprox ?? 0}</span></div>
                  <div>{labels.inProgress}: <span className="font-mono text-slate-900">{q.inProgress ?? 0}</span></div>
                  <div>{labels.succeeded24h}: <span className="font-mono text-slate-900">{q.succeeded24h ?? 0}</span></div>
                  <div>{labels.failed24h}: <span className="font-mono text-slate-900">{q.failed24h ?? 0}</span></div>
                </div>
                {canWrite ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.paused ? (
                      <button type="button" className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800" onClick={() => setPending({ kind: "resume", queueName: q.name })}>
                        {labels.resume}
                      </button>
                    ) : (
                      <button type="button" className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800" onClick={() => setPending({ kind: "pause", queueName: q.name })}>
                        {labels.pause}
                      </button>
                    )}
                    <button type="button" className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-800" onClick={() => setPending({ kind: "drain", queueName: q.name })}>
                      {labels.drain}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </AdminSection>
      )}

      <AdminSection title={labels.recentActions}>
        {audit.length === 0 ? (
          <p className="text-sm text-slate-500">{labels.empty}</p>
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>action</AdminDataTableTh>
                <AdminDataTableTh>actor</AdminDataTableTh>
                <AdminDataTableTh>{labels.reasonLabel}</AdminDataTableTh>
                <AdminDataTableTh>at</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {audit.map((a) => (
                <AdminDataTableRow key={a.id}>
                  <AdminDataTableTd>{a.action}</AdminDataTableTd>
                  <AdminDataTableTd>{a.actor?.displayName ?? a.actor?.email ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>{a.reason ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>{new Date(a.createdAt).toLocaleString()}</AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {pending.kind === "drain" ? labels.drain : pending.kind === "pause" ? labels.pause : labels.resume}: {pending.queueName}
            </h3>
            {pending.kind === "drain" ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-amber-700">{labels.drainConfirmHelp}</p>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder={labels.drainConfirmPlaceholder}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
            ) : null}
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
              <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={() => { setPending(null); setReason(""); setConfirmText(""); }} disabled={submitting}>
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

export type { Labels as QueueHealthLabels };
