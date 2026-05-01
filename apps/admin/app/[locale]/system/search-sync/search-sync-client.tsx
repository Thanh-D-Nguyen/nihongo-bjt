"use client";

import {
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

type Snapshot = {
  generatedAt?: string;
  status?: string;
  ageMs?: number | null;
  totalDocs?: number;
  byType?: Record<string, number>;
  lastJob?: { id: string; createdAt: string; status?: string } | null;
};

type Labels = {
  title: string;
  description: string;
  refresh: string;
  loading: string;
  error: string;
  status: string;
  ageMs: string;
  totalDocs: string;
  fullReindex: string;
  partialReindex: string;
  fullConfirmHelp: string;
  fullConfirmPlaceholder: string;
  contentTypeLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  submit: string;
  noPermission: string;
  successMessage: string;
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

const FULL_CONFIRM_TOKEN = "rebuild-search-projection";
const CONTENT_TYPES = ["lexeme", "kanji", "grammar", "example"];

export function SearchSyncClient({ labels }: { labels: Labels }) {
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  type Mode = "full" | "partial";
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [contentType, setContentType] = useState<string>(CONTENT_TYPES[0]);
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
      const r = await adminApiFetch("/api/admin/operations/system/search-sync");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Snapshot);
      setError(null);
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
    if (!mode) return;
    if (reason.trim().length < 3) {
      setToast({ kind: "err", text: labels.reasonLabel });
      return;
    }
    if (mode === "full" && confirmText !== FULL_CONFIRM_TOKEN) {
      setToast({ kind: "err", text: labels.fullConfirmHelp });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "full") {
        const r = await adminApiFetch("/api/admin/operations/search-rebuild", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() })
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        const r = await adminApiFetch("/api/admin/operations/search-rebuild/partial", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType, reason: reason.trim() })
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
      setToast({ kind: "ok", text: labels.successMessage });
      setMode(null);
      setReason("");
      setConfirmText("");
      void load();
    } catch (e) {
      setToast({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [mode, reason, confirmText, contentType, labels, load]);

  const byType = useMemo(() => Object.entries(data?.byType ?? {}), [data]);

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
                <button type="button" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800" onClick={() => setMode("partial")}>
                  {labels.partialReindex}
                </button>
                <button type="button" className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800" onClick={() => setMode("full")}>
                  {labels.fullReindex}
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
      {loading && !data ? (
        <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      ) : error && !data ? (
        <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
      ) : data ? (
        <AdminSection title={labels.title}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AdminKpiCard
              label={labels.status}
              value={
                <AdminStatusBadge tone={data.status === "ok" || data.status === "fresh" ? "good" : data.status === "stale" ? "warning" : "neutral"}>
                  {data.status ?? "—"}
                </AdminStatusBadge>
              }
            />
            <AdminKpiCard label={labels.ageMs} value={data.ageMs == null ? "—" : `${Math.round(data.ageMs / 1000)}s`} />
            <AdminKpiCard label={labels.totalDocs} value={data.totalDocs ?? 0} />
          </div>
          {byType.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {byType.map(([k, v]) => (
                <div key={k} className="rounded border border-slate-200 bg-white p-3 text-sm">
                  <div className="text-xs font-medium uppercase text-slate-500">{k}</div>
                  <div className="font-mono text-slate-900">{v}</div>
                </div>
              ))}
            </div>
          ) : null}
        </AdminSection>
      ) : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {mode === "full" ? labels.fullReindex : labels.partialReindex}
            </h3>
            {mode === "partial" ? (
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">{labels.contentTypeLabel}</span>
                <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" value={contentType} onChange={(e) => setContentType(e.target.value)}>
                  {CONTENT_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {mode === "full" ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-amber-700">{labels.fullConfirmHelp}</p>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder={labels.fullConfirmPlaceholder}
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
              <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={() => { setMode(null); setReason(""); setConfirmText(""); }} disabled={submitting}>
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

export type { Labels as SearchSyncLabels };
