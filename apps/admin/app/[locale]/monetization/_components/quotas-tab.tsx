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
import type { QuotaPolicy, PlanQuota, QuotaOverride, TabCommonProps } from "./monetization-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Labels = Record<string, any>;

interface Props extends TabCommonProps {
  labels: Labels;
  plans: Array<{ id: string; slug: string }> | null;
}

export function QuotasTab({ common, canRead, canManage, labels, plans }: Props) {
  const [policies, setPolicies] = useState<QuotaPolicy[]>([]);
  const [planQuotas, setPlanQuotas] = useState<PlanQuota[]>([]);
  const [overrides, setOverrides] = useState<QuotaOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Create policy dialog
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [pKey, setPKey] = useState("");
  const [pWindow, setPWindow] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pWarn, setPWarn] = useState("");
  const [pReason, setPReason] = useState("");
  // Link plan dialog
  const [showLinkPlan, setShowLinkPlan] = useState(false);
  const [linkPolicyId, setLinkPolicyId] = useState("");
  const [linkPlanId, setLinkPlanId] = useState("");
  const [linkLimit, setLinkLimit] = useState("");
  const [linkReason, setLinkReason] = useState("");
  // Create override dialog
  const [showCreateOverride, setShowCreateOverride] = useState(false);
  const [oUserId, setOUserId] = useState("");
  const [oQuotaKey, setOQuotaKey] = useState("");
  const [oLimit, setOLimit] = useState("");
  const [oExpires, setOExpires] = useState("");
  const [oReason, setOReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [qRes, oRes] = await Promise.all([
        adminApiFetch("/api/admin/monetization/quotas"),
        adminApiFetch("/api/admin/monetization/quota-overrides"),
      ]);
      if (qRes.ok) {
        const data = (await qRes.json()) as { policies: QuotaPolicy[]; planQuotas: PlanQuota[] };
        setPolicies(data.policies);
        setPlanQuotas(data.planQuotas);
      } else { setError(common.error); }
      if (oRes.ok) {
        setOverrides((await oRes.json()) as QuotaOverride[]);
      }
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [canRead, common.error]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const createPolicy = async () => {
    if (!pKey.trim() || !pWindow.trim() || pReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch("/api/admin/monetization/quotas/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: pKey.trim(),
          windowCode: pWindow.trim(),
          description: pDesc.trim() || undefined,
          warnThresholdPercent: pWarn ? Number(pWarn) : undefined,
          reason: pReason.trim(),
        }),
      });
      if (res.ok) {
        setShowCreatePolicy(false);
        setPKey(""); setPWindow(""); setPDesc(""); setPWarn(""); setPReason("");
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const createPlanLink = async () => {
    if (!linkPolicyId || !linkPlanId || !linkLimit || linkReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch("/api/admin/monetization/quotas/plan-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: linkPlanId,
          quotaPolicyId: linkPolicyId,
          limitValue: Number(linkLimit),
          reason: linkReason.trim(),
        }),
      });
      if (res.ok) {
        setShowLinkPlan(false);
        setLinkPolicyId(""); setLinkPlanId(""); setLinkLimit(""); setLinkReason("");
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const createOverride = async () => {
    if (!oUserId.trim() || !oQuotaKey.trim() || !oLimit || oReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch("/api/admin/monetization/quota-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: oUserId.trim(),
          quotaKey: oQuotaKey.trim(),
          limitValue: Number(oLimit),
          expiresAt: oExpires || undefined,
          reason: oReason.trim(),
        }),
      });
      if (res.ok) {
        setShowCreateOverride(false);
        setOUserId(""); setOQuotaKey(""); setOLimit(""); setOExpires(""); setOReason("");
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const deleteOverride = async (id: string) => {
    if (!confirm(labels.confirmDelete)) return;
    setSaving(true);
    try {
      const res = await adminApiFetch(
        `/api/admin/monetization/quota-overrides/${id}?reason=admin_delete`,
        { method: "DELETE" }
      );
      if (res.ok) { void fetchData(); }
      else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {/* Section 1: Policies */}
        <AdminSection title={labels.tab?.quotas ?? "Quota Policies"}>
        {canManage && (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              onClick={() => setShowCreatePolicy(true)}
            >
              {labels.quotaCreatePolicy}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-indigo-200"
              onClick={() => setShowLinkPlan(true)}
            >
              {labels.quotaLinkPlan}
            </button>
          </div>
        )}

        {!loading && policies.length === 0 && (
          <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
        )}

        {policies.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  {[labels.quotaKey, labels.quotaWindow, labels.quotaWarnPct, labels.entDesc].map((h) => (
                    <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                  ))}
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {policies.map((p) => (
                  <AdminDataTableRow key={p.id}>
                    <AdminDataTableTd className="font-mono text-xs">{p.key}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs">{p.windowCode}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs">{p.warnThresholdPercent ?? "—"}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs" muted>{p.description ?? "—"}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </div>
        )}
      </AdminSection>

      {/* Section 2: Plan-Quota links */}
      {planQuotas.length > 0 && (
        <AdminSection title={labels.quotaLinkPlan}>
          <div className="max-w-full overflow-x-auto">
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  {[labels.subPlan, labels.quotaKey, labels.quotaLimit].map((h) => (
                    <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                  ))}
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {planQuotas.map((pq) => (
                  <AdminDataTableRow key={pq.id}>
                    <AdminDataTableTd className="text-xs font-mono">{pq.plan?.slug ?? pq.planId}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs font-mono">{pq.quotaPolicy?.key ?? pq.quotaPolicyId}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs font-semibold">{pq.limitValue}</AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </div>
        </AdminSection>
      )}

      {/* Section 3: User Overrides */}
      <AdminSection title={labels.quotaOverrideCreate}>
        {canManage && (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              onClick={() => setShowCreateOverride(true)}
            >
              {labels.quotaOverrideCreate}
            </button>
          </div>
        )}

        {overrides.length === 0 && !loading && (
          <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
        )}

        {overrides.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  {[labels.quotaOverrideUser, labels.quotaKey, labels.quotaLimit, labels.quotaOverrideExpires, labels.actions].map((h) => (
                    <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                  ))}
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {overrides.map((o) => (
                  <AdminDataTableRow key={o.id}>
                    <AdminDataTableTd className="text-xs">
                      {o.user?.displayName ?? o.userId}
                    </AdminDataTableTd>
                    <AdminDataTableTd className="font-mono text-xs">{o.quotaKey}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs font-semibold">{o.limitValue}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs">
                      {o.expiresAt ? new Date(o.expiresAt).toLocaleDateString() : "∞"}
                    </AdminDataTableTd>
                    <AdminDataTableTd>
                      {canManage && (
                        <button
                          type="button"
                          className="text-xs text-rose-600 hover:underline"
                          onClick={() => void deleteOverride(o.id)}
                        >
                          {labels.deleteLabel}
                        </button>
                      )}
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </div>
        )}
      </AdminSection>

      {/* Dialog: Create Policy */}
      <Dialog open={showCreatePolicy}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.quotaCreatePolicy}</h3>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600">
            {labels.quotaKey} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={pKey} onChange={(e) => setPKey(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.quotaWindow} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={pWindow} onChange={(e) => setPWindow(e.target.value)} placeholder="e.g. daily, monthly" />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.quotaWarnPct}
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="number" value={pWarn} onChange={(e) => setPWarn(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.entDesc}
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" rows={2} value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
          </label>
          <label className="block text-xs text-rose-700">
            {labels.reasonLabel ?? "Reason"} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={pReason} onChange={(e) => setPReason(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setShowCreatePolicy(false)}>{labels.close}</button>
            <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving || !pKey.trim() || !pWindow.trim() || pReason.trim().length < 3} onClick={() => void createPolicy()}>{labels.create}</button>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Link Plan */}
      <Dialog open={showLinkPlan}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.quotaLinkPlan}</h3>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600">
            Policy *
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={linkPolicyId} onChange={(e) => setLinkPolicyId(e.target.value)}>
              <option value="">—</option>
              {policies.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            {labels.subPlan} *
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={linkPlanId} onChange={(e) => setLinkPlanId(e.target.value)}>
              <option value="">—</option>
              {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.slug}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            {labels.quotaLimit} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="number" value={linkLimit} onChange={(e) => setLinkLimit(e.target.value)} />
          </label>
          <label className="block text-xs text-rose-700">
            {labels.reasonLabel ?? "Reason"} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={linkReason} onChange={(e) => setLinkReason(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setShowLinkPlan(false)}>{labels.close}</button>
            <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving || !linkPolicyId || !linkPlanId || !linkLimit || linkReason.trim().length < 3} onClick={() => void createPlanLink()}>{labels.create}</button>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Create Override */}
      <Dialog open={showCreateOverride}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.quotaOverrideCreate}</h3>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600">
            {labels.quotaOverrideUser} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={oUserId} onChange={(e) => setOUserId(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.quotaKey} *
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={oQuotaKey} onChange={(e) => setOQuotaKey(e.target.value)}>
              <option value="">—</option>
              {policies.map((p) => <option key={p.id} value={p.key}>{p.key}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            {labels.quotaLimit} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="number" value={oLimit} onChange={(e) => setOLimit(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.quotaOverrideExpires}
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="date" value={oExpires} onChange={(e) => setOExpires(e.target.value)} />
          </label>
          <label className="block text-xs text-rose-700">
            {labels.reasonLabel ?? "Reason"} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={oReason} onChange={(e) => setOReason(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setShowCreateOverride(false)}>{labels.close}</button>
            <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving || !oUserId.trim() || !oQuotaKey || !oLimit || oReason.trim().length < 3} onClick={() => void createOverride()}>{labels.create}</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
