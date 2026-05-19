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
import type { AnalyticsData, AdPlacement, TabCommonProps } from "./monetization-types";

type Labels = Record<string, string>;

interface Props extends TabCommonProps {
  labels: Labels;
}

export function ProviderConfigTab({ common, canRead, canManage, labels }: Props) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [adPlacements, setAdPlacements] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edit ad config
  const [editingAd, setEditingAd] = useState<AdPlacement | null>(null);
  const [editConfig, setEditConfig] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [aRes, adRes] = await Promise.all([
        adminApiFetch("/api/admin/monetization/analytics"),
        adminApiFetch("/api/admin/monetization/ads/placements"),
      ]);
      if (aRes.ok) setAnalytics((await aRes.json()) as AnalyticsData);
      else setError(common.error);
      if (adRes.ok) setAdPlacements((await adRes.json()) as AdPlacement[]);
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [canRead, common.error]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const toggleAd = async (ad: AdPlacement) => {
    setSaving(true);
    try {
      const res = await adminApiFetch(`/api/admin/monetization/ads/placements/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !ad.active, reason: "toggle_placement" }),
      });
      if (res.ok) void fetchData();
      else setError(common.error);
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  const saveAdConfig = async () => {
    if (!editingAd || editReason.trim().length < 3) return;
    let config: unknown;
    try { config = JSON.parse(editConfig); }
    catch { setError("Invalid JSON"); return; }
    setSaving(true);
    try {
      const res = await adminApiFetch(`/api/admin/monetization/ads/placements/${editingAd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, reason: editReason.trim() }),
      });
      if (res.ok) { setEditingAd(null); void fetchData(); }
      else setError(common.error);
    } catch { setError(common.error); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {/* Analytics Section */}
      <AdminSection title={labels.analyticsWindow ?? "Analytics"}>
        {analytics == null && !loading && (
          <AdminEmptyState title={labels.analyticsNoEvents}>{labels.analyticsNoEvents}</AdminEmptyState>
        )}
        {analytics != null && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Provider: <AdminStatusBadge tone={analytics.billingProviderConnected ? "good" : "danger"}>
                {analytics.billingProviderConnected ? "connected" : "not connected"}
              </AdminStatusBadge>
              {" "} | Window: {analytics.windowDays} days
            </p>
            {analytics.eventsByName.length === 0 && (
              <p className="text-xs text-slate-500">{labels.analyticsNoEvents}</p>
            )}
            {analytics.eventsByName.length > 0 && (
              <div className="max-w-full overflow-x-auto">
                <AdminDataTable>
                  <AdminDataTableHead>
                    <AdminDataTableRow>
                      <AdminDataTableTh>{labels.analyticsEvents}</AdminDataTableTh>
                      <AdminDataTableTh>{common.records}</AdminDataTableTh>
                    </AdminDataTableRow>
                  </AdminDataTableHead>
                  <AdminDataTableBody>
                    {analytics.eventsByName.map((ev) => (
                      <AdminDataTableRow key={ev.name}>
                        <AdminDataTableTd className="font-mono text-xs">{ev.name}</AdminDataTableTd>
                        <AdminDataTableTd className="text-xs font-semibold">{ev.count}</AdminDataTableTd>
                      </AdminDataTableRow>
                    ))}
                  </AdminDataTableBody>
                </AdminDataTable>
              </div>
            )}
          </div>
        )}
      </AdminSection>

      {/* Ad Placements Section */}
      <AdminSection title={labels.adCode ?? "Ad Placements"}>
        {adPlacements.length === 0 && !loading && (
          <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
        )}
        {adPlacements.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  {[labels.adCode, labels.adActive, labels.adImpressions, labels.adClicks, labels.adCtr, labels.actions].map((h) => (
                    <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                  ))}
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {adPlacements.map((ad) => (
                  <AdminDataTableRow key={ad.id}>
                    <AdminDataTableTd className="font-mono text-xs">{ad.code}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone={ad.active ? "good" : "neutral"}>
                        {ad.active ? "ON" : "OFF"}
                      </AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd className="text-xs">{ad.impressions}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs">{ad.clicks}</AdminDataTableTd>
                    <AdminDataTableTd className="text-xs">{(ad.ctr * 100).toFixed(2)}%</AdminDataTableTd>
                    <AdminDataTableTd>
                      {canManage && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs text-indigo-600 hover:underline"
                            onClick={() => void toggleAd(ad)}
                            disabled={saving}
                          >
                            {labels.adToggle}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-indigo-600 hover:underline"
                            onClick={() => { setEditingAd(ad); setEditConfig(JSON.stringify(ad.config ?? {}, null, 2)); setEditReason(""); }}
                          >
                            {labels.adEditConfig}
                          </button>
                        </div>
                      )}
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </div>
        )}
      </AdminSection>

      {/* Edit Ad Config Dialog */}
      <Dialog open={!!editingAd}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.adEditConfig} — {editingAd?.code}</h3>
        {editingAd && (
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-slate-600">
              Config (JSON)
              <textarea
                className="mt-1 w-full min-h-[120px] rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                value={editConfig}
                onChange={(e) => setEditConfig(e.target.value)}
              />
            </label>
            <label className="block text-xs text-rose-700">
              {labels.reasonLabel ?? "Reason"} *
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setEditingAd(null)}>{labels.close}</button>
              <button type="button" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" disabled={saving || editReason.trim().length < 3} onClick={() => void saveAdConfig()}>{labels.save ?? "Save"}</button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
