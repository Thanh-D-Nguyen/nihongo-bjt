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
  AdminSelect,
  AdminStatusBadge,
  Dialog,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import type { Subscription, TabCommonProps } from "./monetization-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Labels = Record<string, any>;

interface Props extends TabCommonProps {
  labels: Labels;
}

function subTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "active" || status === "trialing") return "good";
  if (status === "past_due") return "danger";
  if (status === "canceled" || status === "expired") return "neutral";
  return "warning";
}

export function RefundsTab({ common, canRead, canManage, labels }: Props) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");
  // Action dialog
  const [target, setTarget] = useState<Subscription | null>(null);
  const [action, setAction] = useState<"cancel_end" | "cancel_now" | "expire">("cancel_end");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "40", status: statusFilter || "active" });
      const res = await adminApiFetch(`/api/admin/monetization/subscriptions?${params}`);
      if (!res.ok) { setError(common.error); return; }
      const data = (await res.json()) as { items: Subscription[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [canRead, statusFilter, common.error]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const executeAction = async () => {
    if (!target || reason.trim().length < 3) return;
    setSaving(true);
    const body: Record<string, unknown> = { reason: reason.trim() };
    if (action === "cancel_end") {
      body.cancelAtPeriodEnd = true;
    } else if (action === "cancel_now") {
      body.status = "canceled";
    } else if (action === "expire") {
      body.status = "expired";
    }
    try {
      const res = await adminApiFetch(`/api/admin/monetization/subscriptions/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setTarget(null); setReason(""); void fetchData(); }
      else setError(common.error);
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  return (
    <AdminSection title={labels.tab?.refunds ?? "Refunds"}>
      <p className="text-xs text-slate-600 mb-2">{labels.refundDesc}</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <AdminSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {["active", "trialing", "past_due"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </AdminSelect>
        <span className="ml-auto text-xs text-slate-500">{common.records}: {total}</span>
      </div>

      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {!loading && items.length === 0 && (
        <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {[labels.subUser, labels.subPlan, common.status, labels.subProvider, labels.subPeriod, labels.actions].map((h) => (
                  <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                ))}
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {items.map((sub) => (
                <AdminDataTableRow key={sub.id}>
                  <AdminDataTableTd className="text-xs">
                    <span className="font-medium">{sub.user?.displayName ?? "—"}</span>
                    <br />
                    <span className="text-slate-500">{sub.user?.email ?? sub.userId}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs font-mono">{sub.plan?.slug ?? sub.planId}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={subTone(sub.status)}>{sub.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{sub.provider}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    {canManage && (
                      <button
                        type="button"
                        className="text-xs text-rose-600 hover:underline"
                        onClick={() => { setTarget(sub); setAction("cancel_end"); setReason(""); }}
                      >
                        {labels.refundAction}
                      </button>
                    )}
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        </div>
      )}

      {/* Refund Action Dialog */}
      <Dialog open={!!target}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.refundAction}</h3>
        {target && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-600">
              {target.user?.displayName} — {target.plan?.slug} ({target.status})
            </p>
            <label className="block text-xs text-slate-600">
              Action
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={action}
                onChange={(e) => setAction(e.target.value as typeof action)}
              >
                <option value="cancel_end">{labels.refundCancelEnd ?? "Cancel at period end"}</option>
                <option value="cancel_now">{labels.refundCancelNow ?? "Cancel immediately"}</option>
                <option value="expire">{labels.refundExpire ?? "Mark expired"}</option>
              </select>
            </label>
            <label className="block text-xs text-rose-700">
              {labels.reasonLabel ?? "Reason"} *
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setTarget(null)}>{labels.close}</button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={saving || reason.trim().length < 3}
                onClick={() => void executeAction()}
              >
                {labels.refundAction}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </AdminSection>
  );
}
