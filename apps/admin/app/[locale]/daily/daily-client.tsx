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
import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface DailyAdminLabels {
  disable: string;
  empty: string;
  enable: string;
  error: string;
  eyebrow: string;
  loading: string;
  order: string;
  subtitle: string;
  title: string;
  nhkDefaultType: string;
  nhkEasyEnabled: string;
  nhkEasyFeedUrl: string;
  nhkNormalEnabled: string;
  nhkNormalFeedUrl: string;
  nhkRefresh: string;
  nhkSave: string;
  nhkSaved: string;
  nhkTitle: string;
}

interface DailyWidgetConfig {
  displayOrder: number;
  enabled: boolean;
  id: string;
  widgetKind: string;
}

interface NhkNewsConfig {
  defaultType: "easy" | "normal";
  easyEnabled: boolean;
  easyFeedUrl: string;
  normalEnabled: boolean;
  normalFeedUrl: string;
}

export function DailyAdminClient({
  labels,
  locale
}: {
  labels: DailyAdminLabels;
  locale: "vi" | "ja";
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nhkConfig, setNhkConfig] = useState<NhkNewsConfig | null>(null);
  const [nhkSaving, setNhkSaving] = useState(false);
  const [nhkStatus, setNhkStatus] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<DailyWidgetConfig[]>([]);

  async function loadWidgets() {
    setLoading(true);
    try {
      const response = await adminApiFetch(`/api/admin/daily/widgets?locale=${locale}`);
      if (!response.ok) {
        throw new Error("Daily widgets request failed");
      }
      setWidgets((await response.json()) as DailyWidgetConfig[]);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadNhkConfig() {
    try {
      const response = await adminApiFetch(`/api/admin/nhk-news/config?locale=${locale}`);
      if (!response.ok) throw new Error("NHK config request failed");
      setNhkConfig((await response.json()) as NhkNewsConfig);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    void loadWidgets();
    void loadNhkConfig();
  }, []);

  async function toggleWidget(widget: DailyWidgetConfig) {
    const response = await adminApiFetch(`/api/admin/daily/widgets/${widget.id}`, {
      body: JSON.stringify({ enabled: !widget.enabled }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });
    if (!response.ok) {
      setError(true);
      return;
    }
    await loadWidgets();
  }

  async function saveNhkConfig() {
    if (!nhkConfig) return;
    setNhkSaving(true);
    setNhkStatus(null);
    try {
      const response = await adminApiFetch(`/api/admin/nhk-news/config?locale=${locale}`, {
        body: JSON.stringify(nhkConfig),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
      if (!response.ok) throw new Error("save_failed");
      setNhkConfig((await response.json()) as NhkNewsConfig);
      setNhkStatus(labels.nhkSaved);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setNhkSaving(false);
    }
  }

  async function refreshNhkFeeds() {
    setNhkStatus(null);
    try {
      const response = await adminApiFetch(`/api/admin/nhk-news/refresh?locale=${locale}`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("refresh_failed");
      const data = (await response.json()) as { easy: { count: number }; normal: { count: number } };
      setNhkStatus(`Easy: ${data.easy.count} · Normal: ${data.normal.count}`);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader description={labels.subtitle} title={labels.title} />
      <AdminSection description="NHK Easy / NHK RSS" title={labels.nhkTitle}>
        {nhkConfig ? (
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">{labels.nhkDefaultType}</span>
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  value={nhkConfig.defaultType}
                  onChange={(event) =>
                    setNhkConfig({ ...nhkConfig, defaultType: event.target.value === "normal" ? "normal" : "easy" })
                  }
                >
                  <option value="easy">NHK Easy</option>
                  <option value="normal">Normal NHK</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
                <input
                  checked={nhkConfig.easyEnabled}
                  type="checkbox"
                  onChange={(event) => setNhkConfig({ ...nhkConfig, easyEnabled: event.target.checked })}
                />
                {labels.nhkEasyEnabled}
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
                <input
                  checked={nhkConfig.normalEnabled}
                  type="checkbox"
                  onChange={(event) => setNhkConfig({ ...nhkConfig, normalEnabled: event.target.checked })}
                />
                {labels.nhkNormalEnabled}
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{labels.nhkEasyFeedUrl}</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={nhkConfig.easyFeedUrl}
                onChange={(event) => setNhkConfig({ ...nhkConfig, easyFeedUrl: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{labels.nhkNormalFeedUrl}</span>
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={nhkConfig.normalFeedUrl}
                onChange={(event) => setNhkConfig({ ...nhkConfig, normalFeedUrl: event.target.value })}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                disabled={nhkSaving}
                onClick={() => void saveNhkConfig()}
                type="button"
              >
                {labels.nhkSave}
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => void refreshNhkFeeds()}
                type="button"
              >
                {labels.nhkRefresh}
              </button>
              {nhkStatus ? <span className="text-xs font-medium text-slate-600">{nhkStatus}</span> : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{labels.loading}</p>
        )}
      </AdminSection>
      <AdminSection description={`${widgets.length} widgets`} title={labels.eyebrow}>
        {loading ? <p className="text-sm text-slate-600">{labels.loading}</p> : null}
        {error ? (
          <AdminEmptyState title={labels.error}>{labels.error}</AdminEmptyState>
        ) : null}
        {!loading && !error && widgets.length === 0 ? (
          <AdminEmptyState title={labels.empty}>{labels.empty}</AdminEmptyState>
        ) : null}
        {!loading && !error && widgets.length > 0 ? (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>Widget</AdminDataTableTh>
                <AdminDataTableTh>{labels.order}</AdminDataTableTh>
                <AdminDataTableTh>Status</AdminDataTableTh>
                <AdminDataTableTh>Action</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {widgets.map((widget) => (
                <AdminDataTableRow key={widget.id}>
                  <AdminDataTableTd>
                    <span className="font-medium">{widget.widgetKind}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>{widget.displayOrder}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={widget.enabled ? "good" : "warning"}>
                      {widget.enabled ? "Enabled" : "Disabled"}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium transition-colors hover:bg-slate-100"
                      onClick={() => void toggleWidget(widget)}
                      type="button"
                    >
                      {widget.enabled ? labels.disable : labels.enable}
                    </button>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        ) : null}
      </AdminSection>
    </div>
  );
}
