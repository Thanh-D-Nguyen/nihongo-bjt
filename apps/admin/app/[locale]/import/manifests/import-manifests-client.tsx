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

type Manifest = {
  id: string;
  sourceType: string;
  targetType: string;
  version: number;
  status: "draft" | "active" | "archived";
  notes: string | null;
  mapping: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

type Labels = {
  title: string;
  description: string;
  refresh: string;
  loading: string;
  error: string;
  empty: string;
  create: string;
  edit: string;
  run: string;
  archive: string;
  status: string;
  source: string;
  target: string;
  version: string;
  notes: string;
  mappingJson: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  submit: string;
  noPermission: string;
  invalidJson: string;
  history: string;
  runOnlyActive: string;
};

export function ImportManifestsClient({ labels }: { labels: Labels }) {
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("iam.manage");
  const [items, setItems] = useState<Manifest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  type Mode = { kind: "create" } | { kind: "edit"; manifest: Manifest } | { kind: "run"; manifest: Manifest } | null;
  const [mode, setMode] = useState<Mode>(null);
  const [form, setForm] = useState({ sourceType: "", targetType: "", version: 1, status: "draft" as Manifest["status"], notes: "", mappingJson: "{}" });
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
      const r = await adminApiFetch("/api/admin/operations/import-manifests?limit=200");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { items?: Manifest[] } | Manifest[];
      setItems(Array.isArray(j) ? j : (j.items ?? []));
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
    setSubmitting(true);
    try {
      if (mode.kind === "create") {
        let mapping: Record<string, unknown>;
        try { mapping = JSON.parse(form.mappingJson) as Record<string, unknown>; } catch {
          setToast({ kind: "err", text: labels.invalidJson });
          setSubmitting(false);
          return;
        }
        const body = { sourceType: form.sourceType, targetType: form.targetType, version: form.version, mapping, notes: form.notes || undefined, reason: reason.trim() };
        const r = await adminApiFetch("/api/admin/operations/import-manifests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else if (mode.kind === "edit") {
        let mapping: Record<string, unknown> | undefined;
        try {
          mapping = form.mappingJson.trim() ? (JSON.parse(form.mappingJson) as Record<string, unknown>) : undefined;
        } catch {
          setToast({ kind: "err", text: labels.invalidJson });
          setSubmitting(false);
          return;
        }
        const body: Record<string, unknown> = { reason: reason.trim() };
        if (mapping) body.mapping = mapping;
        if (form.notes !== mode.manifest.notes) body.notes = form.notes || null;
        if (form.status !== mode.manifest.status) body.status = form.status;
        const r = await adminApiFetch(`/api/admin/operations/import-manifests/${mode.manifest.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else if (mode.kind === "run") {
        const r = await adminApiFetch(`/api/admin/operations/import-manifests/${mode.manifest.id}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
  }, [mode, form, reason, labels, load]);

  const openCreate = () => {
    setForm({ sourceType: "", targetType: "", version: 1, status: "draft", notes: "", mappingJson: "{\n}" });
    setMode({ kind: "create" });
    setReason("");
  };
  const openEdit = (m: Manifest) => {
    setForm({
      sourceType: m.sourceType,
      targetType: m.targetType,
      version: m.version,
      status: m.status,
      notes: m.notes ?? "",
      mappingJson: JSON.stringify(m.mapping ?? {}, null, 2)
    });
    setMode({ kind: "edit", manifest: m });
    setReason("");
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
            {canWrite ? (
              <button type="button" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800" onClick={openCreate}>
                {labels.create}
              </button>
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
        {loading ? (
          <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
        ) : error ? (
          <AdminEmptyState title={labels.error}>{error}</AdminEmptyState>
        ) : items.length === 0 ? (
          <AdminEmptyState title={labels.empty}>{labels.empty}</AdminEmptyState>
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{labels.source}</AdminDataTableTh>
                <AdminDataTableTh>{labels.target}</AdminDataTableTh>
                <AdminDataTableTh>{labels.version}</AdminDataTableTh>
                <AdminDataTableTh>{labels.status}</AdminDataTableTh>
                <AdminDataTableTh>{labels.notes}</AdminDataTableTh>
                <AdminDataTableTh />
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {items.map((m) => (
                <AdminDataTableRow key={m.id}>
                  <AdminDataTableTd className="font-mono text-xs">{m.sourceType}</AdminDataTableTd>
                  <AdminDataTableTd className="font-mono text-xs">{m.targetType}</AdminDataTableTd>
                  <AdminDataTableTd>{m.version}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={m.status === "active" ? "good" : m.status === "archived" ? "neutral" : "warning"}>{m.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="max-w-md truncate text-xs">{m.notes ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    {canWrite ? (
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs" onClick={() => openEdit(m)}>{labels.edit}</button>
                        <button type="button" className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 disabled:opacity-50" disabled={m.status !== "active"} title={m.status !== "active" ? labels.runOnlyActive : ""} onClick={() => { setMode({ kind: "run", manifest: m }); setReason(""); }}>
                          {labels.run}
                        </button>
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
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-950">
              {mode.kind === "create" ? labels.create : mode.kind === "edit" ? labels.edit : labels.run}
            </h3>
            {mode.kind !== "run" ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <label>
                  <span className="text-xs font-medium text-slate-700">{labels.source}</span>
                  <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} disabled={mode.kind === "edit"} />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-700">{labels.target}</span>
                  <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono" value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })} disabled={mode.kind === "edit"} />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-700">{labels.version}</span>
                  <input type="number" min={1} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={form.version} onChange={(e) => setForm({ ...form, version: Number(e.target.value) })} disabled={mode.kind === "edit"} />
                </label>
                <label>
                  <span className="text-xs font-medium text-slate-700">{labels.status}</span>
                  <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Manifest["status"] })} disabled={mode.kind === "create"}>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
                <label className="col-span-2">
                  <span className="text-xs font-medium text-slate-700">{labels.notes}</span>
                  <textarea className="mt-1 w-full rounded border border-slate-300 px-2 py-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>
                <label className="col-span-2">
                  <span className="text-xs font-medium text-slate-700">{labels.mappingJson}</span>
                  <textarea className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs" rows={8} value={form.mappingJson} onChange={(e) => setForm({ ...form, mappingJson: e.target.value })} />
                </label>
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

export type { Labels as ImportManifestsLabels };
