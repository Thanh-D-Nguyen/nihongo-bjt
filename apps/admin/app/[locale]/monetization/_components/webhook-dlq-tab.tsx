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
import type { WebhookEvent, TabCommonProps } from "./monetization-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Labels = Record<string, any>;

interface Props extends TabCommonProps {
  labels: Labels;
}

function whTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "processed") return "good";
  if (status === "failed" || status === "dead_lettered") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

export function WebhookDlqTab({ common, canRead, labels }: Props) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("failed");
  const [rawPayload, setRawPayload] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ take: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await adminApiFetch(`/api/admin/billing/webhook?${params}`);
      if (!res.ok) { setError(common.error); return; }
      setEvents((await res.json()) as WebhookEvent[]);
    } catch { setError(common.error); }
    finally { setLoading(false); }
  }, [canRead, statusFilter, common.error]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const viewRaw = async (id: string) => {
    setRawPayload(null);
    setRawLoading(true);
    try {
      const res = await adminApiFetch(`/api/admin/billing/webhook/${id}/raw`);
      if (res.ok) {
        const data = await res.json();
        setRawPayload(JSON.stringify(data, null, 2));
      } else {
        setRawPayload("Error loading payload");
      }
    } catch {
      setRawPayload("Error loading payload");
    } finally {
      setRawLoading(false);
    }
  };

  return (
    <AdminSection title={labels.tab?.["webhook-dlq"] ?? "Webhook DLQ"}>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <AdminSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{labels.subAllStatuses ?? "All"}</option>
          {["failed", "dead_lettered", "pending", "processed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </AdminSelect>
        <span className="ml-auto text-xs text-slate-500">
          {common.records}: {events.length}
        </span>
      </div>

      {loading && <p className="text-sm text-slate-500">{common.loading}…</p>}

      {!loading && events.length === 0 && (
        <AdminEmptyState title={labels.noResults}>{labels.noResults}</AdminEmptyState>
      )}

      {!loading && events.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                {[labels.whProvider, labels.whEventType, labels.whStatus, labels.whRetries, labels.whReceived, labels.whError, labels.actions].map((h) => (
                  <AdminDataTableTh key={h} className="whitespace-nowrap">{h}</AdminDataTableTh>
                ))}
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {events.map((ev) => (
                <AdminDataTableRow key={ev.id}>
                  <AdminDataTableTd className="text-xs">{ev.provider}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs font-mono">{ev.eventType}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge tone={whTone(ev.status)}>{ev.status}</AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{ev.retryCount}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs">{new Date(ev.receivedAt).toLocaleString()}</AdminDataTableTd>
                  <AdminDataTableTd className="text-xs max-w-[160px] truncate text-rose-600">{ev.lastError ?? "—"}</AdminDataTableTd>
                  <AdminDataTableTd>
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:underline"
                      onClick={() => void viewRaw(ev.id)}
                    >
                      {labels.whViewRaw}
                    </button>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        </div>
      )}

      {/* Raw Payload Dialog */}
      <Dialog open={rawPayload !== null}>
        <h3 className="text-sm font-semibold text-slate-900">{labels.whViewRaw}</h3>
        <div className="mt-3">
          {rawLoading && <p className="text-sm text-slate-500">{common.loading}…</p>}
          {rawPayload && (
            <pre className="max-h-[400px] overflow-auto rounded-lg border bg-slate-50 p-3 text-xs font-mono whitespace-pre-wrap">
              {rawPayload}
            </pre>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              onClick={() => setRawPayload(null)}
            >
              {labels.close}
            </button>
          </div>
        </div>
      </Dialog>
    </AdminSection>
  );
}
