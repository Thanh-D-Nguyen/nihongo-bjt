"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminSection,
  Dialog,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import type { EntitlementDef, TabCommonProps } from "./monetization-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Labels = Record<string, any>;

interface Props extends TabCommonProps {
  labels: Labels;
  plans: Array<{ id: string; slug: string }> | null;
}

export function EntitlementsTab({ common, canRead, canManage, labels, plans }: Props) {
  const [rows, setRows] = useState<EntitlementDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [linkedPlans, setLinkedPlans] = useState<Array<{ id: string; slug: string }>>([]);
  const [linkPlanId, setLinkPlanId] = useState("");
  const [linkReason, setLinkReason] = useState("");

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/admin/monetization/entitlements");
      if (!res.ok) { setError(common.error); return; }
      setRows((await res.json()) as EntitlementDef[]);
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [canRead, common.error]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const createEntitlement = async () => {
    if (!newKey.trim() || newReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch("/api/admin/monetization/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey.trim(),
          category: newCategory.trim() || undefined,
          description: newDesc.trim() || undefined,
          reason: newReason.trim(),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewKey(""); setNewCategory(""); setNewDesc(""); setNewReason("");
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const expandRow = async (ent: EntitlementDef) => {
    if (expanded === ent.id) { setExpanded(null); return; }
    setExpanded(ent.id);
    setLinkedPlans([]);
    setLinkPlanId("");
    setLinkReason("");
    // Fetch plans linked to this entitlement — the GET endpoint returns entitlements with plan count
    // We'll use the plans list to show which are linked (by re-fetching entitlement detail isn't available,
    // so we rely on the _count.plans field and link/unlink actions)
  };

  const linkPlan = async (entId: string) => {
    if (!linkPlanId || linkReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch(`/api/admin/monetization/plans/${linkPlanId}/entitlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: entId, reason: linkReason.trim() }),
      });
      if (res.ok) {
        setLinkPlanId("");
        setLinkReason("");
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const unlinkPlan = async (planId: string, entId: string) => {
    const reason = encodeURIComponent("unlink entitlement");
    setSaving(true);
    try {
      const res = await adminApiFetch(
        `/api/admin/monetization/plans/${planId}/entitlements/${entId}?reason=${reason}`,
        { method: "DELETE" }
      );
      if (res.ok) { void fetchData(); }
      else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  return (
    <AdminSection title={labels.tab?.entitlements ?? "Entitlements"}>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setShowCreate(true)}
          >
            {labels.entCreate}
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {!loading && rows.length === 0 && (
        <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
      )}

      {!loading && rows.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {[labels.entKey, labels.entCategory, labels.entLinkedPlans, labels.entDesc, labels.actions].map((h) => (
                  <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                ))}
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {rows.map((ent) => (
                <AdminDataTableRow key={ent.id}>
                  <AdminDataTableTd className="font-mono text-xs">{ent.key}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{ent.category ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{ent._count.plans}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs max-w-[200px] truncate" muted>{ent.description ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    {canManage && (
                      <button
                        type="button"
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => void expandRow(ent)}
                      >
                        {expanded === ent.id ? labels.close : labels.entLinkPlan}
                      </button>
                    )}
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>

          {expanded && canManage && plans && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">{labels.entLinkPlan}</p>
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={linkPlanId}
                  onChange={(e) => setLinkPlanId(e.target.value)}
                >
                  <option value="">{labels.entSelectPlan}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.slug}</option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  placeholder={labels.reasonLabel ?? "Reason"}
                  value={linkReason}
                  onChange={(e) => setLinkReason(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                  disabled={saving || !linkPlanId || linkReason.trim().length < 3}
                  onClick={() => void linkPlan(expanded)}
                >
                  {labels.entLinkPlan}
                </button>
              </div>
              {/* Show linked plans for quick unlink */}
              {linkedPlans.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {linkedPlans.map((lp) => (
                    <span key={lp.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                      {lp.slug}
                      <button
                        type="button"
                        className="text-rose-500 hover:text-rose-700"
                        onClick={() => void unlinkPlan(lp.id, expanded)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreate}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.entCreate}</h3>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600">
            {labels.entKey} *
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.entCategory}
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.entDesc}
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </label>
          <label className="block text-xs text-rose-700">
            {labels.reasonLabel ?? "Reason"} *
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              onClick={() => setShowCreate(false)}
            >
              {labels.close}
            </button>
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={saving || !newKey.trim() || newReason.trim().length < 3}
              onClick={() => void createEntitlement()}
            >
              {labels.create}
            </button>
          </div>
        </div>
      </Dialog>
    </AdminSection>
  );
}
