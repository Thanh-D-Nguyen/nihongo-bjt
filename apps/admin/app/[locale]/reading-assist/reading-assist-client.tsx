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
} from "@nihongo-bjt/ui";
import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

interface ReportRow {
  context: string | null;
  createdAt: string;
  id: string;
  kind: string;
  textHash: string;
  user: { displayName: string; id: string } | null;
}

interface Labels {
  empty: string;
  error: string;
  eyebrow: string;
  hashLabel: string;
  kindLabel: string;
  loading: string;
  subtitle: string;
  title: string;
  userLabel: string;
}

export function ReadingAssistAdminClient({ labels }: { labels: Labels }) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        const response = await adminApiFetch("/api/admin/reading-assist/reports?limit=50");
        if (!response.ok) {
          throw new Error("Reading assist reports failed");
        }
        const data = (await response.json()) as ReportRow[];
        if (!cancelled) {
          setRows(data);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <AdminPageHeader title={labels.title} description={labels.subtitle} />

      {error ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {labels.error}
        </div>
      ) : null}

      <AdminSection>
        {loading ? (
          <div className="p-3 text-sm text-gray-500">{labels.loading}</div>
        ) : rows.length === 0 ? (
          <AdminEmptyState title={labels.empty} />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableRow>
                <AdminDataTableTh>{labels.kindLabel}</AdminDataTableTh>
                <AdminDataTableTh>{labels.hashLabel}</AdminDataTableTh>
                <AdminDataTableTh>{labels.userLabel}</AdminDataTableTh>
                <AdminDataTableTh>Context</AdminDataTableTh>
                <AdminDataTableTh>Time</AdminDataTableTh>
              </AdminDataTableRow>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {rows.map((row) => (
                <AdminDataTableRow key={row.id}>
                  <AdminDataTableTd><span className="text-sm">{row.kind}</span></AdminDataTableTd>
                  <AdminDataTableTd><span className="font-mono text-xs">{row.textHash}</span></AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-sm">{row.user ? `${row.user.displayName} (${row.user.id.slice(0, 8)}…)` : "—"}</span>
                  </AdminDataTableTd>
                  <AdminDataTableTd><span className="text-xs text-gray-600">{row.context ?? "—"}</span></AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString()}</span>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}
