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

type ErrorRow = {
  id: string;
  rawItemId: string | null;
  sourceKey: string | null;
  message: string | null;
  phase: string | null;
  severity: string | null;
  createdAt?: string;
  status?: string | null;
};

type ListResp = { items: ErrorRow[]; total?: number };

type Labels = {
  title: string;
  description: string;
  refresh: string;
  loading: string;
  error: string;
  empty: string;
  retry: string;
  discard: string;
  bulkRetry: string;
  bulkDiscard: string;
  filterPhase: string;
  filterSeverity: string;
  filterAll: string;
  selected: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  submit: string;
  noPermission: string;
  rawItem: string;
  sourceKey: string;
  message: string;
  phase: string;
  severity: string;
  actions: string;
};

type MePayload = { roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }> };
function permsFromMe(me: MePayload): Set<string> {
  const out = new Set<string>();
  for (const r of me.roles ?? []) for (const link of r.role?.permissions ?? []) {
    const c = link.permission?.code;
    if (c) out.add(c);
  }
  return out;
}

const WRITE_PERMS = ["iam.manage", "content.manage"];

export function ImportFailedClient({ labels }: { labels: Labels }) {
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && WRITE_PERMS.some((p) => perms.has(p));
  const [items, setItems] = useState<ErrorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  type Mode = { kind: "single"; action: "retry" | "discard"; id: string } | { kind: "bulk"; action: "retry" | "discard" } | null;
  const [mode, setMode] = useState<Mode>(null);
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
      const r = await adminApiFetch("/api/admin/operations/import-staging/errors?limit=200");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as ListResp | ErrorRow[];
      const list = Array.isArray(j) ? j : (j.items ?? []);
      setItems(list);
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

  const filtered = useMemo(
    () =>
      items.filter(
        (r) =>
          (phaseFilter === "all" || (r.phase ?? "") === phaseFilter) &&
          (severityFilter === "all" || (r.severity ?? "") === severityFilter)
      ),
    [items, phaseFilter, severityFilter]
  );

  const phases = useMemo(() => Array.from(new Set(items.map((r) => r.phase ?? ""))).filter(Boolean), [items]);
  const severities = useMemo(() => Array.from(new Set(items.map((r) => r.severity ?? ""))).filter(Boolean), [items]);

  const submit = useCallback(async () => {
    if (!mode) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: labels.reasonLabel });
      return;
    }
    setSubmitting(true);
    try {
      if (mode.kind === "single") {
        const path = `/api/admin/operations/import-staging/errors/${mode.id}/${mode.action}`;
        const r = await adminApiFetch(path, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        const body = { ids: Array.from(selected), action: mode.action, reason: reason.trim() };
        const r = await adminApiFetch("/api/admin/operations/import-staging/errors/bulk", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setSelected(new Set());
      }
      setToast({ kind: "ok", text: labels.submit });
      setMode(null);
      setReason("");
      void load();
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [mode, reason, selected, labels, load]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            {canWrite && selected.size > 0 ? (
              <>
                <button type="button" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800" onClick={() => setMode({ kind: "bulk", action: "retry" })}>
                  {labels.bulkRetry} ({selected.size})
                </button>
                <button type="button" className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800" onClick={() => setMode({ kind: "bulk", action: "discard" })}>
                  {labels.bulkDiscard} ({selected.size})
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

      <AdminSection title={labels.title}>
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{labels.filterPhase}:</span>
            <select className="rounded border border-slate-300 px-2 py-1" value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
              <option value="all">{labels.filterAll}</option>
              {phases.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{labels.filterSeverity}:</span>
            <select className="rounded border border-slate-300 px-2 py-1" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="all">{labels.filterAll}</option>
              {severities.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        {loading ? (
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
        ) : error ? (
          <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
        ) : filtered.length === 0 ? (
          <AdminEmptyState title={labels.empty}>{labels.empty}</AdminEmptyState>
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{canWrite ? <span /> : null}</AdminDataTableTh>
                <AdminDataTableTh>{labels.rawItem}</AdminDataTableTh>
                <AdminDataTableTh>{labels.sourceKey}</AdminDataTableTh>
                <AdminDataTableTh>{labels.phase}</AdminDataTableTh>
                <AdminDataTableTh>{labels.severity}</AdminDataTableTh>
                <AdminDataTableTh>{labels.message}</AdminDataTableTh>
                <AdminDataTableTh>{labels.actions}</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {filtered.map((r) => (
                <AdminDataTableRow key={r.id}>
                  <AdminDataTableTd>
                    {canWrite ? <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /> : null}
                  </AdminDataTableTd>
                  <AdminDataTableTd className="font-mono text-xs">{r.rawItemId ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd className="font-mono text-xs">{r.sourceKey ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>{r.phase ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    {r.severity ? <AdminStatusBadge tone={r.severity === "fatal" ? "danger" : r.severity === "warning" ? "warning" : "neutral"}>{r.severity}</AdminStatusBadge> : "—"}
                  </AdminDataTableTd>
                  <AdminDataTableTd className="max-w-md truncate text-xs">{r.message ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    {canWrite ? (
                      <div className="flex gap-1">
                        <button type="button" className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800" onClick={() => setMode({ kind: "single", action: "retry", id: r.id })}>{labels.retry}</button>
                        <button type="button" className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800" onClick={() => setMode({ kind: "single", action: "discard", id: r.id })}>{labels.discard}</button>
                      </div>
                    ) : null}
                  </AdminDataTableTd>
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
              {mode.action === "retry" ? labels.retry : labels.discard}
              {mode.kind === "bulk" ? ` (${selected.size})` : ""}
            </h3>
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
              <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={() => { setMode(null); setReason(""); }} disabled={submitting}>
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

export type { Labels as ImportFailedLabels };
