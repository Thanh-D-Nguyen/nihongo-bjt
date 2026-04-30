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
}

interface DailyWidgetConfig {
  displayOrder: number;
  enabled: boolean;
  id: string;
  widgetKind: string;
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

  useEffect(() => {
    void loadWidgets();
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

  return (
    <div className="space-y-6">
      <AdminPageHeader description={labels.subtitle} title={labels.title} />
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
