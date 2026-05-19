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
  AdminStatusBadge,
  Dialog,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import type { Coupon, TabCommonProps } from "./monetization-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Labels = Record<string, any>;

interface Props extends TabCommonProps {
  labels: Labels;
}

function couponTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "active") return "good";
  if (status === "expired") return "neutral";
  if (status === "disabled") return "danger";
  return "warning";
}

export function BillingEventsTab({ common, canRead, canManage, labels }: Props) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Create coupon
  const [showCreate, setShowCreate] = useState(false);
  const [cCode, setCCode] = useState("");
  const [cType, setCType] = useState("percent");
  const [cValue, setCValue] = useState("");
  const [cPlans, setCPlans] = useState("");
  const [cMax, setCMax] = useState("");
  const [cStarts, setCStarts] = useState("");
  const [cEnds, setCEnds] = useState("");
  const [cReason, setCReason] = useState("");
  // Edit coupon
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/admin/monetization/coupons");
      if (!res.ok) { setError(common.error); return; }
      setCoupons((await res.json()) as Coupon[]);
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [canRead, common.error]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const createCoupon = async () => {
    if (!cCode.trim() || !cValue || cReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch("/api/admin/monetization/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cCode.trim(),
          discountType: cType,
          discountValue: Number(cValue),
          allowedPlanSlugs: cPlans.trim() ? cPlans.split(",").map((s) => s.trim()) : undefined,
          maxRedemptions: cMax ? Number(cMax) : undefined,
          startsAt: cStarts || undefined,
          endsAt: cEnds || undefined,
          reason: cReason.trim(),
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCCode(""); setCType("percent"); setCValue(""); setCPlans(""); setCMax(""); setCStarts(""); setCEnds(""); setCReason("");
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const saveCouponEdit = async () => {
    if (!editing || editReason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await adminApiFetch(`/api/admin/monetization/coupons/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, reason: editReason.trim() }),
      });
      if (res.ok) {
        setEditing(null);
        void fetchData();
      } else { setError(common.error); }
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  return (
    <AdminSection title={labels.tab?.["billing-events"] ?? "Billing Events"}>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setShowCreate(true)}
          >
            {labels.couponCreate ?? "Create Coupon"}
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {!loading && coupons.length === 0 && (
        <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
      )}

      {!loading && coupons.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {[labels.couponCode, labels.couponType, labels.couponValue, labels.couponPlans, labels.couponMaxRedeem, labels.couponRedeemed, common.status, labels.couponStarts, labels.couponEnds, labels.actions].map((h) => (
                  <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                ))}
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {coupons.map((c) => (
                <AdminDataTableRow key={c.id}>
                  <AdminDataTableTd className="font-mono text-xs">{c.code}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{c.discountType}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs font-semibold">{c.discountValue}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs max-w-[120px] truncate">{c.allowedPlanSlugs?.join(", ") || "—"}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{c.maxRedemptions ?? "∞"}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{c.redemptionCount}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={couponTone(c.status)}>{c.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{c.startsAt ? new Date(c.startsAt).toLocaleDateString() : "—"}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    {canManage && (
                      <button
                        type="button"
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => { setEditing(c); setEditStatus(c.status); setEditReason(""); }}
                      >
                        {labels.editLabel}
                      </button>
                    )}
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        </div>
      )}

      {/* Create Coupon Dialog */}
      <Dialog open={showCreate}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.couponCreate ?? "Create Coupon"}</h3>
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-slate-600">
            {labels.couponCode} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={cCode} onChange={(e) => setCCode(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.couponType}
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={cType} onChange={(e) => setCType(e.target.value)}>
              <option value="percent">percent</option>
              <option value="fixed">fixed</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            {labels.couponValue} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="number" value={cValue} onChange={(e) => setCValue(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.couponPlans} (comma-separated slugs)
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={cPlans} onChange={(e) => setCPlans(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            {labels.couponMaxRedeem}
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="number" value={cMax} onChange={(e) => setCMax(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-slate-600">
              {labels.couponStarts}
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="date" value={cStarts} onChange={(e) => setCStarts(e.target.value)} />
            </label>
            <label className="block text-xs text-slate-600">
              {labels.couponEnds}
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" type="date" value={cEnds} onChange={(e) => setCEnds(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs text-rose-700">
            {labels.reasonLabel ?? "Reason"} *
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={cReason} onChange={(e) => setCReason(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setShowCreate(false)}>{labels.close}</button>
            <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving || !cCode.trim() || !cValue || cReason.trim().length < 3} onClick={() => void createCoupon()}>{labels.create}</button>
          </div>
        </div>
      </Dialog>

      {/* Edit Coupon Dialog */}
      <Dialog open={!!editing}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.editLabel} — {editing?.code}</h3>
        {editing && (
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-600">
              {common.status}
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {["active", "disabled", "expired"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block text-xs text-rose-700">
              {labels.reasonLabel ?? "Reason"} *
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setEditing(null)}>{labels.close}</button>
              <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving || editReason.trim().length < 3} onClick={() => void saveCouponEdit()}>{labels.save ?? "Save"}</button>
            </div>
          </div>
        )}
      </Dialog>
    </AdminSection>
  );
}
